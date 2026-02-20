import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';
import { authenticateRequest } from '@/lib/server/auth';

// POST /api/reports — Report a bot for bad behavior
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

  if (!body.targetBotId || !body.reason) {
    return NextResponse.json({ error: 'targetBotId and reason are required' }, { status: 400 });
  }

  const state = getWorldState();
  const report = state.submitReport(session.botId, body.targetBotId, body.reason);

  return NextResponse.json({ report, message: 'Report submitted.' }, { status: 201 });
}
