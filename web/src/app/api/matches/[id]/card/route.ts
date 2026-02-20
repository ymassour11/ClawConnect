import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';
import { authenticateRequest } from '@/lib/server/auth';

// GET /api/matches/:id/card — Get match card data
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = authenticateRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = getWorldState();
  const match = state.getMatchById(id);
  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }
  if (match.proposer_bot_id !== session.botId && match.target_bot_id !== session.botId) {
    return NextResponse.json({ error: 'Not involved in this match' }, { status: 403 });
  }

  const card = state.getMatchCard(id);
  return NextResponse.json({ card: card || null });
}

// PUT /api/matches/:id/card — Fill match card data (only when status is 'matched')
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = authenticateRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    sharedValues?: string[];
    differences?: string[];
    highlights?: string[];
    summary?: string;
    extraData?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const state = getWorldState();
  const result = state.fillMatchCard(id, session.botId, body);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const card = state.getMatchCard(id);
  return NextResponse.json({ card, message: 'Match card updated' });
}
