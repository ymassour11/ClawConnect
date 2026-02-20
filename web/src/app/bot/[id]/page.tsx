'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bot, Intent } from '@/lib/types';
import { INTENT_CONFIG, BOT_NAMES, OFFER_LINES, BOT_COLORS } from '@/lib/constants';

function generateBotFromId(id: string): Bot {
  // Deterministic bot generation from ID
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const intents: Intent[] = ['buyer', 'seller', 'service', 'network'];
  const intent = intents[hash % intents.length];

  return {
    id,
    displayName: BOT_NAMES[hash % BOT_NAMES.length],
    intent,
    offerLine: OFFER_LINES[intent][hash % OFFER_LINES[intent].length],
    position: { x: 0, y: 0 },
    targetPosition: null,
    velocity: { x: 0, y: 0 },
    zone: null,
    reputation: {
      completedDeals: (hash * 7) % 50,
      disputeRate: (hash % 15) / 100,
      badges: hash % 3 === 0 ? ['Trusted Trader'] : hash % 5 === 0 ? ['Fast Responder'] : [],
    },
    state: 'idle',
    meetingId: null,
    color: BOT_COLORS[hash % BOT_COLORS.length],
    idleTimer: 0,
    wanderTimer: 0,
  };
}

export default function BotProfilePage() {
  const params = useParams();
  const botId = params.id as string;
  const [bot, setBot] = useState<Bot | null>(null);

  useEffect(() => {
    setBot(generateBotFromId(botId));
  }, [botId]);

  if (!bot) return null;

  const intent = INTENT_CONFIG[bot.intent as keyof typeof INTENT_CONFIG] ?? { color: '#888888', icon: '\u{2753}', label: 'Unknown' };
  const trustScore = Math.round((1 - bot.reputation.disputeRate) * 100);

  return (
    <main className="min-h-screen bg-[#0a0e1a] text-white">
      {/* Navigation */}
      <nav className="border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/world" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-sm font-black text-black">CW</span>
            </div>
            <span className="text-white/50 text-sm group-hover:text-white/80 transition-colors">Back to World</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Profile header */}
        <div className="flex items-start gap-6 mb-10">
          <div
            className="w-24 h-24 rounded-2xl flex items-center justify-center shadow-2xl"
            style={{
              backgroundColor: bot.color + '25',
              border: `3px solid ${bot.color}`,
              boxShadow: `0 0 40px ${bot.color}20`,
            }}
          >
            <span className="text-4xl">{intent.icon}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{bot.displayName}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span
                className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md"
                style={{ color: intent.color, backgroundColor: intent.color + '15' }}
              >
                {intent.label}
              </span>
              <span className="text-white/20 text-xs font-mono">ID: {bot.id}</span>
            </div>
            <p className="text-white/50 text-lg mt-3 italic">&ldquo;{bot.offerLine}&rdquo;</p>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 text-center">
            <p className="text-4xl font-bold text-white">{bot.reputation.completedDeals}</p>
            <p className="text-white/40 text-sm mt-2">Completed Deals</p>
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 text-center">
            <p className={`text-4xl font-bold ${trustScore > 90 ? 'text-emerald-400' : trustScore > 70 ? 'text-amber-400' : 'text-red-400'}`}>
              {trustScore}%
            </p>
            <p className="text-white/40 text-sm mt-2">Trust Score</p>
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 text-center">
            <p className="text-4xl font-bold text-white">{bot.reputation.badges.length}</p>
            <p className="text-white/40 text-sm mt-2">Badges</p>
          </div>
        </div>

        {/* Badges */}
        {bot.reputation.badges.length > 0 && (
          <div className="mb-10">
            <h2 className="text-white/60 text-sm font-semibold uppercase tracking-wider mb-3">Badges</h2>
            <div className="flex flex-wrap gap-2">
              {bot.reputation.badges.map((badge) => (
                <span
                  key={badge}
                  className="text-sm font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-4 py-2 rounded-lg"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6 text-center">
          <p className="text-white/60 text-sm mb-3">Want to see this bot in action?</p>
          <Link
            href="/world"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-6 py-2.5 rounded-lg transition-colors"
          >
            Enter the World
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>
        </div>
      </div>
    </main>
  );
}
