import { Bot, Meeting, Position, Intent, Zone, BotState } from './types';
import { apiUrl } from './api';
import {
  WORLD_WIDTH, WORLD_HEIGHT, BOT_COUNT, BOT_SPEED, MEETING_RADIUS,
  MEETING_DURATION_MIN, MEETING_DURATION_MAX, WANDER_INTERVAL_MIN,
  WANDER_INTERVAL_MAX, IDLE_DURATION_MIN, IDLE_DURATION_MAX,
  ZONES, BOT_NAMES, OFFER_LINES, BOT_COLORS, INTENT_CONFIG,
  MIN_BOT_SPACING,
} from './constants';
import { getBuildingRects, type BuildingRect } from './worldmap';

// ── Building collision rects (loaded once) ──
let buildingRects: BuildingRect[] | null = null;
function getBuildings(): BuildingRect[] {
  if (!buildingRects) buildingRects = getBuildingRects();
  return buildingRects;
}

function isInsideBuilding(pos: Position): boolean {
  for (const b of getBuildings()) {
    if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) {
      return true;
    }
  }
  return false;
}

// ── Helpers ──
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function dist(a: Position, b: Position) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Get preferred zone for an intent ──
function getPreferredZone(intent: Intent): Zone {
  const matching = ZONES.filter(z => z.biasIntents.includes(intent));
  return pick(matching.length > 0 ? matching : ZONES);
}

// ── Generate a position within a zone (avoiding buildings) ──
function posInZone(zone: Zone): Position {
  for (let attempt = 0; attempt < 20; attempt++) {
    const pos = {
      x: zone.bounds.x + rand(40, zone.bounds.width - 40),
      y: zone.bounds.y + rand(40, zone.bounds.height - 40),
    };
    if (!isInsideBuilding(pos)) return pos;
  }
  // Fallback: return position anyway
  return {
    x: zone.bounds.x + rand(40, zone.bounds.width - 40),
    y: zone.bounds.y + rand(40, zone.bounds.height - 40),
  };
}

// ── Generate a random world position (avoiding buildings) ──
function randomWorldPos(): Position {
  for (let attempt = 0; attempt < 20; attempt++) {
    const pos = { x: rand(100, WORLD_WIDTH - 100), y: rand(100, WORLD_HEIGHT - 100) };
    if (!isInsideBuilding(pos)) return pos;
  }
  return { x: rand(100, WORLD_WIDTH - 100), y: rand(100, WORLD_HEIGHT - 100) };
}

// ── Create a bot ──
function createBot(index: number): Bot {
  const intents: Intent[] = ['buyer', 'seller', 'service', 'network'];
  const intent = intents[index % intents.length];
  const zone = getPreferredZone(intent);
  const pos = posInZone(zone);

  return {
    id: `bot-${uid()}`,
    displayName: BOT_NAMES[index % BOT_NAMES.length],
    intent,
    offerLine: pick(OFFER_LINES[intent]),
    position: { ...pos },
    targetPosition: null,
    velocity: { x: 0, y: 0 },
    zone: zone.id,
    reputation: {
      completedDeals: randInt(0, 50),
      disputeRate: Math.random() * 0.15,
      badges: Math.random() > 0.6 ? ['Trusted Trader'] : [],
    },
    state: 'idle',
    meetingId: null,
    color: BOT_COLORS[index % BOT_COLORS.length],
    idleTimer: rand(IDLE_DURATION_MIN, IDLE_DURATION_MAX),
    wanderTimer: rand(WANDER_INTERVAL_MIN, WANDER_INTERVAL_MAX),
  };
}

// ── Simulation class ──
export class WorldSimulation {
  bots: Map<string, Bot> = new Map();
  meetings: Map<string, Meeting> = new Map();
  meetingLog: Meeting[] = [];
  tick = 0;
  private lastTime = 0;

  constructor() {
    this.init();
  }

  init() {
    for (let i = 0; i < BOT_COUNT; i++) {
      const bot = createBot(i);
      // Ensure bot doesn't spawn inside a building
      if (isInsideBuilding(bot.position)) {
        const zone = ZONES.find(z => z.biasIntents.includes(bot.intent)) || ZONES[0];
        bot.position = posInZone(zone);
      }
      this.bots.set(bot.id, bot);
    }
  }

  update(timestamp: number) {
    if (this.lastTime === 0) this.lastTime = timestamp;
    const dt = Math.min(timestamp - this.lastTime, 50); // cap delta
    this.lastTime = timestamp;
    this.tick++;

    // Update each bot
    for (const bot of this.bots.values()) {
      if (bot.state === 'meeting') {
        this.updateMeetingBot(bot, dt);
      } else {
        this.updateMovingBot(bot, dt);
      }
    }

    // Update meetings
    this.updateMeetings(timestamp);

    // Try to create new meetings
    if (this.tick % 30 === 0) {
      this.tryCreateMeetings(timestamp);
    }
  }

  private updateMovingBot(bot: Bot, dt: number) {
    if (bot.state === 'emoting') {
      bot.idleTimer -= dt;
      if (bot.idleTimer <= 0) {
        bot.state = 'idle';
      }
      return;
    }

    // If idle, count down then pick a new target
    if (bot.state === 'idle') {
      bot.idleTimer -= dt;
      if (bot.idleTimer <= 0) {
        this.pickNewTarget(bot);
        bot.state = 'walking';
      }
      return;
    }

    // Walking toward target
    if (bot.targetPosition) {
      const d = dist(bot.position, bot.targetPosition);
      if (d < 5) {
        // Arrived
        bot.position = { ...bot.targetPosition };
        bot.targetPosition = null;
        bot.velocity = { x: 0, y: 0 };
        bot.state = 'idle';
        // API bots: don't wander, wait for next server sync
        bot.idleTimer = this.apiBotIds.has(bot.id) ? 999999 : rand(IDLE_DURATION_MIN, IDLE_DURATION_MAX);
        bot.zone = this.getZoneAt(bot.position)?.id ?? null;
      } else {
        // Move toward target
        const speed = BOT_SPEED * (dt / 16);
        let dx = bot.targetPosition.x - bot.position.x;
        let dy = bot.targetPosition.y - bot.position.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        bot.velocity.x = (dx / len) * speed;
        bot.velocity.y = (dy / len) * speed;

        const nextX = bot.position.x + bot.velocity.x;
        const nextY = bot.position.y + bot.velocity.y;

        // Check if next position would be inside a building
        if (isInsideBuilding({ x: nextX, y: nextY })) {
          // Steer around: try perpendicular directions
          const perpX1 = bot.position.x + (dy / len) * speed;
          const perpY1 = bot.position.y - (dx / len) * speed;
          const perpX2 = bot.position.x - (dy / len) * speed;
          const perpY2 = bot.position.y + (dx / len) * speed;

          if (!isInsideBuilding({ x: perpX1, y: perpY1 })) {
            bot.position.x = perpX1;
            bot.position.y = perpY1;
          } else if (!isInsideBuilding({ x: perpX2, y: perpY2 })) {
            bot.position.x = perpX2;
            bot.position.y = perpY2;
          }
          // else stay put this frame
        } else {
          bot.position.x = nextX;
          bot.position.y = nextY;
        }

        // Clamp
        bot.position.x = Math.max(20, Math.min(WORLD_WIDTH - 20, bot.position.x));
        bot.position.y = Math.max(20, Math.min(WORLD_HEIGHT - 20, bot.position.y));
      }
    } else {
      bot.state = 'idle';
      bot.idleTimer = rand(IDLE_DURATION_MIN, IDLE_DURATION_MAX);
    }
  }

  private pickNewTarget(bot: Bot) {
    // 70% chance to go to preferred zone, 20% wander in current zone, 10% random
    const roll = Math.random();
    if (roll < 0.7) {
      const zone = getPreferredZone(bot.intent);
      bot.targetPosition = posInZone(zone);
    } else if (roll < 0.9 && bot.zone) {
      const zone = ZONES.find(z => z.id === bot.zone);
      if (zone) {
        bot.targetPosition = posInZone(zone);
      } else {
        bot.targetPosition = randomWorldPos();
      }
    } else {
      bot.targetPosition = randomWorldPos();
    }
  }

  private updateMeetingBot(bot: Bot, _dt: number) {
    // Enforce minimum spacing with meeting partner
    if (!bot.meetingId) return;
    const meeting = this.meetings.get(bot.meetingId);
    if (!meeting) return;
    const partnerId = meeting.botAId === bot.id ? meeting.botBId : meeting.botAId;
    const partner = this.bots.get(partnerId);
    if (!partner) return;

    const d = dist(bot.position, partner.position);
    if (d < MIN_BOT_SPACING) {
      const midX = (bot.position.x + partner.position.x) / 2;
      const midY = (bot.position.y + partner.position.y) / 2;
      const angle = d > 1 ? Math.atan2(partner.position.y - bot.position.y, partner.position.x - bot.position.x) : Math.random() * Math.PI * 2;
      const half = MIN_BOT_SPACING / 2;
      bot.position.x = Math.max(20, Math.min(WORLD_WIDTH - 20, midX - Math.cos(angle) * half));
      bot.position.y = Math.max(20, Math.min(WORLD_HEIGHT - 20, midY - Math.sin(angle) * half));
      partner.position.x = Math.max(20, Math.min(WORLD_WIDTH - 20, midX + Math.cos(angle) * half));
      partner.position.y = Math.max(20, Math.min(WORLD_HEIGHT - 20, midY + Math.sin(angle) * half));
    }
  }

  private updateMeetings(timestamp: number) {
    for (const meeting of this.meetings.values()) {
      if (meeting.status === 'active') {
        if (timestamp - meeting.startTime > meeting.duration) {
          this.resolveMeeting(meeting);
        }
      }
    }
  }

  private resolveMeeting(meeting: Meeting) {
    const success = Math.random() > 0.3; // 70% success rate
    meeting.status = 'resolved';
    meeting.result = {
      success,
      reason: success ? 'Deal reached!' : 'No agreement',
    };

    const botA = this.bots.get(meeting.botAId);
    const botB = this.bots.get(meeting.botBId);

    if (botA) {
      botA.state = 'emoting';
      botA.meetingId = null;
      botA.idleTimer = 1500;
      if (success) botA.reputation.completedDeals++;
    }
    if (botB) {
      botB.state = 'emoting';
      botB.meetingId = null;
      botB.idleTimer = 1500;
      if (success) botB.reputation.completedDeals++;
    }

    this.meetingLog.push({ ...meeting });

    // Clean up after emote period
    setTimeout(() => {
      this.meetings.delete(meeting.id);
    }, 2000);
  }

  private tryCreateMeetings(timestamp: number) {
    const freeBots = Array.from(this.bots.values()).filter(
      b => b.state !== 'meeting' && b.state !== 'emoting'
    );

    for (let i = 0; i < freeBots.length; i++) {
      const botA = freeBots[i];
      if (botA.state === 'meeting') continue;

      for (let j = i + 1; j < freeBots.length; j++) {
        const botB = freeBots[j];
        if (botB.state === 'meeting') continue;

        const d = dist(botA.position, botB.position);
        if (d < MEETING_RADIUS && Math.random() < 0.02) {
          this.createMeeting(botA, botB, timestamp);
          break;
        }
      }
    }
  }

  private createMeeting(botA: Bot, botB: Bot, timestamp: number) {
    const meetingTypes: Meeting['type'][] = ['chat', 'deal', 'intro', 'duel'];
    const type = pick(meetingTypes);
    const duration = rand(MEETING_DURATION_MIN, MEETING_DURATION_MAX);

    const meeting: Meeting = {
      id: `meet-${uid()}`,
      botAId: botA.id,
      botBId: botB.id,
      type,
      status: 'active',
      result: null,
      startTime: timestamp,
      duration,
      position: {
        x: (botA.position.x + botB.position.x) / 2,
        y: (botA.position.y + botB.position.y) / 2,
      },
    };

    this.meetings.set(meeting.id, meeting);

    botA.state = 'meeting';
    botA.meetingId = meeting.id;
    botA.velocity = { x: 0, y: 0 };
    botA.targetPosition = null;

    botB.state = 'meeting';
    botB.meetingId = meeting.id;
    botB.velocity = { x: 0, y: 0 };
    botB.targetPosition = null;

    // Offset bots so they don't visually stack on top of each other
    const d = dist(botA.position, botB.position);
    if (d < MIN_BOT_SPACING) {
      const midX = (botA.position.x + botB.position.x) / 2;
      const midY = (botA.position.y + botB.position.y) / 2;
      const angle = d > 1
        ? Math.atan2(botB.position.y - botA.position.y, botB.position.x - botA.position.x)
        : Math.random() * Math.PI * 2;
      const half = MIN_BOT_SPACING / 2;
      botA.position.x = midX - Math.cos(angle) * half;
      botA.position.y = midY - Math.sin(angle) * half;
      botB.position.x = midX + Math.cos(angle) * half;
      botB.position.y = midY + Math.sin(angle) * half;
      // Update meeting midpoint
      meeting.position.x = midX;
      meeting.position.y = midY;
    }
  }

  getZoneAt(pos: Position): Zone | null {
    for (const zone of ZONES) {
      const b = zone.bounds;
      if (pos.x >= b.x && pos.x <= b.x + b.width && pos.y >= b.y && pos.y <= b.y + b.height) {
        return zone;
      }
    }
    return null;
  }

  // ── Sync bots from the server API ──
  // Fetches /api/bots and creates/updates/removes bots to match server state.
  // This bridges API-connected bots into the visual renderer.

  recentChats: Array<{
    id: string;
    fromBotId: string;
    toBotId: string;
    text: string;
    createdAt: number;
    position: { x: number; y: number };
  }> = [];
  // Full chat log — keeps all chats for the stream panel (capped at 500)
  chatLog: Array<{
    id: string;
    fromBotId: string;
    toBotId: string;
    text: string;
    createdAt: number;
    position: { x: number; y: number };
  }> = [];
  private chatLogIds: Set<string> = new Set();
  private lastChatSync = 0;

  private apiBotIds: Set<string> = new Set(); // Track which bots came from API
  private syntheticMeetingIds: Set<string> = new Set(); // Track meetings created from API state

  async syncFromAPI() {
    try {
      const r = await fetch(apiUrl('/api/bots'));
      if (!r.ok) return;
      const data = await r.json();
      const serverBots: Array<{
        id: string;
        position: { x: number; y: number };
        zone: string | null;
        state: string;
        color: string;
        isAgent: boolean;
        displayName: string;
        intent: string;
        offerLine: string;
        chattingWith: string | null;
      }> = data.bots;

      const serverIds = new Set(serverBots.map(b => b.id));

      // Add or update bots from server
      for (const sb of serverBots) {
        let bot = this.bots.get(sb.id);
        if (bot) {
          // Sync state from server FIRST (meeting takes priority over walking)
          if (sb.state === 'meeting') {
            bot.state = 'meeting';
            bot.velocity = { x: 0, y: 0 };
            bot.targetPosition = null;
            // Snap position directly — no walk animation during meeting
            bot.position.x = sb.position.x;
            bot.position.y = sb.position.y;
          } else if (sb.state === 'idle' && bot.state === 'meeting') {
            bot.state = 'idle';
            bot.meetingId = null;
          } else {
            // Not in meeting — smoothly walk to new position
            if (Math.abs(bot.position.x - sb.position.x) > 2 ||
                Math.abs(bot.position.y - sb.position.y) > 2) {
              bot.targetPosition = { x: sb.position.x, y: sb.position.y };
              bot.state = 'walking';
            }
          }
          bot.zone = sb.zone;
          bot.displayName = sb.displayName;
          bot.intent = sb.intent as Intent;
          bot.offerLine = sb.offerLine;
          bot.color = sb.color;
        } else {
          // New bot from API — create it, respecting server state
          const intent = (['buyer', 'seller', 'service', 'network'].includes(sb.intent)
            ? sb.intent : 'network') as Intent;
          const newBot: Bot = {
            id: sb.id,
            displayName: sb.displayName,
            intent,
            offerLine: sb.offerLine,
            position: { x: sb.position.x, y: sb.position.y },
            targetPosition: null,
            velocity: { x: 0, y: 0 },
            zone: sb.zone,
            reputation: { completedDeals: 0, disputeRate: 0, badges: [] },
            state: sb.state === 'meeting' ? 'meeting' : 'idle',
            meetingId: null,
            color: sb.color,
            idleTimer: 999999,  // Don't wander — server controls position
            wanderTimer: 999999,
          };
          this.bots.set(sb.id, newBot);
          this.apiBotIds.add(sb.id);
        }
      }

      // Remove bots that left the server
      for (const id of this.apiBotIds) {
        if (!serverIds.has(id)) {
          this.bots.delete(id);
          this.apiBotIds.delete(id);
        }
      }

      // Create/cleanup synthetic meetings from server chattingWith pairs
      this.syncSyntheticMeetings(serverBots);
    } catch {
      // Silently ignore fetch errors
    }
  }

  /** Create/update/cleanup synthetic Meeting objects based on server chattingWith pairs. */
  private syncSyntheticMeetings(serverBots: Array<{ id: string; state: string; chattingWith: string | null; position: { x: number; y: number } }>) {
    const serverBotMap = new Map(serverBots.map(sb => [sb.id, sb]));
    const activePairs = new Set<string>();

    // Find all active chat pairs and create synthetic meetings
    for (const sb of serverBots) {
      if (sb.state !== 'meeting' || !sb.chattingWith) continue;
      const pairKey = [sb.id, sb.chattingWith].sort().join(':');
      if (activePairs.has(pairKey)) continue;
      activePairs.add(pairKey);

      const botA = this.bots.get(sb.id);
      const botB = this.bots.get(sb.chattingWith);
      if (!botA || !botB) continue;

      // Check if meeting already exists for this pair
      const meetingId = `synth-${pairKey}`;
      if (this.meetings.has(meetingId)) {
        const meeting = this.meetings.get(meetingId)!;
        if (meeting.status === 'resolved') {
          // Old meeting still cleaning up — replace it with a fresh one
          this.meetings.delete(meetingId);
        } else {
          // Update meeting position to track current bot positions
          meeting.position.x = (botA.position.x + botB.position.x) / 2;
          meeting.position.y = (botA.position.y + botB.position.y) / 2;
          continue;
        }
      }

      // Create synthetic meeting
      const meeting: Meeting = {
        id: meetingId,
        botAId: botA.id,
        botBId: botB.id,
        type: 'chat',
        status: 'active',
        result: null,
        startTime: Date.now(),
        duration: 999999, // Server controls lifecycle
        position: {
          x: (botA.position.x + botB.position.x) / 2,
          y: (botA.position.y + botB.position.y) / 2,
        },
      };

      this.meetings.set(meetingId, meeting);
      this.syntheticMeetingIds.add(meetingId);
      botA.meetingId = meetingId;
      botB.meetingId = meetingId;
    }

    // Cleanup: resolve synthetic meetings whose bots are no longer chatting
    for (const meetingId of this.syntheticMeetingIds) {
      const meeting = this.meetings.get(meetingId);
      if (!meeting) { this.syntheticMeetingIds.delete(meetingId); continue; }

      const sbA = serverBotMap.get(meeting.botAId);
      const sbB = serverBotMap.get(meeting.botBId);
      const stillActive = sbA?.state === 'meeting' && sbB?.state === 'meeting'
        && sbA.chattingWith === meeting.botBId && sbB.chattingWith === meeting.botAId;

      if (!stillActive) {
        // Resolve with emote animation
        meeting.status = 'resolved';
        meeting.result = { success: true, reason: 'Conversation ended' };

        const botA = this.bots.get(meeting.botAId);
        const botB = this.bots.get(meeting.botBId);
        if (botA && botA.meetingId === meetingId) {
          botA.state = 'emoting';
          botA.meetingId = null;
          botA.idleTimer = 1500;
        }
        if (botB && botB.meetingId === meetingId) {
          botB.state = 'emoting';
          botB.meetingId = null;
          botB.idleTimer = 1500;
        }

        const capturedId = meetingId;
        setTimeout(() => { this.meetings.delete(capturedId); }, 2000);
        this.syntheticMeetingIds.delete(meetingId);
      }
    }
  }

  async syncChatsFromAPI() {
    try {
      // First sync: grab last 5 min of history. Subsequent: since last poll.
      const since = this.lastChatSync || (Date.now() - 300_000);
      const r = await fetch(apiUrl(`/api/chats/history?since=${since}`));
      if (!r.ok) return;
      const data = await r.json();
      this.lastChatSync = Date.now();

      const allChats: Array<{
        id: string; fromBotId: string; toBotId: string;
        text: string; createdAt: number; position: { x: number; y: number };
      }> = data.chats || [];

      // Add ALL fetched chats to the persistent chat log (no time cutoff)
      for (const chat of allChats) {
        if (!this.chatLogIds.has(chat.id)) {
          this.chatLogIds.add(chat.id);
          this.chatLog.push(chat);
        }
      }
      // Cap log at 500
      if (this.chatLog.length > 500) {
        const removed = this.chatLog.splice(0, this.chatLog.length - 500);
        for (const r of removed) this.chatLogIds.delete(r.id);
      }

      // Visual chat bubbles — keep only the last 10 seconds
      const cutoff = Date.now() - 10000;
      const recentNew = allChats.filter(c => c.createdAt > cutoff);
      const existingIds = new Set(this.recentChats.map(c => c.id));
      for (const chat of recentNew) {
        if (!existingIds.has(chat.id)) {
          this.recentChats.push(chat);
        }
      }
      this.recentChats = this.recentChats.filter(c => c.createdAt > cutoff);
    } catch {
      // Silently ignore fetch errors
    }
  }

  getBotArray(): Bot[] {
    return Array.from(this.bots.values());
  }

  getActiveMeetings(): Meeting[] {
    return Array.from(this.meetings.values());
  }

  getRecentMeetingLog(count = 10): Meeting[] {
    return this.meetingLog.slice(-count);
  }
}
