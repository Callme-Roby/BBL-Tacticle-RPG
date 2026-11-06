/**
 * Automatic duel balancing: a guided local search (with a little annealing)
 * on each friend's level-1 stats, growth rates and weapon kits, within bounds
 * around the starting values (a heavy stays heavy, a speedster stays fast),
 * until every friend wins ~50 % of its "neutral triangle" duels in the three
 * formats. Incremental: only the duels of the friend that changed are replayed.
 * Prints the tuned values to paste into src/rules/profiles.ts.
 *
 *   npx vite-node scripts/tune.ts steps=1500 duels=100
 *
 * Levers by format: RECRUES (level 5) ← level-1 stats + rank 1–2 weapons,
 * CONFIRMÉS (level 10) ← growths + rank 2 weapons, ÉLITE ← growths + rank 3 weapons.
 */
import { CLASSES } from '../src/rules/classes';
import { ITEMS } from '../src/rules/items';
import { PROFILES } from '../src/rules/profiles';
import { FORMATS } from '../src/rules/teams';
import { pairRate } from '../src/sim/balance';
import { GROW_KEYS, type GrowKey, type WeaponType } from '../src/rules/types';

const arg = (k: string, d: number) => Number(process.argv.find((a) => a.startsWith(k + '='))?.split('=')[1] ?? d);
const STEPS = arg('steps', 1500);
const N = arg('duels', 100);
const SEED = arg('seed', 4242);

const ids = Object.keys(PROFILES).filter((id) => CLASSES[PROFILES[id].cls].weapons[0] !== 'staff');
const B0 = Object.fromEntries(ids.map((id) => [id, { ...PROFILES[id].base }]));
const G0 = Object.fromEntries(ids.map((id) => [id, { ...PROFILES[id].growth }]));

function pool(id: string, rank: 1 | 2 | 3): string[] {
  const c = CLASSES[PROFILES[id].cls];
  const types = new Set<WeaponType>(rank === 3 ? (c.promotesTo ?? []).flatMap((x) => CLASSES[x].weapons) : c.weapons);
  return Object.values(ITEMS)
    .filter((i) => i.kind === 'weapon' && i.rank === rank && i.type && types.has(i.type))
    .map((i) => i.id);
}

// m[f][a][b] = rate of a vs b in format f (b vs a = 1 - that)
const m: Record<string, Record<string, number>>[] = FORMATS.map(() => ({}));
const seedOf = (a: string, b: string, f: number) => {
  let h = SEED + f * 7919;
  for (const c of a + '|' + b) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};
function computePair(f: number, a: string, b: string) {
  const [x, y] = a < b ? [a, b] : [b, a];
  const r = pairRate(FORMATS[f], x, y, N, seedOf(x, y, f));
  (m[f][x] ??= {})[y] = r;
  (m[f][y] ??= {})[x] = 1 - r;
}
function recompute(id: string | null) {
  for (let f = 0; f < FORMATS.length; f++)
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) if (!id || ids[i] === id || ids[j] === id) computePair(f, ids[i], ids[j]);
}
function score() {
  let worst = 0;
  let sq = 0;
  const dev: { id: string; f: number; e: number }[] = [];
  for (let f = 0; f < FORMATS.length; f++)
    for (const a of ids) {
      const vs = ids.filter((b) => b !== a).map((b) => m[f][a][b]);
      const e = vs.reduce((x, y) => x + y, 0) / vs.length - 0.5;
      worst = Math.max(worst, Math.abs(e));
      sq += e * e;
      dev.push({ id: a, f, e });
    }
  const rms = Math.sqrt(sq / dev.length);
  return { score: worst + 1.2 * rms, worst, rms, dev };
}

let r = 99;
const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 2 ** 32);
const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];

recompute(null);
let cur = score();
let best = { score: cur.score, snap: JSON.stringify(PROFILES) };
console.log(`start: worst ±${(cur.worst * 100).toFixed(1)} rms ${(cur.rms * 100).toFixed(1)}`);
const t0 = Date.now();
for (let step = 0; step < STEPS; step++) {
  const temp = 0.003 * (1 - step / STEPS);
  const sorted = [...cur.dev].sort((a, b) => Math.abs(b.e) - Math.abs(a.e));
  const target = rnd() < 0.8 ? sorted[Math.floor(rnd() * 6)] : pick(cur.dev);
  const id = target.id;
  const dir = target.e > 0 ? -1 : 1;
  const p = PROFILES[id];
  const snap = JSON.stringify(p);
  const roll = rnd();
  const lever = target.f === 0 ? (roll < 0.7 ? 'base' : 'kit1') : target.f === 1 ? (roll < 0.6 ? 'growth' : roll < 0.8 ? 'base' : 'kit2') : roll < 0.4 ? 'kit3' : roll < 0.85 ? 'growth' : 'base';
  if (lever === 'base' || lever === 'growth') {
    const k: GrowKey = pick(GROW_KEYS);
    if (lever === 'growth') {
      const v = p.growth[k] + dir * 5;
      if (v < 5 || v > 100 || Math.abs(v - G0[id][k]) > 25) continue;
      p.growth[k] = v;
    } else {
      const v = p.base[k] + dir * (k === 'hp' ? 2 : 1);
      if (v < 0 || Math.abs(v - B0[id][k]) > (k === 'hp' ? 5 : 3)) continue;
      p.base[k] = v;
    }
  } else {
    const slot = lever === 'kit1' ? 0 : lever === 'kit2' ? 1 : 2;
    const kit = p.kit[slot];
    const weapons = kit.map((w, i) => [w, i] as const).filter(([w]) => ITEMS[w]?.kind === 'weapon');
    const options = pool(id, (slot + 1) as 1 | 2 | 3).filter((o) => !kit.includes(o));
    if (!weapons.length || !options.length) continue;
    const [, i] = pick(weapons);
    kit[i] = pick(options);
  }
  const saved = m.map((t) => JSON.stringify(t));
  recompute(id);
  const next = score();
  if (next.score <= cur.score || rnd() < Math.exp(-(next.score - cur.score) / Math.max(1e-9, temp))) {
    cur = next;
    if (cur.score < best.score) best = { score: cur.score, snap: JSON.stringify(PROFILES) };
  } else {
    Object.assign(p, JSON.parse(snap));
    saved.forEach((t, f) => (m[f] = JSON.parse(t)));
  }
  if (step % 50 === 0) console.log(`step ${step} (${((Date.now() - t0) / 1000).toFixed(0)} s): worst ±${(cur.worst * 100).toFixed(1)} rms ${(cur.rms * 100).toFixed(1)} (best ${(best.score * 100).toFixed(1)})`);
}
Object.assign(PROFILES, JSON.parse(best.snap));
recompute(null);
const fin = score();
console.log(`best: worst ±${(fin.worst * 100).toFixed(1)} rms ${(fin.rms * 100).toFixed(1)}`);
for (const id of Object.keys(PROFILES)) {
  const b = PROFILES[id].base;
  const g = PROFILES[id].growth;
  console.log(`  ${id}: base: S(${b.hp}, ${b.pow}, ${b.skl}, ${b.spd}, ${b.lck}, ${b.def}, ${b.res}, ${b.con}, ${b.mov}), growth: G(${g.hp}, ${g.pow}, ${g.skl}, ${g.spd}, ${g.lck}, ${g.def}, ${g.res}), kit: ${JSON.stringify(PROFILES[id].kit)},`);
}
