import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HALF, type Forest } from './forest';
import { heightAt } from './map';
import { PEE, POTION_KINDS, KIND_BIT, type PeeKind } from './pee';
import type { Gnome } from './gnomes';

const COUNT = 60;
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
  gy: number;
  bottle: THREE.Mesh;
  beam: THREE.Mesh;
}

const beamGeo = new THREE.CylinderGeometry(0.45, 0.45, 14, 6, 1, true);

/** One merged, vertex-coloured bottle per kind: a potion costs one draw call, plus its light beam. */
function bottleGeometry(color: number): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const cork = new THREE.Color(0xf0e0b0);
  const part = (g: THREE.BufferGeometry, y: number, col: THREE.Color) => {
    g.translate(0, y, 0);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  };
  return mergeGeometries([
    part(new THREE.CylinderGeometry(0.3, 0.42, 0.8, 8), 0.9, c),
    part(new THREE.CylinderGeometry(0.14, 0.14, 0.35, 6), 1.5, c),
    part(new THREE.BoxGeometry(0.22, 0.2, 0.22), 1.78, cork),
  ], false)!;
}

/** Glowing bottles lying about the forest. Walk into one and your pee changes for a while. */
export class Potions {
  private items: Item[] = [];
  private geos = new Map<PeeKind, THREE.BufferGeometry>();
  private mat = new THREE.MeshBasicMaterial({ vertexColors: true });

  constructor(scene: THREE.Scene, forest: Forest) {
    for (const k of POTION_KINDS) this.geos.set(k, bottleGeometry(PEE[k].color));
    const taken: { x: number; z: number }[] = [];
    for (let attempt = 0; attempt < 4000 && this.items.length < COUNT; attempt++) {
      const p = forest.randomFree(HALF - 6);
      if (taken.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < 18)) continue;
      taken.push({ x: p.x, z: p.z });
      const kind = POTION_KINDS[this.items.length % POTION_KINDS.length];
      const group = new THREE.Group();
      const bottle = new THREE.Mesh(this.geos.get(kind)!, this.mat);
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: PEE[kind].color, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.position.y = 7;
      group.add(bottle, beam);
      const gy = heightAt(p.x, p.z);
      group.position.set(p.x, gy, p.z);
      scene.add(group);
      this.items.push({ x: p.x, z: p.z, kind, alive: true, wait: 0, group, gy, bottle, beam });
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
          it.bottle.geometry = this.geos.get(it.kind)!;
          (it.beam.material as THREE.MeshBasicMaterial).color.setHex(PEE[it.kind].color);
          it.group.visible = true;
        }
        continue;
      }
      it.bottle.rotation.y = t * 1.6;
      it.group.position.y = it.gy + Math.sin(t * 2 + it.x) * 0.12;
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
