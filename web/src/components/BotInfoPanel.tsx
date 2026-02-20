'use client';

import { Bot } from '@/lib/types';
import { INTENT_CONFIG } from '@/lib/constants';

interface BotInfoPanelProps {
  bot: Bot;
  onClose: () => void;
}

export function BotInfoPanel({ bot, onClose }: BotInfoPanelProps) {
  const intent = INTENT_CONFIG[bot.intent as keyof typeof INTENT_CONFIG] ?? { color: '#888888', icon: '\u{2753}', label: 'Unknown' };

  return (
    <div className="absolute bottom-16 left-4 z-40 w-80 animate-in slide-in-from-left-4 duration-300">
      <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: bot.color + '30', border: `2px solid ${bot.color}` }}
            >
              <span className="text-xl">{intent.icon}</span>
            </div>
            <div>
              <h3 className="text-white font-bold text-base leading-none">{bot.displayName}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ color: intent.color, backgroundColor: intent.color + '20' }}
                >
                  {intent.label}
                </span>
                <span className="text-white/30 text-[10px]">#{bot.id.slice(-6)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/70 transition-colors p-1"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Offer line */}
        <div className="bg-white/5 rounded-lg px-3 py-2 mb-4">
          <p className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">Offer</p>
          <p className="text-white/80 text-sm italic">&ldquo;{bot.offerLine}&rdquo;</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white/5 rounded-lg px-3 py-2 text-center">
            <p className="text-white font-bold text-lg leading-none">{bot.reputation.completedDeals}</p>
            <p className="text-white/40 text-[10px] mt-1">Deals</p>
          </div>
          <div className="bg-white/5 rounded-lg px-3 py-2 text-center">
            <p className="text-white font-bold text-lg leading-none">
              {Math.round((1 - bot.reputation.disputeRate) * 100)}%
            </p>
            <p className="text-white/40 text-[10px] mt-1">Trust</p>
          </div>
          <div className="bg-white/5 rounded-lg px-3 py-2 text-center">
            <p className="text-white font-bold text-lg leading-none capitalize text-sm">
              {bot.state}
            </p>
            <p className="text-white/40 text-[10px] mt-1">Status</p>
          </div>
        </div>

        {/* Badges */}
        {bot.reputation.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {bot.reputation.badges.map((badge) => (
              <span
                key={badge}
                className="text-[10px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full"
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Zone */}
        {bot.zone && (
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-white/40 text-xs">Currently in <span className="text-white/60 font-medium capitalize">{bot.zone.replace('-', ' ')}</span></span>
          </div>
        )}

        {/* View profile link */}
        <a
          href={`/bot/${bot.id}`}
          className="mt-3 flex items-center justify-center gap-1.5 text-amber-400/70 hover:text-amber-400 text-xs font-medium transition-colors py-2 bg-amber-400/5 hover:bg-amber-400/10 rounded-lg"
        >
          View Full Profile
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </a>
      </div>
    </div>
  );
}
