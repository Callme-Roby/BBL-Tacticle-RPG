/**
 * Deterministic random numbers (mulberry32). The battle keeps the generator's
 * state as a plain number, so a saved / networked battle replays exactly.
 */
export interface RngState {
  rng: number;
}

/** next float in [0, 1) */
export function nextFloat(s: RngState): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** random integer 0..99 (a "random number" of the GBA games) */
export function rn(s: RngState): number {
  return Math.floor(nextFloat(s) * 100);
}

/** displayed-hit roll with two random numbers ("2RN"): true hit chance is S-shaped */
export function roll2(s: RngState, chance: number): boolean {
  const a = rn(s);
  const b = rn(s);
  return (a + b) / 2 < chance;
}

/** single random number roll (criticals, growths, staves) */
export function roll1(s: RngState, chance: number): boolean {
  return rn(s) < chance;
}

/** true probability of a 2RN roll for a displayed chance (0..100) */
export function trueHit(chance: number): number {
  let n = 0;
  for (let a = 0; a < 100; a++) for (let b = 0; b < 100; b++) if ((a + b) / 2 < chance) n++;
  return n / 100;
}
