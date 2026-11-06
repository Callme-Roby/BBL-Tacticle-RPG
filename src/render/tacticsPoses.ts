import { CLIPS, merge, STANCE, type Clip, type Pose } from './poses';

/**
 * Extra clips for BBL TACTICS, added to the BBL FIGHTERZ library (poses.ts):
 * relaxed map idle, riding, bow shot, spell cast, staff heal, weapon swings.
 * Same conventions as poses.ts (degrees, X < 0 swings a limb forward...).
 */

const RELAXED: Pose = {
  root: [0, -0.01, 0],
  hips: [0, 0, 0],
  spine: [2, 0, 0],
  chest: [2, 0, 0],
  neck: [0, 0, 0],
  head: [-4, 0, 0],
  upperArmL: [4, 0, 10],
  foreArmL: [-18, 0, 0],
  handL: [0, 0, 0],
  upperArmR: [-12, 0, -10],
  foreArmR: [-40, 0, 0],
  handR: [0, 0, 0],
  thighL: [-2, 0, 5],
  shinL: [4, 0, 0],
  footL: [-2, 0, 0],
  thighR: [2, 0, -5],
  shinR: [4, 0, 0],
  footR: [-2, 0, 0],
};

/** sitting on a mount, reins in the left hand, weapon hand forward */
const RIDE: Pose = {
  root: [0, 0, 0],
  hips: [0, 0, 0],
  spine: [6, 0, 0],
  chest: [4, 0, 0],
  neck: [0, 0, 0],
  head: [-6, 0, 0],
  upperArmL: [-30, 0, 8],
  foreArmL: [-60, 0, 0],
  handL: [0, 0, 0],
  upperArmR: [-26, 0, -12],
  foreArmR: [-70, 0, 0],
  handR: [0, 0, 0],
  thighL: [-82, 0, 26],
  shinL: [86, 0, 0],
  footL: [-10, 0, 0],
  thighR: [-82, 0, -26],
  shinR: [86, 0, 0],
  footR: [-10, 0, 0],
};

const BOW_AIM: Pose = merge(STANCE, {
  root: [0, -0.04, 0],
  hips: [0, -70, 0],
  spine: [0, -10, 0],
  chest: [0, -10, 0],
  head: [-4, 76, 0],
  // bow hand (right, camera side) straight toward the target
  upperArmR: [-88, 70, 0],
  foreArmR: [-4, 0, 0],
  handR: [0, 0, 0],
  // drawing hand pulled back to the cheek
  upperArmL: [-86, 46, 0],
  foreArmL: [-130, 0, 0],
  thighL: [-20, 0, 10],
  shinL: [18, 0, 0],
  thighR: [18, 0, -8],
  shinR: [8, 0, 0],
});
const BOW_LOOSE: Pose = merge(BOW_AIM, { upperArmL: [-60, 30, 30], foreArmL: [-40, 0, 0], chest: [0, -16, 0] });

const CAST_UP: Pose = merge(STANCE, {
  root: [0, -0.02, -0.03],
  spine: [-10, 0, 0],
  chest: [-8, 0, 0],
  head: [-14, 0, 0],
  upperArmR: [-150, 0, -16],
  foreArmR: [-20, 0, 0],
  upperArmL: [-150, 0, 16],
  foreArmL: [-20, 0, 0],
});
const CAST_OUT: Pose = merge(STANCE, {
  root: [0, -0.06, 0.08],
  hips: [0, -10, 0],
  spine: [12, 0, 0],
  chest: [8, 0, 0],
  head: [-6, 0, 0],
  upperArmR: [-92, 0, -4],
  foreArmR: [-6, 0, 0],
  handR: [-30, 0, 0],
  upperArmL: [-88, 0, 6],
  foreArmL: [-8, 0, 0],
  handL: [-30, 0, 0],
  thighL: [-40, 0, 6],
  shinL: [40, 0, 0],
});

const STAFF_UP: Pose = merge(RELAXED, {
  spine: [-6, 0, 0],
  head: [-12, 0, 0],
  upperArmR: [-170, 0, -6],
  foreArmR: [-10, 0, 0],
  handR: [-90, 0, 0],
  upperArmL: [-40, 0, 30],
  foreArmL: [-60, 0, 0],
});

/** overhead chop (axes, heavy swords) */
const CHOP_UP: Pose = merge(STANCE, {
  root: [0, -0.02, -0.06],
  hips: [0, -20, 0],
  spine: [-14, 0, 0],
  chest: [-10, 0, 0],
  upperArmR: [-170, 0, -10],
  foreArmR: [-60, 0, 0],
  handR: [-40, 0, 0],
  upperArmL: [-150, 0, 10],
  foreArmL: [-70, 0, 0],
});
const CHOP_DOWN: Pose = merge(STANCE, {
  root: [0, -0.2, 0.2],
  hips: [0, -10, 0],
  spine: [30, 0, 0],
  chest: [14, 0, 0],
  head: [6, 0, 0],
  upperArmR: [-70, 0, -6],
  foreArmR: [-10, 0, 0],
  handR: [-60, 0, 0],
  upperArmL: [-60, 0, 6],
  foreArmL: [-20, 0, 0],
  thighL: [-60, 0, 6],
  shinL: [70, 0, 0],
  thighR: [36, 0, -6],
  shinR: [30, 0, 0],
});

/** horizontal slash (swords) */
const SLASH_BACK: Pose = merge(STANCE, {
  hips: [0, -60, 0],
  spine: [0, -20, 0],
  chest: [0, -20, 0],
  head: [-4, 60, 0],
  upperArmR: [-90, -70, -20],
  foreArmR: [-40, 0, 0],
  handR: [0, 0, -40],
});
const SLASH_END: Pose = merge(STANCE, {
  root: [0, -0.1, 0.18],
  hips: [0, 30, 0],
  spine: [10, 20, 0],
  chest: [6, 18, 0],
  head: [-6, -30, 0],
  upperArmR: [-90, 70, -10],
  foreArmR: [-6, 0, 0],
  handR: [0, 0, 40],
  thighL: [-56, 0, 6],
  shinL: [52, 0, 0],
  thighR: [26, 0, -6],
  shinR: [14, 0, 0],
});

/** thrust (lances) */
const THRUST_BACK: Pose = merge(STANCE, {
  root: [0, -0.06, -0.08],
  hips: [0, -50, 0],
  upperArmR: [-40, 0, -10],
  foreArmR: [-110, 0, 0],
  handR: [-60, 0, 0],
  upperArmL: [-70, 0, 20],
  foreArmL: [-50, 0, 0],
});
const THRUST_OUT: Pose = merge(STANCE, {
  root: [0, -0.14, 0.28],
  hips: [0, -20, 0],
  spine: [16, 0, 0],
  chest: [6, 0, 0],
  upperArmR: [-88, 0, -4],
  foreArmR: [-6, 0, 0],
  handR: [-80, 0, 0],
  upperArmL: [-80, 0, 10],
  foreArmL: [-30, 0, 0],
  thighL: [-64, 0, 6],
  shinL: [60, 0, 0],
  thighR: [36, 0, -6],
  shinR: [16, 0, 0],
});

const CHEER: Pose = merge(RELAXED, {
  head: [-14, 0, 0],
  upperArmL: [0, 0, 150],
  foreArmL: [-10, 0, 0],
  upperArmR: [0, 0, -150],
  foreArmR: [-10, 0, 0],
});

function seq(length: number, keys: [number, Pose, ('linear' | 'smooth' | 'out' | 'in')?][], loop = false): Clip {
  return { length, loop, keys: keys.map(([f, p, ease]) => ({ f, p, ease })) };
}

/** frame where the strike lands in the attack clips below */
export const STRIKE_FRAME = 16;

export function registerTacticsClips() {
  const lib = CLIPS as Record<string, Clip>;
  if (lib.mapIdle) return;
  const breathe = merge(RELAXED, { root: [0, -0.02, 0], spine: [4, 0, 0], chest: [4, 0, 0], upperArmL: [2, 0, 12] });
  lib.mapIdle = seq(90, [
    [0, RELAXED],
    [45, breathe, 'smooth'],
    [90, RELAXED, 'smooth'],
  ], true);
  lib.ride = seq(60, [
    [0, RIDE],
    [30, merge(RIDE, { root: [0, 0.02, 0], spine: [8, 0, 0] }), 'smooth'],
    [60, RIDE, 'smooth'],
  ], true);
  lib.cheer = seq(40, [
    [0, RELAXED],
    [10, CHEER, 'out'],
    [20, merge(CHEER, { root: [0, 0.06, 0] }), 'smooth'],
    [30, CHEER, 'smooth'],
    [40, CHEER],
  ]);
  lib.bowShot = seq(40, [
    [0, STANCE],
    [8, BOW_AIM, 'out'],
    [STRIKE_FRAME - 1, merge(BOW_AIM, { upperArmL: [-86, 40, 0], foreArmL: [-138, 0, 0] })],
    [STRIKE_FRAME, BOW_LOOSE, 'in'],
    [30, BOW_LOOSE],
    [40, STANCE, 'smooth'],
  ]);
  lib.cast = seq(44, [
    [0, STANCE],
    [9, CAST_UP, 'out'],
    [STRIKE_FRAME - 2, merge(CAST_UP, { root: [0, 0.02, -0.04] })],
    [STRIKE_FRAME, CAST_OUT, 'in'],
    [32, CAST_OUT],
    [44, STANCE, 'smooth'],
  ]);
  lib.staffHeal = seq(50, [
    [0, RELAXED],
    [12, STAFF_UP, 'out'],
    [36, merge(STAFF_UP, { root: [0, 0.03, 0] }), 'smooth'],
    [50, RELAXED, 'smooth'],
  ]);
  lib.chop = seq(40, [
    [0, STANCE],
    [10, CHOP_UP, 'out'],
    [STRIKE_FRAME - 2, merge(CHOP_UP, { spine: [-20, 0, 0] })],
    [STRIKE_FRAME, CHOP_DOWN, 'in'],
    [28, CHOP_DOWN],
    [40, STANCE, 'smooth'],
  ]);
  lib.slash = seq(38, [
    [0, STANCE],
    [10, SLASH_BACK, 'out'],
    [STRIKE_FRAME, SLASH_END, 'in'],
    [26, SLASH_END],
    [38, STANCE, 'smooth'],
  ]);
  lib.thrust = seq(38, [
    [0, STANCE],
    [10, THRUST_BACK, 'out'],
    [STRIKE_FRAME, THRUST_OUT, 'in'],
    [26, THRUST_OUT],
    [38, STANCE, 'smooth'],
  ]);
}
