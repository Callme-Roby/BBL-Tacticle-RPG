/** Can the campaign be won? The crew is played by the hard AI, chapter after chapter. */
import { CAMPAIGN } from '../src/data/campaign';
import { addRecruits, applyChapterResult, chapterSetup, nextChapter, type CampaignSave } from '../src/game/campaign';
import { autoplay } from '../src/sim/autoplay';

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v), removeItem: (k: string) => delete store[k] } as Storage;

const save: CampaignSave = { v: 1, mode: 'casual', chapter: 0, stage: 'intro', units: [], fallen: [], done: false };
for (let i = 0; i < CAMPAIGN.length; i++) {
  addRecruits(save, CAMPAIGN[i]);
  let won = false;
  for (let attempt = 1; attempt <= 4 && !won; attempt++) {
    const setup = chapterSetup(save, i);
    setup.seed = 1000 * i + attempt;
    const r = autoplay(setup, ['hard', 'normal'], 40);
    won = r.winner === 0;
    console.log(`${CAMPAIGN[i].title} (${CAMPAIGN[i].subtitle}) essai ${attempt}: ${won ? 'VICTOIRE' : 'défaite'} en ${r.turns} tours — ${r.state.winReason}`);
    if (won) applyChapterResult(save, r.state);
  }
  if (!won) break;
  nextChapter(save);
  console.log('   la bande :', save.units.map((u) => `${u.defId} ${u.cls} ${u.level}`).join(', '));
}
