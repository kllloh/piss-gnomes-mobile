import * as THREE from 'three';

/** Every power-up has its own icon: a neon pictogram on a dark tile, used on the HUD, in banners, in the how-to and floating over the pickups. */
export type IconKind = 'chili' | 'ice' | 'acid' | 'speed' | 'health' | 'bounce' | 'gulp' | 'wizard' | 'energy';

export const ICON_COLOR: Record<IconKind, string> = {
  chili: '#ff6a1a',
  ice: '#7ae8ff',
  acid: '#8aff2a',
  speed: '#19f0ff',
  health: '#ff3a6a',
  bounce: '#ff2bd6',
  gulp: '#ffd23c',
  wizard: '#b48aff',
  energy: '#d8ffe8',
};

function draw(ctx: CanvasRenderingContext2D, kind: IconKind, s: number) {
  const col = ICON_COLOR[kind];
  ctx.save();
  ctx.scale(s / 64, s / 64);
  // the tile
  ctx.fillStyle = 'rgba(6,4,16,.92)';
  ctx.beginPath();
  ctx.moveTo(10, 2); ctx.lineTo(54, 2); ctx.lineTo(62, 10); ctx.lineTo(62, 54); ctx.lineTo(54, 62); ctx.lineTo(10, 62); ctx.lineTo(2, 54); ctx.lineTo(2, 10);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = col;
  ctx.shadowColor = col;
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  switch (kind) {
    case 'chili': {
      // a flame
      ctx.beginPath();
      ctx.moveTo(32, 9);
      ctx.bezierCurveTo(40, 22, 50, 28, 48, 42);
      ctx.bezierCurveTo(46, 54, 38, 57, 32, 57);
      ctx.bezierCurveTo(24, 57, 16, 52, 16, 42);
      ctx.bezierCurveTo(16, 33, 22, 30, 24, 22);
      ctx.bezierCurveTo(28, 26, 29, 29, 30, 31);
      ctx.bezierCurveTo(31, 24, 30, 16, 32, 9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.moveTo(32, 33);
      ctx.bezierCurveTo(37, 40, 40, 44, 37, 50);
      ctx.bezierCurveTo(35, 53, 29, 53, 27, 49);
      ctx.bezierCurveTo(25, 44, 30, 40, 32, 33);
      ctx.fill();
      break;
    }
    case 'ice': {
      // a snowflake
      ctx.lineWidth = 3.5;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI;
        const dx = Math.cos(a) * 21;
        const dy = Math.sin(a) * 21;
        ctx.beginPath(); ctx.moveTo(32 - dx, 32 - dy); ctx.lineTo(32 + dx, 32 + dy); ctx.stroke();
        for (const sgn of [-1, 1]) {
          const ex = 32 + dx * 0.62 * sgn;
          const ey = 32 + dy * 0.62 * sgn;
          for (const side of [-1, 1]) {
            const b = a + side * 0.9;
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex + Math.cos(b) * 7 * sgn, ey + Math.sin(b) * 7 * sgn);
            ctx.stroke();
          }
        }
      }
      break;
    }
    case 'acid': {
      // a flask of bubbling green
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(26, 9); ctx.lineTo(38, 9); ctx.moveTo(28, 9); ctx.lineTo(28, 25); ctx.lineTo(14, 52); ctx.lineTo(18, 56); ctx.lineTo(46, 56); ctx.lineTo(50, 52); ctx.lineTo(36, 25); ctx.lineTo(36, 9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(20, 42); ctx.lineTo(44, 42); ctx.lineTo(49, 52); ctx.lineTo(46, 55); ctx.lineTo(18, 55); ctx.lineTo(15, 52);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#05030a';
      for (const [bx, by, br] of [[27, 49, 2.4], [36, 47, 3], [32, 36, 2.6]] as const) { ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = col;
      for (const [bx, by, br] of [[30, 28, 2.2], [35, 20, 1.8]] as const) { ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'speed': {
      // a lightning bolt
      ctx.beginPath();
      ctx.moveTo(38, 6); ctx.lineTo(16, 36); ctx.lineTo(29, 36); ctx.lineTo(24, 58); ctx.lineTo(48, 26); ctx.lineTo(34, 26); ctx.closePath();
      ctx.fill();
      break;
    }
    case 'health': {
      // a medical cross
      ctx.beginPath();
      ctx.moveTo(25, 10); ctx.lineTo(39, 10); ctx.lineTo(39, 25); ctx.lineTo(54, 25); ctx.lineTo(54, 39); ctx.lineTo(39, 39); ctx.lineTo(39, 54); ctx.lineTo(25, 54); ctx.lineTo(25, 39); ctx.lineTo(10, 39); ctx.lineTo(10, 25); ctx.lineTo(25, 25);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'bounce': {
      // a spring with an arrow
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(20, 56);
      ctx.lineTo(44, 50); ctx.lineTo(20, 42); ctx.lineTo(44, 34); ctx.lineTo(20, 26); ctx.lineTo(32, 22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(32, 7); ctx.lineTo(44, 21); ctx.lineTo(20, 21); ctx.closePath();
      ctx.fill();
      break;
    }
    case 'gulp': {
      // a big cup with a lid and a straw
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(18, 24); ctx.lineTo(46, 24); ctx.lineTo(42, 58); ctx.lineTo(22, 58); ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(15, 24); ctx.lineTo(49, 24);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(20, 38); ctx.lineTo(44, 38); ctx.lineTo(42, 58); ctx.lineTo(22, 58); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(34, 24); ctx.lineTo(38, 9); ctx.lineTo(48, 9);
      ctx.stroke();
      break;
    }
    case 'wizard': {
      // a pointed hat with a star
      ctx.beginPath();
      ctx.moveTo(32, 6); ctx.lineTo(48, 46); ctx.lineTo(16, 46); ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(8, 52); ctx.lineTo(56, 52);
      ctx.stroke();
      ctx.fillStyle = '#fcee0a';
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 3 : 7;
        const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
        const x = 32 + Math.cos(a) * r;
        const y = 29 + Math.sin(a) * r;
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'energy': {
      // a tall white can with three green slashes
      ctx.fillStyle = '#f4fff8';
      ctx.beginPath();
      ctx.moveTo(20, 14); ctx.lineTo(44, 14); ctx.lineTo(46, 22); ctx.lineTo(46, 52); ctx.lineTo(42, 58); ctx.lineTo(22, 58); ctx.lineTo(18, 52); ctx.lineTo(18, 22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#9aa8a0';
      ctx.fillRect(22, 9, 20, 6);
      ctx.strokeStyle = '#27e86a';
      ctx.shadowColor = '#27e86a';
      ctx.lineWidth = 3.6;
      for (const x of [25, 32, 39]) { ctx.beginPath(); ctx.moveTo(x - 3, 24); ctx.lineTo(x + 2, 50); ctx.stroke(); }
      break;
    }
  }
  ctx.restore();
}

const urls = new Map<string, string>();
const textures = new Map<IconKind, THREE.CanvasTexture>();

/** The icon as a canvas of the given size. */
export function iconCanvas(kind: IconKind, size = 64): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, kind, size);
  return c;
}

/** A data URL for <img> tags (cached). */
export function iconUrl(kind: IconKind): string {
  let u = urls.get(kind);
  if (!u) { u = iconCanvas(kind, 96).toDataURL(); urls.set(kind, u); }
  return u;
}

/** Ready-made <img> markup. */
export function iconImg(kind: IconKind): string {
  return `<img class="ico" alt="${kind}" src="${iconUrl(kind)}">`;
}

/** A texture for a floating sprite (cached). */
export function iconTexture(kind: IconKind): THREE.CanvasTexture {
  let t = textures.get(kind);
  if (!t) {
    t = new THREE.CanvasTexture(iconCanvas(kind, 96));
    t.colorSpace = THREE.SRGBColorSpace;
    textures.set(kind, t);
  }
  return t;
}
