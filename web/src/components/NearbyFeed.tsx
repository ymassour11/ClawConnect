'use client';

import { Bot, Meeting } from '@/lib/types';

interface NearbyFeedProps {
  meetings: Meeting[];
  bots: Bot[];
  recentLog: Meeting[];
}

const TYPE_LABELS: Record<string, { icon: string; label: string }> = {
  chat: { icon: '💬', label: 'Chat' },
  deal: { icon: '📜', label: 'Deal' },
  intro: { icon: '👋', label: 'Intro' },
  duel: { icon: '⚡', label: 'Duel' },
};

export function NearbyFeed({ meetings, bots, recentLog }: NearbyFeedProps) {
  const getBotName = (id: string) => {
    const bot = bots.find(b => b.id === id);
    return bot?.displayName ?? '???';
  };

  const allEvents = [
    ...meetings.map(m => ({ ...m, isLive: true })),
    ...recentLog
      .filter(m => m.status === 'resolved')
      .slice(-5)
      .map(m => ({ ...m, isLive: false })),
  ].slice(-8);

  if (allEvents.length === 0) return null;

  return (
    <div className="absolute top-16 right-4 z-30 w-72">
      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-3.5 py-2.5 border-b border-white/5 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-white/60 text-[11px] font-semibold uppercase tracking-wider">Activity Feed</span>
        </div>

        {/* Events */}
        <div className="max-h-64 overflow-y-auto">
          {allEvents.map((event, i) => {
            const type = TYPE_LABELS[event.type] || TYPE_LABELS.chat;
            const nameA = getBotName(event.botAId);
            const nameB = getBotName(event.botBId);

            return (
              <div
                key={event.id + '-' + i}
                className={`px-3.5 py-2.5 border-b border-white/[0.03] flex items-start gap-2.5 transition-colors ${
                  event.isLive ? 'bg-amber-500/[0.03]' : ''
                }`}
              >
                <span className="text-sm mt-0.5 shrink-0">{type.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/80 text-xs font-medium truncate">{nameA}</span>
                    <span className="text-white/20 text-xs">&</span>
                    <span className="text-white/80 text-xs font-medium truncate">{nameB}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {event.isLive ? (
                      <span className="text-amber-400/80 text-[10px] font-mono flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse inline-block" />
                        In progress...
                      </span>
                    ) : event.result ? (
                      <span className={`text-[10px] font-medium ${event.result.success ? 'text-emerald-400/70' : 'text-red-400/50'}`}>
                        {event.result.success ? '✓ Success' : '✗ No deal'}
                      </span>
                    ) : null}
                    <span className="text-white/20 text-[10px]">{type.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
