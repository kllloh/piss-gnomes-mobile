/**
 * First-person controls. Touch: a floating stick on the left half walks, dragging anywhere on the right half
 * looks around, and the big PEE button is held to pee (you can look and pee at the same time).
 * Computer: WASD, pointer-locked mouse look, hold click or Space to pee.
 */

const R = 62; // how far a thumb drags before the stick is at full tilt
const TOUCH_LOOK = 0.0062; // radians per pixel
const MOUSE_LOOK = 0.0024;

interface Stick {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

export class Input {
  /** Strafe right (+) and forward (+), each -1..1. */
  moveX = 0;
  moveF = 0;
  fire = false;
  /** The last control used was a touchscreen: the game helps aim a little. */
  touch = false;
  /** Look movement collected since the last poll, in radians (right and up are positive). */
  lookYaw = 0;
  lookPitch = 0;

  private left: Stick | null = null;
  private lookId = -1;
  private lastX = 0;
  private lastY = 0;
  private keys = new Set<string>();
  private mouseFire = false;
  private btnFire = false;
  private stickUi: { base: HTMLElement; knob: HTMLElement };

  constructor(private el: HTMLElement, private peeBtn: HTMLElement) {
    const base = document.getElementById('stickL')!;
    this.stickUi = { base, knob: base.querySelector('.knob') as HTMLElement };

    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    const bd = (e: PointerEvent) => { e.preventDefault(); this.touch = true; this.btnFire = true; peeBtn.classList.add('on'); try { peeBtn.setPointerCapture(e.pointerId); } catch { /* fine */ } };
    const bu = () => { this.btnFire = false; peeBtn.classList.remove('on'); };
    peeBtn.addEventListener('pointerdown', bd);
    peeBtn.addEventListener('pointerup', bu);
    peeBtn.addEventListener('pointercancel', bu);
    peeBtn.addEventListener('lostpointercapture', bu);

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.el) {
        this.lookYaw += e.movementX * MOUSE_LOOK;
        this.lookPitch -= e.movementY * MOUSE_LOOK;
      }
    });
    window.addEventListener('keydown', (e) => { this.keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseFire = false; this.release(); });
  }

  /** Let go of everything (pause, game over). */
  release() {
    this.left = null;
    this.lookId = -1;
    this.stickUi.base.style.display = 'none';
    this.moveX = this.moveF = 0;
    this.fire = this.mouseFire = this.btnFire = false;
    this.peeBtn.classList.remove('on');
    if (document.pointerLockElement) document.exitPointerLock?.();
  }

  private down(e: PointerEvent) {
    if (e.pointerType === 'mouse') {
      this.touch = false;
      if (document.pointerLockElement !== this.el) {
        try { void (this.el.requestPointerLock?.() as Promise<void> | undefined)?.catch?.(() => {}); } catch { /* fine */ }
      }
      this.mouseFire = e.button === 0;
      return;
    }
    this.touch = true;
    if (e.clientX < window.innerWidth / 2) {
      if (this.left) return;
      try { this.el.setPointerCapture(e.pointerId); } catch { /* fine */ }
      this.left = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      this.draw();
    } else if (this.lookId < 0) {
      try { this.el.setPointerCapture(e.pointerId); } catch { /* fine */ }
      this.lookId = e.pointerId;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    }
  }

  private move(e: PointerEvent) {
    if (e.pointerType === 'mouse') return;
    if (this.left && this.left.id === e.pointerId) {
      this.left.x = e.clientX;
      this.left.y = e.clientY;
      this.draw();
    } else if (e.pointerId === this.lookId) {
      this.lookYaw += (e.clientX - this.lastX) * TOUCH_LOOK;
      this.lookPitch -= (e.clientY - this.lastY) * TOUCH_LOOK;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    }
  }

  private up(e: PointerEvent) {
    if (e.pointerType === 'mouse') { this.mouseFire = false; return; }
    if (this.left && this.left.id === e.pointerId) { this.left = null; this.stickUi.base.style.display = 'none'; }
    if (e.pointerId === this.lookId) this.lookId = -1;
  }

  private draw() {
    const s = this.left!;
    let dx = s.x - s.ox;
    let dy = s.y - s.oy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    const ui = this.stickUi;
    ui.base.style.display = 'block';
    ui.base.style.left = `${s.ox}px`;
    ui.base.style.top = `${s.oy}px`;
    ui.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  /** Work out this frame's controls. Look movement is left in lookYaw/lookPitch for the caller to take and clear. */
  poll() {
    let mx = 0;
    let mf = 0;
    if (this.left) {
      const dx = (this.left.x - this.left.ox) / R;
      const dy = (this.left.y - this.left.oy) / R;
      const d = Math.hypot(dx, dy);
      if (d > 0.12) { const k = Math.min(1, d); mx = (dx / d) * k; mf = (-dy / d) * k; }
    }
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) mf += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) mf -= 1;
    this.moveX = mx;
    this.moveF = mf;
    this.fire = this.btnFire || this.mouseFire || this.keys.has('Space');
  }

  /** Take (and clear) the look movement collected so far. */
  takeLook(): [number, number] {
    const r: [number, number] = [this.lookYaw, this.lookPitch];
    this.lookYaw = this.lookPitch = 0;
    return r;
  }
}
