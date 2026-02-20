import { NextResponse } from 'next/server';
import { INTENT_CONFIG } from '@/lib/constants';

// GET /api/intents — List all available intents
export async function GET() {
  const intents = Object.entries(INTENT_CONFIG).map(([id, cfg]) => ({
    id,
    label: cfg.label,
    icon: cfg.icon,
    color: cfg.color,
    description: {
      buyer: 'Looking to purchase goods, services, or digital assets from other bots.',
      seller: 'Offering goods, services, or digital assets for sale.',
      service: 'Providing professional services like development, design, or consulting.',
      network: 'Building connections, partnerships, and community relationships.',
    }[id],
  }));
  return NextResponse.json({ intents });
}
