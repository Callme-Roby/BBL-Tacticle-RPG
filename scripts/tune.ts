/**
 * Automatic duel balancing: a guided local search (with a little annealing)
 * on each friend's level-1 stats, growth rates and weapon kits, within bounds
 * around the original values (a heavy stays heavy, a speedster stays fast),
 * until every friend wins ~50 % of its "neutral triangle" duels in the three
 * formats. Prints the tuned values to paste into src/rules/profiles.ts.
 *
 *   npx vite-node scripts/tune.ts steps=1500 duels=36
 *
 * Levers by format: RECRUES (level 5) ← level-1 stats + rank 1–2 weapons,
 * CONFIRMÉS (level 10) ← growths + rank 2 weapons, ÉLITE ← growths + rank 3 weapons.
 */
import { CLASSES } from '../src/rules/classes';
import { ITEMS } from '../src/rules/items';
import { PROFILES } from '../src/rules/profiles';
import { FORMATS } from '../src/rules/teams';
import { duelTable } from '../src/sim/balance';
import { GROW_KEYS, type GrowKey, type WeaponType } from '../src/rules/types';

const arg = (k: string, d: number) => Number(process.argv.find((a) => a.startsWith(k + '='))?.split('=')[1] ?? d);
const STEPS = arg('steps', 1500);
const N = arg('duels', 36);
const SEED = arg('seed', 4242);

const ids = Object.keys(PROFILES).filter((id) => id !== 'benji');
const B0 = Object.fromEntries(ids.map((id) => [id, { ...PROFILES[id].base }]));
const G0 = Object.fromEntries(ids.map((id) => [id, { ...PROFILES[id].growth }]));

/** weapons a friend may get in kit slot `rank` (1, 2, 3) */
function pool(id: string, rank: 1 | 2 | 3): string[] {
  const c = CLASSES[PROFILES[id].cls];
  const types = new Set<WeaponType>(rank === 3 ? (c.promotesTo ?? []).flatMap((x) => CLASSES[x].weapons) : c.weapons);
  return Object.values(ITEMS)
    .filter((i) => i.kind === 'weapon' && i.rank === rank && i.type && types.has(i.type))
    .map((i) => i.id);
}

function evaluate(seed = SEED, n = N) {
  const tables = FORMATS.map((f, i) => duelTable(f, n, seed + i * 101));
  let worst = 0;
  let sq = 0;
  let cnt = 0;
  const dev: { id: string; f: number; e: number }[] = [];
  for (const id of tables[0].ids)
    tables.forEach((t, f) => {
      const e = t.rate[id] - 0.5;
      worst = Math.max(worst, Math.abs(e));
      sq += e * e;
      cnt++;
      dev.push({ id, f, e });
    });
  return { score: worst + 1.2 * Math.sqrt(sq / cnt), worst, rms: Math.sqrt(sq / cnt), dev, tables };
}

let r = 99;
const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 2 ** 32);
const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];

let cur = evaluate();
let best = { score: cur.score, snap: JSON.stringify(PROFILES) };
console.log(`start: worst ±${(cur.worst * 100).toFixed(1)} rms ${(cur.rms * 100).toFixed(1)}`);
for (let step = 0; step < STEPS; step++) {
  const temp = 0.004 * (1 - step / STEPS);
  const sorted = [...cur.dev].sort((a, b) => Math.abs(b.e) - Math.abs(a.e));
  const target = rnd() < 0.8 ? sorted[Math.floor(rnd() * 8)] : pick(cur.dev);
  const id = target.id;
  const dir = target.e > 0 ? -1 : 1;
  const p = PROFILES[id];
  const undo: (() => void)[] = [];
  const roll = rnd();
  // which lever: depends on the format that is off
  const lever = target.f === 0 ? (roll < 0.7 ? 'base' : 'kit1') : target.f === 1 ? (roll < 0.6 ? 'growth' : roll < 0.8 ? 'base' : 'kit2') : roll < 0.45 ? 'kit3' : roll < 0.85 ? 'growth' : 'base';
  if (lever === 'base' || lever === 'growth') {
    const k: GrowKey = pick(GROW_KEYS);
    if (lever === 'growth') {
      const v = p.growth[k] + dir * 5;
      if (v < 5 || v > 100 || Math.abs(v - G0[id][k]) > 30) continue;
      const old = p.growth[k];
      p.growth[k] = v;
      undo.push(() => (p.growth[k] = old));
    } else {
      const span = k === 'hp' ? 6 : 3;
      const v = p.base[k] + dir * (k === 'hp' ? 2 : 1);
      if (v < 0 || Math.abs(v - B0[id][k]) > span) continue;
      const old = p.base[k];
      p.base[k] = v;
      undo.push(() => (p.base[k] = old));
    }
  } else {
    const slot = lever === 'kit1' ? 0 : lever === 'kit2' ? 1 : 2;
    const rank = (slot + 1) as 1 | 2 | 3;
    const kit = p.kit[slot];
    const weapons = kit.map((w, i) => [w, i] as const).filter(([w]) => ITEMS[w]?.kind === 'weapon');
    const options = pool(id, rank);
    if (!weapons.length || options.length < 2) continue;
    const [w, i] = pick(weapons);
    const repl = pick(options.filter((o) => o !== w && !kit.includes(o)));
    if (!repl) continue;
    const old = kit.slice();
    kit[i] = repl;
    undo.push(() => (p.kit[slot] = old));
  }
  const next = evaluate();
  if (next.score <= cur.score || rnd() < Math.exp(-(next.score - cur.score) / Math.max(1e-9, temp))) {
    cur = next;
    if (cur.score < best.score) best = { score: cur.score, snap: JSON.stringify(PROFILES) };
  } else for (const u of undo) u();
  if (step % 50 === 0) console.log(`step ${step}: worst ±${(cur.worst * 100).toFixed(1)} rms ${(cur.rms * 100).toFixed(1)} (best ${(best.score * 100).toFixed(1)})`);
}
Object.assign(PROFILES, JSON.parse(best.snap));
const check = evaluate(SEED + 777, 100);
console.log(`final (new seed, 100 duels/pair): worst ±${(check.worst * 100).toFixed(1)} rms ${(check.rms * 100).toFixed(1)}`);
check.tables.forEach((t, i) => console.log(FORMATS[i].name, Object.entries(t.rate).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v * 100).toFixed(1)}`).join(', ')));
for (const id of Object.keys(PROFILES)) {
  const b = PROFILES[id].base;
  const g = PROFILES[id].growth;
  console.log(`  ${id}: base: S(${b.hp}, ${b.pow}, ${b.skl}, ${b.spd}, ${b.lck}, ${b.def}, ${b.res}, ${b.con}, ${b.mov}), growth: G(${g.hp}, ${g.pow}, ${g.skl}, ${g.spd}, ${g.lck}, ${g.def}, ${g.res}), kit: ${JSON.stringify(PROFILES[id].kit)},`);
}
