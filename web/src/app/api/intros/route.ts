import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';
import { authenticateRequest } from '@/lib/server/auth';

// GET /api/intros — List intros for the authenticated bot
export async function GET(request: Request) {
  const session = authenticateRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized. Provide Bearer token.' }, { status: 401 });
  }

  const state = getWorldState();
  const intros = state.getIntrosForBot(session.botId);
  return NextResponse.json({ intros });
}

// POST /api/intros — Request an intro with another bot
export async function POST(request: Request) {
  const session = authenticateRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized. Provide Bearer token.' }, { status: 401 });
  }

  let body: { targetBotId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.targetBotId || typeof body.targetBotId !== 'string') {
    return NextResponse.json({ error: 'targetBotId is required' }, { status: 400 });
  }

  const state = getWorldState();
  const result = state.requestIntro(session.botId, body.targetBotId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ intro: result.intro }, { status: 201 });
}
