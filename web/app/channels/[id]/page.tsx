import ChannelDetailClient from './ChannelDetailClient';

export async function generateStaticParams() {
  return [{ id: '__placeholder__' }];
}

export default async function ChannelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <ChannelDetailClient params={resolvedParams} />;
}
