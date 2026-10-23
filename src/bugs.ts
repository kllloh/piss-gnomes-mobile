import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HALF, type Forest } from './forest';
import { heightAt } from './map';
import { MAX_HP, type Gnome } from './gnomes';

export type BonusKind = 'speed' | 'health' | 'bounce' | 'gulp';
export const BONUS_INFO: Record<BonusKind, { name: string; blurb: string; color: number }> = {
  speed: { name: 'SPEED BOOST', blurb: 'Zoom! You run much faster for 10 seconds.', color: 0x19e3ff },
  health: { name: 'HEALTH', blurb: 'A big dollop of health.', color: 0xff4a6a },
  bounce: { name: 'BOUNCE', blurb: 'Boing! You bounce around for 12 seconds.', color: 0xff2bd6 },
  gulp: { name: 'BIG GULP', blurb: 'Bladder refilled, and it will not drain for 8 seconds.', color: 0xffd23c },
};
const KINDS: BonusKind[] = ['speed', 'health', 'bounce', 'gulp'];

const BUG_COUNT = 18;
const BONUS_LIFE = 16;
const GRAB = 1.5;
const PUFFS = 36;

const SHELLS = [0x2f9a5a, 0xd8742a, 0x7a4fb0, 0x2a8ad0, 0xc03a5a, 0x9ab02a];

interface Bug {
  root: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  tail: THREE.Group;
  pos: THREE.Vector3;
  yaw: number;
  goal: THREE.Vector3;
  goalT: number;
  walk: number;
  /** Counts down to the next fart. */
  fartIn: number;
  /** While > 0 the bug is mid-fart: stopped, shaking, tail up. */
  farting: number;
  stuckT: number;
  lastX: number;
  lastZ: number;
  avoidT: number;
  avoidDir: number;
  farted: boolean;
}

interface Bonus {
  x: number;
  z: number;
  kind: BonusKind;
  life: number;
  group: THREE.Group;
  gem: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

interface Puff {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  max: number;
  mat: THREE.MeshBasicMaterial;
}

const gemGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
const ringGeo = new THREE.RingGeometry(0.7, 0.95, 20).rotateX(-Math.PI / 2);
const puffGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);

/** A blocky voxel beetle: stacked cubes for the shell, cube eyes, stick legs. Front is -z. */
function makeBug(shell: number): { root: THREE.Group; legs: THREE.Group[]; tail: THREE.Group; body: THREE.Group } {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const mats = new Map<number, THREE.MeshLambertMaterial>();
  const mat = (c: number) => {
    let m = mats.get(c);
    if (!m) { m = new THREE.MeshLambertMaterial({ color: c }); mats.set(c, m); }
    return m;
  };
  const box = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, c: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const dark = 0x2a1a3a;
  // a stepped, blocky shell
  box(body, 1.5, 0.45, 2.1, 0, 0.62, 0.1, shell);
  box(body, 1.2, 0.45, 1.8, 0, 1.07, 0.1, shell);
  box(body, 0.8, 0.3, 1.2, 0, 1.45, 0.1, shell);
  // a dark stripe down the middle and some cream spots
  box(body, 0.14, 0.08, 1.9, 0, 1.32, 0.1, dark);
  for (let i = 0; i < 6; i++) box(body, 0.2, 0.2, 0.2, i % 2 ? 0.46 : -0.46, 1.1 + (i % 3) * 0.05, -0.45 + i * 0.3, 0xfff3c0);
  // chunky head with square eyes and antennae
  box(body, 0.7, 0.6, 0.6, 0, 0.7, -1.2, dark);
  for (const sx of [-0.2, 0.2]) {
    box(body, 0.24, 0.24, 0.1, sx, 0.88, -1.52, 0xffffff);
    box(body, 0.1, 0.1, 0.1, sx, 0.88, -1.58, 0x000000);
    box(body, 0.08, 0.5, 0.08, sx * 1.6, 1.25, -1.35, dark);
    box(body, 0.2, 0.14, 0.2, sx * 1.6, 1.54, -1.4, 0xff5aa5);
  }
  // six cube-footed legs
  const legs: THREE.Group[] = [];
  for (let i = 0; i < 6; i++) {
    const leg = new THREE.Group();
    const side = i % 2 ? 1 : -1;
    leg.position.set(side * 0.72, 0.5, -0.6 + Math.floor(i / 2) * 0.7);
    box(leg, 0.5, 0.12, 0.12, side * 0.22, -0.05, 0, dark);
    box(leg, 0.14, 0.45, 0.14, side * 0.5, -0.28, 0, dark);
    root.add(leg);
    legs.push(leg);
  }
  // the business end, which lifts when it is time
  const tail = new THREE.Group();
  tail.position.set(0, 0.55, 1.25);
  box(tail, 0.45, 0.45, 0.45, 0, 0, 0, 0x6a4a2a);
  body.add(tail);
  root.add(body);
  root.scale.setScalar(0.6);
  return { root, legs, tail, body };
}

// --- baked bugs: one draw call each for the body, the two sets of legs and the tail, sharing geometry between bugs ---

function bakeObjects(frame: THREE.Object3D, objects: THREE.Object3D[], exclude?: THREE.Object3D): THREE.BufferGeometry {
  frame.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(frame.matrixWorld).invert();
  const geos: THREE.BufferGeometry[] = [];
  const visit = (o: THREE.Object3D) => {
    if (o === exclude) return;
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      const g = m.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      const col = (m.material as THREE.MeshLambertMaterial).color;
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      // merging needs every geometry to be non-indexed or all indexed
      geos.push(g.index ? g.toNonIndexed() : g);
    }
    o.children.forEach(visit);
  };
  objects.forEach(visit);
  return mergeGeometries(geos, false)!;
}

interface BugGeo {
  body: THREE.BufferGeometry;
  legL: THREE.BufferGeometry;
  legR: THREE.BufferGeometry;
  tail: THREE.BufferGeometry;
}
const PIVOT_L = new THREE.Vector3(-0.72, 0.5, 0.1);
const PIVOT_R = new THREE.Vector3(0.72, 0.5, 0.1);
const bugGeos = new Map<number, BugGeo>();
const bugMat = new THREE.MeshLambertMaterial({ vertexColors: true });

function buildBug(shell: number): { root: THREE.Group; legL: THREE.Group; legR: THREE.Group; tail: THREE.Group } {
  let g = bugGeos.get(shell);
  if (!g) {
    const m = makeBug(shell);
    m.root.scale.setScalar(1);
    const left = m.legs.filter((_, i) => i % 2 === 0);
    const right = m.legs.filter((_, i) => i % 2 === 1);
    g = {
      body: bakeObjects(m.root, [m.body], m.tail),
      legL: bakeObjects(m.root, left).translate(-PIVOT_L.x, -PIVOT_L.y, -PIVOT_L.z),
      legR: bakeObjects(m.root, right).translate(-PIVOT_R.x, -PIVOT_R.y, -PIVOT_R.z),
      tail: bakeObjects(m.tail, [m.tail]),
    };
    bugGeos.set(shell, g);
  }
  const root = new THREE.Group();
  const body = new THREE.Mesh(g.body, bugMat);
  const legL = new THREE.Group();
  legL.position.copy(PIVOT_L);
  legL.add(new THREE.Mesh(g.legL, bugMat));
  const legR = new THREE.Group();
  legR.position.copy(PIVOT_R);
  legR.add(new THREE.Mesh(g.legR, bugMat));
  const tail = new THREE.Group();
  tail.position.set(0, 0.55, 1.25);
  tail.add(new THREE.Mesh(g.tail, bugMat));
  root.add(body, legL, legR);
  root.add(tail);
  root.scale.setScalar(0.6);
  return { root, legL, legR, tail };
}

/** Bugs wander the forest, stop, shudder and fart out a random bonus. Anybody can walk into it. */
export class Bugs {
  private bugs: Bug[] = [];
  private bonuses: Bonus[] = [];
  private puffs: Puff[] = [];
  private nextPuff = 0;
  private scene: THREE.Scene;
  /** A bug has just let one go (position), for sound and banter. */
  onFart: ((x: number, z: number) => void) | null = null;

  constructor(scene: THREE.Scene, private forest: Forest) {
    this.scene = scene;
    for (let i = 0; i < BUG_COUNT; i++) {
      const m = buildBug(SHELLS[i % SHELLS.length]);
      const pos = forest.randomFree(HALF - 6);
      m.root.position.copy(pos);
      scene.add(m.root);
      this.bugs.push({
        root: m.root, legL: m.legL, legR: m.legR, tail: m.tail, pos, yaw: Math.random() * 6, goal: pos.clone(), goalT: 0, walk: Math.random() * 6,
        fartIn: 4 + Math.random() * 10, farting: 0, stuckT: 0, lastX: pos.x, lastZ: pos.z, avoidT: 0, avoidDir: 1, farted: false,
      });
    }
    for (let i = 0; i < PUFFS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x9aff4a, transparent: true, opacity: 0, depthWrite: false });
      const mesh = new THREE.Mesh(puffGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.puffs.push({ mesh, vel: new THREE.Vector3(), life: 0, max: 1, mat });
    }
  }

  reset() {
    for (const b of this.bugs) { b.fartIn = 5 + Math.random() * 10; b.farting = 0; }
    for (const bo of this.bonuses) this.scene.remove(bo.group);
    this.bonuses.length = 0;
    for (const p of this.puffs) { p.life = 0; p.mesh.visible = false; }
  }

  /** The nearest bonus lying about within `maxD`, or null. */
  nearestBonus(x: number, z: number, maxD: number): { x: number; z: number } | null {
    let best: Bonus | null = null;
    let bd = maxD;
    for (const b of this.bonuses) {
      const d = Math.hypot(b.x - x, b.z - z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  /** Every bonus, for the minimap. */
  get lying(): { x: number; z: number; color: number }[] {
    return this.bonuses.map((b) => ({ x: b.x, z: b.z, color: BONUS_INFO[b.kind].color }));
  }

  private puff(x: number, y: number, z: number) {
    const p = this.puffs[this.nextPuff];
    this.nextPuff = (this.nextPuff + 1) % PUFFS;
    p.life = p.max = 1.2 + Math.random() * 0.8;
    p.mesh.visible = true;
    p.mesh.position.set(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4);
    p.vel.set((Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 0.7, (Math.random() - 0.5) * 1.2);
    p.mat.color.setHSL(0.22 + Math.random() * 0.1, 0.9, 0.5);
  }

  private spawnBonus(x: number, z: number) {
    const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
    const color = BONUS_INFO[kind].color;
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color });
    const gem = new THREE.Mesh(gemGeo, mat);
    gem.scale.set(1, 1.5, 1);
    gem.position.y = 1.5;
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
    ring.position.y = 0.08;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 9, 8, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.y = 4.5;
    group.add(gem, ring, beam);
    group.position.set(x, heightAt(x, z), z);
    this.scene.add(group);
    this.bonuses.push({ x, z, kind, life: BONUS_LIFE, group, gem, mat });
  }

  update(dt: number, t: number, ringR: number, gnomes: Gnome[], active: boolean, onPick: (g: Gnome, kind: BonusKind) => void) {
    // --- the bugs ---
    for (const b of this.bugs) {
      let speed = 1.7;
      if (b.farting > 0) {
        b.farting -= dt;
        speed = 0;
        b.root.position.x = b.pos.x + Math.sin(t * 60) * 0.04; // shudder
        b.tail.position.y = 0.75 + Math.sin(t * 40) * 0.05;
        b.tail.rotation.x = -0.5;
        // the gas comes out halfway through
        if (!b.farted && b.farting < 0.6) {
          b.farted = true;
          const tx = b.pos.x + Math.sin(b.yaw) * -0.8;
          const tz = b.pos.z + Math.cos(b.yaw) * -0.8;
          for (let i = 0; i < 9; i++) this.puff(tx, heightAt(tx, tz) + 0.7, tz);
          if (active) {
            const spot = { x: b.pos.x - Math.sin(b.yaw) * 1.4, z: b.pos.z - Math.cos(b.yaw) * 1.4 };
            this.forest.collide(spot, 0.6);
            this.spawnBonus(spot.x, spot.z);
          }
          this.onFart?.(tx, tz);
        }
      } else {
        b.tail.position.y = 0.5;
        b.tail.rotation.x = 0;
        b.root.position.x = b.pos.x;
        if (active) b.fartIn -= dt;
        if (b.fartIn <= 0) {
          b.fartIn = 8 + Math.random() * 7;
          b.farting = 1.3;
          b.farted = false;
          speed = 0;
        }
        b.goalT -= dt;
        if (b.goalT <= 0 || Math.hypot(b.goal.x - b.pos.x, b.goal.z - b.pos.z) < 1.2) {
          b.goal.copy(this.forest.randomFree(Math.max(8, Math.min(ringR - 5, HALF - 5))));
          b.goalT = 5 + Math.random() * 5;
        }
        let dx = b.goal.x - b.pos.x;
        let dz = b.goal.z - b.pos.z;
        b.stuckT += dt;
        if (b.stuckT > 0.6) {
          if (Math.hypot(b.pos.x - b.lastX, b.pos.z - b.lastZ) < 0.3) { b.avoidT = 0.9; b.avoidDir = Math.random() < 0.5 ? 1 : -1; b.goalT = Math.min(b.goalT, 0.6); }
          b.lastX = b.pos.x;
          b.lastZ = b.pos.z;
          b.stuckT = 0;
        }
        if (b.avoidT > 0) {
          b.avoidT -= dt;
          const l = Math.hypot(dx, dz) || 1;
          [dx, dz] = [(-dz / l) * b.avoidDir + (dx / l) * 0.2, (dx / l) * b.avoidDir + (dz / l) * 0.2];
        }
        const d = Math.hypot(dx, dz) || 1;
        let diff = Math.atan2(dx, dz) - b.yaw;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        b.yaw += diff * Math.min(1, dt * 5);
        b.pos.x += (dx / d) * speed * dt;
        b.pos.z += (dz / d) * speed * dt;
        this.forest.collide(b.pos, 0.35);
        b.root.position.z = b.pos.z;
        b.root.position.x = b.pos.x;
      }
      if (speed > 0) b.walk += dt * 12;
      b.root.position.z = b.pos.z;
      b.root.position.y = heightAt(b.pos.x, b.pos.z);
      b.root.rotation.y = b.yaw + Math.PI;
      b.legL.rotation.y = speed > 0 ? Math.sin(b.walk) * 0.35 : 0;
      b.legR.rotation.y = speed > 0 ? -Math.sin(b.walk) * 0.35 : 0;
    }

    // --- gas clouds ---
    for (const p of this.puffs) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      const f = 1 - p.life / p.max;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(0.5 + f * 2.4);
      p.mesh.rotation.x += dt * 2;
      p.mesh.rotation.y += dt * 3;
      p.mat.opacity = 0.55 * (1 - f);
    }

    // --- bonuses: spin, expire, get picked up ---
    for (let i = this.bonuses.length - 1; i >= 0; i--) {
      const bo = this.bonuses[i];
      bo.life -= dt;
      bo.gem.rotation.y = t * 3;
      bo.gem.rotation.x = 0.6;
      bo.gem.position.y = 1.5 + Math.sin(t * 3 + bo.x) * 0.2;
      bo.group.visible = bo.life > 3 || Math.floor(bo.life * 6) % 2 === 0; // blinks when about to go
      let taken = false;
      if (active) {
        for (const g of gnomes) {
          if (!g.alive) continue;
          const dx = g.pos.x - bo.x;
          const dz = g.pos.z - bo.z;
          if (dx * dx + dz * dz < GRAB * GRAB) {
            applyBonus(g, bo.kind);
            onPick(g, bo.kind);
            taken = true;
            break;
          }
        }
      }
      if (taken || bo.life <= 0) {
        this.scene.remove(bo.group);
        this.bonuses.splice(i, 1);
      }
    }
  }
}

export function applyBonus(g: Gnome, kind: BonusKind) {
  if (kind === 'speed') g.speedT = 10;
  else if (kind === 'bounce') g.bounceT = 12;
  else if (kind === 'health') { g.hp = Math.min(MAX_HP, g.hp + 50); g.burn = g.acid = 0; }
  else { g.bladder = 100; g.locked = false; g.freeT = 8; }
}
