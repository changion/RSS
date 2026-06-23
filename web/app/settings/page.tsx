'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { btnPrimary, inputClass, pageTitleClass, sectionTitleClass } from '@/lib/larkStyles';

interface Subscription {
  id: string;
  status: string;
  applyReason: string;
  customPrompt: string | null;
  promptStatus: string;
  adminNote: string | null;
  activatedAt: string | null;
  createdAt: string;
  channel: { name: string };
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: '待审批',
  REVIEWING: '审核中',
  ACTIVE: '已通过',
  REJECTED: '已拒绝',
  PAUSED: '已暂停',
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  REVIEWING: 'bg-amber-50 text-amber-700',
  ACTIVE: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-600',
  PAUSED: 'bg-amber-50 text-amber-700',
};

export default function SettingsPage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();

  const [pushForm, setPushForm] = useState({
    feishuWebhook: '',
    emailAddress: '',
    emailNotify: false,
  });
  const [pushMsg, setPushMsg] = useState('');
  const [savingPush, setSavingPush] = useState(false);

  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    setPushForm({
      feishuWebhook: user.feishuWebhook || '',
      emailAddress: user.emailAddress || '',
      emailNotify: user.emailNotify,
    });

    api.get<{ data: Subscription[] }>('/api/subscriptions/me')
      .then((r) => setSubscriptions(r.data))
      .catch(console.error);
  }, [user]);

  async function savePushChannels() {
    setSavingPush(true);
    setPushMsg('');
    try {
      await api.put('/api/users/me/push-channels', {
        feishuWebhook: pushForm.feishuWebhook || null,
        emailAddress: pushForm.emailAddress || null,
        emailNotify: pushForm.emailNotify,
      });
      await refreshUser();
      setPushMsg('✓ 推送渠道已保存');
    } catch (err) {
      setPushMsg(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSavingPush(false);
    }
  }

  async function changePassword() {
    if (pwdForm.newPassword !== pwdForm.confirm) {
      setPwdMsg('两次密码不一致');
      return;
    }
    if (pwdForm.newPassword.length < 8) {
      setPwdMsg('新密码至少 8 位');
      return;
    }
    setSavingPwd(true);
    setPwdMsg('');
    try {
      await api.post('/api/auth/change-password', {
        oldPassword: pwdForm.oldPassword,
        newPassword: pwdForm.newPassword,
      });
      setPwdForm({ oldPassword: '', newPassword: '', confirm: '' });
      setPwdMsg('✓ 密码已修改');
    } catch (err) {
      setPwdMsg(err instanceof Error ? err.message : '修改失败');
    } finally {
      setSavingPwd(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <h1 className={`${pageTitleClass} text-xl`}>个人设置</h1>

      <section className="lark-card rounded-xl p-6 space-y-4">
        <h2 className={sectionTitleClass}>推送渠道</h2>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-lark-secondary">
            飞书 Webhook
          </label>
          <input
            type="url"
            value={pushForm.feishuWebhook}
            onChange={(e) => setPushForm({ ...pushForm, feishuWebhook: e.target.value })}
            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-lark-secondary">
            邮件地址
          </label>
          <input
            type="email"
            value={pushForm.emailAddress}
            onChange={(e) => setPushForm({ ...pushForm, emailAddress: e.target.value })}
            placeholder="your@email.com"
            className={inputClass}
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={pushForm.emailNotify}
            onChange={(e) => setPushForm({ ...pushForm, emailNotify: e.target.checked })}
            className="w-4 h-4 accent-lark-accent rounded"
          />
          <span className="text-sm text-lark-primary">开启邮件日报推送</span>
        </label>

        {pushMsg && (
          <p className={`text-sm ${pushMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
            {pushMsg}
          </p>
        )}

        <button
          onClick={savePushChannels}
          disabled={savingPush}
          className={btnPrimary}
        >
          {savingPush ? '保存中...' : '保存推送设置'}
        </button>
      </section>

      <section className="lark-card rounded-xl p-6 space-y-4">
        <h2 className={sectionTitleClass}>修改密码</h2>

        {[
          { id: 'oldPassword', label: '当前密码', placeholder: '输入当前密码' },
          { id: 'newPassword', label: '新密码', placeholder: '至少 8 位' },
          { id: 'confirm', label: '确认新密码', placeholder: '再次输入新密码' },
        ].map(({ id, label, placeholder }) => (
          <div key={id} className="space-y-1.5">
            <label className="text-xs font-medium text-lark-secondary">
              {label}
            </label>
            <input
              type="password"
              value={pwdForm[id as keyof typeof pwdForm]}
              onChange={(e) => setPwdForm({ ...pwdForm, [id]: e.target.value })}
              placeholder={placeholder}
              className={inputClass}
            />
          </div>
        ))}

        {pwdMsg && (
          <p className={`text-sm ${pwdMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
            {pwdMsg}
          </p>
        )}

        <button
          onClick={changePassword}
          disabled={savingPwd}
          className={btnPrimary}
        >
          {savingPwd ? '修改中...' : '修改密码'}
        </button>
      </section>

      <section className="lark-card rounded-xl p-6 space-y-4">
        <h2 className={sectionTitleClass}>我的订阅</h2>

        {subscriptions.length === 0 ? (
          <p className="text-lark-secondary text-sm">暂无订阅记录</p>
        ) : (
          <div className="space-y-2">
            {subscriptions.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-4 p-4 rounded-xl bg-lark-bg/70 hover:bg-lark-bg transition-colors">
                <div>
                  <div className="font-medium text-lark-primary text-sm">{s.channel.name}</div>
                  {s.adminNote && (
                    <p className="text-xs text-red-500 mt-1">备注：{s.adminNote}</p>
                  )}
                  <p className="text-xs text-lark-muted mt-0.5">
                    申请时间：{new Date(s.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-lg font-medium shrink-0 ${STATUS_CLASS[s.status] || 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABEL[s.status] || s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
