import * as THREE from 'three';
import { SoftBox, lit, makePaintTexture } from './organic';

/** Half the side of the (small, square) forest. */
export const HALF = 38;

interface Solid {
  /** circle: x,z,r. rect: x0,z0,x1,z1 */
  rect: boolean;
  a: number; b: number; c: number; d: number;
  h: number;
}

interface Part {
  m: THREE.InstancedMesh;
  i: number;
  x: number; y: number; z: number;
  sx: number; sy: number; sz: number;
  ry: number;
}

interface Canopy {
  x: number;
  z: number;
  fade: number;
  parts: Part[];
}

// deterministic layout so every round is in the same forest
let seed = 777123;
function rnd(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a: number, b: number) => a + rnd() * (b - a);
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];

const dummy = new THREE.Object3D();
const tmpC = new THREE.Color();

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, count: number): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.frustumCulled = false;
  return m;
}

function put(m: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, color?: number) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, ry, 0);
  dummy.scale.set(sx, sy, sz);
  dummy.updateMatrix();
  m.setMatrixAt(i, dummy.matrix);
  if (color !== undefined) m.setColorAt(i, tmpC.setHex(color));
}

/** The small enchanted forest: scenery, plus the solid things gnomes and pee bump into. */
export class Forest {
  readonly group = new THREE.Group();
  readonly spawns: THREE.Vector3[] = [];

  private solids: Solid[] = [];
  private readonly cell = 4;
  private readonly nx: number;
  private grid: Solid[][];
  private canopies: Canopy[] = [];
  private flies: THREE.InstancedMesh;
  private flyBase: { x: number; y: number; z: number; p: number }[] = [];

  constructor() {
    this.nx = Math.ceil((2 * HALF) / this.cell) + 4;
    this.grid = Array.from({ length: this.nx * this.nx }, () => []);

    // ten spawn points on a ring, so nobody starts on top of anybody
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + 0.31;
      this.spawns.push(new THREE.Vector3(Math.cos(a) * 25, 0, Math.sin(a) * 25));
    }
    const keepClear: { x: number; z: number; r: number }[] = [
      ...this.spawns.map((s) => ({ x: s.x, z: s.z, r: 4 })),
      { x: 0, z: 0, r: 8 },
      { x: -21, z: 19, r: 11 }, // the pond
    ];
    const clear = (x: number, z: number, pad = 0) => keepClear.every((k) => Math.hypot(x - k.x, z - k.z) > k.r + pad);

    // --- ground -----------------------------------------------------------------------
    const gtex = makePaintTexture(205, 16);
    gtex.repeat.set(90, 90);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), lit({ color: 0x7ee05a, map: gtex }));
    ground.rotation.x = -Math.PI / 2;
    this.group.add(ground);

    const patchCount = 40;
    const patches = instanced(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }), patchCount);
    for (let i = 0; i < patchCount; i++) {
      put(patches, i, between(-HALF + 4, HALF - 4), 0.03, between(-HALF + 4, HALF - 4), between(2.5, 8), 1, between(2.5, 8), rnd() * 3, pick([0xffffff, 0xffe066, 0xff9ad0, 0x9ae0ff]));
    }
    this.group.add(patches);

    // --- the thorn wall: spikes all round the edge (the clamp keeps everyone inside) -----
    const thornN = 4 * 44;
    const thorns = instanced(new THREE.ConeGeometry(0.5, 1, 5), lit({ color: 0xffffff, flatShading: true }), thornN);
    let ti = 0;
    for (let side = 0; side < 4; side++) {
      for (let k = 0; k < 44; k++) {
        const t = -HALF - 2 + (k / 43) * (2 * HALF + 4) + between(-0.4, 0.4);
        const off = HALF + 1.6 + between(0, 1.6);
        const [x, z] = side === 0 ? [t, -off] : side === 1 ? [t, off] : side === 2 ? [-off, t] : [off, t];
        const h = between(5, 9);
        put(thorns, ti++, x, h / 2, z, between(1.6, 2.6), h, between(1.6, 2.6), rnd() * 3, pick([0xff7ab8, 0xffd34a, 0x6ad4ff, 0xa0e060, 0xb08aff]));
      }
    }
    this.group.add(thorns);

    // --- trees: trunk + two leafy tiers (the tiers shrink away from whoever is under them) ---
    const placed: { x: number; z: number }[] = [];
    const spaced = (x: number, z: number, d: number) => placed.every((p) => Math.hypot(p.x - x, p.z - z) >= d);
    interface TreeSpec { x: number; z: number; h: number; w: number; s: number; col: number }
    const trees: TreeSpec[] = [];
    for (let attempt = 0; attempt < 3000 && trees.length < 105; attempt++) {
      const x = between(-HALF + 3, HALF - 3);
      const z = between(-HALF + 3, HALF - 3);
      if (!clear(x, z) || !spaced(x, z, 3.6)) continue;
      const big = rnd() < 0.15;
      trees.push({
        x, z,
        h: big ? between(6.5, 8.5) : between(3.6, 5.4),
        w: big ? between(1.3, 1.7) : between(0.7, 1),
        s: big ? between(1.35, 1.6) : between(0.75, 1.05),
        col: pick([0xff7ab8, 0xffd34a, 0x6ad4ff, 0x8ae04a, 0xb08aff, 0xff9a4a]),
      });
      placed.push({ x, z });
    }
    const trunks = instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, 6), lit({ color: 0xffffff }), trees.length);
    const tiers = [0, 1].map(() => instanced(new THREE.IcosahedronGeometry(0.62, 0), lit({ color: 0xffffff, flatShading: true }), trees.length));
    trees.forEach((t, i) => {
      put(trunks, i, t.x, t.h / 2, t.z, t.w, t.h, t.w, 0, pick([0xc08a5a, 0xb07848, 0xd09a6a]));
      const canopy: Canopy = { x: t.x, z: t.z, fade: 0, parts: [] };
      for (let l = 0; l < 2; l++) {
        const width = 4.2 * t.s * (1 - l * 0.34);
        const hh = 2.4 * t.s;
        const p: Part = { m: tiers[l], i, x: t.x, y: t.h - 0.9 * t.s + l * 1.7 * t.s + hh / 2, z: t.z, sx: width, sy: hh, sz: width, ry: 0.3 * l };
        put(p.m, i, p.x, p.y, p.z, p.sx, p.sy, p.sz, p.ry, t.col);
        canopy.parts.push(p);
      }
      this.canopies.push(canopy);
      this.addCircle(t.x, t.z, t.w * 0.5 + 0.1, t.h);
    });
    this.group.add(trunks, ...tiers);

    // --- giant mushrooms: solid stem, big cap that also shrinks away from you --------------
    const giants: { x: number; z: number; s: number; col: number }[] = [];
    for (let attempt = 0; attempt < 600 && giants.length < 12; attempt++) {
      const x = between(-HALF + 5, HALF - 5);
      const z = between(-HALF + 5, HALF - 5);
      if (!clear(x, z, 1.5) || !spaced(x, z, 5.5)) continue;
      giants.push({ x, z, s: between(0.9, 1.3), col: pick([0xff4a6a, 0xffb02a, 0x6a8aff, 0xb06aff]) });
      placed.push({ x, z });
    }
    const gStem = instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, 8), lit({ color: 0xf0e4d2 }), giants.length);
    const gCap = instanced(new THREE.ConeGeometry(0.62, 1, 10), lit({ color: 0xffffff, flatShading: true }), giants.length);
    giants.forEach((g, i) => {
      const sw = 1.5 * g.s;
      const sh = 3.6 * g.s;
      put(gStem, i, g.x, sh / 2, g.z, sw, sh, sw);
      const cw = 5.4 * g.s;
      const canopy: Canopy = { x: g.x, z: g.z, fade: 0, parts: [] };
      const p: Part = { m: gCap, i, x: g.x, y: sh + 0.55 * g.s, z: g.z, sx: cw, sy: 1.3 * g.s, sz: cw, ry: 0 };
      put(p.m, i, p.x, p.y, p.z, p.sx, p.sy, p.sz, 0, g.col);
      canopy.parts.push(p);
      this.canopies.push(canopy);
      this.addCircle(g.x, g.z, sw * 0.5 + 0.1, sh);
    });
    this.group.add(gStem, gCap);

    // --- rocks and fallen logs: low cover --------------------------------------------------
    const rockList: { x: number; z: number; w: number; h: number }[] = [];
    for (let attempt = 0; attempt < 400 && rockList.length < 26; attempt++) {
      const x = between(-HALF + 4, HALF - 4);
      const z = between(-HALF + 4, HALF - 4);
      if (!clear(x, z, 0.5) || !spaced(x, z, 3)) continue;
      rockList.push({ x, z, w: between(1.8, 3.2), h: between(1.1, 2) });
      placed.push({ x, z });
    }
    const rocks = instanced(new THREE.IcosahedronGeometry(0.6, 0), lit({ color: 0xffffff, flatShading: true }), rockList.length);
    rockList.forEach((r, i) => {
      put(rocks, i, r.x, r.h / 2.4, r.z, r.w, r.h, r.w, rnd() * 3, pick([0xc4ccdc, 0xaab6cc, 0xd4dcec]));
      this.addCircle(r.x, r.z, r.w * 0.5, r.h * 0.9);
    });
    this.group.add(rocks);

    const logList: { x: number; z: number; w: number; d: number }[] = [];
    for (let attempt = 0; attempt < 400 && logList.length < 16; attempt++) {
      const x = between(-HALF + 6, HALF - 6);
      const z = between(-HALF + 6, HALF - 6);
      if (!clear(x, z, 1) || !spaced(x, z, 4.2)) continue;
      const alongX = rnd() < 0.5;
      logList.push({ x, z, w: alongX ? between(5, 7.5) : 1.3, d: alongX ? 1.3 : between(5, 7.5) });
      placed.push({ x, z });
    }
    const logs = instanced(new SoftBox(1, 1, 1), lit({ color: 0xffffff }), logList.length);
    logList.forEach((l, i) => {
      put(logs, i, l.x, 0.5, l.z, l.w, 1, l.d, 0, pick([0xc9824a, 0xd89a5a]));
      this.addRect(l.x - l.w / 2, l.z - l.d / 2, l.x + l.w / 2, l.z + l.d / 2, 1);
    });
    this.group.add(logs);

    // --- glowing little mushrooms (decor) --------------------------------------------------
    const smallN = 130;
    const stems = instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, 6), lit({ color: 0xf2e8d0 }), smallN);
    const caps = instanced(new THREE.ConeGeometry(0.62, 1, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), smallN);
    for (let i = 0; i < smallN; i++) {
      const x = between(-HALF + 2, HALF - 2);
      const z = between(-HALF + 2, HALF - 2);
      const s = between(0.7, 1.5);
      put(stems, i, x, 0.3 * s, z, 0.25 * s, 0.6 * s, 0.25 * s);
      put(caps, i, x, 0.7 * s, z, 1.0 * s, 0.4 * s, 1.0 * s, rnd() * 3, pick([0xff66b0, 0x66e6ff, 0xffe45a, 0xb08aff, 0x7aff7a]));
    }
    this.group.add(stems, caps);

    // --- the pond with lily pads (flat decor) -----------------------------------------------
    const pond = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.06, 28), new THREE.MeshBasicMaterial({ color: 0x4ab8ff, transparent: true, opacity: 0.85 }));
    pond.position.set(-21, 0.05, 19);
    this.group.add(pond);
    const lilies = instanced(new SoftBox(1, 0.05, 1), new THREE.MeshBasicMaterial({ color: 0x4acf6a }), 10);
    for (let i = 0; i < 10; i++) put(lilies, i, -21 + between(-6, 6), 0.1, 19 + between(-6, 6), between(1.1, 1.8), 1, between(1.1, 1.8), rnd() * 3);
    this.group.add(lilies);

    // --- the Old Stones in the middle: a ring of standing stones ------------------------------
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const x = Math.cos(a) * 5;
      const z = Math.sin(a) * 5;
      const h = between(3, 4.4);
      const stone = new THREE.Mesh(new SoftBox(1.3, h, 1.3), lit({ color: 0xd4d8ee, flatShading: true }));
      stone.position.set(x, h / 2, z);
      stone.rotation.y = a;
      this.group.add(stone);
      this.addCircle(x, z, 0.75, h);
    }
    const altar = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.1, 0.5, 8), lit({ color: 0xe8ecfa, flatShading: true }));
    altar.position.set(0, 0.25, 0);
    this.group.add(altar);

    // --- fireflies ------------------------------------------------------------------------------
    const flyN = 80;
    this.flies = instanced(new SoftBox(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xf6ff8a }), flyN);
    for (let i = 0; i < flyN; i++) this.flyBase.push({ x: between(-HALF, HALF), y: between(1, 5), z: between(-HALF, HALF), p: rnd() * 6 });
    this.group.add(this.flies);
  }

  // --- collision grid ------------------------------------------------------------------------------

  private ci(v: number): number {
    const c = Math.floor((v + HALF) / this.cell) + 1;
    return c < 0 ? 0 : c >= this.nx ? this.nx - 1 : c;
  }

  private register(s: Solid, x0: number, z0: number, x1: number, z1: number) {
    this.solids.push(s);
    for (let cz = this.ci(z0); cz <= this.ci(z1); cz++) for (let cx = this.ci(x0); cx <= this.ci(x1); cx++) this.grid[cz * this.nx + cx].push(s);
  }

  private addCircle(x: number, z: number, r: number, h: number) {
    this.register({ rect: false, a: x, b: z, c: r, d: 0, h }, x - r, z - r, x + r, z + r);
  }

  private addRect(x0: number, z0: number, x1: number, z1: number, h: number) {
    this.register({ rect: true, a: x0, b: z0, c: x1, d: z1, h }, x0, z0, x1, z1);
  }

  /** Push a circle at pos (x/z) out of every solid. Returns true if it bumped something. */
  collide(pos: { x: number; z: number }, radius: number): boolean {
    let hit = false;
    const x0 = this.ci(pos.x - radius), x1 = this.ci(pos.x + radius), z0 = this.ci(pos.z - radius), z1 = this.ci(pos.z + radius);
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const list = this.grid[cz * this.nx + cx];
        for (let k = 0; k < list.length; k++) {
          const s = list[k];
          if (!s.rect) {
            const dx = pos.x - s.a;
            const dz = pos.z - s.b;
            const min = s.c + radius;
            const d2 = dx * dx + dz * dz;
            if (d2 < min * min) {
              const d = Math.sqrt(d2) || 0.0001;
              pos.x = s.a + (dx / d) * min;
              pos.z = s.b + (dz / d) * min;
              hit = true;
            }
          } else {
            const nx = Math.max(s.a, Math.min(s.c, pos.x));
            const nz = Math.max(s.b, Math.min(s.d, pos.z));
            const dx = pos.x - nx;
            const dz = pos.z - nz;
            const d2 = dx * dx + dz * dz;
            if (d2 < radius * radius) {
              if (d2 > 1e-8) {
                const d = Math.sqrt(d2);
                pos.x = nx + (dx / d) * radius;
                pos.z = nz + (dz / d) * radius;
              } else {
                // centre is inside the box: leave by the nearest side
                const l = pos.x - s.a, r = s.c - pos.x, t = pos.z - s.b, b = s.d - pos.z;
                const m = Math.min(l, r, t, b);
                if (m === l) pos.x = s.a - radius;
                else if (m === r) pos.x = s.c + radius;
                else if (m === t) pos.z = s.b - radius;
                else pos.z = s.d + radius;
              }
              hit = true;
            }
          }
        }
      }
    }
    return hit;
  }

  /** Is this point of space inside something solid? (pee stops there) */
  pointHit(x: number, y: number, z: number): boolean {
    const list = this.grid[this.ci(z) * this.nx + this.ci(x)];
    for (let k = 0; k < list.length; k++) {
      const s = list[k];
      if (y > s.h) continue;
      if (s.rect) {
        if (x > s.a && x < s.c && z > s.b && z < s.d) return true;
      } else {
        const dx = x - s.a;
        const dz = z - s.b;
        if (dx * dx + dz * dz < s.c * s.c) return true;
      }
    }
    return false;
  }

  /** A random spot nobody could be stuck in. */
  randomFree(range: number): THREE.Vector3 {
    const p = { x: 0, z: 0 };
    for (let i = 0; i < 100; i++) {
      p.x = (Math.random() * 2 - 1) * range;
      p.z = (Math.random() * 2 - 1) * range;
      const q = { x: p.x, z: p.z };
      if (!this.collide(q, 0.7) || Math.hypot(q.x - p.x, q.z - p.z) < 0.01) return new THREE.Vector3(p.x, 0, p.z);
    }
    return new THREE.Vector3(0, 0, 8);
  }

  /** Leafy tiers shrink away from the point (x, z) so the gnome below stays visible. */
  update(dt: number, t: number, focusX: number, focusZ: number) {
    const touched = new Set<THREE.InstancedMesh>();
    for (const c of this.canopies) {
      const dx = c.x - focusX;
      const dz = c.z - (focusZ + 2.2); // the camera looks from the south, so those trees get in the way most
      const want = dx * dx + dz * dz < 7 * 7 ? 1 : 0;
      if (c.fade === want) continue;
      c.fade += Math.sign(want - c.fade) * Math.min(Math.abs(want - c.fade), dt * 5);
      const k = 1 - 0.85 * c.fade;
      for (const p of c.parts) {
        dummy.position.set(p.x, p.y + 0.5 * c.fade, p.z);
        dummy.rotation.set(0, p.ry, 0);
        dummy.scale.set(p.sx * k, p.sy * (1 - 0.4 * c.fade), p.sz * k);
        dummy.updateMatrix();
        p.m.setMatrixAt(p.i, dummy.matrix);
        touched.add(p.m);
      }
    }
    touched.forEach((m) => (m.instanceMatrix.needsUpdate = true));

    for (let i = 0; i < this.flyBase.length; i++) {
      const f = this.flyBase[i];
      put(this.flies, i, f.x + Math.sin(t * 0.4 + f.p) * 2.5, f.y + Math.sin(t * 0.9 + f.p * 2) * 0.8, f.z + Math.cos(t * 0.35 + f.p) * 2.5, 1, 1, 1);
    }
    this.flies.instanceMatrix.needsUpdate = true;
  }
}
