import { strikeOrder, type Forecast } from '../rules/combat';
import {
  classOf,
  dist,
  equippedIndex,
  idx,
  isEscapeTile,
  isVisible,
  moveCost,
  onMap,
  pendingUnits,
  previewAttack,
  reachable,
  ring,
  staffRange,
  unitAt,
  usableStaves,
  usableWeapons,
  visibleTiles,
  type Action,
  type BattleState,
  type Unit,
} from '../rules/battle';
import { item } from '../rules/items';
import { TERRAIN, terrainBonus } from '../rules/terrain';
import type { Point, Team } from '../rules/types';

/**
 * Computer opponent. For the team in phase it scores every (destination,
 * action) pair of every unit and plays the best one, then starts again:
 *  - attacks are valued with the exact odds of the combat (2RN hit, crits,
 *    follow-ups): kill chance, damage dealt / taken, so it naturally uses the
 *    weapon triangle, effective weapons and goes for fragile targets;
 *  - the danger of the destination (what the enemies can deal there next
 *    turn) is subtracted, more at higher levels; good terrain is rewarded;
 *  - healers stay behind and heal; melee units guard them; chefs are careful.
 * Levels: easy (no danger awareness, some noise), normal, hard (full risk
 * evaluation, focus fire, groups up).
 */
export type AiLevel = 'easy' | 'normal' | 'hard';

const TRUE_HIT: number[] = (() => {
  const t: number[] = [];
  for (let c = 0; c <= 100; c++) {
    let n = 0;
    for (let a = 0; a < 100; a++) for (let b = 0; b < 100; b++) if ((a + b) / 2 < c) n++;
    t.push(n / 10000);
  }
  return t;
})();

export const trueHitP = (c: number) => TRUE_HIT[Math.max(0, Math.min(100, Math.round(c)))];

export interface Odds {
  pKill: number;
  pDie: number;
  eDealt: number;
  eTaken: number;
}

/** exact odds of a combat (enumerates hit / miss / crit of every strike) */
export function combatOdds(fc: Forecast, hpA: number, hpD: number): Odds {
  const order = strikeOrder(fc);
  const out: Odds = { pKill: 0, pDie: 0, eDealt: 0, eTaken: 0 };
  const rec = (k: number, a: number, d: number, p: number) => {
    if (p < 1e-5) return;
    if (a <= 0 || d <= 0 || k >= order.length) {
      if (d <= 0) out.pKill += p;
      if (a <= 0) out.pDie += p;
      out.eDealt += p * (hpD - Math.max(0, d));
      out.eTaken += p * (hpA - Math.max(0, a));
      return;
    }
    const s = order[k];
    const r = fc[s];
    const ph = trueHitP(r.hit);
    const pc = r.crit / 100;
    const hitD = r.dmg;
    if (s === 'a') {
      rec(k + 1, a, d - hitD * 3, p * ph * pc);
      rec(k + 1, a, d - hitD, p * ph * (1 - pc));
      rec(k + 1, a, d, p * (1 - ph));
    } else {
      rec(k + 1, a - hitD * 3, d, p * ph * pc);
      rec(k + 1, a - hitD, d, p * ph * (1 - pc));
      rec(k + 1, a, d, p * (1 - ph));
    }
  };
  rec(0, hpA, hpD, 1);
  return out;
}

interface Plan {
  action: Action;
  score: number;
}

/** how much a unit matters (losing it / killing it) */
function unitValue(s: BattleState, u: Unit): number {
  const c = classOf(u);
  let v = 20 + u.level * 0.5 + (c.tier === 2 ? 8 : 0);
  if (usableStaves(u).length && !usableWeapons(u).length) v += 14;
  if (u.leader && (s.objective.kind === 'boss' || s.objective.kind === 'seize' || s.objective.kind === 'escape')) v += 120;
  // its punch
  const w = usableWeapons(u)[0];
  if (w !== undefined) v += (u.stats.pow + item(u.items[w].id).mt) * 0.6;
  return v;
}

/** path-cost distance field from a set of goal tiles for a move type (units ignored) */
function distanceField(s: BattleState, u: Unit, goals: Point[]): Float32Array {
  const d = new Float32Array(s.w * s.h).fill(1e9);
  const open: number[] = [];
  for (const g of goals) {
    const i = idx(s, g.x, g.y);
    d[i] = 0;
    open.push(i);
  }
  // simple Dijkstra (small maps)
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (d[open[i]] < d[open[bi]]) bi = i;
    const cur = open.splice(bi, 1)[0];
    const cx = cur % s.w;
    const cy = (cur - cx) / s.w;
    // the cost is paid when ENTERING a tile: going backward from the goal, pay the current tile
    const step = moveCost(s, u, cx, cy);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) continue;
      const ni = idx(s, nx, ny);
      const c = d[cur] + (isFinite(step) ? step : 99);
      if (!isFinite(moveCost(s, u, nx, ny))) continue;
      if (c < d[ni]) {
        d[ni] = c;
        open.push(ni);
      }
    }
  }
  return d;
}

interface Context {
  team: Team;
  level: AiLevel;
  foes: Unit[];
  allies: Unit[];
  /** per enemy: the tiles it can strike next turn */
  threat: Map<number, Set<number>>;
  rand: () => number;
}

/** tiles each enemy can strike next turn (its move + weapon ranges) */
function threatMap(s: BattleState, foes: Unit[]): Map<number, Set<number>> {
  const out = new Map<number, Set<number>>();
  for (const e of foes) {
    const set = new Set<number>();
    if (e.status?.id === 'sleep') {
      out.set(e.uid, set);
      continue;
    }
    let lo = 99;
    let hi = -1;
    for (const i of usableWeapons(e)) {
      const it = item(e.items[i].id);
      lo = Math.min(lo, it.min);
      hi = Math.max(hi, it.max);
    }
    if (hi < 0) {
      out.set(e.uid, set);
      continue;
    }
    // the enemy's own team doesn't block it; ours do (approximation: ignore units)
    const r = reachable(s, e, e.stats.mov, true);
    for (const t of r.cost.keys()) {
      const x = t % s.w;
      const y = (t - x) / s.w;
      for (const p of ring(s, { x, y }, lo, hi)) set.add(idx(s, p.x, p.y));
    }
    out.set(e.uid, set);
  }
  return out;
}

/** expected damage the unit would take standing at `at` next enemy phase */
function danger(s: BattleState, ctx: Context, u: Unit, at: Point): number {
  let total = 0;
  const ti = idx(s, at.x, at.y);
  for (const e of ctx.foes) {
    if (!ctx.threat.get(e.uid)?.has(ti)) continue;
    // best weapon of the enemy against u (striking from plain ground at its best distance)
    let best = 0;
    for (const wi of usableWeapons(e)) {
      const w = item(e.items[wi].id);
      const dd = w.min >= 2 ? w.min : 1;
      const fc = previewAttackAt(s, e, wi, u, at, dd);
      const odds = combatOdds(fc, e.hp, u.hp);
      best = Math.max(best, odds.eDealt + odds.pKill * 30 - odds.eTaken * 0.3);
    }
    total += best;
  }
  return total;
}

/** forecast of `e` (weapon wi) striking `u` standing at `at`, from distance dd */
function previewAttackAt(s: BattleState, e: Unit, wi: number, u: Unit, at: Point, dd: number): Forecast {
  const savedX = u.x;
  const savedY = u.y;
  u.x = at.x;
  u.y = at.y;
  // the attacker stands on plain ground next to it (its real tile is unknown)
  const from = { x: at.x, y: at.y };
  try {
    const fc = previewAttack(s, e, findStand(s, at, dd) ?? from, u, wi);
    return fc;
  } finally {
    u.x = savedX;
    u.y = savedY;
  }
}

function findStand(s: BattleState, at: Point, dd: number): Point | null {
  for (const p of ring(s, at, dd, dd)) if (TERRAIN[s.tiles[idx(s, p.x, p.y)]].avoid === 0) return p;
  return ring(s, at, dd, dd)[0] ?? null;
}

/** Chooses the next action of the team in phase (or `end`). */
export function chooseAction(s: BattleState, level: AiLevel = 'normal', seed = 1): Action {
  const team = s.phase;
  const units = pendingUnits(s).filter((u) => u.team === team);
  if (!units.length) return { k: 'end' };
  const vis = s.fog ? visibleTiles(s, team) : null;
  const foes = onMap(s).filter((u) => u.team !== team && (!vis || isVisible(s, team, u, vis)));
  const allies = onMap(s).filter((u) => u.team === team);
  let r = seed >>> 0 || 1;
  const rand = () => {
    r = (r * 1664525 + 1013904223) >>> 0;
    return r / 4294967296;
  };
  const ctx: Context = { team, level, foes, allies, threat: level === 'easy' ? new Map() : threatMap(s, foes), rand };
  let best: Plan | null = null;
  for (const u of units) {
    const p = bestPlanFor(s, ctx, u);
    if (p && (!best || p.score > best.score)) best = p;
  }
  return best?.action ?? { k: 'end' };
}

function bestPlanFor(s: BattleState, ctx: Context, u: Unit): Plan | null {
  const reach = reachable(s, u);
  const dests: Point[] = [];
  for (const i of reach.cost.keys()) {
    const x = i % s.w;
    const y = (i - x) / s.w;
    const o = unitAt(s, x, y);
    if (o && o.uid !== u.uid) continue;
    dests.push({ x, y });
  }
  const c = classOf(u);
  const riskW = ctx.level === 'easy' ? 0 : ctx.level === 'normal' ? 0.45 : 0.85;
  const careful = u.leader && s.objective.kind !== 'rout' ? 2 : 1;
  const healerOnly = usableStaves(u).length > 0 && usableWeapons(u).length === 0;
  const plans: Plan[] = [];
  const noise = () => (ctx.level === 'easy' ? (ctx.rand() - 0.5) * 18 : 0);

  // ---- where to go when nothing better: toward the enemies / the objective
  const goals = goalTiles(s, ctx, u);
  const field = goals.length ? distanceField(s, u, goals) : null;
  const here = field ? field[idx(s, u.x, u.y)] : 0;
  const held = u.ai === 'hold' && !ctx.foes.some((e) => dist(e, u) <= u.stats.mov + 2);

  for (const d of dests) {
    const tb = terrainBonus(s.tiles[idx(s, d.x, d.y)], c.move);
    const dg = riskW > 0 ? danger(s, ctx, u, d) : 0;
    const terrain = (tb.avoid * 0.12 + tb.def * 1.5) * (ctx.level === 'easy' ? 0.3 : 1);
    const heal = TERRAIN[s.tiles[idx(s, d.x, d.y)]].heal > 0 && u.hp < u.stats.hp ? 4 : 0;
    // allies nearby (hard AI keeps formation; everyone guards the healers)
    let group = 0;
    for (const a of ctx.allies) {
      if (a.uid === u.uid) continue;
      const dd = dist(a, d);
      if (dd === 1) group += ctx.level === 'hard' ? 1.5 : 0.6;
      const aHealer = usableStaves(a).length > 0 && usableWeapons(a).length === 0;
      if (aHealer && !healerOnly && dd <= 2) group += ctx.level === 'easy' ? 0 : 2.5;
    }
    const posBase = terrain + heal + group - dg * riskW * careful + noise();

    // ---- attacks
    if (!healerOnly) {
      for (const wi of usableWeapons(u)) {
        const w = item(u.items[wi].id);
        if (ctx.level === 'easy' && wi !== equippedIndex(u) && ctx.rand() < 0.6) continue;
        for (const t of ctx.foes) {
          const dd = dist(d, t);
          if (dd < w.min || dd > w.max) continue;
          const fc = previewAttack(s, u, d, t, wi);
          const o = combatOdds(fc, u.hp, t.hp);
          const tv = unitValue(s, t);
          const uv = unitValue(s, u);
          let sc = o.pKill * tv + o.eDealt * 1.2 - o.pDie * uv * 1.3 * careful - o.eTaken * 0.6;
          // focus the wounded (finish them) and the healers
          if (ctx.level !== 'easy') sc += (1 - t.hp / t.stats.hp) * 6;
          if (fc.a.triangle > 0) sc += 2;
          if (fc.a.effective) sc += 3;
          // an attack that deals nothing is worthless
          if (fc.a.dmg === 0 || fc.a.hit === 0) sc -= 25;
          // after the fight it stays there: danger counts (less if the target is likely dead)
          const after = riskW > 0 ? dg * (1 - o.pKill * 0.3) * riskW * careful : 0;
          plans.push({ action: { k: 'attack', uid: u.uid, x: d.x, y: d.y, target: t.uid, item: wi }, score: 18 + sc + terrain - after + noise() });
        }
      }
    }
    // ---- staves
    for (const si of usableStaves(u)) {
      const st = item(u.items[si].id);
      const [lo, hi] = staffRange(u, st);
      if (st.staff === 'heal' || st.staff === 'physic') {
        for (const a of ctx.allies) {
          if (a.uid === u.uid || a.hp >= a.stats.hp) continue;
          const dd = dist(d, a);
          if (dd < lo || dd > hi) continue;
          const amount = Math.min((st.heal ?? 10) + u.stats.pow, a.stats.hp - a.hp);
          const urgency = a.hp / a.stats.hp < 0.5 ? 1.8 : 1;
          plans.push({ action: { k: 'staff', uid: u.uid, x: d.x, y: d.y, target: a.uid, item: si }, score: 10 + amount * 1.4 * urgency + (a.leader ? 4 : 0) + posBase });
        }
      } else if (st.staff === 'restore') {
        for (const a of ctx.allies) {
          if (!a.status || dist(d, a) > hi) continue;
          plans.push({ action: { k: 'staff', uid: u.uid, x: d.x, y: d.y, target: a.uid, item: si }, score: 14 + posBase });
        }
      } else if (st.staff === 'sleep' || st.staff === 'silence') {
        for (const t of ctx.foes) {
          const dd = dist(d, t);
          if (dd < lo || dd > hi || t.status) continue;
          const chance = Math.max(0, Math.min(100, 30 + u.stats.pow * 5 + u.stats.skl - t.stats.res * 5 - dd * 2)) / 100;
          if (st.staff === 'silence' && !classOf(t).magic) continue;
          plans.push({ action: { k: 'staff', uid: u.uid, x: d.x, y: d.y, target: t.uid, item: si }, score: 6 + chance * unitValue(s, t) * 0.6 + posBase });
        }
      }
    }
    // ---- objectives
    const th = s.thrones[(1 - u.team) as Team];
    if (s.objective.kind === 'seize' && u.leader && th && th.x === d.x && th.y === d.y) plans.push({ action: { k: 'seize', uid: u.uid, x: d.x, y: d.y }, score: 1000 });
    if (isEscapeTile(s, u.team, d.x, d.y) && (u.leader || ctx.level !== 'easy')) plans.push({ action: { k: 'escape', uid: u.uid, x: d.x, y: d.y }, score: u.leader ? 900 : 30 });
    // ---- wait / move
    if (!held || (d.x === u.x && d.y === u.y)) {
      const progress = field ? (here - field[idx(s, d.x, d.y)]) * (healerOnly ? 0.8 : 1.6) : 0;
      // healers: stay close behind the group, out of reach
      let healerPos = 0;
      if (healerOnly) {
        const near = ctx.allies.filter((a) => a.uid !== u.uid && dist(a, d) <= 3).length;
        healerPos = Math.min(3, near) * 1.5 - dg * 1.2;
      }
      plans.push({ action: { k: 'wait', uid: u.uid, x: d.x, y: d.y }, score: progress + posBase + healerPos });
    }
  }
  // ---- consumables: a drink when badly hurt and nothing good to do
  const potion = u.items.findIndex((it) => item(it.id).kind === 'heal');
  if (potion >= 0 && u.hp < u.stats.hp * 0.4) {
    const amount = Math.min(item(u.items[potion].id).heal ?? 10, u.stats.hp - u.hp);
    plans.push({ action: { k: 'use', uid: u.uid, x: u.x, y: u.y, item: potion }, score: amount * 1.1 });
  }
  // ---- promotion when possible
  const promo = u.items.findIndex((it) => item(it.id).kind === 'promo');
  if (promo >= 0 && c.tier === 1 && u.level >= 10 && c.promotesTo) {
    plans.push({ action: { k: 'use', uid: u.uid, x: u.x, y: u.y, item: promo, cls: c.promotesTo[0] }, score: 40 });
  }
  if (!plans.length) return null;
  plans.sort((a, b) => b.score - a.score);
  return plans[0];
}

/** where a unit wants to go: enemies (rout / boss), the throne (seize), the exits (escape)... */
function goalTiles(s: BattleState, ctx: Context, u: Unit): Point[] {
  const o = s.objective;
  if (o.kind === 'seize' && u.leader) {
    const th = s.thrones[(1 - u.team) as Team];
    if (th) return [th];
  }
  if (o.kind === 'escape' && o.attacker === u.team) {
    if (s.escapes.length) return s.escapes;
    const row: Point[] = [];
    const y = u.team === 0 ? 0 : s.h - 1;
    for (let x = 0; x < s.w; x++) row.push({ x, y });
    return row;
  }
  if ((o.kind === 'defend' || o.kind === 'escape') && o.attacker !== u.team) {
    // defenders hold around their throne / their side unless the enemy comes
    const th = s.thrones[u.team];
    if (th && ctx.foes.every((e) => dist(e, th) > 8)) return [th];
  }
  if (u.leader && o.kind !== 'rout' && ctx.level !== 'easy') {
    // chefs follow the group from behind
    const mates = ctx.allies.filter((a) => a.uid !== u.uid);
    if (mates.length) return mates.map((a) => ({ x: a.x, y: a.y }));
  }
  if (ctx.foes.length) return ctx.foes.map((e) => ({ x: e.x, y: e.y }));
  // fog and nobody in sight: the other side of the map
  const y = u.team === 0 ? 1 : s.h - 2;
  return [{ x: Math.floor(s.w / 2), y }];
}
