import { CLASSES } from './classes';
import { isMagicType, item, type ItemDef } from './items';
import { roll1, roll2, type RngState } from './rng';
import type { WeaponType } from './types';

/**
 * GBA-style combat formulas, on plain numbers (no battle state): the battle
 * engine fills a Combatant from a unit, its weapon, the ground and its supports.
 *
 *  attack speed  AS   = SPD − max(0, weapon weight − CON)
 *  hit           = weapon hit + SKL×2 + LCK/2 + triangle (±15) + support
 *  avoid         = AS×2 + LCK + terrain + support
 *  displayed hit = clamp(hit − enemy avoid, 0, 100), rolled with 2 random numbers (average)
 *  crit          = weapon crit + SKL/2 + class bonus + support; crit avoid = LCK + support
 *  damage        = POW + (might + triangle (±1)) × effectiveness (×3) − (DEF or RES + terrain)
 *  critical      = damage × 3
 *  follow-up     = AS − enemy AS ≥ 4
 */

export interface Combatant {
  uid: number;
  hp: number;
  maxHp: number;
  pow: number;
  skl: number;
  spd: number;
  lck: number;
  def: number;
  res: number;
  con: number;
  /** class crit bonus */
  classCrit: number;
  /** tags of the unit's class (effective weapons) */
  tags: string[];
  /** equipped weapon (null: can't attack / counter) */
  weapon: ItemDef | null;
  terrainAvoid: number;
  terrainDef: number;
  supportHit: number;
  supportAvoid: number;
  supportCrit: number;
  supportDodge: number;
  /** asleep: no avoid, no counter */
  asleep?: boolean;
}

export interface Rates {
  /** can strike at this distance */
  canAttack: boolean;
  dmg: number;
  hit: number;
  crit: number;
  /** strikes per attack phase (brave weapons: 2) */
  brave: boolean;
  doubles: boolean;
  /** effective weapon (×3) */
  effective: boolean;
  /** weapon triangle: +1 advantage, −1 disadvantage */
  triangle: -1 | 0 | 1;
  /** attacks with magic (RES) */
  magic: boolean;
  /** attack speed */
  as: number;
}

export interface Forecast {
  a: Rates;
  d: Rates;
  dist: number;
}

/** sword > axe > lance > sword · anima > light > dark > anima · bows / staves: none */
const BEATS: Partial<Record<WeaponType, WeaponType>> = {
  sword: 'axe',
  axe: 'lance',
  lance: 'sword',
  anima: 'light',
  light: 'dark',
  dark: 'anima',
};

export function triangle(a: WeaponType | undefined, b: WeaponType | undefined): -1 | 0 | 1 {
  if (!a || !b) return 0;
  if (BEATS[a] === b) return 1;
  if (BEATS[b] === a) return -1;
  return 0;
}

export function attackSpeed(c: Pick<Combatant, 'spd' | 'con' | 'weapon'>): number {
  const wt = c.weapon?.wt ?? 0;
  return c.spd - Math.max(0, wt - c.con);
}

export function inRange(w: ItemDef | null, dist: number): boolean {
  return !!w && w.kind === 'weapon' && dist >= w.min && dist <= w.max;
}

/** the weapon strikes with magic at this distance */
export function isMagicHit(w: ItemDef, dist: number): boolean {
  return isMagicType(w.type) || (!!w.magicBlade && dist >= 2);
}

/** rates of `x` striking `y` at distance `dist` (noTriangle: balance runs "triangle neutre") */
export function rates(x: Combatant, y: Combatant, dist: number, noTriangle = false): Rates {
  const w = x.weapon;
  const as = attackSpeed(x);
  const empty: Rates = { canAttack: false, dmg: 0, hit: 0, crit: 0, brave: false, doubles: false, effective: false, triangle: 0, magic: false, as };
  if (!w || !inRange(w, dist) || x.asleep) return empty;
  const tri = noTriangle ? 0 : triangle(w.type, y.weapon?.type);
  const effective = !!w.effective?.some((t) => y.tags.includes(t));
  const magic = isMagicHit(w, dist);
  const pow = w.magicBlade && dist >= 2 ? Math.floor(x.pow / 2) : x.pow;
  const might = (w.mt + tri) * (effective ? 3 : 1);
  const atk = pow + might;
  const stat = magic ? y.res : y.def;
  const defense = (w.pierce ? stat - Math.floor(stat / 2) : stat) + y.terrainDef;
  const dmg = Math.max(0, atk - defense);
  const hitRaw = w.hit + x.skl * 2 + Math.floor(x.lck / 2) + tri * 15 + x.supportHit;
  const avoid = y.asleep ? 0 : attackSpeed(y) * 2 + y.lck + y.terrainAvoid + y.supportAvoid;
  const hit = clamp(hitRaw - avoid, 0, 100);
  const critRaw = w.crit + Math.floor(x.skl / 2) + x.classCrit + x.supportCrit;
  const crit = clamp(critRaw - (y.lck + y.supportDodge), 0, 100);
  const doubles = as - attackSpeed(y) >= 4;
  return { canAttack: true, dmg, hit, crit, brave: !!w.brave, doubles, effective, triangle: tri, magic, as };
}

export function forecast(a: Combatant, d: Combatant, dist: number, noTriangle = false): Forecast {
  return { a: rates(a, d, dist, noTriangle), d: rates(d, a, dist, noTriangle), dist };
}

export interface Strike {
  /** uid of the striker */
  by: number;
  hit: boolean;
  crit: boolean;
  dmg: number;
  /** HP of the target after the strike */
  hpAfter: number;
  /** HP healed by a drain weapon */
  drained: number;
  /** the striker's weapon broke on this strike */
  broke: boolean;
}

/** Order of the strikes: A, D, then the faster one follows up (brave = twice each time). */
export function strikeOrder(f: Forecast): ('a' | 'd')[] {
  const out: ('a' | 'd')[] = [];
  const push = (s: 'a' | 'd') => {
    const r = f[s];
    if (!r.canAttack) return;
    out.push(s);
    if (r.brave) out.push(s);
  };
  push('a');
  push('d');
  if (f.a.doubles) push('a');
  else if (f.d.doubles) push('d');
  return out;
}

/**
 * Plays a combat with the random numbers of `rng`. `uses` = remaining uses of
 * each side's weapon (strikes consume one, hit or miss). Stops at the first death.
 */
export function resolve(f: Forecast, a: Combatant, d: Combatant, rng: RngState, uses: { a: number; d: number }): Strike[] {
  const hp = { a: a.hp, d: d.hp };
  const max = { a: a.maxHp, d: d.maxHp };
  const out: Strike[] = [];
  for (const s of strikeOrder(f)) {
    const o = s === 'a' ? 'd' : 'a';
    if (hp.a <= 0 || hp.d <= 0) break;
    if (uses[s] <= 0) continue;
    const r = f[s];
    const hit = roll2(rng, r.hit);
    const crit = hit && r.crit > 0 && roll1(rng, r.crit);
    const dmg = hit ? Math.min(hp[o], r.dmg * (crit ? 3 : 1)) : 0;
    hp[o] -= dmg;
    const w = (s === 'a' ? a : d).weapon!;
    const drained = w.drain && dmg > 0 ? Math.min(dmg, max[s] - hp[s]) : 0;
    hp[s] += drained;
    uses[s]--;
    out.push({ by: (s === 'a' ? a : d).uid, hit, crit, dmg, hpAfter: hp[o], drained, broke: uses[s] <= 0 });
  }
  return out;
}

/** expected damage of a forecast (AI / balance): uses the true 2RN hit chance */
export function expectedDamage(r: Rates, trueHit: (c: number) => number): number {
  if (!r.canAttack) return 0;
  const p = trueHit(r.hit) / 100;
  const c = r.crit / 100;
  const per = p * r.dmg * (1 + 2 * c);
  return per * (r.brave ? 2 : 1) * (r.doubles ? 2 : 1);
}

// ------------------------------------------------------------------ experience

export interface ExpInput {
  level: number;
  tier: 1 | 2;
}

const effLevel = (u: ExpInput) => u.level + (u.tier === 2 ? 20 : 0);

/** experience for one combat: missed everything = 1, damage = (31 + Δlevel) / 3, kill = + level bonus + 20 (+40 boss) */
export function combatExp(me: ExpInput, foe: ExpInput, dealtDamage: boolean, killed: boolean, boss: boolean): number {
  if (me.tier === 2 && me.level >= 20) return 0;
  if (!dealtDamage && !killed) return 1;
  const diff = effLevel(foe) - effLevel(me);
  const hitExp = Math.max(1, Math.floor((31 + diff) / 3));
  if (!killed) return Math.min(100, hitExp);
  const killExp = hitExp + Math.max(0, effLevel(foe) * 3 + (boss ? 40 : 0) - effLevel(me) * 3) + 20;
  return Math.min(100, killExp);
}

/** classes, re-exported for formula tests */
export function classCrit(cls: keyof typeof CLASSES): number {
  return CLASSES[cls].crit;
}

export function weaponOf(id: string | null): ItemDef | null {
  return id ? item(id) : null;
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}
