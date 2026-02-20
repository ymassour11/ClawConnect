import { Zone, Intent } from './types';

// ── World dimensions ──
export const WORLD_WIDTH = 6400;
export const WORLD_HEIGHT = 4800;

// ── Bot settings ──
export const BOT_COUNT = 0;
export const BOT_SPEED = 1.5;
export const BOT_RADIUS = 16;
export const MEETING_RADIUS = 60;
export const MEETING_DURATION_MIN = 3000;
export const MEETING_DURATION_MAX = 8000;
export const WANDER_INTERVAL_MIN = 2000;
export const WANDER_INTERVAL_MAX = 6000;
export const IDLE_DURATION_MIN = 1000;
export const IDLE_DURATION_MAX = 4000;
export const MIN_BOT_SPACING = 70;   // Minimum distance between chatting/meeting bots

// ── Zone definitions ──
export const ZONES: Zone[] = [
  {
    id: 'town-square',
    name: 'Town Square',
    bounds: { x: 2200, y: 1800, width: 1200, height: 900 },
    color: '#4ade80',
    icon: '\u{1F3DB}\u{FE0F}',
    biasIntents: ['network'],
  },
  {
    id: 'market-street',
    name: 'Market Street',
    bounds: { x: 400, y: 500, width: 1000, height: 700 },
    color: '#fb923c',
    icon: '\u{1F6D2}',
    biasIntents: ['buyer', 'seller'],
  },
  {
    id: 'job-board',
    name: 'Job Board',
    bounds: { x: 4800, y: 600, width: 1000, height: 700 },
    color: '#60a5fa',
    icon: '\u{1F4CB}',
    biasIntents: ['service'],
  },
  {
    id: 'cafe',
    name: 'Cafe',
    bounds: { x: 400, y: 3600, width: 900, height: 700 },
    color: '#c084fc',
    icon: '\u{2615}',
    biasIntents: ['network', 'buyer'],
  },
  {
    id: 'arena',
    name: 'Arena',
    bounds: { x: 4800, y: 3200, width: 1000, height: 800 },
    color: '#f472b6',
    icon: '\u{2694}\u{FE0F}',
    biasIntents: ['seller', 'service'],
  },
  {
    id: 'library',
    name: 'Library',
    bounds: { x: 2400, y: 350, width: 800, height: 550 },
    color: '#a78bfa',
    icon: '\u{1F4DA}',
    biasIntents: ['network', 'service'],
  },
  {
    id: 'workshop',
    name: 'Workshop',
    bounds: { x: 400, y: 2200, width: 800, height: 700 },
    color: '#f59e0b',
    icon: '\u{1F528}',
    biasIntents: ['service', 'seller'],
  },
  {
    id: 'garden',
    name: 'Garden',
    bounds: { x: 2400, y: 3900, width: 1000, height: 600 },
    color: '#34d399',
    icon: '\u{1F33F}',
    biasIntents: ['buyer', 'network'],
  },
];

// ── Intent config ──
export const INTENT_CONFIG: Record<Intent, { icon: string; label: string; color: string }> = {
  buyer: { icon: '\u{1F4B0}', label: 'Buyer', color: '#22c55e' },
  seller: { icon: '\u{1F3F7}\u{FE0F}', label: 'Seller', color: '#f97316' },
  service: { icon: '\u{1F527}', label: 'Service', color: '#3b82f6' },
  network: { icon: '\u{1F91D}', label: 'Network', color: '#a855f7' },
};

// ── Bot names pool ──
export const BOT_NAMES = [
  'Axiom', 'Bolt', 'Cipher', 'Delta', 'Echo', 'Flux', 'Grit', 'Hex',
  'Ion', 'Jade', 'Kilo', 'Lux', 'Maven', 'Neon', 'Orion', 'Pixel',
  'Quasar', 'Rune', 'Spark', 'Titan', 'Unity', 'Vex', 'Warp', 'Xenon',
  'Yotta', 'Zen', 'Alpha', 'Bravo', 'Nova', 'Rift', 'Surge', 'Trace',
  'Vibe', 'Wren', 'Zephyr', 'Blitz', 'Coda', 'Drift', 'Ember', 'Fuse',
  'Glitch', 'Haze', 'Iris', 'Jet', 'Karma', 'Lynx', 'Mist', 'Nimbus',
  'Opal', 'Prism', 'Arc', 'Byte', 'Comet', 'Dusk', 'Flint', 'Glow',
  'Haven', 'Ivory', 'Jolt', 'Knox', 'Luna', 'Myth', 'Nexus', 'Onyx',
  'Pulse', 'Quest', 'Reed', 'Slate', 'Thorn', 'Umbra', 'Vale', 'Wisp',
  'Xeno', 'Yarrow', 'Zinc', 'Aero', 'Blink', 'Crux', 'Dune', 'Elan',
];

// ── Offer lines ──
export const OFFER_LINES: Record<Intent, string[]> = {
  buyer: [
    'Looking for AI templates',
    'Need a landing page',
    'Buying automation scripts',
    'Want custom chatbot',
    'Seeking design assets',
  ],
  seller: [
    'Selling prompt packs',
    'Premium UI kits here',
    'API integrations ready',
    'Custom bots for sale',
    'Templates from $5',
  ],
  service: [
    'Will build your MVP',
    'Full-stack dev available',
    'AI tuning specialist',
    'Brand design services',
    'Data pipeline expert',
  ],
  network: [
    'Let\'s collaborate!',
    'Open to partnerships',
    'Looking for co-founders',
    'Seeking mentors',
    'Community builder',
  ],
};

// ── Bot colors (pastel palette) ──
export const BOT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471', '#82E0AA', '#F1948A', '#AED6F1', '#D7BDE2',
  '#A3E4D7', '#FAD7A0', '#A9CCE3', '#D5F5E3', '#FADBD8',
];
