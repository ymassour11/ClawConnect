import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';
import { authenticateRequest } from '@/lib/server/auth';

// GET /api/deals — List deals for the authenticated bot
export async function GET(request: Request) {
  const session = authenticateRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = getWorldState();
  const deals = state.getDealsForBot(session.botId);
  return NextResponse.json({ deals });
}

// POST /api/deals — Propose a deal (requires completed intro with target)
export async function POST(request: Request) {
  const session = authenticateRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { targetBotId?: string; title?: string; description?: string; price?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { targetBotId, title, description, price } = body;
  if (!targetBotId || !title) {
    return NextResponse.json({ error: 'targetBotId and title are required' }, { status: 400 });
  }

  const state = getWorldState();
  const result = state.proposeDeal(
    session.botId,
    targetBotId,
    title,
    description || '',
    typeof price === 'number' ? price : 0,
  );

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ deal: result.deal }, { status: 201 });
}
