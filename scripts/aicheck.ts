/** Quick AI health check: every map × objective × level, AI vs AI. */
import { autoplay } from '../src/sim/autoplay';
import { MAPS, parseMap } from '../src/rules/maps';
import { PROFILES } from '../src/rules/profiles';
import { skirmishTeam, FORMATS } from '../src/rules/teams';
import type { ObjectiveKind } from '../src/rules/battle';
import type { AiLevel } from '../src/ai/ai';

const ids = Object.keys(PROFILES);
let seed = 1;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
const pick = () => [...ids].sort(() => rnd() - 0.5).slice(0, 10).map((id) => ({ defId: id, name: id, promo: 0, leader: false }));
const levels = (process.argv[2] ?? 'easy,normal,hard').split(',') as AiLevel[];
for (const lv of levels) {
  let done = 0, total = 0, turns = 0, ms = 0, acts = 0;
  const res: Record<string, number[]> = {};
  for (const m of MAPS) {
    const hasThrone = parseMap(m).thrones.some(Boolean);
    for (const obj of ['rout', 'boss', 'seize', 'defend', 'escape'] as ObjectiveKind[]) {
      if (obj === 'seize' && !hasThrone) continue;
      const fmt = FORMATS[1];
      const t0 = Date.now();
      const r = autoplay({
        mapId: m.id,
        teams: [{ name: 'A', units: skirmishTeam(pick(), fmt) }, { name: 'B', units: skirmishTeam(pick(), fmt) }],
        objective: { kind: obj, turns: obj === 'defend' ? 12 : obj === 'escape' ? 15 : 30, attacker: 0 },
        fog: rnd() < 0.3,
        seed: Math.floor(rnd() * 1e9),
      }, [lv, lv], 31);
      ms += Date.now() - t0; acts += r.actions;
      total++;
      if (r.winner !== null) done++;
      turns += r.turns;
      (res[obj] ??= []).push(r.winner ?? -1);
    }
  }
  console.log(`${lv}: finished ${done}/${total}, avg turns ${(turns / total).toFixed(1)}, ms/action ${(ms / acts).toFixed(2)}`, JSON.stringify(res));
}
