import * as THREE from 'three';
import { HALF, type Forest } from './forest';
import { PEE, POTION_KINDS, KIND_BIT, type PeeKind } from './pee';
import type { Gnome } from './gnomes';

const COUNT = 12;
const RESPAWN = 25;
const GRAB = 1.5;
export const POTION_TIME = 25;

interface Item {
  x: number;
  z: number;
  kind: PeeKind;
  alive: boolean;
  wait: number;
  group: THREE.Group;
  body: THREE.Mesh;
  neck: THREE.Mesh;
  beam: THREE.Mesh;
}

const bodyGeo = new THREE.CylinderGeometry(0.3, 0.42, 0.8, 8);
const neckGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.35, 6);
const beamGeo = new THREE.CylinderGeometry(0.45, 0.45, 14, 8, 1, true);

/** Glowing bottles lying about the forest. Walk into one and your pee changes for a while. */
export class Potions {
  private items: Item[] = [];
  private mats = new Map<PeeKind, THREE.MeshBasicMaterial>();

  constructor(scene: THREE.Scene, forest: Forest) {
    const mat = (k: PeeKind) => {
      let m = this.mats.get(k);
      if (!m) { m = new THREE.MeshBasicMaterial({ color: PEE[k].color }); this.mats.set(k, m); }
      return m;
    };
    const taken: { x: number; z: number }[] = [];
    for (let attempt = 0; attempt < 400 && this.items.length < COUNT; attempt++) {
      const p = forest.randomFree(HALF - 5);
      if (taken.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < 11) || Math.hypot(p.x, p.z) > 36) continue;
      taken.push({ x: p.x, z: p.z });
      const kind = POTION_KINDS[this.items.length % POTION_KINDS.length];
      const group = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, mat(kind));
      body.position.y = 0.9;
      const neck = new THREE.Mesh(neckGeo, mat(kind));
      neck.position.y = 1.5;
      const cork = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), new THREE.MeshBasicMaterial({ color: 0xf0e0b0 }));
      cork.position.y = 1.78;
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: PEE[kind].color, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.position.y = 7;
      group.add(body, neck, cork, beam);
      group.position.set(p.x, 0, p.z);
      scene.add(group);
      this.items.push({ x: p.x, z: p.z, kind, alive: true, wait: 0, group, body, neck, beam });
    }
  }

  reset() {
    for (const it of this.items) { it.alive = true; it.wait = 0; it.group.visible = true; }
  }

  /** The closest bottle (that is still there) within `maxD`, or null. */
  nearest(x: number, z: number, maxD: number, held = 0): { x: number; z: number } | null {
    let best: Item | null = null;
    let bd = maxD;
    for (const it of this.items) {
      if (!it.alive || (held & KIND_BIT[it.kind])) continue; // skip kinds you already have: you want a different one to mix
      const d = Math.hypot(it.x - x, it.z - z);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  update(dt: number, t: number, gnomes: Gnome[], onPick: (g: Gnome, kind: PeeKind) => void) {
    for (const it of this.items) {
      if (!it.alive) {
        it.wait -= dt;
        if (it.wait <= 0) {
          it.alive = true;
          it.kind = POTION_KINDS[Math.floor(Math.random() * POTION_KINDS.length)];
          it.body.material = it.neck.material = this.mats.get(it.kind)!;
          (it.beam.material as THREE.MeshBasicMaterial).color.setHex(PEE[it.kind].color);
          it.group.visible = true;
        }
        continue;
      }
      it.body.rotation.y = t * 1.6;
      it.group.position.y = Math.sin(t * 2 + it.x) * 0.12;
      for (const g of gnomes) {
        if (!g.alive || g.potions[it.kind as 'chili'] > 0) continue; // a kind you already hold is left for a mix
        const dx = g.pos.x - it.x;
        const dz = g.pos.z - it.z;
        if (dx * dx + dz * dz < GRAB * GRAB) {
          it.alive = false;
          it.wait = RESPAWN;
          it.group.visible = false;
          g.potions[it.kind as 'chili'] = POTION_TIME;
          onPick(g, it.kind);
          break;
        }
      }
    }
  }
}
