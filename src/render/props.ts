import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createPS1Material } from './ps1Material';

/**
 * Low-poly props held during the BBL MAX cinematics (see `cine.props` in
 * src/sim/ultimates.ts) and the projectiles they fire.
 *
 * Every prop is built in the space of the bone it is attached to (bind pose:
 * character faces +Z, +X = their left, arms hanging down):
 *  - guns / launchers: grip at the origin, barrel along -Y (along the arm), top toward +Z;
 *  - mic, rose, phone, grenade: held in the fist, sticking out on the thumb side (+Z);
 *  - shades: sit on the eyes when attached to the head bone.
 */

/** Props of the BBL FIGHTERZ cinematics (kept for the critical-hit scenes). */
export type PropId =
  | 'smg'
  | 'grenade'
  | 'bazooka'
  | 'mic'
  | 'shades'
  | 'phone'
  | 'rose'
  | 'glove'
  | 'headgear'
  | 'gkglove'
  | 'football'
  | 'goal'
  | 'hairbush'
  | 'goggles'
  | 'flask'
  | 'saucer'
  | 'beam';

/** Projectiles flying from one place to another (pure presentation). */
export type ProjectileKind = 'grenade' | 'rocket' | 'web' | 'bullet';

const mats = new Map<number, THREE.Material>();
function mat(color: number, unlit = 0): THREE.Material {
  const key = color * 4 + Math.round(unlit * 3);
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

/** cylinder along Y */
function cyl(r0: number, r1: number, h: number, color: number, x = 0, y = 0, z = 0, seg = 8): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat(color));
  m.position.set(x, y, z);
  return m;
}

/** cylinder along Z */
function cylZ(r0: number, r1: number, h: number, color: number, x = 0, y = 0, z = 0, seg = 8): THREE.Mesh {
  const m = cyl(r0, r1, h, color, x, y, z, seg);
  m.rotation.x = Math.PI / 2;
  return m;
}

function ball(r: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(color));
  m.position.set(x, y, z);
  return m;
}

const GUNMETAL = 0x2c2d33;
const BLACK = 0x141416;
const OLIVE = 0x4b5a2c;
const OLIVE_DARK = 0x37421f;

function smg(): THREE.Group {
  const g = new THREE.Group();
  g.add(
    box(0.05, 0.3, 0.075, GUNMETAL, 0, -0.1, 0.07), // receiver
    box(0.04, 0.05, 0.11, BLACK, 0, 0.0, 0.0), // grip (in the hand)
    box(0.034, 0.045, 0.16, BLACK, 0, -0.13, -0.02), // magazine
    cyl(0.014, 0.014, 0.12, GUNMETAL, 0, -0.29, 0.085), // barrel stub
    box(0.03, 0.16, 0.03, BLACK, 0, 0.11, 0.06), // folded stock
    box(0.012, 0.02, 0.02, BLACK, 0, -0.2, 0.12), // front sight
  );
  return g;
}

function grenade(): THREE.Group {
  const g = new THREE.Group();
  const body = cyl(0.04, 0.04, 0.085, OLIVE, 0, 0, 0.06, 8);
  body.rotation.x = Math.PI / 2;
  g.add(body, ball(0.04, OLIVE, 0, 0, 0.02), ball(0.04, OLIVE, 0, 0, 0.1));
  g.add(box(0.016, 0.02, 0.05, 0x8a8a80, 0, 0.035, 0.12)); // lever
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 4, 8), mat(0xc8c8c0));
  ring.position.set(0.03, 0.02, 0.14);
  g.add(ring);
  return g;
}

function bazooka(): THREE.Group {
  const g = new THREE.Group();
  // tube along -Y, resting above the hand (+Z), ~1.1 m long
  g.add(
    cyl(0.07, 0.07, 1.05, OLIVE, 0, -0.2, 0.1, 10),
    cyl(0.085, 0.075, 0.12, OLIVE_DARK, 0, -0.72, 0.1, 10), // muzzle
    cyl(0.1, 0.075, 0.14, OLIVE_DARK, 0, 0.38, 0.1, 10), // rear flare
    box(0.035, 0.06, 0.1, BLACK, 0, 0.0, 0.0), // grip
    box(0.035, 0.05, 0.09, BLACK, 0, -0.32, 0.02), // front grip
    box(0.03, 0.1, 0.05, BLACK, 0.07, -0.12, 0.17), // sight
    box(0.01, 0.4, 0.012, 0xd8c040, 0, -0.2, 0.172), // warning stripe
  );
  return g;
}

function mic(): THREE.Group {
  const g = new THREE.Group();
  g.add(cylZ(0.016, 0.022, 0.16, BLACK, 0, 0, 0.05), ball(0.038, 0x9c9ca4, 0, 0, 0.16), cylZ(0.024, 0.024, 0.012, 0x505058, 0, 0, 0.13));
  return g;
}

function shades(hs: number): THREE.Group {
  const g = new THREE.Group();
  const y = 0.12 * hs + 0.025 * hs;
  const z = 0.112 * hs + 0.012;
  const lens = 0x101018;
  g.add(
    box(0.072 * hs, 0.042 * hs, 0.012, lens, 0.045 * hs, y, z),
    box(0.072 * hs, 0.042 * hs, 0.012, lens, -0.045 * hs, y, z),
    box(0.03 * hs, 0.01 * hs, 0.01, BLACK, 0, y + 0.012 * hs, z),
    box(0.008, 0.012 * hs, 0.11 * hs, BLACK, 0.085 * hs, y + 0.01 * hs, z - 0.055 * hs),
    box(0.008, 0.012 * hs, 0.11 * hs, BLACK, -0.085 * hs, y + 0.01 * hs, z - 0.055 * hs),
    // glint
    box(0.02 * hs, 0.008 * hs, 0.004, 0xffffff, 0.06 * hs, y + 0.01 * hs, z + 0.008, 1),
  );
  return g;
}

function phone(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.075, 0.012, 0.15, BLACK, 0, 0, 0.06), box(0.065, 0.004, 0.13, 0x4aa0ff, 0, 0.008, 0.06, 0.8));
  return g;
}

function rose(): THREE.Group {
  const g = new THREE.Group();
  g.add(cylZ(0.006, 0.006, 0.28, 0x2f7a2a, 0, 0, 0.1, 5), ball(0.035, 0xd0182c, 0, 0, 0.25), box(0.04, 0.005, 0.02, 0x2f7a2a, 0.02, 0, 0.12));
  return g;
}

const GLOVE_RED = 0xc8141e;

/** Boxing glove around the fist (hand bone origin = wrist, the fist hangs along -Y). */
function glove(): THREE.Group {
  const g = new THREE.Group();
  const fist = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 1), mat(GLOVE_RED));
  fist.scale.set(1, 1.25, 1.1);
  fist.position.set(0, -0.07, 0.01);
  const thumb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.032, 0), mat(GLOVE_RED));
  thumb.position.set(0, -0.04, 0.07);
  // white cuff + lace
  g.add(fist, thumb, cyl(0.058, 0.064, 0.07, 0xf2f2ee, 0, 0.02, 0, 8), box(0.012, 0.06, 0.01, 0xf2f2ee, 0, 0.0, 0.064));
  return g;
}

/** Amateur boxing headgear: padded cap, cheek pads, chin strap (the face stays visible). */
function headgear(hs: number): THREE.Group {
  const g = new THREE.Group();
  const cy = 0.12 * hs; // head centre above the head bone
  const rx = 0.1 * hs + 0.018;
  const ry = 0.125 * hs + 0.018;
  const rz = 0.112 * hs + 0.018;
  // top + back of the skull (a sphere cut open in front)
  // SphereGeometry leaves its phi gap on -X: a ~100° gap turned toward +Z (the face)
  const shellGeo = new THREE.SphereGeometry(1, 12, 8, Math.PI * 0.28, Math.PI * 1.44, 0, Math.PI * 0.62);
  const shell = new THREE.Mesh(shellGeo, mat(0x1c3fb0));
  shell.scale.set(rx, ry, rz);
  shell.rotation.y = Math.PI / 2;
  shell.position.y = cy;
  shellGeo.computeVertexNormals();
  (shell.material as THREE.Material).side = THREE.DoubleSide;
  // brow pad, cheek pads, chin strap
  g.add(
    shell,
    box(0.15 * hs, 0.035 * hs, 0.04, 0x1c3fb0, 0, cy + 0.075 * hs, rz - 0.01),
    box(0.03, 0.09 * hs, 0.06, 0x1c3fb0, rx - 0.008, cy - 0.03 * hs, rz * 0.45),
    box(0.03, 0.09 * hs, 0.06, 0x1c3fb0, -rx + 0.008, cy - 0.03 * hs, rz * 0.45),
    box(0.17 * hs, 0.018, 0.02, 0x10101a, 0, cy - 0.125 * hs, rz * 0.35),
    box(0.06 * hs, 0.02 * hs, 0.012, 0xffffff, 0, cy + 0.075 * hs, rz + 0.012, 1),
  );
  return g;
}

const GK_GREEN = 0xb6ea2a;
const GK_DARK = 0x1b1c20;

/**
 * Goalkeeper glove: a big padded open hand (hand bone origin = wrist, the hand hangs along -Y,
 * palm toward the body's centre line), black palm, neon back, wide strap on the wrist.
 */
function gkglove(): THREE.Group {
  const g = new THREE.Group();
  g.add(
    box(0.075, 0.17, 0.15, GK_GREEN, 0, -0.1, 0.01), // padded back of the hand
    box(0.068, 0.11, 0.135, GK_GREEN, 0, -0.225, 0.006), // fingers
    box(0.012, 0.11, 0.004, GK_DARK, 0, -0.225, 0.075), // finger seams (front)
    box(0.078, 0.004, 0.13, GK_DARK, 0, -0.2, 0.006), // finger seam
    box(0.078, 0.004, 0.13, GK_DARK, 0, -0.245, 0.006), // finger seam
    box(0.05, 0.1, 0.05, GK_GREEN, 0, -0.1, 0.095), // thumb
    box(0.088, 0.065, 0.165, GK_DARK, 0, 0.0, 0.01), // wrist strap
    box(0.09, 0.02, 0.02, 0xf2f2ee, 0, 0.0, 0.095), // strap logo
  );
  return g;
}

const BALL_R = 0.13;

/** Classic football: white icosphere with the 12 black pentagons (centred on the origin). */
function football(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(BALL_R, 1), mat(0xf4f4f0)));
  const ico = new THREE.IcosahedronGeometry(1, 0).getAttribute('position');
  const dirs: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < ico.count; i++) {
    v.fromBufferAttribute(ico, i).normalize();
    if (!dirs.some((d) => d.distanceToSquared(v) < 1e-4)) dirs.push(v.clone());
  }
  const parts: THREE.BufferGeometry[] = [];
  const o = new THREE.Object3D();
  for (const d of dirs) {
    const pent = new THREE.CircleGeometry(BALL_R * 0.4, 5);
    o.position.copy(d).multiplyScalar(BALL_R * 1.005);
    o.lookAt(d.clone().multiplyScalar(2));
    o.updateMatrix();
    pent.applyMatrix4(o.matrix);
    parts.push(pent);
  }
  g.add(new THREE.Mesh(mergeGeometries(parts), mat(0x141416)));
  return g;
}

/**
 * Football goal (a bit smaller than a real one, fighters must fit in): white posts and crossbar,
 * a box-shaped net behind. Origin = middle of the goal line on the floor, mouth toward +Z,
 * width along X, the net goes back toward -Z.
 */
const GOAL_W = 3.4;
const GOAL_H = 2.05;
const GOAL_D = 1.5;
function goal(): THREE.Group {
  const g = new THREE.Group();
  const W = GOAL_W / 2;
  const H = GOAL_H;
  const D = GOAL_D;
  const r = 0.055;
  // frame
  const frame: THREE.BufferGeometry[] = [];
  const bar = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const b = new THREE.BoxGeometry(w, h, d);
    b.translate(x, y, z);
    frame.push(b);
  };
  bar(r * 2, H + r, r * 2, -W, (H + r) / 2, 0); // posts
  bar(r * 2, H + r, r * 2, W, (H + r) / 2, 0);
  bar(GOAL_W + r * 2, r * 2, r * 2, 0, H, 0); // crossbar
  g.add(new THREE.Mesh(mergeGeometries(frame), mat(0xf6f6f2)));
  // back supports (grey)
  const sup: THREE.BufferGeometry[] = [];
  const sbar = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const b = new THREE.BoxGeometry(w, h, d);
    b.translate(x, y, z);
    sup.push(b);
  };
  const s = 0.025;
  for (const x of [-W, W]) {
    sbar(s, H * 0.85, s, x, (H * 0.85) / 2, -D); // back stanchions
    sbar(s, s, D, x, 0.02, -D / 2); // floor bars
    sbar(s, s, D, x, H * 0.85 + (H - H * 0.85) / 2, -D / 2); // top bars
  }
  sbar(GOAL_W, s, s, 0, 0.02, -D); // back floor bar
  sbar(GOAL_W, s, s, 0, H * 0.85, -D);
  g.add(new THREE.Mesh(mergeGeometries(sup), mat(0x9a9ca4)));
  // net: thin cords in a grid (roof slopes from the crossbar down to the back)
  const net: THREE.BufferGeometry[] = [];
  const t = 0.014;
  const step = 0.17;
  const cord = (a: THREE.Vector3, b: THREE.Vector3) => {
    const len = a.distanceTo(b);
    const c = new THREE.BoxGeometry(t, t, len);
    const o = new THREE.Object3D();
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.lookAt(b);
    o.updateMatrix();
    c.applyMatrix4(o.matrix);
    net.push(c);
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const hb = H * 0.85;
  const nx = Math.round(GOAL_W / step);
  for (let i = 0; i <= nx; i++) {
    const x = -W + (GOAL_W * i) / nx;
    cord(V(x, 0, -D), V(x, hb, -D)); // back, vertical
    cord(V(x, H, 0), V(x, hb, -D)); // roof, front to back
  }
  const ny = Math.round(hb / step);
  for (let j = 1; j <= ny; j++) {
    const y = (hb * j) / ny;
    cord(V(-W, y, -D), V(W, y, -D)); // back, horizontal
  }
  const nz = Math.round(D / step);
  for (let j = 1; j < nz; j++) {
    const z = -(D * j) / nz;
    const y = H + (hb - H) * (j / nz);
    cord(V(-W, y, z), V(W, y, z)); // roof, across
    for (const x of [-W, W]) cord(V(x, 0, z), V(x, y, z)); // sides, vertical
  }
  const nyS = Math.round(H / step);
  for (let j = 1; j < nyS; j++) {
    const y = (H * j) / nyS;
    const zEnd = y <= hb ? -D : -D * ((H - y) / (H - hb));
    for (const x of [-W, W]) cord(V(x, y, 0), V(x, y, zEnd)); // sides, horizontal
  }
  g.add(new THREE.Mesh(mergeGeometries(net), mat(0xe2e4e8)));
  return g;
}

/** deterministic pseudo-random sequence (the bush looks the same every time) */
function lcg(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

const HAIR_MID = 0x9a7442;
const HAIR_DARK = 0x6e5030;
const HAIR_LIGHT = 0xc6a060;
/** radius of the hair bush at scale 1 */
const BUSH_R = 0.42;

/**
 * Big round cartoon bush of hair: a lumpy ball made of soft clumps, bristling with curly
 * locks (two-segment bent spikes). Origin = where it grows from; the ball bulges toward -Z
 * (attached to the hips bone it sprouts from the lower back).
 */
function hairbush(): THREE.Group {
  const g = new THREE.Group();
  const rnd = lcg(7);
  const c = new THREE.Vector3(0, 0, -BUSH_R * 0.85);
  // lumpy core (flat-shaded icosphere, vertices pushed in / out)
  const core = new THREE.IcosahedronGeometry(BUSH_R * 0.92, 1);
  core.deleteAttribute('uv');
  const pos = core.getAttribute('position');
  const v = new THREE.Vector3();
  const bumps = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // same displacement for the copies of a vertex (non-indexed geometry)
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    let b = bumps.get(key);
    if (b === undefined) bumps.set(key, (b = 0.9 + rnd() * 0.2));
    v.multiplyScalar(b).add(c);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  core.computeVertexNormals();
  const mid: THREE.BufferGeometry[] = [core];
  const dark: THREE.BufferGeometry[] = [];
  const light: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const dir = (i: number, n: number) => {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.39996;
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  };
  /** cone from `from` along `d` (unit), base radius `r`, apex at the far end */
  const spike = (from: THREE.Vector3, d: THREE.Vector3, len: number, r: number) => {
    const cone = new THREE.ConeGeometry(r, len, 3).toNonIndexed();
    cone.deleteAttribute('uv');
    cone.translate(0, len / 2, 0);
    q.setFromUnitVectors(up, d);
    cone.applyQuaternion(q);
    cone.translate(from.x, from.y, from.z);
    return cone;
  };
  // soft clumps over the surface
  const nc = 22;
  for (let i = 0; i < nc; i++) {
    const d = dir(i, nc);
    const clump = new THREE.IcosahedronGeometry(BUSH_R * (0.3 + rnd() * 0.12), 0);
    clump.deleteAttribute('uv');
    clump.translate(c.x + d.x * BUSH_R * 0.82, c.y + d.y * BUSH_R * 0.82, c.z + d.z * BUSH_R * 0.82);
    (i % 4 === 0 ? dark : i % 4 === 2 ? light : mid).push(clump);
  }
  // curly locks: a spike, then a thinner one bent sideways (the curl)
  const nl = 64;
  const t1 = new THREE.Vector3();
  const tip = new THREE.Vector3();
  for (let i = 0; i < nl; i++) {
    const d = dir(i, nl);
    const base = d.clone().multiplyScalar(BUSH_R * 0.93).add(c);
    const d1 = new THREE.Vector3(d.x + (rnd() - 0.5) * 0.7, d.y + (rnd() - 0.5) * 0.7 + 0.15, d.z + (rnd() - 0.5) * 0.7).normalize();
    const l1 = BUSH_R * (0.26 + rnd() * 0.2);
    const r1 = BUSH_R * (0.05 + rnd() * 0.025);
    // curl: turn the second segment ~70° around an axis across the lock
    t1.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).cross(d1).normalize();
    const d2 = d1.clone().applyAxisAngle(t1, 1.0 + rnd() * 0.5);
    tip.copy(d1).multiplyScalar(l1 * 0.8).add(base);
    const bucket = i % 3 === 0 ? light : i % 3 === 1 ? mid : dark;
    bucket.push(spike(base, d1, l1, r1), spike(tip, d2, l1 * 0.7, r1 * 0.7));
  }
  for (const [list, col] of [
    [mid, HAIR_MID],
    [dark, HAIR_DARK],
    [light, HAIR_LIGHT],
  ] as const) {
    g.add(new THREE.Mesh(mergeGeometries(list as THREE.BufferGeometry[]), mat(col)));
  }
  return g;
}

/**
 * Round brass welding goggles (attach to 'head', sized to the head): by default pushed up on the
 * forehead, strap around the skull; `pos: [0, -0.09, 0.006]` brings them down over the eyes.
 */
function goggles(hs: number): THREE.Group {
  const g = new THREE.Group();
  const y = 0.12 * hs + 0.09 * hs;
  const z = 0.1 * hs + 0.016;
  const BRASS = 0xb88a2e;
  for (const sx of [-1, 1]) {
    const x = sx * 0.044 * hs;
    // brass cup, dark green-tinted lens with a glint
    g.add(cylZ(0.034 * hs, 0.03 * hs, 0.03, BRASS, x, y, z, 10));
    g.add(cylZ(0.027 * hs, 0.027 * hs, 0.006, 0x2c3a34, x, y, z + 0.016, 10));
    g.add(box(0.012 * hs, 0.007 * hs, 0.004, 0xffffff, x + 0.01 * hs, y + 0.01 * hs, z + 0.02, 1));
  }
  g.add(box(0.026 * hs, 0.01 * hs, 0.012, BRASS, 0, y, z + 0.004)); // bridge
  // leather strap around the head
  const strap = new THREE.Mesh(new THREE.TorusGeometry(1, 0.11, 3, 14), mat(0x3a2414));
  strap.rotation.x = Math.PI / 2;
  strap.scale.set(0.106 * hs, 0.118 * hs, 0.11);
  strap.position.set(0, y - 0.004, 0.012);
  g.add(strap);
  return g;
}

/**
 * Round-bottom glass flask of bubbling purple potion with a cork, hooked on the belt
 * (attach to 'hips': the default offset hangs it on the wearer's left hip, bone +X).
 */
function flask(): THREE.Group {
  const g = new THREE.Group();
  const x = 0.2;
  const glowBall = (r: number, color: number, unlit: number, px: number, py: number, pz: number) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, r > 0.03 ? 1 : 0), mat(color, unlit));
    m.position.set(px, py, pz);
    return m;
  };
  g.add(
    glowBall(0.062, 0xb04af0, 0.55, x, 0, 0.03), // potion bulb
    cyl(0.02, 0.022, 0.07, 0xd8eef0, x, 0.06, 0.03, 6), // glass neck
    cyl(0.024, 0.02, 0.025, 0x8a5a2a, x, 0.105, 0.03, 6), // cork
    box(0.012, 0.05, 0.012, 0x2a2a2e, x - 0.02, 0.08, 0.0), // belt hook
    glowBall(0.012, 0xf4e8ff, 1, x + 0.012, 0.02, 0.07), // bubbles
    glowBall(0.008, 0xf4e8ff, 1, x - 0.018, -0.01, 0.075),
    glowBall(0.016, 0xe0b8ff, 1, x + 0.004, 0.142, 0.032), // fumes popping out of the cork
    glowBall(0.011, 0xe0b8ff, 1, x + 0.018, 0.17, 0.03),
  );
  return g;
}

/**
 * Home-made flying saucer, ≈ 2.6 m wide. Origin = centre of the hull's underside (where the
 * tractor beam comes out), saucer level, top toward +Y. Riveted grey hull with rusty patches,
 * glass bubble cockpit, blinking rim lights, a stovepipe chimney and an antenna.
 */
function saucer(): THREE.Group {
  const g = new THREE.Group();
  const HULL = 0x8e939c;
  const HULL_LIGHT = 0xb4b8be;
  const HULL_DARK = 0x585d66;
  const RUST = 0xa0532a;
  const S = 14;
  g.add(
    cyl(1.25, 0.6, 0.3, HULL, 0, 0.15, 0, S), // lower hull
    cyl(1.33, 1.33, 0.09, HULL_DARK, 0, 0.33, 0, S), // rim
    cyl(0.78, 1.25, 0.24, HULL_LIGHT, 0, 0.495, 0, S), // upper hull
    cyl(0.62, 0.66, 0.08, HULL_DARK, 0, 0.65, 0, S), // cockpit ring
    cyl(0.36, 0.36, 0.02, 0xfff0a0, 0, 0.005, 0, 10), // beam emitter
  );
  (g.children[4] as THREE.Mesh).material = mat(0xfff0a0, 1);
  // glass bubble (opaque, PS1 style: pale tinted, half unlit) with a highlight
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.58, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x9ad2e0, 0.45));
  dome.position.y = 0.68;
  g.add(dome, box(0.16, 0.05, 0.03, 0xffffff, 0.18, 1.08, 0.38, 1));
  // rim lights, alternating yellow / red (unlit)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const l = box(0.13, 0.07, 0.07, i % 2 ? 0xff4a34 : 0xffd23a, Math.sin(a) * 1.36, 0.33, Math.cos(a) * 1.36, 1);
    l.rotation.y = a;
    g.add(l);
  }
  // rivets around the upper hull
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2;
    g.add(box(0.035, 0.03, 0.035, HULL_DARK, Math.sin(a) * 1.18, 0.41, Math.cos(a) * 1.18));
  }
  // rusty patches bolted on (home-made repairs)
  for (const [a, w] of [
    [0.6, 0.34],
    [2.5, 0.26],
    [4.1, 0.3],
  ] as const) {
    const p = box(w, 0.16, 0.02, RUST, Math.sin(a) * 1.02, 0.5, Math.cos(a) * 1.02);
    p.rotation.set(-0.55, a, 0, 'YXZ');
    g.add(p);
  }
  // stovepipe chimney with a little hat, antenna with a red bulb
  g.add(cyl(0.06, 0.06, 0.42, 0x3a3a40, -0.72, 0.78, -0.3, 6), cyl(0.12, 0.12, 0.03, 0x3a3a40, -0.72, 1.0, -0.3, 6));
  g.add(cyl(0.012, 0.012, 0.5, 0x2a2a2e, 0.25, 1.4, -0.2, 4), ball(0.045, 0xff3030, 0.25, 1.66, -0.2));
  (g.children[g.children.length - 1] as THREE.Mesh).material = mat(0xff3030, 1);
  // three stubby landing legs
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = cyl(0.04, 0.03, 0.26, HULL_DARK, Math.sin(a) * 0.72, 0.02, Math.cos(a) * 0.72, 5);
    leg.rotation.set(Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4);
    g.add(leg, box(0.12, 0.025, 0.12, HULL_DARK, Math.sin(a) * 0.78, -0.11, Math.cos(a) * 0.78));
  }
  return g;
}

/** translucent unlit materials (tractor beam), shared */
const glowMats = new Map<string, THREE.Material>();
function glow(color: number, opacity: number): THREE.Material {
  const key = `${color}:${opacity}`;
  let m = glowMats.get(key);
  if (!m) {
    m = createPS1Material({ color, unlit: 1, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, fog: false });
    glowMats.set(key, m);
  }
  return m;
}

/** height of the tractor beam at scale 1 */
export const BEAM_H = 3.3;
/** Tractor-beam cone: origin at the top (the saucer's emitter), widening downward, translucent warm light. */
function beam(): THREE.Group {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 1.05, BEAM_H, 12, 1, true), glow(0xfff2a6, 0.3));
  outer.position.y = -BEAM_H / 2;
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.62, BEAM_H, 8, 1, true), glow(0xffffff, 0.22));
  inner.position.y = -BEAM_H / 2;
  g.add(outer, inner);
  // light rings along the beam
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    const r = 0.36 + (1.05 - 0.36) * t;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 3, 14), glow(0xfff6c8, 0.5));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -BEAM_H * t;
    g.add(ring);
  }
  // pool of light on the floor
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.1, 14), glow(0xfff2a6, 0.35));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = -BEAM_H + 0.02;
  g.add(pool);
  for (const c of g.children) c.renderOrder = 2;
  return g;
}

/** segments of a strand (see buildStrand) */
export const STRAND_SEGMENTS = 18;
const STRAND_SIDES = 5;

/**
 * One tendril (hair strand...): a tapered tube of STRAND_SEGMENTS segments with a pointed tip,
 * reshaped every frame by `shapeStrand` (world-space points: add it to the scene, not to a bone).
 */
export function buildStrand(color: THREE.ColorRepresentation): THREE.Mesh {
  const S = STRAND_SIDES;
  const rings = STRAND_SEGMENTS + 1;
  const count = rings * S + 1;
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  const nrmAttr = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  nrmAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('normal', nrmAttr);
  const idx: number[] = [];
  for (let j = 0; j < STRAND_SEGMENTS; j++) {
    for (let k = 0; k < S; k++) {
      const a = j * S + k;
      const b = j * S + ((k + 1) % S);
      const c = (j + 1) * S + k;
      const d = (j + 1) * S + ((k + 1) % S);
      idx.push(a, b, c, b, d, c);
    }
  }
  const tip = rings * S;
  const last = STRAND_SEGMENTS * S;
  for (let k = 0; k < S; k++) idx.push(last + k, last + ((k + 1) % S), tip);
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, mat(new THREE.Color(color).getHex()));
  // reshaped every frame: its bounding sphere is never up to date
  m.frustumCulled = false;
  return m;
}

const sT = new THREE.Vector3();
const sN = new THREE.Vector3();
const sB = new THREE.Vector3();
const sP = new THREE.Vector3();
/**
 * Lays a strand along `pts` (STRAND_SEGMENTS + 1 world points, root first), `radius(j)` = tube
 * radius at point j; the tip is a point a bit past the last one.
 */
export function shapeStrand(m: THREE.Mesh, pts: THREE.Vector3[], radius: (j: number) => number) {
  const S = STRAND_SIDES;
  const geo = m.geometry;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  // a normal kept as continuous as possible along the strand (projected from one ring to the next)
  sN.set(0, 1, 0);
  for (let j = 0; j < pts.length; j++) {
    const p0 = pts[Math.max(0, j - 1)];
    const p1 = pts[Math.min(pts.length - 1, j + 1)];
    sT.subVectors(p1, p0);
    if (sT.lengthSq() < 1e-12) sT.set(1, 0, 0);
    sT.normalize();
    sN.addScaledVector(sT, -sN.dot(sT));
    if (sN.lengthSq() < 1e-6) sN.set(0, 0, 1).addScaledVector(sT, -sT.z);
    sN.normalize();
    sB.crossVectors(sT, sN);
    const r = radius(j);
    for (let k = 0; k < S; k++) {
      const a = (k / S) * Math.PI * 2;
      sP.copy(pts[j])
        .addScaledVector(sN, Math.cos(a) * r)
        .addScaledVector(sB, Math.sin(a) * r);
      pos.setXYZ(j * S + k, sP.x, sP.y, sP.z);
    }
  }
  const n = pts.length;
  sT.subVectors(pts[n - 1], pts[n - 2]);
  sP.copy(pts[n - 1]).addScaledVector(sT, 0.6);
  pos.setXYZ(n * S, sP.x, sP.y, sP.z);
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/** every prop / projectile (a missing one is a compile error) */
export const ALL_PROPS = Object.keys({
  smg: 1,
  grenade: 1,
  bazooka: 1,
  mic: 1,
  shades: 1,
  phone: 1,
  rose: 1,
  glove: 1,
  headgear: 1,
  gkglove: 1,
  football: 1,
  goal: 1,
  hairbush: 1,
  goggles: 1,
  flask: 1,
  saucer: 1,
  beam: 1,
} satisfies Record<PropId, 1>) as PropId[];
export const ALL_PROJECTILES = Object.keys({ grenade: 1, rocket: 1, web: 1, bullet: 1 } satisfies Record<ProjectileKind, 1>) as ProjectileKind[];

/** Builds a prop; `headScale` sizes the head props to the wearer's head. */
export function buildProp(id: PropId, headScale = 1.15): THREE.Object3D {
  switch (id) {
    case 'smg':
      return smg();
    case 'grenade':
      return grenade();
    case 'bazooka':
      return bazooka();
    case 'mic':
      return mic();
    case 'shades':
      return shades(headScale);
    case 'phone':
      return phone();
    case 'rose':
      return rose();
    case 'glove':
      return glove();
    case 'headgear':
      return headgear(headScale);
    case 'gkglove':
      return gkglove();
    case 'football':
      return football();
    case 'goal':
      return goal();
    case 'hairbush':
      return hairbush();
    case 'goggles':
      return goggles(headScale);
    case 'flask':
      return flask();
    case 'saucer':
      return saucer();
    case 'beam':
      return beam();
  }
}

/**
 * Projectile meshes, oriented to fly along +Z (the director points +Z along the velocity).
 * `web` is a unit-length strand along +Z stretched by the director from the shooter to its tip.
 */
export function buildProjectile(kind: ProjectileKind): THREE.Object3D {
  const g = new THREE.Group();
  switch (kind) {
    case 'grenade': {
      const gr = grenade();
      gr.position.z = -0.06;
      g.add(gr);
      break;
    }
    case 'rocket': {
      g.add(cylZ(0.05, 0.05, 0.36, OLIVE_DARK, 0, 0, 0), cylZ(0.0, 0.05, 0.14, 0xb03020, 0, 0, 0.25, 8));
      for (let i = 0; i < 4; i++) {
        const fin = box(0.004, 0.09, 0.08, OLIVE, 0, 0, -0.16);
        const pivot = new THREE.Group();
        pivot.rotation.z = (i * Math.PI) / 2;
        fin.position.y = 0.07;
        pivot.add(fin);
        g.add(pivot);
      }
      g.add(box(0.07, 0.07, 0.12, 0xffa020, 0, 0, -0.26, 1)); // exhaust flame
      break;
    }
    case 'web':
      g.add(box(0.012, 0.012, 1, 0xf4f4f4, 0, 0, 0.5, 0.6));
      break;
    case 'bullet':
      g.add(box(0.012, 0.012, 0.18, 0xffe060, 0, 0, 0, 1));
      break;
  }
  return g;
}

/** Disposes the geometries of a prop/projectile (materials are shared and kept). */
export function disposeProp(o: THREE.Object3D) {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).geometry.dispose();
  });
}
