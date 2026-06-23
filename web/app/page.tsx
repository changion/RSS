'use client';

import { useAuth } from '@/lib/auth';
import { useChannels } from '@/lib/channel-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { cardHoverClass, pageSubtitleClass, pageTitleClass } from '@/lib/larkStyles';

export default function Home() {
  const { user, loading } = useAuth();
  const { openDiscover } = useChannels();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  const cards = [
    {
      type: 'link' as const,
      href: '/reports',
      icon: '📊',
      title: '查看日报',
      desc: '浏览你订阅频道的最新情报',
      accent: 'from-blue-50 to-indigo-50',
    },
    {
      type: 'button' as const,
      icon: '📡',
      title: '频道订阅',
      desc: '申请订阅感兴趣的情报频道',
      accent: 'from-violet-50 to-purple-50',
      onClick: openDiscover,
    },
    {
      type: 'link' as const,
      href: '/settings',
      icon: '⚙️',
      title: '个人设置',
      desc: '配置推送渠道、修改密码',
      accent: 'from-slate-50 to-gray-50',
    },
  ];

  return (
    <div className="p-8">
      <div className="max-w-2xl">
        <h1 className={`${pageTitleClass} text-xl mb-1`}>
          你好，{user.displayName || user.email.split('@')[0]} 👋
        </h1>
        <p className={`${pageSubtitleClass} mb-8`}>欢迎使用情报订阅站</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((card) => {
            const inner = (
              <>
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.accent} flex items-center justify-center text-xl mb-3 shadow-lark-sm`}>
                  {card.icon}
                </div>
                <div className="font-semibold text-lark-primary group-hover:text-lark-accent transition-colors">
                  {card.title}
                </div>
                <div className="text-xs text-lark-secondary mt-1 leading-relaxed">{card.desc}</div>
              </>
            );

            if (card.type === 'link') {
              return (
                <Link
                  key={card.href}
                  href={card.href}
                  className={`${cardHoverClass} rounded-xl p-5 group block`}
                >
                  {inner}
                </Link>
              );
            }

            return (
              <button
                key={card.title}
                onClick={card.onClick}
                className={`${cardHoverClass} rounded-xl p-5 group text-left w-full sm:col-span-2`}
              >
                {inner}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
