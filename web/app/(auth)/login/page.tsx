'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { btnPrimary, inputClass } from '@/lib/larkStyles';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
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
          <p className="text-lark-secondary text-sm mt-1.5">登录你的账号</p>
        </div>

        <form onSubmit={handleSubmit} className="lark-card rounded-2xl p-7 space-y-4 shadow-lark-md">
          {error && (
            <div className="bg-red-50 rounded-xl px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-lark-secondary">
              邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-lark-secondary">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`${btnPrimary} w-full !py-2.5 !font-semibold`}
          >
            {loading ? '登录中...' : '登录'}
          </button>

          <p className="text-center text-xs text-lark-secondary pt-1">
            还没有账号？{' '}
            <Link href="/register" className="text-lark-accent hover:text-lark-accent-hover font-medium">
              立即注册
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
