'use client';

import { useState } from 'react';
import { apiUrl } from '@/lib/api';

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

export default function MatchCardView({
  match,
  token,
  onUpdate,
}: {
  match: MatchData;
  token: string;
  onUpdate: () => void;
}) {
  const [contactInput, setContactInput] = useState(match.myContactInfo || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bothApproved = match.myApproval === 1 && match.otherApproval === 1;
  const iApproved = match.myApproval === 1;
  const iRejected = match.myApproval === -1;
  const otherApproved = match.otherApproval === 1;
  const otherRejected = match.otherApproval === -1;

  async function handleApprove() {
    if (!contactInput.trim()) {
      setError('Please enter your contact info');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl(`/api/match-view/${token}/${match.matchId}/approve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactInfo: contactInput.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to approve');
      } else {
        onUpdate();
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl(`/api/match-view/${token}/${match.matchId}/reject`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to reject');
      } else {
        onUpdate();
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  const card = match.card;
  const date = new Date(match.createdAt).toLocaleDateString();

  return (
    <div className="border border-white/10 rounded-2xl bg-white/[0.03] p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/40 text-xs font-mono">{match.matchId}</p>
          <p className="text-white/30 text-xs mt-1">Matched on {date}</p>
        </div>
        <StatusBadge
          iApproved={iApproved}
          iRejected={iRejected}
          otherApproved={otherApproved}
          otherRejected={otherRejected}
          bothApproved={bothApproved}
        />
      </div>

      {/* Reason */}
      {match.reason && (
        <div>
          <p className="text-white/50 text-xs uppercase tracking-wide mb-1">Why you matched</p>
          <p className="text-white/80 text-sm">{match.reason}</p>
        </div>
      )}

      {/* Card Content */}
      {card && (
        <>
          {card.sharedValues.length > 0 && (
            <div>
              <p className="text-white/50 text-xs uppercase tracking-wide mb-2">Shared Values</p>
              <div className="flex flex-wrap gap-2">
                {card.sharedValues.map((v, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {card.differences.length > 0 && (
            <div>
              <p className="text-white/50 text-xs uppercase tracking-wide mb-2">Interesting Differences</p>
              <div className="flex flex-wrap gap-2">
                {card.differences.map((d, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {card.highlights.length > 0 && (
            <div>
              <p className="text-white/50 text-xs uppercase tracking-wide mb-2">Conversation Highlights</p>
              <ul className="space-y-1.5">
                {card.highlights.map((h, i) => (
                  <li key={i} className="text-white/70 text-sm flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">*</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(card.botASummary || card.botBSummary) && (
            <div>
              <p className="text-white/50 text-xs uppercase tracking-wide mb-2">Bot Summaries</p>
              {card.botASummary && (
                <p className="text-white/70 text-sm mb-1 italic">&ldquo;{card.botASummary}&rdquo;</p>
              )}
              {card.botBSummary && (
                <p className="text-white/70 text-sm italic">&ldquo;{card.botBSummary}&rdquo;</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Both approved — contact exchange */}
      {bothApproved && match.otherContactInfo && (
        <div className="border border-emerald-500/30 rounded-xl bg-emerald-500/5 p-4">
          <p className="text-emerald-400 text-sm font-semibold mb-1">Mutual Match!</p>
          <p className="text-white/60 text-xs mb-2">Both sides approved. Here&apos;s their contact info:</p>
          <p className="text-white font-mono text-sm bg-black/30 rounded-lg px-3 py-2">{match.otherContactInfo}</p>
        </div>
      )}

      {/* Action area */}
      {!iApproved && !iRejected && (
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-white/50 text-xs uppercase tracking-wide block mb-1.5">
              Your contact info (shared only on mutual approval)
            </label>
            <input
              type="text"
              value={contactInput}
              onChange={e => setContactInput(e.target.value)}
              placeholder="email, phone, link — whatever you prefer"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={loading}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'Approve'}
            </button>
            <button
              onClick={handleReject}
              disabled={loading}
              className="px-6 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white py-2.5 rounded-lg transition-colors border border-white/10 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Already approved, waiting */}
      {iApproved && !bothApproved && (
        <div className="border border-amber-500/20 rounded-xl bg-amber-500/5 p-4">
          <p className="text-amber-400 text-sm font-semibold">Approved — waiting for the other side</p>
          <p className="text-white/50 text-xs mt-1">Your contact info: {match.myContactInfo}</p>
        </div>
      )}

      {/* Rejected */}
      {iRejected && (
        <div className="border border-white/10 rounded-xl bg-white/[0.02] p-4">
          <p className="text-white/40 text-sm">You rejected this match.</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  iApproved, iRejected, otherApproved, otherRejected, bothApproved,
}: {
  iApproved: boolean; iRejected: boolean; otherApproved: boolean; otherRejected: boolean; bothApproved: boolean;
}) {
  if (bothApproved) {
    return <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20 font-semibold">Mutual Match</span>;
  }
  if (iRejected || otherRejected) {
    return <span className="px-3 py-1 rounded-full bg-white/5 text-white/30 text-xs border border-white/10">Rejected</span>;
  }
  if (iApproved && !otherApproved) {
    return <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs border border-amber-500/20">Waiting</span>;
  }
  if (otherApproved && !iApproved) {
    return <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20">They Approved</span>;
  }
  return <span className="px-3 py-1 rounded-full bg-white/5 text-white/40 text-xs border border-white/10">Pending</span>;
}
