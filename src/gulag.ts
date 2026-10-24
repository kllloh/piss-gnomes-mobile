import * as THREE from 'three';
import { GULAG, MAX_HP, type Gnome } from './gnomes';

const FIGHT_TIME = 25; // a drawn fight is decided on health after this long

/**
 * The gulag: a neon arena floating high above the island. The first time a gnome is soaked it waits here for a one-on-one
 * (against the next soaked gnome, or the guard if nobody else is waiting). Win and you drop back onto the island.
 */
export class Gulag {
  readonly queue: Gnome[] = [];
  fight: [Gnome, Gnome] | null = null;
  private fightT = 0;
  private pause = 0;
  private sign: THREE.Sprite;

  constructor(
    scene: THREE.Scene,
    private guard: Gnome,
    private hooks: {
      start: (a: Gnome, b: Gnome) => void;
      win: (winner: Gnome, loser: Gnome) => void;
      lose: (loser: Gnome, killer: Gnome | null) => void;
    },
  ) {
    const g = new THREE.Group();
    g.position.set(GULAG.x, GULAG.y, GULAG.z);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(GULAG.r, GULAG.r, 1, 40), new THREE.MeshBasicMaterial({ color: 0x120a22 }));
    floor.position.y = -0.55;
    const grid = new THREE.Mesh(new THREE.RingGeometry(0.5, GULAG.r - 0.2, 40, 6), new THREE.MeshBasicMaterial({ color: 0x19f0ff, wireframe: true, transparent: true, opacity: 0.35 }));
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = 0.02;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(GULAG.r - 0.4, 0.18, 6, 64), new THREE.MeshBasicMaterial({ color: 0xff2bd6 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.1;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(GULAG.r - 0.4, GULAG.r - 0.4, 9, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0x19f0ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
    wall.position.y = 4.5;
    g.add(floor, grid, rim, wall);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.5), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x19f0ff : 0xff2bd6 }));
      p.position.set(Math.cos(a) * (GULAG.r - 0.4), 4.5, Math.sin(a) * (GULAG.r - 0.4));
      g.add(p);
    }
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const x = c.getContext('2d')!;
    x.font = '84px Audiowide, "Segoe UI", sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.shadowColor = '#ff2bd6';
    x.shadowBlur = 24;
    x.fillStyle = '#ffe8fb';
    x.fillText('GULAG', 256, 66);
    this.sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, fog: false, depthWrite: false }));
    this.sign.scale.set(16, 4, 1);
    this.sign.position.y = 11;
    g.add(this.sign);
    scene.add(g);
  }

  busy(): boolean {
    return !!this.fight || this.queue.length > 0;
  }

  reset() {
    this.queue.length = 0;
    this.fight = null;
    this.fightT = 0;
    this.pause = 0;
  }

  send(g: Gnome) {
    if (g.isPlayer || g.remote) this.queue.unshift(g); // people never wait behind the bots
    else this.queue.push(g);
    if (!this.fight) this.pause = Math.min(this.pause, 1.2);
  }

  /** Who is left to fight: a gnome who dies outside the gulag (it cannot happen) is dropped. */
  update(dt: number, time: number) {
    if (!this.fight) {
      this.pause -= dt;
      if (this.pause > 0 || !this.queue.length) return;
      const a = this.queue.shift()!;
      let b = this.queue.length ? this.queue.shift()! : this.guard;
      if (b === this.guard) b.guard = true;
      this.fight = [a, b];
      this.fightT = 0;
      this.hooks.start(a, b);
      return;
    }
    this.fightT += dt;
    const [a, b] = this.fight;
    if (this.fightT > FIGHT_TIME && a.alive && b.alive) {
      // out of time: more health wins
      const loser = a.hp >= b.hp ? b : a;
      loser.knockOut(a.hp >= b.hp ? a : b, time);
    }
  }

  /** Called when one of the fighters falls. */
  finish(loser: Gnome, killer: Gnome | null) {
    if (!this.fight) return;
    const [a, b] = this.fight;
    const winner = loser === a ? b : a;
    this.fight = null;
    this.pause = 2.2;
    winner.hp = Math.max(winner.hp, MAX_HP * 0.5);
    this.hooks.win(winner, loser);
    this.hooks.lose(loser, killer && killer !== winner ? killer : null);
  }
}
