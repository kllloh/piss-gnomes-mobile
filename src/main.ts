import * as THREE from 'three';
import { Forest, HALF } from './forest';
import { Gnome, MAX_HP, EYE, aimPitch, type Arena, type Mod } from './gnomes';
import { Potions } from './potions';
import { Banter, modTagline } from './talk';
import { Nathaniel } from './nathaniel';
import { Bugs, BONUS_INFO, type BonusKind } from './bugs';
import { detectQuality } from './quality';
import { heightAt, surfaceAt, poiAt, renderTerrainImage, POIS, SEA, landNear } from './map';
import { Trip } from './trip';
import { PeeSystem, RANGE, PEE, MIX, KIND_BIT } from './pee';
import { Input } from './input';
import { Sfx } from './audio';

const TOTAL = 50; // gnomes in a match
const MIST_WAIT = 50; // seconds before the mist starts to close
const MIST_TIME = 330; // seconds it takes to close
const MIST_START = 129; // the island is about 108 across from its middle
const MIST_END = 8;
const COUNTDOWN = 3.4;
const WIZARD_TIME = 20;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// --- renderer, scene, camera -----------------------------------------------------------------------

const canvas = $<HTMLCanvasElement>('game');
// PlayStation-style vertex snapping: positions jump to a coarse screen grid, so edges shimmer and wobble a little
THREE.ShaderChunk.project_vertex = THREE.ShaderChunk.project_vertex.replace(
  'gl_Position = projectionMatrix * mvPosition;',
  'gl_Position = projectionMatrix * mvPosition;\n\tgl_Position.xy = floor(gl_Position.xy / gl_Position.w * vec2(170.0, 128.0) + 0.5) / vec2(170.0, 128.0) * gl_Position.w;',
);

// How hard to push this device: picked from the hardware, then adjusted while you play.
const quality = detectQuality();
console.info(`[piss-gnomes] quality ${quality.tier} (${quality.why})`);
// with the post pass on, anti-aliasing happens inside it, so the canvas itself does not need MSAA
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !quality.post, powerPreference: 'high-performance' });
// the picture is rendered small on purpose (about 360 lines tall) and scaled up with hard pixels, like a 1998 console
const RETRO_LINES = 360;
let ratioScale = 1;
const retroRatio = () => Math.max(0.3, Math.min(window.devicePixelRatio || 1, RETRO_LINES / window.innerHeight));
let pixelRatio = retroRatio();
renderer.setPixelRatio(pixelRatio);
// a lost graphics context (a phone being busy, or a tab swap) is fixed by starting again
canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
canvas.addEventListener('webglcontextrestored', () => location.reload());

const scene = new THREE.Scene();
const BASE_HI = 1.9;
const BASE_SI = 0.95;
const FOG_NEAR = 10;
const FOG_FAR = Math.round(quality.drawDist * 0.7); // thick night fog, like the old games
const fog = new THREE.Fog(0x0d121a, FOG_NEAR, FOG_FAR);
scene.fog = fog;
const hemi = new THREE.HemisphereLight(0xa0b0e0, 0x3a4046, BASE_HI);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xa8d0ff, BASE_SI); // the moon, a little cold and electric
sun.position.set(-0.4, 1, 0.5);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 160);
camera.rotation.order = 'YXZ';
const trip = new Trip(renderer, scene, quality);
trip.setPlanes(camera.near, camera.far);

function fit() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  pixelRatio = retroRatio() * ratioScale;
  renderer.setPixelRatio(pixelRatio);
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
  new THREE.MeshBasicMaterial({ color: 0xa8222a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, fog: false }),
);
mistWall.position.y = 9;
const mistLine = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 5, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xc0282d, fog: false }));
mistLine.position.y = 0.1;
scene.add(mistWall, mistLine);

const FIRST = ['Barnaby', 'Gorse', 'Mildred', 'Pudding', 'Nettle', 'Fungus', 'Bramble', 'Turnip', 'Hazel', 'Mortimer', 'Biscuit', 'Wilbur', 'Agnes', 'Thistle', 'Cornelius', 'Dandelion', 'Humphrey', 'Marigold', 'Percival', 'Quince', 'Rufus', 'Sorrel', 'Tobias', 'Ulysses', 'Violet', 'Wombat', 'Yarrow', 'Zebedee', 'Clover', 'Ferdinand'];
const TITLED = ['Sir Wetsalot', 'Captain Drip', 'Lord Puddle', 'Old Tumble', 'Dame Splash', 'The Dribbler', 'Moist Mike', 'Baron Bladder', 'Lady Leak', 'Gnomeo', 'Wee Willie', 'Damp Dave', 'Splashy Pete', 'Puddle Pete', 'Count Drizzle', 'Tinkle Tim', 'Gushing Gus', 'Madam Mizzle', 'Trickle Tom', 'Flushing Fred'];
const NAMES = [...FIRST, ...TITLED];
const HATS = [0xc0282d, 0xd0842a, 0xd0c040, 0x4a9a4a, 0x2a9aaa, 0x3a5aaa, 0x7a4aaa, 0xaa3a7a, 0xc8c8c0, 0x7a5a3a, 0x2a8a6a, 0xc06a4a];

const player = new Gnome(scene, 'You', HATS[0], true, 0);
const bots: Gnome[] = [];
const botNames = NAMES.slice().sort(() => Math.random() - 0.5);
for (let i = 1; i < TOTAL; i++) bots.push(new Gnome(scene, botNames[i - 1], HATS[i % HATS.length], false, i));
const gnomes: Gnome[] = [player, ...bots];

const potions = new Potions(scene, forest);
const bugs = new Bugs(scene, forest);
const arena: Arena = { forest, pee, gnomes, ringR: MIST_START, time: 0, camera, frozen: true, potions, bugs, drawDist: quality.drawDist + 10, mod: null };
fit();

const banter = new Banter($('bubbles'), $('chatter'), player);
const nathaniel = new Nathaniel(scene);
document.fonts?.load('20px Audiowide').then(() => forest.refreshSigns()).catch(() => {});
const NATHANIEL_POS = new THREE.Vector3();
bugs.onFart = (x, z) => {
  sfx.fartAt({ x, y: 0.7, z });
  // somebody close by is horrified, or delighted
  const near = bots.filter((b) => b.alive && Math.hypot(b.pos.x - x, b.pos.z - z) < 24);
  if (near.length && Math.random() < 0.6) banter.sayLine(near[Math.floor(Math.random() * near.length)], 'bug:fart');
};
Gnome.onSay = (g, what) => banter.say(g, what, arena.mod, what === 'death' || what === 'kill');

// --- input ------------------------------------------------------------------------------------------------

const input = new Input($('touch'), $('peeBtn'), $('jumpBtn'));
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
const terrainImg = renderTerrainImage(340, HALF);
function drawMinimap() {
  const S = 124;
  const k = S / (2 * HALF + 6);
  const px = (x: number) => (x + HALF + 3) * k;
  mapCtx.clearRect(0, 0, S, S);
  mapCtx.drawImage(terrainImg, 0, 0, S, S);
  mapCtx.strokeStyle = 'rgba(25,240,255,.8)';
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
  mapCtx.strokeStyle = '#ff2bd6';
  mapCtx.lineWidth = 1.5;
  mapCtx.stroke();
  mapCtx.lineWidth = 1;
  for (const b of bugs.lying) {
    mapCtx.beginPath();
    mapCtx.arc(px(b.x), px(b.z), 3, 0, Math.PI * 2);
    mapCtx.fillStyle = hex(b.color);
    mapCtx.fill();
  }
  // Nathaniel: a gold diamond
  mapCtx.fillStyle = '#ffe066';
  mapCtx.save();
  mapCtx.translate(px(nathaniel.pos.x), px(nathaniel.pos.z));
  mapCtx.rotate(Math.PI / 4);
  mapCtx.fillRect(-3.5, -3.5, 7, 7);
  mapCtx.restore();
  for (const g of gnomes) {
    if (!g.alive) continue;
    mapCtx.beginPath();
    mapCtx.arc(px(g.pos.x), px(g.pos.z), g.isPlayer ? 4.5 : 2.3, 0, Math.PI * 2);
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

function startMatch(at?: { x: number; z: number }) {
  // you appear where you chose; the bots take the ring spawn points that are not on top of you
  const poi = POIS[Math.floor(Math.random() * POIS.length)];
  const c = landNear(at ? at.x : poi.x, at ? at.z : poi.z, 0.8);
  const spots = forest.spawns.filter((sp) => Math.hypot(sp.x - c.x, sp.z - c.z) > 14).sort(() => Math.random() - 0.5);
  while (spots.length < bots.length) spots.push(forest.randomFree(HALF - 8));
  player.spawn(new THREE.Vector3(c.x, heightAt(c.x, c.z), c.z));
  bots.forEach((g, i) => g.spawn(spots[i]));
  $('spawn').classList.remove('on');
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
  modNext = 30 + Math.random() * 10;
  arena.mod = null;
  sfx.setMood('none');
  potions.reset();
  bugs.reset();
  banter.clear();
  nathaniel.spawn(forest, player.pos);
  idleT = 4;
  nathSeen = false;
  requestWakeLock();
  $('feed').innerHTML = '';
  document.body.classList.remove('inmenu');
  $('menu').classList.remove('on');
  $('over').classList.remove('on');
  $('pause').classList.remove('on');
  $('aliveN').textContent = String(TOTAL);
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
    sfx.popAt(victim.pos);
    if (killer?.isPlayer) banner('NICE SOAKING!', `${victim.name} is out`, 1200);
  }
};

let lastHurtSfx = 0;
Gnome.onHurt = (g) => {
  if (!g.isPlayer) { sfx.hurtAt(g.pos, g.id); return; }
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
  $('stats').innerHTML = `Placed <b>${ordinal(playerPlace || TOTAL)}</b> of ${TOTAL}<br>Gnomes soaked: <b>${player.kills}</b><br>Time: <b>${fmt(matchTime)}</b>`;
  $('btnWatch').style.display = 'none';
  banner(won ? 'VICTORY!' : `${winner ? winner.name : 'Nobody'} wins`, '', 0);
  setTimeout(() => { if (state === 'over') $('over').classList.add('on'); }, won ? 900 : 600);
}

function showEliminated() {
  $('overTitle').textContent = 'ELIMINATED';
  $('overSub').textContent = 'You were soaked.';
  $('stats').innerHTML = `Placed <b>${ordinal(playerPlace)}</b> of ${TOTAL}<br>Gnomes soaked: <b>${player.kills}</b><br>Time: <b>${fmt(matchTime)}</b>`;
  $('btnWatch').style.display = '';
  $('over').classList.add('on');
  input.release();
}

function pause(on: boolean) {
  if (state === 'menu' || state === 'over') return;
  paused = on;
  $('pause').classList.toggle('on', on);
  input.release();
  if (on) { sfx.hiss(false); sfx.hissOthers([]); }
}

// --- the big map (tap the minimap or press M) and the place names -----------------------------------------------------

let mapOpen = false;
function drawBigMap(spawnSel?: { x: number; z: number }) {
  const cv = $<HTMLCanvasElement>(spawnSel ? 'spawnCanvas' : 'bigmapCanvas');
  const portrait = window.innerWidth < window.innerHeight;
  const S = Math.floor(spawnSel ? Math.min(window.innerHeight * 0.88, window.innerWidth * (portrait ? 0.92 : 0.56)) : Math.min(window.innerHeight * 0.86, window.innerWidth * 0.94));
  cv.width = cv.height = S;
  cv.style.width = cv.style.height = `${S}px`;
  const ctx = cv.getContext('2d')!;
  const k = S / (2 * HALF + 6);
  const px = (v: number) => (v + HALF + 3) * k;
  ctx.drawImage(terrainImg, 0, 0, S, S);
  // a faint tactical grid every 30 units
  ctx.strokeStyle = 'rgba(25,240,255,.16)';
  ctx.lineWidth = 1;
  for (let v = -HALF; v <= HALF; v += 30) {
    ctx.beginPath(); ctx.moveTo(px(v), 0); ctx.lineTo(px(v), S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, px(v)); ctx.lineTo(S, px(v)); ctx.stroke();
  }
  // the safe circle
  if (!spawnSel) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, S, S);
    ctx.arc(px(0), px(0), arena.ringR * k, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(168,34,42,.4)';
    ctx.fill('evenodd');
    ctx.restore();
    ctx.beginPath();
    ctx.arc(px(0), px(0), arena.ringR * k, 0, Math.PI * 2);
    ctx.strokeStyle = '#c0282d';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // the names
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fs = Math.max(11, Math.round(S / 38));
  ctx.font = `${fs}px Audiowide, "Segoe UI", sans-serif`;
  POIS.forEach((p, i) => {
    const neon = i % 2 ? '#19f0ff' : '#ff2bd6';
    const x = px(p.x);
    const y = px(p.z);
    ctx.save();
    ctx.shadowColor = neon;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, fs * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = neon;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = fs * 0.34;
    ctx.strokeStyle = 'rgba(4,2,10,.9)';
    ctx.lineJoin = 'round';
    ctx.strokeText(p.name, x, y - fs * 1.15);
    ctx.save();
    ctx.shadowColor = neon;
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#eaffff';
    ctx.fillText(p.name, x, y - fs * 1.15);
    ctx.restore();
  });
  if (spawnSel) {
    // where you are about to land: a pulsing red ring
    const sx = px(spawnSel.x);
    const sy = px(spawnSel.z);
    const pulse = 1 + 0.15 * Math.sin(performance.now() / 180);
    ctx.save();
    ctx.shadowColor = '#fcee0a';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#fcee0a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, fs * 1.1 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    // crosshair ticks
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.beginPath();
      ctx.moveTo(sx + dx * fs * 1.5, sy + dz * fs * 1.5);
      ctx.lineTo(sx + dx * fs * 2.3, sy + dz * fs * 2.3);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(sx, sy, fs * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#fcee0a';
    ctx.fill();
    ctx.restore();
    return;
  }
  // Nathaniel, and you
  ctx.save();
  ctx.translate(px(nathaniel.pos.x), px(nathaniel.pos.z));
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#fcee0a';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.fillRect(-fs * 0.4, -fs * 0.4, fs * 0.8, fs * 0.8);
  ctx.strokeRect(-fs * 0.4, -fs * 0.4, fs * 0.8, fs * 0.8);
  ctx.restore();
  if (player.alive) {
    ctx.save();
    ctx.translate(px(player.pos.x), px(player.pos.z));
    ctx.rotate(-player.yaw + Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, -fs * 0.9);
    ctx.lineTo(fs * 0.6, fs * 0.6);
    ctx.lineTo(0, fs * 0.25);
    ctx.lineTo(-fs * 0.6, fs * 0.6);
    ctx.closePath();
    ctx.fillStyle = '#19f0ff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#19f0ff';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

// --- choosing where to spawn: tap a named place, or anywhere on the island ------------------------------------------

let spawnPick: { x: number; z: number } = { x: 0, z: 0 };
function describeSpawn() {
  const p = poiAt(spawnPick.x, spawnPick.z);
  $('spawnName').textContent = p ? p.name : 'Open ground';
}
function drawSpawn() {
  drawBigMap(spawnPick);
  describeSpawn();
}
function openSpawn() {
  state = 'menu';
  paused = false;
  mapOpen = false;
  for (const id of ['over', 'pause', 'bigmap', 'menu']) $(id).classList.remove('on');
  document.body.classList.add('inmenu');
  $('spawn').classList.add('on');
  input.release();
  if (!spawnPick.x && !spawnPick.z) { const st = POIS.find((p) => p.kind === 'stones')!; spawnPick = { x: st.x, z: st.z }; }
  drawSpawn();
}
$('spawnCanvas').addEventListener('pointerup', (e) => {
  const cv = $('spawnCanvas') as HTMLCanvasElement;
  const r = cv.getBoundingClientRect();
  const fx = (e.clientX - r.left) / r.width;
  const fz = (e.clientY - r.top) / r.height;
  const wx = fx * (2 * HALF + 6) - HALF - 3;
  const wz = fz * (2 * HALF + 6) - HALF - 3;
  // snap to a named place if the tap is close to its dot
  let best: (typeof POIS)[number] | null = null;
  let bd = (2 * HALF + 6) * 0.045;
  for (const p of POIS) {
    const d = Math.hypot(p.x - wx, p.z - wz);
    if (d < bd) { bd = d; best = p; }
  }
  spawnPick = best ? { x: best.x, z: best.z } : landNear(wx, wz, 0.8);
  drawSpawn();
});
window.addEventListener('resize', () => { if ($('spawn').classList.contains('on')) drawSpawn(); });
setInterval(() => { if ($('spawn').classList.contains('on')) drawSpawn(); }, 120); // keeps the selection ring pulsing

function openMap(on: boolean) {
  if (on && state !== 'play' && state !== 'countdown') return;
  mapOpen = on;
  paused = on;
  $('bigmap').classList.toggle('on', on);
  input.release();
  if (on) drawBigMap();
}
$('minimap').addEventListener('click', () => openMap(true));
$('bigmap').addEventListener('click', () => openMap(false));
window.addEventListener('keydown', (e) => { if (e.code === 'KeyM') openMap(!mapOpen); if (e.code === 'Escape' && mapOpen) openMap(false); });

let lastPoi = '';
let locTimer = 0;
function updateLocation() {
  const poi = player.alive ? poiAt(player.pos.x, player.pos.z) : null;
  const name = poi ? poi.name : '';
  if (name !== lastPoi) {
    lastPoi = name;
    if (poi) {
      const el = $('loc');
      el.textContent = '\u{1F4CD} ' + poi.name.toUpperCase();
      el.style.borderColor = poi.color;
      el.classList.add('show');
      clearTimeout(locTimer);
      locTimer = window.setTimeout(() => el.classList.remove('show'), 3200);
    }
  }
}

// --- the how-to-play slider on the start screen ------------------------------------------------------------

(() => {
  const slider = $('slider');
  const dots = $('dots');
  const slides = slider.querySelectorAll('.slide');
  const prev = $<HTMLButtonElement>('slPrev');
  const next = $<HTMLButtonElement>('slNext');
  const go = (i: number) => slider.scrollTo({ left: Math.max(0, Math.min(slides.length - 1, i)) * slider.clientWidth, behavior: 'smooth' });
  const idx = () => Math.round(slider.scrollLeft / Math.max(1, slider.clientWidth));
  slides.forEach((_, i) => {
    const d = document.createElement('button');
    d.setAttribute('aria-label', `Page ${i + 1}`);
    d.addEventListener('click', () => go(i));
    dots.appendChild(d);
  });
  const sync = () => {
    const i = idx();
    dots.querySelectorAll('button').forEach((d, k) => d.classList.toggle('on', k === i));
    prev.disabled = i <= 0;
    next.disabled = i >= slides.length - 1;
  };
  slider.addEventListener('scroll', sync, { passive: true });
  prev.addEventListener('click', () => go(idx() - 1));
  next.addEventListener('click', () => go(idx() + 1));
  window.addEventListener('keydown', (e) => {
    if (state !== 'menu') return;
    if (e.code === 'ArrowRight') go(idx() + 1);
    if (e.code === 'ArrowLeft') go(idx() - 1);
  });
  window.addEventListener('resize', () => slider.scrollTo({ left: idx() * slider.clientWidth }));
  sync();
})();

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
  try { sfx.init(); sfx.startMusic(); } catch { /* no sound is better than no game */ }
  if (!isApple) goFullscreen();
  openSpawn();
});
$('btnAgain').addEventListener('click', () => openSpawn());
$('btnWatch').addEventListener('click', () => {
  $('over').classList.remove('on');
  spectating = true;
});
$('btnPause').addEventListener('click', () => pause(true));
$('btnResume').addEventListener('click', () => pause(false));
$('btnRestart').addEventListener('click', () => { paused = false; openSpawn(); });
$('btnDeploy').addEventListener('click', () => startMatch(spawnPick));
$('btnSpawnBack').addEventListener('click', () => { $('spawn').classList.remove('on'); $('menu').classList.add('on'); });
$('btnSound').addEventListener('click', () => {
  sfx.setMuted(!sfx.muted);
  banter.setVoices(!sfx.muted);
  $('btnSound').innerHTML = sfx.muted ? '&#128263;' : '&#128266;';
});
window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && !mapOpen) pause(!paused); if (e.code === 'Enter' && state === 'menu') { if ($('spawn').classList.contains('on')) startMatch(spawnPick); else $('btnPlay').click(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
// no pinch-zoom, double-tap zoom or long-press menus while playing
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if ((e.target as HTMLElement).closest('.overlay') === null) e.preventDefault(); }, { passive: false });

// --- screen wake lock (a long match should not let the tablet go to sleep) ----------------------------------------

let wakeLock: { release(): Promise<void> } | null = null;
function requestWakeLock() {
  try {
    const wl = (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
    if (wl && !wakeLock) void wl.request('screen').then((l) => { wakeLock = l; }).catch(() => {});
  } catch { /* not available */ }
}
document.addEventListener('visibilitychange', () => { wakeLock = null; if (!document.hidden && state !== 'menu') requestWakeLock(); });

// --- lens flare: the sun's glare and its ghosts, hidden when a mushroom is in the way ---------------------------

const flareEls = {
  glow: document.querySelector('#flare .glow') as HTMLElement,
  streak: document.querySelector('#flare .streak') as HTMLElement,
  ghosts: [...document.querySelectorAll('#flare .ghost')] as HTMLElement[],
};
const SUN_CALM = new THREE.Vector3(0.35, 0.55, -0.75).normalize();
const SUN_BOGAN = new THREE.Vector3(0.5, 0.1, -0.85).normalize();
const GHOST_AT = [0.35, 0.62, 1.0, 1.4, 1.85];
const GHOST_OP = [0.85, 0.7, 0.8, 0.5, 0.6];
const _fv = new THREE.Vector3();
let flareVis = 0;
let flareShown = false;

function updateFlare(dt: number, t: number) {
  const on = quality.flare && state !== 'menu';
  let strength = on ? 1 - psy * 0.85 : 0;
  if (shownMod === 'goth') strength *= 1 - modAmt;
  else if (shownMod === 'disco') strength *= 1 - modAmt * 0.7;
  if (strength <= 0.01) {
    if (flareShown) { flareShown = false; flareEls.glow.style.opacity = flareEls.streak.style.opacity = '0'; flareEls.ghosts.forEach((g) => (g.style.opacity = '0')); }
    return;
  }
  const dir = shownMod === 'bogan' && modAmt > 0.5 ? SUN_BOGAN : SUN_CALM;
  _fv.copy(camera.position).addScaledVector(dir, 100).project(camera);
  const inFront = _fv.z < 1;
  const blocked = !inFront || forest.rayBlocked(camera.position.x, camera.position.y, camera.position.z, dir.x, dir.y, dir.z, 90);
  flareVis += ((blocked ? 0 : 1) - flareVis) * Math.min(1, dt * 9);
  const edge = 1 - Math.max(0, Math.min(1, (Math.max(Math.abs(_fv.x), Math.abs(_fv.y)) - 0.85) / 0.6));
  const v = flareVis * edge * strength;
  if (v < 0.004) {
    if (flareShown) { flareShown = false; flareEls.glow.style.opacity = flareEls.streak.style.opacity = '0'; flareEls.ghosts.forEach((g) => (g.style.opacity = '0')); }
    return;
  }
  flareShown = true;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const sx = (_fv.x * 0.5 + 0.5) * w;
  const sy = (-_fv.y * 0.5 + 0.5) * h;
  const vx = w / 2 - sx;
  const vy = h / 2 - sy;
  const far = Math.min(1, Math.hypot(vx, vy) / (0.75 * Math.hypot(w, h)));
  flareEls.glow.style.transform = `translate3d(${sx}px, ${sy}px, 0) scale(${1 + 0.06 * Math.sin(t * 2)})`;
  flareEls.glow.style.opacity = String(v * 0.7);
  flareEls.streak.style.transform = `translate3d(${sx}px, ${sy}px, 0)`;
  flareEls.streak.style.opacity = String(v * 0.55 * (1 - far * 0.5));
  flareEls.ghosts.forEach((g, i) => {
    g.style.transform = `translate3d(${sx + vx * GHOST_AT[i]}px, ${sy + vy * GHOST_AT[i]}px, 0)`;
    g.style.opacity = String(v * GHOST_OP[i] * (0.35 + 0.65 * far));
  });
}

// --- the frame -----------------------------------------------------------------------------------------------------------------

let hintsFaded = false;
// silly modes
const MOD_INDEX: Record<Mod, number> = { disco: 1, goth: 2, bogan: 3, upside: 4, moon: 5, slippery: 6 };
const MOD_LABEL: Record<Mod, string> = { disco: 'DISCO', goth: 'GOTH', bogan: 'BOGAN', upside: 'UPSIDE DOWN', moon: 'MOON', slippery: 'SLIPPERY' };
let curMod: Mod | null = null;
let shownMod: Mod = 'disco';
let lastMod: Mod | null = null;
let modAmt = 0;
let modUntil = 0;
let modNext = 14;
let idleT = 4;
let nathSeen = false;
let psy = 0;
let tinted = false;
const baseSky = new THREE.Color(0xa0b0e0);
const baseGround = new THREE.Color(0x3a4046);
const baseSun = new THREE.Color(0xa8d0ff);
const tmpA = new THREE.Color();
const tmpB = new THREE.Color();
const landing = { x: 0, z: 0 };
const fwd = new THREE.Vector3();
const stepSign = new Map<number, number>();
let nathSign = 0;

/** Streams and footsteps of everybody nearby, each coming from where they actually are. */
function soundScape() {
  const peeing: { pos: THREE.Vector3; v: number; d: number }[] = [];
  let steps = 0;
  for (const g of gnomes) {
    if (g.isPlayer || !g.alive) continue;
    const d = Math.hypot(g.pos.x - camera.position.x, g.pos.z - camera.position.z);
    if (g.peeing && d < 38) peeing.push({ pos: g.pos, v: Math.max(0.15, 1 - d / 38), d });
    const sg = Math.sin(g.walkPhase) >= 0 ? 1 : -1;
    if (stepSign.get(g.id) !== sg) {
      stepSign.set(g.id, sg);
      if (d < 24 && Math.hypot(g.vel.x, g.vel.z) > 1 && steps++ < 3) sfx.stepAt(g.pos);
    }
  }
  peeing.sort((a, b) => a.d - b.d);
  sfx.hiss(player.peeing);
  sfx.hissOthers(peeing);
  // Nathaniel's big boots
  if (state === 'play') {
    const sg = Math.sin(nathaniel.stepPhase) >= 0 ? 1 : -1;
    if (sg !== nathSign) {
      nathSign = sg;
      if (Math.hypot(nathaniel.pos.x - camera.position.x, nathaniel.pos.z - camera.position.z) < 45) sfx.stepAt(nathaniel.pos, true);
    }
  }
}
const fogCol = new THREE.Color();
const landMark = new THREE.Mesh(
  new THREE.RingGeometry(0.35, 0.55, 20).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xfff04a, transparent: true, opacity: 0.6, depthTest: false }),
);
landMark.renderOrder = 9;
landMark.visible = false;
scene.add(landMark);

function playerControls(dt: number) {
  input.poll();
  const [ly, lp] = input.takeLook();
  // upside down mode flips the picture, so left/right and up/down swap on screen
  const inv = shownMod === 'upside' && modAmt > 0.5 ? -1 : 1;
  player.yaw -= ly * inv; // dragging right turns right
  player.pitch = Math.max(-0.9, Math.min(1.25, player.pitch + lp * inv));
  if (player.dizzy > 0) {
    // Rainbow Cocktail: the world will not hold still
    player.yaw += Math.sin(arena.time * 4.3) * 1.2 * dt;
    player.pitch = Math.max(-0.9, Math.min(1.25, player.pitch + Math.cos(arena.time * 3.1) * 0.5 * dt));
  }
  // the stick is relative to where you are facing
  const fx = Math.sin(player.yaw);
  const fz = Math.cos(player.yaw);
  player.moveX = fx * input.moveF - fz * input.moveX * inv;
  player.moveZ = fz * input.moveF + fx * input.moveX * inv;
  player.hasAim = false;
  player.wantPee = input.fire;
  if (input.takeJump() && state === 'play') player.jump(arena.mod === 'moon' ? 10.5 : 8);

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
  if (player.mask && player.alive) {
    const info = MIX[player.mask];
    const parts: string[] = [];
    for (const k of ['chili', 'ice', 'acid'] as const) if (player.potions[k] > 0) parts.push(`${k.toUpperCase()} ${Math.ceil(player.potions[k])}s`);
    pot.style.display = 'block';
    pot.style.borderColor = '#' + info.color.toString(16).padStart(6, '0');
    pot.textContent = parts.join(' + ') + (parts.length > 1 ? ` = ${info.name.toUpperCase()}` : '');
  } else pot.style.display = 'none';
  const wz = $('wizard');
  if (player.wizard > 0 && player.alive) {
    wz.style.display = 'block';
    wz.textContent = `WIZARD MODE ${Math.ceil(player.wizard)}s`;
    $('wizfx').style.opacity = String(0.55 + 0.25 * Math.sin(arena.time * 6));
  } else {
    wz.style.display = 'none';
    $('wizfx').style.opacity = '0';
  }
  const buffs: string[] = [];
  if (player.speedT > 0) buffs.push(`SPEED ${Math.ceil(player.speedT)}s`);
  if (player.bounceT > 0) buffs.push(`BOUNCE ${Math.ceil(player.bounceT)}s`);
  if (player.freeT > 0) buffs.push(`BIG GULP ${Math.ceil(player.freeT)}s`);
  const bf = $('buffs');
  bf.style.display = buffs.length && player.alive ? 'block' : 'none';
  if (buffs.length) bf.textContent = buffs.join('  \u00b7  ');
  const chip = $('modchip');
  if (curMod && state === 'play') {
    chip.style.display = 'block';
    chip.textContent = `${MOD_LABEL[curMod]} MODE ${fmt(Math.max(0, modUntil - arena.time))}`;
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
  updateLocation();
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
      if (player.alive) playerControls(dt);
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

      pee.gravity = arena.mod === 'moon' ? 3.2 : 9;
      for (const g of gnomes) g.update(dt, arena);
      pee.update(dt, forest, gnomes, (victim, shooter, mask) => {
        if (god && victim.isPlayer) return;
        victim.hit(mask, shooter.dmg, shooter, arena.time);
        // napalm: the fire jumps to anybody standing close
        if ((mask === 5 || mask === 7) && victim.burn > 0 && Math.random() < 0.04) {
          for (const g of gnomes) {
            if (g !== victim && g !== shooter && g.alive && Math.hypot(g.pos.x - victim.pos.x, g.pos.z - victim.pos.z) < 3.4) g.ignite(shooter);
          }
        }
      });
      potions.update(dt, nowMs / 1000, gnomes, (g, kind) => {
        const mixed = (g.mask & (g.mask - 1)) !== 0; // two or more potions at once
        banter.sayLine(g, mixed ? 'mix:potion' : `${kind}:potion`);
        if (!g.isPlayer) sfx.grabAt(g.pos);
        if (g.isPlayer) {
          sfx.pop();
          if (mixed) banner('MIX! ' + MIX[g.mask].name.toUpperCase(), MIX[g.mask].blurb, 2600);
          else banner(PEE[kind].name.toUpperCase() + '!', PEE[kind].blurb, 1700);
        }
      });
      bugs.update(dt, nowMs / 1000, arena.ringR, gnomes, state === 'play', (g, kind: BonusKind) => {
        if (g.isPlayer) {
          sfx.pop();
          banner(BONUS_INFO[kind].name + '!', BONUS_INFO[kind].blurb, 1700);
        } else sfx.grabAt(g.pos);
        banter.sayLine(g, `${kind}:bonus`);
      });
      {
        const ev = nathaniel.update(dt, nowMs / 1000, forest, arena.ringR, state === 'play' && player.alive ? player.pos : null);
        if (ev.shout) {
          // you say hi, then he answers with the only word he knows
          if (player.alive) banter.sayLine(player, 'hi:nathaniel');
          window.setTimeout(() => {
            NATHANIEL_POS.copy(nathaniel.pos);
            banter.shout(NATHANIEL_POS, nathaniel.headY + 0.8, 'Nathaniel!', 0xffe066, true);
          }, 700);
        }
        // the first time he is near, point him out
        if (!nathSeen && state === 'play' && player.alive && nathaniel.cooldown <= 0 && Math.hypot(nathaniel.pos.x - player.pos.x, nathaniel.pos.z - player.pos.z) < 24) {
          nathSeen = true;
          banner('THERE IS NATHANIEL!', 'Get close and say hi to him', 3000);
        }
        if (ev.bless) {
          player.wizard = WIZARD_TIME;
          banner('WIZARD MODE!', 'Nathaniel blessed you. You cannot be hurt!', 3200);
          sfx.win();
          feedLine('<b>Nathaniel</b> gave you Wizard Mode');
        }
      }
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
          modNext = arena.time + 25 + Math.random() * 20;
        } else if (!curMod && arena.time >= modNext) {
          const pool = (['disco', 'goth', 'bogan', 'upside', 'moon', 'slippery'] as Mod[]).filter((m) => m !== lastMod);
          curMod = pool[Math.floor(Math.random() * pool.length)];
          lastMod = curMod;
          shownMod = curMod;
          arena.mod = curMod;
          modUntil = arena.time + 45 + Math.random() * 15;
          sfx.setMood(curMod);
          banner(MOD_LABEL[curMod] + ' MODE!', modTagline(curMod), 3200);
          feedLine(`<b>${MOD_LABEL[curMod]} MODE</b>`);
          sfx.alarm();
          for (const b of bots.filter((x) => x.alive).slice(0, 2)) banter.say(b, 'idle', curMod, true);
        }
      }

      // the sounds of the forest, placed around you
      soundScape();

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
      sfx.hiss(false);
      sfx.hissOthers([]);
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
    camera.position.set(Math.cos(a) * 16, Math.max(heightAt(Math.cos(a) * 16, Math.sin(a) * 16), SEA) + 2.4, Math.sin(a) * 16);
    camera.rotation.set(-0.08, -a - Math.PI / 2 + 0.6, 0);
  } else {
    const bob = Math.sin(focus.walkPhase) * 0.05 * Math.min(1, Math.hypot(focus.vel.x, focus.vel.z) / 3);
    camera.position.set(focus.pos.x, EYE + focus.pos.y + bob + (focus.alive ? 0 : 0.4), focus.pos.z);
    camera.rotation.set(focus.alive ? (focus === player ? focus.pitch : -0.04) : -0.4, focus.yaw + Math.PI, 0);
  }
  if (shownMod === 'bogan' && modAmt > 0.01) {
    camera.rotation.z = Math.sin(t * 0.9) * 0.05 * modAmt;
    camera.rotation.y += Math.sin(t * 0.6) * 0.03 * modAmt;
  } else camera.rotation.z = 0;
  if (shownMod === 'upside') camera.rotation.z += Math.PI * modAmt; // the whole world turns over
  if (focus === player && player.dizzy > 0) camera.rotation.z += Math.sin(t * 5) * 0.14;
  camera.getWorldDirection(fwd);
  sfx.setListener(camera.position, fwd.x, fwd.y, fwd.z);
  for (const g of gnomes) g.billboard(camera);
  banter.update(dt, camera);

  // the landing marker: where your stream will come down
  if (state !== 'menu' && player.alive) {
    const cp = Math.cos(player.pitch);
    const fx = Math.sin(player.yaw) * cp;
    const fz = Math.cos(player.yaw) * cp;
    const ok = pee.landing(player.pos.x + Math.sin(player.yaw) * 0.5, 0.75 + player.pos.y, player.pos.z + Math.cos(player.yaw) * 0.5, fx, Math.sin(player.pitch), fz, forest, landing);
    landMark.visible = ok;
    landMark.position.set(landing.x, surfaceAt(landing.x, landing.z) + 0.08, landing.z);
    landMark.rotation.z = t * 1.5;
    (landMark.material as THREE.MeshBasicMaterial).opacity = player.peeing ? 0.9 : 0.5;
  } else landMark.visible = false;

  mistWall.scale.set(arena.ringR, 1, arena.ringR);
  mistLine.scale.set(arena.ringR, 1, arena.ringR);
  forest.update(dt, t);

  // the silly modes: lights, colours, and tints on the gnomes
  const target = curMod && state === 'play' ? 1 : 0;
  modAmt += Math.max(-dt * 1.5, Math.min(dt * 1.5, target - modAmt));
  trip.mode = MOD_INDEX[shownMod];
  trip.modeAmt = modAmt;
  if (modAmt > 0.001) {
    let sky = baseSky, ground = baseGround, sunC = baseSun, hi = BASE_HI, si = BASE_SI, near = FOG_NEAR, far = FOG_FAR;
    if (shownMod === 'disco') { sky = tmpA.setHSL((t * 0.15) % 1, 0.8, 0.6); sunC = tmpB.setHSL((t * 0.3 + 0.5) % 1, 0.9, 0.6); hi = 1.9; si = 1.2; }
    else if (shownMod === 'goth') { sky = tmpA.setHex(0x6a5a9a); ground = tmpB.setHex(0x120a1a); sunC = sunC.clone().setHex(0x9a7aff); hi = 0.6; si = 0.4; near = 6; far = 50; }
    else if (shownMod === 'bogan') { sky = tmpA.setHex(0xffc890); ground = tmpB.setHex(0x6a4a20); sunC = sunC.clone().setHex(0xffa050); hi = 1.8; si = 1.3; }
    else if (shownMod === 'upside') { sky = tmpA.setHex(0xc090ff); ground = tmpB.setHex(0x7a3a60); sunC = sunC.clone().setHex(0xff9a6a); hi = 1.5; si = 0.8; near = 12; far = 75; }
    else if (shownMod === 'moon') { sky = tmpA.setHex(0xb0c0ff); ground = tmpB.setHex(0x505868); sunC = sunC.clone().setHex(0xffffff); hi = 0.9; si = 1.6; near = 60; far = FOG_FAR + 70; }
    else { sky = tmpA.setHex(0xd8f4ff); ground = tmpB.setHex(0x9ad0ff); sunC = sunC.clone().setHex(0xe8f8ff); hi = 1.95; si = 1.0; near = 30; far = FOG_FAR; }
    hemi.color.copy(baseSky).lerp(sky, modAmt);
    hemi.groundColor.copy(baseGround).lerp(ground, modAmt);
    hemi.intensity = BASE_HI + (hi - BASE_HI) * modAmt;
    sun.color.copy(baseSun).lerp(sunC, modAmt);
    sun.intensity = BASE_SI + (si - BASE_SI) * modAmt;
    fog.near = FOG_NEAR + (near - FOG_NEAR) * modAmt;
    fog.far = FOG_FAR + (far - FOG_FAR) * modAmt;
    for (const g of gnomes) {
      if (shownMod === 'disco') { tmpA.setHSL((t * 0.2 + g.id * 0.1) % 1, 0.9, 0.6); g.setTint([1 + (tmpA.r * 1.4 - 1) * modAmt, 1 + (tmpA.g * 1.4 - 1) * modAmt, 1 + (tmpA.b * 1.4 - 1) * modAmt]); }
      else if (shownMod === 'goth') { const k = 1 - 0.78 * modAmt; g.setTint([k, k, k * 1.1]); }
      else if (shownMod === 'bogan') g.setTint([1 + 0.2 * modAmt, 1 - 0.05 * modAmt, 1 - 0.35 * modAmt]);
      else if (shownMod === 'upside') g.setTint([1 + 0.1 * modAmt, 1 - 0.15 * modAmt, 1 + 0.25 * modAmt]);
      else if (shownMod === 'slippery') g.setTint([1 - 0.1 * modAmt, 1 + 0.05 * modAmt, 1 + 0.25 * modAmt]);
      else g.setTint(null);
    }
    tinted = true;
  } else if (tinted) {
    tinted = false;
    hemi.color.copy(baseSky);
    hemi.groundColor.copy(baseGround);
    hemi.intensity = BASE_HI;
    sun.color.copy(baseSun);
    sun.intensity = BASE_SI;
    fog.near = FOG_NEAR;
    fog.far = FOG_FAR;
    for (const g of gnomes) g.setTint(null);
  }
  // the world is a normal night forest until you are hurt; low health is what makes it psychedelic
  const beat = sfx.beat;
  const hpNow = state === 'menu' ? 1 : Math.max(0, player.hp) / MAX_HP;
  const out = state !== 'menu' && player.alive && Math.hypot(player.pos.x, player.pos.z) > arena.ringR;
  const PSY_BASE = 0.2; // a fifth of the trip is always on; low health turns it up
  let psyT = Math.max(PSY_BASE, Math.min(1, (0.72 - hpNow) / 0.5));
  if (out) psyT = Math.max(psyT, 0.7);
  if (player.wizard > 0) psyT = PSY_BASE; // nothing can hurt a wizard
  if (state === 'menu') psyT = 0.85; // the menu shows off
  psy += (psyT - psy) * Math.min(1, dt * 2.5);
  trip.psy = psy;
  fog.color.copy(trip.horizon(t, fogCol));
  trip.update(t, camera.position, beat);
  trip.render(scene, camera, t, psy * 1.3, beat, 0);
  updateFlare(dt, t);
}

// --- the frame-time governor: keep it smooth on whatever this device is -----------------------------------
// It watches how long frames really take. If they run slow it renders fewer pixels, then switches the post pass off;
// when there is plenty of headroom it slowly brings the sharpness back. 120 Hz screens are held to about 60 fps to save heat.

let ema = 16.7;
let slowMs = 0;
let fastMs = 0;
let lastDown = -1e9;
let last = performance.now();
let lastDrawn = 0;
let sample = 0;
let sampleSum = 0;
let capTo60 = false;

function setRatio(factor: number) {
  ratioScale = Math.max(0.6, Math.min(1, ratioScale * factor));
  fit();
}

function loop(now: number) {
  requestAnimationFrame(loop);
  const delta = now - last;
  // the first second tells us the screen's refresh rate
  if (sample < 90) {
    sample++;
    sampleSum += delta;
    if (sample === 90) capTo60 = sampleSum / 90 < 10;
  }
  if (capTo60 && now - lastDrawn < 14.5) return; // skip every other frame on a 120 Hz screen
  lastDrawn = now;
  frame(now, last);
  last = now;
  if (delta > 120) return; // a tab switch or a hitch is not the game's fault
  ema += (delta - ema) * 0.08;
  if (ema > 21) slowMs += delta; else slowMs = Math.max(0, slowMs - delta);
  if (slowMs > 1600) {
    slowMs = 0;
    lastDown = now;
    if (ratioScale > 0.61) setRatio(0.85);
    else if (trip.level > 0) trip.level--;
  }
  if (ema < 15.5 && ratioScale < 0.99 && now - lastDown > 12000) fastMs += delta; else fastMs = 0;
  if (fastMs > 5000) { fastMs = 0; setRatio(1.12); }
}
requestAnimationFrame((t) => { last = t; lastDrawn = t; loop(t); });

// a little handle for testing
(window as unknown as { pg: unknown }).pg = { player, bots, arena, startMatch, frame, pause, banter, nathaniel, bugs, sfx, quality, get pixelRatio() { return pixelRatio; }, mod: (m: Mod) => { curMod = m; lastMod = m; shownMod = m; arena.mod = m; modUntil = arena.time + 60; sfx.setMood(m); }, get state() { return state; } };
