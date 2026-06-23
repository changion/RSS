'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import { makeSourceLinksClickable, parseIntelItems } from '@/lib/intelFormat';
import IntelItemCards from '@/components/IntelItemCards';

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

export default function ReportDetailClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [error, setError] = useState('');
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !id || id === '__placeholder__') return;
    setLoadingData(true);
    setError('');
    api.get<{ data: ReportDetail }>(`/api/reports/${id}`)
      .then((r) => setReport(r.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingData(false));
  }, [user, id]);

  if (loading || !user) return null;

  const intelItems = report?.processedContent
    ? parseIntelItems(report.processedContent)
    : [];

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/reports" className="text-lark-accent hover:text-lark-accent-hover text-sm mb-6 inline-flex items-center gap-1 font-medium">
        ← 返回日报列表
      </Link>

      {loadingData ? (
        <div className="text-lark-secondary text-sm">加载中...</div>
      ) : error ? (
        <div className="text-red-500 text-sm">{error}</div>
      ) : !report ? null : (
        <>
          <div className="lark-card rounded-xl p-6 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-lark-accent-soft flex items-center justify-center text-xl shrink-0">
                  📅
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-lark-primary">{report.channel.name}</h1>
                  <p className="text-lark-secondary text-sm mt-0.5">
                    {new Date(report.reportDate).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <div className="text-right text-xs text-lark-muted space-y-1">
                <div>{report.itemCount} 条情报</div>
                {report.aiModel && <div>{report.aiModel}</div>}
                {report.processingMs && <div>{(report.processingMs / 1000).toFixed(1)}s</div>}
              </div>
            </div>
          </div>

          {report.processedContent ? (
            intelItems.length > 0 ? (
              <IntelItemCards items={intelItems} />
            ) : (
              <article className="lark-card rounded-xl p-6 prose prose-sm max-w-none
                prose-headings:text-lark-primary prose-p:text-lark-secondary prose-li:text-lark-secondary
                prose-a:text-lark-accent prose-a:font-medium prose-strong:text-lark-primary
                prose-code:bg-lark-bg prose-code:text-lark-accent prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md
                prose-pre:bg-lark-bg prose-pre:rounded-xl
              ">
                <ReactMarkdown>
                  {makeSourceLinksClickable(report.processedContent)}
                </ReactMarkdown>
              </article>
            )
          ) : (
            <div className="lark-card rounded-xl py-12 text-center text-lark-secondary text-sm">
              暂无 AI 处理内容
            </div>
          )}
        </>
      )}
    </div>
  );
}
