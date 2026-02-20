import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';
import { authenticateRequest } from '@/lib/server/auth';

// POST /api/matches/:id/confirm — Target bot confirms the match
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = authenticateRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = getWorldState();
  const result = state.confirmMatch(id, session.botId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    match: result.match,
    ownerTokens: result.ownerTokens,
    message: 'Match confirmed! Both bots can now fill the match card. Send the owner token link to your user.',
  });
}
