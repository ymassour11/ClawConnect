import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';

export async function GET() {
  const state = getWorldState();
  return NextResponse.json(state.getWorldData());
}
