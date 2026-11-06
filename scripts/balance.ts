/**
 * Balance report: npm run balance [-- duels=60 games=200 archetypes=40]
 * Writes BALANCE.md (tables) and prints a summary.
 */
import { writeFileSync } from 'node:fs';
import { CLASSES } from '../src/rules/classes';
import { PROFILES } from '../src/rules/profiles';
import { FORMATS } from '../src/rules/teams';
import { archetypeVsRandom, duelTable, teamMatches } from '../src/sim/balance';

const arg = (k: string, d: number) => Number(process.argv.find((a) => a.startsWith(k + '='))?.split('=')[1] ?? d);
const DUELS = arg('duels', 60);
const GAMES = arg('games', 200);
const ARCH = arg('archetypes', 40);
const only = process.argv.find((a) => a.startsWith('only='))?.split('=')[1];

const pct = (x: number) => `${(x * 100).toFixed(1)} %`;
const name = (id: string) => id.toUpperCase();
const cls = (id: string) => CLASSES[PROFILES[id].cls].name;
let md = '# Équilibrage de BBL TACTICS\n\nRapport généré par `npm run balance` (scripts/balance.ts, src/sim/balance.ts).\n\n';
const t0 = Date.now();

if (!only || only === 'duels') {
  md += `## Duels « à triangle neutre »\n\nChaque pote contre chaque autre, ${DUELS} duels par paire (chacun commence une fois sur deux, les deux promotions possibles en Élite), terrain nu, triangle des armes désactivé. Chacun choisit son arme et sa distance (1 ou 2 cases) ; 20 échanges sans K.O. = nul. Benji (soigneur, sans arme) n'est pas dans les duels.\n\n`;
  const rows: Record<string, number[]> = {};
  for (const f of FORMATS) {
    const t = duelTable(f, DUELS, 12345);
    for (const id of t.ids) (rows[id] ??= []).push(t.rate[id]);
    const vals = Object.values(t.rate);
    console.log(`[duels ${f.name}] max ${pct(Math.max(...vals))} min ${pct(Math.min(...vals))}`, Object.entries(t.rate).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v)}`).join(', '));
  }
  md += `| Pote | Classe | ${FORMATS.map((f) => f.name).join(' | ')} |\n|---|---|${FORMATS.map(() => '---:').join('|')}|\n`;
  for (const [id, r] of Object.entries(rows).sort((a, b) => b[1][1] - a[1][1])) md += `| ${name(id)} | ${cls(id)} | ${r.map(pct).join(' | ')} |\n`;
  md += '\n';
}

if (!only || only === 'teams') {
  md += `## Matchs 10 contre 10 (IA normale contre IA normale)\n\n${GAMES} matchs par format, équipes de 10 tirées au hasard, 5 cartes symétriques, objectifs déroute / chef, 30 tours max. Taux de victoire des équipes qui contenaient chaque pote.\n\n`;
  const all: Record<string, string[]> = {};
  const classes: Record<string, string[]> = {};
  const extra: string[] = [];
  for (const f of FORMATS) {
    const st = teamMatches(f, GAMES, 777, 'normal', (i) => {
      if (i % 50 === 49) console.log(`  ${f.name}: ${i + 1}/${GAMES}`);
    });
    for (const [id, e] of Object.entries(st.presence)) (all[id] ??= []).push(pct(e.wins / e.games));
    for (const [c, e] of Object.entries(st.byClass)) (classes[c] ??= []).push(pct(e.wins / e.games));
    extra.push(`${f.name} : ${st.turns.toFixed(1)} tours en moyenne, l'équipe qui commence gagne ${pct(st.firstWins)}`);
    const vals = Object.values(st.presence).map((e) => e.wins / e.games);
    console.log(`[10v10 ${f.name}] max ${pct(Math.max(...vals))} min ${pct(Math.min(...vals))} turns ${st.turns.toFixed(1)} first ${pct(st.firstWins)}`);
  }
  md += `| Pote | Classe | ${FORMATS.map((f) => f.name).join(' | ')} |\n|---|---|${FORMATS.map(() => '---:').join('|')}|\n`;
  for (const [id, r] of Object.entries(all).sort()) md += `| ${name(id)} | ${cls(id)} | ${r.join(' | ')} |\n`;
  md += `\nPar classe de départ :\n\n| Classe | ${FORMATS.map((f) => f.name).join(' | ')} |\n|---|${FORMATS.map(() => '---:').join('|')}|\n`;
  for (const [c, r] of Object.entries(classes).sort()) md += `| ${CLASSES[c as keyof typeof CLASSES].name} | ${r.join(' | ')} |\n`;
  md += '\n' + extra.map((x) => `- ${x}`).join('\n') + '\n\n';
}

if (!only || only === 'arch') {
  md += `## Équipes-types contre équipes au hasard\n\n${ARCH} matchs chacune (format Confirmés, IA normale, déroute) : aucune ne doit être imbattable.\n\n| Équipe | Composition | Victoires |\n|---|---|---:|\n`;
  const ids = Object.keys(PROFILES);
  const by = (pred: (id: string) => boolean) => ids.filter(pred);
  const fill = (core: string[]) => [...core, ...ids.filter((i) => !core.includes(i))].slice(0, 10);
  const arch: [string, string[]][] = [
    ['Les costauds', fill(by((i) => ['cogneur', 'mur'].includes(PROFILES[i].cls)))],
    ['Les rapides', fill(by((i) => ['lame', 'filou', 'bagarreur', 'pilote', 'livreur'].includes(PROFILES[i].cls)))],
    ['Les tireurs', fill(by((i) => ['tireur', 'pyromane', 'gourou', 'infirmier'].includes(PROFILES[i].cls)))],
    ['Sans soigneur', ids.filter((i) => i !== 'benji').slice(0, 10)],
    ['Les 10 meilleurs en duel', ['zia', 'aroa', 'rayan', 'isis', 'dylan', 'mihai', 'thomas', 'clement', 'billel', 'enola']],
  ];
  for (const [label, team] of arch) {
    const r = archetypeVsRandom(team, FORMATS[1], ARCH);
    console.log(`[archetype] ${label}: ${pct(r)}`);
    md += `| ${label} | ${team.map(name).join(', ')} | ${pct(r)} |\n`;
  }
  md += '\n';
}

md += `_Simulation : ${((Date.now() - t0) / 1000).toFixed(0)} s._\n`;
if (!only) writeFileSync('BALANCE.md', md);
else console.log(md);
