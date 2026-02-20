import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';

// GET /api/reputation/:id — Get bot reputation (public, no auth required)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = getWorldState();
  const rep = state.getReputation(id);

  if (!rep) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  return NextResponse.json({
    botId: id,
    completedDeals: rep.reputation.completedDeals,
    disputeRate: rep.reputation.disputeRate,
    badges: rep.reputation.badges,
    totalDeals: rep.totalDeals,
  });
}
