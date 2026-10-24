import { Gnome } from './gnomes';

const r2 = (v: number) => Math.round(v * 100) / 100;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** How one gnome travels in a snapshot: a flat array of numbers (positions to 2 places, timers to 1). */
export function packGnome(g: Gnome): number[] {
  return [
    r2(g.pos.x), r2(g.pos.y), r2(g.pos.z), r2(g.aimYawNow), r2(g.aimPitchNow), g.peeing ? 1 : 0,
    Math.round(g.hp), Math.round(g.bladder), g.alive ? 1 : 0, g.team, g.gulag,
    r1(g.potions.chili), r1(g.potions.ice), r1(g.potions.acid), r1(g.burn), r1(g.acid), r1(g.chill), r1(g.frozen),
    r1(g.wizard), r1(g.speedT), r1(g.bounceT), r1(g.freeT), r1(g.energyT), r1(g.dizzy), g.locked ? 1 : 0, g.kills, g.spawnCount,
  ];
}

/**
 * Take the host's word for how a gnome is doing. For the gnome you are driving, your own position stays yours (it moves with your
 * thumbs), except when the host has just put you somewhere new (a spawn, the gulag, a respawn).
 */
export function applyGnome(g: Gnome, a: number[], local: boolean, teamHex: (t: number) => number) {
  if (a[6] < g.hp - 0.5) g.wet = 0.35; // a flash when somebody is hurt
  g.hp = a[6];
  g.bladder = a[7];
  g.locked = a[24] === 1;
  const alive = a[8] === 1;
  const respawned = a[26] !== g.spawnCount;
  if (alive && !g.alive) g.netRevive();
  else if (!alive && g.alive) g.netKill();
  if (g.team !== a[9]) g.setTeam(a[9], teamHex(a[9]));
  g.gulag = a[10] as 0 | 1 | 2;
  g.potions.chili = a[11];
  g.potions.ice = a[12];
  g.potions.acid = a[13];
  g.burn = a[14];
  g.acid = a[15];
  g.chill = a[16];
  g.frozen = a[17];
  g.wizard = a[18];
  g.speedT = a[19];
  g.bounceT = a[20];
  g.freeT = a[21];
  g.energyT = a[22];
  g.dizzy = a[23];
  g.kills = a[25];
  if (respawned) {
    g.spawnCount = a[26];
    g.pos.set(a[0], a[1], a[2]);
    g.vel.set(0, 0, 0);
    g.vy = 0;
    g.netX = a[0];
    g.netY = a[1];
    g.netZ = a[2];
    g.netYaw = a[3];
    g.yaw = a[3];
  }
  if (!local) {
    g.netX = a[0];
    g.netY = a[1];
    g.netZ = a[2];
    g.netYaw = a[3];
    g.netPitch = a[4];
    g.netPee = a[5] === 1;
  }
}
