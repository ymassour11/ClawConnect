// ── Tilemap World Generator ──
// Creates a rich 2D pixel-art-style game world (6400x4800)

import { WORLD_WIDTH, WORLD_HEIGHT, ZONES } from './constants';

export const TILE_SIZE = 32;
export const MAP_COLS = Math.floor(WORLD_WIDTH / TILE_SIZE);   // 200
export const MAP_ROWS = Math.floor(WORLD_HEIGHT / TILE_SIZE);  // 150

// ── Tile types ──
export enum Tile {
  GRASS_1 = 0,
  GRASS_2 = 1,
  GRASS_3 = 2,
  GRASS_DARK = 3,
  DIRT = 4,
  DIRT_DARK = 5,
  STONE = 6,
  STONE_LIGHT = 7,
  WATER = 8,
  WATER_DEEP = 9,
  SAND = 10,
  WOOD_FLOOR = 11,
}

// ── Decoration types ──
export enum Deco {
  TREE_OAK = 0,
  TREE_PINE = 1,
  TREE_SMALL = 2,
  BUSH = 3,
  BUSH_FLOWER = 4,
  FLOWER_RED = 5,
  FLOWER_YELLOW = 6,
  FLOWER_BLUE = 7,
  ROCK_LARGE = 8,
  ROCK_SMALL = 9,
  FENCE_H = 10,
  FENCE_V = 11,
  LANTERN = 12,
  BARREL = 13,
  CRATE = 14,
  WELL = 15,
  BENCH = 16,
  SIGN = 17,
  MARKET_STALL = 18,
  POND_LILY = 19,
  TREE_STUMP = 20,
}

// ── Building definition ──
export interface Building {
  x: number; y: number;
  w: number; h: number;
  roofColor: number;
  wallColor: number;
  type: 'house' | 'shop' | 'hall' | 'cafe' | 'arena' | 'board' | 'library' | 'workshop';
  label?: string;
}

// ── Decoration placement ──
export interface DecoPlacement {
  type: Deco;
  x: number; y: number;
}

// ── Colors ──
export const TILE_COLORS: Record<Tile, number> = {
  [Tile.GRASS_1]:     0x5a9f3c,
  [Tile.GRASS_2]:     0x4e8f34,
  [Tile.GRASS_3]:     0x68ab48,
  [Tile.GRASS_DARK]:  0x3d7828,
  [Tile.DIRT]:        0x9b8365,
  [Tile.DIRT_DARK]:   0x8b7355,
  [Tile.STONE]:       0xa09888,
  [Tile.STONE_LIGHT]: 0xb8b0a0,
  [Tile.WATER]:       0x2e88d0,
  [Tile.WATER_DEEP]:  0x1a70c0,
  [Tile.SAND]:        0xd4c090,
  [Tile.WOOD_FLOOR]:  0x8d6c4e,
};

// ── Seeded random ──
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Generate the world ──
export function generateWorld() {
  const rand = seededRandom(42);
  const tiles: Tile[][] = [];
  const buildings: Building[] = [];
  const decorations: DecoPlacement[] = [];

  // 1) Fill base grass with variation
  for (let row = 0; row < MAP_ROWS; row++) {
    tiles[row] = [];
    for (let col = 0; col < MAP_COLS; col++) {
      const r = rand();
      if (r < 0.55) tiles[row][col] = Tile.GRASS_1;
      else if (r < 0.80) tiles[row][col] = Tile.GRASS_2;
      else if (r < 0.92) tiles[row][col] = Tile.GRASS_3;
      else tiles[row][col] = Tile.GRASS_DARK;
    }
  }

  // 2) Create a winding river (right third of map, ~col 120)
  let riverX = 120 + Math.floor(rand() * 6);
  for (let row = 0; row < MAP_ROWS; row++) {
    riverX += Math.floor(rand() * 3) - 1;
    riverX = Math.max(116, Math.min(128, riverX));
    for (let dx = -3; dx <= 3; dx++) {
      const col = riverX + dx;
      if (col >= 0 && col < MAP_COLS) {
        tiles[row][col] = Math.abs(dx) < 2 ? Tile.WATER_DEEP : Tile.WATER;
      }
    }
    // Sand banks
    for (const dx of [-4, 4]) {
      const col = riverX + dx;
      if (col >= 0 && col < MAP_COLS) {
        tiles[row][col] = Tile.SAND;
      }
    }
  }

  // 3) Create bridges across the river
  const bridgeRowSets = [
    [28, 29, 30],       // North bridge
    [110, 111, 112],    // South bridge
  ];
  for (const rows of bridgeRowSets) {
    for (const bRow of rows) {
      if (bRow >= 0 && bRow < MAP_ROWS) {
        for (let col = 0; col < MAP_COLS; col++) {
          if (tiles[bRow][col] === Tile.WATER || tiles[bRow][col] === Tile.WATER_DEEP || tiles[bRow][col] === Tile.SAND) {
            tiles[bRow][col] = Tile.WOOD_FLOOR;
          }
        }
      }
    }
  }

  // Bridge railings and lanterns
  for (const rows of bridgeRowSets) {
    const topRow = rows[0];
    const bottomRow = rows[rows.length - 1];
    for (let col = 108; col <= 136; col++) {
      if (tiles[topRow]?.[col] === Tile.WOOD_FLOOR) {
        decorations.push({ type: Deco.FENCE_H, x: col * TILE_SIZE, y: topRow * TILE_SIZE });
      }
      if (tiles[bottomRow]?.[col] === Tile.WOOD_FLOOR) {
        decorations.push({ type: Deco.FENCE_H, x: col * TILE_SIZE, y: bottomRow * TILE_SIZE });
      }
    }
    decorations.push({ type: Deco.LANTERN, x: 113 * TILE_SIZE, y: rows[1] * TILE_SIZE });
    decorations.push({ type: Deco.LANTERN, x: 131 * TILE_SIZE, y: rows[1] * TILE_SIZE });
  }

  // 4) Add ponds
  addPond(tiles, decorations, 30, 105, 5, rand);   // Near Cafe
  addPond(tiles, decorations, 95, 115, 4, rand);    // Near Garden
  addPond(tiles, decorations, 140, 60, 3, rand);    // Northeast wilderness

  // 5) Pave zone areas with stone/dirt
  for (const zone of ZONES) {
    const startCol = Math.floor(zone.bounds.x / TILE_SIZE);
    const startRow = Math.floor(zone.bounds.y / TILE_SIZE);
    const endCol = Math.floor((zone.bounds.x + zone.bounds.width) / TILE_SIZE);
    const endRow = Math.floor((zone.bounds.y + zone.bounds.height) / TILE_SIZE);

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
          if (tiles[row][col] === Tile.WATER || tiles[row][col] === Tile.WATER_DEEP) continue;
          switch (zone.id) {
            case 'town-square':
              tiles[row][col] = rand() < 0.7 ? Tile.STONE : Tile.STONE_LIGHT; break;
            case 'market-street':
              tiles[row][col] = rand() < 0.6 ? Tile.DIRT : Tile.STONE; break;
            case 'arena':
              tiles[row][col] = rand() < 0.5 ? Tile.SAND : Tile.DIRT; break;
            case 'cafe':
              tiles[row][col] = rand() < 0.4 ? Tile.STONE_LIGHT : Tile.GRASS_3; break;
            case 'job-board':
              tiles[row][col] = rand() < 0.5 ? Tile.WOOD_FLOOR : Tile.DIRT; break;
            case 'library':
              tiles[row][col] = rand() < 0.7 ? Tile.STONE_LIGHT : Tile.STONE; break;
            case 'workshop':
              tiles[row][col] = rand() < 0.6 ? Tile.DIRT_DARK : Tile.DIRT; break;
            case 'garden':
              tiles[row][col] = rand() < 0.3 ? Tile.STONE_LIGHT : (rand() < 0.5 ? Tile.GRASS_3 : Tile.GRASS_2); break;
          }
        }
      }
    }
  }

  // 6) Create dirt paths connecting zones
  const zc = (id: string) => {
    const z = ZONES.find(z => z.id === id)!;
    return { x: Math.floor((z.bounds.x + z.bounds.width / 2) / TILE_SIZE), y: Math.floor((z.bounds.y + z.bounds.height / 2) / TILE_SIZE) };
  };

  // Bridge waypoints
  const nbW = { x: 112, y: 29 }, nbE = { x: 132, y: 29 };
  const sbW = { x: 112, y: 111 }, sbE = { x: 132, y: 111 };

  // Direct paths (same side of river)
  const direct: [string, string][] = [
    ['town-square', 'market-street'], ['town-square', 'library'],
    ['town-square', 'workshop'], ['town-square', 'cafe'],
    ['town-square', 'garden'], ['market-street', 'library'],
    ['market-street', 'workshop'], ['workshop', 'cafe'], ['cafe', 'garden'],
  ];
  for (const [a, b] of direct) {
    const ca = zc(a), cb = zc(b);
    drawPath(tiles, ca.x, ca.y, cb.x, cb.y, rand);
  }

  // Cross-river paths via bridges
  const ts = zc('town-square'), jb = zc('job-board'), ar = zc('arena');
  const lib = zc('library'), gar = zc('garden');
  drawPath(tiles, ts.x, ts.y, nbW.x, nbW.y, rand);
  drawPath(tiles, nbE.x, nbE.y, jb.x, jb.y, rand);
  drawPath(tiles, lib.x, lib.y, nbW.x, nbW.y, rand);
  drawPath(tiles, ts.x, ts.y, sbW.x, sbW.y, rand);
  drawPath(tiles, sbE.x, sbE.y, ar.x, ar.y, rand);
  drawPath(tiles, gar.x, gar.y, sbW.x, sbW.y, rand);

  // 7) Place buildings
  placeBuildings(buildings, decorations, rand);

  // 8) Scatter trees in wilderness
  decorations.push(
    // Top edge
    ...fillTrees(2, 2, 12, 14, 25, rand),
    ...fillTrees(44, 2, 74, 10, 30, rand),
    ...fillTrees(102, 2, 115, 10, 15, rand),
    ...fillTrees(135, 2, 148, 16, 20, rand),
    ...fillTrees(182, 2, 198, 20, 25, rand),
    // Bottom edge
    ...fillTrees(2, 140, 40, 148, 25, rand),
    ...fillTrees(44, 142, 108, 148, 25, rand),
    ...fillTrees(135, 128, 148, 148, 18, rand),
    ...fillTrees(182, 128, 198, 148, 20, rand),
    // Left edge
    ...fillTrees(2, 14, 10, 38, 15, rand),
    ...fillTrees(2, 92, 10, 112, 12, rand),
    // Right edge
    ...fillTrees(190, 20, 198, 100, 18, rand),
    ...fillTrees(190, 126, 198, 148, 10, rand),
    // Between Market and Library
    ...fillTrees(44, 10, 74, 28, 25, rand),
    // Between Market and Workshop
    ...fillTrees(8, 38, 38, 68, 20, rand),
    // Between Library and Town Square
    ...fillTrees(44, 30, 68, 54, 18, rand),
    ...fillTrees(100, 30, 112, 54, 12, rand),
    // Between Workshop and Cafe
    ...fillTrees(8, 92, 38, 112, 18, rand),
    // Central south
    ...fillTrees(44, 86, 74, 120, 25, rand),
    // West of river
    ...fillTrees(108, 34, 115, 108, 22, rand),
    ...fillTrees(108, 114, 115, 140, 12, rand),
    // East of river
    ...fillTrees(134, 42, 150, 98, 25, rand),
    ...fillTrees(182, 42, 198, 98, 18, rand),
    // Forest patches
    ...fillTrees(50, 38, 66, 52, 12, rand),
    ...fillTrees(50, 92, 68, 118, 12, rand),
  );

  // 9) Scatter bushes, flowers, rocks
  for (let i = 0; i < 300; i++) {
    const col = Math.floor(rand() * MAP_COLS);
    const row = Math.floor(rand() * MAP_ROWS);
    if (isGrass(tiles[row]?.[col])) {
      const r = rand();
      if (r < 0.30) decorations.push({ type: Deco.BUSH, x: col * TILE_SIZE, y: row * TILE_SIZE });
      else if (r < 0.45) decorations.push({ type: Deco.BUSH_FLOWER, x: col * TILE_SIZE, y: row * TILE_SIZE });
      else if (r < 0.58) decorations.push({ type: Deco.FLOWER_RED, x: col * TILE_SIZE, y: row * TILE_SIZE });
      else if (r < 0.70) decorations.push({ type: Deco.FLOWER_YELLOW, x: col * TILE_SIZE, y: row * TILE_SIZE });
      else if (r < 0.80) decorations.push({ type: Deco.FLOWER_BLUE, x: col * TILE_SIZE, y: row * TILE_SIZE });
      else if (r < 0.92) decorations.push({ type: Deco.ROCK_SMALL, x: col * TILE_SIZE, y: row * TILE_SIZE });
      else decorations.push({ type: Deco.ROCK_LARGE, x: col * TILE_SIZE, y: row * TILE_SIZE });
    }
  }

  // 10) Zone-specific decorations
  placeZoneDecorations(decorations, tiles, rand);

  return { tiles, buildings, decorations };
}

// ═══════════════════════════════════════
//  BUILDING PLACEMENT
// ═══════════════════════════════════════

function placeBuildings(buildings: Building[], decorations: DecoPlacement[], rand: () => number) {
  const T = TILE_SIZE;

  // Town Square (cols 69-106, rows 56-84)
  buildings.push(
    { x: 78 * T, y: 58 * T, w: 10, h: 7, roofColor: 0xb85450, wallColor: 0xd4c4a0, type: 'hall', label: 'Town Hall' },
    { x: 92 * T, y: 60 * T, w: 6, h: 5, roofColor: 0x6b8caf, wallColor: 0xc8b890, type: 'house', label: 'The Tavern' },
    { x: 78 * T, y: 68 * T, w: 5, h: 5, roofColor: 0x8b6c4e, wallColor: 0xc0b080, type: 'house' },
    { x: 94 * T, y: 70 * T, w: 5, h: 4, roofColor: 0x7a5a3e, wallColor: 0xb8a878, type: 'house' },
    { x: 86 * T, y: 58 * T, w: 5, h: 5, roofColor: 0x996644, wallColor: 0xd0c090, type: 'hall', label: 'Council' },
  );

  // Market Street (cols 13-43, rows 16-37)
  buildings.push(
    { x: 16 * T, y: 18 * T, w: 7, h: 5, roofColor: 0xc87040, wallColor: 0xd8c898, type: 'shop', label: 'General Store' },
    { x: 26 * T, y: 17 * T, w: 6, h: 5, roofColor: 0xa86040, wallColor: 0xc8b488, type: 'shop', label: 'Trade Post' },
    { x: 16 * T, y: 26 * T, w: 8, h: 5, roofColor: 0xd08050, wallColor: 0xd0c098, type: 'shop', label: 'Bazaar' },
    { x: 28 * T, y: 26 * T, w: 5, h: 4, roofColor: 0xb87050, wallColor: 0xc0a878, type: 'shop' },
    { x: 36 * T, y: 20 * T, w: 5, h: 4, roofColor: 0xb06848, wallColor: 0xc8b080, type: 'shop', label: 'Tailor' },
  );
  // Market stalls
  for (let i = 0; i < 6; i++) {
    decorations.push({ type: Deco.MARKET_STALL, x: (14 + i * 4) * T, y: 23 * T });
  }

  // Library (cols 75-100, rows 11-28)
  buildings.push(
    { x: 78 * T, y: 14 * T, w: 9, h: 6, roofColor: 0x7060a0, wallColor: 0xc8c0d8, type: 'library', label: 'Grand Library' },
    { x: 90 * T, y: 16 * T, w: 5, h: 4, roofColor: 0x6858a0, wallColor: 0xb8b0c8, type: 'house', label: 'Study Hall' },
    { x: 78 * T, y: 22 * T, w: 5, h: 4, roofColor: 0x5a4890, wallColor: 0xb0a8c0, type: 'house' },
  );

  // Workshop (cols 13-37, rows 69-90)
  buildings.push(
    { x: 16 * T, y: 72 * T, w: 7, h: 5, roofColor: 0xb07030, wallColor: 0xc8a870, type: 'workshop', label: 'The Forge' },
    { x: 26 * T, y: 72 * T, w: 5, h: 4, roofColor: 0xa06828, wallColor: 0xb89860, type: 'shop', label: 'Storage' },
    { x: 16 * T, y: 80 * T, w: 6, h: 4, roofColor: 0x906020, wallColor: 0xb89058, type: 'workshop', label: 'Smithy' },
  );

  // Cafe (cols 13-40, rows 113-134)
  buildings.push(
    { x: 18 * T, y: 116 * T, w: 8, h: 6, roofColor: 0x9a6ab0, wallColor: 0xd0c0d8, type: 'cafe', label: 'The Clawbot Cafe' },
    { x: 30 * T, y: 118 * T, w: 5, h: 4, roofColor: 0x8a5aa0, wallColor: 0xc8b8d0, type: 'house' },
    { x: 18 * T, y: 124 * T, w: 6, h: 4, roofColor: 0x80508a, wallColor: 0xc0b0c0, type: 'cafe', label: 'Bakery' },
  );

  // Garden (cols 75-106, rows 122-140)
  buildings.push(
    { x: 80 * T, y: 126 * T, w: 8, h: 5, roofColor: 0x408850, wallColor: 0xc8d8c0, type: 'house', label: 'Greenhouse' },
    { x: 92 * T, y: 128 * T, w: 5, h: 4, roofColor: 0x388048, wallColor: 0xb8c8b0, type: 'house' },
  );

  // Job Board (cols 150-181, rows 19-40) — east of river
  buildings.push(
    { x: 154 * T, y: 22 * T, w: 8, h: 6, roofColor: 0x5a7a9a, wallColor: 0xb8b0a0, type: 'board', label: 'Job Board HQ' },
    { x: 166 * T, y: 24 * T, w: 6, h: 4, roofColor: 0x6a8aaa, wallColor: 0xc0b8a8, type: 'house', label: 'Office' },
    { x: 154 * T, y: 30 * T, w: 5, h: 4, roofColor: 0x5a8a7a, wallColor: 0xa8c0b0, type: 'house' },
  );

  // Arena (cols 150-181, rows 100-125) — east of river
  buildings.push(
    { x: 158 * T, y: 106 * T, w: 12, h: 8, roofColor: 0xc06070, wallColor: 0xc8b090, type: 'arena', label: 'The Arena' },
    { x: 174 * T, y: 108 * T, w: 5, h: 4, roofColor: 0xb05060, wallColor: 0xb8a080, type: 'house', label: 'Barracks' },
    { x: 158 * T, y: 116 * T, w: 5, h: 4, roofColor: 0xa04858, wallColor: 0xb09878, type: 'house' },
  );
}

// ═══════════════════════════════════════
//  ZONE DECORATIONS
// ═══════════════════════════════════════

function placeZoneDecorations(decorations: DecoPlacement[], tiles: Tile[][], rand: () => number) {
  const T = TILE_SIZE;

  // Benches in town square
  for (let i = 0; i < 6; i++) {
    decorations.push({ type: Deco.BENCH, x: (80 + i * 4) * T, y: 66 * T });
  }
  // Well in town square
  decorations.push({ type: Deco.WELL, x: 88 * T, y: 64 * T });

  // Lanterns around town square
  for (let i = 0; i < 8; i++) {
    decorations.push({ type: Deco.LANTERN, x: (76 + i * 4) * T, y: 56 * T });
    decorations.push({ type: Deco.LANTERN, x: (76 + i * 4) * T, y: 84 * T });
  }

  // Lanterns along major paths
  for (let i = 0; i < 8; i++) {
    decorations.push({ type: Deco.LANTERN, x: (30 + i * 6) * T, y: 42 * T });
    decorations.push({ type: Deco.LANTERN, x: (78 + i * 4) * T, y: 88 * T });
  }

  // Signs at zone entrances
  for (const zone of ZONES) {
    const sx = Math.floor(zone.bounds.x / T) + 2;
    const sy = Math.floor(zone.bounds.y / T) - 1;
    if (sy >= 0) decorations.push({ type: Deco.SIGN, x: sx * T, y: sy * T });
  }

  // Barrels/crates near market
  for (let i = 0; i < 8; i++) {
    decorations.push({ type: rand() < 0.5 ? Deco.BARREL : Deco.CRATE, x: (14 + i * 3) * T, y: 24 * T });
  }

  // Barrels/crates near workshop
  for (let i = 0; i < 6; i++) {
    decorations.push({ type: rand() < 0.6 ? Deco.BARREL : Deco.CRATE, x: (14 + i * 2) * T, y: 78 * T });
  }

  // Rocks near arena
  for (let i = 0; i < 12; i++) {
    decorations.push({
      type: rand() < 0.5 ? Deco.ROCK_LARGE : Deco.ROCK_SMALL,
      x: (152 + Math.floor(rand() * 28)) * T,
      y: (100 + Math.floor(rand() * 24)) * T,
    });
  }

  // Fences around cafe
  for (let col = 16; col <= 34; col++) {
    decorations.push({ type: Deco.FENCE_H, x: col * T, y: 114 * T });
    decorations.push({ type: Deco.FENCE_H, x: col * T, y: 130 * T });
  }

  // Fences around garden (decorative)
  for (let col = 78; col <= 100; col += 2) {
    decorations.push({ type: Deco.FENCE_H, x: col * T, y: 122 * T });
  }

  // Flower meadow in garden
  for (let i = 0; i < 30; i++) {
    const col = 78 + Math.floor(rand() * 24);
    const row = 124 + Math.floor(rand() * 14);
    const r = rand();
    if (r < 0.3) decorations.push({ type: Deco.FLOWER_RED, x: col * T, y: row * T });
    else if (r < 0.6) decorations.push({ type: Deco.FLOWER_YELLOW, x: col * T, y: row * T });
    else if (r < 0.8) decorations.push({ type: Deco.FLOWER_BLUE, x: col * T, y: row * T });
    else decorations.push({ type: Deco.BUSH_FLOWER, x: col * T, y: row * T });
  }

  // Benches in library area
  for (let i = 0; i < 3; i++) {
    decorations.push({ type: Deco.BENCH, x: (80 + i * 4) * T, y: 20 * T });
  }

  // Well near cafe
  decorations.push({ type: Deco.WELL, x: 26 * T, y: 120 * T });

  // Benches near garden
  for (let i = 0; i < 4; i++) {
    decorations.push({ type: Deco.BENCH, x: (82 + i * 5) * T, y: 134 * T });
  }
}

// ═══════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════

function addPond(tiles: Tile[][], decorations: DecoPlacement[], cx: number, cy: number, radius: number, rand: () => number) {
  for (let row = cy - radius - 1; row <= cy + radius + 1; row++) {
    for (let col = cx - radius - 2; col <= cx + radius + 2; col++) {
      if (row >= 0 && row < MAP_ROWS && col >= 0 && col < MAP_COLS) {
        const d = Math.sqrt((row - cy) ** 2 + (col - cx) ** 2);
        if (d < radius * 0.6) tiles[row][col] = Tile.WATER_DEEP;
        else if (d < radius) tiles[row][col] = Tile.WATER;
        else if (d < radius + 1.2) tiles[row][col] = Tile.SAND;
      }
    }
  }
  decorations.push({ type: Deco.POND_LILY, x: (cx - 1) * TILE_SIZE, y: (cy - 1) * TILE_SIZE });
  decorations.push({ type: Deco.POND_LILY, x: (cx + 1) * TILE_SIZE, y: (cy + 1) * TILE_SIZE });
}

function drawPath(tiles: Tile[][], x1: number, y1: number, x2: number, y2: number, rand: () => number) {
  let cx = x1, cy = y1;
  while (cx !== x2 || cy !== y2) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const r = cy + dy, c = cx + dx;
        if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
          if (tiles[r][c] !== Tile.WATER && tiles[r][c] !== Tile.WATER_DEEP) {
            tiles[r][c] = (Math.abs(dx) + Math.abs(dy)) < 2
              ? Tile.DIRT
              : (rand() < 0.5 ? Tile.DIRT_DARK : Tile.DIRT);
          }
        }
      }
    }
    if (rand() < 0.7) {
      if (cx < x2) cx++;
      else if (cx > x2) cx--;
    } else {
      if (cy < y2) cy++;
      else if (cy > y2) cy--;
    }
    if (rand() < 0.7) {
      if (cy < y2) cy++;
      else if (cy > y2) cy--;
    }
  }
}

function fillTrees(minCol: number, minRow: number, maxCol: number, maxRow: number, count: number, rand: () => number): DecoPlacement[] {
  const trees: DecoPlacement[] = [];
  for (let i = 0; i < count; i++) {
    const col = minCol + Math.floor(rand() * (maxCol - minCol));
    const row = minRow + Math.floor(rand() * (maxRow - minRow));
    const r = rand();
    trees.push({
      type: r < 0.35 ? Deco.TREE_OAK : r < 0.6 ? Deco.TREE_PINE : r < 0.85 ? Deco.TREE_SMALL : Deco.TREE_STUMP,
      x: col * TILE_SIZE,
      y: row * TILE_SIZE,
    });
  }
  return trees;
}

function isGrass(tile: Tile | undefined): boolean {
  return tile === Tile.GRASS_1 || tile === Tile.GRASS_2 || tile === Tile.GRASS_3 || tile === Tile.GRASS_DARK;
}

// ── Building collision rects (exported for simulation use) ──
// Generate just the building list without full world generation
export interface BuildingRect {
  x: number; y: number; w: number; h: number;
}

export function getBuildingRects(): BuildingRect[] {
  const buildings: Building[] = [];
  const decorations: DecoPlacement[] = [];
  const rand = seededRandom(42);
  placeBuildings(buildings, decorations, rand);
  return buildings.map(b => ({
    x: b.x - 16,        // add padding around building
    y: b.y - 16,
    w: b.w * TILE_SIZE + 32,
    h: b.h * TILE_SIZE + 32,
  }));
}
