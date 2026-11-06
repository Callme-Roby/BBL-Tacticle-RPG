import type { UnitSetup } from './battle';
import { CLASSES, type ClassId } from './classes';
import { item } from './items';
import { genericKit, profileOf, PROFILES } from './profiles';

/** Skirmish formats: level of the teams (stats from the average growths). */
export interface Format {
  id: string;
  name: string;
  desc: string;
  level: number;
  /** advanced classes (promoted at level 10 of the base class) */
  promoted: boolean;
}

export const FORMATS: Format[] = [
  { id: 'recrues', name: 'RECRUES', desc: 'Niveau 5, armes de base et premières armes spéciales.', level: 5, promoted: false },
  { id: 'confirmes', name: 'CONFIRMÉS', desc: 'Niveau 10, armes avancées, un Diplôme BBL pour promouvoir.', level: 10, promoted: false },
  { id: 'elite', name: 'ÉLITE', desc: 'Classes avancées niveau 5, armes de luxe.', level: 5, promoted: true },
];

/**
 * Weapons and items of a unit for its class and level: the rank-1 kit, the
 * rank-2 one from level 5 (or promoted), the advanced one when promoted.
 * Advanced classes that gain a weapon type get a basic weapon of that type.
 */
export function kitFor(defId: string, cls: ClassId, level: number, extras: string[] = []): string[] {
  const c = CLASSES[cls];
  const prof = profileOf(defId, c.tier === 1 ? cls : undefined);
  const kit = PROFILES[defId]?.kit ?? prof.kit;
  const out: string[] = [];
  const add = (id: string) => {
    if (out.length >= 5 || out.includes(id)) return;
    out.push(id);
  };
  if (c.tier === 2) for (const id of kit[2]) add(id);
  if (c.tier === 2 || level >= 5) for (const id of kit[1]) add(id);
  for (const id of kit[0]) add(id);
  // new weapon types of an advanced class
  if (c.tier === 2) {
    for (const t of c.weapons) {
      if (out.some((id) => item(id).type === t)) continue;
      const g = genericKit(Object.values(CLASSES).find((x) => x.tier === 1 && x.weapons[0] === t)?.id ?? 'bagarreur');
      add(g[0][0]);
    }
  }
  for (const e of extras) add(e);
  // keep the weapons the class can use first, then the rest
  return out.filter((id) => {
    const it = item(id);
    return it.kind !== 'weapon' && it.kind !== 'staff' ? true : !!it.type && c.weapons.includes(it.type);
  });
}

/** the class a friend plays in a format (advanced: the first of the two promotions unless chosen) */
export function classFor(defId: string, promoted: boolean, choice = 0, labClass?: string): ClassId {
  const base = (labClass && labClass in CLASSES ? labClass : PROFILES[defId]?.cls ?? 'bagarreur') as ClassId;
  const b = CLASSES[base].tier === 1 ? base : base;
  if (!promoted) return b;
  return CLASSES[b].promotesTo?.[choice] ?? b;
}

/** builds the unit list of a skirmish team */
export function skirmishTeam(picks: { defId: string; name: string; lab?: string; promo?: number; alt?: boolean; leader?: boolean }[], format: Format): UnitSetup[] {
  return picks.map((p, i) => {
    const cls = classFor(p.defId, format.promoted, p.promo ?? 0, p.lab);
    const extras = format.id === 'confirmes' ? ['diplome'] : [];
    return {
      defId: p.defId,
      name: p.name,
      cls,
      level: format.level,
      items: kitFor(p.defId, cls, format.level, extras),
      leader: p.leader ?? i === 0,
      alt: p.alt,
      growth: p.lab ? { ...profileOf(p.defId, cls).growth } : undefined,
    };
  });
}
