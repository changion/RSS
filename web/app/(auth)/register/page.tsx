'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { btnPrimary, inputClass } from '@/lib/larkStyles';

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('两次输入的密码不一致');
      return;
    }

    if (form.password.length < 8) {
      setError('密码至少 8 位');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/register', {
        email: form.email,
        password: form.password,
      });
      await login(form.email, form.password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-lark-bg via-lark-accent-soft/20 to-lark-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-lark-accent to-blue-600 mx-auto mb-4 flex items-center justify-center text-2xl shadow-lark-md">
            📡
          </div>
          <h1 className="text-xl font-semibold text-lark-primary">情报订阅站</h1>
          <p className="text-lark-secondary text-sm mt-1.5">创建你的账号</p>
        </div>

        <form onSubmit={handleSubmit} className="lark-card rounded-2xl p-7 space-y-4 shadow-lark-md">
          {error && (
            <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {[
            { id: 'email', label: '邮箱', type: 'email', placeholder: 'you@example.com' },
            { id: 'password', label: '密码', type: 'password', placeholder: '至少 8 位' },
            { id: 'confirm', label: '确认密码', type: 'password', placeholder: '再次输入密码' },
          ].map(({ id, label, type, placeholder }) => (
            <div key={id} className="space-y-1.5">
              <label className="text-xs font-medium text-lark-secondary">
                {label}
              </label>
              <input
                type={type}
                value={form[id as keyof typeof form]}
                onChange={(e) => update(id, e.target.value)}
                required
                placeholder={placeholder}
                className={inputClass}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className={`${btnPrimary} w-full !py-2.5 !font-semibold`}
          >
            {loading ? '注册中...' : '注册'}
          </button>

          <p className="text-center text-xs text-lark-secondary pt-1">
            已有账号？{' '}
            <Link href="/login" className="text-lark-accent hover:text-lark-accent-hover font-medium">
              去登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
