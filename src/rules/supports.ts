import { SUPPORT_TALKS } from '../data/supportTalks';

/** 0 = none, 1 = C, 2 = B, 3 = A */
export type SupportLevel = 0 | 1 | 2 | 3;

export const SUPPORT_LETTERS = ['—', 'C', 'B', 'A'] as const;

/**
 * Points needed for the conversation of the next level (C, B, A). A pair gains
 * 1 point per turn ending side by side and 2 points per fight next to each
 * other; points (and levels) are kept from one battle to the next.
 */
export const SUPPORT_THRESHOLDS = [6, 16, 30] as const;

/** bonuses granted by ONE partner within 3 tiles */
export function supportBonus(lv: SupportLevel): { hit: number; avoid: number; crit: number; dodge: number } {
  switch (lv) {
    case 1:
      return { hit: 5, avoid: 5, crit: 2, dodge: 2 };
    case 2:
      return { hit: 10, avoid: 10, crit: 4, dodge: 4 };
    case 3:
      return { hit: 15, avoid: 15, crit: 6, dodge: 6 };
    default:
      return { hit: 0, avoid: 0, crit: 0, dodge: 0 };
  }
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** the friends that can build a support (pairs that have conversations) */
export function supportPair(a: string, b: string): boolean {
  return !!SUPPORT_TALKS[pairKey(a, b)];
}

/** partners of a friend */
export function partnersOf(id: string): string[] {
  const out: string[] = [];
  for (const k of Object.keys(SUPPORT_TALKS)) {
    const [a, b] = k.split('|');
    if (a === id) out.push(b);
    else if (b === id) out.push(a);
  }
  return out;
}
