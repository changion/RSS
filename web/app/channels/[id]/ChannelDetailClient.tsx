'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import { makeSourceLinksClickable, parseIntelItems } from '@/lib/intelFormat';
import IntelItemCards from '@/components/IntelItemCards';
import { btnGhost, btnSecondary } from '@/lib/larkStyles';

interface ChannelInfo {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
}

interface ReportSummary {
  id: string;
  channelId: string;
  reportDate: string;
  itemCount: number;
  channel: { name: string };
}

interface ReportDetail {
  id: string;
  channelId: string;
  reportDate: string;
  processedContent: string | null;
  itemCount: number;
  aiModel: string | null;
  processingMs: number | null;
  createdAt: string;
  channel: { name: string };
}

interface Subscription {
  id: string;
  channelId: string;
  status: string;
  adminNote: string | null;
  channel: ChannelInfo;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return '今日情报';
  if (sameDay(date, yesterday)) return '昨日情报';

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}月${day}日`;
}

function channelInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

export default function ChannelDetailClient({ params }: { params: { id: string } }) {
  const { id } = params;
  const { user, loading } = useAuth();
  const router = useRouter();

  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [activeSub, setActiveSub] = useState<Subscription | null>(null);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<ReportDetail | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [initError, setInitError] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      api.get<{ data: Subscription[] }>('/api/subscriptions/me'),
      api.get<{ data: ReportSummary[]; pagination: unknown }>(
        `/api/reports?channelId=${id}&limit=30`,
      ),
    ])
      .then(([subRes, repRes]) => {
        const sub = subRes.data.find((s) => s.channelId === id) ?? null;
        setActiveSub(sub);
        if (sub) {
          setChannelInfo(sub.channel);
        } else {
          api
            .get<{ data: ChannelInfo[] }>('/api/channels')
            .then((r) => {
              const ch = r.data.find((c) => c.id === id) ?? null;
              setChannelInfo(ch);
            })
            .catch(() => {});
        }
        setReports(repRes.data);
        if (repRes.data.length > 0) {
          setSelectedReportId(repRes.data[0].id);
        }
      })
      .catch((err: unknown) => {
        setInitError(err instanceof Error ? err.message : '加载失败');
      })
      .finally(() => setLoadingInit(false));
  }, [user, id]);

  useEffect(() => {
    if (!selectedReportId) return;
    setExpanded(false);
    setLoadingReport(true);
    setReportDetail(null);
    api
      .get<{ data: ReportDetail }>(`/api/reports/${selectedReportId}`)
      .then((r) => setReportDetail(r.data))
      .catch(() => setReportDetail(null))
      .finally(() => setLoadingReport(false));
  }, [selectedReportId]);

  const handlePause = useCallback(async () => {
    if (!activeSub || activeSub.status !== 'ACTIVE') return;
    setPausing(true);
    try {
      await api.patch(`/api/subscriptions/${activeSub.id}/pause`);
      setActiveSub((prev) => (prev ? { ...prev, status: 'PAUSED' } : prev));
    } catch {
      // ignore
    } finally {
      setPausing(false);
    }
  }, [activeSub]);

  const handleResume = useCallback(async () => {
    if (!activeSub || activeSub.status !== 'PAUSED') return;
    setPausing(true);
    try {
      await api.patch(`/api/subscriptions/${activeSub.id}/resume`);
      setActiveSub((prev) => (prev ? { ...prev, status: 'ACTIVE' } : prev));
    } catch {
      // ignore
    } finally {
      setPausing(false);
    }
  }, [activeSub]);

  if (loading || !user) return null;

  if (loadingInit) {
    return (
      <div className="flex items-center justify-center h-full text-lark-secondary text-sm">
        加载中...
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="text-red-500 text-sm">{initError}</div>
        <Link href="/channels" className="text-lark-accent hover:text-lark-accent-hover text-sm font-medium">
          ← 返回频道列表
        </Link>
      </div>
    );
  }

  if (!activeSub || (activeSub.status !== 'ACTIVE' && activeSub.status !== 'PAUSED')) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-lark-accent-soft flex items-center justify-center text-3xl shadow-lark-sm">
          🔒
        </div>
        <div className="text-lark-primary font-semibold text-lg">
          {channelInfo?.name ?? '此频道'}
        </div>
        <div className="text-lark-secondary text-sm text-center max-w-xs leading-relaxed">
          {!activeSub
            ? '你尚未订阅此频道，订阅并通过审核后方可查看情报内容'
            : activeSub.status === 'PENDING' || activeSub.status === 'REVIEWING'
            ? '订阅申请审核中，通过后即可查看情报内容'
            : '订阅申请已被拒绝，无法查看此频道情报'}
        </div>
        <Link
          href="/channels"
          className="text-lark-accent hover:text-lark-accent-hover text-sm font-medium"
        >
          ← 返回频道列表
        </Link>
      </div>
    );
  }

  const intelItems = reportDetail?.processedContent
    ? parseIntelItems(reportDetail.processedContent)
    : [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── 左侧日期列表（飞书会话列表风格） ── */}
      <div className="w-[260px] bg-lark-surface flex flex-col shrink-0 overflow-hidden shadow-lark-sm">
        <div className="px-4 py-4 shrink-0">
          <Link
            href="/channels"
            className="text-xs text-lark-muted hover:text-lark-accent transition-colors mb-3 inline-flex items-center gap-1 font-medium"
          >
            ← 频道列表
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-lark-accent/20 to-lark-accent/5 flex items-center justify-center text-sm font-bold text-lark-accent shrink-0">
              {channelInfo ? channelInitial(channelInfo.name) : '#'}
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-lark-primary text-sm truncate" title={channelInfo?.name}>
                {channelInfo?.name ?? '—'}
              </h2>
              {channelInfo?.description && (
                <p className="text-xs text-lark-secondary mt-0.5 line-clamp-1">
                  {channelInfo.description}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2">
          {reports.length === 0 ? (
            <p className="px-3 py-4 text-xs text-lark-muted">暂无历史情报</p>
          ) : (
            reports.map((r) => {
              const selected = selectedReportId === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => { setSelectedReportId(r.id); setExpanded(false); }}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-all duration-150 flex items-center gap-3 rounded-xl mb-1
                    ${selected
                      ? 'bg-lark-accent-light shadow-sm'
                      : 'hover:bg-lark-bg text-lark-secondary hover:text-lark-primary'
                    }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0
                    ${selected ? 'bg-white shadow-sm' : 'bg-lark-bg'}
                  `}>
                    📅
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`truncate text-sm ${selected ? 'font-medium text-lark-accent' : ''}`}>
                      {formatDateLabel(r.reportDate)}
                    </div>
                    {r.itemCount > 0 && (
                      <div className="text-xs text-lark-muted mt-0.5">{r.itemCount} 条情报</div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── 主内容区 ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-lark-bg">
        <div className="lark-sticky-header px-6 py-3.5 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lark-primary font-semibold text-base truncate">
              {channelInfo?.name ?? '—'}
            </span>
            <span className="shrink-0 text-xs bg-lark-accent-light text-lark-accent px-2.5 py-1 rounded-lg font-medium">
              {channelInfo?.type ?? 'PUBLIC'}
            </span>
          </div>

          {activeSub.status === 'ACTIVE' ? (
            <button
              onClick={handlePause}
              disabled={pausing}
              className={`${btnSecondary} !text-xs !text-amber-700 !bg-amber-50 hover:!bg-amber-100 disabled:opacity-50`}
            >
              {pausing ? '处理中...' : '暂停订阅'}
            </button>
          ) : (
            <button
              onClick={handleResume}
              disabled={pausing}
              className={`${btnSecondary} !text-xs !text-green-700 !bg-green-50 hover:!bg-green-100 disabled:opacity-50`}
            >
              {pausing ? '处理中...' : '恢复订阅'}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-lark-sm flex items-center justify-center text-2xl">📭</div>
              <p className="text-lark-secondary text-sm">暂无情报，频道采集后将显示在这里</p>
            </div>
          ) : loadingReport ? (
            <div className="text-lark-secondary text-sm">加载中...</div>
          ) : !reportDetail ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-lark-sm flex items-center justify-center text-2xl">⏳</div>
              <p className="text-lark-secondary text-sm">
                今日情报生成中，请等待 08:00 推送
              </p>
            </div>
          ) : !reportDetail.processedContent ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-lark-sm flex items-center justify-center text-2xl">⏳</div>
              <p className="text-lark-secondary text-sm">
                今日情报生成中，请等待 08:00 推送
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-2 text-sm text-lark-secondary mb-5">
                <span>
                  {new Date(reportDetail.reportDate).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
                <span className="text-lark-muted">·</span>
                <span>{reportDetail.itemCount} 条情报</span>
                {reportDetail.aiModel && (
                  <>
                    <span className="text-lark-muted">·</span>
                    <span className="text-xs text-lark-muted">{reportDetail.aiModel}</span>
                  </>
                )}
              </div>

              {intelItems.length > 0 ? (
                <div className="relative">
                  <div className={`transition-all duration-300 ${expanded ? '' : 'max-h-[480px] overflow-hidden'}`}>
                    <IntelItemCards items={intelItems} />
                  </div>

                  {!expanded && intelItems.length > 2 && (
                    <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-lark-bg via-lark-bg/90 to-transparent flex items-end justify-center pb-2">
                      <button
                        onClick={() => setExpanded(true)}
                        className={`${btnSecondary} !text-xs shadow-lark-sm`}
                      >
                        展开全部 ↓
                      </button>
                    </div>
                  )}

                  {expanded && intelItems.length > 2 && (
                    <div className="flex justify-center mt-4">
                      <button
                        onClick={() => setExpanded(false)}
                        className={`${btnGhost} !text-xs`}
                      >
                        收起 ↑
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <article className={`lark-card rounded-xl p-6 text-lark-primary leading-relaxed overflow-hidden transition-all duration-300
                    [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-lark-primary [&_h1]:mb-3 [&_h1]:mt-4
                    [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-lark-primary [&_h2]:mb-2 [&_h2]:mt-3
                    [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-lark-primary [&_h3]:mb-2 [&_h3]:mt-3
                    [&_p]:text-lark-secondary [&_p]:mb-3 [&_p]:text-sm [&_p]:leading-relaxed
                    [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:text-sm [&_ul]:text-lark-secondary
                    [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:text-sm [&_ol]:text-lark-secondary
                    [&_li]:mb-1
                    [&_a]:text-lark-accent [&_a]:hover:text-lark-accent-hover [&_a]:font-medium
                    [&_code]:bg-lark-bg [&_code]:text-lark-accent [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-xs
                    [&_pre]:bg-lark-bg [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:mb-3
                    [&_blockquote]:border-l-3 [&_blockquote]:border-lark-accent/30 [&_blockquote]:pl-4 [&_blockquote]:text-lark-secondary
                    [&_hr]:border-lark-border/50 [&_hr]:my-4
                    [&_strong]:text-lark-primary [&_strong]:font-semibold
                    ${expanded ? '' : 'max-h-[400px]'}
                  `}>
                    <ReactMarkdown>
                      {makeSourceLinksClickable(reportDetail.processedContent)}
                    </ReactMarkdown>
                  </article>

                  {!expanded && (
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-lark-bg to-transparent flex items-end justify-center pb-2">
                      <button
                        onClick={() => setExpanded(true)}
                        className={`${btnSecondary} !text-xs shadow-lark-sm`}
                      >
                        展开全文 ↓
                      </button>
                    </div>
                  )}

                  {expanded && (
                    <div className="flex justify-center mt-4">
                      <button
                        onClick={() => setExpanded(false)}
                        className={`${btnGhost} !text-xs`}
                      >
                        收起 ↑
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
