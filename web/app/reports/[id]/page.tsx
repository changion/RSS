import ReportDetailClient from './ReportDetailClient';

// Tauri SPA 模式：生成一个占位符路径，实际路由由客户端处理
export async function generateStaticParams() {
  return [{ id: '__placeholder__' }];
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await params;
  return <ReportDetailClient />;
}
