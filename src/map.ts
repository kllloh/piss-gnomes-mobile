/**
 * The island: its shape, hills, lakes, river and the named places on it. Everything is a plain function of (x, z), so the
 * terrain mesh, the colliders, the minimap, the bots and the droplets all agree about where the ground and the water are.
 */

/** How big the island is, relative to the first version of it. */
export const K = 1;

export type ThemeId = 'forest' | 'ice' | 'desert';
function chosenTheme(): ThemeId {
  let id: string | null = null;
  try { id = new URLSearchParams(location.search).get('map') || localStorage.getItem('pg-map'); } catch { /* no storage */ }
  return id === 'ice' || id === 'desert' ? id : 'forest';
}
/** Which map this page was loaded with (the menu reloads the page to change it). */
export const THEME_ID: ThemeId = chosenTheme();
const ICE = THEME_ID === 'ice';
const DESERT = THEME_ID === 'desert';

/** Look and feel of each map: lighting, fog and water. */
export const THEME = {
  forest: { name: 'FOREST', hi: 1.9, si: 0.95, sky: 0xa0b0e0, ground: 0x3a4046, sun: 0xa8d0ff, fog: [0.05, 0.065, 0.1], water: 0x20475a, sea: [0.1, 0.24, 0.32], idx: 0 },
  ice: { name: 'ICE', hi: 1.45, si: 1.0, sky: 0xc8e0ff, ground: 0x6a7a96, sun: 0xdff2ff, fog: [0.14, 0.24, 0.34], water: 0x2a6a8a, sea: [0.12, 0.34, 0.46], idx: 1 },
  desert: { name: 'DESERT', hi: 1.55, si: 1.1, sky: 0xffd0a0, ground: 0x7a5630, sun: 0xffb878, fog: [0.46, 0.22, 0.1], water: 0x2aa6a0, sea: [0.12, 0.42, 0.42], idx: 2 },
}[THEME_ID];
export const SEA = -0.35;
/** Beyond this much water you cannot wade any deeper. */
export const DEEP = 1.35;

export interface Poi {
  name: string;
  x: number;
  z: number;
  /** How close you have to be for the game to say you are "at" it. */
  r: number;
  kind: string;
  /** The colour of its name on the map. */
  color: string;
}

const FOREST_POIS: Poi[] = [
  { name: 'Pee-nacle Peak', x: 36, z: -44, r: 24, kind: 'peak', color: '#ff5aa5' },
  { name: 'Soggy Bottom', x: -42, z: -40, r: 20, kind: 'lake', color: '#1a8ad0' },
  { name: 'Stonehedge', x: 0, z: 0, r: 16, kind: 'stones', color: '#7a5aa8' },
  { name: 'Tinkle Town', x: 42, z: 22, r: 18, kind: 'village', color: '#d08a00' },
  { name: 'Gnome Depot', x: -40, z: 10, r: 17, kind: 'depot', color: '#e0701a' },
  { name: 'Chili Fields', x: 6, z: 50, r: 18, kind: 'farm', color: '#d02a2a' },
  { name: 'Puddle Pond', x: -50, z: 52, r: 14, kind: 'pond', color: '#1a8ad0' },
  { name: 'Dribble Falls', x: 54, z: -20, r: 14, kind: 'falls', color: '#2a9ad8' },
  { name: 'Sunbathing Shores', x: -8, z: -67, r: 16, kind: 'beach', color: '#d09a2a' },
  { name: 'Ice Wee Glacier', x: -62, z: -6, r: 16, kind: 'glacier', color: '#3ab0d8' },
  { name: 'Acid Swamp', x: -10, z: -48, r: 14, kind: 'swamp', color: '#4aa81a' },
  { name: 'Wee Woods', x: 22, z: 62, r: 20, kind: 'woods', color: '#2a9a1a' },
];

const ICE_POIS: Poi[] = [
  { name: 'Pee-cicle Peak', x: -30, z: -46, r: 22, kind: 'peak', color: '#7ae8ff' },
  { name: 'Frozen Lake Wee-ter', x: 30, z: -36, r: 18, kind: 'rink', color: '#2a9ad8' },
  { name: 'Igloo Village', x: 42, z: 18, r: 18, kind: 'village', color: '#d08a00' },
  { name: 'Snowman Square', x: 0, z: 0, r: 16, kind: 'snowmen', color: '#aab8d0' },
  { name: 'Yellow Snow Lodge', x: -42, z: 14, r: 16, kind: 'lodge', color: '#e0c020' },
  { name: 'Ice Wee Castle', x: 4, z: 52, r: 18, kind: 'castle', color: '#7a5aff' },
  { name: 'Slush Pond', x: -52, z: 48, r: 13, kind: 'pond', color: '#1a8ad0' },
  { name: 'Brr-muda Cave', x: 56, z: -14, r: 13, kind: 'cave', color: '#9a5aa8' },
  { name: 'Penguin Point', x: -8, z: -66, r: 15, kind: 'penguins', color: '#e0e8f0' },
  { name: 'Glacier Gulch', x: -62, z: -4, r: 16, kind: 'glacier', color: '#3ab0d8' },
  { name: 'Blizzard Bay', x: 48, z: 40, r: 14, kind: 'lighthouse', color: '#ff5a5a' },
  { name: 'Frozen Fountain', x: -16, z: -18, r: 12, kind: 'fountain', color: '#5ae8d8' },
];
const DESERT_POIS: Poi[] = [
  { name: 'Pee-ramid', x: 0, z: 0, r: 18, kind: 'pyramid', color: '#e0b030' },
  { name: 'Tinkle Bazaar', x: 42, z: 20, r: 17, kind: 'bazaar', color: '#d02a6a' },
  { name: 'Oasis Wee-sis', x: -36, z: 30, r: 16, kind: 'oasis', color: '#2aa8c8' },
  { name: 'Cactus Gulch', x: -8, z: -52, r: 18, kind: 'cacti', color: '#3aa83a' },
  { name: 'Mesa Wee-sa', x: 40, z: -40, r: 20, kind: 'mesa', color: '#d0602a' },
  { name: 'Bone Yard', x: -50, z: -26, r: 16, kind: 'bones', color: '#e0e0d0' },
  { name: 'Pump Jack Plains', x: -46, z: 4, r: 15, kind: 'derrick', color: '#aa7a2a' },
  { name: 'Camel Camp', x: 10, z: 50, r: 16, kind: 'camp', color: '#c0803a' },
  { name: 'Scorpion Pit', x: 58, z: -6, r: 13, kind: 'pit', color: '#a02ad0' },
  { name: 'Sphinx of Pee', x: -20, z: -14, r: 12, kind: 'sphinx', color: '#e0a02a' },
  { name: 'Sandstorm Bay', x: -6, z: -64, r: 14, kind: 'beach', color: '#e0c02a' },
  { name: 'Dry Wee-ver', x: 20, z: 8, r: 12, kind: 'canyon', color: '#c05a2a' },
];
const RAW_POIS: Poi[] = ICE ? ICE_POIS : DESERT ? DESERT_POIS : FOREST_POIS;

export const POIS: Poi[] = RAW_POIS.map((p) => ({ ...p, x: p.x * K, z: p.z * K, r: p.r * K }));

interface Blob { x: number; z: number; r: number; h: number; ice?: boolean }
const FOREST_HILLS: Blob[] = [
  { x: 36, z: -44, r: 22, h: 15 }, // Pee-nacle Peak
  { x: -62, z: -6, r: 14, h: 11 }, // Ice Wee Glacier
  { x: -20, z: 40, r: 12, h: 4 },
  { x: 60, z: 46, r: 12, h: 5 },
  { x: -26, z: -20, r: 10, h: 3.5 },
  { x: 12, z: -26, r: 11, h: 3 },
  { x: 26, z: 66, r: 13, h: 3 },
];
const FOREST_LAKES: Blob[] = [
  { x: -42, z: -40, r: 16, h: 4.6 }, // Soggy Bottom
  { x: -50, z: 52, r: 9, h: 3.1 }, // Puddle Pond
  { x: -10, z: -48, r: 8, h: 3.1 }, // Acid Swamp
  { x: 6, z: -58, r: 6, h: 3.1 },
  { x: -18, z: -42, r: 5, h: 3 },
];
/** The acid pools: green water over the lake floors of the swamp. */
const FOREST_POOLS = [
  { x: -10, z: -48, r: 7.2 },
  { x: 6, z: -58, r: 5.2 },
  { x: -18, z: -42, r: 4.2 },
];
const RIVER_PTS: readonly (readonly [number, number])[] = ICE
  ? [[16, 30], [24, 14], [22, -6], [28, -22]]
  : DESERT
    ? [[36, -24], [28, -8], [20, 8], [22, 26], [30, 42]]
    : [[52, -22], [58, -10], [64, 4], [72, 14], [86, 22]];
const RIVER = RIVER_PTS.map(([x, z]) => [x * K, z * K] as const);
const RIVER_W = 3.4;
interface Pad { x: number; z: number; r: number; y: number }
const FOREST_PADS: Pad[] = [
  { x: 0, z: 0, r: 15, y: 1.9 }, // Stonehedge
  { x: 42, z: 22, r: 17, y: 1.5 }, // Tinkle Town
  { x: -40, z: 10, r: 15, y: 1.8 }, // Gnome Depot
  { x: 6, z: 50, r: 17, y: 1.3 }, // Chili Fields
  { x: 36, z: -44, r: 5, y: 16.3 }, // the summit
  { x: -42, z: -40, r: 4.2, y: 0.7 }, // the island in Soggy Bottom
];

const ICE_HILLS: Blob[] = [
  { x: -30, z: -46, r: 22, h: 14 }, { x: -62, z: -4, r: 14, h: 11 }, { x: -20, z: 40, r: 12, h: 4 }, { x: 26, z: -8, r: 10, h: 3 },
  { x: 62, z: 30, r: 10, h: 3 }, { x: -44, z: -22, r: 9, h: 3.5 },
];
const ICE_LAKES: Blob[] = [{ x: 30, z: -36, r: 17, h: 0, ice: true }, { x: -52, z: 48, r: 9, h: 3.1 }];
const ICE_PADS: Pad[] = [
  { x: -30, z: -46, r: 5, y: 15.6 }, { x: 0, z: 0, r: 14, y: 1.9 }, { x: 42, z: 18, r: 16, y: 1.6 }, { x: -42, z: 14, r: 14, y: 1.8 },
  { x: 4, z: 52, r: 16, y: 1.5 }, { x: -16, z: -18, r: 8, y: 1.6 }, { x: 48, z: 40, r: 6, y: 1.4 },
];
const DESERT_HILLS: Blob[] = [
  { x: 58, z: -6, r: 10, h: -1.8 }, { x: -50, z: -26, r: 12, h: 2.5 }, { x: 24, z: -10, r: 14, h: 2.4 }, { x: -20, z: 56, r: 12, h: 3 },
  { x: 60, z: 44, r: 12, h: 2.5 },
];
const DESERT_LAKES: Blob[] = [{ x: -36, z: 30, r: 15, h: 3.6 }];
const DESERT_PADS: Pad[] = [
  { x: 0, z: 0, r: 17, y: 2.2 }, { x: 42, z: 20, r: 16, y: 1.8 }, { x: 40, z: -40, r: 15, y: 8.6 }, { x: -46, z: 4, r: 14, y: 2 },
  { x: 10, z: 50, r: 15, y: 1.8 }, { x: -20, z: -14, r: 11, y: 2 },
];
const RAW_HILLS: Blob[] = ICE ? ICE_HILLS : DESERT ? DESERT_HILLS : FOREST_HILLS;
const RAW_LAKES: Blob[] = ICE ? ICE_LAKES : DESERT ? DESERT_LAKES : FOREST_LAKES;
const RAW_POOLS = ICE || DESERT ? [] : FOREST_POOLS;
const RAW_PADS: Pad[] = ICE ? ICE_PADS : DESERT ? DESERT_PADS : FOREST_PADS;

const HILLS: Blob[] = RAW_HILLS.map((b) => ({ x: b.x * K, z: b.z * K, r: b.r * K, h: b.h }));
const LAKES: Blob[] = RAW_LAKES.map((b) => ({ x: b.x * K, z: b.z * K, r: b.r * K, h: b.h, ice: b.ice }));
export const ACID_POOLS = RAW_POOLS.map((p) => ({ x: p.x * K, z: p.z * K, r: p.r * K }));
const PADS: Pad[] = RAW_PADS.map((p) => ({ x: p.x * K, z: p.z * K, r: p.r * K, y: p.y }));

function hash(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function vnoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
}
/** Roughly -0.5 .. 0.5 */
function fbm(x: number, z: number): number {
  return vnoise(x, z) * 0.6 + vnoise(x * 2.1 + 7, z * 2.1 + 3) * 0.3 + vnoise(x * 4.3 + 1, z * 4.3 + 9) * 0.1 - 0.5;
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/** The real height of the ground at a point (slow; the game uses the sampled grid below). */
function rawHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  // an island: land inside about 72 units, sea beyond
  let h = 2.2 - smooth(58 * K, 86 * K, r + 9 * fbm(x * 0.034, z * 0.034)) * 7.6;
  h += fbm(x * 0.03, z * 0.03) * 1.7;
  for (const b of HILLS) {
    const d2 = (x - b.x) ** 2 + (z - b.z) ** 2;
    h += b.h * Math.exp(-d2 / (b.r * b.r));
  }
  if (DESERT) h += 1.5 * Math.sin(x * 0.085 + 1.4 * Math.sin(z * 0.05)) * Math.cos(z * 0.07 + 0.8 * Math.sin(x * 0.04)); // rolling dunes
  for (const b of LAKES) {
    const d = Math.hypot(x - b.x, z - b.z) / b.r;
    if (b.ice) h += (0.14 - h) * (1 - smooth(0.8, 1.0, d)); // a flat frozen sheet you can walk on
    else h -= b.h * (1 - smooth(0.0, 1.0, d));
  }
  // the river, with soft banks
  for (let i = 0; i < RIVER.length - 1; i++) {
    const d = distToSegment(x, z, RIVER[i][0], RIVER[i][1], RIVER[i + 1][0], RIVER[i + 1][1]);
    const w = 1 - smooth(RIVER_W * 0.6, RIVER_W * 1.9, d);
    if (w > 0) h = h + ((ICE ? 0.14 : DESERT ? Math.min(h, 0.25) : Math.min(h, -1.0)) - h) * w; // water, ice, or a dry bed
  }
  // flat places for buildings
  for (const p of PADS) {
    const d = Math.hypot(x - p.x, z - p.z);
    const w = 1 - smooth(p.r * (DESERT && p.y > 5 ? 0.55 : 0.75), p.r, d);
    if (w > 0) h = h + (p.y - h) * w;
  }
  return h;
}

// --- a sampled copy: runtime lookups are a bilinear read, not 30 exponentials ------------------------------------

const EXT = 150; // grid covers -EXT..EXT
const STEP = 1;
const N = Math.round((2 * EXT) / STEP) + 1;
const grid = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) grid[j * N + i] = rawHeight(-EXT + i * STEP, -EXT + j * STEP);

/** Height of the ground at (x, z), in world units. */
export function heightAt(x: number, z: number): number {
  const gx = (x + EXT) / STEP;
  const gz = (z + EXT) / STEP;
  if (gx < 0 || gz < 0 || gx >= N - 1 || gz >= N - 1) return -6;
  const i = Math.floor(gx), j = Math.floor(gz);
  const fx = gx - i, fz = gz - j;
  const a = grid[j * N + i], b = grid[j * N + i + 1], c = grid[(j + 1) * N + i], d = grid[(j + 1) * N + i + 1];
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Where a droplet or a puddle lands: the ground, or the water's surface. */
export function surfaceAt(x: number, z: number): number {
  return Math.max(heightAt(x, z), SEA);
}

/** How deep the water is here (0 on dry land). */
export function waterDepth(x: number, z: number): number {
  return Math.max(0, SEA - heightAt(x, z));
}

export function isLand(x: number, z: number, minH = 0.3): boolean {
  return heightAt(x, z) > minH;
}

/** Which named place (if any) this point is in. */
export function poiAt(x: number, z: number): Poi | null {
  let best: Poi | null = null;
  let bd = Infinity;
  for (const p of POIS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r && d < bd) { bd = d; best = p; }
  }
  return best;
}

/** The nearest dry spot to (x, z), for placing things that must not be in the sea. */
export function landNear(x: number, z: number, minH = 0.6): { x: number; z: number } {
  if (heightAt(x, z) > minH) return { x, z };
  for (let r = 2; r < 120; r += 2) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      if (heightAt(px, pz) > minH) return { x: px, z: pz };
    }
  }
  return { x: 0, z: 0 };
}

/** Is this a slippery frozen lake or river? (only on the ice map) */
export function iceAt(x: number, z: number): boolean {
  if (!ICE) return false;
  for (const b of LAKES) if (b.ice && Math.hypot(x - b.x, z - b.z) < b.r * 0.92) return true;
  if (heightAt(x, z) > 0.6) return false;
  for (let i = 0; i < RIVER.length - 1; i++) if (distToSegment(x, z, RIVER[i][0], RIVER[i][1], RIVER[i + 1][0], RIVER[i + 1][1]) < RIVER_W * 1.1) return true;
  return false;
}

function groundColorIce(x: number, z: number, h: number, out: [number, number, number]) {
  const n = fbm(x * 0.12, z * 0.12) + 0.5;
  let r = 0.4 + n * 0.07, g = 0.5 + n * 0.07, b = 0.64 + n * 0.06; // blue-white snow
  if (h < 0.7) { const w = smooth(0.7, -0.3, h); r += (0.34 - r) * w; g += (0.42 - g) * w; b += (0.52 - b) * w; } // slush at the water
  if (h < SEA) { const w = smooth(SEA, -2.5, h); r += (0.06 - r) * w; g += (0.14 - g) * w; b += (0.22 - b) * w; }
  if (h > 8) { const w = smooth(8, 11, h); r += (0.36 - r) * w; g += (0.4 - g) * w; b += (0.5 - b) * w; } // bare cold rock
  if (h > 12.5) { const w = smooth(12.5, 14.5, h); r += (0.78 - r) * w; g += (0.84 - g) * w; b += (0.92 - b) * w; }
  // the frozen lakes and river: glassy blue
  let ice = 0;
  for (const bl of LAKES) if (bl.ice) ice = Math.max(ice, 1 - smooth(bl.r * 0.8, bl.r * 1.0, Math.hypot(x - bl.x, z - bl.z)));
  for (let i = 0; i < RIVER.length - 1; i++) ice = Math.max(ice, 1 - smooth(RIVER_W * 0.6, RIVER_W * 1.5, distToSegment(x, z, RIVER[i][0], RIVER[i][1], RIVER[i + 1][0], RIVER[i + 1][1])));
  if (ice > 0 && h > SEA) { const k = ice * (0.8 + 0.2 * Math.sin(x * 0.7 + z * 0.4)); r += (0.22 - r) * k; g += (0.58 - g) * k; b += (0.78 - b) * k; }
  out[0] = r; out[1] = g; out[2] = b;
}

function groundColorDesert(x: number, z: number, h: number, out: [number, number, number]) {
  const n = fbm(x * 0.1, z * 0.1) + 0.5;
  let r = 0.6 + n * 0.08, g = 0.43 + n * 0.06, b = 0.23 + n * 0.04; // sand
  const ripple = 0.5 + 0.5 * Math.sin(x * 0.9 + Math.sin(z * 0.35) * 2);
  r *= 0.94 + ripple * 0.08; g *= 0.94 + ripple * 0.08;
  // red rock strata on the mesa and the high ground
  if (h > 3) {
    const band = 0.5 + 0.5 * Math.sin(h * 3.1);
    const w = smooth(3, 5.5, h);
    r += (0.54 + band * 0.1 - r) * w; g += (0.22 + band * 0.07 - g) * w; b += (0.12 - b) * w;
  }
  // the oasis is green
  const oa = POIS.find((p) => p.kind === 'oasis');
  if (oa) { const w = (1 - smooth(oa.r * 0.5, oa.r * 1.3, Math.hypot(x - oa.x, z - oa.z))) * smooth(-0.6, 0.6, h); r += (0.16 - r) * w; g += (0.4 - g) * w; b += (0.14 - b) * w; }
  // damp sand at the water, and the sea bed
  if (h < 0.5) { const w = smooth(0.5, -0.3, h); r += (0.4 - r) * w; g += (0.3 - g) * w; b += (0.18 - b) * w; }
  if (h < SEA) { const w = smooth(SEA, -2.5, h); r += (0.1 - r) * w; g += (0.3 - g) * w; b += (0.3 - b) * w; }
  out[0] = r; out[1] = g; out[2] = b;
}

/** A colour for the ground, as [r, g, b] 0..1: sand by the water, grass, bare rock up high, snow on the tops. */
export function groundColor(x: number, z: number, h: number, out: [number, number, number]) {
  if (ICE) return groundColorIce(x, z, h, out);
  if (DESERT) return groundColorDesert(x, z, h, out);
  const n = fbm(x * 0.12, z * 0.12) + 0.5; // 0..1 patchiness
  let r = 0.15 + n * 0.07, g = 0.27 - n * 0.06, b = 0.15 + n * 0.05; // mossy night grass
  // soil and crops
  const farm = Math.hypot(x - 6 * K, z - 50 * K);
  if (farm < 15 * K) {
    const row = 0.5 + 0.5 * Math.sin(z * 1.3);
    r = 0.26 + row * 0.07; g = 0.18 + row * 0.05; b = 0.12;
  }
  // the swamp
  const swamp = Math.hypot(x + 6 * K, z + 50 * K);
  if (swamp < 16 * K) { const w = 1 - smooth(8 * K, 16 * K, swamp); r += (0.14 - r) * w; g += (0.24 - g) * w * 0.6; b += (0.1 - b) * w; }
  // muddy sand by the water, bare rock and snow up high
  if (h < 0.7) { const w = smooth(0.7, -0.3, h); r += (0.42 - r) * w; g += (0.36 - g) * w; b += (0.26 - b) * w; }
  if (h < SEA) { const w = smooth(SEA, -2.5, h); r += (0.08 - r) * w; g += (0.16 - g) * w; b += (0.2 - b) * w; } // the sea bed
  if (h > 7) { const w = smooth(7, 10.5, h); r += (0.3 - r) * w; g += (0.3 - g) * w; b += (0.34 - b) * w; }
  if (h > 13) { const w = smooth(13, 15, h); r += (0.66 - r) * w; g += (0.68 - g) * w; b += (0.74 - b) * w; }
  // the glacier is dull ice
  const ice = Math.hypot(x + 62 * K, z + 6 * K);
  if (ice < 17 * K && h > 1.5) { const w = (1 - smooth(8 * K, 17 * K, ice)) * smooth(1.5, 4, h); r += (0.46 - r) * w; g += (0.58 - g) * w; b += (0.66 - b) * w; }
  out[0] = r; out[1] = g; out[2] = b;
}

/** A picture of the island from above (for the minimap and the big map): water, shaded land, sand, snow. */
export function renderTerrainImage(size: number, half: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const span = 2 * half + 6;
  const col: [number, number, number] = [0, 0, 0];
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = -half - 3 + ((i + 0.5) / size) * span;
      const z = -half - 3 + ((j + 0.5) / size) * span;
      const h = heightAt(x, z);
      let r: number, g: number, b: number;
      if (h < SEA) {
        const d = smooth(0, 3, SEA - h);
        r = THEME.sea[0] - 0.06 * d; g = THEME.sea[1] - 0.12 * d; b = THEME.sea[2] - 0.14 * d;
      } else {
        groundColor(x, z, h, col);
        // a little hill-shading so the hills read as hills
        const shade = 1 + 0.35 * (heightAt(x - 1.5, z - 1.5) - heightAt(x + 1.5, z + 1.5));
        const k = Math.max(0.65, Math.min(1.3, shade));
        r = col[0] * k; g = col[1] * k; b = col[2] * k;
      }
      const o = (j * size + i) * 4;
      img.data[o] = Math.min(255, r * 255);
      img.data[o + 1] = Math.min(255, g * 255);
      img.data[o + 2] = Math.min(255, b * 255);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
