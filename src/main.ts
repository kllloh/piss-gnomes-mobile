import * as THREE from 'three';
import { Forest, HALF } from './forest';
import { Gnome, MAX_HP, EYE, aimPitch, type Arena, type Mod } from './gnomes';
import { Potions } from './potions';
import { Banter, modTagline } from './talk';
import { Trip } from './trip';
import { PeeSystem, RANGE, PEE } from './pee';
import { Input } from './input';
import { Sfx } from './audio';

const MIST_WAIT = 20; // seconds before the mist starts to close
const MIST_TIME = 150; // seconds it takes to close
const MIST_START = 58;
const MIST_END = 6;
const COUNTDOWN = 3.4;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// --- renderer, scene, camera -----------------------------------------------------------------------

const canvas = $<HTMLCanvasElement>('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
renderer.setPixelRatio(pixelRatio);

const scene = new THREE.Scene();
const fog = new THREE.Fog(0x140a2e, 16, 78);
scene.fog = fog;
const hemi = new THREE.HemisphereLight(0xc8b8ff, 0x2a5a48, 1.25);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.5);
sun.position.set(-0.4, 1, 0.5);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 160);
camera.rotation.order = 'YXZ';
const trip = new Trip(renderer, scene);

function fit() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h >= 1 ? 72 : 88; // a taller view needs a wider lens to see the same width
  camera.updateProjectionMatrix();
  trip.resize();
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 250));

// --- the game world ------------------------------------------------------------------------------------

const forest = new Forest();
scene.add(forest.group);
const pee = new PeeSystem(scene);
const sfx = new Sfx();

const mistWall = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 1, 18, 56, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xff2bd6, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, fog: false }),
);
mistWall.position.y = 9;
const mistLine = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 5, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff7af0, fog: false }));
mistLine.position.y = 0.1;
scene.add(mistWall, mistLine);

const NAMES = ['Barnaby', 'Sir Wetsalot', 'Gorse', 'Mildred', 'Pudding', 'Old Tumble', 'Nettle', 'Captain Drip', 'Fungus', 'Bramble', 'Turnip', 'Lord Puddle'];
const HATS = [0xff3b3b, 0xffa21a, 0xffe23a, 0x4ade50, 0x19e3ff, 0x4a7bff, 0xb04aff, 0xff2bd6, 0xe8e8e8, 0xa0683a];

const player = new Gnome(scene, 'You', HATS[0], true);
const bots: Gnome[] = [];
const botNames = NAMES.slice().sort(() => Math.random() - 0.5);
for (let i = 1; i < 10; i++) bots.push(new Gnome(scene, botNames[i - 1], HATS[i], false));
const gnomes: Gnome[] = [player, ...bots];

const potions = new Potions(scene, forest);
const arena: Arena = { forest, pee, gnomes, ringR: MIST_START, time: 0, camera, frozen: true, potions, mod: null };
fit();

const banter = new Banter($('bubbles'), $('chatter'), player);
Gnome.onSay = (g, what) => banter.say(g, what, arena.mod, what === 'death' || what === 'kill');

// --- input ------------------------------------------------------------------------------------------------

const input = new Input($('touch'), $('peeBtn'));
const coarse = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (!coarse) document.body.classList.add('desktop');

// --- HUD -------------------------------------------------------------------------------------------------------

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const nameTag = (g: Gnome) => `<span style="color:${hex(g.isPlayer ? 0xffffff : g.color)}">${g.name}</span>`;

function feedLine(html: string) {
  const feed = $('feed');
  const d = document.createElement('div');
  d.innerHTML = html;
  feed.appendChild(d);
  while (feed.children.length > 4) feed.removeChild(feed.firstChild!);
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 700); }, 6000);
}

let bannerTimer = 0;
function banner(text: string, small = '', ms = 1800) {
  const b = $('banner');
  b.innerHTML = text + (small ? `<small>${small}</small>` : '');
  b.style.opacity = '1';
  clearTimeout(bannerTimer);
  if (ms > 0) bannerTimer = window.setTimeout(() => (b.style.opacity = '0'), ms);
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const mapCtx = $<HTMLCanvasElement>('minimap').getContext('2d')!;
function drawMinimap() {
  const S = 124;
  const k = S / (2 * HALF + 6);
  const px = (x: number) => (x + HALF + 3) * k;
  mapCtx.clearRect(0, 0, S, S);
  mapCtx.fillStyle = 'rgba(10,30,24,.85)';
  mapCtx.fillRect(0, 0, S, S);
  mapCtx.strokeStyle = 'rgba(25,227,255,.5)';
  mapCtx.strokeRect(px(-HALF), px(-HALF), 2 * HALF * k, 2 * HALF * k);
  // safe circle
  mapCtx.save();
  mapCtx.beginPath();
  mapCtx.rect(0, 0, S, S);
  mapCtx.arc(px(0), px(0), arena.ringR * k, 0, Math.PI * 2, true);
  mapCtx.fillStyle = 'rgba(255,43,214,.35)';
  mapCtx.fill('evenodd');
  mapCtx.restore();
  mapCtx.beginPath();
  mapCtx.arc(px(0), px(0), arena.ringR * k, 0, Math.PI * 2);
  mapCtx.strokeStyle = '#ff7af0';
  mapCtx.lineWidth = 1.5;
  mapCtx.stroke();
  mapCtx.lineWidth = 1;
  for (const g of gnomes) {
    if (!g.alive) continue;
    mapCtx.beginPath();
    mapCtx.arc(px(g.pos.x), px(g.pos.z), g.isPlayer ? 4.5 : 3.2, 0, Math.PI * 2);
    mapCtx.fillStyle = hex(g.isPlayer ? 0xffffff : g.color);
    mapCtx.fill();
    if (g.isPlayer) {
      mapCtx.strokeStyle = '#19e3ff';
      mapCtx.stroke();
      // the way you are facing
      mapCtx.beginPath();
      mapCtx.moveTo(px(g.pos.x), px(g.pos.z));
      mapCtx.lineTo(px(g.pos.x + Math.sin(g.yaw) * 7), px(g.pos.z + Math.cos(g.yaw) * 7));
      mapCtx.stroke();
    }
  }
}

// --- the match -----------------------------------------------------------------------------------------------------

type State = 'menu' | 'countdown' | 'play' | 'over';
let state: State = 'menu';
let paused = false;
let countdown = 0;
let lastBeep = 99;
let mistStarted = false;
let spectating = false;
let watchTarget: Gnome | null = null;
let overTimer = 0;
let playerPlace = 0;
let matchTime = 0;
const god = new URLSearchParams(location.search).has('god');

function aliveGnomes(): Gnome[] {
  return gnomes.filter((g) => g.alive);
}

function startMatch() {
  const spots = forest.spawns.slice().sort(() => Math.random() - 0.5);
  gnomes.forEach((g, i) => g.spawn(spots[i]));
  pee.clear();
  arena.time = 0;
  arena.ringR = MIST_START;
  arena.frozen = true;
  matchTime = 0;
  countdown = COUNTDOWN;
  lastBeep = 99;
  mistStarted = false;
  spectating = false;
  watchTarget = null;
  playerPlace = 0;
  overTimer = 0;
  state = 'countdown';
  paused = false;
  curMod = null;
  modAmt = 0;
  modNext = 14 + Math.random() * 6;
  arena.mod = null;
  sfx.setMood('none');
  potions.reset();
  banter.clear();
  idleT = 4;
  $('feed').innerHTML = '';
  document.body.classList.remove('inmenu');
  $('menu').classList.remove('on');
  $('over').classList.remove('on');
  $('pause').classList.remove('on');
  $('aliveN').textContent = '10';
  banner('LAST GNOME STANDING', '', 0);
  input.takeLook();
  input.release();
}

Gnome.onDeath = (victim, killer) => {
  const left = aliveGnomes().length;
  victim.diedAt = arena.time;
  pee.puddleAt(victim.pos.x, victim.pos.z);
  feedLine(killer ? `${nameTag(killer)} drenched ${nameTag(victim)}` : `${nameTag(victim)} was swallowed by the mist`);
  $('aliveN').textContent = String(left);
  if (victim.isPlayer) {
    playerPlace = left + 1;
    sfx.lose();
    banner('YOU WERE SOAKED', `${ordinal(playerPlace)} place`, 2200);
    overTimer = 2.2;
  } else {
    sfx.pop();
    if (killer?.isPlayer) banner('NICE SOAKING!', `${victim.name} is out`, 1200);
  }
};

let lastHurtSfx = 0;
Gnome.onHurt = (g) => {
  if (!g.isPlayer) return;
  const now = performance.now();
  if (now - lastHurtSfx > 140) {
    lastHurtSfx = now;
    sfx.hurt();
    if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(18);
  }
  const h = $('hurt');
  h.style.transition = 'none';
  h.style.opacity = '0.7';
  requestAnimationFrame(() => { h.style.transition = 'opacity .35s'; h.style.opacity = '0'; });
};

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function endMatch() {
  state = 'over';
  curMod = null;
  arena.mod = null;
  sfx.setMood('none');
  const winner = aliveGnomes()[0] ?? null;
  const won = !!winner && winner.isPlayer;
  if (won) { playerPlace = 1; sfx.win(); }
  $('overTitle').textContent = won ? 'LAST GNOME STANDING!' : playerPlace ? 'ELIMINATED' : 'DRAW';
  $('overSub').textContent = won ? 'You peed on the whole forest and won.' : winner ? `${winner.name} is the last gnome standing.` : 'Nobody is left. The mist wins.';
  $('stats').innerHTML = `Placed <b>${ordinal(playerPlace || 10)}</b> of 10<br>Gnomes soaked: <b>${player.kills}</b><br>Time: <b>${fmt(matchTime)}</b>`;
  $('btnWatch').style.display = 'none';
  banner(won ? 'VICTORY!' : `${winner ? winner.name : 'Nobody'} wins`, '', 0);
  setTimeout(() => { if (state === 'over') $('over').classList.add('on'); }, won ? 900 : 600);
}

function showEliminated() {
  $('overTitle').textContent = 'ELIMINATED';
  $('overSub').textContent = 'You were soaked.';
  $('stats').innerHTML = `Placed <b>${ordinal(playerPlace)}</b> of 10<br>Gnomes soaked: <b>${player.kills}</b><br>Time: <b>${fmt(matchTime)}</b>`;
  $('btnWatch').style.display = '';
  $('over').classList.add('on');
  input.release();
}

function pause(on: boolean) {
  if (state === 'menu' || state === 'over') return;
  paused = on;
  $('pause').classList.toggle('on', on);
  input.release();
  if (on) sfx.hiss(false, 0);
}

// --- buttons -------------------------------------------------------------------------------------------------------------

function goFullscreen() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  try {
    if (!document.fullscreenElement) {
      const p = el.requestFullscreen?.({ navigationUI: 'hide' } as FullscreenOptions) ?? el.webkitRequestFullscreen?.();
      if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => {});
    }
  } catch { /* fine, plenty of browsers say no */ }
}

// iPad Safari fullscreens the page and can leave the game behind it, so only try fullscreen elsewhere
const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
$('btnPlay').addEventListener('click', () => {
  startMatch();
  try { sfx.init(); sfx.startMusic(); } catch { /* no sound is better than no game */ }
  if (!isApple) goFullscreen();
});
$('btnAgain').addEventListener('click', () => { startMatch(); try { sfx.init(); sfx.startMusic(); } catch { /* ignore */ } });
$('btnWatch').addEventListener('click', () => {
  $('over').classList.remove('on');
  spectating = true;
});
$('btnPause').addEventListener('click', () => pause(true));
$('btnResume').addEventListener('click', () => pause(false));
$('btnRestart').addEventListener('click', () => { paused = false; startMatch(); });
$('btnSound').addEventListener('click', () => {
  sfx.setMuted(!sfx.muted);
  banter.setVoices(!sfx.muted);
  $('btnSound').innerHTML = sfx.muted ? '&#128263;' : '&#128266;';
});
window.addEventListener('keydown', (e) => { if (e.code === 'Escape') pause(!paused); if (e.code === 'Enter' && state === 'menu') $('btnPlay').click(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
// no pinch-zoom, double-tap zoom or long-press menus while playing
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if ((e.target as HTMLElement).closest('.overlay') === null) e.preventDefault(); }, { passive: false });

// --- the frame -----------------------------------------------------------------------------------------------------------------

let hintsFaded = false;
// silly modes
const MOD_INDEX: Record<Mod, number> = { disco: 1, goth: 2, bogan: 3 };
let curMod: Mod | null = null;
let shownMod: Mod = 'disco';
let lastMod: Mod | null = null;
let modAmt = 0;
let modUntil = 0;
let modNext = 14;
let idleT = 4;
let psy = 0;
let tinted = false;
const baseSky = new THREE.Color(0xc8b8ff);
const baseGround = new THREE.Color(0x2a5a48);
const baseSun = new THREE.Color(0xfff2d0);
const tmpA = new THREE.Color();
const tmpB = new THREE.Color();
const landing = { x: 0, z: 0 };
const fogCol = new THREE.Color();
const landMark = new THREE.Mesh(
  new THREE.RingGeometry(0.35, 0.55, 20).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xfff04a, transparent: true, opacity: 0.6, depthTest: false }),
);
landMark.renderOrder = 9;
landMark.visible = false;
scene.add(landMark);

function playerControls() {
  input.poll();
  const [ly, lp] = input.takeLook();
  player.yaw -= ly; // dragging right turns right
  player.pitch = Math.max(-0.9, Math.min(1.25, player.pitch + lp));
  // the stick is relative to where you are facing
  const fx = Math.sin(player.yaw);
  const fz = Math.cos(player.yaw);
  player.moveX = fx * input.moveF - fz * input.moveX;
  player.moveZ = fz * input.moveF + fx * input.moveX;
  player.hasAim = false;
  player.wantPee = input.fire;

  // a thumb is not a mouse: when peeing, drift the stream towards anyone nearly under the crosshair
  player.assistYaw = player.assistPitch = null;
  if (input.touch && input.fire) {
    let best: Gnome | null = null;
    let bd = 0.3;
    let byaw = 0;
    for (const g of bots) {
      if (!g.alive) continue;
      const dx = g.pos.x - player.pos.x;
      const dz = g.pos.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > RANGE + 2 || d < 1) continue;
      let diff = Math.atan2(dx, dz) - player.yaw;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      if (Math.abs(diff) < bd) { bd = Math.abs(diff); best = g; byaw = diff; }
    }
    if (best) {
      const d = Math.hypot(best.pos.x - player.pos.x, best.pos.z - player.pos.z);
      player.assistYaw = player.yaw + byaw * 0.7;
      player.assistPitch = player.pitch + (aimPitch(d, 0.15) - player.pitch) * 0.5;
    }
  }
  if (arena.mod === 'bogan' && modAmt > 0.3) {
    // the tinnies are working: the stream wanders
    player.assistYaw = (player.assistYaw ?? player.yaw) + Math.sin(arena.time * 1.9) * 0.1 + Math.sin(arena.time * 0.7) * 0.05;
  }
  if (!hintsFaded && (input.moveX || input.moveF || input.fire)) {
    hintsFaded = true;
    $('hintL').style.opacity = $('hintR').style.opacity = '0';
  }
}

function updateHud() {
  $('hpfill').style.width = `${Math.max(0, (player.hp / MAX_HP) * 100)}%`;
  $('blfill').style.width = `${player.bladder}%`;
  $('bars').classList.toggle('locked', player.locked);
  $('blmsg').textContent = player.locked ? 'BLADDER EMPTY... REFILLING' : player.regenerating ? 'HEALTH ✚ · BLADDER' : 'HEALTH · BLADDER';
  const pot = $('potion');
  if (player.potion) {
    const info = PEE[player.potion.kind];
    pot.style.display = 'block';
    pot.style.borderColor = '#' + info.color.toString(16).padStart(6, '0');
    pot.textContent = `${info.name.toUpperCase()} ${Math.ceil(player.potion.t)}s`;
  } else pot.style.display = 'none';
  const chip = $('modchip');
  if (curMod && state === 'play') {
    chip.style.display = 'block';
    chip.textContent = `${curMod.toUpperCase()} MODE ${fmt(Math.max(0, modUntil - arena.time))}`;
  } else chip.style.display = 'none';
  const mist = $('mist');
  if (!mistStarted) {
    mist.textContent = `MIST IN ${fmt(Math.max(0, MIST_WAIT - arena.time))}`;
    mist.classList.remove('hot');
  } else {
    const out = Math.hypot(player.pos.x, player.pos.z) > arena.ringR;
    mist.textContent = out ? 'GET INSIDE THE CIRCLE!' : 'THE MIST IS CLOSING IN';
    mist.classList.toggle('hot', out);
    $('mistfx').style.opacity = out && player.alive ? '1' : '0';
  }
  drawMinimap();
}

function frame(nowMs: number, lastMs: number) {
  const dt = Math.min(0.05, (nowMs - lastMs) / 1000);

  if (state !== 'menu' && !paused) {
    // --- simulation ---
    if (state === 'countdown') {
      countdown -= dt;
      const n = Math.ceil(countdown - (COUNTDOWN - 3));
      if (countdown > COUNTDOWN - 3 && n !== lastBeep) { lastBeep = n; banner(String(Math.max(1, n)), '', 0); sfx.beep(); }
      if (countdown <= COUNTDOWN - 3) {
        arena.frozen = false;
        state = 'play';
        banner('PEE!', 'last gnome standing wins', 1500);
        sfx.beep(true);
      }
    } else if (state === 'play') {
      arena.time += dt;
      matchTime += dt;
    }

    if (state === 'play' || state === 'countdown') {
      if (player.alive) playerControls();
      else { player.moveX = player.moveZ = 0; player.wantPee = false; player.hasAim = false; }
      if (god) player.hp = MAX_HP;

      // the mist
      if (state === 'play') {
        if (arena.time >= MIST_WAIT) {
          if (!mistStarted) { mistStarted = true; banner('THE MIST IS CLOSING IN', 'stay inside the circle', 2400); sfx.alarm(); const talkers = bots.filter((b) => b.alive); if (talkers.length) banter.sayLine(talkers[Math.floor(Math.random() * talkers.length)], 'mist'); }
          const p = Math.min(1, (arena.time - MIST_WAIT) / MIST_TIME);
          arena.ringR = MIST_START + (MIST_END - MIST_START) * p;
          const dmg = (3 + 8 * p) * dt;
          for (const g of gnomes) if (g.alive && Math.hypot(g.pos.x, g.pos.z) > arena.ringR && !(god && g.isPlayer)) g.mist(dmg, arena.time);
        }
      }

      for (const g of gnomes) g.update(dt, arena);
      pee.update(dt, forest, gnomes, (victim, shooter, kind) => {
        if (god && victim.isPlayer) return;
        victim.hit(kind, shooter.dmg, shooter, arena.time);
      });
      potions.update(dt, nowMs / 1000, gnomes, (g, kind) => {
        banter.sayLine(g, `${kind}:potion`);
        if (g.isPlayer) {
          sfx.pop();
          banner(PEE[kind].name.toUpperCase() + '!', PEE[kind].blurb, 1700);
        }
      });
      if (state === 'play') {
        // idle muttering from whoever is nearby, now and then
        idleT -= dt;
        if (idleT <= 0) {
          idleT = 2.2 + Math.random() * 3;
          const near = bots.filter((b) => b.alive && Math.hypot(b.pos.x - player.pos.x, b.pos.z - player.pos.z) < 30);
          if (near.length) banter.say(near[Math.floor(Math.random() * near.length)], Math.random() < 0.25 ? 'taunt' : 'idle', arena.mod);
          else if (player.alive && Math.random() < 0.12) banter.say(player, 'idle', arena.mod);
        }
        // a random silly mode drops in every so often
        if (curMod && arena.time > modUntil) {
          feedLine('Back to normal... for now.');
          curMod = null;
          arena.mod = null;
          sfx.setMood('none');
          modNext = arena.time + 16 + Math.random() * 12;
        } else if (!curMod && arena.time >= modNext) {
          const pool = (['disco', 'goth', 'bogan'] as Mod[]).filter((m) => m !== lastMod);
          curMod = pool[Math.floor(Math.random() * pool.length)];
          lastMod = curMod;
          shownMod = curMod;
          arena.mod = curMod;
          modUntil = arena.time + 32 + Math.random() * 10;
          sfx.setMood(curMod);
          banner(curMod.toUpperCase() + ' MODE!', modTagline(curMod), 3200);
          feedLine(`<b>${curMod.toUpperCase()} MODE</b>`);
          sfx.alarm();
          for (const b of bots.filter((x) => x.alive).slice(0, 2)) banter.say(b, 'idle', curMod, true);
        }
      }

      // sound of everybody's streams
      let others = 0;
      for (const b of bots) if (b.alive && b.peeing) others += Math.max(0, 1 - Math.hypot(b.pos.x - player.pos.x, b.pos.z - player.pos.z) / 16) * 0.5;
      sfx.hiss(player.peeing, others);

      // end of the match / the player's own card
      if (state === 'play' && aliveGnomes().length <= 1) endMatch();
      if (!player.alive && overTimer > 0) {
        overTimer -= dt;
        if (overTimer <= 0 && state === 'play') showEliminated();
      }
    } else {
      // the match is over: let everyone keep wandering around, quietly
      for (const g of gnomes) { g.moveX = g.moveZ = 0; g.wantPee = false; g.update(dt, arena); }
      pee.update(dt, forest, gnomes, () => {});
      sfx.hiss(false, 0);
    }
    updateHud();
  }

  // --- camera: the player's eyes (or the eyes of whoever we are watching) ---
  let focus: Gnome | null = player.alive ? player : null;
  if (!focus) {
    if (!watchTarget || !watchTarget.alive) {
      watchTarget = null;
      let bd = Infinity;
      for (const g of gnomes) {
        if (!g.alive) continue;
        const d = Math.hypot(g.pos.x - player.pos.x, g.pos.z - player.pos.z);
        if (d < bd) { bd = d; watchTarget = g; }
      }
    }
    focus = watchTarget ?? player;
  }
  const t = nowMs / 1000;
  if (state === 'menu') {
    // a slow drift through the trees behind the menu
    const a = t * 0.08;
    camera.position.set(Math.cos(a) * 16, 2.4, Math.sin(a) * 16);
    camera.rotation.set(-0.08, -a - Math.PI / 2 + 0.6, 0);
  } else {
    const bob = Math.sin(focus.walkPhase) * 0.05 * Math.min(1, Math.hypot(focus.vel.x, focus.vel.z) / 3);
    camera.position.set(focus.pos.x, EYE + bob + (focus.alive ? 0 : 0.4), focus.pos.z);
    camera.rotation.set(focus.alive ? (focus === player ? focus.pitch : -0.04) : -0.4, focus.yaw + Math.PI, 0);
  }
  if (shownMod === 'bogan' && modAmt > 0.01) {
    camera.rotation.z = Math.sin(t * 0.9) * 0.05 * modAmt;
    camera.rotation.y += Math.sin(t * 0.6) * 0.03 * modAmt;
  } else camera.rotation.z = 0;
  for (const g of gnomes) g.billboard(camera);
  banter.update(dt, camera);

  // the landing marker: where your stream will come down
  if (state !== 'menu' && player.alive) {
    const cp = Math.cos(player.pitch);
    const fx = Math.sin(player.yaw) * cp;
    const fz = Math.cos(player.yaw) * cp;
    const ok = pee.landing(player.pos.x + Math.sin(player.yaw) * 0.5, 0.75, player.pos.z + Math.cos(player.yaw) * 0.5, fx, Math.sin(player.pitch), fz, forest, landing);
    landMark.visible = ok;
    landMark.position.set(landing.x, 0.08, landing.z);
    landMark.rotation.z = t * 1.5;
    (landMark.material as THREE.MeshBasicMaterial).opacity = player.peeing ? 0.9 : 0.5;
  } else landMark.visible = false;

  mistWall.scale.set(arena.ringR, 1, arena.ringR);
  mistLine.scale.set(arena.ringR, 1, arena.ringR);
  forest.update(dt, t, 1e5, 1e5); // the leaves only shrank away from the top-down camera

  // the silly modes: lights, colours, and tints on the gnomes
  const target = curMod && state === 'play' ? 1 : 0;
  modAmt += Math.max(-dt * 1.5, Math.min(dt * 1.5, target - modAmt));
  trip.mode = MOD_INDEX[shownMod];
  trip.modeAmt = modAmt;
  if (modAmt > 0.001) {
    let sky = baseSky, ground = baseGround, sunC = baseSun, hi = 1.25, si = 1.5, near = 16, far = 78;
    if (shownMod === 'disco') { sky = tmpA.setHSL((t * 0.15) % 1, 0.8, 0.6); sunC = tmpB.setHSL((t * 0.3 + 0.5) % 1, 0.9, 0.6); hi = 1.6; si = 1.8; }
    else if (shownMod === 'goth') { sky = tmpA.setHex(0x6a5a9a); ground = tmpB.setHex(0x120a1a); sunC = sunC.clone().setHex(0x9a7aff); hi = 0.85; si = 0.6; near = 6; far = 50; }
    else { sky = tmpA.setHex(0xffc890); ground = tmpB.setHex(0x6a4a20); sunC = sunC.clone().setHex(0xffa050); hi = 1.35; si = 1.9; }
    hemi.color.copy(baseSky).lerp(sky, modAmt);
    hemi.groundColor.copy(baseGround).lerp(ground, modAmt);
    hemi.intensity = 1.25 + (hi - 1.25) * modAmt;
    sun.color.copy(baseSun).lerp(sunC, modAmt);
    sun.intensity = 1.5 + (si - 1.5) * modAmt;
    fog.near = 16 + (near - 16) * modAmt;
    fog.far = 78 + (far - 78) * modAmt;
    for (const g of gnomes) {
      if (shownMod === 'disco') { tmpA.setHSL((t * 0.2 + g.id * 0.1) % 1, 0.9, 0.6); g.setTint([1 + (tmpA.r * 1.4 - 1) * modAmt, 1 + (tmpA.g * 1.4 - 1) * modAmt, 1 + (tmpA.b * 1.4 - 1) * modAmt]); }
      else if (shownMod === 'goth') { const k = 1 - 0.78 * modAmt; g.setTint([k, k, k * 1.1]); }
      else g.setTint([1 + 0.2 * modAmt, 1 - 0.05 * modAmt, 1 - 0.35 * modAmt]);
    }
    tinted = true;
  } else if (tinted) {
    tinted = false;
    hemi.color.copy(baseSky);
    hemi.groundColor.copy(baseGround);
    hemi.intensity = 1.25;
    sun.color.copy(baseSun);
    sun.intensity = 1.5;
    fog.near = 16;
    fog.far = 78;
    for (const g of gnomes) g.setTint(null);
  }
  // the world is a normal night forest until you are hurt; low health is what makes it psychedelic
  const beat = sfx.beat;
  const hpNow = state === 'menu' ? 1 : Math.max(0, player.hp) / MAX_HP;
  const out = state !== 'menu' && player.alive && Math.hypot(player.pos.x, player.pos.z) > arena.ringR;
  let psyT = Math.max(0, Math.min(1, (0.72 - hpNow) / 0.5));
  if (out) psyT = Math.max(psyT, 0.7);
  if (state === 'menu') psyT = 0.85; // the menu shows off
  psy += (psyT - psy) * Math.min(1, dt * 2.5);
  trip.psy = psy;
  fog.color.copy(trip.horizon(t, fogCol));
  trip.update(t, camera.position, beat);
  trip.render(scene, camera, t, psy * 1.3, beat, 0);
}

// adaptive quality: if a phone struggles, render fewer pixels, then tone the trip down, rather than stutter
let slow = 0;
let last = performance.now();
function loop(now: number) {
  requestAnimationFrame(loop);
  const delta = now - last;
  frame(now, last);
  last = now;
  if (delta > 30) slow++; else slow = Math.max(0, slow - 1);
  if (slow > 45) {
    slow = 0;
    if (pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.25);
      renderer.setPixelRatio(pixelRatio);
      fit();
    } else if (trip.level > 0) {
      trip.level--;
    }
  }
}
requestAnimationFrame((t) => { last = t; loop(t); });

// a little handle for testing
(window as unknown as { pg: unknown }).pg = { player, bots, arena, startMatch, frame, pause, banter, mod: (m: Mod) => { curMod = m; lastMod = m; shownMod = m; arena.mod = m; modUntil = arena.time + 60; sfx.setMood(m); }, get state() { return state; } };
