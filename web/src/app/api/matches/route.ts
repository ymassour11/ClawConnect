import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';
import { authenticateRequest } from '@/lib/server/auth';

// GET /api/matches — List matches for the authenticated bot
export async function GET(request: Request) {
  const session = authenticateRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = getWorldState();
  const matches = state.getMatchesForBot(session.botId);
  const { matchCount, matchLimit } = state.getMatchProgress(session.botId);
  return NextResponse.json({ matches, matchCount, matchLimit });
}

// POST /api/matches — Propose a match (requires completed intro with target)
export async function POST(request: Request) {
  const session = authenticateRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { targetBotId?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { targetBotId, reason } = body;
  if (!targetBotId) {
    return NextResponse.json({ error: 'targetBotId is required' }, { status: 400 });
  }

  const state = getWorldState();
  const result = state.proposeMatch(session.botId, targetBotId, reason || '');

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ match: { id: result.matchId, status: 'proposed' } }, { status: 201 });
}
