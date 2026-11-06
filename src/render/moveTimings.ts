/**
 * Frame timings (60 fps) of the BBL FIGHTERZ moves, kept only to drive the
 * animation clips of src/render/poses.ts (the strike pose lands on the move's
 * first active frame). The real-time fight rules are not used by BBL TACTICS.
 */
export type MoveId =
  | 'jab'
  | 'cross'
  | 'frontKick'
  | 'roundhouse'
  | 'elbow'
  | 'powerPunch'
  | 'knee'
  | 'crouchJab'
  | 'uppercut'
  | 'lowKick'
  | 'sweep'
  | 'jumpPunch'
  | 'jumpKick'
  | 'airSmash'
  | 'throw'
  | 'super'
  | 'projectile'
  | 'hook'
  | 'bodyBlow'
  | 'snapKick'
  | 'spinHeel'
  | 'hammerFist'
  | 'risingUppercut'
  | 'tornadoKick'
  | 'axeKick'
  | 'throwWhiff';

export interface MoveTiming {
  startup: number;
  active: number;
  recovery: number;
}

export const MOVES: Record<MoveId, MoveTiming> = {
  jab: { startup: 7, active: 3, recovery: 9 },
  cross: { startup: 9, active: 3, recovery: 13 },
  frontKick: { startup: 12, active: 4, recovery: 15 },
  roundhouse: { startup: 15, active: 4, recovery: 20 },
  elbow: { startup: 11, active: 3, recovery: 12 },
  powerPunch: { startup: 16, active: 4, recovery: 20 },
  knee: { startup: 13, active: 4, recovery: 19 },
  crouchJab: { startup: 8, active: 3, recovery: 9 },
  uppercut: { startup: 13, active: 4, recovery: 21 },
  lowKick: { startup: 10, active: 3, recovery: 13 },
  sweep: { startup: 15, active: 5, recovery: 23 },
  jumpPunch: { startup: 7, active: 8, recovery: 6 },
  jumpKick: { startup: 9, active: 10, recovery: 6 },
  airSmash: { startup: 10, active: 5, recovery: 12 },
  throw: { startup: 10, active: 3, recovery: 26 },
  super: { startup: 10, active: 6, recovery: 34 },
  projectile: { startup: 13, active: 1, recovery: 38 },
  hook: { startup: 8, active: 3, recovery: 12 },
  bodyBlow: { startup: 10, active: 3, recovery: 14 },
  snapKick: { startup: 7, active: 3, recovery: 11 },
  spinHeel: { startup: 13, active: 4, recovery: 18 },
  hammerFist: { startup: 13, active: 4, recovery: 22 },
  risingUppercut: { startup: 10, active: 6, recovery: 26 },
  tornadoKick: { startup: 14, active: 5, recovery: 24 },
  axeKick: { startup: 15, active: 4, recovery: 22 },
  throwWhiff: { startup: 1, active: 1, recovery: 24 },
};

export function moveTotal(m: MoveTiming): number {
  return m.startup + m.active + m.recovery - 1;
}
