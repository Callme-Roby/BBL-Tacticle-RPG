import { CAST } from '../data/cast';
import { ROSTER, type FighterDef } from '../data/roster';
import type { Action, BattleSetup, BattleState, Unit } from '../rules/battle';
import type { Team } from '../rules/types';
import type { AiLevel } from './settings';
import { fullRoster } from './settings';
import { altCostume } from '../render/costume';

export type Controller = 'human' | 'ai' | 'remote';
export type MatchMode = 'skirmish' | 'local' | 'online' | 'campaign';

/** Everything that describes a match besides the battle state itself. */
export interface MatchInfo {
  mode: MatchMode;
  setup: BattleSetup;
  controllers: [Controller, Controller];
  ai: AiLevel;
  /** online: the team played in this browser */
  localTeam?: Team;
  /** campaign chapter index */
  chapter?: number;
  /** looks of lab creations / remote players' fighters, by id */
  looks: Record<string, FighterDef>;
}

export interface SavedMatch {
  v: 1;
  info: MatchInfo;
  state: BattleState;
  /** every action since the start (replays / debugging) */
  log: Action[];
  savedAt: number;
}

const KEY = 'bbltactics.match';

export function saveMatch(m: SavedMatch) {
  if (m.info.mode === 'online') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* quota: lab photos can be big — the save is just skipped */
  }
}

export function loadMatch(): SavedMatch | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as SavedMatch;
    if (m?.v !== 1 || !m.state || !m.info) return null;
    if (m.state.winner !== null) return null;
    return m;
  } catch {
    return null;
  }
}

export function clearMatch() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** a friend's look: lab creations / remote ones from the match, else the roster */
export function lookOf(info: MatchInfo | null, defId: string): FighterDef {
  return info?.looks[defId] ?? fullRoster().find((d) => d.id === defId) ?? CAST[defId] ?? { ...ROSTER[0], id: defId };
}

/** the look of a unit (alternate costume for the copy in the other team) */
export function unitLook(info: MatchInfo | null, u: Unit): FighterDef {
  const d = lookOf(info, u.defId);
  return u.alt ? altCostume(d) : d;
}

/** what the battle screen needs from an online connection (src/net/session.ts) */
export interface MatchLink {
  send(m: { t: 'act'; a: Action }): void;
  onMessage: ((m: { t: string; a?: unknown; state?: unknown; n?: number; h?: string }) => void) | null;
  onStatus: ((s: 'open' | 'closed') => void) | null;
  close(): void;
  /** desync detection (online sessions) */
  sendHash?(h: string): void;
  requestState?(): void;
  getState?: (() => unknown) | null;
}
