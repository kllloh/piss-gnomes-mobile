/**
 * Twin-stick touch controls (left thumb walks, right thumb aims and pees), with WASD and mouse as a fallback
 * for testing on a computer. Screen directions are world directions: the camera never turns, so up is -z.
 */

const R = 62; // how far a thumb drags before the stick is at full tilt
const AIM_FIRE = 0.3; // fraction of R before the aim stick starts the stream

interface Stick {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

export class Input {
  moveX = 0;
  moveZ = 0;
  aimX = 0;
  aimZ = 0;
  hasAim = false;
  fire = false;
  /** The last control used was a touchscreen: the game helps aim a little. */
  touch = false;

  private left: Stick | null = null;
  private right: Stick | null = null;
  private keys = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private mouseDown = false;
  private mouseSeen = false;
  private ui: Record<'l' | 'r', { base: HTMLElement; knob: HTMLElement }>;

  constructor(private el: HTMLElement) {
    const get = (id: string) => ({ base: document.getElementById(id)!, knob: document.getElementById(id)!.querySelector('.knob') as HTMLElement });
    this.ui = { l: get('stickL'), r: get('stickR') };

    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => { this.keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; this.release(); });
  }

  /** Let go of everything (pause, game over). */
  release() {
    this.left = this.right = null;
    this.ui.l.base.style.display = this.ui.r.base.style.display = 'none';
    this.moveX = this.moveZ = 0;
    this.hasAim = this.fire = false;
  }

  private down(e: PointerEvent) {
    if (e.pointerType === 'mouse') {
      this.mouseDown = e.button === 0;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.mouseSeen = true;
      this.touch = false;
      return;
    }
    this.touch = true;
    const isLeft = e.clientX < window.innerWidth / 2;
    if (isLeft ? this.left : this.right) return;
    try { this.el.setPointerCapture(e.pointerId); } catch { /* not every browser lets us */ }
    const s: Stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
    if (isLeft) this.left = s;
    else this.right = s;
    this.draw(isLeft ? 'l' : 'r', s);
  }

  private move(e: PointerEvent) {
    if (e.pointerType === 'mouse') {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.mouseSeen = true;
      return;
    }
    for (const side of ['l', 'r'] as const) {
      const s = side === 'l' ? this.left : this.right;
      if (s && s.id === e.pointerId) {
        s.x = e.clientX;
        s.y = e.clientY;
        this.draw(side, s);
      }
    }
  }

  private up(e: PointerEvent) {
    if (e.pointerType === 'mouse') { this.mouseDown = false; return; }
    if (this.left && this.left.id === e.pointerId) { this.left = null; this.ui.l.base.style.display = 'none'; }
    if (this.right && this.right.id === e.pointerId) { this.right = null; this.ui.r.base.style.display = 'none'; }
  }

  private draw(side: 'l' | 'r', s: Stick) {
    const ui = this.ui[side];
    let dx = s.x - s.ox;
    let dy = s.y - s.oy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    ui.base.style.display = 'block';
    ui.base.style.left = `${s.ox}px`;
    ui.base.style.top = `${s.oy}px`;
    ui.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    ui.base.classList.toggle('firing', side === 'r' && d > AIM_FIRE * R);
  }

  /** Work out this frame's controls. (cx, cy) is where the player is on screen, for the mouse. */
  poll(cx: number, cy: number) {
    // walking
    let mx = 0;
    let mz = 0;
    if (this.left) {
      const dx = (this.left.x - this.left.ox) / R;
      const dy = (this.left.y - this.left.oy) / R;
      const d = Math.hypot(dx, dy);
      if (d > 0.12) { const k = Math.min(1, d); mx = (dx / d) * k; mz = (dy / d) * k; }
    }
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) mz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) mz += 1;
    this.moveX = mx;
    this.moveZ = mz;

    // aiming and peeing
    this.hasAim = false;
    this.fire = false;
    if (this.right) {
      const dx = this.right.x - this.right.ox;
      const dy = this.right.y - this.right.oy;
      const d = Math.hypot(dx, dy);
      if (d > AIM_FIRE * R) {
        this.aimX = dx / d;
        this.aimZ = dy / d;
        this.hasAim = true;
        this.fire = true;
      }
    } else if (this.mouseSeen && !this.touch) {
      const dx = this.mouseX - cx;
      const dy = this.mouseY - cy;
      const d = Math.hypot(dx, dy);
      if (d > 24) {
        this.aimX = dx / d;
        this.aimZ = dy / d;
        this.hasAim = true;
      }
      this.fire = this.mouseDown || this.keys.has('Space');
    }
  }
}
