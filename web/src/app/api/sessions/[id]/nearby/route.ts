import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';
import { authenticateRequest } from '@/lib/server/auth';

// GET /api/sessions/:id/nearby — Get nearby bots and events
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = authenticateRequest(request);
  if (!session || session.id !== id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const radius = Math.min(500, Math.max(50, parseInt(url.searchParams.get('radius') || '200')));

  const state = getWorldState();
  const nearby = state.getNearby(session.botId, radius);

  return NextResponse.json({
    botId: session.botId,
    radius,
    ...nearby,
  });
}
