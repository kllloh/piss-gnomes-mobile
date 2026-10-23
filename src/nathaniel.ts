import * as THREE from 'three';
import { SoftBox, lit } from './organic';
import { HALF, type Forest } from './forest';

/** The back-of-a-van metal band on his T-shirt. */
function shirtTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#101010';
  ctx.fillRect(0, 0, 128, 128);
  // lightning-bolt border
  ctx.strokeStyle = '#d02020';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) ctx.lineTo(6 + i * 14.5, i % 2 ? 10 : 4);
  ctx.stroke();
  // skull
  ctx.fillStyle = '#f2f2f2';
  ctx.beginPath();
  ctx.arc(64, 52, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(48, 64, 32, 20);
  ctx.fillStyle = '#101010';
  ctx.beginPath();
  ctx.arc(54, 52, 7, 0, Math.PI * 2);
  ctx.arc(74, 52, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(64, 58);
  ctx.lineTo(60, 68);
  ctx.lineTo(68, 68);
  ctx.fill();
  for (let i = 0; i < 5; i++) ctx.fillRect(51 + i * 6.5, 76, 2, 8);
  // crossed bones
  ctx.strokeStyle = '#f2f2f2';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(30, 84);
  ctx.lineTo(98, 104);
  ctx.moveTo(98, 84);
  ctx.lineTo(30, 104);
  ctx.stroke();
  // the name of the band
  ctx.fillStyle = '#e02828';
  ctx.font = 'bold 15px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SKULLCRUSHER', 64, 24);
  ctx.fillStyle = '#f2f2f2';
  ctx.font = 'bold 12px Impact, "Arial Black", sans-serif';
  ctx.fillText('WORLD TOUR', 64, 122);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const SKIN = 0xf0c8a0;
const JEANS = 0x2f5fb0;

/**
 * Nathaniel: a tall, dorky, glasses-wearing metalhead in a band T-shirt and blue jeans, about three gnomes high.
 * He wanders the forest, cannot be hurt, and gives the player Wizard Mode when they come close.
 */
export class Nathaniel {
  readonly root = new THREE.Group();
  readonly pos = new THREE.Vector3();
  /** Where his head is, for speech bubbles. */
  readonly headY = 7.9;
  /** Seconds until he will bless somebody again. */
  cooldown = 0;
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private head = new THREE.Group();
  private yaw = 0;
  private walk = 0;
  private goal = new THREE.Vector3();
  private goalT = 0;
  private shoutT = 6;
  private marker: THREE.Mesh;
  /** He stops and faces whoever he is blessing. */
  private pause = 0;
  private stuckT = 0;
  private lastX = 0;
  private lastZ = 0;
  private avoidT = 0;
  private avoidDir = 1;

  constructor(scene: THREE.Scene) {
    const mk = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, color: number) => {
      const m = new THREE.Mesh(new SoftBox(w, h, d), lit({ color }));
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    const body = this.root;

    // legs in blue jeans and big white trainers, pivoting at the hips
    for (const [leg, sx] of [[this.legL, -0.3], [this.legR, 0.3]] as const) {
      leg.position.set(sx, 3.0, 0);
      mk(leg, 0.5, 2.65, 0.52, 0, -1.35, 0, JEANS);
      mk(leg, 0.54, 0.34, 0.95, 0, -2.85, -0.18, 0xeeeeee);
      mk(leg, 0.56, 0.1, 0.97, 0, -3.0, -0.18, 0x303030);
      body.add(leg);
    }
    // belt
    mk(body, 1.4, 0.16, 0.85, 0, 3.08, 0, 0x201810);

    // torso with the band T-shirt, a bit lanky
    mk(body, 1.4, 2.2, 0.8, 0, 4.15, 0, 0x151515);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), new THREE.MeshLambertMaterial({ map: shirtTexture() }));
    logo.position.set(0, 4.25, -0.405);
    logo.rotation.y = Math.PI; // the plane faces -z, which is the front
    body.add(logo);

    // thin arms: black sleeves, long pale forearms
    for (const [arm, sx] of [[this.armL, -0.95], [this.armR, 0.95]] as const) {
      arm.position.set(sx, 5.1, 0);
      mk(arm, 0.4, 0.8, 0.45, 0, -0.4, 0, 0x151515);
      mk(arm, 0.3, 1.9, 0.3, 0, -1.7, 0, SKIN);
      mk(arm, 0.36, 0.38, 0.36, 0, -2.75, 0, SKIN);
      body.add(arm);
    }

    // neck and a head that sticks out a bit
    mk(body, 0.4, 0.3, 0.4, 0, 5.4, 0, SKIN);
    this.head.position.set(0, 6.0, -0.1);
    body.add(this.head);
    const h = this.head;
    mk(h, 1.0, 1.1, 0.95, 0, 0, 0, SKIN);
    mk(h, 0.2, 0.35, 0.25, 0, -0.1, -0.55, 0xe8a888); // nose
    mk(h, 0.5, 0.08, 0.06, 0, -0.38, -0.49, 0x7a2a2a); // goofy smile
    mk(h, 0.1, 0.1, 0.06, -0.28, -0.36, -0.49, 0xf4f4f4); // a flash of teeth
    mk(h, 0.1, 0.1, 0.06, 0.28, -0.36, -0.49, 0xf4f4f4);
    mk(h, 0.1, 0.3, 0.2, -0.55, -0.05, 0, 0xe8a888); // ears
    mk(h, 0.1, 0.3, 0.2, 0.55, -0.05, 0, 0xe8a888);
    // big square glasses
    for (const sx of [-0.27, 0.27]) {
      mk(h, 0.46, 0.4, 0.08, sx, 0.2, -0.5, 0x111111);
      const lens = new THREE.Mesh(new SoftBox(0.34, 0.28, 0.05), new THREE.MeshBasicMaterial({ color: 0xbfe2ff }));
      lens.position.set(sx, 0.2, -0.55);
      h.add(lens);
      mk(h, 0.1, 0.1, 0.06, sx * 1.35, 0.2, -0.54, 0x111111);
    }
    mk(h, 0.14, 0.08, 0.08, 0, 0.26, -0.52, 0x111111); // bridge
    for (const sx of [-0.52, 0.52]) mk(h, 0.06, 0.08, 0.5, sx, 0.22, -0.28, 0x111111); // arms of the glasses
    // messy dark hair, long at the back
    mk(h, 1.08, 0.3, 1.02, 0, 0.62, 0.02, 0x2a1a10);
    mk(h, 1.0, 0.7, 0.35, 0, 0.1, 0.55, 0x2a1a10);
    for (let i = 0; i < 6; i++) {
      const tuft = mk(h, 0.28, 0.28, 0.28, -0.4 + i * 0.16, 0.85 + (i % 2) * 0.1, -0.2 + (i % 3) * 0.2, 0x2a1a10);
      tuft.rotation.set(0.3 * i, 0.5 * i, 0.2);
    }
    mk(h, 0.9, 0.5, 0.2, 0, 0.0, 0.7, 0x2a1a10).position.y = -0.35;

    this.root.scale.setScalar(1.12);
    scene.add(this.root);

    this.marker = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95, depthTest: false }));
    this.marker.renderOrder = 8;
    scene.add(this.marker);
  }

  /** Put him somewhere open at the start of a match. */
  spawn(forest: Forest, avoid: THREE.Vector3) {
    for (let i = 0; i < 40; i++) {
      const p = forest.randomFree(HALF - 8);
      if (Math.hypot(p.x - avoid.x, p.z - avoid.z) > 16) { this.pos.copy(p); break; }
    }
    this.goalT = 0;
    this.cooldown = 4;
    this.shoutT = 5;
    this.pause = 0;
    this.yaw = Math.random() * 6;
  }

  /** `mood`: asleep while the match has not started. Returns true on the frame he shouts his name. */
  update(dt: number, t: number, forest: Forest, ringR: number, target: { x: number; z: number } | null): { shout: boolean; bless: boolean } {
    const out = { shout: false, bless: false };
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.shoutT -= dt;
    let speed = 2.4;
    if (this.pause > 0) {
      this.pause -= dt;
      speed = 0;
      if (target) this.yaw += angleDiff(this.yaw, Math.atan2(target.x - this.pos.x, target.z - this.pos.z)) * Math.min(1, dt * 6);
    } else {
      this.goalT -= dt;
      if (this.goalT <= 0 || Math.hypot(this.goal.x - this.pos.x, this.goal.z - this.pos.z) < 2) {
        const lim = Math.max(8, Math.min(ringR - 6, HALF - 6));
        this.goal.copy(forest.randomFree(lim));
        this.goalT = 8 + Math.random() * 6;
      }
      let dx = this.goal.x - this.pos.x;
      let dz = this.goal.z - this.pos.z;
      // not getting anywhere (a tree in the way)? swing off to the side for a moment, then try another goal
      this.stuckT += dt;
      if (this.stuckT > 0.6) {
        if (Math.hypot(this.pos.x - this.lastX, this.pos.z - this.lastZ) < 0.5) {
          this.avoidT = 1.1;
          this.avoidDir = Math.random() < 0.5 ? 1 : -1;
          this.goalT = Math.min(this.goalT, 0.8);
        }
        this.lastX = this.pos.x;
        this.lastZ = this.pos.z;
        this.stuckT = 0;
      }
      if (this.avoidT > 0) {
        this.avoidT -= dt;
        const l = Math.hypot(dx, dz) || 1;
        [dx, dz] = [(-dz / l) * this.avoidDir + (dx / l) * 0.25, (dx / l) * this.avoidDir + (dz / l) * 0.25];
      }
      const d = Math.hypot(dx, dz) || 1;
      this.yaw += angleDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 3);
      this.pos.x += (dx / d) * speed * dt;
      this.pos.z += (dz / d) * speed * dt;
      forest.collide(this.pos, 0.6);
    }
    if (target) {
      const dd = Math.hypot(target.x - this.pos.x, target.z - this.pos.z);
      if (dd < 6 && this.cooldown <= 0) {
        this.cooldown = 40;
        this.pause = 2.4;
        this.shoutT = 9;
        out.shout = true;
        out.bless = true;
      }
    }
    if (this.shoutT <= 0) {
      this.shoutT = 6 + Math.random() * 4;
      if (target && Math.hypot(target.x - this.pos.x, target.z - this.pos.z) < 34) out.shout = true;
    }

    // animation: a lanky, slightly clumsy lope
    if (speed > 0) this.walk += dt * 3.2;
    const sw = speed > 0 ? Math.sin(this.walk) * 0.55 : 0;
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    this.armL.rotation.x = -sw * 0.8;
    this.armR.rotation.x = sw * 0.8;
    // when blessing, one arm goes up
    if (this.pause > 0) this.armR.rotation.x = -2.6 + Math.sin(t * 8) * 0.2;
    this.head.rotation.z = Math.sin(this.walk * 0.5) * 0.06;
    this.root.position.set(this.pos.x, Math.abs(Math.sin(this.walk)) * 0.12, this.pos.z);
    this.root.rotation.y = this.yaw + Math.PI;
    this.marker.position.set(this.pos.x, 9.2 + Math.sin(t * 3) * 0.2, this.pos.z);
    return out;
  }

  show(on: boolean) {
    this.root.visible = this.marker.visible = on;
  }
}

function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
