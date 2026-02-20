import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';

// GET /api/match-view/:token — Get all matches for this owner token
// No Bearer auth needed — the token in the URL is the auth
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = getWorldState();

  const botId = state.getBotIdByOwnerToken(token);
  if (!botId) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
  }

  const matchesWithCards = state.getMatchesWithCardsForBot(botId);

  // Transform for the client
  const results = matchesWithCards.map(m => {
    const otherBotId = m.proposer_bot_id === botId ? m.target_bot_id : m.proposer_bot_id;
    const myApproval = m.approvals.find(a => a.bot_id === botId);
    const otherApproval = m.approvals.find(a => a.bot_id === otherBotId);

    // Only reveal other's contact info if BOTH approved
    const bothApproved = myApproval?.approved === 1 && otherApproval?.approved === 1;

    return {
      matchId: m.id,
      otherBotId,
      reason: m.reason,
      createdAt: m.created_at,
      card: m.card ? {
        sharedValues: JSON.parse(m.card.shared_values),
        differences: JSON.parse(m.card.differences),
        highlights: JSON.parse(m.card.highlights),
        botASummary: m.card.bot_a_summary,
        botBSummary: m.card.bot_b_summary,
        extraData: JSON.parse(m.card.extra_data),
      } : null,
      myApproval: myApproval?.approved ?? 0,
      otherApproval: otherApproval?.approved ?? 0,
      otherContactInfo: bothApproved ? otherApproval!.contact_info : null,
      myContactInfo: myApproval?.contact_info || null,
    };
  });

  return NextResponse.json({ botId, matches: results });
}
