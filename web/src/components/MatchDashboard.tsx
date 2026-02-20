'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiUrl } from '@/lib/api';
import MatchCardView from './MatchCardView';

interface MatchData {
  matchId: string;
  otherBotId: string;
  reason: string;
  createdAt: number;
  card: {
    sharedValues: string[];
    differences: string[];
    highlights: string[];
    botASummary: string;
    botBSummary: string;
    extraData: Record<string, unknown>;
  } | null;
  myApproval: number;
  otherApproval: number;
  otherContactInfo: string | null;
  myContactInfo: string | null;
}

export default function MatchDashboard({ token }: { token: string }) {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [botId, setBotId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/match-view/${token}`));
      if (!res.ok) {
        setError('Invalid or expired link');
        return;
      }
      const data = await res.json();
      setBotId(data.botId);
      setMatches(data.matches);
    } catch {
      setError('Failed to load matches');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-white/40 text-sm">Loading your matches...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">!</span>
          </div>
          <p className="text-white/60 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Group matches by status
  const mutualMatches = matches.filter(m => m.myApproval === 1 && m.otherApproval === 1);
  const pendingApproval = matches.filter(m => m.myApproval === 0 && m.otherApproval !== -1);
  const waitingForOther = matches.filter(m => m.myApproval === 1 && m.otherApproval !== 1);
  const rejected = matches.filter(m => m.myApproval === -1 || m.otherApproval === -1);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-black/20">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <span className="text-sm font-black text-black">CW</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">Your Matches</h1>
              <p className="text-white/30 text-xs font-mono">{botId}</p>
            </div>
          </div>
          <p className="text-white/40 text-sm mt-2">
            Your bot found {matches.length} match{matches.length !== 1 ? 'es' : ''}. Review and approve to exchange contact info.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {matches.length === 0 && (
          <div className="text-center py-16">
            <p className="text-white/30 text-sm">No matches yet. Your bot is still looking!</p>
          </div>
        )}

        {mutualMatches.length > 0 && (
          <Section title="Mutual Matches" count={mutualMatches.length} color="emerald">
            {mutualMatches.map(m => (
              <MatchCardView key={m.matchId} match={m} token={token} onUpdate={fetchMatches} />
            ))}
          </Section>
        )}

        {pendingApproval.length > 0 && (
          <Section title="Pending Your Approval" count={pendingApproval.length} color="amber">
            {pendingApproval.map(m => (
              <MatchCardView key={m.matchId} match={m} token={token} onUpdate={fetchMatches} />
            ))}
          </Section>
        )}

        {waitingForOther.length > 0 && (
          <Section title="Waiting for Other Side" count={waitingForOther.length} color="blue">
            {waitingForOther.map(m => (
              <MatchCardView key={m.matchId} match={m} token={token} onUpdate={fetchMatches} />
            ))}
          </Section>
        )}

        {rejected.length > 0 && (
          <Section title="Rejected" count={rejected.length} color="gray">
            {rejected.map(m => (
              <MatchCardView key={m.matchId} match={m} token={token} onUpdate={fetchMatches} />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  title, count, color, children,
}: {
  title: string;
  count: number;
  color: 'emerald' | 'amber' | 'blue' | 'gray';
  children: React.ReactNode;
}) {
  const dotColors = {
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    blue: 'bg-blue-400',
    gray: 'bg-white/30',
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2 h-2 rounded-full ${dotColors[color]}`} />
        <h2 className="text-white/70 text-sm font-semibold">{title}</h2>
        <span className="text-white/20 text-xs">({count})</span>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
