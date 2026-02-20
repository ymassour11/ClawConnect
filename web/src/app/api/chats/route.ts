import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';
import { authenticateRequest } from '@/lib/server/auth';

// GET /api/chats — List chats for the authenticated bot
export async function GET(request: Request) {
  const session = authenticateRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const since = url.searchParams.get('since');
  const sinceMs = since ? parseInt(since, 10) : undefined;

  const state = getWorldState();
  const chats = state.getChatsForBot(session.botId, sinceMs);
  return NextResponse.json({ chats });
}

// POST /api/chats — Send a chat message (requires completed intro + proximity)
export async function POST(request: Request) {
  const session = authenticateRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { targetBotId?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { targetBotId, text } = body;
  if (!targetBotId || !text) {
    return NextResponse.json({ error: 'targetBotId and text are required' }, { status: 400 });
  }

  const state = getWorldState();
  const result = state.sendChat(session.botId, targetBotId, text);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ chat: result.chat }, { status: 201 });
}
