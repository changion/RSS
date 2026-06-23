'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { btnSecondary, pageSubtitleClass, pageTitleClass } from '@/lib/larkStyles';

interface Report {
  id: string;
  channelId: string;
  reportDate: string;
  itemCount: number;
  aiModel: string | null;
  channel: { name: string };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ReportsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    setLoadingData(true);
    api.get<{ data: Report[]; pagination: Pagination }>(`/api/reports?page=${page}&limit=20`)
      .then((r) => {
        setReports(r.data);
        setPagination(r.pagination);
      })
      .catch(console.error)
      .finally(() => setLoadingData(false));
  }, [user, page]);

  if (loading || !user) return null;

  return (
    <div className="p-8 max-w-3xl">
      <h1 className={`${pageTitleClass} text-xl mb-1`}>情报日报</h1>
      <p className={pageSubtitleClass}>你订阅频道的历史日报</p>

      <div className="mt-6">
        {loadingData ? (
          <div className="text-lark-secondary text-sm">加载中...</div>
        ) : reports.length === 0 ? (
          <div className="lark-card rounded-xl p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-lark-accent-soft mx-auto mb-4 flex items-center justify-center text-2xl">📭</div>
            <div className="text-lark-secondary text-sm">暂无日报</div>
            <p className="text-lark-muted text-xs mt-2">
              先{' '}
              <Link href="/channels" className="text-lark-accent hover:text-lark-accent-hover font-medium">
                申请订阅频道
              </Link>
              ，审批通过后日报将自动生成
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {reports.map((r) => (
                <Link
                  key={r.id}
                  href={`/reports/${r.id}`}
                  className="lark-card lark-card-hover rounded-xl px-5 py-4 flex items-center gap-4 group block"
                >
                  <div className="w-11 h-11 rounded-xl bg-lark-accent-soft flex items-center justify-center text-lg shrink-0 group-hover:bg-lark-accent-light transition-colors">
                    📅
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-lark-primary group-hover:text-lark-accent transition-colors truncate">
                      {r.channel.name}
                    </div>
                    <div className="text-xs text-lark-secondary mt-0.5">
                      {new Date(r.reportDate).toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                      <span className="text-lark-muted mx-1.5">·</span>
                      {r.itemCount} 条情报
                      {r.aiModel && (
                        <>
                          <span className="text-lark-muted mx-1.5">·</span>
                          <span className="text-lark-muted">{r.aiModel}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-lark-accent text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    查看 →
                  </span>
                </Link>
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className={btnSecondary}
                >
                  上一页
                </button>
                <span className="text-lark-secondary text-sm tabular-nums">
                  {page} / {pagination.totalPages}
                </span>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className={btnSecondary}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
