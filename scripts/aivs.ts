/** Are the AI levels ordered? level A vs level B on mirrored teams. */
import { autoplay } from '../src/sim/autoplay';
import { MAPS } from '../src/rules/maps';
import { PROFILES } from '../src/rules/profiles';
import { skirmishTeam, FORMATS } from '../src/rules/teams';
import type { AiLevel } from '../src/ai/ai';
const ids = Object.keys(PROFILES);
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
const pick = () => [...ids].sort(() => rnd() - 0.5).slice(0, 10).map((id) => ({ defId: id, name: id, promo: 0, leader: false }));
const [A, B, N] = [process.argv[2] as AiLevel, process.argv[3] as AiLevel, Number(process.argv[4] ?? 20)];
let wa = 0, games = 0;
for (let i = 0; i < N; i++) {
  const ta = pick(), tb = pick();
  const map = MAPS[i % 5].id;
  for (const swap of [false, true]) {
    const teams = swap ? [tb, ta] : [ta, tb];
    const lv: [AiLevel, AiLevel] = swap ? [B, A] : [A, B];
    const r = autoplay({ mapId: map, teams: [{ name: 'X', units: skirmishTeam(teams[0], FORMATS[1]) }, { name: 'Y', units: skirmishTeam(teams[1], FORMATS[1]) }], objective: { kind: 'rout', turns: 30, attacker: 0 }, fog: false, seed: Math.floor(rnd() * 1e9), first: (i % 2) as 0 | 1 }, lv, 31);
    games++;
    const aTeam = swap ? 1 : 0;
    if (r.winner === aTeam) wa++;
  }
}
console.log(`${A} vs ${B}: ${A} wins ${wa}/${games} (${((100 * wa) / games).toFixed(0)}%)`);
