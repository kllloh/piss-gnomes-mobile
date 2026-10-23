import * as THREE from 'three';
import { SoftBox, lit, makePaintTexture } from './organic';
import { heightAt, SEA, landNear, groundColor, POIS, ACID_POOLS } from './map';

/** Half the side of the (small, square) forest. */
export const HALF = 90;

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

/** A floating name sign: a white pill with a coloured border, readable from far away. */
function makeSign(text: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const r = 52;
  ctx.beginPath();
  ctx.moveTo(r, 8);
  ctx.arcTo(504, 8, 504, 120, r);
  ctx.arcTo(504, 120, 8, 120, r);
  ctx.arcTo(8, 120, 8, 8, r);
  ctx.arcTo(8, 8, 504, 8, r);
  ctx.closePath();
  ctx.fillStyle = '#d8ccae';
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = color;
  ctx.stroke();
  let size = 58;
  ctx.font = `bold ${size}px "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif`;
  while (ctx.measureText(text).width > 440 && size > 24) { size -= 2; ctx.font = `bold ${size}px "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif`; }
  ctx.fillStyle = '#1a1214';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, transparent: true, depthWrite: false }));
  sprite.scale.set(20, 5, 1);
  sprite.renderOrder = 4;
  return sprite;
}

/** The small enchanted forest: scenery, plus the solid things gnomes and pee bump into. */
export class Forest {
  readonly group = new THREE.Group();
  readonly spawns: THREE.Vector3[] = [];

  private solids: Solid[] = [];
  /** The mushroom caps (hemispheres), for working out whether the sun is hidden behind one. */
  private capList: { x: number; z: number; base: number; r: number; h: number }[] = [];
  private readonly cell = 4;
  private readonly nx: number;
  private grid: Solid[][];
  private waterTex: THREE.CanvasTexture | null = null;
  private flies: THREE.InstancedMesh;
  private flyBase: { x: number; y: number; z: number; p: number }[] = [];

  constructor() {
    this.nx = Math.ceil((2 * HALF) / this.cell) + 4;
    this.grid = Array.from({ length: this.nx * this.nx }, () => []);

    // fifty spawn points on three rings, each moved onto dry land and kept apart
    for (const [r, count, off] of [[24, 10, 0.31], [42, 16, 0.1], [60, 24, 0.2]] as const) {
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2 + off;
        let sp = landNear(Math.cos(a) * r, Math.sin(a) * r, 0.9);
        for (let tries = 0; tries < 8 && this.spawns.some((s) => Math.hypot(s.x - sp.x, s.z - sp.z) < 6); tries++) {
          sp = landNear(sp.x + (Math.random() - 0.5) * 12, sp.z + (Math.random() - 0.5) * 12, 0.9);
        }
        this.spawns.push(new THREE.Vector3(sp.x, heightAt(sp.x, sp.z), sp.z));
      }
    }
    // places that keep their buildings to themselves
    const keepClear: { x: number; z: number; r: number }[] = [
      ...this.spawns.map((s) => ({ x: s.x, z: s.z, r: 4 })),
      { x: 0, z: 0, r: 15 }, // Stonehedge
      { x: 42, z: 22, r: 17 }, // Tinkle Town
      { x: -40, z: 10, r: 15 }, // Gnome Depot
      { x: 6, z: 50, r: 17 }, // Chili Fields
      { x: 36, z: -44, r: 7 }, // the summit
      { x: -42, z: -40, r: 6 }, // the island in Soggy Bottom
      { x: 52, z: -22, r: 6 }, // the waterfall
    ];
    const clear = (x: number, z: number, pad = 0) => keepClear.every((k) => Math.hypot(x - k.x, z - k.z) > k.r + pad);
    const gentle = (x: number, z: number) => Math.abs(heightAt(x + 1.5, z) - heightAt(x - 1.5, z)) < 1.6 && Math.abs(heightAt(x, z + 1.5) - heightAt(x, z - 1.5)) < 1.6;
    const dry = (x: number, z: number, minH = 0.7) => heightAt(x, z) > minH && gentle(x, z);

    // --- the island: a hilly, coloured terrain mesh, with the sea round it ----------------------------------
    const SIZE = 2 * (HALF + 14);
    const SEG = 104;
    const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    tg.rotateX(-Math.PI / 2);
    const tp = tg.attributes.position;
    const tcol = new Float32Array(tp.count * 3);
    const c3: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i);
      const z = tp.getZ(i);
      const h = heightAt(x, z);
      tp.setY(i, h);
      groundColor(x, z, h, c3);
      tcol[i * 3] = c3[0]; tcol[i * 3 + 1] = c3[1]; tcol[i * 3 + 2] = c3[2];
    }
    tg.setAttribute('color', new THREE.BufferAttribute(tcol, 3));
    tg.computeVertexNormals();
    const gtex = makePaintTexture(150, 32); // chunky low-res texture, PlayStation style
    gtex.repeat.set(75, 75);
    this.group.add(new THREE.Mesh(tg, lit({ vertexColors: true, map: gtex })));

    // the water: one big translucent sheet at sea level (the land pokes up through it)
    const rip = makePaintTexture(205, 32, true);
    rip.repeat.set(150, 150);
    this.waterTex = rip;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), lit({ color: 0x20475a, map: rip, transparent: true, opacity: 0.86, depthWrite: false }));
    water.position.y = SEA;
    water.renderOrder = 1;
    this.group.add(water);
    for (const p of ACID_POOLS) {
      const pool = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.05, 28), new THREE.MeshBasicMaterial({ color: 0x4a7a1a, transparent: true, opacity: 0.9, depthWrite: false }));
      pool.position.set(p.x, SEA + 0.06, p.z);
      pool.renderOrder = 2;
      this.group.add(pool);
    }

    // flowers and soft patches on the grass
    const patchCount = 130;
    const patches = instanced(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }), patchCount);
    for (let i = 0; i < patchCount; i++) {
      let x = 0, z = 0;
      for (let a = 0; a < 12; a++) { x = between(-HALF + 6, HALF - 6); z = between(-HALF + 6, HALF - 6); if (dry(x, z, 0.9)) break; }
      put(patches, i, x, heightAt(x, z) + 0.06, z, between(2.5, 8), 1, between(2.5, 8), rnd() * 3, pick([0x3a4a2a, 0x4a3a2a, 0x2a3a4a, 0x4a4a3a]));
    }
    this.group.add(patches);

    // --- the forest is mushrooms: a stem you cannot walk through and a big candy cap overhead ---
    const placed: { x: number; z: number }[] = [];
    const spaced = (x: number, z: number, d: number) => placed.every((p) => Math.hypot(p.x - x, p.z - z) >= d);
    interface Shroom { x: number; z: number; gy: number; h: number; w: number; s: number; col: number }
    const shrooms: Shroom[] = [];
    const addShroom = (x: number, z: number, big: boolean) => {
      shrooms.push({
        x, z, gy: heightAt(x, z),
        h: big ? between(6.5, 8.2) : between(3.7, 5.2),
        w: big ? between(1.5, 1.9) : between(0.8, 1.1),
        s: big ? between(1.35, 1.6) : between(0.85, 1.15),
        col: pick([0x7a2a2a, 0x5a4020, 0x2a4a3a, 0x3a3a5a, 0x5a2a4a, 0x6a5a28, 0x2a5a5a]),
      });
      placed.push({ x, z });
    };
    for (let attempt = 0; attempt < 16000 && shrooms.length < 360; attempt++) {
      const x = between(-HALF + 3, HALF - 3);
      const z = between(-HALF + 3, HALF - 3);
      if (!dry(x, z) || !clear(x, z) || !spaced(x, z, 4.2)) continue;
      addShroom(x, z, rnd() < 0.15);
    }
    // Wee Woods is thick with them
    const wood = POIS.find((p) => p.kind === 'woods')!;
    for (let attempt = 0; attempt < 3000 && shrooms.length < 460; attempt++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * wood.r;
      const x = wood.x + Math.cos(a) * r;
      const z = wood.z + Math.sin(a) * r;
      if (!dry(x, z) || !clear(x, z) || !spaced(x, z, 3.3)) continue;
      addShroom(x, z, rnd() < 0.1);
    }
    const n = shrooms.length;
    const mStems = instanced(new THREE.CylinderGeometry(0.42, 0.5, 1, 8), lit({ color: 0xffffff, emissive: 0x181410 }), n);
    const mCaps = instanced(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), lit({ color: 0xffffff, flatShading: true }), n);
    const mGills = instanced(new THREE.CircleGeometry(0.5, 12).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), n);
    const SPOTS = 5;
    const mSpots = instanced(new THREE.SphereGeometry(0.5, 6, 4), lit({ color: 0xffffff, flatShading: true }), n * SPOTS);
    shrooms.forEach((m, i) => {
      put(mStems, i, m.x, m.gy + m.h / 2, m.z, m.w, m.h, m.w, 0, pick([0x9a9080, 0x8a8478, 0xa09484]));
      const capW = 4.6 * m.s;
      const capH = 1.9 * m.s;
      const base = m.gy + m.h - 0.15;
      this.capList.push({ x: m.x, z: m.z, base, r: capW / 2, h: capH });
      put(mCaps, i, m.x, base, m.z, capW, capH * 2, capW, rnd() * 3, m.col); // the hemisphere has radius 0.5, so scaling y by 2h gives height h
      put(mGills, i, m.x, base + 0.02, m.z, capW, 1, capW, 0, 0x4a3e34);
      for (let k = 0; k < SPOTS; k++) {
        const ang = rnd() * Math.PI * 2 + k;
        const r = (0.25 + rnd() * 0.55) * (capW / 2);
        const yy = base + capH * Math.sqrt(Math.max(0, 1 - (r / (capW / 2)) ** 2)) - 0.05;
        const sp = (0.35 + rnd() * 0.3) * m.s;
        put(mSpots, i * SPOTS + k, m.x + Math.cos(ang) * r, yy, m.z + Math.sin(ang) * r, sp, sp * 0.4, sp, 0, 0xb8b09a);
      }
      this.addCircle(m.x, m.z, m.w * 0.5 + 0.1, m.gy + m.h);
    });
    this.group.add(mStems, mCaps, mGills, mSpots);

    // --- rocks and fallen logs: low cover --------------------------------------------------
    const rockList: { x: number; z: number; w: number; h: number }[] = [];
    for (let attempt = 0; attempt < 3000 && rockList.length < 100; attempt++) {
      const x = between(-HALF + 4, HALF - 4);
      const z = between(-HALF + 4, HALF - 4);
      if (heightAt(x, z) < 0.3 || !clear(x, z, 0.5) || !spaced(x, z, 3)) continue;
      rockList.push({ x, z, w: between(1.8, 3.2), h: between(1.1, 2) });
      placed.push({ x, z });
    }
    const rocks = instanced(new THREE.IcosahedronGeometry(0.6, 0), lit({ color: 0xffffff, flatShading: true }), rockList.length);
    rockList.forEach((r, i) => {
      const gy = heightAt(r.x, r.z);
      put(rocks, i, r.x, gy + r.h / 2.4, r.z, r.w, r.h, r.w, rnd() * 3, pick([0x5a5e68, 0x4a4e58, 0x6a6e78]));
      this.addCircle(r.x, r.z, r.w * 0.5, gy + r.h * 0.9);
    });
    this.group.add(rocks);

    const logList: { x: number; z: number; w: number; d: number }[] = [];
    for (let attempt = 0; attempt < 3000 && logList.length < 50; attempt++) {
      const x = between(-HALF + 6, HALF - 6);
      const z = between(-HALF + 6, HALF - 6);
      if (!dry(x, z, 0.8) || !clear(x, z, 1) || !spaced(x, z, 4.2)) continue;
      const alongX = rnd() < 0.5;
      logList.push({ x, z, w: alongX ? between(5, 7.5) : 1.3, d: alongX ? 1.3 : between(5, 7.5) });
      placed.push({ x, z });
    }
    const logs = instanced(new SoftBox(1, 1, 1), lit({ color: 0xffffff }), logList.length);
    logList.forEach((l, i) => {
      const gy = heightAt(l.x, l.z);
      put(logs, i, l.x, gy + 0.5, l.z, l.w, 1, l.d, 0, pick([0x4a3020, 0x5a3a28]));
      this.addRect(l.x - l.w / 2, l.z - l.d / 2, l.x + l.w / 2, l.z + l.d / 2, gy + 1);
    });
    this.group.add(logs);

    // --- glowing little mushrooms (decor) --------------------------------------------------
    const smallN = 460;
    const stems = instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, 6), lit({ color: 0x6a6458 }), smallN);
    const caps = instanced(new THREE.ConeGeometry(0.62, 1, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), smallN);
    for (let i = 0; i < smallN; i++) {
      let x = 0, z = 0;
      for (let a = 0; a < 10; a++) { x = between(-HALF + 2, HALF - 2); z = between(-HALF + 2, HALF - 2); if (heightAt(x, z) > 0.2) break; }
      const gy = heightAt(x, z);
      const s = between(0.7, 1.5);
      put(stems, i, x, gy + 0.3 * s, z, 0.25 * s, 0.6 * s, 0.25 * s);
      put(caps, i, x, gy + 0.7 * s, z, 1.0 * s, 0.4 * s, 1.0 * s, rnd() * 3, pick([0xa04a6a, 0x4a9a9a, 0xa09a4a, 0x7a5aa0]));
    }
    this.group.add(stems, caps);

    // lily pads on the ponds
    const lilies = instanced(new SoftBox(1, 0.05, 1), new THREE.MeshBasicMaterial({ color: 0x2a5a32 }), 36);
    for (let i = 0; i < 36; i++) {
      const pond = i < 18 ? { x: -50, z: 52 } : { x: -42, z: -34 };
      put(lilies, i, pond.x + between(-7, 7), SEA + 0.1, pond.z + between(-7, 7), between(1.1, 1.8), 1, between(1.1, 1.8), rnd() * 3);
    }
    this.group.add(lilies);

    this.buildPlaces(between);

    // --- fireflies ------------------------------------------------------------------------------
    const flyN = 200;
    this.flies = instanced(new SoftBox(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xc8d870 }), flyN);
    for (let i = 0; i < flyN; i++) {
      const x = between(-HALF, HALF);
      const z = between(-HALF, HALF);
      this.flyBase.push({ x, y: Math.max(heightAt(x, z), SEA) + between(1, 5), z, p: rnd() * 6 });
    }
    this.group.add(this.flies);

    // --- name signs floating over every place ----------------------------------------------------------
    for (const p of POIS) {
      const sign = makeSign(p.name, p.color);
      sign.position.set(p.x, Math.max(heightAt(p.x, p.z), SEA) + (p.kind === 'peak' ? 12 : 17), p.z);
      this.group.add(sign);
    }
  }

  /** The built places: a village, a depot, a farm, standing stones, a mountain-top pavilion and so on. */
  private buildPlaces(between: (a: number, b: number) => number) {
    const mats = new Map<number, THREE.MeshLambertMaterial>();
    const mat = (c: number) => {
      let m = mats.get(c);
      if (!m) { m = lit({ color: c, flatShading: true }); mats.set(c, m); }
      return m;
    };
    /** A solid block standing on the ground at (x, z). */
    const block = (x: number, z: number, w: number, d: number, h: number, color: number, solid = true, lift = 0) => {
      const gy = heightAt(x, z) + lift;
      const m = new THREE.Mesh(new SoftBox(w, h, d), mat(color));
      m.position.set(x, gy + h / 2, z);
      this.group.add(m);
      if (solid) this.addRect(x - w / 2, z - d / 2, x + w / 2, z + d / 2, gy + h);
      return gy + h;
    };
    const roof = (x: number, z: number, top: number, r: number, h: number, color: number) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), mat(color));
      m.position.set(x, top + h / 2, z);
      m.rotation.y = Math.PI / 4;
      this.group.add(m);
    };
    const pillar = (x: number, z: number, r: number, h: number, color: number) => {
      const gy = heightAt(x, z);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 10), mat(color));
      m.position.set(x, gy + h / 2, z);
      this.group.add(m);
      this.addCircle(x, z, r + 0.1, gy + h);
    };
    const rnd2 = rnd;
    void between;

    // Tinkle Town: a ring of pastel mushroom-houses round a fountain
    {
      const cx = 42, cz = 22;
      const colors = [0x8a7e68, 0x7a7060, 0x9a8c70, 0x6a6050, 0x8a806c, 0x76705e, 0x948a74, 0x6e665a];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.2;
        const x = cx + Math.cos(a) * 10.5;
        const z = cz + Math.sin(a) * 10.5;
        const h = 3.4 + (k % 3) * 0.7;
        const top = block(x, z, 5.2, 5.2, h, colors[k]);
        roof(x, z, top, 4.4, 2.8, [0x2a2a30, 0x3a2a2a, 0x2a303a, 0x6a2424][k % 4]);
      }
      const base = heightAt(cx, cz);
      const fountain = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.9, 16), mat(0x6a6e78));
      fountain.position.set(cx, base + 0.45, cz);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.1, 16), new THREE.MeshBasicMaterial({ color: 0x2a5a70 }));
      water.position.set(cx, base + 0.92, cz);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 2.6, 8), mat(0x6a6e78));
      spout.position.set(cx, base + 1.9, cz);
      this.group.add(fountain, water, spout);
      this.addCircle(cx, cz, 2.9, base + 0.9);
    }

    // Gnome Depot: a big grey warehouse with an orange roof, sheds and stacked crates
    {
      const cx = -40, cz = 10;
      const top = block(cx, cz - 4, 19, 11, 7, 0x4a4e58);
      block(cx, cz - 4, 19.6, 11.6, 0.8, 0x24242a, false, 7);
      void top;
      block(cx - 12, cz + 7, 5, 4, 3, 0x3a3e48);
      block(cx + 12, cz + 7, 5, 4, 3, 0x3a3e48);
      block(cx, cz + 10, 6, 3.4, 2.4, 0x32363e);
      const crate = [0x6a4a2a, 0x5a3a22, 0x7a5a30, 0x4a3a22];
      for (let i = 0; i < 12; i++) {
        const a = rnd2() * Math.PI * 2;
        const r = 7 + rnd2() * 7;
        const x = cx + Math.cos(a) * r;
        const z = cz + 4 + Math.sin(a) * r * 0.6;
        if (Math.abs(x - cx) < 11 && Math.abs(z - (cz - 4)) < 7) continue;
        block(x, z, 2, 2, 2, crate[i % 4]);
        if (i % 3 === 0) block(x, z, 1.5, 1.5, 1.5, crate[(i + 1) % 4], true, 2);
      }
    }

    // Chili Fields: a red barn and long rows of chili plants
    {
      const cx = 6, cz = 50;
      const top = block(cx + 8, cz - 8, 9, 7, 5, 0x6a2424);
      roof(cx + 8, cz - 8, top, 7, 3, 0x24242a);
      const plants = instanced(new THREE.ConeGeometry(0.5, 1.2, 6), lit({ color: 0xffffff, flatShading: true }), 120);
      let pi = 0;
      for (let row = 0; row < 6; row++) {
        for (let k = 0; k < 20 && pi < 120; k++) {
          const x = cx - 14 + k * 1.4;
          const z = cz - 3 + row * 3.2;
          if (Math.hypot(x - (cx + 8), z - (cz - 8)) < 6) continue;
          put(plants, pi++, x, heightAt(x, z) + 0.6, z, 1, 1, 1, 0, (k + row) % 3 === 0 ? 0x3a5a2a : 0x7a2420);
        }
      }
      plants.count = pi;
      this.group.add(plants);
    }

    // Stonehedge: a ring of standing stones round an altar
    {
      const base = heightAt(0, 0);
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        const x = Math.cos(a) * 8;
        const z = Math.sin(a) * 8;
        const h = 3 + (k % 3) * 0.7;
        const stone = new THREE.Mesh(new SoftBox(1.4, h, 1.4), mat(0x6a6e78));
        stone.position.set(x, heightAt(x, z) + h / 2, z);
        stone.rotation.y = a;
        this.group.add(stone);
        this.addCircle(x, z, 0.8, heightAt(x, z) + h);
      }
      const altar = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 0.6, 10), mat(0x8a8e98));
      altar.position.set(0, base + 0.3, 0);
      this.group.add(altar);
    }

    // Pee-nacle Peak: a pavilion on the summit with a flag
    {
      const sx = 36, sz = -44;
      for (const [dx, dz] of [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]]) pillar(sx + dx, sz + dz, 0.5, 4.5, 0x8a2424);
      const g = heightAt(sx, sz);
      const top = new THREE.Mesh(new SoftBox(8.6, 0.7, 8.6), mat(0x24242a));
      top.position.set(sx, g + 4.85, sz);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(6, 2.6, 4), mat(0x3a2a2a));
      cap.position.set(sx, g + 6.5, sz);
      cap.rotation.y = Math.PI / 4;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), mat(0x8a8a90));
      pole.position.set(sx, g + 10.5, sz);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), new THREE.MeshBasicMaterial({ color: 0xa8222a, side: THREE.DoubleSide }));
      flag.position.set(sx + 1.7, g + 12.6, sz);
      this.group.add(top, cap, pole, flag);
    }

    // Soggy Bottom: a hut on the island in the lake
    {
      const hx = -42, hz = -40;
      const top = block(hx, hz, 4.4, 4.4, 3, 0x6a4a2a);
      roof(hx, hz, top, 3.6, 2.4, 0x2a3a2a);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const x = hx + Math.cos(a) * 3.4;
        const z = hz + Math.sin(a) * 3.4;
        const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2, 5), mat(0x4a6a32));
        reed.position.set(x, heightAt(x, z) + 1, z);
        this.group.add(reed);
      }
    }

    // Dribble Falls: a rocky ledge with a sheet of falling water
    {
      const fx = 52, fz = -26;
      block(fx - 3, fz, 3, 6, 5, 0x5a5e68);
      block(fx + 3, fz, 3, 6, 4, 0x50545e);
      const g = heightAt(fx, fz + 3);
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6), new THREE.MeshBasicMaterial({ color: 0x4a7a8a, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
      sheet.position.set(fx, Math.max(g, SEA) + 3, fz + 0.5);
      this.group.add(sheet);
    }

    // Sunbathing Shores: beach umbrellas and loungers along the north coast
    {
      for (let k = 0; k < 9; k++) {
        const a = -Math.PI / 2 + (k - 4) * 0.075;
        const rr = 66.5 + (k % 2) * 1.5;
        const x = Math.cos(a) * rr;
        const z = Math.sin(a) * rr;
        if (heightAt(x, z) < 0.05) continue;
        const g = heightAt(x, z);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 6), mat(0x8a8478));
        pole.position.set(x, g + 1.5, z);
        const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.9, 8), mat([0x7a2a3a, 0x7a6a2a, 0x2a5a6a, 0x3a6a2a][k % 4]));
        canopy.position.set(x, g + 3.3, z);
        const lounger = new THREE.Mesh(new SoftBox(0.9, 0.25, 2.2), mat(0x8a8478));
        lounger.position.set(x + 1.6, g + 0.2, z + 0.5);
        this.group.add(pole, canopy, lounger);
        this.addCircle(x, z, 0.3, g + 3);
      }
    }

    // stone lanterns with a warm glow, round the built places
    {
      const spots: { x: number; z: number }[] = [];
      for (const p of POIS) {
        if (['lake', 'pond', 'falls', 'swamp', 'beach'].includes(p.kind)) continue;
        const count = p.kind === 'peak' ? 4 : 6;
        for (let k = 0; k < count; k++) {
          const a = (k / count) * Math.PI * 2 + 0.4;
          const rr = (p.kind === 'peak' ? 6.5 : p.r * 0.72);
          spots.push({ x: p.x + Math.cos(a) * rr, z: p.z + Math.sin(a) * rr });
        }
      }
      const posts = instanced(new THREE.CylinderGeometry(0.28, 0.34, 1.3, 6), mat(0x6a6e78), spots.length);
      const heads = instanced(new THREE.BoxGeometry(0.8, 0.7, 0.8), new THREE.MeshBasicMaterial({ color: 0xffa040 }), spots.length);
      const hats = instanced(new THREE.ConeGeometry(0.75, 0.55, 4), mat(0x50545e), spots.length);
      spots.forEach((p, i) => {
        const g = heightAt(p.x, p.z);
        if (g < 0.2) { put(posts, i, 0, -50, 0, 0.001, 0.001, 0.001); put(heads, i, 0, -50, 0, 0.001, 0.001, 0.001); put(hats, i, 0, -50, 0, 0.001, 0.001, 0.001); return; }
        put(posts, i, p.x, g + 0.65, p.z, 1, 1, 1);
        put(heads, i, p.x, g + 1.65, p.z, 1, 1, 1);
        put(hats, i, p.x, g + 2.2, p.z, 1, 1, 1, Math.PI / 4);
        this.addCircle(p.x, p.z, 0.4, g + 2);
      });
      this.group.add(posts, heads, hats);
    }

    // Ice Wee Glacier: crystals on the frozen hill
    {
      const crys = instanced(new THREE.ConeGeometry(0.5, 1, 5), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0x102028 }), 26);
      for (let i = 0; i < 26; i++) {
        const a = rnd2() * Math.PI * 2;
        const r = 2 + rnd2() * 10;
        const x = -62 + Math.cos(a) * r;
        const z = -6 + Math.sin(a) * r;
        const h = 2 + rnd2() * 4.5;
        put(crys, i, x, heightAt(x, z) + h / 2 - 0.3, z, 1 + rnd2() * 0.8, h, 1 + rnd2() * 0.8, rnd2() * 3, [0x5a8a9a, 0x7aa8b8, 0x4a7a8a][i % 3]);
      }
      this.group.add(crys);
    }
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

  /** Does a ray from (ox, oy, oz) along the unit vector d hit a mushroom cap or anything solid within maxT? */
  rayBlocked(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number): boolean {
    for (const c of this.capList) {
      // intersect with the cap's ellipsoid by squashing it into a unit sphere
      const px = (ox - c.x) / c.r, py = (oy - c.base) / c.h, pz = (oz - c.z) / c.r;
      const vx = dx / c.r, vy = dy / c.h, vz = dz / c.r;
      const a = vx * vx + vy * vy + vz * vz;
      const b = px * vx + py * vy + pz * vz;
      const disc = b * b - a * (px * px + py * py + pz * pz - 1);
      if (disc < 0) continue;
      const sq = Math.sqrt(disc);
      const t1 = (-b - sq) / a;
      const t2 = (-b + sq) / a;
      if (t1 > 0 && t1 < maxT && oy + dy * t1 > c.base) return true;
      if (t2 > 0 && t2 < maxT && oy + dy * t2 > c.base) return true;
    }
    for (let t = 1; t < maxT; t += 1.5) {
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      if (y < heightAt(x, z) || this.pointHit(x, y, z)) return true;
    }
    return false;
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

  /** A random spot of dry land nobody could be stuck in. */
  randomFree(range: number): THREE.Vector3 {
    const p = { x: 0, z: 0 };
    for (let i = 0; i < 200; i++) {
      p.x = (Math.random() * 2 - 1) * range;
      p.z = (Math.random() * 2 - 1) * range;
      if (heightAt(p.x, p.z) < 0.7) continue;
      const q = { x: p.x, z: p.z };
      if (!this.collide(q, 0.7) || Math.hypot(q.x - p.x, q.z - p.z) < 0.01) return new THREE.Vector3(p.x, heightAt(p.x, p.z), p.z);
    }
    return new THREE.Vector3(0, heightAt(0, 8), 8);
  }

  /** Ripple the water and drift the fireflies. */
  update(_dt: number, t: number) {
    if (this.waterTex) this.waterTex.offset.set(t * 0.012, t * 0.007);
    for (let i = 0; i < this.flyBase.length; i++) {
      const f = this.flyBase[i];
      put(this.flies, i, f.x + Math.sin(t * 0.4 + f.p) * 2.5, f.y + Math.sin(t * 0.9 + f.p * 2) * 0.8, f.z + Math.cos(t * 0.35 + f.p) * 2.5, 1, 1, 1);
    }
    this.flies.instanceMatrix.needsUpdate = true;
  }
}
