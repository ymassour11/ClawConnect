import MatchDashboard from '@/components/MatchDashboard';

export default async function MatchViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <MatchDashboard token={token} />;
}
