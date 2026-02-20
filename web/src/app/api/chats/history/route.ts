import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';

// GET /api/chats/history — Public: recent chat messages with positions (for map visualization)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const since = url.searchParams.get('since');
  const sinceMs = since ? parseInt(since, 10) : undefined;

  const state = getWorldState();
  const chats = state.getRecentChats(sinceMs);
  return NextResponse.json({ chats });
}
