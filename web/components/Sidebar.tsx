'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useChannels } from '@/lib/channel-context';
import DiscoverPanel from '@/components/DiscoverPanel';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { subscriptions, loadingSubscriptions, refreshSubscriptions, showDiscover, openDiscover, closeDiscover } = useChannels();
  const discoverBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (user) {
      refreshSubscriptions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  if (!user) return null;

  const myChannels = subscriptions.filter(
    (s) => s.status === 'ACTIVE' || s.status === 'PAUSED',
  );

  return (
    <aside className="w-[240px] bg-lark-sidebar flex flex-col shrink-0 relative shadow-lark-sm z-20">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-lark-accent to-blue-600 flex items-center justify-center shadow-lark-sm">
          <span className="text-base leading-none">📡</span>
        </div>
        <div className="min-w-0">
          <span className="font-semibold text-sm text-lark-primary block truncate">情报订阅站</span>
          <span className="text-[10px] text-lark-muted">Intel Hub</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
        <NavItem href="/" icon="🏠" label="首页" pathname={pathname} />
        <NavItem href="/reports" icon="📅" label="日报" pathname={pathname} />

        <div className="pt-4 pb-1.5 px-2">
          <p className="text-lark-muted text-[11px] font-medium tracking-wide">我的频道</p>
        </div>

        {loadingSubscriptions ? (
          <p className="text-lark-muted text-xs px-3 py-2">加载中...</p>
        ) : myChannels.length === 0 ? (
          <p className="text-lark-muted text-xs px-3 py-2 leading-relaxed">
            还没有订阅的频道
          </p>
        ) : (
          <div className="space-y-0.5">
            {myChannels.map((sub) => {
              const channelPath = `/channels/${sub.channel.id}`;
              const active = pathname === channelPath || pathname.startsWith(channelPath + '/');
              return (
                <Link
                  key={sub.id}
                  href={channelPath}
                  className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150
                    ${active
                      ? 'lark-nav-active shadow-sm'
                      : 'text-lark-secondary hover:text-lark-primary hover:bg-white/80'
                    }`}
                >
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0
                    ${active ? 'bg-lark-accent/15 text-lark-accent' : 'bg-lark-bg text-lark-muted group-hover:bg-lark-accent-soft group-hover:text-lark-accent'}
                  `}>
                    #
                  </span>
                  <span className="truncate">{sub.channel.name}</span>
                </Link>
              );
            })}
          </div>
        )}

        <div className="relative pt-1">
          <button
            ref={discoverBtnRef}
            onClick={() => {
              if (!showDiscover) refreshSubscriptions();
              openDiscover();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-lark-secondary hover:text-lark-accent hover:bg-lark-accent-soft/60 transition-all duration-150"
          >
            <span className="w-6 h-6 rounded-md bg-lark-bg flex items-center justify-center text-sm leading-none">＋</span>
            <span>发现频道</span>
          </button>

          {showDiscover && (
            <DiscoverPanel onClose={closeDiscover} />
          )}
        </div>

        <div className="pt-4 pb-1.5 px-2">
          <p className="text-lark-muted text-[11px] font-medium tracking-wide">更多</p>
        </div>
        <NavItem href="/requests/my" icon="📋" label="我的需求" pathname={pathname} />
        <NavItem href="/settings" icon="⚙️" label="设置" pathname={pathname} />
      </nav>

      {/* 用户信息 */}
      <div className="p-3 shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-white/70 shadow-lark-sm">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-lark-accent to-blue-500 flex items-center justify-center text-xs font-semibold text-white shrink-0 shadow-sm">
            {(user.displayName || user.email).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-lark-primary truncate">
              {user.displayName || user.email}
            </div>
          </div>
          <button
            onClick={logout}
            className="text-lark-muted hover:text-red-500 text-xs transition-colors shrink-0 px-1.5 py-0.5 rounded hover:bg-red-50"
            title="退出登录"
          >
            退出
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  icon,
  label,
  pathname,
}: {
  href: string;
  icon: string;
  label: string;
  pathname: string;
}) {
  const active = pathname === href || (href !== '/' && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150
        ${active
          ? 'lark-nav-active shadow-sm'
          : 'text-lark-secondary hover:text-lark-primary hover:bg-white/80'
        }`}
    >
      <span className="text-base leading-none w-5 text-center">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
