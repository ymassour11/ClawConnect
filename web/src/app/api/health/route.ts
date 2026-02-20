import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getWorldState } from '@/lib/server/world-state';

export async function GET() {
  try {
    // Verify SQLite connectivity
    const db = getDb();
    db.prepare('SELECT 1').get();

    const world = getWorldState();

    return NextResponse.json({
      status: 'ok',
      timestamp: Date.now(),
      worldStats: {
        agents: world.agentBots.size,
        sessions: world.sessions.size,
        npcBots: world.npcBots.size,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', error: String(err) },
      { status: 500 },
    );
  }
}
