import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';

// POST /api/match-view/:token/:matchId/approve — User approves a match and submits contact info
export async function POST(request: Request, { params }: { params: Promise<{ token: string; matchId: string }> }) {
  const { token, matchId } = await params;
  const state = getWorldState();

  const botId = state.getBotIdByOwnerToken(token);
  if (!botId) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
  }

  let body: { contactInfo?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.contactInfo || body.contactInfo.trim().length === 0) {
    return NextResponse.json({ error: 'contactInfo is required' }, { status: 400 });
  }

  const result = state.approveMatch(matchId, botId, body.contactInfo.trim());

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    message: 'Match approved!',
    otherContactInfo: result.otherContactInfo || null,
    bothApproved: !!result.otherContactInfo,
  });
}
