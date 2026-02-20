import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';
import { authenticateRequest } from '@/lib/server/auth';

// POST /api/sessions/:id/move — Move bot to a new position
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = authenticateRequest(request);
  if (!session || session.id !== id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { x?: number; y?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.x !== 'number' || typeof body.y !== 'number') {
    return NextResponse.json({ error: 'x and y are required (numbers, pixel coordinates)' }, { status: 400 });
  }

  const state = getWorldState();
  const result = state.moveBot(session.botId, body.x, body.y);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const bot = state.agentBots.get(session.botId);
  return NextResponse.json({
    position: bot?.position,
    zone: bot?.zone,
    state: bot?.state,
  });
}
