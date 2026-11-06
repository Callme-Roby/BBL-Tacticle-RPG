import * as THREE from 'three';
import type { WeaponType } from '../rules/types';
import { createPS1Material } from './ps1Material';

/**
 * Low-poly weapons held in the right hand (built in the hand bone's space, like
 * the cinematic props of props.ts: arms hang down in the bind pose, the grip is
 * at the fist, the business end sticks out on the thumb side, +Z).
 */

const mats = new Map<string, THREE.Material>();
function mat(color: number, unlit = 0): THREE.Material {
  const key = color + ':' + unlit;
  let m = mats.get(key);
  if (!m) {
    m = createPS1Material({ color, unlit });
    mats.set(key, m);
  }
  return m;
}

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, unlit = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, unlit));
  m.position.set(x, y, z);
  return m;
}

function cylZ(r0: number, r1: number, len: number, color: number, x = 0, y = 0, z = 0, seg = 6, unlit = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, seg), mat(color, unlit));
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

const STEEL = 0xc8ccd4;
const STEEL_DARK = 0x7c818c;
const WOOD = 0x7a4a26;
const WOOD_DARK = 0x52321a;
const GOLD = 0xe8b830;
const LEATHER = 0x3a2416;

/** fist centre, relative to the hand bone */
const FIST_Y = -0.07;

/** visual flavour of a weapon from its id (bling = gold, rouillée = rust...) */
function tint(id: string, base: number): number {
  if (id.includes('bling')) return GOLD;
  if (id.includes('rouill')) return 0xa8784e;
  if (id.includes('chrom') || id.includes('acier')) return 0xe4e8f0;
  if (id.includes('fourbe') || id.includes('tueuse') || id.includes('tronc')) return 0xd04848;
  return base;
}

function sword(id: string): THREE.Group {
  const g = new THREE.Group();
  const blade = tint(id, STEEL);
  const len = id.includes('couteau') ? 0.45 : id.includes('double') ? 0.85 : 0.78;
  g.add(
    cylZ(0.022, 0.022, 0.16, LEATHER, 0, FIST_Y, -0.01), // grip
    box(0.2, 0.03, 0.04, id.includes('bling') ? GOLD : STEEL_DARK, 0, FIST_Y, 0.08), // guard
    box(0.06, 0.012, len, blade, 0, FIST_Y, 0.1 + len / 2), // blade
    box(0.02, 0.02, len * 0.9, STEEL_DARK, 0, FIST_Y, 0.1 + len / 2), // fuller
  );
  if (id.includes('wifi')) g.add(box(0.1, 0.1, 0.1, 0x40e0ff, 0, FIST_Y, 0.1 + len, 1));
  if (id.includes('double')) g.add(box(0.06, 0.012, len * 0.7, blade, 0, FIST_Y, -0.1 - len * 0.35));
  return g;
}

function lance(id: string): THREE.Group {
  const g = new THREE.Group();
  const broom = id.includes('balai');
  const shaft = broom ? 0xd8b060 : WOOD;
  g.add(cylZ(0.022, 0.022, 1.7, shaft, 0, FIST_Y, 0.35));
  if (broom) {
    // bristles
    g.add(box(0.2, 0.06, 0.22, 0xc89a40, 0, FIST_Y, 1.25), box(0.22, 0.03, 0.04, 0xb02020, 0, FIST_Y, 1.13));
  } else {
    const tip = tint(id, STEEL);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 4), mat(tip));
    head.rotation.x = Math.PI / 2;
    head.position.set(0, FIST_Y, 1.33);
    g.add(head);
    if (id.includes('brochette')) for (let i = 0; i < 3; i++) g.add(box(0.09, 0.09, 0.09, [0x8a4a2a, 0x3a9a3a, 0xd04030][i], 0, FIST_Y, 0.9 + i * 0.11));
  }
  return g;
}

function axe(id: string): THREE.Group {
  const g = new THREE.Group();
  const heavy = id.includes('bucheron') || id.includes('bling') || id.includes('marteau');
  g.add(cylZ(0.024, 0.024, heavy ? 0.85 : 0.6, WOOD_DARK, 0, FIST_Y, heavy ? 0.28 : 0.18));
  const head = tint(id, STEEL);
  const z = heavy ? 0.66 : 0.44;
  if (id.includes('marteau')) {
    g.add(box(0.22, 0.12, 0.14, STEEL_DARK, 0, FIST_Y, z), box(0.04, 0.08, 0.04, 0xf0c020, -0.13, FIST_Y, z));
  } else if (id.includes('tronc')) {
    g.add(box(0.14, 0.12, 0.2, 0xe86a1a, 0, FIST_Y, z - 0.04), box(0.04, 0.03, 0.42, STEEL, 0.09, FIST_Y, z + 0.16));
  } else {
    // blade on the outer side (+X = the hand's thumb side seen from the front)
    g.add(box(0.26, 0.02, heavy ? 0.26 : 0.18, head, 0.12, FIST_Y, z), box(0.05, 0.05, 0.08, STEEL_DARK, 0, FIST_Y, z));
  }
  return g;
}

function bow(id: string): THREE.Group {
  const g = new THREE.Group();
  const col = id.includes('plastique') ? 0x2a8ad8 : id.includes('bling') ? GOLD : WOOD;
  // vertical bow: limbs along Y (up / down from the fist), string on +Z side
  const up = box(0.035, 0.5, 0.035, col, 0, FIST_Y + 0.24, -0.05);
  up.rotation.x = -0.25;
  const down = box(0.035, 0.5, 0.035, col, 0, FIST_Y - 0.24, -0.05);
  down.rotation.x = 0.25;
  g.add(up, down, box(0.006, 0.92, 0.006, 0xf0f0e8, 0, FIST_Y, 0.06, 1));
  return g;
}

function tome(type: WeaponType): THREE.Group {
  const g = new THREE.Group();
  const col = type === 'anima' ? 0xd04020 : type === 'light' ? 0xf0e070 : 0x5a2a8a;
  g.add(box(0.2, 0.06, 0.26, col, 0, FIST_Y - 0.03, 0.08), box(0.18, 0.064, 0.24, 0xf4f0e0, 0.012, FIST_Y - 0.03, 0.08));
  g.add(box(0.06, 0.07, 0.06, type === 'dark' ? 0xc040ff : 0xffe080, 0, FIST_Y + 0.02, 0.08, 1));
  return g;
}

function staff(): THREE.Group {
  const g = new THREE.Group();
  g.add(cylZ(0.02, 0.02, 1.2, 0xe8e0d0, 0, FIST_Y, 0.15));
  // a white cross with a red plus at the top
  g.add(box(0.16, 0.16, 0.05, 0xffffff, 0, FIST_Y, 0.78), box(0.1, 0.03, 0.06, 0xe02020, 0, FIST_Y, 0.78, 1), box(0.03, 0.1, 0.06, 0xe02020, 0, FIST_Y, 0.78, 1));
  return g;
}

/** Weapon mesh for an item (null: nothing in the hand). */
export function buildWeapon(id: string, type: WeaponType | undefined): THREE.Object3D | null {
  switch (type) {
    case 'sword':
      return sword(id);
    case 'lance':
      return lance(id);
    case 'axe':
      return axe(id);
    case 'bow':
      return bow(id);
    case 'anima':
    case 'light':
    case 'dark':
      return tome(type);
    case 'staff':
      return staff();
    default:
      return null;
  }
}

export function disposeWeapon(o: THREE.Object3D) {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).geometry.dispose();
  });
}

// ------------------------------------------------------------------------- mounts

/** low-poly horse (stands on y = 0, faces +Z); `color` = coat, `cloth` = saddle cloth (team colour) */
export function buildHorse(color: number, cloth: number): THREE.Group {
  const g = new THREE.Group();
  const dark = new THREE.Color(color).multiplyScalar(0.6).getHex();
  g.add(box(0.42, 0.42, 1.0, color, 0, 0.92, 0)); // body
  g.add(box(0.46, 0.08, 0.5, cloth, 0, 1.15, 0, 0.2)); // saddle cloth
  g.add(box(0.44, 0.24, 0.3, cloth, 0, 0.98, 0.02)); // cloth sides
  const neck = box(0.22, 0.5, 0.26, color, 0, 1.25, 0.5);
  neck.rotation.x = 0.55;
  g.add(neck);
  const head = box(0.2, 0.2, 0.42, color, 0, 1.48, 0.78);
  head.rotation.x = 0.35;
  g.add(head, box(0.06, 0.4, 0.08, dark, 0, 1.36, 0.42)); // mane
  g.add(box(0.05, 0.1, 0.05, dark, 0.07, 1.62, 0.66), box(0.05, 0.1, 0.05, dark, -0.07, 1.62, 0.66)); // ears
  for (const [x, z] of [
    [0.14, 0.38],
    [-0.14, 0.38],
    [0.14, -0.38],
    [-0.14, -0.38],
  ]) {
    g.add(box(0.11, 0.72, 0.12, color, x, 0.36, z), box(0.12, 0.08, 0.13, dark, x, 0.04, z));
  }
  const tail = box(0.08, 0.5, 0.1, dark, 0, 0.82, -0.56);
  tail.rotation.x = -0.4;
  g.add(tail);
  return g;
}

/** small flying saucer (rider stands in the cockpit, rim at y ≈ 0.9) */
export function buildSaucer(cloth: number): THREE.Group {
  const g = new THREE.Group();
  const cyl = (r0: number, r1: number, h: number, color: number, y: number, unlit = 0) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 12), mat(color, unlit));
    m.position.y = y;
    g.add(m);
    return m;
  };
  cyl(0.85, 0.35, 0.22, 0x8e939c, 0.62);
  cyl(0.92, 0.92, 0.07, cloth, 0.75, 0.2);
  cyl(0.5, 0.85, 0.16, 0xb4b8be, 0.86);
  cyl(0.22, 0.22, 0.02, 0xfff0a0, 0.5, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(0.08, 0.05, 0.05, i % 2 ? 0xff4a34 : 0xffd23a, Math.sin(a) * 0.93, 0.75, Math.cos(a) * 0.93, 1));
  }
  return g;
}

/** armour pieces attached to the bones of a heavy unit */
export function buildArmor(color: number): { chest: THREE.Object3D; shoulderL: THREE.Object3D; shoulderR: THREE.Object3D; head: THREE.Object3D } {
  const chest = new THREE.Group();
  chest.add(box(0.46, 0.34, 0.32, color, 0, 0.1, 0.02), box(0.3, 0.06, 0.34, 0xf0d060, 0, 0.26, 0.02));
  const pad = () => {
    const g = new THREE.Group();
    g.add(box(0.2, 0.08, 0.22, color, 0, 0.04, 0));
    return g;
  };
  const head = new THREE.Group();
  // a crest on top of the head (keeps the face visible)
  head.add(box(0.05, 0.12, 0.3, 0xd02020, 0, 0.36, -0.02));
  return { chest, shoulderL: pad(), shoulderR: pad(), head };
}
