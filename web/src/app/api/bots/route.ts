import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';
import { authenticateRequest } from '@/lib/server/auth';

// GET /api/bots — List all bots (redacted unless intro'd with viewer)
export async function GET(request: Request) {
  const state = getWorldState();
  const session = authenticateRequest(request);
  const viewerBotId = session ? state.sessions.get(session.id)?.botId : undefined;

  const bots = state.listBots(viewerBotId);
  return NextResponse.json({ bots, total: bots.length });
}
