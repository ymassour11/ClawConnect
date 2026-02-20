// ── Shared types for Clawbot World ──

export type Intent = 'buyer' | 'seller' | 'service' | 'network';

export interface Position {
  x: number;
  y: number;
}

export interface Bot {
  id: string;
  displayName: string;
  intent: Intent;
  offerLine: string;
  position: Position;
  targetPosition: Position | null;
  velocity: { x: number; y: number };
  zone: string | null;
  reputation: ReputationStats;
  state: BotState;
  meetingId: string | null;
  color: string;
  idleTimer: number;
  wanderTimer: number;
}

export type BotState = 'idle' | 'walking' | 'meeting' | 'emoting';

export interface ReputationStats {
  completedDeals: number;
  disputeRate: number;
  badges: string[];
}

export interface Meeting {
  id: string;
  botAId: string;
  botBId: string;
  type: 'chat' | 'deal' | 'intro' | 'duel';
  status: 'requested' | 'active' | 'resolved';
  result: MeetingResult | null;
  startTime: number;
  duration: number;
  position: Position;
}

export interface MeetingResult {
  success: boolean;
  reason: string;
  dealId?: string;
}

export interface Zone {
  id: string;
  name: string;
  bounds: { x: number; y: number; width: number; height: number };
  color: string;
  icon: string;
  biasIntents: Intent[];
}

export interface Deal {
  id: string;
  sellerBotId: string;
  buyerBotId: string;
  title: string;
  deliverableType: string;
  price: number;
  status: 'draft' | 'offered' | 'countered' | 'accepted' | 'completed' | 'disputed';
}

export interface WorldState {
  bots: Map<string, Bot>;
  meetings: Map<string, Meeting>;
  zones: Zone[];
  tick: number;
}
