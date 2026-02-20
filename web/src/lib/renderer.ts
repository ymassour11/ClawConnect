import {
  Application, Container, Graphics, Sprite, Texture, Assets,
  Text, TextStyle, FederatedPointerEvent,
} from 'pixi.js';
import { Bot, Meeting } from './types';
import { WorldSimulation } from './simulation';
import { WORLD_WIDTH, WORLD_HEIGHT, ZONES, INTENT_CONFIG } from './constants';
import {
  generateWorld, TILE_SIZE, MAP_COLS, MAP_ROWS,
  Tile, Deco, TILE_COLORS,
  type Building, type DecoPlacement,
} from './worldmap';

// ── Tileset asset paths ──
const TILESET_BASE = '/tileset/';

const GROUND_TILES: Record<string, string> = {};
for (let i = 1; i <= 56; i++) {
  const num = String(i).padStart(2, '0');
  GROUND_TILES[`ground-${num}`] = `${TILESET_BASE}ground-${num}.png`;
}

const PROP_ASSETS: Record<string, string> = {
  'tree-large': `${TILESET_BASE}prop-tree-large.png`,
  'tree-medium': `${TILESET_BASE}prop-tree-medium.png`,
  'tree-small': `${TILESET_BASE}prop-tree-small.png`,
  'bushes-large': `${TILESET_BASE}prop-bushes-large.png`,
  'bushes-medium': `${TILESET_BASE}prop-bushes-medium.png`,
  'bushes-small': `${TILESET_BASE}prop-bushes-small.png`,
  'house': `${TILESET_BASE}prop-house.png`,
  'castle-round': `${TILESET_BASE}prop-castle-round.png`,
  'castle-square': `${TILESET_BASE}prop-castle-square.png`,
  'windmill': `${TILESET_BASE}prop-windmill.png`,
  'well': `${TILESET_BASE}prop-well.png`,
  'campfire': `${TILESET_BASE}prop-campfire.png`,
  'tent': `${TILESET_BASE}prop-tent.png`,
  'rock-01': `${TILESET_BASE}prop-rock-01.png`,
  'rock-02': `${TILESET_BASE}prop-rock-02.png`,
  'rock-03': `${TILESET_BASE}prop-rock-03.png`,
  'rock-04': `${TILESET_BASE}prop-rock-04.png`,
  'rock-05': `${TILESET_BASE}prop-rock-05.png`,
  'barrel': `${TILESET_BASE}prop-wooden-barrel.png`,
  'cart': `${TILESET_BASE}prop-wooden-cart.png`,
  'fence-h': `${TILESET_BASE}prop-wooden-fence-horizontal.png`,
  'fence-v': `${TILESET_BASE}prop-wooden-fence-vertical.png`,
  'bridge-h': `${TILESET_BASE}prop-wooden-bridge-horizontal.png`,
  'bridge-v': `${TILESET_BASE}prop-wooden-bridge-vertical.png`,
  'flag': `${TILESET_BASE}prop-flag.png`,
  'banner-red': `${TILESET_BASE}prop-red-banner.png`,
  'banner-blue': `${TILESET_BASE}prop-blue-banner.png`,
  'stump-short': `${TILESET_BASE}prop-tree-stump-short.png`,
  'stump-tall': `${TILESET_BASE}prop-tree-stump-tall.png`,
  'treasure': `${TILESET_BASE}prop-treasure-chest.png`,
  'watchtower-short': `${TILESET_BASE}prop-watchtower-short.png`,
  'watchtower-tall': `${TILESET_BASE}prop-watchtower-tall.png`,
  'magic-tower': `${TILESET_BASE}prop-magic-stone-tower.png`,
};

// ── Auto-tiling: map grass/dirt neighbor patterns to ground tile indices ──
// The tileset has grass base + dirt zones. We need to pick the right tile
// based on whether neighbors are dirt or grass.
// Tile categories from the spritesheet:
//   grass-only: 43, 52
//   dirt-only: 14, 23
//   Various edge transitions between them

function isDirtTile(tile: Tile | undefined): boolean {
  return tile === Tile.DIRT || tile === Tile.DIRT_DARK || tile === Tile.STONE
    || tile === Tile.STONE_LIGHT || tile === Tile.SAND || tile === Tile.WOOD_FLOOR;
}

function isWaterTile(tile: Tile | undefined): boolean {
  return tile === Tile.WATER || tile === Tile.WATER_DEEP;
}

// Get auto-tile ground index based on neighbor context
// Returns the ground tile number (1-56) to use
function getAutoTileIndex(tiles: Tile[][], row: number, col: number): number {
  const tile = tiles[row]?.[col];
  if (!tile && tile !== 0) return 43; // fallback grass

  // Water tiles get rendered separately
  if (isWaterTile(tile)) return 0;

  const currentIsDirt = isDirtTile(tile);

  if (!currentIsDirt) {
    // Current tile is grass — check if any neighbors are dirt
    const n = isDirtTile(tiles[row - 1]?.[col]);
    const s = isDirtTile(tiles[row + 1]?.[col]);
    const w = isDirtTile(tiles[row]?.[col - 1]);
    const e = isDirtTile(tiles[row]?.[col + 1]);
    const ne = isDirtTile(tiles[row - 1]?.[col + 1]);
    const nw = isDirtTile(tiles[row - 1]?.[col - 1]);
    const se = isDirtTile(tiles[row + 1]?.[col + 1]);
    const sw = isDirtTile(tiles[row + 1]?.[col - 1]);

    // Inner corners (dirt invading into grass)
    if (n && e && !w && !s) return 10; // dirt top-right inner corner
    if (n && w && !e && !s) return 12; // dirt top-left inner corner
    if (s && e && !w && !n) return 16; // dirt bottom-right inner corner
    if (s && w && !e && !n) return 18; // dirt bottom-left inner corner

    // Just corner diagonal touches
    if (!n && !s && !w && !e) {
      if (se) return 16;
      if (sw) return 18;
      if (ne) return 10;
      if (nw) return 12;
    }

    // Pure grass
    return (row * 131 + col * 97) % 3 === 0 ? 52 : 43;
  }

  // Current tile is dirt — check grass neighbors for edge tiles
  const n = !isDirtTile(tiles[row - 1]?.[col]) && !isWaterTile(tiles[row - 1]?.[col]);
  const s = !isDirtTile(tiles[row + 1]?.[col]) && !isWaterTile(tiles[row + 1]?.[col]);
  const w = !isDirtTile(tiles[row]?.[col - 1]) && !isWaterTile(tiles[row]?.[col - 1]);
  const e = !isDirtTile(tiles[row]?.[col + 1]) && !isWaterTile(tiles[row]?.[col + 1]);

  // Surrounded by grass on all sides = island
  if (n && s && w && e) return 5;

  // Edges
  if (n && s && !w && !e) return 49;  // horizontal path (grass top+bottom)
  if (w && e && !n && !s) return 31;  // vertical path (grass left+right)
  if (n && w && !s && !e) return 9;   // grass top-left corner
  if (n && e && !s && !w) return 7;   // grass top-right corner
  if (s && w && !n && !e) return 3;   // grass bottom-left corner
  if (s && e && !n && !w) return 1;   // grass bottom-right corner
  if (n && !s && !w && !e) return 8;  // grass top edge
  if (s && !n && !w && !e) return 2;  // grass bottom edge
  if (w && !n && !s && !e) return 6;  // grass left edge
  if (e && !n && !s && !w) return 4;  // grass right edge

  // Three sides
  if (n && w && e) return 29; // grass top + sides
  if (s && w && e) return 35; // grass bottom + sides
  if (n && s && w) return 22; // grass left + top/bottom
  if (n && s && e) return 24; // grass right + top/bottom

  // Pure dirt
  return (row * 59 + col * 83) % 3 === 0 ? 23 : 14;
}


// ── Pixel-art World Renderer (Sprite-based) ──
export class WorldRenderer {
  app: Application;
  sim: WorldSimulation;

  private worldContainer!: Container;
  private terrainLayer!: Container;
  private entityLayer!: Container;  // Single Y-sorted layer for decos, buildings, bots, meetings
  private labelLayer!: Container;

  private botGraphics: Map<string, Container> = new Map();
  private meetingGraphics: Map<string, Container> = new Map();
  private chatBubbles: Map<string, { container: Container; createdAt: number }> = new Map();

  private camera = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, zoom: 0.45 };
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private cameraDragStart = { x: 0, y: 0 };

  private selectedBotId: string | null = null;
  private hoveredBotId: string | null = null;
  onBotSelect?: (bot: Bot | null) => void;

  private animFrame = 0;
  private canvasWidth = 0;
  private canvasHeight = 0;

  // Camera enhancements
  private targetZoom = 0.45;
  private cameraVelocity = { x: 0, y: 0 };
  private lastDragPos = { x: 0, y: 0 };
  private keysDown = new Set<string>();

  // Water animation
  private waterTiles: { col: number; row: number; tile: Tile }[] = [];
  private waterGraphics!: Graphics;

  // Loaded textures
  private groundTextures: Map<string, Texture> = new Map();
  private propTextures: Map<string, Texture> = new Map();

  constructor(app: Application, sim: WorldSimulation) {
    this.app = app;
    this.sim = sim;
    this.canvasWidth = app.screen.width;
    this.canvasHeight = app.screen.height;
  }

  async init() {
    // Load all tileset textures
    await this.loadTextures();

    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    this.terrainLayer = new Container();
    this.entityLayer = new Container();  // All depth-sorted objects: decos, buildings, bots, meetings
    this.labelLayer = new Container();

    this.worldContainer.addChild(this.terrainLayer);
    this.worldContainer.addChild(this.entityLayer);
    this.worldContainer.addChild(this.labelLayer);   // Zone labels float above everything

    // Y-sorting for depth: bots behind buildings appear behind, bots in front appear in front
    this.entityLayer.sortableChildren = true;

    const world = generateWorld();
    this.drawTerrain(world.tiles);
    this.drawDecorations(world.decorations);
    this.drawBuildings(world.buildings);
    this.drawZoneLabels();
    this.setupInput();
    this.updateCamera();
  }

  private async loadTextures() {
    // Load ground tiles
    const groundPromises: Promise<void>[] = [];
    for (const [key, path] of Object.entries(GROUND_TILES)) {
      groundPromises.push(
        Assets.load(path).then((tex: Texture) => {
          this.groundTextures.set(key, tex);
        }).catch(() => {
          // Silently skip missing tiles
        })
      );
    }

    // Load prop textures
    const propPromises: Promise<void>[] = [];
    for (const [key, path] of Object.entries(PROP_ASSETS)) {
      propPromises.push(
        Assets.load(path).then((tex: Texture) => {
          this.propTextures.set(key, tex);
        }).catch(() => {
          // Silently skip missing props
        })
      );
    }

    await Promise.all([...groundPromises, ...propPromises]);
  }

  // ═══════════════════════════════════════
  //  TERRAIN (Sprite tiles)
  // ═══════════════════════════════════════

  private drawTerrain(tiles: Tile[][]) {
    const scale = TILE_SIZE / 256; // Ground tiles are 256x256, we need them at 32px

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tile = tiles[row][col];
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;

        // Track water tiles for animation
        if (isWaterTile(tile)) {
          this.waterTiles.push({ col, row, tile });
          continue;
        }

        const tileIndex = getAutoTileIndex(tiles, row, col);
        if (tileIndex === 0) continue; // water handled separately

        const num = String(tileIndex).padStart(2, '0');
        const texture = this.groundTextures.get(`ground-${num}`);

        if (texture) {
          const sprite = new Sprite(texture);
          sprite.x = x;
          sprite.y = y;
          sprite.width = TILE_SIZE;
          sprite.height = TILE_SIZE;
          this.terrainLayer.addChild(sprite);
        } else {
          // Fallback: colored rect
          const g = new Graphics();
          g.rect(x, y, TILE_SIZE, TILE_SIZE);
          g.fill({ color: TILE_COLORS[tile] || 0x5a9f3c });
          this.terrainLayer.addChild(g);
        }
      }
    }

    // Water layer (animated separately via Graphics)
    this.waterGraphics = new Graphics();
    this.drawWater(0);
    this.terrainLayer.addChild(this.waterGraphics);
  }

  private drawWater(frame: number) {
    const g = this.waterGraphics;
    g.clear();

    for (const { col, row, tile } of this.waterTiles) {
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      const baseColor = TILE_COLORS[tile];

      g.rect(x, y, TILE_SIZE, TILE_SIZE);
      g.fill({ color: baseColor });

      const wave = Math.sin((col * 0.5 + row * 0.3 + frame * 0.03)) * 0.5 + 0.5;
      const highlightAlpha = 0.12 + wave * 0.2;
      const offset = Math.sin(frame * 0.02 + col * 0.8) * 3;

      g.rect(x, y + 8 + offset, TILE_SIZE, 2);
      g.fill({ color: 0x60d0ff, alpha: highlightAlpha });
      g.rect(x, y + 20 + offset * 0.7, TILE_SIZE, 1.5);
      g.fill({ color: 0x80e0ff, alpha: highlightAlpha * 0.7 });

      if ((col + row) % 5 === 0) {
        g.circle(x + 16 + offset, y + 14, 3);
        g.fill({ color: 0xa0f0ff, alpha: highlightAlpha * 0.35 });
      }
    }
  }

  // ═══════════════════════════════════════
  //  BUILDINGS (Sprite-based)
  // ═══════════════════════════════════════

  private drawBuildings(buildings: Building[]) {
    for (const b of buildings) {
      const container = new Container();
      const pw = b.w * TILE_SIZE;
      const ph = b.h * TILE_SIZE;

      // Pick the right prop based on building type
      let propKey: string;
      let propScale: number;
      switch (b.type) {
        case 'hall':
          propKey = 'castle-square';
          propScale = Math.min(pw / 360, ph / 400) * 1.4;
          break;
        case 'arena':
          propKey = 'castle-round';
          propScale = Math.min(pw / 320, ph / 480) * 1.6;
          break;
        case 'shop':
        case 'cafe':
        case 'board':
        case 'workshop':
        case 'library':
          propKey = 'house';
          propScale = Math.min(pw / 480, ph / 640) * 2.0;
          break;
        default:
          propKey = 'house';
          propScale = Math.min(pw / 480, ph / 640) * 1.8;
          break;
      }

      const texture = this.propTextures.get(propKey);
      if (texture) {
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 1);
        sprite.x = b.x + pw / 2;
        sprite.y = b.y + ph + 10;
        sprite.scale.set(propScale);

        // Add shadow
        const shadow = new Graphics();
        shadow.ellipse(b.x + pw / 2, b.y + ph + 6, pw * 0.4, ph * 0.1);
        shadow.fill({ color: 0x000000, alpha: 0.15 });
        container.addChild(shadow);
        container.addChild(sprite);
      } else {
        // Fallback: draw simple rect building
        this.drawFallbackBuilding(container, b, pw, ph);
      }

      // Building label
      if (b.label) {
        const lx = b.x + pw / 2;
        const ly = b.y - 10;
        const style = new TextStyle({
          fontFamily: '"Press Start 2P", "Courier New", monospace',
          fontSize: 9,
          fill: 0xffffff,
          letterSpacing: 0.5,
          dropShadow: { color: 0x000000, blur: 0, distance: 1, alpha: 1 },
        });
        const label = new Text({ text: b.label, style });
        label.anchor.set(0.5, 1);
        label.x = lx;
        label.y = ly;

        const tw = label.width + 12;
        const th = 26;
        const bg = new Graphics();
        bg.roundRect(lx - tw / 2, ly - label.height - 4, tw, th, 3);
        bg.fill({ color: 0x1a1a2e, alpha: 0.85 });
        bg.roundRect(lx - tw / 2, ly - label.height - 4, tw, th, 3);
        bg.stroke({ width: 1, color: 0x5a3a1a, alpha: 0.8 });
        container.addChild(bg);
        container.addChild(label);
      }

      container.zIndex = b.y + ph;
      this.entityLayer.addChild(container);
    }
  }

  private drawFallbackBuilding(container: Container, b: Building, pw: number, ph: number) {
    const shadow = new Graphics();
    shadow.rect(b.x + 6, b.y + 6, pw, ph);
    shadow.fill({ color: 0x000000, alpha: 0.15 });
    container.addChild(shadow);

    const wall = new Graphics();
    wall.rect(b.x, b.y, pw, ph);
    wall.fill({ color: b.wallColor });
    wall.rect(b.x, b.y, pw, ph);
    wall.stroke({ width: 2, color: Math.max(0, b.wallColor - 0x202020) });
    container.addChild(wall);

    const roofOverhang = 8;
    const roofH = Math.max(20, ph * 0.35);
    const roof = new Graphics();
    roof.rect(b.x - roofOverhang, b.y - roofH, pw + roofOverhang * 2, roofH);
    roof.fill({ color: b.roofColor });
    roof.rect(b.x - roofOverhang - 2, b.y - 4, pw + roofOverhang * 2 + 4, 6);
    roof.fill({ color: Math.max(0, b.roofColor - 0x181010) });
    container.addChild(roof);
  }

  // ═══════════════════════════════════════
  //  DECORATIONS (Sprite-based)
  // ═══════════════════════════════════════

  private drawDecorations(decorations: DecoPlacement[]) {
    for (const d of decorations) {
      const container = new Container();
      const placed = this.placeDecoSprite(container, d);

      if (!placed) {
        // Fallback to Graphics for types without sprite
        const g = new Graphics();
        this.drawDecoFallback(g, d);
        container.addChild(g);
      }

      container.zIndex = d.y;
      this.entityLayer.addChild(container);
    }
  }

  private placeDecoSprite(container: Container, d: DecoPlacement): boolean {
    const { x, y, type } = d;

    let propKey: string | null = null;
    let targetW = TILE_SIZE;
    let targetH = TILE_SIZE;

    switch (type) {
      case Deco.TREE_OAK:
        propKey = 'tree-large';
        targetW = 100; targetH = 110;
        break;
      case Deco.TREE_PINE:
        propKey = 'tree-medium';
        targetW = 80; targetH = 90;
        break;
      case Deco.TREE_SMALL:
        propKey = 'tree-small';
        targetW = 55; targetH = 65;
        break;
      case Deco.BUSH:
        propKey = 'bushes-large';
        targetW = 50; targetH = 30;
        break;
      case Deco.BUSH_FLOWER:
        propKey = 'bushes-medium';
        targetW = 40; targetH = 30;
        break;
      case Deco.ROCK_LARGE:
        propKey = Math.random() < 0.5 ? 'rock-01' : 'rock-02';
        targetW = 30; targetH = 25;
        break;
      case Deco.ROCK_SMALL:
        propKey = Math.random() < 0.5 ? 'rock-04' : 'rock-05';
        targetW = 18; targetH = 18;
        break;
      case Deco.BARREL:
        propKey = 'barrel';
        targetW = 24; targetH = 28;
        break;
      case Deco.WELL:
        propKey = 'well';
        targetW = 50; targetH = 50;
        break;
      case Deco.FENCE_H:
        propKey = 'fence-h';
        targetW = 36; targetH = 14;
        break;
      case Deco.FENCE_V:
        propKey = 'fence-v';
        targetW = 14; targetH = 36;
        break;
      case Deco.TREE_STUMP:
        propKey = Math.random() < 0.5 ? 'stump-short' : 'stump-tall';
        targetW = 28; targetH = 24;
        break;
      default:
        return false; // No sprite for this type, use fallback
    }

    if (!propKey) return false;
    const texture = this.propTextures.get(propKey);
    if (!texture) return false;

    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1);
    sprite.x = x + TILE_SIZE / 2;
    sprite.y = y + TILE_SIZE;
    sprite.width = targetW;
    sprite.height = targetH;
    container.addChild(sprite);
    return true;
  }

  // Fallback Graphics for deco types without sprite assets
  private drawDecoFallback(g: Graphics, d: DecoPlacement) {
    const { x, y } = d;
    const T = TILE_SIZE;

    switch (d.type) {
      case Deco.FLOWER_RED: {
        g.rect(x + 7, y + 10, 2, 10);
        g.fill({ color: 0x2d6818 });
        g.circle(x + 5, y + 8, 3);
        g.fill({ color: 0xd03030 });
        g.circle(x + 11, y + 8, 3);
        g.fill({ color: 0xd03030 });
        g.circle(x + 8, y + 5, 3);
        g.fill({ color: 0xd83838 });
        g.circle(x + 8, y + 11, 3);
        g.fill({ color: 0xc82828 });
        g.circle(x + 8, y + 8, 2);
        g.fill({ color: 0xf0a060 });
        break;
      }
      case Deco.FLOWER_YELLOW: {
        g.rect(x + 7, y + 10, 2, 10);
        g.fill({ color: 0x2d6818 });
        g.circle(x + 5, y + 7, 3);
        g.fill({ color: 0xe8b020 });
        g.circle(x + 11, y + 7, 3);
        g.fill({ color: 0xe8b020 });
        g.circle(x + 8, y + 4, 3);
        g.fill({ color: 0xf0c030 });
        g.circle(x + 8, y + 10, 3);
        g.fill({ color: 0xd8a018 });
        g.circle(x + 8, y + 7, 2);
        g.fill({ color: 0xfff080 });
        break;
      }
      case Deco.FLOWER_BLUE: {
        g.rect(x + 7, y + 10, 2, 10);
        g.fill({ color: 0x2d6818 });
        g.circle(x + 5, y + 7, 3);
        g.fill({ color: 0x4070c0 });
        g.circle(x + 11, y + 7, 3);
        g.fill({ color: 0x4070c0 });
        g.circle(x + 8, y + 4, 3);
        g.fill({ color: 0x5088d0 });
        g.circle(x + 8, y + 10, 3);
        g.fill({ color: 0x3060b0 });
        g.circle(x + 8, y + 7, 2);
        g.fill({ color: 0x90c0f0 });
        break;
      }
      case Deco.LANTERN: {
        g.rect(x + 14, y + 4, 4, 24);
        g.fill({ color: 0x4a4a4a });
        g.rect(x + 10, y, 12, 8);
        g.fill({ color: 0x3a3a3a });
        g.rect(x + 12, y + 2, 8, 4);
        g.fill({ color: 0xffdd44 });
        g.circle(x + 16, y + 4, 10);
        g.fill({ color: 0xffdd44, alpha: 0.06 });
        break;
      }
      case Deco.CRATE: {
        g.rect(x + 2, y + 4, 20, 20);
        g.fill({ color: 0x8d6c4e });
        g.rect(x + 2, y + 4, 20, 20);
        g.stroke({ width: 2, color: 0x6d4c2e });
        g.moveTo(x + 2, y + 4);
        g.lineTo(x + 22, y + 24);
        g.stroke({ width: 1, color: 0x6d4c2e, alpha: 0.5 });
        g.moveTo(x + 22, y + 4);
        g.lineTo(x + 2, y + 24);
        g.stroke({ width: 1, color: 0x6d4c2e, alpha: 0.5 });
        break;
      }
      case Deco.BENCH: {
        g.rect(x + 2, y + 16, 3, 10);
        g.fill({ color: 0x5d3c1e });
        g.rect(x + 23, y + 16, 3, 10);
        g.fill({ color: 0x5d3c1e });
        g.rect(x, y + 14, 28, 4);
        g.fill({ color: 0x8d6c4e });
        g.rect(x, y + 8, 28, 3);
        g.fill({ color: 0x7d5c3e });
        break;
      }
      case Deco.SIGN: {
        g.rect(x + 12, y + 8, 4, 22);
        g.fill({ color: 0x6d4c2e });
        g.rect(x + 2, y + 2, 24, 12);
        g.fill({ color: 0x8d6c4e });
        g.rect(x + 2, y + 2, 24, 12);
        g.stroke({ width: 1, color: 0x5d3c1e });
        g.poly([x + 20, y + 5, x + 24, y + 8, x + 20, y + 11]);
        g.fill({ color: 0xffffff, alpha: 0.5 });
        break;
      }
      case Deco.MARKET_STALL: {
        g.rect(x, y + 14, T * 2, 10);
        g.fill({ color: 0x8d6c4e });
        g.rect(x + 2, y + 24, 3, 8);
        g.fill({ color: 0x6d4c2e });
        g.rect(x + T * 2 - 5, y + 24, 3, 8);
        g.fill({ color: 0x6d4c2e });
        g.rect(x + 2, y - 4, 3, 18);
        g.fill({ color: 0x6d4c2e });
        g.rect(x + T * 2 - 5, y - 4, 3, 18);
        g.fill({ color: 0x6d4c2e });
        const awningColors = [0xc83030, 0xf0f0e0];
        for (let s = 0; s < 8; s++) {
          g.rect(x + s * 8, y - 8, 8, 6);
          g.fill({ color: awningColors[s % 2] });
        }
        g.circle(x + 10, y + 16, 3);
        g.fill({ color: 0xe8a030 });
        g.circle(x + 22, y + 17, 4);
        g.fill({ color: 0x40a050 });
        break;
      }
      case Deco.POND_LILY: {
        g.circle(x + 8, y + 8, 6);
        g.fill({ color: 0x3d9030 });
        g.circle(x + 8, y + 6, 3);
        g.fill({ color: 0xf0a0c0 });
        g.circle(x + 8, y + 6, 1.5);
        g.fill({ color: 0xf0d0a0 });
        break;
      }
    }
  }

  // ═══════════════════════════════════════
  //  ZONE LABELS
  // ═══════════════════════════════════════

  private drawZoneLabels() {
    // Make label layer non-interactive so it doesn't block bot clicks
    this.labelLayer.eventMode = 'none';

    for (const zone of ZONES) {
      const cx = zone.bounds.x + zone.bounds.width / 2;
      // Position at the TOP edge of the zone, just above the content
      const cy = zone.bounds.y - 50;
      const zoneColor = parseInt(zone.color.replace('#', ''), 16);

      // Zone name — large enough to read when zoomed out
      const nameStyle = new TextStyle({
        fontFamily: '"Press Start 2P", "Courier New", monospace',
        fontSize: 42,
        fill: 0xffffff,
        letterSpacing: 3,
        dropShadow: { color: 0x000000, blur: 6, distance: 4, alpha: 0.95 },
      });
      const nameLabel = new Text({ text: zone.name.toUpperCase(), style: nameStyle });
      nameLabel.anchor.set(0.5, 0.5);
      nameLabel.x = cx;
      nameLabel.y = cy + 10;

      // Icon to the left of the name
      const iconStyle = new TextStyle({ fontSize: 48 });
      const iconLabel = new Text({ text: zone.icon, style: iconStyle });
      iconLabel.anchor.set(0.5, 0.5);
      iconLabel.x = cx - nameLabel.width / 2 - 40;
      iconLabel.y = cy + 8;

      // Background banner plate
      const bg = new Graphics();
      const tw = nameLabel.width + 120;
      const th = 70;
      const bx = cx - tw / 2;
      const by = cy - th / 2 + 8;

      // Dark plate
      bg.roundRect(bx, by, tw, th, 10);
      bg.fill({ color: 0x0e0e1c, alpha: 0.8 });
      // Colored border
      bg.roundRect(bx, by, tw, th, 10);
      bg.stroke({ width: 3, color: zoneColor, alpha: 0.85 });
      // Colored underline accent
      bg.roundRect(bx + 8, by + th - 8, tw - 16, 4, 2);
      bg.fill({ color: zoneColor, alpha: 0.6 });

      const labelGroup = new Container();
      labelGroup.addChild(bg);
      labelGroup.addChild(iconLabel);
      labelGroup.addChild(nameLabel);
      this.labelLayer.addChild(labelGroup);
    }
  }

  // ═══════════════════════════════════════
  //  INPUT & CAMERA
  // ═══════════════════════════════════════

  private setupInput() {
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = { contains: () => true };

    this.app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
      this.isDragging = true;
      this.dragStart = { x: e.globalX, y: e.globalY };
      this.lastDragPos = { x: e.globalX, y: e.globalY };
      this.cameraDragStart = { x: this.camera.x, y: this.camera.y };
      this.cameraVelocity = { x: 0, y: 0 };
    });

    this.app.stage.on('pointermove', (e: FederatedPointerEvent) => {
      if (this.isDragging) {
        const dx = (e.globalX - this.dragStart.x) / this.camera.zoom;
        const dy = (e.globalY - this.dragStart.y) / this.camera.zoom;
        this.camera.x = this.cameraDragStart.x - dx;
        this.camera.y = this.cameraDragStart.y - dy;
        const vx = (e.globalX - this.lastDragPos.x) / this.camera.zoom;
        const vy = (e.globalY - this.lastDragPos.y) / this.camera.zoom;
        this.cameraVelocity = { x: vx * 0.4, y: vy * 0.4 };
        this.lastDragPos = { x: e.globalX, y: e.globalY };
        this.clampCamera();
        this.updateCamera();
      }
    });

    this.app.stage.on('pointerup', () => { this.isDragging = false; });
    this.app.stage.on('pointerupoutside', () => { this.isDragging = false; });

    this.app.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.targetZoom = Math.max(0.15, Math.min(2.5, this.targetZoom * factor));
    }, { passive: false });

    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        if (down) this.keysDown.add(k); else this.keysDown.delete(k);
      }
    };
    window.addEventListener('keydown', (e) => onKey(e, true));
    window.addEventListener('keyup', (e) => onKey(e, false));
  }

  private clampCamera() {
    const halfW = (this.canvasWidth / 2) / this.camera.zoom;
    const halfH = (this.canvasHeight / 2) / this.camera.zoom;
    this.camera.x = Math.max(halfW - 100, Math.min(WORLD_WIDTH - halfW + 100, this.camera.x));
    this.camera.y = Math.max(halfH - 100, Math.min(WORLD_HEIGHT - halfH + 100, this.camera.y));
  }

  private updateCamera() {
    this.worldContainer.scale.set(this.camera.zoom);
    this.worldContainer.x = this.canvasWidth / 2 - this.camera.x * this.camera.zoom;
    this.worldContainer.y = this.canvasHeight / 2 - this.camera.y * this.camera.zoom;
  }

  // ═══════════════════════════════════════
  //  GAME LOOP UPDATE
  // ═══════════════════════════════════════

  update(_timestamp: number) {
    this.animFrame++;

    // Smooth zoom
    if (Math.abs(this.camera.zoom - this.targetZoom) > 0.001) {
      this.camera.zoom += (this.targetZoom - this.camera.zoom) * 0.12;
    }

    // Camera inertia
    if (!this.isDragging && (Math.abs(this.cameraVelocity.x) > 0.05 || Math.abs(this.cameraVelocity.y) > 0.05)) {
      this.camera.x -= this.cameraVelocity.x;
      this.camera.y -= this.cameraVelocity.y;
      this.cameraVelocity.x *= 0.92;
      this.cameraVelocity.y *= 0.92;
    }

    // Keyboard panning
    if (this.keysDown.size > 0) {
      const panSpeed = 6 / this.camera.zoom;
      if (this.keysDown.has('w') || this.keysDown.has('arrowup')) this.camera.y -= panSpeed;
      if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) this.camera.y += panSpeed;
      if (this.keysDown.has('a') || this.keysDown.has('arrowleft')) this.camera.x -= panSpeed;
      if (this.keysDown.has('d') || this.keysDown.has('arrowright')) this.camera.x += panSpeed;
    }

    this.clampCamera();
    this.updateCamera();

    // Fade zone labels based on zoom: full at <=0.5, fades to 0.25 at zoom >=1.5
    const fadeStart = 0.5;
    const fadeEnd = 1.5;
    const t = Math.max(0, Math.min(1, (this.camera.zoom - fadeStart) / (fadeEnd - fadeStart)));
    const labelAlpha = 1.0 - t * 0.75;  // 1.0 → 0.25
    this.labelLayer.alpha = labelAlpha;

    // Animate water every 4 frames
    if (this.animFrame % 4 === 0) {
      this.drawWater(this.animFrame);
    }

    for (const bot of this.sim.bots.values()) {
      this.updateBotVisual(bot);
    }
    this.updateMeetingVisuals();
    this.updateChatBubbles();
    this.cleanupStaleGraphics();
  }

  // ═══════════════════════════════════════
  //  BOT RENDERING
  // ═══════════════════════════════════════

  private updateBotVisual(bot: Bot) {
    let container = this.botGraphics.get(bot.id);
    if (!container) {
      container = this.createBotGraphic(bot);
      this.botGraphics.set(bot.id, container);
      this.entityLayer.addChild(container);
    }

    container.x += (bot.position.x - container.x) * 0.15;
    container.y += (bot.position.y - container.y) * 0.15;
    container.zIndex = container.y;

    const ring = container.getChildByLabel('ring') as Graphics;
    const nameTag = container.getChildByLabel('name') as Text;
    const offerText = container.getChildByLabel('offer') as Text;
    const shadow = container.getChildByLabel('shadow') as Graphics;

    if (ring) {
      if (bot.state === 'meeting') {
        ring.scale.set(0.8 + Math.sin(this.animFrame * 0.1) * 0.2);
        ring.alpha = 0.9;
      } else if (bot.state === 'emoting') {
        ring.scale.set(1.3);
        ring.alpha = 0.5;
      } else {
        ring.scale.set(1.0);
        ring.alpha = 0.5;
      }
    }

    const bodyChild = container.getChildByLabel('body');
    if (bot.state === 'walking') {
      const bob = Math.sin(this.animFrame * 0.2) * 1.5;
      if (bodyChild) {
        bodyChild.y = -16 + bob;
        // Face walking direction
        if (bot.velocity.x !== 0) {
          bodyChild.scale.x = bot.velocity.x > 0 ? 1 : -1;
        }
      }
    } else if (bot.state !== 'meeting') {
      // Reset facing when not in meeting and not walking
      if (bodyChild) bodyChild.scale.x = 1;
    }

    const isHighlighted = bot.id === this.selectedBotId || bot.id === this.hoveredBotId;
    if (offerText) offerText.visible = isHighlighted;
    if (nameTag) nameTag.alpha = isHighlighted ? 1.0 : 0.8;

    const targetScale = isHighlighted ? 1.15 : 1.0;
    container.scale.x += (targetScale - container.scale.x) * 0.1;
    container.scale.y += (targetScale - container.scale.y) * 0.1;
  }

  private createBotGraphic(bot: Bot): Container {
    const container = new Container();
    container.x = bot.position.x;
    container.y = bot.position.y;
    container.eventMode = 'static';
    container.cursor = 'pointer';

    const intentCfg = INTENT_CONFIG[bot.intent as keyof typeof INTENT_CONFIG] ?? { color: '#888888', icon: '\u{2753}', label: 'Unknown' };
    const ringColor = parseInt(intentCfg.color.replace('#', ''), 16);
    const botColor = parseInt(bot.color.replace('#', ''), 16);

    const shadow = new Graphics();
    shadow.ellipse(0, 10, 16, 7);
    shadow.fill({ color: 0x000000, alpha: 0.2 });
    shadow.label = 'shadow';
    container.addChild(shadow);

    const ring = new Graphics();
    ring.circle(0, -4, 24);
    ring.fill({ color: ringColor, alpha: 0.12 });
    ring.circle(0, -4, 24);
    ring.stroke({ width: 2.5, color: ringColor, alpha: 0.5 });
    ring.label = 'ring';
    container.addChild(ring);

    const bodyGroup = new Container();
    bodyGroup.label = 'body';
    bodyGroup.y = -16;

    const body = new Graphics();
    const legColor = Math.max(0, botColor - 0x202020);
    const hatHighlight = Math.min(0xffffff, ringColor + 0x202020);
    body.rect(-7, 14, 6, 8);
    body.fill({ color: legColor });
    body.rect(1, 14, 6, 8);
    body.fill({ color: legColor });
    body.rect(-8, 0, 16, 16);
    body.fill({ color: botColor });
    body.rect(-8, 0, 16, 3);
    body.fill({ color: Math.min(0xffffff, botColor + 0x181818), alpha: 0.3 });
    body.rect(-7, -14, 14, 14);
    body.fill({ color: 0xf0d0a0 });
    body.rect(-4, -10, 3, 3);
    body.fill({ color: 0x222222 });
    body.rect(1, -10, 3, 3);
    body.fill({ color: 0x222222 });
    body.rect(-7, -17, 14, 5);
    body.fill({ color: ringColor });
    body.rect(-7, -17, 14, 2);
    body.fill({ color: hatHighlight, alpha: 0.4 });
    bodyGroup.addChild(body);
    container.addChild(bodyGroup);

    const intentIcon = new Text({
      text: intentCfg.icon,
      style: new TextStyle({ fontSize: 14 }),
    });
    intentIcon.anchor.set(0.5, 0.5);
    intentIcon.y = -46;
    intentIcon.label = 'intent';
    container.addChild(intentIcon);

    const nameTag = new Text({
      text: bot.displayName,
      style: new TextStyle({
        fontFamily: '"Press Start 2P", "Courier New", monospace',
        fontSize: 7,
        fill: 0xffffff,
        letterSpacing: 0.3,
        dropShadow: { color: 0x000000, blur: 0, distance: 1, alpha: 1 },
      }),
    });
    nameTag.anchor.set(0.5, 0);
    nameTag.y = 24;
    nameTag.label = 'name';
    container.addChild(nameTag);

    const offerText = new Text({
      text: bot.offerLine,
      style: new TextStyle({
        fontFamily: '"Press Start 2P", "Courier New", monospace',
        fontSize: 6,
        fill: 0xd0d0d0,
        fontStyle: 'italic',
        dropShadow: { color: 0x000000, blur: 0, distance: 1, alpha: 0.8 },
      }),
    });
    offerText.anchor.set(0.5, 0);
    offerText.y = 36;
    offerText.visible = false;
    offerText.label = 'offer';
    container.addChild(offerText);

    container.on('pointerover', () => { this.hoveredBotId = bot.id; });
    container.on('pointerout', () => {
      if (this.hoveredBotId === bot.id) this.hoveredBotId = null;
    });
    container.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      this.selectedBotId = bot.id;
      this.onBotSelect?.(bot);
    });

    return container;
  }

  // ═══════════════════════════════════════
  //  MEETING VISUALS — The Viral Moment
  // ═══════════════════════════════════════

  // Track meeting animation state
  private meetingState: Map<string, {
    phase: 'active' | 'resolving' | 'done';
    resolveFrame: number;
    success: boolean;
    type: string;
    particles: { x: number; y: number; vx: number; vy: number; life: number; color: number; size: number }[];
  }> = new Map();

  private updateMeetingVisuals() {
    const MEET_COLORS: Record<string, number> = {
      chat: 0x60a5fa, deal: 0xfbbf24, intro: 0x34d399, duel: 0xf472b6,
    };

    for (const meeting of this.sim.meetings.values()) {
      let container = this.meetingGraphics.get(meeting.id);
      let state = this.meetingState.get(meeting.id);

      if (!container) {
        container = this.createMeetingGraphic(meeting);
        this.meetingGraphics.set(meeting.id, container);
        this.entityLayer.addChild(container);
        this.meetingState.set(meeting.id, {
          phase: 'active',
          resolveFrame: 0,
          success: false,
          type: meeting.type,
          particles: [],
        });
        state = this.meetingState.get(meeting.id)!;
      }

      const meetColor = MEET_COLORS[meeting.type] || 0xfbbf24;

      // ── ACTIVE MEETING: dramatic pulsing zone ──
      if (meeting.status === 'active' && state && state.phase === 'active') {
        const glow = container.getChildByLabel('glow') as Graphics;
        const rings = container.getChildByLabel('rings') as Graphics;
        const beam = container.getChildByLabel('beam') as Graphics;
        const dots = container.getChildByLabel('dots') as Graphics;
        const typeIcon = container.getChildByLabel('typeIcon') as Text;
        const bubbleBg = container.getChildByLabel('bubbleBg') as Graphics;

        if (glow) {
          glow.clear();
          const pulse = 0.8 + Math.sin(this.animFrame * 0.06) * 0.2;
          const r = 50 * pulse;
          // Ground glow
          glow.circle(0, 6, r);
          glow.fill({ color: meetColor, alpha: 0.08 + Math.sin(this.animFrame * 0.08) * 0.04 });
          glow.circle(0, 6, r * 0.6);
          glow.fill({ color: meetColor, alpha: 0.06 });
        }

        if (rings) {
          rings.clear();
          // Expanding ring 1
          const r1 = 30 + ((this.animFrame * 0.4) % 40);
          const a1 = Math.max(0, 0.5 - r1 / 80);
          rings.circle(0, 0, r1);
          rings.stroke({ width: 2, color: meetColor, alpha: a1 });
          // Expanding ring 2 (offset phase)
          const r2 = 30 + ((this.animFrame * 0.4 + 20) % 40);
          const a2 = Math.max(0, 0.5 - r2 / 80);
          rings.circle(0, 0, r2);
          rings.stroke({ width: 1.5, color: meetColor, alpha: a2 });
        }

        // Connection beam between the two bots
        if (beam) {
          beam.clear();
          const botA = this.sim.bots.get(meeting.botAId);
          const botB = this.sim.bots.get(meeting.botBId);
          if (botA && botB) {
            const ax = botA.position.x - meeting.position.x;
            const ay = botA.position.y - meeting.position.y;
            const bx = botB.position.x - meeting.position.x;
            const by = botB.position.y - meeting.position.y;
            // Dashed glowing line
            const steps = 10;
            for (let i = 0; i < steps; i++) {
              if (i % 2 === 0) {
                const t0 = i / steps;
                const t1 = (i + 1) / steps;
                const x0 = ax + (bx - ax) * t0;
                const y0 = ay + (by - ay) * t0;
                const x1 = ax + (bx - ax) * t1;
                const y1 = ay + (by - ay) * t1;
                const dashAlpha = 0.15 + Math.sin(this.animFrame * 0.1 + i * 0.5) * 0.1;
                beam.moveTo(x0, y0);
                beam.lineTo(x1, y1);
                beam.stroke({ width: 2, color: meetColor, alpha: dashAlpha });
              }
            }
          }
        }

        // Orbiting sparkle dots
        if (dots) {
          dots.clear();
          for (let i = 0; i < 6; i++) {
            const angle = (this.animFrame * 0.03) + (i * Math.PI * 2 / 6);
            const radius = 34 + Math.sin(this.animFrame * 0.05 + i) * 6;
            const dx = Math.cos(angle) * radius;
            const dy = Math.sin(angle) * radius * 0.5; // flattened orbit
            const sparkleAlpha = 0.4 + Math.sin(this.animFrame * 0.12 + i * 1.2) * 0.3;
            const sparkleSize = 2 + Math.sin(this.animFrame * 0.08 + i) * 1;
            dots.circle(dx, dy, sparkleSize);
            dots.fill({ color: 0xffffff, alpha: sparkleAlpha });
          }
        }

        // Floating type icon bob
        if (typeIcon) {
          typeIcon.y = -52 + Math.sin(this.animFrame * 0.06) * 4;
        }
        if (bubbleBg) {
          bubbleBg.y = -52 + Math.sin(this.animFrame * 0.06) * 4;
        }

        // Face bots toward each other
        this.faceBotsMeeting(meeting);
      }

      // ── RESOLVED: trigger outcome burst ──
      if (meeting.status === 'resolved' && state && state.phase === 'active') {
        state.phase = 'resolving';
        state.resolveFrame = this.animFrame;
        state.success = meeting.result?.success ?? false;

        // Set result emote text
        const resultEmoteSetup = container.getChildByLabel('resultEmote') as Text;
        if (resultEmoteSetup) {
          if (state.success) {
            const successEmotes: Record<string, string> = {
              deal: '\u{1F91D}', chat: '\u{1F4AB}', intro: '\u{1F389}', duel: '\u{1F3C6}',
            };
            resultEmoteSetup.text = successEmotes[state.type] || '\u{2705}';
          } else {
            resultEmoteSetup.text = '\u{1F937}';
          }
        }

        // Spawn burst particles
        const count = state.success ? 24 : 10;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
          const speed = state.success ? 1.5 + Math.random() * 2.5 : 0.8 + Math.random() * 1;
          const pColor = state.success
            ? [0xfbbf24, 0x34d399, 0x60a5fa, 0xf472b6, 0xffffff][Math.floor(Math.random() * 5)]
            : [0x888888, 0x666666, 0xaaaaaa][Math.floor(Math.random() * 3)];
          state.particles.push({
            x: 0, y: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (state.success ? 1 : 0),
            life: 1.0,
            color: pColor,
            size: state.success ? 2 + Math.random() * 3 : 1.5 + Math.random() * 1.5,
          });
        }
      }

      // ── RESOLVING ANIMATION: particles + result emote ──
      if (state && state.phase === 'resolving') {
        const elapsed = this.animFrame - state.resolveFrame;

        // Draw particles
        const particleGfx = container.getChildByLabel('particles') as Graphics;
        if (particleGfx) {
          particleGfx.clear();
          for (const p of state.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.04; // gravity
            p.life -= 0.015;
            if (p.life > 0) {
              particleGfx.circle(p.x, p.y, p.size * p.life);
              particleGfx.fill({ color: p.color, alpha: p.life * 0.9 });
            }
          }
        }

        // Expanding burst ring
        const burstRing = container.getChildByLabel('burstRing') as Graphics;
        if (burstRing) {
          burstRing.clear();
          if (elapsed < 30) {
            const r = 20 + elapsed * 2.5;
            const a = Math.max(0, 0.7 - elapsed / 30);
            const burstColor = state.success ? 0x34d399 : 0xef4444;
            burstRing.circle(0, 0, r);
            burstRing.stroke({ width: 3, color: burstColor, alpha: a });
            burstRing.circle(0, 0, r * 0.6);
            burstRing.stroke({ width: 1.5, color: burstColor, alpha: a * 0.5 });
          }
        }

        // Result emote — rises up and fades
        const resultEmote = container.getChildByLabel('resultEmote') as Text;
        if (resultEmote) {
          resultEmote.visible = true;
          resultEmote.y = -50 - elapsed * 0.6;
          resultEmote.alpha = Math.max(0, 1 - elapsed / 80);
          resultEmote.scale.set(Math.min(1.5, 0.5 + elapsed * 0.04));
        }

        // Deal: floating coin that rises
        const dealIcon = container.getChildByLabel('dealIcon') as Text;
        if (dealIcon && state.type === 'deal' && state.success) {
          dealIcon.visible = true;
          dealIcon.y = -30 - elapsed * 0.8;
          dealIcon.alpha = Math.max(0, 1 - elapsed / 70);
          dealIcon.scale.set(0.8 + Math.sin(elapsed * 0.15) * 0.15);
        }

        // Hide active meeting elements
        const glow = container.getChildByLabel('glow') as Graphics;
        const rings = container.getChildByLabel('rings') as Graphics;
        const beam = container.getChildByLabel('beam') as Graphics;
        const dots = container.getChildByLabel('dots') as Graphics;
        const typeIcon = container.getChildByLabel('typeIcon') as Text;
        const bubbleBg = container.getChildByLabel('bubbleBg') as Graphics;
        if (glow) { glow.clear(); }
        if (rings) { rings.clear(); }
        if (beam) { beam.clear(); }
        if (dots) { dots.clear(); }
        if (typeIcon) typeIcon.visible = false;
        if (bubbleBg) { bubbleBg.clear(); }

        // Phase done after animation
        if (elapsed > 90) {
          state.phase = 'done';
        }
      }

      container.zIndex = meeting.position.y;
    }
  }

  // Make bots face each other during a meeting
  private faceBotsMeeting(meeting: Meeting) {
    const botA = this.sim.bots.get(meeting.botAId);
    const botB = this.sim.bots.get(meeting.botBId);
    if (!botA || !botB) return;

    const containerA = this.botGraphics.get(botA.id);
    const containerB = this.botGraphics.get(botB.id);

    if (containerA) {
      const bodyA = containerA.getChildByLabel('body');
      if (bodyA) {
        bodyA.scale.x = botB.position.x > botA.position.x ? 1 : -1;
      }
    }
    if (containerB) {
      const bodyB = containerB.getChildByLabel('body');
      if (bodyB) {
        bodyB.scale.x = botA.position.x > botB.position.x ? 1 : -1;
      }
    }
  }

  private createMeetingGraphic(meeting: Meeting): Container {
    const MEET_COLORS: Record<string, number> = {
      chat: 0x60a5fa, deal: 0xfbbf24, intro: 0x34d399, duel: 0xf472b6,
    };
    const meetColor = MEET_COLORS[meeting.type] || 0xfbbf24;

    const container = new Container();
    container.x = meeting.position.x;
    container.y = meeting.position.y;
    container.zIndex = meeting.position.y;

    // Ground glow (animated in update)
    const glow = new Graphics();
    glow.label = 'glow';
    container.addChild(glow);

    // Expanding rings (animated in update)
    const rings = new Graphics();
    rings.label = 'rings';
    container.addChild(rings);

    // Connection beam between bots (animated in update)
    const beam = new Graphics();
    beam.label = 'beam';
    container.addChild(beam);

    // Static inner circle
    const innerCircle = new Graphics();
    innerCircle.circle(0, 0, 22);
    innerCircle.fill({ color: meetColor, alpha: 0.12 });
    innerCircle.circle(0, 0, 22);
    innerCircle.stroke({ width: 2.5, color: meetColor, alpha: 0.6 });
    container.addChild(innerCircle);

    // Orbiting sparkle dots (animated in update)
    const dots = new Graphics();
    dots.label = 'dots';
    container.addChild(dots);

    // Floating type icon with bubble background
    const typeIcons: Record<string, string> = {
      chat: '\u{1F4AC}', deal: '\u{1F4B0}', intro: '\u{1F44B}', duel: '\u{26A1}',
    };
    const bubbleBg = new Graphics();
    bubbleBg.roundRect(-18, -68, 36, 32, 8);
    bubbleBg.fill({ color: 0x1a1a2e, alpha: 0.85 });
    bubbleBg.roundRect(-18, -68, 36, 32, 8);
    bubbleBg.stroke({ width: 2, color: meetColor, alpha: 0.7 });
    // Bubble pointer
    bubbleBg.poly([-4, -36, 4, -36, 0, -28]);
    bubbleBg.fill({ color: 0x1a1a2e, alpha: 0.85 });
    bubbleBg.label = 'bubbleBg';
    container.addChild(bubbleBg);

    const typeIcon = new Text({
      text: typeIcons[meeting.type] || '\u{1F4AC}',
      style: new TextStyle({ fontSize: 20 }),
    });
    typeIcon.anchor.set(0.5, 0.5);
    typeIcon.y = -52;
    typeIcon.label = 'typeIcon';
    container.addChild(typeIcon);

    // Particles layer (for resolution burst)
    const particles = new Graphics();
    particles.label = 'particles';
    container.addChild(particles);

    // Burst ring (resolution)
    const burstRing = new Graphics();
    burstRing.label = 'burstRing';
    container.addChild(burstRing);

    // Result emote (rises up on resolve)
    const resultEmote = new Text({
      text: '',
      style: new TextStyle({ fontSize: 32 }),
    });
    resultEmote.anchor.set(0.5, 0.5);
    resultEmote.y = -50;
    resultEmote.visible = false;
    resultEmote.label = 'resultEmote';
    container.addChild(resultEmote);
    // Set text based on type
    if (meeting.type === 'deal') {
      resultEmote.text = '\u{1F91D}'; // Will be updated on resolve
    }

    // Deal-specific floating coin icon
    const dealIcon = new Text({
      text: '\u{1FA99}',
      style: new TextStyle({ fontSize: 24 }),
    });
    dealIcon.anchor.set(0.5, 0.5);
    dealIcon.y = -30;
    dealIcon.visible = false;
    dealIcon.label = 'dealIcon';
    container.addChild(dealIcon);

    // Meeting type label under the circle
    const typeLabel = new Text({
      text: meeting.type.toUpperCase(),
      style: new TextStyle({
        fontFamily: '"Press Start 2P", "Courier New", monospace',
        fontSize: 6,
        fill: meetColor,
        letterSpacing: 1,
        dropShadow: { color: 0x000000, blur: 0, distance: 1, alpha: 1 },
      }),
    });
    typeLabel.anchor.set(0.5, 0);
    typeLabel.y = 28;
    container.addChild(typeLabel);

    return container;
  }

  // ═══════════════════════════════════════
  //  CHAT BUBBLES
  // ═══════════════════════════════════════

  private updateChatBubbles() {
    const now = Date.now();
    const BUBBLE_DURATION = 4000; // 4 seconds

    // Create bubbles for new chats
    for (const chat of this.sim.recentChats) {
      if (this.chatBubbles.has(chat.id)) continue;

      const bubble = this.createChatBubble(chat.text, chat.position);
      bubble.zIndex = chat.position.y;
      this.entityLayer.addChild(bubble);
      this.chatBubbles.set(chat.id, { container: bubble, createdAt: chat.createdAt });
    }

    // Update existing bubbles (position tracking + fade)
    for (const [id, entry] of this.chatBubbles) {
      const age = now - entry.createdAt;
      if (age > BUBBLE_DURATION) {
        entry.container.destroy({ children: true });
        this.chatBubbles.delete(id);
        continue;
      }

      // Find matching chat to track sender position
      const chat = this.sim.recentChats.find(c => c.id === id);
      if (chat) {
        // Track sender bot position if they're still in the sim
        const senderBot = this.sim.bots.get(chat.fromBotId);
        if (senderBot) {
          entry.container.x += (senderBot.position.x - entry.container.x) * 0.15;
          entry.container.y += ((senderBot.position.y - 60) - entry.container.y) * 0.15;
          entry.container.zIndex = senderBot.position.y;
        }
      }

      // Fade out in the last second
      const fadeStart = BUBBLE_DURATION - 1000;
      if (age > fadeStart) {
        entry.container.alpha = 1 - (age - fadeStart) / 1000;
      } else {
        entry.container.alpha = 1;
      }
    }
  }

  private createChatBubble(text: string, position: { x: number; y: number }): Container {
    const container = new Container();
    container.x = position.x;
    container.y = position.y - 60;

    // Truncate text
    const displayText = text.length > 30 ? text.slice(0, 28) + '..' : text;

    const label = new Text({
      text: displayText,
      style: new TextStyle({
        fontFamily: '"Press Start 2P", "Courier New", monospace',
        fontSize: 7,
        fill: 0xffffff,
        letterSpacing: 0.3,
      }),
    });
    label.anchor.set(0.5, 0.5);

    const padX = 10;
    const padY = 8;
    const tw = label.width + padX * 2;
    const th = label.height + padY * 2;
    const pointerH = 6;

    const bg = new Graphics();
    // Bubble plate
    bg.roundRect(-tw / 2, -th / 2, tw, th, 4);
    bg.fill({ color: 0x1a1a2e, alpha: 0.9 });
    bg.roundRect(-tw / 2, -th / 2, tw, th, 4);
    bg.stroke({ width: 1.5, color: 0x60a5fa, alpha: 0.8 });
    // Pointer triangle pointing down
    bg.poly([-4, th / 2, 4, th / 2, 0, th / 2 + pointerH]);
    bg.fill({ color: 0x1a1a2e, alpha: 0.9 });

    container.addChild(bg);
    container.addChild(label);

    return container;
  }

  private cleanupStaleGraphics() {
    for (const [id, container] of this.meetingGraphics) {
      if (!this.sim.meetings.has(id)) {
        container.destroy({ children: true });
        this.meetingGraphics.delete(id);
        this.meetingState.delete(id);
      }
    }
  }

  // ═══════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════

  deselectBot() {
    this.selectedBotId = null;
    this.onBotSelect?.(null);
  }

  focusBot(botId: string) {
    const bot = this.sim.bots.get(botId);
    if (bot) {
      this.camera.x = bot.position.x;
      this.camera.y = bot.position.y;
      this.camera.zoom = 1.0;
      this.selectedBotId = botId;
      this.updateCamera();
    }
  }

  getCamera() {
    return { x: this.camera.x, y: this.camera.y, zoom: this.camera.zoom, viewWidth: this.canvasWidth, viewHeight: this.canvasHeight };
  }

  resize(width: number, height: number) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.app.renderer.resize(width, height);
    this.updateCamera();
  }

  destroy() {
    this.app.destroy(true);
  }
}
