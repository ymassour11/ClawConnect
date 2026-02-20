'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot } from '@/lib/types';

export interface ChatEntry {
  id: string;
  fromBotId: string;
  toBotId: string;
  text: string;
  createdAt: number;
  position: { x: number; y: number };
}

interface ChatStreamProps {
  chats: ChatEntry[];
  bots: Bot[];
}

export function ChatStream({ chats, bots }: ChatStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevCountRef = useRef(0);

  const getBotName = (id: string) => {
    const bot = bots.find(b => b.id === id);
    return bot?.displayName ?? id.slice(0, 10);
  };

  const getBotColor = (id: string) => {
    const bot = bots.find(b => b.id === id);
    return bot?.color ?? '#888';
  };

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current && chats.length > prevCountRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevCountRef.current = chats.length;
  }, [chats.length, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 60);
  };

  // Group consecutive messages from same sender to same target
  const grouped = groupConsecutive(chats);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-[#0c1020] border-l border-white/[0.06]">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] bg-[#0e1228]/80">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400/40 animate-ping" />
          </div>
          <h2
            className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50"
            style={{ fontFamily: 'var(--font-pixel, monospace)' }}
          >
            Live Chat
          </h2>
          <div className="ml-auto bg-white/[0.04] rounded-md px-2 py-0.5">
            <span className="text-[10px] font-mono text-white/30">
              {chats.length} msg{chats.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-0.5 scroll-smooth"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.08) transparent',
        }}
      >
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-white/20 text-xs">No conversations yet</p>
            <p className="text-white/10 text-[10px] mt-1">Messages will appear here as bots chat</p>
          </div>
        ) : (
          grouped.map((group, gi) => (
            <div key={group.id} className="group/msg">
              {/* Conversation header — show when sender changes or gap > 30s */}
              {(gi === 0 || group.fromBotId !== grouped[gi - 1].fromBotId || group.toBotId !== grouped[gi - 1].toBotId || group.messages[0].createdAt - grouped[gi - 1].messages[grouped[gi - 1].messages.length - 1].createdAt > 30000) && (
                <div className="flex items-center gap-2 pt-3 pb-1.5 first:pt-1">
                  {/* Sender dot */}
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold shrink-0"
                    style={{
                      backgroundColor: getBotColor(group.fromBotId) + '25',
                      color: getBotColor(group.fromBotId),
                      border: `1px solid ${getBotColor(group.fromBotId)}30`,
                    }}
                  >
                    {getBotName(group.fromBotId).charAt(0)}
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    <span
                      className="text-[11px] font-semibold truncate"
                      style={{ color: getBotColor(group.fromBotId) }}
                    >
                      {getBotName(group.fromBotId)}
                    </span>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-white/15 shrink-0">
                      <path d="M3 5h4M5.5 3L7 5l-1.5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-[11px] text-white/40 truncate">
                      {getBotName(group.toBotId)}
                    </span>
                  </div>
                  <span className="text-[9px] text-white/15 font-mono ml-auto shrink-0">
                    {formatTime(group.messages[0].createdAt)}
                  </span>
                </div>
              )}

              {/* Message bubbles */}
              {group.messages.map((msg) => (
                <div
                  key={msg.id}
                  className="pl-7 py-[2px] hover:bg-white/[0.02] rounded transition-colors"
                >
                  <p className="text-[12px] text-white/70 leading-[1.5] break-words">
                    {msg.text}
                  </p>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Scroll-to-bottom indicator */}
      {!autoScroll && chats.length > 0 && (
        <div className="shrink-0 border-t border-white/[0.06]">
          <button
            onClick={() => {
              setAutoScroll(true);
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
            }}
            className="w-full px-4 py-2 text-[10px] text-amber-400/70 hover:text-amber-400 hover:bg-amber-400/[0.04] transition-colors flex items-center justify-center gap-1.5"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 2v6M3 6l2 2 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            New messages below
          </button>
        </div>
      )}
    </div>
  );
}

// ── Group consecutive messages from the same from->to pair ──
interface ChatGroup {
  id: string;
  fromBotId: string;
  toBotId: string;
  messages: ChatEntry[];
}

function groupConsecutive(chats: ChatEntry[]): ChatGroup[] {
  const groups: ChatGroup[] = [];
  for (const chat of chats) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.fromBotId === chat.fromBotId &&
      last.toBotId === chat.toBotId &&
      chat.createdAt - last.messages[last.messages.length - 1].createdAt < 30000
    ) {
      last.messages.push(chat);
    } else {
      groups.push({
        id: chat.id,
        fromBotId: chat.fromBotId,
        toBotId: chat.toBotId,
        messages: [chat],
      });
    }
  }
  return groups;
}
