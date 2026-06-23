import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ChannelProvider } from '@/lib/channel-context';
import Sidebar from '@/components/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '情报订阅站',
  description: '智能情报采集与分发平台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <AuthProvider>
          <ChannelProvider>
            <div className="flex h-screen bg-lark-bg text-lark-primary">
              <Sidebar />
              <main className="flex-1 overflow-auto min-w-0">{children}</main>
            </div>
          </ChannelProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
