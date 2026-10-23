import * as THREE from 'three';
import { SoftBox, lit } from './organic';
import { HALF } from './forest';

/** Where the plane is and where it is going, for the gnomes aboard and for the maps. */
export interface PlaneInfo {
  pos: THREE.Vector3;
  vx: number;
  vz: number;
  dirX: number;
  dirZ: number;
  /** The two ends of its route (ground position). */
  sx: number;
  sz: number;
  ex: number;
  ez: number;
  /** It has flown off the far side. */
  done: boolean;
}

export const PLANE_HEIGHT = 115;
const SPEED = 12;

/** The drop plane: a cheerful pink propeller plane that flies across the island once, with every gnome aboard. */
export class BattlePlane {
  readonly group = new THREE.Group();
  readonly info: PlaneInfo = { pos: new THREE.Vector3(), vx: 0, vz: 0, dirX: 0, dirZ: 1, sx: 0, sz: 0, ex: 0, ez: 0, done: false };
  private prop = new THREE.Group();
  private travelled = 0;
  private length = 1;

  constructor(scene: THREE.Scene) {
    const mats = new Map<number, THREE.MeshLambertMaterial>();
    const mat = (c: number) => {
      let m = mats.get(c);
      if (!m) { m = lit({ color: c, flatShading: true }); mats.set(c, m); }
      return m;
    };
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: number) => {
      const m = new THREE.Mesh(new SoftBox(w, h, d), mat(c));
      m.position.set(x, y, z);
      this.group.add(m);
      return m;
    };
    // the model's nose points to -z
    box(3.2, 3, 14, 0, 0, 0, 0x24242c); // the body
    box(3.3, 0.8, 14.1, 0, -0.7, 0, 0x8a8a92); // a grey belly stripe
    box(3.3, 0.45, 14.1, 0, 0.5, 0, 0xa8222a); // and a red one
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.2, 8), mat(0xa8222a));
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0, -8.6);
    this.group.add(nose);
    box(2.4, 1, 2.6, 0, 1.7, -3, 0x4a7a9a); // cockpit windows
    box(24, 0.5, 4.4, 0, 0.3, 0.8, 0x50545e); // wings
    box(3.2, 0.55, 4.5, -10.4, 0.3, 0.8, 0xa8222a);
    box(3.2, 0.55, 4.5, 10.4, 0.3, 0.8, 0xa8222a);
    box(0.5, 4.4, 3.2, 0, 3, 6.6, 0xa8222a); // tail fin
    box(7.4, 0.45, 2.3, 0, 0.9, 6.8, 0x50545e); // tail wings
    for (let i = 0; i < 4; i++) box(0.12, 0.9, 1.1, i % 2 ? 1.62 : -1.62, 0.5, -1 + (i >> 1) * 3.2, 0x4a7a9a); // little windows
    // the propeller
    this.prop.position.set(0, 0, -10.3);
    const b1 = new THREE.Mesh(new SoftBox(0.4, 6.4, 0.3), mat(0x8a8a92));
    const b2 = new THREE.Mesh(new SoftBox(6.4, 0.4, 0.3), mat(0x8a8a92));
    this.prop.add(b1, b2);
    this.group.add(this.prop);
    this.group.scale.setScalar(1.3);
    this.group.visible = false;
    scene.add(this.group);
  }

  /** Lay out a new route across the island, in a random direction, passing near the middle. */
  reset() {
    const a = Math.random() * Math.PI * 2;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const off = (Math.random() * 2 - 1) * 28;
    const half = HALF + 50;
    const i = this.info;
    i.sx = -dx * half - dz * off;
    i.sz = -dz * half + dx * off;
    i.ex = dx * half - dz * off;
    i.ez = dz * half + dx * off;
    i.dirX = dx;
    i.dirZ = dz;
    i.vx = dx * SPEED;
    i.vz = dz * SPEED;
    i.done = false;
    this.length = 2 * half;
    this.travelled = 0;
    i.pos.set(i.sx, PLANE_HEIGHT, i.sz);
    this.group.visible = true;
    this.place();
  }

  private place() {
    const i = this.info;
    this.group.position.copy(i.pos);
    this.group.rotation.y = Math.atan2(-i.dirX, -i.dirZ);
  }

  /** How far along the route it is, 0..1. */
  get progress(): number {
    return this.travelled / this.length;
  }

  update(dt: number, t: number) {
    const i = this.info;
    if (i.done) return;
    this.travelled += SPEED * dt;
    i.pos.set(i.sx + i.dirX * this.travelled, PLANE_HEIGHT + Math.sin(t * 1.3) * 0.6, i.sz + i.dirZ * this.travelled);
    this.prop.rotation.z += dt * 40;
    this.group.rotation.z = Math.sin(t * 0.9) * 0.05;
    this.place();
    if (this.travelled >= this.length) { i.done = true; this.group.visible = false; }
  }

  hide() {
    this.group.visible = false;
  }
}
