import { combatOdds } from '../ai/ai';
import { statsAt, type UnitSetup } from '../rules/battle';
import { CLASSES, type ClassId } from '../rules/classes';
import { forecast, resolve, type Combatant } from '../rules/combat';
import { item } from '../rules/items';
import { PROFILES } from '../rules/profiles';
import { classFor, kitFor, skirmishTeam, type Format } from '../rules/teams';
import type { ObjectiveKind } from '../rules/battle';
import type { AiLevel } from '../ai/ai';
import { autoplay } from './autoplay';

/**
 * Balance simulator: thousands of duels and 10 v 10 battles between AIs.
 *
 * Duels « à triangle neutre »: two friends on open ground, weapon triangle
 * switched off, each one on its turn picks the weapon and the distance (1 or 2)
 * that give it the best expected exchange (so archers shoot from 2, melee units
 * walk in), the opponent counters if it can; first to fall loses (20 exchanges
 * max = draw, half a win each). Real formulas and random numbers (2RN, crits).
 */

export interface DuelUnit {
  id: string;
  cls: ClassId;
  c: Combatant;
  /** weapons usable (item ids) */
  weapons: string[];
}

export function duelUnit(id: string, format: Format, promo = 0): DuelUnit {
  const cls = classFor(id, format.promoted, promo);
  const s = statsAt(id, cls, format.level);
  const c = CLASSES[cls];
  const weapons = kitFor(id, cls, format.level).filter((w) => item(w).kind === 'weapon' && c.weapons.includes(item(w).type!) && (item(w).rank < 3 || c.tier === 2) && (item(w).rank < 2 || c.tier === 2 || format.level >= 5));
  return {
    id,
    cls,
    weapons,
    c: {
      uid: 0,
      hp: s.hp,
      maxHp: s.hp,
      pow: s.pow,
      skl: s.skl,
      spd: s.spd,
      lck: s.lck,
      def: s.def,
      res: s.res,
      con: s.con,
      classCrit: c.crit,
      tags: c.tags,
      weapon: null,
      terrainAvoid: 0,
      terrainDef: 0,
      supportHit: 0,
      supportAvoid: 0,
      supportCrit: 0,
      supportDodge: 0,
    },
  };
}

/** the defender keeps its best counter weapon for the distance (first one that reaches) */
function counterWeapon(d: DuelUnit, dist: number): string | null {
  let best: string | null = null;
  let bestMt = -1;
  for (const w of d.weapons) {
    const it = item(w);
    if (dist < it.min || dist > it.max) continue;
    if (it.mt > bestMt) {
      best = w;
      bestMt = it.mt;
    }
  }
  return best;
}

/** one duel; returns 1 if `a` wins, 0 if `b` wins, 0.5 for a draw */
export function duel(a: DuelUnit, b: DuelUnit, aFirst: boolean, rng: { rng: number }, noTriangle = true): number {
  const hp = [a.c.hp, b.c.hp];
  const units = [a, b];
  let turn = aFirst ? 0 : 1;
  for (let ex = 0; ex < 20; ex++) {
    const me = units[turn];
    const foe = units[1 - turn];
    // choose weapon + distance
    let plan: { w: string; dist: number; score: number } | null = null;
    for (const w of me.weapons) {
      const it = item(w);
      for (let dist = it.min; dist <= Math.min(2, it.max); dist++) {
        const cw = counterWeapon(foe, dist);
        const ca = { ...me.c, hp: hp[turn], weapon: it };
        const cd = { ...foe.c, hp: hp[1 - turn], weapon: cw ? item(cw) : null };
        const fc = forecast(ca, cd, dist, noTriangle);
        const o = combatOdds(fc, hp[turn], hp[1 - turn]);
        const score = o.pKill * 100 + o.eDealt - o.pDie * 100 - o.eTaken;
        if (!plan || score > plan.score) plan = { w, dist, score };
      }
    }
    if (plan) {
      const cw = counterWeapon(foe, plan.dist);
      const ca = { ...me.c, hp: hp[turn], weapon: item(plan.w), uid: turn + 1 };
      const cd = { ...foe.c, hp: hp[1 - turn], weapon: cw ? item(cw) : null, uid: 2 - turn };
      const fc = forecast(ca, cd, plan.dist, noTriangle);
      const strikes = resolve(fc, ca, cd, rng, { a: 99, d: 99 });
      for (const st of strikes) {
        const target = st.by === ca.uid ? 1 - turn : turn;
        hp[target] = st.hpAfter;
        if (st.drained) hp[1 - target] = Math.min(units[1 - target].c.maxHp, hp[1 - target] + st.drained);
      }
      if (hp[0] <= 0) return 0;
      if (hp[1] <= 0) return 1;
    }
    turn = 1 - turn;
  }
  return 0.5;
}

export interface DuelTable {
  ids: string[];
  /** win rate of each friend over all its duels */
  rate: Record<string, number>;
  /** pair matrix: rate of row vs column */
  matrix: Record<string, Record<string, number>>;
}

/** every friend against every other (both promotions in advanced formats), `n` duels per pair and side */
export function duelTable(format: Format, n: number, seed = 1, noTriangle = true): DuelTable {
  const ids = Object.keys(PROFILES).filter((id) => CLASSES[PROFILES[id].cls].weapons[0] !== 'staff');
  const rng = { rng: seed };
  const matrix: Record<string, Record<string, number>> = {};
  const units = new Map<string, DuelUnit[]>();
  for (const id of ids) units.set(id, format.promoted ? [duelUnit(id, format, 0), duelUnit(id, format, 1)] : [duelUnit(id, format)]);
  for (const a of ids) {
    matrix[a] = {};
    for (const b of ids) {
      if (a === b) continue;
      let w = 0;
      let g = 0;
      for (const ua of units.get(a)!)
        for (const ub of units.get(b)!)
          for (let i = 0; i < n; i++) {
            w += duel(ua, ub, i % 2 === 0, rng, noTriangle);
            g++;
          }
      matrix[a][b] = w / g;
    }
  }
  const rate: Record<string, number> = {};
  for (const a of ids) {
    const vs = Object.values(matrix[a]);
    rate[a] = vs.reduce((x, y) => x + y, 0) / vs.length;
  }
  return { ids, rate, matrix };
}

export interface TeamStats {
  games: number;
  /** per friend: win rate of the teams that included it */
  presence: Record<string, { games: number; wins: number }>;
  /** per base class */
  byClass: Record<string, { games: number; wins: number }>;
  /** average turns */
  turns: number;
  /** first player win rate */
  firstWins: number;
}

const MAPS_FOR_BALANCE = ['parc', 'quartier', 'collines', 'plage', 'neige'];
const OBJECTIVES: ObjectiveKind[] = ['rout', 'boss'];

/** random 10 v 10 battles between AIs; `progress` is called after each one */
export function teamMatches(format: Format, games: number, seed = 1, level: AiLevel = 'normal', progress?: (i: number) => void): TeamStats {
  let r = seed >>> 0 || 1;
  const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const ids = Object.keys(PROFILES);
  const stats: TeamStats = { games: 0, presence: {}, byClass: {}, turns: 0, firstWins: 0 };
  const pick = () => [...ids].sort(() => rnd() - 0.5).slice(0, 10).map((id) => ({ defId: id, name: id, promo: rnd() < 0.5 ? 0 : 1, leader: false }));
  for (let g = 0; g < games; g++) {
    const t = [pick(), pick()];
    const ids0 = new Set(t[0].map((p) => p.defId));
    const first = (g % 2) as 0 | 1;
    const res = autoplay(
      {
        mapId: MAPS_FOR_BALANCE[g % MAPS_FOR_BALANCE.length],
        teams: [
          { name: 'A', units: skirmishTeam(t[0], format) },
          { name: 'B', units: skirmishTeam(t[1].map((p) => ({ ...p, alt: ids0.has(p.defId) })), format) },
        ],
        objective: { kind: OBJECTIVES[Math.floor(g / MAPS_FOR_BALANCE.length) % OBJECTIVES.length], turns: 30, attacker: 0 },
        fog: false,
        seed: Math.floor(rnd() * 2 ** 31),
        first,
      },
      [level, level],
      31,
    );
    stats.games++;
    stats.turns += res.turns;
    if (res.winner === first) stats.firstWins++;
    for (const team of [0, 1] as const) {
      const won = res.winner === team ? 1 : res.winner === null ? 0.5 : 0;
      for (const p of t[team]) {
        const e = (stats.presence[p.defId] ??= { games: 0, wins: 0 });
        e.games++;
        e.wins += won;
        const cls = PROFILES[p.defId].cls;
        const c = (stats.byClass[cls] ??= { games: 0, wins: 0 });
        c.games++;
        c.wins += won;
      }
    }
    progress?.(g);
  }
  stats.turns /= Math.max(1, stats.games);
  stats.firstWins /= Math.max(1, stats.games);
  return stats;
}

/** a fixed team (archetype) against random teams: its win rate */
export function archetypeVsRandom(team: string[], format: Format, games: number, seed = 3, level: AiLevel = 'normal'): number {
  let r = seed >>> 0 || 1;
  const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const ids = Object.keys(PROFILES);
  let wins = 0;
  for (let g = 0; g < games; g++) {
    const mine = team.map((id) => ({ defId: id, name: id, promo: 0, leader: false }));
    const other = [...ids].sort(() => rnd() - 0.5).slice(0, 10).map((id) => ({ defId: id, name: id, promo: rnd() < 0.5 ? 0 : 1, leader: false, alt: team.includes(id) }));
    const side = (g % 2) as 0 | 1;
    const teams = side === 0 ? [mine, other] : [other, mine];
    const res = autoplay(
      {
        mapId: MAPS_FOR_BALANCE[g % MAPS_FOR_BALANCE.length],
        teams: [
          { name: 'A', units: skirmishTeam(teams[0], format) },
          { name: 'B', units: skirmishTeam(teams[1], format) },
        ],
        objective: { kind: 'rout', turns: 30, attacker: 0 },
        fog: false,
        seed: Math.floor(rnd() * 2 ** 31),
        first: ((g >> 1) % 2) as 0 | 1,
      },
      [level, level],
      31,
    );
    if (res.winner === side) wins++;
    else if (res.winner === null) wins += 0.5;
  }
  return wins / games;
}

export type { UnitSetup };
