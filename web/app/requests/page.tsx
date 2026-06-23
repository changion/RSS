'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { btnPrimary, btnSecondary, inputClass, pageSubtitleClass, pageTitleClass, textareaClass } from '@/lib/larkStyles';

const CONTENT_TYPES = [
  { value: 'RSS', label: 'RSS 订阅源' },
  { value: 'APK', label: 'APK 版本监控' },
  { value: 'WEBSITE', label: '网页内容监控' },
  { value: 'RANKING', label: '榜单排名追踪' },
  { value: 'AD', label: '广告素材监控' },
  { value: 'SOCIAL', label: '社交媒体账号' },
  { value: 'OTHER', label: '其他' },
];

interface RequestForm {
  title: string;
  description: string;
  contentType: string;
  sourceHint: string;
  customPrompt: string;
}

export default function RequestsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<RequestForm>({
    title: '',
    description: '',
    contentType: 'RSS',
    sourceHint: '',
    customPrompt: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  function setField(field: keyof RequestForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setMsg('请填写需求标题');
      setIsError(true);
      return;
    }
    if (!form.description.trim()) {
      setMsg('请填写详细描述');
      setIsError(true);
      return;
    }

    setSubmitting(true);
    setMsg('');
    setIsError(false);

    try {
      await api.post('/api/channel-requests', {
        title: form.title.trim(),
        description: form.description.trim(),
        contentType: form.contentType,
        sourceHint: form.sourceHint.trim() || undefined,
        customPrompt: form.customPrompt.trim() || undefined,
      });
      setMsg('需求申请已提交，管理员将尽快评估');
      setIsError(false);
      setTimeout(() => router.push('/requests/my'), 1500);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '提交失败，请重试');
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className={`${pageTitleClass} text-xl mb-1`}>提交订阅需求</h1>
        <p className={pageSubtitleClass}>
          描述你想追踪的内容，管理员评估后会创建对应频道并通知你
        </p>
      </div>

      {msg && (
        <div
          className={`mb-5 px-4 py-3 rounded-xl text-sm ${
            isError ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
          }`}
        >
          {msg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="lark-card rounded-xl p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-lark-secondary">
            需求标题 *
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="如：TikTok Android 版本监控"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-lark-secondary">
            详细描述 *
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="想追踪什么内容？关注哪些维度？更新频率有要求吗？"
            rows={4}
            className={textareaClass}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-lark-secondary">
            内容类型 *
          </label>
          <select
            value={form.contentType}
            onChange={(e) => setField('contentType', e.target.value)}
            className={inputClass}
          >
            {CONTENT_TYPES.map((ct) => (
              <option key={ct.value} value={ct.value}>
                {ct.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-lark-secondary">
            来源线索（可选）
          </label>
          <input
            type="text"
            value={form.sourceHint}
            onChange={(e) => setField('sourceHint', e.target.value)}
            placeholder="包名 / URL / 账号名等，帮助管理员快速定位数据源"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-lark-secondary">
            自定义 AI Prompt（可选）
          </label>
          <textarea
            value={form.customPrompt}
            onChange={(e) => setField('customPrompt', e.target.value)}
            placeholder="希望 AI 如何分析这些内容？如「重点关注版本变更中的广告相关改动」"
            rows={3}
            className={`${textareaClass} font-mono text-xs`}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className={`${btnSecondary} flex-1 !py-2.5`}
          >
            返回
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={`${btnPrimary} flex-1 !py-2.5`}
          >
            {submitting ? '提交中...' : '提交需求'}
          </button>
        </div>

        <div className="text-center pt-1">
          <a href="/requests/my" className="text-xs text-lark-secondary hover:text-lark-accent transition-colors font-medium">
            查看我已提交的需求 →
          </a>
        </div>
      </form>
    </div>
  );
}
