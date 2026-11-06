import { CLASSES, type ClassDef, type ClassId } from './classes';
import { combatExp, forecast, inRange, resolve, type Combatant, type Forecast, type Strike } from './combat';
import { isMagicType, item, type ItemDef } from './items';
import { parseMap, getMap } from './maps';
import { profileOf } from './profiles';
import { nextFloat, roll1, type RngState } from './rng';
import { pairKey, supportBonus, SUPPORT_THRESHOLDS, supportPair, type SupportLevel } from './supports';
import { TERRAIN, terrainBonus } from './terrain';
import { GROW_KEYS, type GrowKey, type Growths, type Point, type Stats, type StatusId, type Team, type Terrain } from './types';

// =====================================================================================
// state
// =====================================================================================

export interface ItemSlot {
  id: string;
  uses: number;
}

export interface Unit {
  uid: number;
  team: Team;
  /** roster id (friend or lab creation) */
  defId: string;
  name: string;
  cls: ClassId;
  level: number;
  exp: number;
  /** max stats (stats.hp = max HP) */
  stats: Stats;
  growth: Growths;
  hp: number;
  x: number;
  y: number;
  /** inventory (5 max); the first usable weapon is the equipped one */
  items: ItemSlot[];
  /** has moved this turn (can still act if not `done`) */
  moved: boolean;
  /** turn over */
  done: boolean;
  /** uid of the ally being carried */
  carrying: number | null;
  /** carried by (not on the map meanwhile) */
  carriedBy: number | null;
  status: { id: StatusId; turns: number } | null;
  /** the team's chef (objectives "vaincre le chef", "capturer", "s'enfuir") */
  leader: boolean;
  alive: boolean;
  /** left the map through an exit */
  escaped: boolean;
  /** wears the alternate costume (same friend on both sides) */
  alt: boolean;
  kills: number;
  /** campaign enemies: 'hold' = stays put until someone comes in range */
  ai?: 'charge' | 'hold' | 'guard';
}

export type ObjectiveKind = 'rout' | 'boss' | 'seize' | 'defend' | 'escape';

export interface Objective {
  kind: ObjectiveKind;
  /** defend: number of turns to hold; escape / others: turn limit (0 = none) */
  turns: number;
  /** defend / escape: the team that attacks (the other one defends) */
  attacker: Team;
  /** campaign: this team loses if its chef falls */
  lord?: Team;
}

/** support state of a pair: level reached and points accumulated (kept from battle to battle) */
export interface SupportProgress {
  pts: number;
  level: SupportLevel;
}

export interface TeamInfo {
  name: string;
  /** supports between friends at the start of the battle (pair key -> progress) */
  supports: Record<string, SupportProgress>;
}

export interface BattleState {
  v: 1;
  mapId: string;
  w: number;
  h: number;
  tiles: Terrain[];
  thrones: [Point | null, Point | null];
  escapes: Point[];
  units: Unit[];
  turn: number;
  phase: Team;
  rng: number;
  objective: Objective;
  fog: boolean;
  teams: [TeamInfo, TeamInfo];
  /** per team, per pair: support points / level (starts from TeamInfo.supports) */
  supports: [Record<string, SupportProgress>, Record<string, SupportProgress>];
  /** team that plays first each turn */
  first: Team;
  winner: Team | null;
  winReason: string;
  nextUid: number;
}

export interface UnitSetup {
  defId: string;
  name: string;
  cls: ClassId;
  level: number;
  /** item ids (5 max) */
  items: string[];
  leader?: boolean;
  alt?: boolean;
  /** exact stats / growths (campaign carry-over, lab creations); else from the profile */
  stats?: Stats;
  growth?: Growths;
  hp?: number;
  exp?: number;
  /** uses of each item (campaign carry-over) */
  uses?: number[];
  ai?: Unit['ai'];
  /** force a spawn tile */
  at?: Point;
}

export interface TeamSetup {
  name: string;
  units: UnitSetup[];
  supports?: Record<string, SupportProgress>;
}

export interface BattleSetup {
  mapId: string;
  teams: [TeamSetup, TeamSetup];
  objective: Objective;
  fog: boolean;
  seed: number;
  /** team that plays first (default 0) */
  first?: Team;
}

// =====================================================================================
// stats
// =====================================================================================

/**
 * Stats of a friend at a level: level-1 bases + average growth per level
 * (deterministic, so skirmish teams are fair). Advanced classes are reached
 * at level 10 of the base class.
 */
export function statsAt(defId: string, cls: ClassId, level: number, base?: Stats, growth?: Growths): Stats {
  const c = CLASSES[cls];
  const prof = profileOf(defId, c.tier === 1 ? cls : undefined);
  const b = base ?? prof.base;
  const g = growth ?? prof.growth;
  const baseCls = c.tier === 1 ? c : CLASSES[(Object.values(CLASSES).find((x) => x.promotesTo?.includes(cls))?.id ?? 'bagarreur') as ClassId];
  const s: Stats = { ...b };
  const levels1 = c.tier === 1 ? level - 1 : 9;
  for (const k of GROW_KEYS) s[k] = Math.min(baseCls.caps[k], b[k] + Math.round((g[k] * levels1) / 100));
  if (c.tier === 2) {
    for (const [k, v] of Object.entries(c.promo ?? {})) s[k as keyof Stats] += v as number;
    for (const k of GROW_KEYS) s[k] = Math.min(c.caps[k], s[k] + Math.round((g[k] * (level - 1)) / 100));
  }
  s.mov = c.mov;
  return s;
}

// =====================================================================================
// creation
// =====================================================================================

export function createBattle(setup: BattleSetup): BattleState {
  const map = parseMap(getMap(setup.mapId));
  const st: BattleState = {
    v: 1,
    mapId: map.id,
    w: map.w,
    h: map.h,
    tiles: map.tiles,
    thrones: map.thrones,
    escapes: map.escapes,
    units: [],
    turn: 1,
    phase: setup.first ?? 0,
    rng: (setup.seed >>> 0) || 1,
    objective: setup.objective,
    fog: setup.fog,
    teams: [
      { name: setup.teams[0].name, supports: JSON.parse(JSON.stringify(setup.teams[0].supports ?? {})) },
      { name: setup.teams[1].name, supports: JSON.parse(JSON.stringify(setup.teams[1].supports ?? {})) },
    ],
    supports: [
      JSON.parse(JSON.stringify(setup.teams[0].supports ?? {})),
      JSON.parse(JSON.stringify(setup.teams[1].supports ?? {})),
    ],
    first: setup.first ?? 0,
    winner: null,
    winReason: '',
    nextUid: 1,
  };
  for (const team of [0, 1] as Team[]) {
    const spawns = map.spawns[team];
    const list = setup.teams[team].units;
    let k = 0;
    // a chef is required by some objectives: the first unit by default
    const hasLeader = list.some((u) => u.leader);
    list.forEach((u, i) => {
      const at = u.at ?? spawns[k++];
      if (!at) return;
      const stats = u.stats ? { ...u.stats } : statsAt(u.defId, u.cls, u.level, undefined, u.growth);
      const prof = profileOf(u.defId, CLASSES[u.cls].tier === 1 ? u.cls : undefined);
      st.units.push({
        uid: st.nextUid++,
        team,
        defId: u.defId,
        name: u.name,
        cls: u.cls,
        level: u.level,
        exp: u.exp ?? 0,
        stats,
        growth: u.growth ? { ...u.growth } : { ...prof.growth },
        hp: Math.min(stats.hp, u.hp ?? stats.hp),
        x: at.x,
        y: at.y,
        items: u.items.slice(0, 5).map((id, j) => ({ id, uses: u.uses?.[j] ?? item(id).uses })),
        moved: false,
        done: false,
        carrying: null,
        carriedBy: null,
        status: null,
        leader: u.leader ?? (!hasLeader && i === 0),
        alive: true,
        escaped: false,
        alt: !!u.alt,
        kills: 0,
        ai: u.ai,
      });
    });
  }
  return st;
}

// =====================================================================================
// queries
// =====================================================================================

export const idx = (s: { w: number }, x: number, y: number) => y * s.w + x;
export const inside = (s: { w: number; h: number }, x: number, y: number) => x >= 0 && y >= 0 && x < s.w && y < s.h;
export const dist = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const terrainAt = (s: BattleState, x: number, y: number): Terrain => s.tiles[idx(s, x, y)];

export function unitByUid(s: BattleState, uid: number): Unit | undefined {
  return s.units.find((u) => u.uid === uid);
}

/** units standing on the map (alive, not carried, not escaped) */
export function onMap(s: BattleState): Unit[] {
  return s.units.filter((u) => u.alive && u.carriedBy === null && !u.escaped);
}

export function unitAt(s: BattleState, x: number, y: number): Unit | undefined {
  return s.units.find((u) => u.alive && u.carriedBy === null && !u.escaped && u.x === x && u.y === y);
}

export function classOf(u: Unit): ClassDef {
  return CLASSES[u.cls];
}

/** can the unit wield this item now (class, rank, silence) */
export function canWield(u: Unit, it: ItemDef): boolean {
  if (it.kind !== 'weapon' && it.kind !== 'staff') return false;
  const c = classOf(u);
  if (!it.type || !c.weapons.includes(it.type)) return false;
  if (it.rank === 3 && c.tier === 1) return false;
  if (it.rank === 2 && c.tier === 1 && u.level < 5) return false;
  if (u.status?.id === 'silence' && (isMagicType(it.type) || it.type === 'staff' || it.magicBlade)) return false;
  return true;
}

/** index of the equipped weapon (first usable weapon of the inventory), -1 = none */
export function equippedIndex(u: Unit): number {
  return u.items.findIndex((s) => {
    const it = item(s.id);
    return it.kind === 'weapon' && canWield(u, it);
  });
}

export function equipped(u: Unit): ItemDef | null {
  const i = equippedIndex(u);
  return i < 0 ? null : item(u.items[i].id);
}

/** weapons the unit can attack with */
export function usableWeapons(u: Unit): number[] {
  const out: number[] = [];
  u.items.forEach((s, i) => {
    const it = item(s.id);
    if (it.kind === 'weapon' && canWield(u, it)) out.push(i);
  });
  return out;
}

export function usableStaves(u: Unit): number[] {
  const out: number[] = [];
  u.items.forEach((s, i) => {
    const it = item(s.id);
    if (it.kind === 'staff' && canWield(u, it)) out.push(i);
  });
  return out;
}

/** weapon ranges the unit covers (for the red danger zone) */
export function weaponRange(u: Unit): [number, number] | null {
  let lo = 99;
  let hi = -1;
  for (const i of usableWeapons(u)) {
    const it = item(u.items[i].id);
    lo = Math.min(lo, it.min);
    hi = Math.max(hi, it.max);
  }
  return hi < 0 ? null : [lo, hi];
}

/** range of a staff for this user (physic-like staves: MAG / 2, at least 1) */
export function staffRange(u: Unit, it: ItemDef): [number, number] {
  if (it.staff === 'physic' || it.staff === 'rescue' || it.staff === 'sleep' || it.staff === 'silence') return [1, Math.max(1, Math.floor(u.stats.pow / 2))];
  return [1, 1];
}

/** rescue: how much a unit can carry (aid) */
export function aid(u: Unit): number {
  const c = classOf(u);
  if (c.move === 'horse') return 25 - u.stats.con;
  if (c.move === 'flier') return 20 - u.stats.con;
  return u.stats.con - 1;
}

export function canRescue(u: Unit, t: Unit): boolean {
  return u.team === t.team && u.carrying === null && t.carrying === null && t.stats.con <= aid(u) && t.uid !== u.uid;
}

// =====================================================================================
// movement
// =====================================================================================

export interface Reach {
  /** tile index -> movement spent */
  cost: Map<number, number>;
  /** tile index -> previous tile index */
  prev: Map<number, number>;
}

export function moveCost(s: BattleState, u: Unit, x: number, y: number): number {
  return TERRAIN[terrainAt(s, x, y)].cost[classOf(u).move];
}

/**
 * Tiles the unit can reach this turn (Dijkstra on terrain costs). Enemies block,
 * allies can be crossed. `ignoreUnits` = for the AI's long-range planning.
 * `blockers` = only these enemy positions block (fog: hidden enemies don't).
 */
export function reachable(s: BattleState, u: Unit, mov = u.stats.mov, ignoreUnits = false, from: Point = u): Reach {
  const cost = new Map<number, number>();
  const prev = new Map<number, number>();
  const start = idx(s, from.x, from.y);
  cost.set(start, 0);
  const open: number[] = [start];
  const enemyAt = new Set<number>();
  if (!ignoreUnits) for (const o of onMap(s)) if (o.team !== u.team) enemyAt.add(idx(s, o.x, o.y));
  while (open.length) {
    // small maps: a linear scan for the cheapest tile is fine
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (cost.get(open[i])! < cost.get(open[bi])!) bi = i;
    const cur = open.splice(bi, 1)[0];
    const c0 = cost.get(cur)!;
    const cx = cur % s.w;
    const cy = (cur - cx) / s.w;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inside(s, nx, ny)) continue;
      const ni = idx(s, nx, ny);
      if (enemyAt.has(ni)) continue;
      const c = c0 + moveCost(s, u, nx, ny);
      if (c > mov) continue;
      if (cost.has(ni) && cost.get(ni)! <= c) continue;
      cost.set(ni, c);
      prev.set(ni, cur);
      open.push(ni);
    }
  }
  return { cost, prev };
}

export const DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** tiles the unit may END its move on (reachable and free) */
export function destinations(s: BattleState, u: Unit): Set<number> {
  const r = reachable(s, u);
  const out = new Set<number>();
  for (const i of r.cost.keys()) {
    const x = i % s.w;
    const y = (i - x) / s.w;
    const o = unitAt(s, x, y);
    if (!o || o.uid === u.uid) out.add(i);
  }
  return out;
}

export function pathTo(s: BattleState, r: Reach, x: number, y: number): Point[] {
  const out: Point[] = [];
  let i: number | undefined = idx(s, x, y);
  if (!r.cost.has(i)) return out;
  while (i !== undefined) {
    const px = i % s.w;
    out.unshift({ x: px, y: (i - px) / s.w });
    i = r.prev.get(i);
  }
  return out;
}

/** tiles at distance [lo, hi] from p */
export function ring(s: { w: number; h: number }, p: Point, lo: number, hi: number): Point[] {
  const out: Point[] = [];
  for (let dy = -hi; dy <= hi; dy++)
    for (let dx = -hi; dx <= hi; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < lo || d > hi) continue;
      const x = p.x + dx;
      const y = p.y + dy;
      if (inside(s, x, y)) out.push({ x, y });
    }
  return out;
}

// =====================================================================================
// supports
// =====================================================================================

export function supportState(s: BattleState, a: Unit, b: Unit): SupportProgress {
  return s.supports[a.team][pairKey(a.defId, b.defId)] ?? { pts: 0, level: 0 };
}

export function supportLevel(s: BattleState, a: Unit, b: Unit): SupportLevel {
  if (a.team !== b.team || a.defId === b.defId) return 0;
  return supportState(s, a, b).level;
}

/** support bonuses of a unit: allies with a support level within 3 tiles */
export function supportBonuses(s: BattleState, u: Unit, at: Point = u): { hit: number; avoid: number; crit: number; dodge: number } {
  const out = { hit: 0, avoid: 0, crit: 0, dodge: 0 };
  for (const o of onMap(s)) {
    if (o.team !== u.team || o.uid === u.uid) continue;
    if (dist(o, at) > 3) continue;
    const lv = supportLevel(s, u, o);
    if (!lv) continue;
    const b = supportBonus(lv);
    out.hit += b.hit;
    out.avoid += b.avoid;
    out.crit += b.crit;
    out.dodge += b.dodge;
  }
  return out;
}

/** partners ready for their next support conversation, adjacent to `u` (standing at `at`) */
export function supportTalks(s: BattleState, u: Unit, at: Point = u): Unit[] {
  const out: Unit[] = [];
  for (const o of onMap(s)) {
    if (o.team !== u.team || o.uid === u.uid || dist(o, at) !== 1 || o.defId === u.defId) continue;
    if (!supportPair(u.defId, o.defId)) continue;
    const st = supportState(s, u, o);
    if (st.level < 3 && st.pts >= SUPPORT_THRESHOLDS[Math.min(2, st.level)]) out.push(o);
  }
  return out;
}

function addSupport(s: BattleState, a: Unit, b: Unit, pts: number) {
  if (a.team !== b.team || a.defId === b.defId || !supportPair(a.defId, b.defId)) return;
  const key = pairKey(a.defId, b.defId);
  const tbl = s.supports[a.team];
  const cur = tbl[key] ?? { pts: 0, level: 0 };
  // points stop at the next threshold until the conversation is seen
  cur.pts = Math.min(cur.pts + pts, SUPPORT_THRESHOLDS[Math.min(2, cur.level)]);
  tbl[key] = cur;
}

// =====================================================================================
// combat
// =====================================================================================

/** combat view of a unit standing at `at` with weapon index `wi` (-1 = equipped) */
export function combatant(s: BattleState, u: Unit, at: Point = u, wi = -1): Combatant {
  const c = classOf(u);
  const i = wi >= 0 ? wi : equippedIndex(u);
  const w = i >= 0 ? item(u.items[i].id) : null;
  const t = terrainBonus(terrainAt(s, at.x, at.y), c.move);
  const sb = supportBonuses(s, u, at);
  const carry = u.carrying !== null;
  return {
    uid: u.uid,
    hp: u.hp,
    maxHp: u.stats.hp,
    pow: u.stats.pow,
    skl: carry ? Math.floor(u.stats.skl / 2) : u.stats.skl,
    spd: carry ? Math.floor(u.stats.spd / 2) : u.stats.spd,
    lck: u.stats.lck,
    def: u.stats.def,
    res: u.stats.res,
    con: u.stats.con,
    classCrit: c.crit,
    tags: c.tags,
    weapon: w && w.kind === 'weapon' && canWield(u, w) ? w : null,
    terrainAvoid: t.avoid,
    terrainDef: t.def,
    supportHit: sb.hit,
    supportAvoid: sb.avoid,
    supportCrit: sb.crit,
    supportDodge: sb.dodge,
    asleep: u.status?.id === 'sleep',
  };
}

/** Combat forecast of `u` (moved to `at`, weapon index `wi`) attacking `t`. */
export function previewAttack(s: BattleState, u: Unit, at: Point, t: Unit, wi: number): Forecast {
  const a = combatant(s, u, at, wi);
  const d = combatant(s, t);
  return forecast(a, d, dist(at, t));
}

// =====================================================================================
// actions
// =====================================================================================

export type Action =
  | { k: 'wait'; uid: number; x: number; y: number }
  | { k: 'attack'; uid: number; x: number; y: number; target: number; item: number }
  | { k: 'staff'; uid: number; x: number; y: number; target: number; item: number }
  | { k: 'use'; uid: number; x: number; y: number; item: number; cls?: ClassId }
  | { k: 'trade'; uid: number; x: number; y: number; partner: number; mine: ItemSlot[]; theirs: ItemSlot[] }
  | { k: 'equip'; uid: number; item: number }
  | { k: 'rescue'; uid: number; x: number; y: number; target: number }
  | { k: 'drop'; uid: number; x: number; y: number; tx: number; ty: number }
  | { k: 'steal'; uid: number; x: number; y: number; target: number; item: number }
  | { k: 'seize'; uid: number; x: number; y: number }
  | { k: 'escape'; uid: number; x: number; y: number }
  | { k: 'support'; uid: number; x: number; y: number; partner: number }
  | { k: 'end' };

export interface LevelUp {
  uid: number;
  level: number;
  gains: Partial<Record<GrowKey, number>>;
}

export type BattleEvent =
  | { t: 'move'; uid: number; path: Point[] }
  | {
      t: 'combat';
      a: number;
      d: number;
      fc: Forecast;
      strikes: Strike[];
      /** experience gained by each side, level-ups */
      exp: { uid: number; amount: number }[];
      levels: LevelUp[];
      deaths: number[];
    }
  | { t: 'staff'; uid: number; target: number; item: string; amount: number; hit: boolean; status?: StatusId; exp: number; levels: LevelUp[] }
  | { t: 'exp'; uid: number; amount: number; levels: LevelUp[] }
  | { t: 'heal'; uid: number; amount: number; source: 'item' | 'terrain' }
  | { t: 'status'; uid: number; status: StatusId | null }
  | { t: 'promote'; uid: number; from: ClassId; to: ClassId; gains: Partial<Stats> }
  | { t: 'boost'; uid: number; stat: string; amount: number }
  | { t: 'trade'; uid: number; partner: number }
  | { t: 'rescue'; uid: number; target: number }
  | { t: 'drop'; uid: number; target: number; x: number; y: number }
  | { t: 'steal'; uid: number; target: number; item: string }
  | { t: 'break'; uid: number; item: string }
  | { t: 'seize'; uid: number }
  | { t: 'escape'; uid: number }
  | { t: 'support'; a: number; b: number; level: SupportLevel }
  | { t: 'phase'; team: Team; turn: number }
  | { t: 'end'; winner: Team; reason: string };

export class ActionError extends Error {}

function fail(msg: string): never {
  throw new ActionError(msg);
}

/** the unit `uid` can act now */
function actor(s: BattleState, uid: number): Unit {
  const u = unitByUid(s, uid);
  if (!u || !u.alive || u.carriedBy !== null || u.escaped) fail('unité absente');
  if (u.team !== s.phase) fail("ce n'est pas son tour");
  if (u.done) fail('a déjà joué');
  if (u.status?.id === 'sleep') fail('endormi');
  return u;
}

/** commits the move part of an action (validated) */
function moveTo(s: BattleState, u: Unit, x: number, y: number, ev: BattleEvent[]) {
  if (u.x === x && u.y === y) return;
  if (u.moved) fail('a déjà bougé');
  const r = reachable(s, u);
  if (!r.cost.has(idx(s, x, y))) fail('case hors de portée');
  const o = unitAt(s, x, y);
  if (o && o.uid !== u.uid) fail('case occupée');
  const path = pathTo(s, r, x, y);
  u.x = x;
  u.y = y;
  u.moved = true;
  ev.push({ t: 'move', uid: u.uid, path });
}

/** Apply an action (validated). Returns what happened, for the presentation. Throws ActionError if illegal. */
export function applyAction(s: BattleState, a: Action): BattleEvent[] {
  if (s.winner !== null) fail('partie terminée');
  const ev: BattleEvent[] = [];
  switch (a.k) {
    case 'end':
      endPhase(s, ev);
      break;
    case 'equip': {
      const u = actor(s, a.uid);
      const slot = u.items[a.item];
      if (!slot || !canWield(u, item(slot.id))) fail('arme inutilisable');
      u.items.splice(a.item, 1);
      u.items.unshift(slot);
      break;
    }
    case 'wait': {
      const u = actor(s, a.uid);
      moveTo(s, u, a.x, a.y, ev);
      finish(s, u, ev);
      break;
    }
    case 'attack': {
      const u = actor(s, a.uid);
      const t = unitByUid(s, a.target);
      if (!t || !t.alive || t.carriedBy !== null || t.team === u.team) fail('cible invalide');
      const slot = u.items[a.item];
      if (!slot) fail('arme absente');
      const w = item(slot.id);
      if (w.kind !== 'weapon' || !canWield(u, w)) fail('arme inutilisable');
      if (!inRange(w, dist({ x: a.x, y: a.y }, t))) fail('hors de portée');
      moveTo(s, u, a.x, a.y, ev);
      // attacking equips the weapon
      u.items.splice(a.item, 1);
      u.items.unshift(slot);
      fight(s, u, t, ev);
      if (u.alive) finish(s, u, ev);
      break;
    }
    case 'staff': {
      const u = actor(s, a.uid);
      const t = unitByUid(s, a.target);
      const slot = u.items[a.item];
      if (!slot || !t || !t.alive || t.carriedBy !== null) fail('cible invalide');
      const st = item(slot.id);
      if (st.kind !== 'staff' || !canWield(u, st)) fail('bâton inutilisable');
      const [lo, hi] = staffRange(u, st);
      const d = dist({ x: a.x, y: a.y }, t);
      if (d < lo || d > hi) fail('hors de portée');
      const hostile = st.staff === 'sleep' || st.staff === 'silence';
      if (hostile ? t.team === u.team : t.team !== u.team) fail('cible invalide');
      moveTo(s, u, a.x, a.y, ev);
      useStaff(s, u, t, slot, st, d, ev);
      finish(s, u, ev);
      break;
    }
    case 'use': {
      const u = actor(s, a.uid);
      const slot = u.items[a.item];
      if (!slot) fail('objet absent');
      const it = item(slot.id);
      moveTo(s, u, a.x, a.y, ev);
      if (it.kind === 'heal') {
        if (u.hp >= u.stats.hp) fail('PV déjà au max');
        const amount = Math.min(it.heal ?? 10, u.stats.hp - u.hp);
        u.hp += amount;
        ev.push({ t: 'heal', uid: u.uid, amount, source: 'item' });
      } else if (it.kind === 'promo') {
        const c = classOf(u);
        if (c.tier !== 1 || u.level < 10 || !c.promotesTo) fail('promotion impossible (niveau 10 requis)');
        const to = a.cls && c.promotesTo.includes(a.cls) ? a.cls : c.promotesTo[0];
        promote(s, u, to, ev);
      } else if (it.kind === 'boost' && it.boost) {
        u.stats[it.boost.stat] += it.boost.amount;
        if (it.boost.stat === 'hp') u.hp += it.boost.amount;
        ev.push({ t: 'boost', uid: u.uid, stat: it.boost.stat, amount: it.boost.amount });
      } else fail("cet objet ne s'utilise pas comme ça");
      consume(u, slot, ev);
      finish(s, u, ev);
      break;
    }
    case 'trade': {
      const u = actor(s, a.uid);
      const p = unitByUid(s, a.partner);
      if (!p || !p.alive || p.team !== u.team || p.carriedBy !== null) fail('partenaire invalide');
      if (dist({ x: a.x, y: a.y }, p) !== 1) fail('pas adjacent');
      if (a.mine.length > 5 || a.theirs.length > 5) fail('inventaire plein');
      const before = [...u.items, ...p.items].map((i) => i.id + ':' + i.uses).sort().join(',');
      const after = [...a.mine, ...a.theirs].map((i) => i.id + ':' + i.uses).sort().join(',');
      if (before !== after) fail('échange invalide');
      moveTo(s, u, a.x, a.y, ev);
      u.moved = true;
      u.items = a.mine.map((i) => ({ ...i }));
      p.items = a.theirs.map((i) => ({ ...i }));
      ev.push({ t: 'trade', uid: u.uid, partner: p.uid });
      break;
    }
    case 'rescue': {
      const u = actor(s, a.uid);
      const t = unitByUid(s, a.target);
      if (!t || !t.alive || t.carriedBy !== null || !canRescue(u, t)) fail('impossible de le porter');
      if (dist({ x: a.x, y: a.y }, t) !== 1) fail('pas adjacent');
      moveTo(s, u, a.x, a.y, ev);
      u.carrying = t.uid;
      t.carriedBy = u.uid;
      ev.push({ t: 'rescue', uid: u.uid, target: t.uid });
      finish(s, u, ev);
      break;
    }
    case 'drop': {
      const u = actor(s, a.uid);
      if (u.carrying === null) fail('ne porte personne');
      const t = unitByUid(s, u.carrying)!;
      if (dist({ x: a.x, y: a.y }, { x: a.tx, y: a.ty }) !== 1 || !inside(s, a.tx, a.ty)) fail('case invalide');
      moveTo(s, u, a.x, a.y, ev);
      if (unitAt(s, a.tx, a.ty) || !isFinite(moveCost(s, t, a.tx, a.ty))) fail('case invalide');
      t.x = a.tx;
      t.y = a.ty;
      t.carriedBy = null;
      t.done = true;
      u.carrying = null;
      ev.push({ t: 'drop', uid: u.uid, target: t.uid, x: a.tx, y: a.ty });
      finish(s, u, ev);
      break;
    }
    case 'steal': {
      const u = actor(s, a.uid);
      const t = unitByUid(s, a.target);
      if (!classOf(u).steal) fail('seuls les voleurs volent');
      if (!t || !t.alive || t.team === u.team || t.carriedBy !== null) fail('cible invalide');
      if (dist({ x: a.x, y: a.y }, t) !== 1) fail('pas adjacent');
      if (u.stats.spd < t.stats.spd) fail('trop lent pour voler');
      if (u.items.length >= 5) fail('inventaire plein');
      const slot = t.items[a.item];
      if (!slot || a.item === equippedIndex(t)) fail('objet impossible à voler');
      moveTo(s, u, a.x, a.y, ev);
      t.items.splice(a.item, 1);
      u.items.push(slot);
      ev.push({ t: 'steal', uid: u.uid, target: t.uid, item: slot.id });
      gainExp(s, u, 10, ev);
      finish(s, u, ev);
      break;
    }
    case 'seize': {
      const u = actor(s, a.uid);
      const th = s.thrones[(1 - u.team) as Team];
      if (s.objective.kind !== 'seize' || !u.leader || !th || th.x !== a.x || th.y !== a.y) fail('rien à capturer ici');
      moveTo(s, u, a.x, a.y, ev);
      ev.push({ t: 'seize', uid: u.uid });
      finish(s, u, ev);
      win(s, u.team, `${s.teams[u.team].name} capture le trône !`, ev);
      break;
    }
    case 'escape': {
      const u = actor(s, a.uid);
      if (!isEscapeTile(s, u.team, a.x, a.y)) fail('pas de sortie ici');
      moveTo(s, u, a.x, a.y, ev);
      u.escaped = true;
      u.done = true;
      // a carried unit escapes too
      if (u.carrying !== null) {
        const c = unitByUid(s, u.carrying)!;
        c.escaped = true;
      }
      ev.push({ t: 'escape', uid: u.uid });
      checkEnd(s, ev);
      break;
    }
    case 'support': {
      const u = actor(s, a.uid);
      const p = unitByUid(s, a.partner);
      if (!p) fail('partenaire absent');
      moveTo(s, u, a.x, a.y, ev);
      if (!supportTalks(s, u).some((o) => o.uid === p.uid)) fail('pas de conversation disponible');
      const key = pairKey(u.defId, p.defId);
      const tbl = s.supports[u.team];
      const cur = tbl[key] ?? { pts: 0, level: 0 };
      cur.level = Math.min(3, cur.level + 1) as SupportLevel;
      tbl[key] = cur;
      ev.push({ t: 'support', a: u.uid, b: p.uid, level: cur.level });
      finish(s, u, ev);
      break;
    }
  }
  return ev;
}

/** escape objective: the attacking team leaves by the exits (or the enemy's back row on maps without exits) */
export function isEscapeTile(s: BattleState, team: Team, x: number, y: number): boolean {
  if (s.objective.kind !== 'escape' || team !== s.objective.attacker) return false;
  if (s.escapes.length) return s.escapes.some((p) => p.x === x && p.y === y);
  return team === 0 ? y === 0 : y === s.h - 1;
}

function finish(s: BattleState, u: Unit, ev: BattleEvent[]) {
  u.moved = true;
  u.done = true;
  checkEnd(s, ev);
}

function consume(u: Unit, slot: ItemSlot, ev: BattleEvent[]) {
  slot.uses--;
  if (slot.uses <= 0) {
    u.items = u.items.filter((i) => i !== slot);
    ev.push({ t: 'break', uid: u.uid, item: slot.id });
  }
}

function fight(s: BattleState, u: Unit, t: Unit, ev: BattleEvent[]) {
  const fc = previewAttack(s, u, u, t, equippedIndex(u));
  const ca = combatant(s, u);
  const cd = combatant(s, t);
  const ia = equippedIndex(u);
  const id = equippedIndex(t);
  const slotA = u.items[ia];
  const slotD = id >= 0 ? t.items[id] : null;
  const uses = { a: slotA.uses, d: slotD?.uses ?? 0 };
  const strikes = resolve(fc, ca, cd, s, uses);
  // apply
  let dealtA = false;
  let dealtD = false;
  for (const st of strikes) {
    const by = st.by === u.uid ? u : t;
    const to = by === u ? t : u;
    to.hp = st.hpAfter;
    by.hp = Math.min(by.stats.hp, by.hp + st.drained);
    if (st.dmg > 0) {
      if (by === u) dealtA = true;
      else dealtD = true;
    }
  }
  slotA.uses = uses.a;
  if (slotD) slotD.uses = uses.d;
  const deaths: number[] = [];
  const exp: { uid: number; amount: number }[] = [];
  const levels: LevelUp[] = [];
  for (const [me, foe, dealt] of [
    [u, t, dealtA],
    [t, u, dealtD],
  ] as [Unit, Unit, boolean][]) {
    if (me.hp <= 0) continue;
    // a unit that could not fight back (no weapon in range) gains nothing
    const fought = me === u || fc.d.canAttack;
    if (!fought) continue;
    const killed = foe.hp <= 0;
    const amount = combatExp({ level: me.level, tier: classOf(me).tier }, { level: foe.level, tier: classOf(foe).tier }, dealt, killed, foe.leader);
    if (killed) me.kills++;
    exp.push({ uid: me.uid, amount });
    const lu = addExp(s, me, amount);
    if (lu) levels.push(lu);
  }
  // supports: fighting next to a partner
  for (const me of [u, t]) {
    if (me.hp <= 0) continue;
    for (const o of onMap(s)) if (o.team === me.team && o.uid !== me.uid && dist(o, me) === 1) addSupport(s, me, o, 2);
  }
  // broken weapons
  if (slotA.uses <= 0) {
    u.items = u.items.filter((i) => i !== slotA);
    ev.push({ t: 'break', uid: u.uid, item: slotA.id });
  }
  if (slotD && slotD.uses <= 0) {
    t.items = t.items.filter((i) => i !== slotD);
  }
  ev.push({ t: 'combat', a: u.uid, d: t.uid, fc, strikes, exp, levels, deaths });
  for (const x of [u, t]) if (x.hp <= 0) kill(s, x, deaths);
  if (slotD && slotD.uses <= 0) ev.push({ t: 'break', uid: t.uid, item: slotD.id });
}

function kill(s: BattleState, x: Unit, deaths: number[]) {
  x.alive = false;
  x.hp = 0;
  deaths.push(x.uid);
  // the carried ally is dropped on a free tile next to the body
  if (x.carrying !== null) {
    const c = unitByUid(s, x.carrying)!;
    c.carriedBy = null;
    const spot = ring(s, x, 0, 2).find((p) => !unitAt(s, p.x, p.y) && isFinite(moveCost(s, c, p.x, p.y)));
    if (spot) {
      c.x = spot.x;
      c.y = spot.y;
    } else c.alive = false;
    x.carrying = null;
  }
}

function useStaff(s: BattleState, u: Unit, t: Unit, slot: ItemSlot, st: ItemDef, d: number, ev: BattleEvent[]) {
  let amount = 0;
  let hit = true;
  let status: StatusId | undefined;
  switch (st.staff) {
    case 'heal':
    case 'physic':
      if (t.hp >= t.stats.hp) fail('PV déjà au max');
      amount = Math.min((st.heal ?? 10) + u.stats.pow, t.stats.hp - t.hp);
      t.hp += amount;
      break;
    case 'restore':
      if (!t.status) fail('aucun état à soigner');
      t.status = null;
      break;
    case 'rescue': {
      // brings the ally next to the user
      const spot = ring(s, u, 1, 1).find((p) => !unitAt(s, p.x, p.y) && isFinite(moveCost(s, t, p.x, p.y)));
      if (!spot) fail('pas de place à côté');
      t.x = spot.x;
      t.y = spot.y;
      ev.push({ t: 'move', uid: t.uid, path: [spot] });
      break;
    }
    case 'sleep':
    case 'silence': {
      const chance = Math.max(0, Math.min(100, 30 + u.stats.pow * 5 + u.stats.skl - t.stats.res * 5 - d * 2));
      hit = roll1(s, chance);
      status = st.status;
      if (hit && status) t.status = { id: status, turns: status === 'sleep' ? 2 : 3 };
      break;
    }
  }
  slot.uses--;
  const exp = st.exp ?? 11;
  const levels: LevelUp[] = [];
  const lu = addExp(s, u, exp);
  if (lu) levels.push(lu);
  ev.push({ t: 'staff', uid: u.uid, target: t.uid, item: st.id, amount, hit, status, exp, levels });
  if (slot.uses <= 0) {
    u.items = u.items.filter((i) => i !== slot);
    ev.push({ t: 'break', uid: u.uid, item: st.id });
  }
}

function gainExp(s: BattleState, u: Unit, amount: number, ev: BattleEvent[]) {
  const lu = addExp(s, u, amount);
  ev.push({ t: 'exp', uid: u.uid, amount, levels: lu ? [lu] : [] });
}

/** adds experience; returns the level-up if there was one (rolled with the battle's random numbers) */
export function addExp(s: RngState, u: Unit, amount: number): LevelUp | null {
  const c = CLASSES[u.cls];
  if (u.level >= 20) {
    u.exp = 0;
    return null;
  }
  u.exp += amount;
  if (u.exp < 100) return null;
  u.exp -= 100;
  u.level++;
  if (u.level >= 20) u.exp = 0;
  const gains: Partial<Record<GrowKey, number>> = {};
  for (const k of GROW_KEYS) {
    let g = u.growth[k];
    let n = 0;
    // growths over 100 % can give +2
    while (g > 0) {
      if (roll1(s, Math.min(100, g))) n++;
      g -= 100;
    }
    const capped = Math.min(n, c.caps[k] - u.stats[k]);
    if (capped > 0) {
      u.stats[k] += capped;
      gains[k] = capped;
      if (k === 'hp') u.hp += capped;
    }
  }
  return { uid: u.uid, level: u.level, gains };
}

export function promote(s: BattleState, u: Unit, to: ClassId, ev: BattleEvent[]) {
  const from = u.cls;
  const c = CLASSES[to];
  const gains: Partial<Stats> = {};
  for (const [k, v] of Object.entries(c.promo ?? {})) {
    const key = k as keyof Stats;
    if (key === 'mov') continue;
    const before = u.stats[key];
    u.stats[key] = Math.min(c.caps[key], u.stats[key] + (v as number));
    gains[key] = u.stats[key] - before;
  }
  gains.mov = c.mov - u.stats.mov;
  u.stats.mov = c.mov;
  u.hp = Math.min(u.stats.hp, u.hp + (gains.hp ?? 0));
  u.cls = to;
  u.level = 1;
  u.exp = 0;
  ev.push({ t: 'promote', uid: u.uid, from, to, gains });
  void s;
}

// =====================================================================================
// turns & objectives
// =====================================================================================

function endPhase(s: BattleState, ev: BattleEvent[]) {
  // supports: allies ending the phase next to each other
  const mine = onMap(s).filter((u) => u.team === s.phase);
  for (let i = 0; i < mine.length; i++)
    for (let j = i + 1; j < mine.length; j++) if (dist(mine[i], mine[j]) === 1) addSupport(s, mine[i], mine[j], 1);
  s.phase = (1 - s.phase) as Team;
  if (s.phase === s.first) s.turn++;
  ev.push({ t: 'phase', team: s.phase, turn: s.turn });
  startPhase(s, ev);
  checkEnd(s, ev);
}

function startPhase(s: BattleState, ev: BattleEvent[]) {
  for (const u of s.units) {
    if (u.team !== s.phase || !u.alive) continue;
    u.moved = false;
    u.done = false;
    if (u.carriedBy !== null || u.escaped) continue;
    // terrain healing (forts, thrones, villages)
    const heal = TERRAIN[terrainAt(s, u.x, u.y)].heal;
    if (heal > 0 && u.hp < u.stats.hp) {
      const amount = Math.min(u.stats.hp - u.hp, Math.max(1, Math.round((u.stats.hp * heal) / 100)));
      u.hp += amount;
      ev.push({ t: 'heal', uid: u.uid, amount, source: 'terrain' });
    }
    if (u.status) {
      u.status.turns--;
      if (u.status.turns <= 0) {
        u.status = null;
        ev.push({ t: 'status', uid: u.uid, status: null });
      } else if (u.status.id === 'sleep') u.done = true;
    }
  }
}

function win(s: BattleState, team: Team, reason: string, ev: BattleEvent[]) {
  if (s.winner !== null) return;
  s.winner = team;
  s.winReason = reason;
  ev.push({ t: 'end', winner: team, reason });
}

export function checkEnd(s: BattleState, ev: BattleEvent[]) {
  if (s.winner !== null) return;
  const o = s.objective;
  const alive = (t: Team) => s.units.filter((u) => u.team === t && u.alive && !u.escaped);
  const name = (t: Team) => s.teams[t].name;
  for (const t of [0, 1] as Team[]) {
    const foe = (1 - t) as Team;
    if (alive(foe).length === 0 && !(o.kind === 'escape' && foe === o.attacker && s.units.some((u) => u.team === foe && u.escaped))) {
      win(s, t, `${name(t)} a battu toute l'équipe adverse !`, ev);
      return;
    }
  }
  if (o.lord !== undefined) {
    const chef = s.units.find((u) => u.team === o.lord && u.leader);
    if (chef && !chef.alive) {
      const t = (1 - o.lord) as Team;
      win(s, t, `${chef.name} est tombé… la bande doit se replier.`, ev);
      return;
    }
  }
  if (o.kind === 'boss' || o.kind === 'seize' || o.kind === 'escape') {
    for (const t of [0, 1] as Team[]) {
      const foe = (1 - t) as Team;
      const chef = s.units.find((u) => u.team === foe && u.leader);
      if (chef && !chef.alive) {
        win(s, t, `${name(t)} a vaincu le chef adverse (${chef.name}) !`, ev);
        return;
      }
    }
  }
  if (o.kind === 'escape') {
    const chef = s.units.find((u) => u.team === o.attacker && u.leader);
    if (chef?.escaped) {
      win(s, o.attacker, `${name(o.attacker)} s'est enfui avec son chef !`, ev);
      return;
    }
  }
  if ((o.kind === 'defend' || o.kind === 'escape') && o.turns > 0 && s.turn > o.turns) {
    const def = (1 - o.attacker) as Team;
    win(s, def, `${name(def)} a tenu ${o.turns} tours !`, ev);
    return;
  }
  if (o.kind !== 'defend' && o.kind !== 'escape' && o.turns > 0 && s.turn > o.turns) {
    // turn limit: the team with more units (then more HP) wins
    const score = (t: Team) => alive(t).length * 1000 + alive(t).reduce((a, u) => a + u.hp, 0);
    const t: Team = score(0) >= score(1) ? 0 : 1;
    win(s, t, `Limite de tours : ${name(t)} gagne aux points.`, ev);
  }
}

/** units of the team in phase that can still act */
export function pendingUnits(s: BattleState): Unit[] {
  return onMap(s).filter((u) => u.team === s.phase && !u.done && u.status?.id !== 'sleep');
}

/** deep copy (the AI tries actions on copies) */
export function cloneBattle(s: BattleState): BattleState {
  return JSON.parse(JSON.stringify(s)) as BattleState;
}

/** a fresh random seed from the battle's generator (for things like map variants) */
export function randomSeed(s: BattleState): number {
  return Math.floor(nextFloat(s) * 2 ** 31);
}

// =====================================================================================
// fog of war
// =====================================================================================

/** tiles seen by a team: 3 tiles around each unit (+ class vision) */
export function visibleTiles(s: BattleState, team: Team): Set<number> {
  const out = new Set<number>();
  for (const u of onMap(s)) {
    if (u.team !== team) continue;
    const r = 3 + classOf(u).vision;
    for (const p of ring(s, u, 0, r)) out.add(idx(s, p.x, p.y));
  }
  return out;
}

export function isVisible(s: BattleState, viewer: Team, u: Unit, vis?: Set<number>): boolean {
  if (!s.fog || u.team === viewer) return true;
  return (vis ?? visibleTiles(s, viewer)).has(idx(s, u.x, u.y));
}
