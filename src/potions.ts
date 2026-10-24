import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HALF, type Forest } from './forest';
import { heightAt } from './map';
import { PEE, POTION_KINDS, type PeeKind } from './pee';
import { iconTexture } from './icons';
import type { Gnome } from './gnomes';

const COUNT = 46;
const RESPAWN = 10;
const ENERGY_SHARE = 0.34; // about a third of all pickups are White Monsters
const GRAB = 1.5;
export const POTION_TIME = 25;
/** How long a White Monster lasts: an endless bladder and a double stream. */
export const ENERGY_TIME = 20;

/** Pee potions, and the energy drink. */
export type PickupKind = PeeKind | 'energy';
export const PICK_COLOR: Record<PickupKind, number> = { normal: PEE.normal.color, chili: PEE.chili.color, ice: PEE.ice.color, acid: PEE.acid.color, energy: 0xd8ffe8 };
const BIT: Record<string, number> = { chili: 1, ice: 2, acid: 4, energy: 8 };
const KINDS: PickupKind[] = ['chili', 'energy', 'ice', 'energy', 'acid', 'chili', 'energy', 'ice', 'acid'];

interface Item {
  x: number;
  z: number;
  kind: PickupKind;
  alive: boolean;
  wait: number;
  group: THREE.Group;
  gy: number;
  bottle: THREE.Mesh;
  beam: THREE.Mesh;
  icon: THREE.Sprite;
}

const beamGeo = new THREE.CylinderGeometry(0.45, 0.45, 14, 6, 1, true);

function paint(g: THREE.BufferGeometry, y: number, col: THREE.Color): THREE.BufferGeometry {
  g.translate(0, y, 0);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** One merged, vertex-coloured model per kind: a pickup costs one draw call, plus its light beam and its icon. */
function modelGeometry(kind: PickupKind): THREE.BufferGeometry {
  if (kind === 'energy') {
    // a tall white can with a grey rim and green slashes
    const white = new THREE.Color(0xf4fff8);
    const grey = new THREE.Color(0x9aa8a0);
    const green = new THREE.Color(0x27e86a);
    const parts = [
      paint(new THREE.CylinderGeometry(0.36, 0.36, 1.5, 12), 0.95, white),
      paint(new THREE.CylinderGeometry(0.3, 0.36, 0.12, 12), 1.76, grey),
      paint(new THREE.CylinderGeometry(0.36, 0.3, 0.12, 12), 0.14, grey),
    ];
    for (let k = 0; k < 3; k++) {
      const stripe = new THREE.BoxGeometry(0.11, 0.9, 0.06);
      stripe.rotateZ(0.2);
      stripe.translate((k - 1) * 0.22, 0, 0.35);
      parts.push(paint(stripe, 0.95, green));
    }
    return mergeGeometries(parts, false)!;
  }
  const c = new THREE.Color(PICK_COLOR[kind]);
  const cork = new THREE.Color(0xf0e0b0);
  return mergeGeometries([
    paint(new THREE.CylinderGeometry(0.3, 0.42, 0.8, 8), 0.9, c),
    paint(new THREE.CylinderGeometry(0.14, 0.14, 0.35, 6), 1.5, c),
    paint(new THREE.BoxGeometry(0.22, 0.2, 0.22), 1.78, cork),
  ], false)!;
}

/** Glowing bottles (and the odd energy drink) lying about the island. Walk into one to take it. */
export class Potions {
  private items: Item[] = [];
  private geos = new Map<PickupKind, THREE.BufferGeometry>();
  private mat = new THREE.MeshBasicMaterial({ vertexColors: true });

  constructor(scene: THREE.Scene, forest: Forest) {
    for (const k of [...POTION_KINDS, 'energy'] as PickupKind[]) this.geos.set(k, modelGeometry(k));
    const taken: { x: number; z: number }[] = [];
    for (let attempt = 0; attempt < 4000 && this.items.length < COUNT; attempt++) {
      const p = forest.randomFree(HALF - 6);
      if (taken.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < 9)) continue;
      taken.push({ x: p.x, z: p.z });
      const kind = KINDS[this.items.length % KINDS.length];
      const group = new THREE.Group();
      const bottle = new THREE.Mesh(this.geos.get(kind)!, this.mat);
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: PICK_COLOR[kind], transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.position.y = 7;
      // its own icon floats over it
      const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(kind as never), transparent: true, depthWrite: false }));
      icon.scale.set(1.9, 1.9, 1);
      icon.position.y = 3.5;
      group.add(bottle, beam, icon);
      const gy = heightAt(p.x, p.z);
      group.position.set(p.x, gy, p.z);
      scene.add(group);
      this.items.push({ x: p.x, z: p.z, kind, alive: true, wait: 0, group, gy, bottle, beam, icon });
    }
  }

  private setKind(it: Item, kind: PickupKind) {
    it.kind = kind;
    it.bottle.geometry = this.geos.get(kind)!;
    (it.beam.material as THREE.MeshBasicMaterial).color.setHex(PICK_COLOR[kind]);
    (it.icon.material as THREE.SpriteMaterial).map = iconTexture(kind as never);
  }

  /** A shower of White Monsters: turn `n` pickups into cans (half of them near `x,z`), wherever they were. Returns how many. */
  dropMonsters(x: number, z: number, n: number): number {
    const order = this.items.slice().sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    const near = order.slice(0, 24).sort(() => Math.random() - 0.5).slice(0, Math.ceil(n / 2));
    const far = order.slice(24).sort(() => Math.random() - 0.5).slice(0, Math.floor(n / 2));
    for (const it of [...near, ...far]) {
      this.setKind(it, 'energy');
      it.alive = true;
      it.wait = 0;
      it.group.visible = true;
    }
    return near.length + far.length;
  }

  reset() {
    for (const it of this.items) { it.alive = true; it.wait = 0; it.group.visible = true; this.setKind(it, KINDS[this.items.indexOf(it) % KINDS.length]); }
  }

  /** The closest pickup (that is still there) within `maxD`, or null. `held` has a bit set for each kind you already have. */
  nearest(x: number, z: number, maxD: number, held = 0): { x: number; z: number } | null {
    let best: Item | null = null;
    let bd = maxD;
    for (const it of this.items) {
      if (!it.alive || (held & BIT[it.kind])) continue; // skip kinds you already have: you want a different one
      const d = Math.hypot(it.x - x, it.z - z);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  update(dt: number, t: number, gnomes: Gnome[], onPick: (g: Gnome, kind: PickupKind) => void) {
    for (const it of this.items) {
      if (!it.alive) {
        it.wait -= dt;
        if (it.wait <= 0) {
          it.alive = true;
          this.setKind(it, Math.random() < ENERGY_SHARE ? 'energy' : POTION_KINDS[Math.floor(Math.random() * POTION_KINDS.length)]);
          it.group.visible = true;
        }
        continue;
      }
      it.bottle.rotation.y = t * 1.6;
      it.icon.position.y = 3.5 + Math.sin(t * 3 + it.x) * 0.2;
      it.group.position.y = it.gy + Math.sin(t * 2 + it.x) * 0.12;
      for (const g of gnomes) {
        if (!g.alive) continue;
        // a kind you already hold is left for a mix; the energy drink waits until the last one has worn off
        if (it.kind === 'energy' ? g.energyT > 0 : g.potions[it.kind as 'chili'] > 0) continue;
        const dx = g.pos.x - it.x;
        const dz = g.pos.z - it.z;
        if (dx * dx + dz * dz < GRAB * GRAB) {
          it.alive = false;
          it.wait = RESPAWN;
          it.group.visible = false;
          if (it.kind === 'energy') g.energyT = ENERGY_TIME;
          else g.potions[it.kind as 'chili'] = POTION_TIME;
          onPick(g, it.kind);
          break;
        }
      }
    }
  }
}
