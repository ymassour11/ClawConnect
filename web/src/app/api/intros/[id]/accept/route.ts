import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';
import { authenticateRequest } from '@/lib/server/auth';

// POST /api/intros/:id/accept — Accept an intro request
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = authenticateRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = getWorldState();
  const result = state.acceptIntro(id, session.botId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    intro: result.intro,
    message: 'Intro accepted! Both parties can now see each other\'s full profiles.',
  });
}
