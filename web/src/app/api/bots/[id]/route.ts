import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';
import { authenticateRequest } from '@/lib/server/auth';

// GET /api/bots/:id — Get single bot (redacted unless intro'd)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const state = getWorldState();
  const session = authenticateRequest(request);
  const viewerBotId = session ? state.sessions.get(session.id)?.botId : undefined;

  const bot = state.getBotById(id, viewerBotId);
  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }
  return NextResponse.json(bot);
}
