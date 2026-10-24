import * as THREE from 'three';
import { SoftBox, lit } from './organic';

export const GNOME_SCALE = 0.8;

export type Faction = 'gnome' | 'goblin';

export interface GnomeModel {
  root: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  mats: THREE.MeshLambertMaterial[];
  /** Unscaled heights/half-width used for headshot and hat hitboxes. */
  headTop: number;
  hatTop: number;
  headHalf: number;
  /** The hat, as its own group so it can be shot off. hatHeight is where its centre sits (unscaled). */
  hat: THREE.Group;
  hatHeight: number;
  hatHalf: number;
}

const SKIN = 0xf0c8a0;

/** How one gnome is dressed. Every gnome gets its own mix, so a crowd of 50 looks like 50 different people. */
export interface Costume {
  hat: number; // style 0..9
  beard: number;
  trousers: number;
  boots: number;
  skin: number;
  face: number; // 0 none, 1 shades, 2 eyepatch, 3 goggles
  back: number; // 0 none, 1 cape, 2 backpack, 3 wings
  neck: number; // 0 none, 1 scarf, 2 tutu
  accent: number; // colour of the cape / pack / scarf
  size: number; // overall height multiplier
  chunk: number; // width multiplier
}

export const HAT_STYLES = 10;
const BEARDS = [0xf7f4ec, 0xf7f4ec, 0xb8b8b8, 0xd8702a, 0x1c1c1c, 0xe8c860, 0x3a7ae8, 0xff6ab4, 0x6a4a2a, 0x7affc0];
const TROUSER_COLS = [0x3a2a6a, 0x2a2a2a, 0x6a3a1a, 0x1a5a4a, 0x7a2a3a, 0x4a5a6a, 0xc8c0a0, 0x1a3a8a];
const BOOT_COLS = [0x1a1414, 0x1a1414, 0x5a3a1a, 0xf0f0f0, 0xc42b2b, 0x2a4ac4, 0xe8b830];
const SKIN_TONES = [0xf0c8a0, 0xf0c8a0, 0xd8a070, 0xf6d8c0, 0xb07850, 0xe8b0a0, 0x8a5a3a];
const ACCENTS = [0xb01030, 0x19c8e0, 0xe0c020, 0x9a3ae0, 0x30c060, 0xff7a1a, 0xff4aa0, 0x2040d0];
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export function randomCostume(): Costume {
  return {
    hat: Math.floor(Math.random() * HAT_STYLES),
    beard: pick(BEARDS),
    trousers: pick(TROUSER_COLS),
    boots: pick(BOOT_COLS),
    skin: pick(SKIN_TONES),
    face: Math.random() < 0.45 ? 1 + Math.floor(Math.random() * 3) : 0,
    back: Math.random() < 0.55 ? 1 + Math.floor(Math.random() * 3) : 0,
    neck: Math.random() < 0.4 ? 1 + Math.floor(Math.random() * 2) : 0,
    accent: pick(ACCENTS),
    size: 0.88 + Math.random() * 0.3,
    chunk: 0.9 + Math.random() * 0.26,
  };
}

export const costumeKey = (c: Costume) => Object.values(c).join('.');

export function createGnome(shirt: number, hat = 0xc42b2b, cos: Costume = { hat: 0, beard: 0xf7f4ec, trousers: 0x3a2a6a, boots: 0x1a1414, skin: SKIN, face: 0, back: 0, neck: 0, accent: 0xb01030, size: 1, chunk: 1 }): GnomeModel {
  const root = new THREE.Group();
  const mats: THREE.MeshLambertMaterial[] = [];

  const mk = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, color: number) => {
    const m = lit({ color });
    mats.push(m);
    const mesh = new THREE.Mesh(new SoftBox(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const TROUSERS = cos.trousers;
  const BOOT = cos.boots;
  const WHITE = 0xf7f4ec;
  const BEARD = cos.beard;
  const PINK = 0xe8808a;

  // a classic garden gnome: stubby legs in big boots
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(-0.14, 0.45, 0);
  legR.position.set(0.14, 0.45, 0);
  for (const leg of [legL, legR]) {
    mk(leg, 0.26, 0.28, 0.28, 0, -0.14, 0, TROUSERS);
    mk(leg, 0.3, 0.2, 0.42, 0, -0.35, -0.05, BOOT);
    mk(leg, 0.3, 0.05, 0.44, 0, -0.43, -0.05, 0x3a2e28); // sole
  }
  root.add(legL, legR);

  // round jacket, black belt with a gold buckle
  mk(root, 0.66, 0.54, 0.46, 0, 0.72, 0, shirt);
  mk(root, 0.68, 0.09, 0.48, 0, 0.5, 0, 0x1a1a1a);
  mk(root, 0.13, 0.11, 0.03, 0, 0.5, -0.25, 0xe8b830);

  // big round head with a bright nose; front is -z
  mk(root, 0.46, 0.4, 0.44, 0, 1.17, 0, cos.skin);
  mk(root, 0.18, 0.18, 0.16, 0, 1.12, -0.29, PINK); // big round nose
  mk(root, 0.08, 0.08, 0.04, -0.12, 1.22, -0.23, 0x161616); // eyes
  mk(root, 0.08, 0.08, 0.04, 0.12, 1.22, -0.23, 0x161616);
  mk(root, 0.12, 0.09, 0.03, -0.18, 1.1, -0.225, 0xf0a0a0); // rosy cheeks
  mk(root, 0.12, 0.09, 0.03, 0.18, 1.1, -0.225, 0xf0a0a0);
  mk(root, 0.07, 0.12, 0.1, -0.265, 1.15, 0, PINK); // ears
  mk(root, 0.07, 0.12, 0.1, 0.265, 1.15, 0, PINK);

  // a huge beard that covers the whole chest, in any colour
  mk(root, 0.5, 0.2, 0.18, 0, 1.0, -0.26, BEARD);
  mk(root, 0.46, 0.2, 0.2, 0, 0.82, -0.29, BEARD);
  mk(root, 0.36, 0.2, 0.2, 0, 0.64, -0.3, BEARD);
  mk(root, 0.22, 0.16, 0.18, 0, 0.5, -0.3, BEARD);
  mk(root, 0.34, 0.09, 0.12, 0, 1.05, -0.33, BEARD); // moustache
  mk(root, 0.16, 0.08, 0.1, -0.2, 1.03, -0.32, BEARD);
  mk(root, 0.16, 0.08, 0.1, 0.2, 1.03, -0.32, BEARD);

  // face gear
  if (cos.face === 1) { mk(root, 0.42, 0.08, 0.05, 0, 1.23, -0.25, 0x08080c); mk(root, 0.12, 0.03, 0.02, -0.1, 1.24, -0.285, 0x19f0ff); mk(root, 0.12, 0.03, 0.02, 0.1, 1.24, -0.285, 0xff2bd6); }
  else if (cos.face === 2) { mk(root, 0.13, 0.11, 0.04, 0.12, 1.22, -0.25, 0x0a0a0a); mk(root, 0.48, 0.03, 0.46, 0, 1.3, 0, 0x0a0a0a); }
  else if (cos.face === 3) { mk(root, 0.46, 0.1, 0.06, 0, 1.25, -0.25, 0x3a3a44); mk(root, 0.15, 0.13, 0.04, -0.11, 1.25, -0.29, 0x19f0ff); mk(root, 0.15, 0.13, 0.04, 0.11, 1.25, -0.29, 0x19f0ff); }

  // the hat, as its own group so it could be shot off. Ten styles, all in this gnome's colour
  let HC = 1.39; // brim sits right on top of the head (head top is at 1.37)
  const hatGroup = new THREE.Group();
  hatGroup.position.y = HC;
  root.add(hatGroup);
  const stack = (layers: [number, number, number, number][], bend = 5) => layers.forEach(([w, h, d, y], i) => mk(hatGroup, w, h, d, 0, y, i >= bend ? 0.04 * (i - bend + 1) : 0, hat));
  switch (cos.hat) {
    case 0: // the classic tall bent cone
      stack([[0.62, 0.08, 0.62, 0], [0.5, 0.16, 0.5, 0.12], [0.42, 0.16, 0.42, 0.28], [0.34, 0.16, 0.34, 0.44], [0.26, 0.16, 0.26, 0.6], [0.19, 0.16, 0.19, 0.76], [0.12, 0.16, 0.12, 0.92]]);
      mk(hatGroup, 0.07, 0.07, 0.07, 0, 1.05, 0.1, WHITE);
      break;
    case 1: // short stubby cone
      stack([[0.6, 0.08, 0.6, 0], [0.46, 0.14, 0.46, 0.1], [0.34, 0.14, 0.34, 0.24], [0.2, 0.14, 0.2, 0.38]], 9);
      mk(hatGroup, 0.09, 0.09, 0.09, 0, 0.52, 0, WHITE);
      break;
    case 2: // wide-brim wizard hat with a gold band and star
      mk(hatGroup, 0.96, 0.05, 0.96, 0, 0, 0, hat);
      stack([[0.52, 0.2, 0.52, 0.1], [0.44, 0.2, 0.44, 0.3], [0.36, 0.2, 0.36, 0.5], [0.28, 0.2, 0.28, 0.7], [0.2, 0.18, 0.2, 0.88]], 4);
      mk(hatGroup, 0.54, 0.07, 0.54, 0, 0.09, 0, 0xe8b830);
      mk(hatGroup, 0.1, 0.1, 0.03, 0, 0.45, -0.19, 0xfcee0a);
      break;
    case 3: // top hat with a black band
      mk(hatGroup, 0.64, 0.05, 0.64, 0, 0, 0, 0x14101c);
      mk(hatGroup, 0.4, 0.52, 0.4, 0, 0.28, 0, hat);
      mk(hatGroup, 0.42, 0.1, 0.42, 0, 0.1, 0, 0x14101c);
      break;
    case 4: // beanie with a white cuff and a pompom
      mk(hatGroup, 0.5, 0.1, 0.5, 0, 0.02, 0, WHITE);
      mk(hatGroup, 0.46, 0.16, 0.46, 0, 0.14, 0, hat);
      mk(hatGroup, 0.36, 0.12, 0.36, 0, 0.26, 0, hat);
      mk(hatGroup, 0.16, 0.16, 0.16, 0, 0.4, 0, WHITE);
      break;
    case 5: // a mohawk instead of a hat
      for (let i = 0; i < 6; i++) mk(hatGroup, 0.08, 0.22 + 0.12 * Math.sin((i / 5) * Math.PI), 0.1, 0, 0.08 + 0.06 * Math.sin((i / 5) * Math.PI), -0.2 + i * 0.08, hat);
      break;
    case 6: { // a crooked party hat with a pompom
      hatGroup.rotation.z = 0.3;
      stack([[0.38, 0.14, 0.38, 0.05], [0.3, 0.14, 0.3, 0.19], [0.22, 0.14, 0.22, 0.33], [0.14, 0.14, 0.14, 0.47]], 9);
      mk(hatGroup, 0.4, 0.04, 0.4, 0, 0.14, 0, WHITE);
      mk(hatGroup, 0.12, 0.12, 0.12, 0, 0.6, 0, 0xfcee0a);
      break;
    }
    case 7: // a gold crown with gems
      mk(hatGroup, 0.5, 0.14, 0.5, 0, 0.05, 0, 0xe8b830);
      for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2], [0, -0.22]] as const) { mk(hatGroup, 0.1, 0.2, 0.1, x, 0.2, z, 0xe8b830); mk(hatGroup, 0.07, 0.07, 0.07, x, 0.34, z, hat); }
      break;
    case 8: // a traffic cone
      mk(hatGroup, 0.56, 0.06, 0.56, 0, 0, 0, 0xff7a1a);
      mk(hatGroup, 0.4, 0.2, 0.4, 0, 0.14, 0, 0xff7a1a);
      mk(hatGroup, 0.34, 0.1, 0.34, 0, 0.29, 0, WHITE);
      mk(hatGroup, 0.24, 0.2, 0.24, 0, 0.44, 0, 0xff7a1a);
      mk(hatGroup, 0.12, 0.1, 0.12, 0, 0.59, 0, hat);
      break;
    default: // a miner's helmet with a lamp
      mk(hatGroup, 0.56, 0.06, 0.56, 0, 0, 0, 0xe8c020);
      mk(hatGroup, 0.46, 0.2, 0.46, 0, 0.12, 0, 0xe8c020);
      mk(hatGroup, 0.34, 0.1, 0.34, 0, 0.26, 0, 0xe8c020);
      mk(hatGroup, 0.14, 0.12, 0.08, 0, 0.16, -0.26, hat);
      mk(hatGroup, 0.07, 0.07, 0.04, 0, 0.16, -0.31, 0xfffbd0);
      break;
  }
  HC = 1.39;

  // arms with mittens
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(-0.42, 0.95, 0);
  armR.position.set(0.42, 0.95, 0);
  for (const arm of [armL, armR]) {
    mk(arm, 0.2, 0.36, 0.22, 0, -0.18, 0, shirt);
    mk(arm, 0.23, 0.2, 0.24, 0, -0.44, 0, cos.hat % 2 ? cos.accent : WHITE);
  }
  root.add(armL, armR);

  // back gear
  if (cos.back === 1) { mk(root, 0.62, 0.72, 0.05, 0, 0.62, 0.27, cos.accent); mk(root, 0.66, 0.08, 0.1, 0, 0.98, 0.25, cos.accent); }
  else if (cos.back === 2) { mk(root, 0.4, 0.5, 0.2, 0, 0.78, 0.33, cos.accent); mk(root, 0.32, 0.14, 0.22, 0, 0.9, 0.34, 0x1a1a1a); }
  else if (cos.back === 3) for (const sx of [-1, 1]) { const w = mk(root, 0.5, 0.44, 0.04, sx * 0.34, 0.92, 0.28, 0xeaf6ff); w.rotation.z = sx * 0.5; const w2 = mk(root, 0.34, 0.3, 0.04, sx * 0.3, 0.68, 0.28, 0xc8e8ff); w2.rotation.z = sx * 0.35; }
  // neck / waist gear
  if (cos.neck === 1) { mk(root, 0.58, 0.1, 0.56, 0, 0.97, 0, cos.accent); mk(root, 0.11, 0.36, 0.06, 0.2, 0.78, -0.33, cos.accent); }
  else if (cos.neck === 2) mk(root, 0.9, 0.07, 0.66, 0, 0.46, 0, 0xff7ad8);

  root.scale.setScalar(GNOME_SCALE);
  return { root, legL, legR, armL, armR, mats, headTop: 1.4, hatTop: 2.6, headHalf: 0.25, hat: hatGroup, hatHeight: HC, hatHalf: 0.2 };
}

const GOBLIN_SKIN = 0x6aa84f;
const GOBLIN_SHIRTS = [0x6b4a2f, 0x4a4d52, 0x7a3b2a, 0x555a3a, 0x3a3a52];
export const SKIN_COLOURS: Record<Faction, number> = { gnome: SKIN, goblin: GOBLIN_SKIN };

/** Green, gleeful and a bit grubby: big ears, big nose, pointy teeth and a horned iron cap. */
export function createGoblin(shirt: number): GnomeModel {
  const root = new THREE.Group();
  const mats: THREE.MeshLambertMaterial[] = [];

  const mk = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, color: number) => {
    const m = lit({ color });
    mats.push(m);
    const mesh = new THREE.Mesh(new SoftBox(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(-0.13, 0.45, 0);
  legR.position.set(0.13, 0.45, 0);
  for (const leg of [legL, legR]) {
    mk(leg, 0.2, 0.3, 0.22, 0, -0.15, 0, GOBLIN_SKIN);
    mk(leg, 0.24, 0.17, 0.3, 0, -0.365, -0.02, 0x3b2a1a); // boot
  }
  root.add(legL, legR);

  // ragged leather tunic
  mk(root, 0.6, 0.55, 0.35, 0, 0.725, 0, shirt);
  mk(root, 0.62, 0.08, 0.37, 0, 0.52, 0, 0x2a1d12);
  mk(root, 0.12, 0.12, 0.02, 0, 0.52, -0.19, 0xb08a3a);
  mk(root, 0.14, 0.2, 0.37, -0.2, 0.42, 0, shirt); // torn hem
  mk(root, 0.14, 0.14, 0.37, 0.12, 0.43, 0, shirt);

  // head: green, brutish, front is -z
  mk(root, 0.4, 0.4, 0.4, 0, 1.2, 0, GOBLIN_SKIN);
  mk(root, 0.14, 0.18, 0.2, 0, 1.15, -0.28, 0x88c060); // big nose
  mk(root, 0.08, 0.08, 0.04, -0.1, 1.27, -0.2, 0xffe040);
  mk(root, 0.08, 0.08, 0.04, 0.1, 1.27, -0.2, 0xffe040);
  mk(root, 0.035, 0.05, 0.05, -0.1, 1.27, -0.215, 0x111111);
  mk(root, 0.035, 0.05, 0.05, 0.1, 1.27, -0.215, 0x111111);
  mk(root, 0.36, 0.06, 0.06, 0, 1.35, -0.21, 0x3f6f2e); // angry brow
  mk(root, 0.22, 0.05, 0.04, 0, 1.04, -0.2, 0x2a1010); // mouth
  mk(root, 0.05, 0.08, 0.04, -0.07, 1.07, -0.215, 0xf4f0d8); // tusks
  mk(root, 0.05, 0.08, 0.04, 0.07, 1.07, -0.215, 0xf4f0d8);
  // big pointy ears
  for (const sx of [-1, 1]) {
    const e1 = mk(root, 0.34, 0.12, 0.06, sx * 0.36, 1.3, 0, GOBLIN_SKIN);
    e1.rotation.z = sx * 0.45;
    mk(root, 0.18, 0.08, 0.05, sx * 0.55, 1.42, 0, 0x7bbd5c);
  }

  // rusty iron cap with horns
  const HC = 1.55;
  const hatGroup = new THREE.Group();
  hatGroup.position.y = HC;
  root.add(hatGroup);
  mk(hatGroup, 0.46, 0.1, 0.46, 0, 1.45 - HC, 0, 0x7a5a3a);
  mk(hatGroup, 0.34, 0.1, 0.34, 0, 1.55 - HC, 0, 0x6a4c30);
  for (const sx of [-1, 1]) {
    const h = mk(hatGroup, 0.08, 0.26, 0.08, sx * 0.24, 1.62 - HC, 0, 0xe8ddc0);
    h.rotation.z = -sx * 0.4;
  }

  // arms: bare green with leather bracers
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(-0.38, 0.98, 0);
  armR.position.set(0.38, 0.98, 0);
  for (const arm of [armL, armR]) {
    mk(arm, 0.15, 0.5, 0.15, 0, -0.25, 0, GOBLIN_SKIN);
    mk(arm, 0.17, 0.14, 0.17, 0, -0.4, 0, 0x4a3320);
    mk(arm, 0.14, 0.14, 0.14, 0, -0.56, 0, GOBLIN_SKIN);
  }
  mk(armR, 0.09, 0.6, 0.12, 0, -0.6, 0, 0x2a2a2a);
  mk(armR, 0.07, 0.2, 0.2, 0, -0.45, 0.14, 0x4a3320);
  root.add(armL, armR);

  root.scale.setScalar(GNOME_SCALE);
  return { root, legL, legR, armL, armR, mats, headTop: 1.4, hatTop: 1.75, headHalf: 0.3, hat: hatGroup, hatHeight: HC, hatHalf: 0.24 };
}

/** Both sides are gnomes now. The hat is the team badge: red hats against blue caps. */
export function createFighter(faction: Faction): GnomeModel {
  // jackets: red hats wear blues and greens, blue caps wear greens and golds, so the hat stays the team badge
  const shirts = faction === 'gnome' ? [0x2f5fb0, 0x2a8f4a, 0x3a9ad0] : [0x3d8a3d, 0xd8a02a, 0x8a5a2a];
  return createGnome(shirts[Math.floor(Math.random() * shirts.length)], faction === 'gnome' ? 0xd42b2b : 0x2b5fe0);
}
