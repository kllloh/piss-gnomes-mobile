import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createGnome } from './gnome';
import { lit } from './organic';
import { HALF, type Forest } from './forest';
import { RANGE, SPEED as DROP_SPEED, GRAVITY, MIX, KIND_BIT, type PeeSystem } from './pee';
import type { Potions } from './potions';
import type { Bugs } from './bugs';

/** Gnomes are drawn bigger than the first-person game's, so you can see them from above. */
const VISUAL_SCALE = 1.25;
/** Eye height of a gnome, for the first-person camera. */
export const EYE = 1.5;
const BODY_R = 0.55;
const WALK = 5.2;
export const MAX_HP = 100;
const BLADDER_DRAIN = 16;
const BLADDER_REGEN = 12;
const BLADDER_UNLOCK = 30;

export interface Arena {
  forest: Forest;
  pee: PeeSystem;
  gnomes: Gnome[];
  /** Radius of the safe circle of the closing mist. */
  ringR: number;
  time: number;
  camera: THREE.Camera;
  /** Bots wait out the countdown. */
  frozen: boolean;
  potions: Potions;
  bugs: Bugs;
  /** The silly mode that is on right now, if any. */
  mod: Mod | null;
}

export type Mod = 'disco' | 'goth' | 'bogan';
export type Say = 'spot' | 'hit' | 'kill' | 'death' | 'burn' | 'freeze' | 'melt' | 'lowhp' | 'dry' | 'idle' | 'taunt';

// --- cheap models: the gnome baked into three meshes (two legs and a body) ------------------------

function bake(root: THREE.Object3D, group: THREE.Object3D, exclude?: Set<THREE.Object3D>): THREE.BufferGeometry | null {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const geos: THREE.BufferGeometry[] = [];
  const visit = (o: THREE.Object3D) => {
    if (exclude?.has(o)) return;
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      const g = m.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      const col = (m.material as THREE.MeshLambertMaterial).color;
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      geos.push(g);
    }
    o.children.forEach(visit);
  };
  group.children.forEach(visit);
  return geos.length ? mergeGeometries(geos, false) : null;
}

function makeLite(shirt: number, hat: number) {
  const model = createGnome(shirt, hat);
  const root = model.root;
  const legs: THREE.Group[] = [model.legL, model.legR];
  const legGeos = legs.map((g) => bake(root, g));
  const bodyGeo = bake(root, root, new Set<THREE.Object3D>(legs));
  const mat = lit({ vertexColors: true });
  for (const c of root.children.slice()) if (!legs.includes(c as THREE.Group)) root.remove(c);
  legs.forEach((g, i) => {
    g.clear();
    if (legGeos[i]) g.add(new THREE.Mesh(legGeos[i]!, mat));
  });
  if (bodyGeo) root.add(new THREE.Mesh(bodyGeo, mat));
  return { root, legL: model.legL, legR: model.legR, mat };
}

const SHIRTS = [0x3a8aff, 0x2ad06a, 0x3ad0ff, 0xffb02a, 0xff7a3a, 0xa070ff];

function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

let nextId = 1;

const ringGeo = new THREE.RingGeometry(0.95, 1.22, 24).rotateX(-Math.PI / 2);
const barGeo = new THREE.PlaneGeometry(1, 1);
const chevGeo = new THREE.ConeGeometry(0.34, 0.6, 4).rotateX(Math.PI); // points down

/** Elevation that lands a stream on a target `dy` higher and `d` away (the low arc). */
export function aimPitch(d: number, dy: number): number {
  const v2 = DROP_SPEED * DROP_SPEED;
  const disc = v2 * v2 - GRAVITY * (GRAVITY * d * d + 2 * dy * v2);
  if (disc < 0) return Math.PI / 4;
  return Math.atan((v2 - Math.sqrt(disc)) / (GRAVITY * d));
}

export class Gnome {
  /** Somebody went down. killer is null for the closing mist. */
  static onDeath: ((victim: Gnome, killer: Gnome | null) => void) | null = null;
  /** Somebody got hit (for sound and haptics). */
  static onHurt: ((g: Gnome) => void) | null = null;
  /** Something worth saying out loud happened to this gnome. */
  static onSay: ((g: Gnome, what: Say) => void) | null = null;

  readonly id = nextId++;
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  hp = MAX_HP;
  bladder = 100;
  locked = false;
  alive = true;
  kills = 0;
  diedAt = 0;
  /** Which way the gnome faces (the player's camera yaw). Facing is (sin yaw, cos yaw). */
  yaw = 0;
  /** Looking up (+) or down (-). */
  pitch = 0;
  /** The player's stream can be nudged off the crosshair by the touch aim assist. */
  assistYaw: number | null = null;
  assistPitch: number | null = null;

  /** Seconds left on each potion. Collect more than one and they mix. */
  potions = { chili: 0, ice: 0, acid: 0 };
  /** Dizzy from a Rainbow Cocktail: stumbling about and aiming wildly. */
  dizzy = 0;
  private acidMul = 1;

  /** Which potions are active, as mix bits (1 chili, 2 ice, 4 acid). */
  get mask(): number {
    return (this.potions.chili > 0 ? KIND_BIT.chili : 0) | (this.potions.ice > 0 ? KIND_BIT.ice : 0) | (this.potions.acid > 0 ? KIND_BIT.acid : 0);
  }
  /** Wizard Mode (from Nathaniel): seconds of being unhurtable. */
  wizard = 0;
  /** Bug bonuses: seconds of speed, bouncing, and a bladder that does not drain. */
  speedT = 0;
  bounceT = 0;
  freeT = 0;
  private vy = 0;
  burn = 0;
  acid = 0;
  chill = 0;
  frozen = 0;
  private immune = 0;
  private burnBy: Gnome | null = null;
  private acidBy: Gnome | null = null;
  /** Seconds since last hurt: health creeps back after a few quiet seconds. */
  sinceHurt = 99;
  regenerating = false;
  private saidLow = false;

  // controls, set by the player's input or the bot brain each frame
  moveX = 0;
  moveZ = 0;
  aimX = 0;
  aimZ = 0;
  hasAim = false;
  wantPee = false;
  peeing = false;

  readonly root: THREE.Group;
  private legL: THREE.Group;
  private legR: THREE.Group;
  private mat: THREE.MeshLambertMaterial;
  private wet = 0;
  walkPhase = Math.random() * 6;
  private deathT = 0;
  private lastHitBy: Gnome | null = null;
  private lastHitAt = -99;
  private marker: THREE.Mesh;
  private shadow: THREE.Mesh;
  private bar: THREE.Group;
  private barFill: THREE.Mesh;

  // bot brain
  private target: Gnome | null = null;
  private thinkT = Math.random() * 0.3;
  private strafe = Math.random() < 0.5 ? 1 : -1;
  private strafeT = 1 + Math.random() * 2;
  private wander = new THREE.Vector3();
  private wanderT = 0;
  private stuckT = 0;
  private avoidT = 0;
  private avoidDir = 1;
  private lastX = 0;
  private lastZ = 0;
  private readonly wobble = 0.08 + Math.random() * 0.14;
  private readonly dmgMul = 0.48 + Math.random() * 0.14;
  private readonly bravery = 0.7 + Math.random() * 0.6;
  private mx = 0;
  private mz = 0;
  private botPitch = 0;
  private wasPee = false;

  constructor(
    scene: THREE.Scene,
    readonly name: string,
    readonly color: number,
    readonly isPlayer: boolean,
  ) {
    const lite = makeLite(SHIRTS[Math.floor(Math.random() * SHIRTS.length)], color);
    this.root = lite.root;
    this.legL = lite.legL;
    this.legR = lite.legR;
    this.mat = lite.mat;
    this.root.scale.multiplyScalar(VISUAL_SCALE / 0.8);
    this.root.rotation.order = 'YXZ';
    scene.add(this.root);

    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.75, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    this.shadow.position.y = 0.04;
    scene.add(this.shadow);

    // a coloured marker over the head that shows through the leaves, so you can always find everybody
    this.marker = new THREE.Mesh(chevGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false }));
    this.marker.renderOrder = 8;
    this.marker.visible = !isPlayer;
    scene.add(this.marker);

    this.bar = new THREE.Group();
    const bg = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x120a22, transparent: true, opacity: 0.8, depthTest: false }));
    bg.scale.set(1.5, 0.26, 1);
    bg.renderOrder = 6;
    this.barFill = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color, depthTest: false }));
    this.barFill.renderOrder = 7;
    this.barFill.position.z = 0.01;
    this.bar.add(bg, this.barFill);
    scene.add(this.bar);
  }

  spawn(at: THREE.Vector3) {
    this.pos.copy(at);
    this.vel.set(0, 0, 0);
    this.hp = MAX_HP;
    this.bladder = 100;
    this.locked = false;
    this.alive = true;
    this.kills = 0;
    this.wet = 0;
    this.deathT = 0;
    this.lastHitBy = null;
    this.target = null;
    this.potions.chili = this.potions.ice = this.potions.acid = 0;
    this.dizzy = 0;
    this.acidMul = 1;
    this.wizard = 0;
    this.speedT = this.bounceT = this.freeT = 0;
    this.vy = 0;
    this.burn = this.acid = this.chill = this.frozen = this.immune = 0;
    this.sinceHurt = 99;
    this.saidLow = false;
    this.regenerating = false;
    this.yaw = Math.atan2(-at.x, -at.z) + (Math.random() - 0.5) * 0.6; // facing the middle
    this.root.visible = this.shadow.visible = this.bar.visible = true;
    this.marker.visible = !this.isPlayer;
    this.pitch = 0;
    this.assistYaw = this.assistPitch = null;
    this.root.rotation.set(0, 0, 0);
    this.mat.emissive.setHex(0);
    this.moveX = this.moveZ = 0;
    this.wantPee = this.peeing = this.hasAim = false;
    this.wanderT = 0;
    this.lastX = at.x;
    this.lastZ = at.z;
    this.syncVisual(0);
  }

  /** A droplet landed on this gnome. `mask` is the stream's potion mix (0 = plain pee). */
  hit(mask: number, mul: number, from: Gnome, time: number) {
    if (!this.alive || this.wizard > 0) return;
    this.sinceHurt = 0;
    this.wet = 0.35;
    this.lastHitBy = from;
    this.lastHitAt = time;
    let taken = (this.acid > 0 ? 1.25 : 1) * mul;
    if (mask & 2 && mask & 4 && this.frozen > 0) taken *= 1.6; // cryo-acid shatters the frozen
    if (mask === 3 || mask === 7) { if (this.burn > 0 && this.chill > 0.3) taken *= 2; } // thermal shock
    this.hp -= MIX[mask].dmg * taken;
    if (mask & 1) {
      if (this.burn <= 0) Gnome.onSay?.(this, 'burn');
      this.burn = mask & 4 ? 5 : 3.2;
      this.burnBy = from;
    }
    if (mask & 4) {
      if (this.acid <= 0) Gnome.onSay?.(this, 'melt');
      this.acid = 4.5;
      this.acidBy = from;
      this.acidMul = mask & 2 ? 2 : 1;
    }
    if (mask & 2 && this.frozen <= 0 && this.immune <= 0) {
      this.chill = Math.min(1, this.chill + 0.045);
      if (this.chill >= 1) {
        this.frozen = 2.2;
        Gnome.onSay?.(this, 'freeze');
      }
    }
    if (mask === 7) this.dizzy = 3.5;
    Gnome.onHurt?.(this);
    if (this.hp <= 0) this.die(from, time);
    else Gnome.onSay?.(this, 'hit');
  }

  /** Napalm: set this gnome alight (from somebody else's fire). */
  ignite(from: Gnome | null) {
    if (!this.alive || this.wizard > 0) return;
    if (this.burn <= 0) Gnome.onSay?.(this, 'burn');
    this.burn = Math.max(this.burn, 3);
    this.burnBy = from;
  }

  /** Burning and acid: quiet damage over time. */
  private dot(amount: number, from: Gnome | null, time: number) {
    if (this.wizard > 0) return;
    this.hp -= amount;
    this.sinceHurt = 0;
    if (from) { this.lastHitBy = from; this.lastHitAt = time; }
    if (this.hp <= 0) this.die(from, time);
  }

  /** The mist: damage that is credited to whoever last wet you, if that was recent. */
  mist(amount: number, time: number) {
    if (!this.alive || this.wizard > 0) return;
    this.hp -= amount;
    this.sinceHurt = 0;
    this.wet = 0.2;
    if (this.hp <= 0) this.die(time - this.lastHitAt < 6 ? this.lastHitBy : null, time);
  }

  private die(killer: Gnome | null, time: number) {
    this.hp = 0;
    this.alive = false;
    this.diedAt = time;
    this.deathT = 0;
    this.peeing = this.wantPee = false;
    this.burn = this.acid = this.chill = this.frozen = 0;
    if (killer && killer !== this) { killer.kills++; Gnome.onSay?.(killer, 'kill'); }
    Gnome.onSay?.(this, 'death');
    this.marker.visible = this.bar.visible = false;
    Gnome.onDeath?.(this, killer && killer !== this ? killer : null);
  }

  /** A hop. Only from the ground, and not while frozen. */
  jump() {
    if (this.alive && this.pos.y <= 0.02 && this.frozen <= 0) this.vy = 8;
  }

  // --- the bot brain -------------------------------------------------------------------------------

  private pickTarget(A: Arena) {
    let best: Gnome | null = null;
    let bd = 17;
    const cur = this.target && this.target.alive ? this.target : null;
    for (const g of A.gnomes) {
      if (g === this || !g.alive) continue;
      const d = Math.hypot(g.pos.x - this.pos.x, g.pos.z - this.pos.z);
      if (d < bd - (g === cur ? 4 : 0)) { bd = d; best = g; }
    }
    if (best && best !== cur) Gnome.onSay?.(this, 'spot');
    this.target = best;
  }

  private blocked(A: Arena, tx: number, tz: number): boolean {
    for (let k = 1; k <= 5; k++) {
      const t = k / 6;
      if (A.forest.pointHit(this.pos.x + (tx - this.pos.x) * t, 0.7, this.pos.z + (tz - this.pos.z) * t)) return true;
    }
    return false;
  }

  private think(dt: number, A: Arena) {
    this.wantPee = false;
    this.hasAim = false;
    this.mx = this.mz = 0;
    if (A.frozen) return;

    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.2 + Math.random() * 0.15;
      this.pickTarget(A);
    }
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeT = 1.2 + Math.random() * 2.2; this.strafe = -this.strafe; }

    const dc = Math.hypot(this.pos.x, this.pos.z);
    const tgt = this.target && this.target.alive ? this.target : null;
    const outside = dc > A.ringR - 3.5;

    if (tgt) {
      const dx = tgt.pos.x - this.pos.x;
      const dz = tgt.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const nx = dx / d;
      const nz = dz / d;
      const scared = this.bladder < 16 || (this.hp < 30 && tgt.hp > this.hp * this.bravery);
      if (scared) {
        this.mx = -nx - nz * this.strafe * 0.5;
        this.mz = -nz + nx * this.strafe * 0.5;
      } else if (d > RANGE * 0.8) {
        this.mx = nx + -nz * this.strafe * 0.3;
        this.mz = nz + nx * this.strafe * 0.3;
      } else if (d < 3) {
        this.mx = -nx * 0.7 - nz * this.strafe;
        this.mz = -nz * 0.7 + nx * this.strafe;
      } else {
        this.mx = -nz * this.strafe * 0.85 + nx * 0.15;
        this.mz = nx * this.strafe * 0.85 + nz * 0.15;
      }
      // aim a little ahead of a moving target, with a wobble that is different for every bot
      const lead = 0.18;
      const ax = dx + tgt.vel.x * lead;
      const az = dz + tgt.vel.z * lead;
      const ang = Math.atan2(ax, az) + Math.sin(A.time * 2.1 + this.id * 1.7) * this.wobble;
      this.aimX = Math.sin(ang);
      this.aimZ = Math.cos(ang);
      this.botPitch = aimPitch(Math.max(d, 1), 0.9 - 0.75 + tgt.pos.y - this.pos.y);
      this.hasAim = true;
      const clear = !this.blocked(A, tgt.pos.x, tgt.pos.z);
      this.wantPee = d < RANGE * 0.97 && !scared && clear && !this.locked && this.bladder > 2 && Math.abs(angleDiff(this.yaw, ang)) < 0.35;
      // shout a taunt as the stream starts
      if (this.wantPee && !this.wasPee && Math.random() < 0.4) Gnome.onSay?.(this, 'taunt');
      this.wasPee = this.wantPee;
    } else {
      // nobody around: stroll between random spots
      this.wanderT -= dt;
      const bonus = A.bugs.nearestBonus(this.pos.x, this.pos.z, 22);
      const pot = this.mask !== 7 ? A.potions.nearest(this.pos.x, this.pos.z, 26, this.mask) : null;
      const goal = bonus ?? pot;
      if (goal) this.wander.set(goal.x, 0, goal.z);
      else if (this.wanderT <= 0 || Math.hypot(this.wander.x - this.pos.x, this.wander.z - this.pos.z) < 1.5) {
        const lim = Math.max(6, Math.min(A.ringR - 6, HALF - 4));
        this.wander.copy(A.forest.randomFree(lim));
        this.wanderT = 5 + Math.random() * 4;
      }
      const dx = this.wander.x - this.pos.x;
      const dz = this.wander.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      this.mx = (dx / d) * 0.75;
      this.mz = (dz / d) * 0.75;
    }

    if (outside) {
      // the mist is coming: head for the middle, whatever else is going on
      this.mx = this.mx * 0.3 - (this.pos.x / dc) * 1.1;
      this.mz = this.mz * 0.3 - (this.pos.z / dc) * 1.1;
    }

    // not getting anywhere (tree in the way)? sidestep for a moment
    this.stuckT += dt;
    if (this.stuckT > 0.5) {
      const moved = Math.hypot(this.pos.x - this.lastX, this.pos.z - this.lastZ);
      if (Math.hypot(this.mx, this.mz) > 0.5 && moved < 0.5 * WALK * 0.5 * 0.35) {
        this.avoidT = 0.7;
        this.avoidDir = Math.random() < 0.5 ? 1 : -1;
      }
      this.lastX = this.pos.x;
      this.lastZ = this.pos.z;
      this.stuckT = 0;
    }
    if (this.avoidT > 0) this.avoidT -= dt;
    if (this.dizzy > 0) {
      // a Rainbow Cocktail: wander drunkenly and spray in the wrong direction
      this.mx = Math.sin(A.time * 3.1 + this.id) + this.mx * 0.3;
      this.mz = Math.cos(A.time * 2.7 + this.id * 2) + this.mz * 0.3;
      this.aimX = Math.sin(A.time * 2 + this.id);
      this.aimZ = Math.cos(A.time * 2 + this.id);
      this.hasAim = true;
    }
    this.moveX = this.mx;
    this.moveZ = this.mz;
  }

  // --- per-frame update ----------------------------------------------------------------------------

  update(dt: number, A: Arena) {
    if (!this.alive) {
      this.deathT += dt;
      const f = Math.min(1, this.deathT / 0.5);
      this.root.rotation.x = f * 1.45; // flops onto its back
      this.root.position.y = -0.1 * f;
      this.shadow.visible = this.deathT < 4;
      this.root.visible = this.deathT < 4.5;
      this.syncVisual(dt);
      return;
    }

    // statuses, health coming back, and the potion running out
    this.sinceHurt += dt;
    if (this.wizard > 0) { this.wizard -= dt; this.burn = this.acid = this.chill = this.frozen = 0; }
    this.speedT = Math.max(0, this.speedT - dt);
    this.freeT = Math.max(0, this.freeT - dt);
    // bouncing: hop whenever you land, for as long as it lasts
    if (this.bounceT > 0) { this.bounceT -= dt; if (this.pos.y <= 0.001 && this.frozen <= 0) this.vy = 8; }
    this.vy -= 24 * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y < 0) { this.pos.y = 0; this.vy = 0; }
    if (this.burn > 0) { this.burn -= dt; this.dot(8 * dt, this.burnBy, A.time); if (this.wet > 0.2) this.burn = Math.min(this.burn, 0.4); }
    if (this.acid > 0) { this.acid -= dt; this.dot(5 * this.acidMul * dt, this.acidBy, A.time); }
    if (this.frozen > 0) { this.frozen -= dt; if (this.frozen <= 0) { this.immune = 3; this.chill = 0; } }
    else this.chill = Math.max(0, this.chill - dt * 0.3);
    this.immune = Math.max(0, this.immune - dt);
    for (const k of ['chili', 'ice', 'acid'] as const) if (this.potions[k] > 0) this.potions[k] = Math.max(0, this.potions[k] - dt);
    this.dizzy = Math.max(0, this.dizzy - dt);
    this.regenerating = this.alive && this.sinceHurt > 4 && this.burn <= 0 && this.acid <= 0 && this.hp < MAX_HP && A.mod !== 'goth';
    if (this.regenerating) this.hp = Math.min(MAX_HP, this.hp + 7 * dt);
    if (this.hp < 25 && !this.saidLow) { this.saidLow = true; Gnome.onSay?.(this, 'lowhp'); }
    if (this.hp > 55) this.saidLow = false;
    if (!this.alive) return;

    if (!this.isPlayer) this.thinkWithAvoid(dt, A);

    // movement
    const frozen = A.frozen || this.frozen > 0;
    const mlen = Math.hypot(this.moveX, this.moveZ);
    const scale = mlen > 1 ? 1 / mlen : 1;
    const speed = WALK * (this.peeing ? 0.72 : 1) * (this.bladder < 1 ? 0.9 : 1) * (1 - 0.6 * this.chill) * (A.mod === 'disco' ? 1.12 : 1) * (this.speedT > 0 ? 1.55 : 1);
    const tx = frozen ? 0 : this.moveX * scale * speed;
    const tz = frozen ? 0 : this.moveZ * scale * speed;
    const k = 1 - Math.exp(-14 * dt);
    this.vel.x += (tx - this.vel.x) * k;
    this.vel.z += (tz - this.vel.z) * k;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    A.forest.collide(this.pos, BODY_R);
    for (const o of A.gnomes) {
      if (o === this || !o.alive) continue;
      const dx = this.pos.x - o.pos.x;
      const dz = this.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 1.2 && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (1.1 - d) * 0.5;
        this.pos.x += (dx / d) * push;
        this.pos.z += (dz / d) * push;
      }
    }
    const lim = HALF - 1.2;
    this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x));
    this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z));

    // facing: where you aim, or the way you walk
    const speedNow = Math.hypot(this.vel.x, this.vel.z);
    let want: number | null = null;
    if (this.hasAim) want = Math.atan2(this.aimX, this.aimZ);
    else if (speedNow > 0.8) want = Math.atan2(this.vel.x, this.vel.z);
    if (want !== null && !this.isPlayer) {
      const turn = 1 - Math.exp(-(this.hasAim ? 22 : 12) * dt);
      this.yaw += angleDiff(this.yaw, want) * turn;
    }

    // the stream
    if (this.wantPee && !this.locked && this.bladder > 0 && !frozen) {
      this.peeing = true;
      this.bladder -= BLADDER_DRAIN * (A.mod === 'bogan' ? 0.35 : 1) * (this.freeT > 0 ? 0 : 1) * dt;
      const sy = this.isPlayer ? this.assistYaw ?? this.yaw : this.yaw;
      const sp = this.isPlayer ? this.assistPitch ?? this.pitch : this.botPitch;
      const cp = Math.cos(sp);
      const fx = Math.sin(sy);
      const fz = Math.cos(sy);
      A.pee.emit(this, this.pos.x + fx * 0.5, 0.75 + this.pos.y, this.pos.z + fz * 0.5, fx * cp, Math.sin(sp), fz * cp, dt, this.mask, A.mod === 'disco' ? 1.3 : 1, A.mod === 'bogan' ? 2.2 : 1);
      if (this.bladder <= 0) { this.bladder = 0; this.locked = true; this.peeing = false; Gnome.onSay?.(this, 'dry'); }
    } else {
      this.peeing = false;
      this.bladder = Math.min(100, this.bladder + BLADDER_REGEN * dt);
      if (this.locked && this.bladder >= BLADDER_UNLOCK) this.locked = false;
    }

    this.wet = Math.max(0, this.wet - dt);
    this.walkPhase += speedNow * dt * 2.4;
    this.syncVisual(dt);
  }

  /** The brain and its sidestep, kept apart so the brain stays readable. */
  private thinkWithAvoid(dt: number, A: Arena) {
    this.think(dt, A);
    if (this.avoidT > 0) {
      const l = Math.hypot(this.mx, this.mz) || 1;
      // a quarter turn from where the bot wanted to go
      this.moveX = (-this.mz / l) * this.avoidDir;
      this.moveZ = (this.mx / l) * this.avoidDir;
    }
  }

  private syncVisual(_dt: number) {
    this.root.position.x = this.pos.x;
    this.root.position.z = this.pos.z;
    if (this.alive) this.root.position.y = this.pos.y + Math.abs(Math.sin(this.walkPhase)) * 0.05 * Math.min(1, Math.hypot(this.vel.x, this.vel.z));
    this.root.rotation.y = this.yaw + Math.PI; // the model's face is -z
    if (this.alive) this.root.rotation.x = this.peeing ? 0.22 : 0;
    const sw = Math.sin(this.walkPhase) * 0.7 * Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 2);
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    // glow: ice, fire and acid show on the body; otherwise a yellow flash when wet
    if (this.frozen > 0) this.mat.emissive.setRGB(0.25, 0.6, 0.9);
    else if (this.burn > 0) this.mat.emissive.setRGB(0.7 + 0.3 * Math.sin(this.walkPhase * 9 + this.id), 0.25, 0);
    else if (this.acid > 0) this.mat.emissive.setRGB(0.1, 0.55, 0.05);
    else if (this.chill > 0.1) this.mat.emissive.setRGB(0.1 * this.chill, 0.35 * this.chill, 0.55 * this.chill);
    else this.mat.emissive.setRGB(this.wet * 1.4, this.wet * 1.1, 0);
    this.shadow.position.x = this.pos.x;
    this.shadow.position.z = this.pos.z;
    this.marker.position.set(this.pos.x, this.pos.y + 4.5 + Math.sin(this.walkPhase * 0.5 + this.id) * 0.1, this.pos.z);
    this.bar.position.set(this.pos.x, this.pos.y + 3.9, this.pos.z);
    const f = Math.max(0, this.hp / MAX_HP);
    this.barFill.scale.set(1.42 * f, 0.18, 1);
    this.barFill.position.x = -0.71 * (1 - f);
    this.bar.visible = this.alive && !this.isPlayer;
    // you cannot see your own gnome from inside its head
    if (this.isPlayer && this.alive) this.root.visible = this.shadow.visible = false;
  }

  /** Mode colours for the body (null = the gnome's own colours). */
  setTint(rgb: [number, number, number] | null) {
    if (rgb) this.mat.color.setRGB(rgb[0], rgb[1], rgb[2]);
    else this.mat.color.setRGB(1, 1, 1);
  }

  /** Face the bar towards the camera (called once per frame by the game). */
  billboard(cam: THREE.Camera) {
    this.bar.quaternion.copy(cam.quaternion);
  }

  /** For hit tests and the minimap. */
  get dmg(): number {
    return this.isPlayer ? 1 : this.dmgMul;
  }
}
