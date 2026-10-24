import * as THREE from 'three';
import { lit } from './organic';
import { heightAt, SEA, POIS, THEME_ID, type Poi } from './map';

/** What the scenery builder needs from the Forest: somewhere to put things, and solid things to bump into. */
export interface BiomeHost {
  group: THREE.Group;
  spawns: THREE.Vector3[];
  addCircle(x: number, z: number, r: number, h: number): void;
  addRect(x0: number, z0: number, x1: number, z1: number, h: number): void;
}

let seed = 90210;
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

/** The scenery of the ice and desert maps: plants, rocks, and the buildings and landmarks of each named place. */
export function buildBiome(host: BiomeHost, HALF: number, AREA: number) {
  const g = host.group;
  const ice = THEME_ID === 'ice';
  const mats = new Map<number, THREE.MeshLambertMaterial>();
  const mat = (c: number) => {
    let m = mats.get(c);
    if (!m) { m = lit({ color: c, flatShading: true }); mats.set(c, m); }
    return m;
  };
  const glowMats = new Map<number, THREE.MeshBasicMaterial>();
  const glowMat = (c: number) => {
    let m = glowMats.get(c);
    if (!m) { m = new THREE.MeshBasicMaterial({ color: c }); glowMats.set(c, m); }
    return m;
  };
  const gy = (x: number, z: number) => heightAt(x, z);
  const mesh = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, glow = false) => {
    const m = new THREE.Mesh(geo, glow ? glowMat(color) : mat(color));
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  /** A box standing on the ground at (x, z); solid unless told otherwise. Returns its top. */
  const block = (x: number, z: number, w: number, d: number, h: number, color: number, solid = true, lift = 0, ry = 0) => {
    const base = gy(x, z) + lift;
    const m = mesh(new THREE.BoxGeometry(w, h, d), color, x, base + h / 2, z);
    m.rotation.y = ry;
    if (solid && ry === 0) host.addRect(x - w / 2, z - d / 2, x + w / 2, z + d / 2, base + h);
    else if (solid) host.addCircle(x, z, Math.max(w, d) * 0.5, base + h);
    return base + h;
  };
  const cyl = (x: number, z: number, rTop: number, rBot: number, h: number, color: number, solid = true, lift = 0, glow = false) => {
    const base = gy(x, z) + lift;
    const m = mesh(new THREE.CylinderGeometry(rTop, rBot, h, 12), color, x, base + h / 2, z, glow);
    if (solid) host.addCircle(x, z, Math.max(rTop, rBot) + 0.05, base + h);
    return m;
  };
  const cone = (x: number, y: number, z: number, r: number, h: number, color: number, sides = 8, glow = false, ry = 0) => {
    const m = mesh(new THREE.ConeGeometry(r, h, sides), color, x, y + h / 2, z, glow);
    m.rotation.y = ry;
    return m;
  };
  const sphere = (x: number, y: number, z: number, r: number, color: number) => mesh(new THREE.SphereGeometry(r, 10, 8), color, x, y, z);

  // ---- where scenery may go ----
  const STRUCT = ice
    ? ['village', 'snowmen', 'lodge', 'castle', 'fountain', 'lighthouse', 'peak', 'cave', 'rink', 'penguins']
    : ['pyramid', 'bazaar', 'oasis', 'mesa', 'derrick', 'camp', 'sphinx', 'bones', 'pit'];
  const keep = [...host.spawns.map((s) => ({ x: s.x, z: s.z, r: 3 })), ...POIS.filter((p) => STRUCT.includes(p.kind)).map((p) => ({ x: p.x, z: p.z, r: p.r * 0.85 }))];
  const clear = (x: number, z: number, pad = 0) => keep.every((k) => Math.hypot(x - k.x, z - k.z) > k.r + pad);
  const gentle = (x: number, z: number) => Math.abs(heightAt(x + 1.5, z) - heightAt(x - 1.5, z)) < 1.8 && Math.abs(heightAt(x, z + 1.5) - heightAt(x, z - 1.5)) < 1.8;
  const dry = (x: number, z: number, minH = 0.7) => heightAt(x, z) > minH && gentle(x, z);
  const placed: { x: number; z: number }[] = [];
  const spaced = (x: number, z: number, d: number) => placed.every((p) => Math.hypot(p.x - x, p.z - z) >= d);
  const find = (kind: string): Poi | undefined => POIS.find((p) => p.kind === kind);

  /** Pick up to `n` free spots (dry, clear of the landmarks, apart from each other). */
  const spots = (n: number, apart: number, minH = 0.7, around?: Poi, spread = 1): { x: number; z: number }[] => {
    const out: { x: number; z: number }[] = [];
    for (let attempt = 0; attempt < n * 60 && out.length < n; attempt++) {
      let x: number, z: number;
      if (around) {
        const a = rnd() * Math.PI * 2;
        const r = Math.sqrt(rnd()) * around.r * spread;
        x = around.x + Math.cos(a) * r;
        z = around.z + Math.sin(a) * r;
      } else {
        x = between(-HALF + 4, HALF - 4);
        z = between(-HALF + 4, HALF - 4);
      }
      if (!dry(x, z, minH) || !clear(x, z) || !spaced(x, z, apart)) continue;
      placed.push({ x, z });
      out.push({ x, z });
    }
    return out;
  };

  const neon = (x: number, y: number, z: number, w: number, h: number, d: number, color: number) => mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, true);

  if (ice) {
    // ================= ICE =================
    // snowy pines: a trunk, three dark tiers with snow on each
    const pines = spots(Math.round(620 * AREA), 3.6);
    const trunks = instanced(new THREE.CylinderGeometry(0.28, 0.4, 1.4, 6), mat(0x5a3a22), pines.length);
    const tiers = instanced(new THREE.ConeGeometry(1, 1, 8), lit({ color: 0xffffff, flatShading: true }), pines.length * 3);
    const snows = instanced(new THREE.ConeGeometry(1, 1, 8), lit({ color: 0xeef6ff, flatShading: true }), pines.length * 3);
    pines.forEach((p, i) => {
      const base = gy(p.x, p.z);
      const s = between(0.85, 1.55);
      put(trunks, i, p.x, base + 0.7 * s, p.z, s, s, s);
      const col = pick([0x1e5048, 0x245a4c, 0x1a4a50]);
      for (let k = 0; k < 3; k++) {
        const R = (2.1 - 0.55 * k) * s;
        const H = 2.6 * s;
        const by = base + (1.2 + 1.55 * k) * s;
        put(tiers, i * 3 + k, p.x, by + H / 2, p.z, R, H, R, 0, col);
        put(snows, i * 3 + k, p.x, by + H * 0.45 + H * 0.28, p.z, R * 0.74, H * 0.56, R * 0.74);
      }
      host.addCircle(p.x, p.z, 0.5, base + 6.5 * s);
    });
    g.add(trunks, tiers, snows);

    // ice crystals: tall, glowing, solid
    const crysSpots = [...spots(Math.round(50 * AREA * 2), 5), ...spots(26, 3.2, 0.7, find('glacier'), 0.9)];
    const crys = instanced(new THREE.ConeGeometry(0.5, 1, 5), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0x1a5a70 }), crysSpots.length);
    crysSpots.forEach((p, i) => {
      const h = between(2.6, 8);
      const w = between(0.9, 1.9);
      const base = gy(p.x, p.z);
      put(crys, i, p.x, base + h / 2 - 0.3, p.z, w, h, w, rnd() * 3, pick([0x9adcf0, 0xb8ecff, 0x7ac8e8, 0xd2baff]));
      host.addCircle(p.x, p.z, w * 0.42, base + h * 0.8);
    });
    g.add(crys);

    // snowy boulders
    const rocks = spots(Math.round(200 * AREA), 3, 0.3);
    const boulders = instanced(new THREE.IcosahedronGeometry(0.6, 0), lit({ color: 0xffffff, flatShading: true }), rocks.length);
    rocks.forEach((p, i) => {
      const w = between(1.8, 3.4);
      const h = between(1.1, 2.1);
      const base = gy(p.x, p.z);
      put(boulders, i, p.x, base + h / 2.4, p.z, w, h, w, rnd() * 3, pick([0xdfe8f2, 0xc8d4e4, 0xaab8cc, 0x8a98ae]));
      host.addCircle(p.x, p.z, w * 0.5, base + h * 0.9);
    });
    g.add(boulders);

    // drifts and glowing shards (decor)
    const driftN = Math.round(360 * AREA);
    const drifts = instanced(new THREE.SphereGeometry(0.5, 8, 5), lit({ color: 0xffffff }), driftN);
    for (let i = 0; i < driftN; i++) {
      let x = 0, z = 0;
      for (let a = 0; a < 10; a++) { x = between(-HALF + 3, HALF - 3); z = between(-HALF + 3, HALF - 3); if (heightAt(x, z) > 0.4) break; }
      put(drifts, i, x, gy(x, z) + 0.05, z, between(3, 8), between(0.5, 1.2), between(3, 8), rnd() * 3, pick([0xe4eefa, 0xd0e0f2, 0xc2d6ee]));
    }
    g.add(drifts);
    const shardN = Math.round(700 * AREA);
    const shards = instanced(new THREE.ConeGeometry(0.14, 0.7, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), shardN);
    for (let i = 0; i < shardN; i++) {
      let x = 0, z = 0;
      for (let a = 0; a < 10; a++) { x = between(-HALF + 2, HALF - 2); z = between(-HALF + 2, HALF - 2); if (heightAt(x, z) > 0.3) break; }
      const s = between(0.7, 1.6);
      put(shards, i, x, gy(x, z) + 0.3 * s, z, s, s, s, rnd() * 3, pick([0x8af0ff, 0xff7ae8, 0xe8f8ff, 0x8af0ff]));
    }
    g.add(shards);
    // floes on the pond
    const pond = find('pond');
    if (pond) {
      const floes = instanced(new THREE.CylinderGeometry(1, 1, 0.12, 9), lit({ color: 0xdff0fa }), 14);
      for (let i = 0; i < 14; i++) put(floes, i, pond.x + between(-7, 7), SEA + 0.08, pond.z + between(-7, 7), between(0.9, 2), 1, between(0.9, 2), rnd() * 3);
      g.add(floes);
    }

    const igloo = (x: number, z: number, s: number, a: number) => {
      const base = gy(x, z);
      const dome = mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xe6f0fa, x, base, z);
      dome.scale.set(s, s * 0.85, s);
      const dx = x + Math.cos(a) * s * 0.9;
      const dz = z + Math.sin(a) * s * 0.9;
      const tun = mesh(new THREE.BoxGeometry(s * 0.7, s * 0.5, s * 0.62), 0xdce8f6, dx, base + s * 0.25, dz);
      tun.rotation.y = -a;
      const door = mesh(new THREE.BoxGeometry(0.1, s * 0.34, s * 0.36), 0x101c28, x + Math.cos(a) * (s * 1.26), base + s * 0.2, z + Math.sin(a) * (s * 1.26));
      door.rotation.y = -a;
      host.addCircle(x, z, s * 0.95, base + s * 0.85);
    };
    const snowman = (x: number, z: number, s: number) => {
      const base = gy(x, z);
      sphere(x, base + 0.85 * s, z, 1.05 * s, 0xf4f8ff);
      sphere(x, base + 2.2 * s, z, 0.78 * s, 0xf4f8ff);
      sphere(x, base + 3.2 * s, z, 0.55 * s, 0xf4f8ff);
      cone(x, base + 3.15 * s, z - 0.5 * s, 0.1 * s, 0.7 * s, 0xff8a1a, 6).rotation.x = -Math.PI / 2;
      for (const sx of [-0.2, 0.2]) mesh(new THREE.BoxGeometry(0.12 * s, 0.12 * s, 0.06 * s), 0x101010, x + sx * s, base + 3.35 * s, z - 0.5 * s);
      cyl(x, z, 0.4 * s, 0.4 * s, 0.7 * s, 0x14141c, false, 3.7 * s);
      mesh(new THREE.TorusGeometry(0.5 * s, 0.14 * s, 6, 12), pick([0xd02a2a, 0x2a6ad0, 0xe0c020, 0x9a2ad0]), x, base + 2.7 * s, z).rotation.x = Math.PI / 2;
      host.addCircle(x, z, 1.05 * s, base + 3.2 * s);
    };
    const lampPost = (x: number, z: number, color: number) => {
      const base = gy(x, z);
      if (base < 0.1) return;
      cyl(x, z, 0.12, 0.16, 2.4, 0x50585e, true);
      mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), color, x, base + 2.65, z, true);
    };

    for (const p of POIS) {
      const base = gy(p.x, p.z);
      switch (p.kind) {
        case 'village': {
          for (let k = 0; k < 7; k++) {
            const a = (k / 7) * Math.PI * 2 + 0.2;
            igloo(p.x + Math.cos(a) * 10.5, p.z + Math.sin(a) * 10.5, 3.2 + (k % 3) * 0.35, a + Math.PI);
          }
          // a warm campfire in the middle
          cyl(p.x, p.z, 1.6, 1.8, 0.35, 0x6a6e78, true);
          cone(p.x, base + 0.3, p.z, 0.8, 2.2, 0xff8a2a, 6, true);
          mesh(new THREE.TorusGeometry(1.7, 0.1, 6, 20), 0xffa040, p.x, base + 0.4, p.z, true).rotation.x = Math.PI / 2;
          break;
        }
        case 'snowmen': {
          for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; snowman(p.x + Math.cos(a) * 9, p.z + Math.sin(a) * 9, 0.9 + (k % 3) * 0.12); }
          snowman(p.x, p.z, 2.1);
          break;
        }
        case 'lodge': {
          const top = block(p.x, p.z, 10, 7, 4.2, 0x6a4a2a);
          mesh(new THREE.ConeGeometry(7.6, 3.2, 4), 0xeef6ff, p.x, top + 1.6, p.z).rotation.y = Math.PI / 4;
          block(p.x + 3.6, p.z - 2, 1.3, 1.3, 3.2, 0x6a6e78, false, 4.2);
          for (const dx of [-2.6, 2.6]) neon(p.x + dx, base + 2.4, p.z + 3.55, 1.5, 1.2, 0.12, 0xffa040);
          for (let k = 0; k < 6; k++) mesh(new THREE.CylinderGeometry(0.28, 0.28, 3, 6), 0x5a3a22, p.x - 8, base + 0.3 + (k > 2 ? 0.5 : 0), p.z - 2 + (k % 3) * 0.55).rotation.x = Math.PI / 2;
          mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.04, 14), 0xe8d820, p.x + 3, base + 0.1, p.z + 7); // the yellow snow
          break;
        }
        case 'castle': {
          const top = block(p.x, p.z, 15, 11, 9, 0xa8c4dc);
          neon(p.x, top + 0.2, p.z + 5.55, 15.4, 0.3, 0.3, 0x2af0ff);
          neon(p.x, top + 0.2, p.z - 5.55, 15.4, 0.3, 0.3, 0xff3ad8);
          block(p.x, p.z + 5.6, 3.4, 0.4, 4.4, 0x101c28, false);
          for (const [dx, dz] of [[-9, -8], [9, -8], [-9, 8], [9, 8]]) {
            cyl(p.x + dx, p.z + dz, 2.3, 2.5, 12.5, 0xb8d0e6, true);
            cone(p.x + dx, base + 12.4, p.z + dz, 3.1, 4.6, (dx > 0) === (dz > 0) ? 0x4aa0e0 : 0x8a5ae0, 8);
          }
          const pole = mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 6), 0x8a8a90, p.x, top + 2.5, p.z);
          void pole;
          mesh(new THREE.PlaneGeometry(3, 1.7), 0x2af0ff, p.x + 1.6, top + 4, p.z, true).material = new THREE.MeshBasicMaterial({ color: 0x2af0ff, side: THREE.DoubleSide });
          break;
        }
        case 'peak': {
          for (const [dx, dz] of [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]]) cyl(p.x + dx, p.z + dz, 0.5, 0.55, 4.5, 0x3a8ad0, true);
          mesh(new THREE.BoxGeometry(8.6, 0.7, 8.6), 0x2a3a50, p.x, base + 4.85, p.z);
          mesh(new THREE.ConeGeometry(6, 2.6, 4), 0xe8f2fa, p.x, base + 6.5, p.z).rotation.y = Math.PI / 4;
          mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), 0x8a8a90, p.x, base + 10.5, p.z);
          const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), new THREE.MeshBasicMaterial({ color: 0x2af0ff, side: THREE.DoubleSide }));
          flag.position.set(p.x + 1.7, base + 12.6, p.z);
          g.add(flag);
          break;
        }
        case 'lighthouse': {
          cyl(p.x, p.z, 1.7, 2.7, 15, 0xe8eef6, true);
          for (let k = 0; k < 3; k++) mesh(new THREE.CylinderGeometry(2.2 - k * 0.3, 2.28 - k * 0.3, 1.6, 12), 0xd03a3a, p.x, base + 2.2 + k * 4.6, p.z);
          mesh(new THREE.CylinderGeometry(1.9, 1.9, 2, 12), 0xffe880, p.x, base + 16, p.z, true);
          cone(p.x, base + 17, p.z, 2.4, 2.4, 0xd03a3a, 12);
          break;
        }
        case 'fountain': {
          cyl(p.x, p.z, 3.4, 3.6, 0.8, 0x9ad0e8, true);
          cyl(p.x, p.z, 2, 2.2, 1.8, 0x7ac0e0, false, 0.8);
          cyl(p.x, p.z, 1, 1.2, 1.2, 0xb8e8ff, false, 2.5);
          for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; cone(p.x + Math.cos(a) * 2.7, base + 0.8, p.z + Math.sin(a) * 2.7, 0.35, 3 + (k % 3), 0x7ae8ff, 5, true); }
          mesh(new THREE.TorusGeometry(3.5, 0.1, 6, 28), 0x2af0ff, p.x, base + 0.85, p.z, true).rotation.x = Math.PI / 2;
          break;
        }
        case 'cave': {
          block(p.x - 5.5, p.z, 3.4, 4, 7.4, 0x7a8aa0);
          block(p.x + 5.5, p.z, 3.4, 4, 7.4, 0x6a7a92);
          mesh(new THREE.BoxGeometry(14.5, 2.6, 4.6), 0x8a9ab0, p.x, base + 8.4, p.z);
          for (let k = 0; k < 5; k++) cone(p.x - 3 + k * 1.5, base, p.z + between(-1, 1), 0.5, between(1.5, 3), pick([0xd2baff, 0x7ae8ff, 0xff7ae8]), 5, true);
          break;
        }
        case 'penguins': {
          for (let k = 0; k < 16; k++) {
            const a = rnd() * Math.PI * 2;
            const r = 3 + rnd() * (p.r - 4);
            const x = p.x + Math.cos(a) * r;
            const z = p.z + Math.sin(a) * r;
            if (gy(x, z) < 0.3) continue;
            const b = gy(x, z);
            const pg = new THREE.Group();
            const add = (w: number, h: number, d: number, px: number, py: number, pz: number, c: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(px, py, pz); pg.add(m); };
            add(0.8, 1.3, 0.6, 0, 0.75, 0, 0x14141c);
            add(0.55, 1, 0.12, 0, 0.7, -0.3, 0xf4f4f8);
            add(0.55, 0.5, 0.5, 0, 1.6, 0, 0x14141c);
            add(0.2, 0.12, 0.28, 0, 1.55, -0.38, 0xff9a1a);
            add(0.14, 0.7, 0.4, -0.5, 0.85, 0, 0x14141c);
            add(0.14, 0.7, 0.4, 0.5, 0.85, 0, 0x14141c);
            pg.position.set(x, b, z);
            pg.rotation.y = rnd() * 6.28;
            g.add(pg);
            host.addCircle(x, z, 0.5, b + 1.8);
          }
          break;
        }
        case 'rink': {
          for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; lampPost(p.x + Math.cos(a) * p.r * 0.95, p.z + Math.sin(a) * p.r * 0.95, k % 2 ? 0x2af0ff : 0xff3ad8); }
          for (const sx of [-9, 9]) {
            const b = gy(p.x + sx, p.z);
            neon(p.x + sx, b + 1, p.z - 1.8, 0.2, 2, 0.2, 0xff4a4a);
            neon(p.x + sx, b + 1, p.z + 1.8, 0.2, 2, 0.2, 0xff4a4a);
            neon(p.x + sx, b + 2, p.z, 0.2, 0.2, 3.8, 0xff4a4a);
          }
          break;
        }
        default:
          break;
      }
    }
    // lamp posts round the built places
    for (const p of POIS) {
      if (!['village', 'snowmen', 'lodge', 'castle', 'fountain', 'peak', 'lighthouse', 'cave', 'glacier'].includes(p.kind)) continue;
      const count = p.kind === 'peak' ? 4 : 6;
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2 + 0.4;
        const r = p.kind === 'peak' ? 6.5 : p.r * 0.78;
        lampPost(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, [0xffa040, 0xffa040, 0x30e8ff, 0xff30c8][k % 4]);
      }
    }
    return;
  }

  // ================= DESERT =================
  // saguaro cacti: a trunk and two arms
  const cactusSpots = [...spots(Math.round(300 * AREA), 4.2, 0.4), ...spots(34, 3.6, 0.4, find('cacti'), 1.0)];
  const cTrunk = instanced(new THREE.CylinderGeometry(0.42, 0.5, 1, 8), lit({ color: 0xffffff, flatShading: true }), cactusSpots.length);
  const cArmH = instanced(new THREE.CylinderGeometry(0.3, 0.3, 1, 6).rotateZ(Math.PI / 2), lit({ color: 0xffffff, flatShading: true }), cactusSpots.length * 2);
  const cArmV = instanced(new THREE.CylinderGeometry(0.28, 0.3, 1, 6), lit({ color: 0xffffff, flatShading: true }), cactusSpots.length * 2);
  cactusSpots.forEach((p, i) => {
    const base = gy(p.x, p.z);
    const s = between(0.8, 1.4);
    const h = between(3.2, 6) * s;
    const col = pick([0x2f7a3a, 0x3a8a40, 0x28703a, 0x4a8a30]);
    const ry = rnd() * 6.28;
    put(cTrunk, i, p.x, base + h / 2, p.z, s, h, s, 0, col);
    for (let k = 0; k < 2; k++) {
      const side = k ? 1 : -1;
      const ay = base + h * (0.42 + 0.14 * k);
      const len = 1.1 * s;
      const ox = Math.cos(ry) * side * (0.5 * s + len / 2);
      const oz = -Math.sin(ry) * side * (0.5 * s + len / 2);
      put(cArmH, i * 2 + k, p.x + ox, ay, p.z + oz, len, s, s, ry, col);
      const vh = h * (0.28 + 0.1 * k);
      const ex = Math.cos(ry) * side * (0.5 * s + len);
      const ez = -Math.sin(ry) * side * (0.5 * s + len);
      put(cArmV, i * 2 + k, p.x + ex, ay + vh / 2, p.z + ez, s, vh, s, 0, col);
    }
    host.addCircle(p.x, p.z, 0.6 * s, base + h);
  });
  g.add(cTrunk, cArmH, cArmV);

  // sandstone rocks
  const rockSpots = spots(Math.round(240 * AREA), 3.2, 0.2);
  const rocks = instanced(new THREE.IcosahedronGeometry(0.6, 0), lit({ color: 0xffffff, flatShading: true }), rockSpots.length);
  rockSpots.forEach((p, i) => {
    const w = between(1.8, 3.6);
    const h = between(1.4, 3.6);
    const base = gy(p.x, p.z);
    put(rocks, i, p.x, base + h / 2.4, p.z, w, h, w, rnd() * 3, pick([0xa8532c, 0x8a4424, 0xb86a3c, 0x9a5a34]));
    host.addCircle(p.x, p.z, w * 0.5, base + h * 0.9);
  });
  g.add(rocks);

  // dead trees
  const dead = spots(Math.round(90 * AREA), 7, 0.5);
  const dTrunk = instanced(new THREE.CylinderGeometry(0.18, 0.3, 1, 5), lit({ color: 0x4a3626 }), dead.length);
  const dBranch = instanced(new THREE.CylinderGeometry(0.1, 0.16, 1, 5), lit({ color: 0x4a3626 }), dead.length * 2);
  dead.forEach((p, i) => {
    const base = gy(p.x, p.z);
    const h = between(3, 5);
    put(dTrunk, i, p.x, base + h / 2, p.z, 1, h, 1);
    for (let k = 0; k < 2; k++) {
      dummy.position.set(p.x + (k ? 0.5 : -0.5), base + h * (0.6 + 0.15 * k), p.z);
      dummy.rotation.set(0, 0, (k ? -1 : 1) * 0.8);
      dummy.scale.set(1, 1.8, 1);
      dummy.updateMatrix();
      dBranch.setMatrixAt(i * 2 + k, dummy.matrix);
    }
    host.addCircle(p.x, p.z, 0.35, base + h);
  });
  g.add(dTrunk, dBranch);

  // ripples of sand, little cacti and bones (decor)
  const rippleN = Math.round(480 * AREA);
  const ripples = instanced(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }), rippleN);
  for (let i = 0; i < rippleN; i++) {
    let x = 0, z = 0;
    for (let a = 0; a < 10; a++) { x = between(-HALF + 3, HALF - 3); z = between(-HALF + 3, HALF - 3); if (heightAt(x, z) > 0.4) break; }
    put(ripples, i, x, gy(x, z) + 0.07, z, between(3, 9), 1, between(2, 5), rnd() * 3, pick([0x8a6a3a, 0xc8a468, 0x9a7440, 0xd2b078]));
  }
  g.add(ripples);
  const miniN = Math.round(800 * AREA);
  const minis = instanced(new THREE.ConeGeometry(0.3, 1, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }), miniN);
  for (let i = 0; i < miniN; i++) {
    let x = 0, z = 0;
    for (let a = 0; a < 10; a++) { x = between(-HALF + 2, HALF - 2); z = between(-HALF + 2, HALF - 2); if (heightAt(x, z) > 0.4) break; }
    const s = between(0.5, 1.2);
    put(minis, i, x, gy(x, z) + 0.45 * s, z, s, s, s, 0, pick([0x3a8a40, 0x4a9a3a, 0xa8603a, 0xd0a040]));
  }
  g.add(minis);
  const boneN = Math.round(160 * AREA);
  const bonesI = instanced(new THREE.BoxGeometry(0.9, 0.12, 0.14), new THREE.MeshBasicMaterial({ color: 0xece6d4 }), boneN);
  for (let i = 0; i < boneN; i++) {
    let x = 0, z = 0;
    for (let a = 0; a < 10; a++) { x = between(-HALF + 3, HALF - 3); z = between(-HALF + 3, HALF - 3); if (heightAt(x, z) > 0.5) break; }
    put(bonesI, i, x, gy(x, z) + 0.1, z, between(0.7, 1.6), 1, between(0.8, 1.4), rnd() * 6.28);
  }
  g.add(bonesI);

  const palm = (x: number, z: number) => {
    const base = gy(x, z);
    if (base < 0.2) return;
    const lean = between(-0.2, 0.2);
    const h = between(5.5, 8);
    const tr = mesh(new THREE.CylinderGeometry(0.22, 0.38, h, 7), 0x7a5a34, x + Math.sin(lean) * h * 0.5, base + h / 2, z);
    tr.rotation.z = -lean;
    const tx = x + Math.sin(lean) * h;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const leaf = mesh(new THREE.BoxGeometry(3.4, 0.1, 0.8), 0x2f8a3a, tx + Math.cos(a) * 1.4, base + h - 0.2, z + Math.sin(a) * 1.4);
      leaf.rotation.set(0, -a, -0.45);
    }
    sphere(tx, base + h - 0.4, z, 0.4, 0x5a3a1a);
    host.addCircle(x, z, 0.45, base + h);
  };
  const torch = (x: number, z: number) => {
    const base = gy(x, z);
    if (base < 0.1) return;
    cyl(x, z, 0.1, 0.16, 2.2, 0x4a3626, true);
    cone(x, base + 2.1, z, 0.34, 0.9, 0xff8a2a, 6, true);
  };

  for (const p of POIS) {
    const base = gy(p.x, p.z);
    switch (p.kind) {
      case 'pyramid': {
        const sizes = [24, 20.5, 17, 13.5, 10, 6.5, 3];
        let y = base;
        sizes.forEach((w, k) => {
          const m = mesh(new THREE.BoxGeometry(w, 2.2, w), k % 2 ? 0xb89050 : 0xc8a060, p.x, y + 1.1, p.z);
          void m;
          y += 2.2;
        });
        host.addRect(p.x - 12, p.z - 12, p.x + 12, p.z + 12, base + 15.4);
        mesh(new THREE.ConeGeometry(2.4, 3.4, 4), 0xffd24a, p.x, y + 1.7, p.z, true).rotation.y = Math.PI / 4;
        neon(p.x, base + 1.4, p.z + 12.05, 3.4, 2.8, 0.2, 0x2af0ff);
        neon(p.x, base + 1.3, p.z + 12.12, 2.6, 2.6, 0.2, 0x14100c);
        for (const [dx, dz] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) {
          cyl(p.x + dx, p.z + dz, 0.5, 0.8, 7, 0xc8a060, true);
          cone(p.x + dx, gy(p.x + dx, p.z + dz) + 7, p.z + dz, 0.8, 1.3, 0xffd24a, 4, true);
          neon(p.x + dx, gy(p.x + dx, p.z + dz) + 4.5, p.z + dz, 1.7, 0.18, 1.7, k4(dx, dz));
        }
        break;
      }
      case 'bazaar': {
        const cols = [0xc89a60, 0xb88a50, 0xd0a870, 0xa87a48];
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + 0.2;
          const x = p.x + Math.cos(a) * 11;
          const z = p.z + Math.sin(a) * 11;
          const top = block(x, z, 5.4, 5.4, 3.6 + (k % 3) * 0.7, cols[k % 4]);
          block(x, z, 5.8, 5.8, 0.4, 0x8a6a3a, false, top - gy(x, z));
          const awn = mesh(new THREE.BoxGeometry(5.6, 0.2, 2), pick([0xd04a4a, 0xf0e0c0, 0x2a9aa0, 0xd0a020]), x - Math.cos(a) * 3.2, gy(x, z) + 2.6, z - Math.sin(a) * 3.2);
          awn.rotation.y = -a;
        }
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          const x = p.x + Math.cos(a) * 5;
          const z = p.z + Math.sin(a) * 5;
          block(x, z, 2.2, 1.4, 1, 0x8a5a2a);
          mesh(new THREE.BoxGeometry(2.8, 0.15, 2), [0xd04a4a, 0xf0e0c0, 0x2a9aa0][k % 3], x, gy(x, z) + 2.6, z);
        }
        cyl(p.x, p.z, 1.4, 1.5, 1.1, 0x8a8e98, true);
        mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.1, 14), 0x2aa6a0, p.x, base + 1.12, p.z, true);
        break;
      }
      case 'oasis': {
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2 + rnd() * 0.2;
          const r = p.r * between(0.85, 1.25);
          palm(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r);
        }
        const hx = p.x + p.r * 1.25;
        const hz = p.z - 2;
        if (gy(hx, hz) > 0.4) { const top = block(hx, hz, 4, 4, 3, 0xc8a060); cone(hx, top, hz, 3.2, 2, 0xa86a2a, 4, false, Math.PI / 4); }
        break;
      }
      case 'mesa': {
        block(p.x - 5.5, p.z, 3.6, 4, 7, 0xa8532c);
        block(p.x + 5.5, p.z, 3.6, 4, 7, 0x9a4a28);
        mesh(new THREE.BoxGeometry(14.8, 2.6, 4.6), 0xb8603a, p.x, base + 8.3, p.z);
        mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), 0x8a8a90, p.x, base + 12.6, p.z);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), new THREE.MeshBasicMaterial({ color: 0xff7a1a, side: THREE.DoubleSide }));
        flag.position.set(p.x + 1.7, base + 14.6, p.z);
        g.add(flag);
        break;
      }
      case 'bones': {
        for (let k = 0; k < 6; k++) {
          const rib = mesh(new THREE.TorusGeometry(3.2, 0.3, 6, 14, Math.PI), 0xece6d4, p.x - 4.5 + k * 1.8, base, p.z);
          rib.rotation.y = Math.PI / 2;
        }
        mesh(new THREE.BoxGeometry(11, 0.5, 0.6), 0xece6d4, p.x, base + 0.3, p.z);
        sphere(p.x + 8.5, base + 1.5, p.z, 2.2, 0xece6d4);
        mesh(new THREE.BoxGeometry(2.4, 0.8, 2.2), 0xd8d0bc, p.x + 10, base + 0.7, p.z);
        for (const dz of [-0.9, 0.9]) mesh(new THREE.BoxGeometry(0.1, 0.8, 0.8), 0x100c08, p.x + 10.6, base + 1.9, p.z + dz, true);
        host.addCircle(p.x + 8.8, p.z, 2.2, base + 3);
        break;
      }
      case 'derrick': {
        for (const [dx, dz] of [[-4, -3], [5, 2], [-1, 8]]) {
          const x = p.x + dx;
          const z = p.z + dz;
          const b = gy(x, z);
          block(x, z, 4.2, 4.2, 5, 0x3a3a44);
          mesh(new THREE.BoxGeometry(3.2, 5, 3.2), 0x45454f, x, b + 7.5, z);
          mesh(new THREE.BoxGeometry(2.2, 5, 2.2), 0x50505c, x, b + 12.5, z);
          neon(x, b + 5, z, 4.4, 0.2, 4.4, 0xff8a1a);
          neon(x, b + 10, z, 3.4, 0.2, 3.4, 0xff8a1a);
          mesh(new THREE.CylinderGeometry(3, 3, 0.04, 14), 0x0a0810, x + 4, b + 0.06, z + 3, true);
        }
        const bx = p.x - 8;
        const bz = p.z - 2;
        block(bx, bz, 3, 6, 1, 0x4a4a54);
        block(bx, bz, 0.7, 0.7, 4, 0x4a4a54, false, 1);
        const beam = mesh(new THREE.BoxGeometry(0.6, 0.6, 6), 0x2a2a32, bx, gy(bx, bz) + 5, bz);
        beam.rotation.x = 0.2;
        for (let k = 0; k < 8; k++) cyl(p.x + 7 + (k % 4) * 1.4, p.z - 8 + Math.floor(k / 4) * 1.4, 0.6, 0.6, 1.1, k % 2 ? 0xb82a2a : 0x2a5ab8, true);
        break;
      }
      case 'camp': {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const x = p.x + Math.cos(a) * 8.5;
          const z = p.z + Math.sin(a) * 8.5;
          const b = gy(x, z);
          cone(x, b, z, 3, 3.6, [0xd04a4a, 0xf0e0c0, 0x2a9aa0, 0xd0a020, 0x9a4ad0, 0xf0e0c0][k], 4, false, Math.PI / 4);
          host.addCircle(x, z, 2.4, b + 3);
        }
        cone(p.x, base, p.z, 0.9, 2.2, 0xff8a2a, 6, true);
        mesh(new THREE.TorusGeometry(1.4, 0.2, 6, 14), 0x4a3626, p.x, base + 0.2, p.z).rotation.x = Math.PI / 2;
        for (let k = 0; k < 3; k++) {
          const x = p.x + between(-3, 3) + (k - 1) * 4;
          const z = p.z + 12 + between(-1, 1);
          const b = gy(x, z);
          const cg = new THREE.Group();
          const add = (w: number, h: number, d: number, px: number, py: number, pz: number, c: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(px, py, pz); cg.add(m); return m; };
          add(1.2, 1.3, 3, 0, 2.1, 0, 0xc08a48);
          add(0.5, 1.6, 0.5, 0, 3.1, -1.6, 0xc08a48).rotation.x = 0.3;
          add(0.6, 0.6, 1, 0, 3.9, -2, 0xb87a38);
          for (const sx of [-0.4, 0.4]) for (const sz of [-1.1, 1.1]) add(0.3, 1.5, 0.3, sx, 0.75, sz, 0xb87a38);
          const hump = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), mat(0xc08a48));
          hump.position.set(0, 2.9, 0.4);
          cg.add(hump);
          cg.position.set(x, b, z);
          cg.rotation.y = rnd() * 6.28;
          g.add(cg);
          host.addCircle(x, z, 1.3, b + 3.5);
        }
        break;
      }
      case 'pit': {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          const x = p.x + Math.cos(a) * p.r * 0.62;
          const z = p.z + Math.sin(a) * p.r * 0.62;
          cone(x, gy(x, z), z, 0.7, between(3, 5), 0xd0b070, 5);
        }
        const b = gy(p.x, p.z);
        mesh(new THREE.BoxGeometry(2.6, 1.2, 4), 0x2a1a30, p.x, b + 1, p.z);
        neon(p.x, b + 1.62, p.z, 0.4, 0.06, 3.6, 0xb02ad0);
        for (let k = 0; k < 5; k++) mesh(new THREE.BoxGeometry(0.7 - k * 0.07, 0.7 - k * 0.07, 0.9), 0x2a1a30, p.x, b + 1.4 + k * 0.75, p.z + 2.1 + k * 0.28 - (k > 2 ? (k - 2) * 0.8 : 0));
        cone(p.x, b + 5, p.z + 2.2, 0.28, 0.9, 0xb02ad0, 5, true).rotation.x = -0.4;
        for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.6, 0.5, 1.8), 0x3a2a40, p.x + sx * 1.6, b + 0.9, p.z - 2.6).rotation.y = sx * 0.4;
        host.addCircle(p.x, p.z, 2.1, b + 2);
        break;
      }
      case 'sphinx': {
        block(p.x, p.z, 5, 11, 3.2, 0xd2a468);
        mesh(new THREE.BoxGeometry(3.2, 3.6, 3.2), 0xd2a468, p.x, base + 5, p.z - 3.4);
        mesh(new THREE.BoxGeometry(4.2, 3.8, 1), 0xd0902a, p.x, base + 5, p.z - 2.1);
        for (const sx of [-0.8, 0.8]) neon(p.x + sx, base + 5.3, p.z - 5.05, 0.5, 0.3, 0.1, 0x2af0ff);
        for (const sx of [-1.4, 1.4]) mesh(new THREE.BoxGeometry(1.2, 1, 3.6), 0xc89a5a, p.x + sx, base + 0.5, p.z - 7);
        break;
      }
      case 'beach': {
        for (let k = 0; k < 9; k++) {
          const a = rnd() * Math.PI * 2;
          const r = 3 + rnd() * (p.r - 4);
          const x = p.x + Math.cos(a) * r;
          const z = p.z + Math.sin(a) * r;
          const b = gy(x, z);
          if (b < 0.1) continue;
          mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 6), 0x8a8478, x, b + 1.5, z);
          mesh(new THREE.ConeGeometry(2.1, 0.9, 8), [0xd04a4a, 0xf0e0c0, 0x2a9aa0, 0xd0a020][k % 4], x, b + 3.3, z);
          mesh(new THREE.BoxGeometry(0.9, 0.25, 2.2), 0x8a8478, x + 1.6, b + 0.2, z + 0.5);
          host.addCircle(x, z, 0.3, b + 3);
        }
        break;
      }
      case 'canyon': {
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2;
          const r = 8 + (k % 3) * 1.2;
          const x = p.x + Math.cos(a) * r;
          const z = p.z + Math.sin(a) * r;
          if (k % 5 === 0) continue;
          block(x, z, 2.5, 2.5, 4.5 + (k % 4) * 1.3, pick([0xa8532c, 0x8a4424, 0xb86a3c]));
        }
        break;
      }
      default:
        break;
    }
  }
  // torches round the built places
  for (const p of POIS) {
    if (!['pyramid', 'bazaar', 'camp', 'derrick', 'sphinx', 'mesa'].includes(p.kind)) continue;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.4;
      torch(p.x + Math.cos(a) * p.r * 0.85, p.z + Math.sin(a) * p.r * 0.85);
    }
  }
}

function k4(dx: number, dz: number): number {
  return (dx > 0) === (dz > 0) ? 0x2af0ff : 0xff3ad8;
}
