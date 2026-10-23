import * as THREE from 'three';
import type { Forest } from './forest';
import type { Gnome } from './gnomes';

const MAX = 1400;
export const SPEED = 16; // metres per second out of the gnome
export const GRAVITY = 9;
const LIFE = 2;
export const RATE = 55; // droplets per second
/** Roughly how far a stream carries. Bots use it to decide when to fire. */
export const RANGE = 11;
const PUDDLES = 64;

export type PeeKind = 'normal' | 'chili' | 'ice' | 'acid';

export interface PeeDef {
  name: string;
  color: number;
  /** hit points per droplet */
  dmg: number;
  blurb: string;
}

export const PEE: Record<PeeKind, PeeDef> = {
  normal: { name: 'Plain Pee', color: 0xf2d83a, dmg: 0.6, blurb: 'Classic.' },
  chili: { name: 'Chili Wee', color: 0xff5a14, dmg: 0.32, blurb: 'Sets them on fire.' },
  ice: { name: 'Ice Wee', color: 0x9fe8ff, dmg: 0.38, blurb: 'Slows, then freezes solid.' },
  acid: { name: 'Acid Pee', color: 0x7aff2a, dmg: 0.4, blurb: 'Melts, and they take more from everything.' },
};
export const POTION_KINDS: PeeKind[] = ['chili', 'ice', 'acid'];
const KINDS: PeeKind[] = ['normal', 'chili', 'ice', 'acid'];
const KCOL = KINDS.map((k) => new THREE.Color(PEE[k].color));

const dummy = new THREE.Object3D();
const C_PLAYER = new THREE.Color(0xfff04a);
const C_BOT = new THREE.Color(0xe0c020);

/** Every droplet in the air, drawn as one instanced mesh, plus the puddles they leave. */
export class PeeSystem {
  private mesh: THREE.InstancedMesh;
  private px = new Float32Array(MAX);
  private py = new Float32Array(MAX);
  private pz = new Float32Array(MAX);
  private vx = new Float32Array(MAX);
  private vy = new Float32Array(MAX);
  private vz = new Float32Array(MAX);
  private life = new Float32Array(MAX);
  private owner: (Gnome | null)[] = new Array(MAX).fill(null);
  private kind = new Uint8Array(MAX);
  private rgb = new Float32Array(MAX * 3);
  private tmpCol = new THREE.Color();
  private count = 0;
  private acc = new Map<number, number>();

  private puddles: THREE.InstancedMesh;
  private pAge = new Float32Array(PUDDLES).fill(99);
  private pX = new Float32Array(PUDDLES);
  private pZ = new Float32Array(PUDDLES);
  private pSize = new Float32Array(PUDDLES);
  private pNext = 0;

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, C_BOT);
    scene.add(this.mesh);

    this.puddles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.5, 0.02, 10), new THREE.MeshBasicMaterial({ color: 0xc9b020, transparent: true, opacity: 0.75, depthWrite: false }), PUDDLES);
    this.puddles.frustumCulled = false;
    scene.add(this.puddles);
    for (let i = 0; i < PUDDLES; i++) this.hidePuddle(i);
  }

  private hidePuddle(i: number) {
    dummy.position.set(0, -5, 0);
    dummy.scale.setScalar(0.0001);
    dummy.updateMatrix();
    this.puddles.setMatrixAt(i, dummy.matrix);
  }

  clear() {
    this.count = 0;
    this.mesh.count = 0;
    this.acc.clear();
    this.owner.fill(null);
    for (let i = 0; i < PUDDLES; i++) { this.pAge[i] = 99; this.hidePuddle(i); }
    this.puddles.instanceMatrix.needsUpdate = true;
  }

  /** Emit this frame's share of a stream from gnome `g`, leaving (ox, oy, oz) along the unit direction (dx, dy, dz). */
  emit(g: Gnome, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, dt: number, kind: PeeKind = 'normal', rate = 1, spreadMul = 1) {
    const a = (this.acc.get(g.id) ?? 0) + dt * RATE * rate;
    const ki = KINDS.indexOf(kind);
    const n = Math.floor(a);
    this.acc.set(g.id, a - n);
    const base = ki > 0 ? KCOL[ki] : g.isPlayer ? C_PLAYER : C_BOT;
    const wiz = g.wizard > 0;
    for (let k = 0; k < n && this.count < MAX; k++) {
      const i = this.count++;
      const sp = SPEED * (0.96 + Math.random() * 0.08);
      const back = ((k + Math.random()) / Math.max(1, n)) * dt; // spread this frame's droplets along its travel
      const spread = 0.035 * SPEED * spreadMul;
      this.vx[i] = dx * sp + (Math.random() - 0.5) * spread;
      this.vy[i] = dy * sp + (Math.random() - 0.5) * spread;
      this.vz[i] = dz * sp + (Math.random() - 0.5) * spread;
      this.px[i] = ox + this.vx[i] * back;
      this.py[i] = oy + this.vy[i] * back;
      this.pz[i] = oz + this.vz[i] * back;
      this.life[i] = LIFE;
      this.owner[i] = g;
      this.kind[i] = ki;
      const col = wiz ? this.tmpCol.setHSL(Math.random(), 1, 0.65) : base;
      this.rgb[i * 3] = col.r;
      this.rgb[i * 3 + 1] = col.g;
      this.rgb[i * 3 + 2] = col.b;
      this.mesh.setColorAt(i, col);
    }
  }

  /** Where a stream aimed this way would come down (for the aiming marker). */
  landing(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, forest: Forest, out: { x: number; z: number }): boolean {
    const vx = dx * SPEED;
    const vy = dy * SPEED;
    const vz = dz * SPEED;
    for (let t = 0.04; t < LIFE; t += 0.04) {
      const x = ox + vx * t;
      const y = oy + vy * t - 0.5 * GRAVITY * t * t;
      const z = oz + vz * t;
      if (y < 0.04 || forest.pointHit(x, y, z)) { out.x = x; out.z = z; return true; }
    }
    return false;
  }

  private remove(i: number) {
    const last = --this.count;
    if (i !== last) {
      this.px[i] = this.px[last]; this.py[i] = this.py[last]; this.pz[i] = this.pz[last];
      this.vx[i] = this.vx[last]; this.vy[i] = this.vy[last]; this.vz[i] = this.vz[last];
      this.life[i] = this.life[last];
      this.owner[i] = this.owner[last];
      this.kind[i] = this.kind[last];
      this.rgb[i * 3] = this.rgb[last * 3];
      this.rgb[i * 3 + 1] = this.rgb[last * 3 + 1];
      this.rgb[i * 3 + 2] = this.rgb[last * 3 + 2];
      this.mesh.setColorAt(i, this.tmpCol.setRGB(this.rgb[i * 3], this.rgb[i * 3 + 1], this.rgb[i * 3 + 2]));
    }
    this.owner[last] = null;
  }

  private splash(x: number, z: number) {
    const i = this.pNext;
    this.pNext = (this.pNext + 1) % PUDDLES;
    this.pAge[i] = 0;
    this.pX[i] = x;
    this.pZ[i] = z;
    this.pSize[i] = 0.8 + Math.random() * 0.9;
  }

  update(dt: number, forest: Forest, targets: Gnome[], onHit: (victim: Gnome, shooter: Gnome, kind: PeeKind, x: number, z: number) => void) {
    for (let i = this.count - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.remove(i); continue; }
      this.vy[i] -= GRAVITY * dt;
      const x = (this.px[i] += this.vx[i] * dt);
      const y = (this.py[i] += this.vy[i] * dt);
      const z = (this.pz[i] += this.vz[i] * dt);
      if (y < 0.04) {
        if (Math.random() < 0.12) this.splash(x, z);
        this.remove(i);
        continue;
      }
      if (forest.pointHit(x, y, z)) { this.remove(i); continue; }
      const shooter = this.owner[i]!;
      let hit: Gnome | null = null;
      for (let k = 0; k < targets.length; k++) {
        const t = targets[k];
        if (!t.alive || t === shooter) continue;
        const ddx = t.pos.x - x;
        const ddz = t.pos.z - z;
        if (ddx * ddx + ddz * ddz < 0.45 && y < 2.4) { hit = t; break; }
      }
      if (hit) {
        onHit(hit, shooter, KINDS[this.kind[i]], x, z);
        this.remove(i);
      }
    }
    for (let i = 0; i < this.count; i++) {
      dummy.position.set(this.px[i], this.py[i], this.pz[i]);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    for (let i = 0; i < PUDDLES; i++) {
      if (this.pAge[i] > 5) continue;
      this.pAge[i] += dt;
      const a = this.pAge[i];
      const s = this.pSize[i] * Math.min(1, a * 5) * (a > 3 ? Math.max(0, 1 - (a - 3) / 2) : 1);
      dummy.position.set(this.pX[i], 0.03, this.pZ[i]);
      dummy.scale.set(Math.max(s, 0.0001), 1, Math.max(s, 0.0001));
      dummy.updateMatrix();
      this.puddles.setMatrixAt(i, dummy.matrix);
      if (a > 5) this.hidePuddle(i);
    }
    this.puddles.instanceMatrix.needsUpdate = true;
  }

  /** A dribble on the ground where somebody went down. */
  puddleAt(x: number, z: number) {
    for (let k = 0; k < 3; k++) this.splash(x + (Math.random() - 0.5) * 1.2, z + (Math.random() - 0.5) * 1.2);
  }
}
