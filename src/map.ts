/**
 * The island: its shape, hills, lakes, river and the named places on it. Everything is a plain function of (x, z), so the
 * terrain mesh, the colliders, the minimap, the bots and the droplets all agree about where the ground and the water are.
 */

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

export const POIS: Poi[] = [
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

interface Blob { x: number; z: number; r: number; h: number }
const HILLS: Blob[] = [
  { x: 36, z: -44, r: 22, h: 15 }, // Pee-nacle Peak
  { x: -62, z: -6, r: 14, h: 11 }, // Ice Wee Glacier
  { x: -20, z: 40, r: 12, h: 4 },
  { x: 60, z: 46, r: 12, h: 5 },
  { x: -26, z: -20, r: 10, h: 3.5 },
  { x: 12, z: -26, r: 11, h: 3 },
  { x: 26, z: 66, r: 13, h: 3 },
];
const LAKES: Blob[] = [
  { x: -42, z: -40, r: 16, h: 4.6 }, // Soggy Bottom
  { x: -50, z: 52, r: 9, h: 3.1 }, // Puddle Pond
  { x: -10, z: -48, r: 8, h: 3.1 }, // Acid Swamp
  { x: 6, z: -58, r: 6, h: 3.1 },
  { x: -18, z: -42, r: 5, h: 3 },
];
/** The acid pools: green water over the lake floors of the swamp. */
export const ACID_POOLS = [
  { x: -10, z: -48, r: 7.2 },
  { x: 6, z: -58, r: 5.2 },
  { x: -18, z: -42, r: 4.2 },
];
const RIVER = [[52, -22], [58, -10], [64, 4], [72, 14], [86, 22]] as const;
const RIVER_W = 2.8;
interface Pad { x: number; z: number; r: number; y: number }
const PADS: Pad[] = [
  { x: 0, z: 0, r: 15, y: 1.9 }, // Stonehedge
  { x: 42, z: 22, r: 17, y: 1.5 }, // Tinkle Town
  { x: -40, z: 10, r: 15, y: 1.8 }, // Gnome Depot
  { x: 6, z: 50, r: 17, y: 1.3 }, // Chili Fields
  { x: 36, z: -44, r: 5, y: 16.3 }, // the summit
  { x: -42, z: -40, r: 4.2, y: 0.7 }, // the island in Soggy Bottom
];

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
  let h = 2.2 - smooth(58, 86, r + 6 * fbm(x * 0.05, z * 0.05)) * 7.6;
  h += fbm(x * 0.045, z * 0.045) * 1.6;
  for (const b of HILLS) {
    const d2 = (x - b.x) ** 2 + (z - b.z) ** 2;
    h += b.h * Math.exp(-d2 / (b.r * b.r));
  }
  for (const b of LAKES) {
    const d = Math.hypot(x - b.x, z - b.z) / b.r;
    h -= b.h * (1 - smooth(0.0, 1.0, d));
  }
  // the river, with soft banks
  for (let i = 0; i < RIVER.length - 1; i++) {
    const d = distToSegment(x, z, RIVER[i][0], RIVER[i][1], RIVER[i + 1][0], RIVER[i + 1][1]);
    const w = 1 - smooth(RIVER_W * 0.6, RIVER_W * 1.9, d);
    if (w > 0) h = h + (Math.min(h, -1.0) - h) * w;
  }
  // flat places for buildings
  for (const p of PADS) {
    const d = Math.hypot(x - p.x, z - p.z);
    const w = 1 - smooth(p.r * 0.75, p.r, d);
    if (w > 0) h = h + (p.y - h) * w;
  }
  return h;
}

// --- a sampled copy: runtime lookups are a bilinear read, not 30 exponentials ------------------------------------

const EXT = 100; // grid covers -EXT..EXT
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
  for (let r = 2; r < 80; r += 2) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      if (heightAt(px, pz) > minH) return { x: px, z: pz };
    }
  }
  return { x: 0, z: 0 };
}

/** A colour for the ground, as [r, g, b] 0..1: sand by the water, grass, bare rock up high, snow on the tops. */
export function groundColor(x: number, z: number, h: number, out: [number, number, number]) {
  const n = fbm(x * 0.12, z * 0.12) + 0.5; // 0..1 patchiness
  let r = 0.15 + n * 0.07, g = 0.27 - n * 0.06, b = 0.15 + n * 0.05; // mossy night grass
  // soil and crops
  const farm = Math.hypot(x - 6, z - 50);
  if (farm < 15) {
    const row = 0.5 + 0.5 * Math.sin(z * 1.3);
    r = 0.26 + row * 0.07; g = 0.18 + row * 0.05; b = 0.12;
  }
  // the swamp
  const swamp = Math.hypot(x + 6, z + 50);
  if (swamp < 16) { const w = 1 - smooth(8, 16, swamp); r += (0.14 - r) * w; g += (0.24 - g) * w * 0.6; b += (0.1 - b) * w; }
  // muddy sand by the water, bare rock and snow up high
  if (h < 0.7) { const w = smooth(0.7, -0.3, h); r += (0.42 - r) * w; g += (0.36 - g) * w; b += (0.26 - b) * w; }
  if (h < SEA) { const w = smooth(SEA, -2.5, h); r += (0.08 - r) * w; g += (0.16 - g) * w; b += (0.2 - b) * w; } // the sea bed
  if (h > 7) { const w = smooth(7, 10.5, h); r += (0.3 - r) * w; g += (0.3 - g) * w; b += (0.34 - b) * w; }
  if (h > 13) { const w = smooth(13, 15, h); r += (0.66 - r) * w; g += (0.68 - g) * w; b += (0.74 - b) * w; }
  // the glacier is dull ice
  const ice = Math.hypot(x + 62, z + 6);
  if (ice < 17 && h > 1.5) { const w = (1 - smooth(8, 17, ice)) * smooth(1.5, 4, h); r += (0.46 - r) * w; g += (0.58 - g) * w; b += (0.66 - b) * w; }
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
        r = 0.1 - 0.06 * d; g = 0.24 - 0.12 * d; b = 0.32 - 0.14 * d;
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
