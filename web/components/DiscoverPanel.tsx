'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useChannels } from '@/lib/channel-context';
import { btnPrimary, btnGhost } from '@/lib/larkStyles';

interface Channel {
  id: string;
  name: string;
  description: string;
  type: string;
  collectFrequency: string;
  status: string;
}

interface Props {
  onClose: () => void;
}

export default function DiscoverPanel({ onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { subscriptions, refreshSubscriptions } = useChannels();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const subscribedIds = new Set(
    subscriptions
      .filter((s) => ['ACTIVE', 'PENDING', 'REVIEWING', 'PAUSED'].includes(s.status))
      .map((s) => s.channelId),
  );

  useEffect(() => {
    api
      .get<{ data: Channel[] }>('/api/channels')
      .then((res) => setChannels(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  async function handleSubscribe(channelId: string) {
    setSubscribing(channelId);
    setMsg(null);
    try {
      await api.post('/api/subscriptions', { channelId, applyReason: '直接订阅' });
      await refreshSubscriptions();
      setMsg({ id: channelId, text: '订阅成功', ok: true });
    } catch (err) {
      setMsg({ id: channelId, text: err instanceof Error ? err.message : '订阅失败', ok: false });
    } finally {
      setSubscribing(null);
    }
  }

  return (
    <div
      ref={panelRef}
      className="fixed left-[240px] top-16 w-[340px] bg-lark-surface rounded-xl shadow-lark-lg z-50 flex flex-col overflow-hidden"
      style={{ maxHeight: '75vh' }}
    >
      <div className="flex items-center justify-between px-5 py-4 shrink-0 bg-gradient-to-r from-lark-accent-soft/40 to-transparent">
        <h2 className="text-sm font-semibold text-lark-primary">发现频道</h2>
        <button
          onClick={onClose}
          className={`${btnGhost} w-7 h-7 !p-0 text-lg`}
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <p className="text-lark-muted text-xs px-3 py-6 text-center">加载中...</p>
        ) : channels.length === 0 ? (
          <p className="text-lark-muted text-xs px-3 py-6 text-center">暂无公开频道</p>
        ) : (
          channels.map((ch) => {
            const isSubscribed = subscribedIds.has(ch.id);
            const isLoading = subscribing === ch.id;
            const channelMsg = msg?.id === ch.id ? msg : null;

            return (
              <div
                key={ch.id}
                className="px-4 py-3.5 rounded-xl bg-lark-bg/60 hover:bg-lark-accent-soft/40 transition-colors duration-150"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-lark-accent/10 flex items-center justify-center text-sm shrink-0">
                      📡
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-lark-primary truncate">{ch.name}</span>
                        <span className="text-[10px] bg-lark-accent-light text-lark-accent px-1.5 py-0.5 rounded-md shrink-0 font-medium">
                          {ch.type === 'PUBLIC' ? '公开' : '私有'}
                        </span>
                      </div>
                      {ch.description && (
                        <p className="text-xs text-lark-secondary mt-1 line-clamp-2 leading-relaxed">{ch.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    {isSubscribed ? (
                      <span className="text-xs text-lark-muted bg-white px-2.5 py-1 rounded-lg shadow-lark-sm font-medium">
                        ✓ 已订阅
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSubscribe(ch.id)}
                        disabled={isLoading}
                        className={`${btnPrimary} !text-xs !px-3 !py-1.5`}
                      >
                        {isLoading ? '...' : '+ 订阅'}
                      </button>
                    )}
                  </div>
                </div>
                {channelMsg && (
                  <p className={`text-xs mt-2 pl-12 ${channelMsg.ok ? 'text-green-600' : 'text-red-500'}`}>
                    {channelMsg.text}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="px-5 py-4 shrink-0 bg-lark-bg/50">
        <Link
          href="/requests"
          onClick={onClose}
          className="text-xs text-lark-accent hover:text-lark-accent-hover font-medium transition-colors"
        >
          提交自定义需求 →
        </Link>
      </div>
    </div>
  );
}
