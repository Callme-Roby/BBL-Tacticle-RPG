import { CAMPAIGN, type Chapter } from '../data/campaign';
import { CAST } from '../data/cast';
import { ROSTER, type FighterDef } from '../data/roster';
import { altCostume } from '../render/costume';
import { statsAt, type BattleSetup, type BattleState, type ItemSlot, type UnitSetup } from '../rules/battle';
import { CLASSES, type ClassId } from '../rules/classes';
import { item } from '../rules/items';
import { profileOf, PROFILES } from '../rules/profiles';
import { kitFor } from '../rules/teams';
import type { Growths, Stats } from '../rules/types';
import { loadSupports } from './profileStore';

/** a friend of the crew, as it carries over from chapter to chapter */
export interface CampaignUnit {
  defId: string;
  cls: ClassId;
  level: number;
  exp: number;
  stats: Stats;
  growth: Growths;
  items: ItemSlot[];
}

export interface CampaignSave {
  v: 1;
  /** classique: a friend who falls is gone for good · décontracté: they come back next chapter */
  mode: 'classic' | 'casual';
  /** next chapter to play */
  chapter: number;
  /** the next chapter's intro has been seen / the last outro is still to show */
  stage: 'intro' | 'battle' | 'outro';
  units: CampaignUnit[];
  fallen: string[];
  done: boolean;
}

const KEY = 'bbltactics.campaign';

export function loadCampaign(): CampaignSave | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as CampaignSave;
    return s?.v === 1 ? s : null;
  } catch {
    return null;
  }
}

export function saveCampaign(s: CampaignSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function newCampaign(mode: CampaignSave['mode']): CampaignSave {
  const s: CampaignSave = { v: 1, mode, chapter: 0, stage: 'intro', units: [], fallen: [], done: false };
  saveCampaign(s);
  return s;
}

/** a friend joining the crew */
function recruit(id: string, level: number): CampaignUnit {
  const prof = profileOf(id);
  const cls = prof.cls;
  return {
    defId: id,
    cls,
    level,
    exp: 0,
    stats: statsAt(id, cls, level),
    growth: { ...prof.growth },
    items: kitFor(id, cls, level).map((i) => ({ id: i, uses: item(i).uses })),
  };
}

/** adds the chapter's recruits (once) */
export function addRecruits(save: CampaignSave, ch: Chapter) {
  for (const r of ch.recruits) {
    if (save.units.some((u) => u.defId === r.id) || save.fallen.includes(r.id)) continue;
    save.units.push(recruit(r.id, r.level));
  }
}

/** look of a talk speaker: a friend, a cast member, a fake (alternate colours) */
export function speakerLook(id: string): { def: FighterDef | null; name: string } {
  if (id === 'narrateur') return { def: null, name: '' };
  if (id.startsWith('faux:')) {
    const base = id.slice(5);
    const d = ROSTER.find((x) => x.id === base) ?? CAST[base];
    if (!d) return { def: null, name: 'FAUX ???' };
    if (CAST[base]) return { def: d, name: base === 'mihai_ssj' ? 'MIHAÏ ULTIME' : d.name };
    return { def: altCostume(d), name: 'FAUX ' + d.name };
  }
  const d = ROSTER.find((x) => x.id === id) ?? CAST[id];
  return { def: d ?? null, name: id === 'doc' ? 'LE DOC' : (d?.name ?? id.toUpperCase()) };
}

/** the battle of a chapter */
export function chapterSetup(save: CampaignSave, i: number): BattleSetup {
  const ch = CAMPAIGN[i];
  const crew: UnitSetup[] = save.units.map((u) => {
    // a fresh basic weapon for anyone left empty-handed, a drink each chapter
    const items = u.items.filter((s) => s.uses > 0).slice(0, 5);
    const c = CLASSES[u.cls];
    if (!items.some((s) => item(s.id).kind === 'weapon' || item(s.id).kind === 'staff')) {
      const basic = kitFor(u.defId, u.cls, 1)[0];
      if (basic) items.unshift({ id: basic, uses: item(basic).uses });
    }
    if (items.length < 5 && !items.some((s) => item(s.id).kind === 'heal')) items.push({ id: 'canette', uses: 3 });
    void c;
    return {
      defId: u.defId,
      name: (ROSTER.find((d) => d.id === u.defId)?.name ?? u.defId).toUpperCase(),
      cls: u.cls,
      level: u.level,
      exp: u.exp,
      stats: { ...u.stats },
      growth: { ...u.growth },
      items: items.map((s) => s.id),
      uses: items.map((s) => s.uses),
      leader: u.defId === 'mihai',
    };
  });
  // Mihaï first (he's the chef), then by level
  crew.sort((a, b) => Number(b.leader) - Number(a.leader) || b.level - a.level);
  const foes: UnitSetup[] = ch.enemies.map((e) => {
    const look = ROSTER.find((d) => d.id === e.defId) ?? CAST[e.defId];
    return {
      ...e,
      name: e.name ?? ('FAUX ' + (look?.name ?? e.defId.toUpperCase())).slice(0, 14),
      growth: e.growth ?? (PROFILES[e.defId] ? undefined : { ...CLASSES[e.cls].growth }),
    } as UnitSetup;
  });
  return {
    mapId: ch.mapId,
    teams: [
      { name: 'LA BANDE', units: crew, supports: loadSupports() },
      { name: 'FAUX POTES', units: foes },
    ],
    objective: { ...ch.objective, lord: 0 },
    fog: false,
    seed: Math.floor(Math.random() * 2 ** 31),
    first: 0,
  };
}

/** after a battle: progress of the crew (won) or nothing (lost: the chapter is replayed) */
export function applyChapterResult(save: CampaignSave, state: BattleState): boolean {
  const won = state.winner === 0;
  if (!won) {
    save.stage = 'battle';
    saveCampaign(save);
    return false;
  }
  for (const u of state.units.filter((x) => x.team === 0)) {
    const cu = save.units.find((x) => x.defId === u.defId);
    if (!cu) continue;
    if (!u.alive && save.mode === 'classic' && u.defId !== 'mihai') {
      save.fallen.push(u.defId);
      save.units = save.units.filter((x) => x !== cu);
      continue;
    }
    cu.cls = u.cls;
    cu.level = u.level;
    cu.exp = u.exp;
    cu.stats = { ...u.stats };
    cu.items = u.items.map((s) => ({ ...s }));
  }
  // rewards: to the best levels with room in their bag
  const ch = CAMPAIGN[save.chapter];
  for (const r of ch.rewards ?? []) {
    const who = [...save.units].sort((a, b) => b.level + (CLASSES[b.cls].tier - 1) * 20 - (a.level + (CLASSES[a.cls].tier - 1) * 20)).find((u) => u.items.length < 5 && !(r === 'diplome' && (CLASSES[u.cls].tier === 2 || u.items.some((s) => s.id === 'diplome'))));
    if (who) who.items.push({ id: r, uses: item(r).uses });
  }
  save.stage = 'outro';
  saveCampaign(save);
  return true;
}

/** the outro has been seen: next chapter */
export function nextChapter(save: CampaignSave) {
  save.chapter++;
  save.stage = 'intro';
  if (save.chapter >= CAMPAIGN.length) {
    save.done = true;
    save.chapter = CAMPAIGN.length;
  }
  saveCampaign(save);
}
