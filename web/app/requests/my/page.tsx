'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { btnPrimary, pageSubtitleClass, pageTitleClass } from '@/lib/larkStyles';

interface ChannelRequest {
  id: string;
  title: string;
  description: string;
  contentType: string;
  sourceHint: string | null;
  customPrompt: string | null;
  status: 'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED';
  adminNote: string | null;
  channelId: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bgClass: string; textClass: string }
> = {
  PENDING: {
    label: '待审核',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
  },
  REVIEWING: {
    label: '审核中',
    bgClass: 'bg-lark-accent-light',
    textClass: 'text-lark-accent',
  },
  APPROVED: {
    label: '已批准',
    bgClass: 'bg-green-50',
    textClass: 'text-green-700',
  },
  REJECTED: {
    label: '已拒绝',
    bgClass: 'bg-red-50',
    textClass: 'text-red-600',
  },
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  RSS: 'RSS',
  APK: 'APK 监控',
  WEBSITE: '网页监控',
  RANKING: '榜单追踪',
  AD: '广告监控',
  SOCIAL: '社交媒体',
  OTHER: '其他',
};

export default function MyRequestsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<ChannelRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ data: ChannelRequest[] }>('/api/channel-requests/me')
      .then((r) => setRequests(r.data))
      .catch(() => setRequests([]))
      .finally(() => setLoadingData(false));
  }, [user]);

  if (loading || !user) return null;

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`${pageTitleClass} text-xl mb-1`}>我的需求申请</h1>
          <p className={pageSubtitleClass}>查看你提交的自定义频道需求及审批进度</p>
        </div>
        <a href="/requests" className={`${btnPrimary}`}>
          + 新建需求
        </a>
      </div>

      {loadingData ? (
        <div className="text-lark-secondary text-sm">加载中...</div>
      ) : requests.length === 0 ? (
        <div className="lark-card rounded-xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-lark-accent-soft mx-auto mb-4 flex items-center justify-center text-2xl">📥</div>
          <p className="text-lark-secondary text-sm mb-4">还没有提交过订阅需求</p>
          <a href="/requests" className={btnPrimary}>
            立即提交需求
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.PENDING;
            return (
              <div
                key={req.id}
                className="lark-card lark-card-hover rounded-xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lark-primary truncate">{req.title}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs bg-lark-bg text-lark-secondary px-2 py-0.5 rounded-md font-medium">
                        {CONTENT_TYPE_LABELS[req.contentType] ?? req.contentType}
                      </span>
                      <span className="text-xs text-lark-muted">
                        {new Date(req.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg ${cfg.bgClass} ${cfg.textClass}`}
                  >
                    {cfg.label}
                  </span>
                </div>

                <p className="text-sm text-lark-secondary line-clamp-2 leading-relaxed">{req.description}</p>

                {req.sourceHint && (
                  <p className="text-xs text-lark-muted">
                    来源线索：<span className="text-lark-primary">{req.sourceHint}</span>
                  </p>
                )}

                {req.status === 'REJECTED' && req.adminNote && (
                  <div className="bg-red-50 rounded-xl px-3 py-2.5">
                    <p className="text-xs font-medium text-red-600 mb-0.5">拒绝原因</p>
                    <p className="text-xs text-red-500">{req.adminNote}</p>
                  </div>
                )}

                {req.status === 'APPROVED' && req.adminNote && (
                  <div className="bg-green-50 rounded-xl px-3 py-2.5">
                    <p className="text-xs font-medium text-green-700 mb-0.5">管理员备注</p>
                    <p className="text-xs text-green-600">{req.adminNote}</p>
                  </div>
                )}

                {req.status === 'APPROVED' && req.channelId && (
                  <div className="bg-lark-accent-soft rounded-xl px-3 py-2.5">
                    <p className="text-xs text-lark-accent">
                      频道已开通，前往
                      <a href="/channels" className="underline ml-1 hover:text-lark-accent-hover font-medium">
                        频道订阅
                      </a>
                      页查看
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
