import { getWorldState } from '@/lib/server/world-state';

export async function GET() {
  const state = getWorldState();
  const uint8 = new Uint8Array(state.walkableBitset);
  return new Response(uint8, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
