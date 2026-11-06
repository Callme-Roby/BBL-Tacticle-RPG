import type { SupportProgress } from '../rules/battle';
import { SUPPORT_THRESHOLDS } from '../rules/supports';

/**
 * What this browser remembers between battles: the supports of the friends
 * played here (levels and points: « persos qui combattent souvent ensemble »).
 */
const KEY = 'bbltactics.supports';

export function loadSupports(): Record<string, SupportProgress> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const t = JSON.parse(raw) as Record<string, SupportProgress>;
      if (t && typeof t === 'object') return t;
    }
  } catch {
    /* ignore */
  }
  return {};
}

/** merges the supports reached in a battle (never goes down) */
export function recordSupports(table: Record<string, SupportProgress>) {
  const cur = loadSupports();
  for (const [k, v] of Object.entries(table)) {
    const old = cur[k] ?? { pts: 0, level: 0 };
    const level = Math.max(old.level, v.level) as SupportProgress['level'];
    const cap = SUPPORT_THRESHOLDS[Math.min(2, level)];
    cur[k] = { level, pts: Math.min(cap, Math.max(old.level === level ? old.pts : 0, v.level === level ? v.pts : 0)) };
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    /* ignore */
  }
}

export function resetSupports() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
