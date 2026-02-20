import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';

// POST /api/match-view/:token/:matchId/reject — User rejects a match
export async function POST(request: Request, { params }: { params: Promise<{ token: string; matchId: string }> }) {
  const { token, matchId } = await params;
  const state = getWorldState();

  const botId = state.getBotIdByOwnerToken(token);
  if (!botId) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
  }

  const result = state.rejectMatchApproval(matchId, botId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ message: 'Match rejected' });
}
