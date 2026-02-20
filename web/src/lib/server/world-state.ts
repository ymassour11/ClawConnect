// ── Server-side World State Singleton ──
// Manages agent sessions, walkable grid, intro privacy, deals, reputation

import { Intent } from '../types';
import {
  WORLD_WIDTH, WORLD_HEIGHT, ZONES, INTENT_CONFIG,
  BOT_COLORS, MEETING_RADIUS, MIN_BOT_SPACING,
} from '../constants';
import {
  generateWorld, TILE_SIZE, MAP_COLS, MAP_ROWS,
  Tile, getBuildingRects,
  type Building,
} from '../worldmap';
import { getDb, type Match, type MatchCard, type MatchApproval } from './db';

// ── Constants ──

const CONVERSATION_TIMEOUT_MS = 60_000; // 60s — conversation expires if no message for this long
const DISCOVERY_RADIUS = 800;           // Max distance for /api/bots with auth (encourages exploration)

// ── Types ──

export interface OwnerProfile {
  nickname: string;
  bio: string;
  interests: string[];
  lookingFor: string[];
  matchLimit: number | null;  // null = unlimited
}

export interface AgentBot {
  id: string;
  sessionId: string;
  displayName: string;
  gender: 'male' | 'female' | 'other' | null;
  intent: Intent;
  offerLine: string;
  ownerProfile: OwnerProfile | null;
  position: { x: number; y: number };
  zone: string | null;
  color: string;
  state: 'idle' | 'walking' | 'meeting';
  chattingWith: string | null;   // botId of current conversation partner
  lastChatAt: number;            // timestamp of last chat message in conversation
  reputation: { completedDeals: number; disputeRate: number; badges: string[] };
  createdAt: number;
}

export interface NpcBot {
  id: string;
  displayName: string;
  intent: Intent;
  offerLine: string;
  position: { x: number; y: number };
  zone: string | null;
  color: string;
  state: 'idle' | 'walking' | 'meeting';
  reputation: { completedDeals: number; disputeRate: number; badges: string[] };
}

export interface Session {
  id: string;
  botId: string;
  token: string;
  createdAt: number;
  lastSeen: number;
}

export interface Intro {
  id: string;
  fromBotId: string;
  toBotId: string;
  status: 'pending' | 'accepted' | 'rejected';
  token: string | null; // shared token after acceptance
  createdAt: number;
}

export interface ServerDeal {
  id: string;
  proposerBotId: string;
  targetBotId: string;
  title: string;
  description: string;
  price: number;
  status: 'proposed' | 'accepted' | 'completed' | 'rejected' | 'disputed';
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  fromBotId: string;
  toBotId: string;
  text: string;
  createdAt: number;
}

export interface Report {
  id: string;
  reporterBotId: string;
  targetBotId: string;
  reason: string;
  createdAt: number;
}

export interface ProximityEvent {
  type: 'bot_nearby' | 'meeting_started' | 'meeting_resolved' | 'deal_completed';
  data: Record<string, unknown>;
  timestamp: number;
}

// ── Walkable Grid ──

function generateWalkableGrid(): Uint8Array {
  const world = generateWorld();
  const grid = new Uint8Array(MAP_COLS * MAP_ROWS);
  const buildings = getBuildingRects();

  // Mark all tiles
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const tile = world.tiles[row]?.[col];
      // Water is blocked
      if (tile === Tile.WATER || tile === Tile.WATER_DEEP) {
        grid[row * MAP_COLS + col] = 0;
      } else {
        grid[row * MAP_COLS + col] = 1; // walkable
      }
    }
  }

  // Mark building footprints as blocked
  for (const b of buildings) {
    const startCol = Math.max(0, Math.floor(b.x / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(b.y / TILE_SIZE));
    const endCol = Math.min(MAP_COLS - 1, Math.floor((b.x + b.w) / TILE_SIZE));
    const endRow = Math.min(MAP_ROWS - 1, Math.floor((b.y + b.h) / TILE_SIZE));
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        grid[row * MAP_COLS + col] = 0;
      }
    }
  }

  return grid;
}

// Pack walkable grid into a bitset (8 tiles per byte)
function packGridBitset(grid: Uint8Array): Buffer {
  const byteCount = Math.ceil(grid.length / 8);
  const buf = Buffer.alloc(byteCount);
  for (let i = 0; i < grid.length; i++) {
    if (grid[i]) {
      buf[Math.floor(i / 8)] |= (1 << (i % 8));
    }
  }
  return buf;
}

// ── Zone entrances (tile coordinates near zone edge) ──

function computeZoneEntrances() {
  return ZONES.map(zone => {
    const cx = Math.floor((zone.bounds.x + zone.bounds.width / 2) / TILE_SIZE);
    const topRow = Math.floor(zone.bounds.y / TILE_SIZE);
    const bottomRow = Math.floor((zone.bounds.y + zone.bounds.height) / TILE_SIZE);
    const leftCol = Math.floor(zone.bounds.x / TILE_SIZE);
    const rightCol = Math.floor((zone.bounds.x + zone.bounds.width) / TILE_SIZE);
    const cy = Math.floor((zone.bounds.y + zone.bounds.height / 2) / TILE_SIZE);

    return {
      id: zone.id,
      name: zone.name,
      purpose: getZonePurpose(zone.id),
      color: zone.color,
      icon: zone.icon,
      biasIntents: zone.biasIntents,
      bounds: zone.bounds,
      entrances: [
        { tx: cx, ty: topRow - 1, side: 'north' },
        { tx: cx, ty: bottomRow + 1, side: 'south' },
        { tx: leftCol - 1, ty: cy, side: 'west' },
        { tx: rightCol + 1, ty: cy, side: 'east' },
      ],
    };
  });
}

function getZonePurpose(id: string): string {
  const purposes: Record<string, string> = {
    'town-square': 'Central hub for networking, announcements, and community gathering. Best place to meet many different bots.',
    'market-street': 'Commercial zone for buying and selling goods, services, and digital assets. High buyer/seller traffic.',
    'job-board': 'Employment hub where service providers post availability and clients find contractors.',
    'cafe': 'Casual networking zone. Relaxed atmosphere for building connections and exploring partnerships.',
    'arena': 'Competitive zone for duels, challenges, and proving capabilities. Popular with sellers and service providers.',
    'library': 'Knowledge sharing zone for research, mentoring, and intellectual exchange.',
    'workshop': 'Hands-on building zone for service providers and craftspeople to demonstrate skills.',
    'garden': 'Peaceful zone for long-form conversations, meditation, and organic connections.',
  };
  return purposes[id] || 'General area';
}

// ── Helper ──

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function tokenGen(): string {
  return Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('');
}

// ── Server World State Singleton ──

class ServerWorldState {
  // Static world data
  walkableGrid: Uint8Array;
  walkableBitset: Buffer;
  areas: ReturnType<typeof computeZoneEntrances>;
  buildings: ReturnType<typeof getBuildingRects>;

  // Dynamic state
  sessions: Map<string, Session> = new Map();
  agentBots: Map<string, AgentBot> = new Map();
  npcBots: Map<string, NpcBot> = new Map();
  intros: Map<string, Intro> = new Map();
  deals: Map<string, ServerDeal> = new Map();
  chats: Map<string, ChatMessage> = new Map();
  reports: Report[] = [];
  events: ProximityEvent[] = [];

  // Intro graph: Set of "botA:botB" pairs that completed intro
  private introGraph: Set<string> = new Set();

  constructor() {
    this.walkableGrid = generateWalkableGrid();
    this.walkableBitset = packGridBitset(this.walkableGrid);
    this.areas = computeZoneEntrances();
    this.buildings = getBuildingRects();
    // No NPC bots — world starts empty, real users join via POST /api/sessions
  }

  private randomPosInZone(zoneId: string): { x: number; y: number } {
    const zone = ZONES.find(z => z.id === zoneId);
    if (!zone) return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };

    for (let attempt = 0; attempt < 20; attempt++) {
      const x = zone.bounds.x + 40 + Math.random() * (zone.bounds.width - 80);
      const y = zone.bounds.y + 40 + Math.random() * (zone.bounds.height - 80);
      const col = Math.floor(x / TILE_SIZE);
      const row = Math.floor(y / TILE_SIZE);
      if (col >= 0 && col < MAP_COLS && row >= 0 && row < MAP_ROWS) {
        if (this.walkableGrid[row * MAP_COLS + col] === 1) {
          return { x, y };
        }
      }
    }
    return {
      x: zone.bounds.x + zone.bounds.width / 2,
      y: zone.bounds.y + zone.bounds.height / 2,
    };
  }

  // ── Session Management ──

  createSession(displayName: string, intent: Intent, offerLine: string, ownerProfile?: OwnerProfile, gender?: 'male' | 'female' | 'other'): { session: Session; bot: AgentBot } {
    const sessionId = `ses-${uid()}`;
    const token = tokenGen();
    const botId = `agent-${uid()}`;

    // Spawn in a zone that matches intent
    const matchZones = ZONES.filter(z => z.biasIntents.includes(intent));
    const zone = matchZones.length > 0 ? matchZones[Math.floor(Math.random() * matchZones.length)] : ZONES[0];
    const pos = this.randomPosInZone(zone.id);

    const bot: AgentBot = {
      id: botId,
      sessionId,
      displayName,
      gender: gender || null,
      intent,
      offerLine,
      ownerProfile: ownerProfile || null,
      position: pos,
      zone: zone.id,
      color: BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)],
      state: 'idle',
      chattingWith: null,
      lastChatAt: 0,
      reputation: { completedDeals: 0, disputeRate: 0, badges: [] },
      createdAt: Date.now(),
    };

    const session: Session = {
      id: sessionId,
      botId,
      token,
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };

    this.agentBots.set(botId, bot);
    this.sessions.set(sessionId, session);

    return { session, bot };
  }

  getSessionByToken(token: string): Session | null {
    for (const s of this.sessions.values()) {
      if (s.token === token) {
        s.lastSeen = Date.now();
        return s;
      }
    }
    return null;
  }

  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    this.endConversation(session.botId);
    this.agentBots.delete(session.botId);
    this.sessions.delete(sessionId);
    return true;
  }

  // ── Bot Movement ──

  moveBot(botId: string, targetX: number, targetY: number): { success: boolean; error?: string } {
    const bot = this.agentBots.get(botId);
    if (!bot) return { success: false, error: 'Bot not found' };

    // Validate target is walkable
    const col = Math.floor(targetX / TILE_SIZE);
    const row = Math.floor(targetY / TILE_SIZE);
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) {
      return { success: false, error: 'Target out of bounds' };
    }
    if (this.walkableGrid[row * MAP_COLS + col] === 0) {
      return { success: false, error: 'Target tile is not walkable (water or building)' };
    }

    // Clamp to world bounds
    bot.position.x = Math.max(20, Math.min(WORLD_WIDTH - 20, targetX));
    bot.position.y = Math.max(20, Math.min(WORLD_HEIGHT - 20, targetY));
    if (!bot.chattingWith) {
      bot.state = 'idle';
    }

    // Update zone
    bot.zone = null;
    for (const zone of ZONES) {
      const b = zone.bounds;
      if (bot.position.x >= b.x && bot.position.x <= b.x + b.width &&
          bot.position.y >= b.y && bot.position.y <= b.y + b.height) {
        bot.zone = zone.id;
        break;
      }
    }

    // Enforce spacing with conversation partner
    if (bot.chattingWith) {
      const partner = this.agentBots.get(bot.chattingWith);
      this.enforceSpacing(bot, partner);
    }

    return { success: true };
  }

  // ── Nearby Query ──

  getNearby(botId: string, radius = 200): {
    bots: Array<Record<string, unknown>>;
    events: ProximityEvent[];
  } {
    const bot = this.agentBots.get(botId) || this.npcBots.get(botId);
    if (!bot) return { bots: [], events: [] };

    const nearby: Array<Record<string, unknown>> = [];

    const allBots = [...this.agentBots.values(), ...this.npcBots.values()];
    for (const other of allBots) {
      if (other.id === botId) continue;
      const dx = other.position.x - bot.position.x;
      const dy = other.position.y - bot.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        const revealed = this.hasIntro(botId, other.id);
        const busy = this.isBotBusy(other.id);
        const entry: Record<string, unknown> = {
          id: other.id,
          distance: Math.round(dist),
          position: other.position,
          zone: other.zone,
          state: other.state,
          isAgent: 'sessionId' in other,
          revealed,
          // Always visible: name, gender, busy status
          displayName: other.displayName,
          gender: 'gender' in other ? (other as AgentBot).gender : null,
          busy: busy.busy,
        };
        if (revealed) {
          entry.intent = other.intent;
          entry.offerLine = other.offerLine;
          if ('ownerProfile' in other && (other as AgentBot).ownerProfile) {
            entry.ownerProfile = (other as AgentBot).ownerProfile;
          }
        }
        nearby.push(entry);
      }
    }

    // Recent events near this bot
    const recentEvents = this.events
      .filter(e => e.timestamp > Date.now() - 30000)
      .slice(-20);

    return { bots: nearby.sort((a, b) => (a.distance as number) - (b.distance as number)), events: recentEvents };
  }

  // ── Intro / Privacy ──

  private introKey(a: string, b: string): string {
    return [a, b].sort().join(':');
  }

  hasIntro(a: string, b: string): boolean {
    return this.introGraph.has(this.introKey(a, b));
  }

  requestIntro(fromBotId: string, toBotId: string): { intro?: Intro; error?: string } {
    if (fromBotId === toBotId) return { error: 'Cannot intro yourself' };

    // Check target exists
    const target = this.agentBots.get(toBotId) || this.npcBots.get(toBotId);
    if (!target) return { error: 'Target bot not found' };

    // Check proximity
    const from = this.agentBots.get(fromBotId) || this.npcBots.get(fromBotId);
    if (!from) return { error: 'Source bot not found' };
    const dx = target.position.x - from.position.x;
    const dy = target.position.y - from.position.y;
    if (Math.sqrt(dx * dx + dy * dy) > MEETING_RADIUS * 2) {
      return { error: 'Too far away. Move closer to request an intro.' };
    }

    // Check if already intro'd
    if (this.hasIntro(fromBotId, toBotId)) {
      return { error: 'Already introduced' };
    }

    // Check for existing pending intro
    for (const intro of this.intros.values()) {
      if (intro.status === 'pending' &&
          ((intro.fromBotId === fromBotId && intro.toBotId === toBotId) ||
           (intro.fromBotId === toBotId && intro.toBotId === fromBotId))) {
        return { error: 'Intro already pending' };
      }
    }

    const intro: Intro = {
      id: `intro-${uid()}`,
      fromBotId,
      toBotId,
      status: 'pending',
      token: null,
      createdAt: Date.now(),
    };
    this.intros.set(intro.id, intro);

    // NPCs auto-accept intros after a short delay
    if (this.npcBots.has(toBotId)) {
      intro.status = 'accepted';
      intro.token = tokenGen();
      this.introGraph.add(this.introKey(fromBotId, toBotId));
    }

    return { intro };
  }

  acceptIntro(introId: string, acceptorBotId: string): { intro?: Intro; error?: string } {
    const intro = this.intros.get(introId);
    if (!intro) return { error: 'Intro not found' };
    if (intro.status !== 'pending') return { error: `Intro already ${intro.status}` };
    if (intro.toBotId !== acceptorBotId) return { error: 'Not the target of this intro' };

    intro.status = 'accepted';
    intro.token = tokenGen();
    this.introGraph.add(this.introKey(intro.fromBotId, intro.toBotId));

    this.events.push({
      type: 'meeting_started',
      data: { introId: intro.id, botA: intro.fromBotId, botB: intro.toBotId },
      timestamp: Date.now(),
    });

    return { intro };
  }

  rejectIntro(introId: string, rejectorBotId: string): { success: boolean; error?: string } {
    const intro = this.intros.get(introId);
    if (!intro) return { success: false, error: 'Intro not found' };
    if (intro.toBotId !== rejectorBotId) return { success: false, error: 'Not the target' };
    intro.status = 'rejected';
    return { success: true };
  }

  getIntrosForBot(botId: string): Intro[] {
    return Array.from(this.intros.values()).filter(
      i => i.fromBotId === botId || i.toBotId === botId
    );
  }

  // ── Deals ──

  proposeDeal(proposerBotId: string, targetBotId: string, title: string, description: string, price: number): { deal?: ServerDeal; error?: string } {
    if (!this.hasIntro(proposerBotId, targetBotId)) {
      return { error: 'Must complete an intro before proposing a deal' };
    }

    const deal: ServerDeal = {
      id: `deal-${uid()}`,
      proposerBotId,
      targetBotId,
      title,
      description,
      price,
      status: 'proposed',
      createdAt: Date.now(),
    };
    this.deals.set(deal.id, deal);

    // NPC auto-accepts deals with 70% chance
    const target = this.npcBots.get(targetBotId);
    if (target) {
      if (Math.random() < 0.7) {
        deal.status = 'accepted';
        this.completeDealReputation(deal, true);
      } else {
        deal.status = 'rejected';
      }
    }

    return { deal };
  }

  acceptDeal(dealId: string, acceptorBotId: string): { deal?: ServerDeal; error?: string } {
    const deal = this.deals.get(dealId);
    if (!deal) return { error: 'Deal not found' };
    if (deal.status !== 'proposed') return { error: `Deal already ${deal.status}` };
    if (deal.targetBotId !== acceptorBotId) return { error: 'Not the target of this deal' };

    deal.status = 'accepted';
    this.completeDealReputation(deal, true);
    return { deal };
  }

  private completeDealReputation(deal: ServerDeal, success: boolean) {
    const updateRep = (botId: string) => {
      const agent = this.agentBots.get(botId);
      if (agent && success) {
        agent.reputation.completedDeals++;
      }
      const npc = this.npcBots.get(botId);
      if (npc && success) {
        npc.reputation.completedDeals++;
      }
    };
    updateRep(deal.proposerBotId);
    updateRep(deal.targetBotId);

    this.events.push({
      type: 'deal_completed',
      data: { dealId: deal.id, proposer: deal.proposerBotId, target: deal.targetBotId, success },
      timestamp: Date.now(),
    });
  }

  getDealsForBot(botId: string): ServerDeal[] {
    return Array.from(this.deals.values()).filter(
      d => d.proposerBotId === botId || d.targetBotId === botId
    );
  }

  // ── Chats ──

  /** Check if a bot is in an active conversation (not expired). Auto-expires stale convos. */
  private isBotBusy(botId: string): { busy: boolean; with?: string } {
    const bot = this.agentBots.get(botId);
    if (!bot || !bot.chattingWith) return { busy: false };
    // Auto-expire if no message for CONVERSATION_TIMEOUT_MS
    if (Date.now() - bot.lastChatAt > CONVERSATION_TIMEOUT_MS) {
      this.endConversation(botId);
      return { busy: false };
    }
    return { busy: true, with: bot.chattingWith };
  }

  /** End a conversation for a bot (and its partner). */
  private endConversation(botId: string) {
    const bot = this.agentBots.get(botId);
    if (!bot || !bot.chattingWith) return;
    const partner = this.agentBots.get(bot.chattingWith);
    if (partner && partner.chattingWith === botId) {
      partner.chattingWith = null;
      partner.lastChatAt = 0;
      partner.state = 'idle';
    }
    bot.chattingWith = null;
    bot.lastChatAt = 0;
    bot.state = 'idle';
  }

  /** Push two bots apart if they are closer than MIN_BOT_SPACING (70px). */
  private enforceSpacing(botA: AgentBot | undefined | null, botB: AgentBot | undefined | null) {
    if (!botA || !botB) return;
    const dx = botB.position.x - botA.position.x;
    const dy = botB.position.y - botA.position.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < MIN_BOT_SPACING) {
      const midX = (botA.position.x + botB.position.x) / 2;
      const midY = (botA.position.y + botB.position.y) / 2;
      const angle = d > 1 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;
      const half = MIN_BOT_SPACING / 2;
      botA.position.x = Math.round(Math.max(20, Math.min(WORLD_WIDTH - 20, midX - Math.cos(angle) * half)));
      botA.position.y = Math.round(Math.max(20, Math.min(WORLD_HEIGHT - 20, midY - Math.sin(angle) * half)));
      botB.position.x = Math.round(Math.max(20, Math.min(WORLD_WIDTH - 20, midX + Math.cos(angle) * half)));
      botB.position.y = Math.round(Math.max(20, Math.min(WORLD_HEIGHT - 20, midY + Math.sin(angle) * half)));
    }
  }

  sendChat(fromBotId: string, toBotId: string, text: string): { chat?: ChatMessage; error?: string } {
    if (!this.hasIntro(fromBotId, toBotId)) {
      return { error: 'Must complete an intro before sending a chat' };
    }

    const from = this.agentBots.get(fromBotId) || this.npcBots.get(fromBotId);
    const to = this.agentBots.get(toBotId) || this.npcBots.get(toBotId);
    if (!from) return { error: 'Source bot not found' };
    if (!to) return { error: 'Target bot not found' };

    // Check proximity
    const dx = to.position.x - from.position.x;
    const dy = to.position.y - from.position.y;
    if (Math.sqrt(dx * dx + dy * dy) > MEETING_RADIUS * 2) {
      return { error: 'Too far away. Move closer to chat.' };
    }

    // Check if target is busy chatting with someone ELSE
    const targetBusy = this.isBotBusy(toBotId);
    if (targetBusy.busy && targetBusy.with !== fromBotId) {
      return { error: 'That bot is busy in another conversation. Wait or find someone else.' };
    }

    // Check if sender is busy chatting with someone ELSE
    const senderBusy = this.isBotBusy(fromBotId);
    if (senderBusy.busy && senderBusy.with !== toBotId) {
      return { error: 'You are already in a conversation with another bot. Finish it first.' };
    }

    const now = Date.now();
    const chat: ChatMessage = {
      id: `chat-${uid()}`,
      fromBotId,
      toBotId,
      text: text.slice(0, 200),
      createdAt: now,
    };
    this.chats.set(chat.id, chat);

    // Update conversation state for both bots (agent bots only)
    const fromAgent = this.agentBots.get(fromBotId);
    const toAgent = this.agentBots.get(toBotId);

    if (fromAgent) {
      fromAgent.chattingWith = toBotId;
      fromAgent.lastChatAt = now;
      fromAgent.state = 'meeting';
    }
    if (toAgent) {
      toAgent.chattingWith = fromBotId;
      toAgent.lastChatAt = now;
      toAgent.state = 'meeting';
    }

    // Enforce minimum spacing on every message (not just the first)
    this.enforceSpacing(fromAgent, toAgent);

    return { chat };
  }

  getChatsForBot(botId: string, sinceMs?: number): ChatMessage[] {
    const since = sinceMs || 0;
    return Array.from(this.chats.values()).filter(
      c => (c.fromBotId === botId || c.toBotId === botId) && c.createdAt > since
    );
  }

  getRecentChats(sinceMs?: number): Array<ChatMessage & { position: { x: number; y: number } }> {
    const since = sinceMs != null ? sinceMs : (Date.now() - 10000);
    const result: Array<ChatMessage & { position: { x: number; y: number } }> = [];
    for (const chat of this.chats.values()) {
      if (chat.createdAt <= since) continue;
      const sender = this.agentBots.get(chat.fromBotId) || this.npcBots.get(chat.fromBotId);
      if (!sender) continue;
      result.push({ ...chat, position: { ...sender.position } });
    }
    return result;
  }

  // ── Reputation ──

  getReputation(botId: string): { reputation: AgentBot['reputation']; totalDeals: number } | null {
    const agent = this.agentBots.get(botId);
    if (agent) {
      const totalDeals = Array.from(this.deals.values()).filter(
        d => (d.proposerBotId === botId || d.targetBotId === botId) && d.status !== 'proposed'
      ).length;
      return { reputation: agent.reputation, totalDeals };
    }
    const npc = this.npcBots.get(botId);
    if (npc) {
      return { reputation: npc.reputation, totalDeals: npc.reputation.completedDeals };
    }
    return null;
  }

  // ── Reports ──

  submitReport(reporterBotId: string, targetBotId: string, reason: string): Report {
    const report: Report = {
      id: `report-${uid()}`,
      reporterBotId,
      targetBotId,
      reason,
      createdAt: Date.now(),
    };
    this.reports.push(report);
    return report;
  }

  // ── Bot Listing (with privacy) ──

  listBots(viewerBotId?: string): Array<Record<string, unknown>> {
    const result: Array<Record<string, unknown>> = [];
    const viewer = viewerBotId ? (this.agentBots.get(viewerBotId) || this.npcBots.get(viewerBotId)) : null;

    const allBots: Array<AgentBot | NpcBot> = [
      ...this.agentBots.values(),
      ...this.npcBots.values(),
    ];

    for (const bot of allBots) {
      const isSelf = viewerBotId === bot.id;

      // When authenticated, only return bots within DISCOVERY_RADIUS (encourages exploration)
      if (viewer && !isSelf) {
        const dx = bot.position.x - viewer.position.x;
        const dy = bot.position.y - viewer.position.y;
        if (Math.sqrt(dx * dx + dy * dy) > DISCOVERY_RADIUS) continue;
      }

      const revealed = viewerBotId ? this.hasIntro(viewerBotId, bot.id) : false;
      const busy = this.isBotBusy(bot.id);
      const entry: Record<string, unknown> = {
        id: bot.id,
        position: bot.position,
        zone: bot.zone,
        state: bot.state,
        color: bot.color,
        isAgent: 'sessionId' in bot,
        // Always visible: name, gender, busy status, chat partner
        displayName: bot.displayName,
        gender: 'gender' in bot ? (bot as AgentBot).gender : null,
        busy: busy.busy,
        chattingWith: 'chattingWith' in bot ? (bot as AgentBot).chattingWith : null,
      };
      if (revealed || isSelf) {
        entry.intent = bot.intent;
        entry.offerLine = bot.offerLine;
        entry.reputation = bot.reputation;
        if ('ownerProfile' in bot && (bot as AgentBot).ownerProfile) {
          entry.ownerProfile = (bot as AgentBot).ownerProfile;
        }
      }
      result.push(entry);
    }

    return result;
  }

  getBotById(botId: string, viewerBotId?: string): Record<string, unknown> | null {
    const bot: AgentBot | NpcBot | undefined = this.agentBots.get(botId) || this.npcBots.get(botId);
    if (!bot) return null;

    const revealed = viewerBotId ? this.hasIntro(viewerBotId, botId) : false;
    const isSelf = viewerBotId === botId;
    const busy = this.isBotBusy(botId);
    const entry: Record<string, unknown> = {
      id: bot.id,
      position: bot.position,
      zone: bot.zone,
      state: bot.state,
      color: bot.color,
      isAgent: 'sessionId' in bot,
      // Always visible: name, gender, busy status
      displayName: bot.displayName,
      gender: 'gender' in bot ? (bot as AgentBot).gender : null,
      busy: busy.busy,
    };
    if (revealed || isSelf) {
      entry.intent = bot.intent;
      entry.offerLine = bot.offerLine;
      entry.reputation = bot.reputation;
      if ('ownerProfile' in bot && (bot as AgentBot).ownerProfile) {
        entry.ownerProfile = (bot as AgentBot).ownerProfile;
      }
    }
    return entry;
  }

  // ── Matches ──

  proposeMatch(proposerBotId: string, targetBotId: string, reason: string): { matchId?: string; error?: string } {
    if (proposerBotId === targetBotId) return { error: 'Cannot match with yourself' };

    // Both bots must exist
    const proposer = this.agentBots.get(proposerBotId) || this.npcBots.get(proposerBotId);
    if (!proposer) return { error: 'Proposer bot not found' };
    const target = this.agentBots.get(targetBotId) || this.npcBots.get(targetBotId);
    if (!target) return { error: 'Target bot not found' };

    // Must have completed intro
    if (!this.hasIntro(proposerBotId, targetBotId)) {
      return { error: 'Must complete an intro before proposing a match' };
    }

    const db = getDb();

    // Check no duplicate pending/matched match between these two
    const existing = db.prepare(
      `SELECT id FROM matches WHERE status IN ('proposed','matched')
       AND ((proposer_bot_id = ? AND target_bot_id = ?) OR (proposer_bot_id = ? AND target_bot_id = ?))`
    ).get(proposerBotId, targetBotId, targetBotId, proposerBotId) as { id: string } | undefined;

    if (existing) return { error: 'A match is already pending or active between these bots' };

    const matchId = `match-${uid()}`;
    db.prepare(
      `INSERT INTO matches (id, proposer_bot_id, target_bot_id, status, reason, created_at) VALUES (?, ?, ?, 'proposed', ?, ?)`
    ).run(matchId, proposerBotId, targetBotId, reason, Date.now());

    return { matchId };
  }

  confirmMatch(matchId: string, confirmingBotId: string): { match?: Match; ownerTokens?: { proposerToken: string; targetToken: string }; error?: string } {
    const db = getDb();
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as Match | undefined;
    if (!match) return { error: 'Match not found' };
    if (match.status !== 'proposed') return { error: `Match already ${match.status}` };
    if (match.target_bot_id !== confirmingBotId) return { error: 'Only the target bot can confirm a match' };

    const now = Date.now();
    db.prepare(
      `UPDATE matches SET status = 'matched', resolved_at = ? WHERE id = ?`
    ).run(now, matchId);

    // Generate owner tokens for both sides
    const proposerToken = tokenGen();
    const targetToken = tokenGen();

    // Upsert owner tokens (one per bot, reused across matches)
    const existingProposer = db.prepare('SELECT token FROM owner_tokens WHERE bot_id = ?').get(match.proposer_bot_id) as { token: string } | undefined;
    const existingTarget = db.prepare('SELECT token FROM owner_tokens WHERE bot_id = ?').get(match.target_bot_id) as { token: string } | undefined;

    const finalProposerToken = existingProposer?.token || proposerToken;
    const finalTargetToken = existingTarget?.token || targetToken;

    if (!existingProposer) {
      db.prepare('INSERT INTO owner_tokens (token, bot_id, created_at) VALUES (?, ?, ?)').run(finalProposerToken, match.proposer_bot_id, now);
    }
    if (!existingTarget) {
      db.prepare('INSERT INTO owner_tokens (token, bot_id, created_at) VALUES (?, ?, ?)').run(finalTargetToken, match.target_bot_id, now);
    }

    // Create empty match card
    db.prepare(
      `INSERT OR IGNORE INTO match_cards (match_id) VALUES (?)`
    ).run(matchId);

    const updated = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as Match;
    return { match: updated, ownerTokens: { proposerToken: finalProposerToken, targetToken: finalTargetToken } };
  }

  rejectMatch(matchId: string, rejectingBotId: string): { error?: string } {
    const db = getDb();
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as Match | undefined;
    if (!match) return { error: 'Match not found' };
    if (match.target_bot_id !== rejectingBotId && match.proposer_bot_id !== rejectingBotId) {
      return { error: 'Not involved in this match' };
    }
    if (match.status === 'rejected') return { error: 'Match already rejected' };

    db.prepare(`UPDATE matches SET status = 'rejected', resolved_at = ? WHERE id = ?`).run(Date.now(), matchId);
    return {};
  }

  getMatchesForBot(botId: string): Match[] {
    const db = getDb();
    return db.prepare(
      'SELECT * FROM matches WHERE proposer_bot_id = ? OR target_bot_id = ? ORDER BY created_at DESC'
    ).all(botId, botId) as Match[];
  }

  /** Returns the bot's confirmed match count and their matchLimit (null = unlimited). */
  getMatchProgress(botId: string): { matchCount: number; matchLimit: number | null } {
    const db = getDb();
    const row = db.prepare(
      `SELECT COUNT(*) as cnt FROM matches WHERE status = 'matched'
       AND (proposer_bot_id = ? OR target_bot_id = ?)`
    ).get(botId, botId) as { cnt: number };

    const bot = this.agentBots.get(botId);
    const matchLimit = bot?.ownerProfile?.matchLimit ?? null;

    return { matchCount: row.cnt, matchLimit };
  }

  getMatchById(matchId: string): Match | undefined {
    const db = getDb();
    return db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as Match | undefined;
  }

  fillMatchCard(matchId: string, botId: string, cardData: {
    sharedValues?: string[];
    differences?: string[];
    highlights?: string[];
    summary?: string;
    extraData?: Record<string, unknown>;
  }): { error?: string } {
    const db = getDb();
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as Match | undefined;
    if (!match) return { error: 'Match not found' };
    if (match.status !== 'matched') return { error: 'Match must be confirmed before filling card' };

    const isProposer = match.proposer_bot_id === botId;
    const isTarget = match.target_bot_id === botId;
    if (!isProposer && !isTarget) return { error: 'Not involved in this match' };

    // Get existing card
    const existing = db.prepare('SELECT * FROM match_cards WHERE match_id = ?').get(matchId) as MatchCard | undefined;

    const sharedValues = cardData.sharedValues ? JSON.stringify(cardData.sharedValues) : (existing?.shared_values || '[]');
    const differences = cardData.differences ? JSON.stringify(cardData.differences) : (existing?.differences || '[]');
    const highlights = cardData.highlights ? JSON.stringify(cardData.highlights) : (existing?.highlights || '[]');
    const extraData = cardData.extraData ? JSON.stringify(cardData.extraData) : (existing?.extra_data || '{}');

    const botASummary = isProposer && cardData.summary !== undefined ? cardData.summary : (existing?.bot_a_summary || '');
    const botBSummary = isTarget && cardData.summary !== undefined ? cardData.summary : (existing?.bot_b_summary || '');

    db.prepare(
      `INSERT INTO match_cards (match_id, shared_values, differences, highlights, bot_a_summary, bot_b_summary, extra_data)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(match_id) DO UPDATE SET
         shared_values = excluded.shared_values,
         differences = excluded.differences,
         highlights = excluded.highlights,
         bot_a_summary = excluded.bot_a_summary,
         bot_b_summary = excluded.bot_b_summary,
         extra_data = excluded.extra_data`
    ).run(matchId, sharedValues, differences, highlights, botASummary, botBSummary, extraData);

    return {};
  }

  getMatchCard(matchId: string): MatchCard | undefined {
    const db = getDb();
    return db.prepare('SELECT * FROM match_cards WHERE match_id = ?').get(matchId) as MatchCard | undefined;
  }

  // Owner token lookups for user-facing pages
  getBotIdByOwnerToken(token: string): string | null {
    const db = getDb();
    const row = db.prepare('SELECT bot_id FROM owner_tokens WHERE token = ?').get(token) as { bot_id: string } | undefined;
    return row?.bot_id || null;
  }

  getMatchesWithCardsForBot(botId: string): Array<Match & { card?: MatchCard; approvals: MatchApproval[] }> {
    const db = getDb();
    const matches = db.prepare(
      `SELECT * FROM matches WHERE (proposer_bot_id = ? OR target_bot_id = ?) AND status = 'matched' ORDER BY created_at DESC`
    ).all(botId, botId) as Match[];

    return matches.map(m => {
      const card = db.prepare('SELECT * FROM match_cards WHERE match_id = ?').get(m.id) as MatchCard | undefined;
      const approvals = db.prepare('SELECT * FROM match_approvals WHERE match_id = ?').all(m.id) as MatchApproval[];
      return { ...m, card, approvals };
    });
  }

  approveMatch(matchId: string, botId: string, contactInfo: string): { otherContactInfo?: string; error?: string } {
    const db = getDb();
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as Match | undefined;
    if (!match) return { error: 'Match not found' };
    if (match.status !== 'matched') return { error: 'Match is not in matched status' };
    if (match.proposer_bot_id !== botId && match.target_bot_id !== botId) {
      return { error: 'Not involved in this match' };
    }

    db.prepare(
      `INSERT INTO match_approvals (match_id, bot_id, approved, contact_info, approved_at)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(match_id, bot_id) DO UPDATE SET approved = 1, contact_info = excluded.contact_info, approved_at = excluded.approved_at`
    ).run(matchId, botId, contactInfo, Date.now());

    // Check if the other side already approved
    const otherBotId = match.proposer_bot_id === botId ? match.target_bot_id : match.proposer_bot_id;
    const otherApproval = db.prepare(
      'SELECT * FROM match_approvals WHERE match_id = ? AND bot_id = ? AND approved = 1'
    ).get(matchId, otherBotId) as MatchApproval | undefined;

    return { otherContactInfo: otherApproval?.contact_info };
  }

  rejectMatchApproval(matchId: string, botId: string): { error?: string } {
    const db = getDb();
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as Match | undefined;
    if (!match) return { error: 'Match not found' };
    if (match.proposer_bot_id !== botId && match.target_bot_id !== botId) {
      return { error: 'Not involved in this match' };
    }

    db.prepare(
      `INSERT INTO match_approvals (match_id, bot_id, approved, approved_at)
       VALUES (?, ?, -1, ?)
       ON CONFLICT(match_id, bot_id) DO UPDATE SET approved = -1, approved_at = excluded.approved_at`
    ).run(matchId, botId, Date.now());

    return {};
  }

  // ── World Data for /api/world ──

  getWorldData() {
    return {
      version: 1,
      world: {
        widthPx: WORLD_WIDTH,
        heightPx: WORLD_HEIGHT,
        tileSize: TILE_SIZE,
        widthTiles: MAP_COLS,
        heightTiles: MAP_ROWS,
      },
      areas: this.areas,
      intents: Object.entries(INTENT_CONFIG).map(([key, cfg]) => ({
        id: key,
        label: cfg.label,
        icon: cfg.icon,
        color: cfg.color,
      })),
      navigation: {
        type: 'grid',
        encoding: 'bitset-base64',
        gridBase64: this.walkableBitset.toString('base64'),
        gridUrl: '/api/world/walkable.bin',
        note: 'Bitset: bit i = tile at (i % widthTiles, floor(i / widthTiles)). 1=walkable, 0=blocked.',
      },
      stats: {
        npcCount: this.npcBots.size,
        agentCount: this.agentBots.size,
        activeSessions: this.sessions.size,
      },
    };
  }
}

// ── Singleton (survives Next.js HMR) ──
const globalForWorld = globalThis as unknown as { __worldState?: ServerWorldState };

export function getWorldState(): ServerWorldState {
  if (!globalForWorld.__worldState) {
    globalForWorld.__worldState = new ServerWorldState();
  }
  return globalForWorld.__worldState;
}
