import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';
import { authenticateRequest } from '@/lib/server/auth';

// GET /api/sessions/:id — Get session info
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = authenticateRequest(request);
  if (!session || session.id !== id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = getWorldState();
  const bot = state.agentBots.get(session.botId);

  return NextResponse.json({
    sessionId: session.id,
    botId: session.botId,
    position: bot?.position,
    zone: bot?.zone,
    state: bot?.state,
    createdAt: session.createdAt,
  });
}

// DELETE /api/sessions/:id — Leave the world
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = authenticateRequest(request);
  if (!session || session.id !== id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = getWorldState();
  state.deleteSession(id);
  return NextResponse.json({ message: 'Session ended, bot removed from world.' });
}
