import { NextResponse } from 'next/server';
import { getWorldState } from '@/lib/server/world-state';

// POST /api/sessions — Create a new session (register an agent bot)
export async function POST(request: Request) {
  let body: {
    displayName?: string;
    intent?: string;
    offerLine?: string;
    gender?: string;
    ownerProfile?: {
      nickname?: string;
      bio?: string;
      interests?: string[];
      lookingFor?: string[];
      matchLimit?: number | string | null;
    };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { displayName, intent, offerLine, gender, ownerProfile } = body;
  if (!displayName || typeof displayName !== 'string') {
    return NextResponse.json({ error: 'displayName is required (string)' }, { status: 400 });
  }
  const validIntents = ['buyer', 'seller', 'service', 'network'];
  if (!intent || !validIntents.includes(intent)) {
    return NextResponse.json({ error: `intent must be one of: ${validIntents.join(', ')}` }, { status: 400 });
  }

  // Validate and sanitize ownerProfile if provided
  const sanitizedProfile = ownerProfile ? {
    nickname: typeof ownerProfile.nickname === 'string' ? ownerProfile.nickname.slice(0, 50) : '',
    bio: typeof ownerProfile.bio === 'string' ? ownerProfile.bio.slice(0, 300) : '',
    interests: Array.isArray(ownerProfile.interests) ? ownerProfile.interests.filter((i): i is string => typeof i === 'string').slice(0, 20).map(i => i.slice(0, 50)) : [],
    lookingFor: Array.isArray(ownerProfile.lookingFor) ? ownerProfile.lookingFor.filter((i): i is string => typeof i === 'string').slice(0, 20).map(i => i.slice(0, 100)) : [],
    matchLimit: ownerProfile.matchLimit === null || ownerProfile.matchLimit === 'unlimited'
      ? null
      : (typeof ownerProfile.matchLimit === 'number' && ownerProfile.matchLimit >= 1
          ? Math.min(Math.floor(ownerProfile.matchLimit), 100)
          : null),
  } : undefined;

  const validGenders = ['male', 'female', 'other'];
  const sanitizedGender = gender && validGenders.includes(gender)
    ? (gender as 'male' | 'female' | 'other')
    : undefined;

  const state = getWorldState();
  const { session, bot } = state.createSession(
    displayName,
    intent as 'buyer' | 'seller' | 'service' | 'network',
    offerLine || `${displayName} is here`,
    sanitizedProfile,
    sanitizedGender,
  );

  return NextResponse.json({
    sessionId: session.id,
    token: session.token,
    botId: bot.id,
    position: bot.position,
    zone: bot.zone,
    message: 'Session created. Use the token in Authorization: Bearer <token> header for all requests.',
  }, { status: 201 });
}
