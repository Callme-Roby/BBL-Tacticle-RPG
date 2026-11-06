import { CLASSES, type ClassId } from './classes';
import type { Growths, Stats } from './types';

/**
 * Tactical profile of a friend: starting class, level-1 stats and growth
 * rates (% chance for each stat to rise on a level up, GBA style).
 * Matched to their BBL FIGHTERZ profile:
 *  heavy → axe fighters / armour, fast → sword speedsters / thief,
 *  ranged → archer / mages, balanced → swordsmen / cavalier, + a healer and a flier.
 * Tuned with the balance simulator (npm run balance, see scripts/balance.ts).
 */
export interface TacticsProfile {
  cls: ClassId;
  base: Stats;
  growth: Growths;
  /** weapons / items by rank: [rank 1 kit, rank 2 additions, advanced additions] */
  kit: [string[], string[], string[]];
  /** short French line describing their play style */
  style: string;
}

const S = (hp: number, pow: number, skl: number, spd: number, lck: number, def: number, res: number, con: number, mov: number): Stats => ({ hp, pow, skl, spd, lck, def, res, con, mov });
const G = (hp: number, pow: number, skl: number, spd: number, lck: number, def: number, res: number): Growths => ({ hp, pow, skl, spd, lck, def, res });

export const PROFILES: Record<string, TacticsProfile> = {
  dylan: {
    cls: 'cogneur',
    base: S(25, 7, 4, 4, 3, 5, 0, 12, 5),
    growth: G(90, 55, 30, 25, 30, 30, 10),
    kit: [['hachette', 'hache_boomerang'], ['marteau'], ['hache_bling']],
    style: 'Petit format, gros dégâts : il encaisse et il cogne.',
  },
  isis: {
    cls: 'cogneur',
    base: S(23, 6, 5, 6, 4, 4, 1, 11, 5),
    growth: G(85, 50, 35, 35, 35, 25, 15),
    kit: [['hachette', 'hache_boomerang'], ['tronconneuse'], ['hache_bling']],
    style: 'Hache XXL, critiques XXL.',
  },
  elies: {
    cls: 'mur',
    base: S(22, 6, 4, 3, 3, 10, 1, 13, 4),
    growth: G(80, 45, 35, 20, 30, 50, 15),
    kit: [['manche_balai', 'javelot_dimanche'], ['brochette'], ['lance_bling']],
    style: 'La moustache tient la ligne. Rien ne passe.',
  },
  matteo: {
    cls: 'mur',
    base: S(21, 7, 5, 2, 4, 9, 0, 14, 4),
    growth: G(85, 50, 30, 15, 35, 45, 10),
    kit: [['manche_balai', 'javelot_dimanche'], ['chasse_kebab'], ['harpon']],
    style: 'Solide sur les appareils, solide sur la carte.',
  },
  rayan: {
    cls: 'bagarreur',
    base: S(20, 5, 7, 8, 5, 5, 2, 9, 5),
    growth: G(80, 45, 45, 45, 40, 25, 20),
    kit: [['epee_rouillee', 'canette'], ['epee_chromee'], ['epee_bling']],
    style: 'Pacifiste… avec une épée. Équilibré partout.',
  },
  aroa: {
    cls: 'bagarreur',
    base: S(19, 5, 8, 9, 6, 4, 2, 7, 5),
    growth: G(75, 40, 50, 55, 45, 20, 20),
    kit: [['couteau_kebab', 'epee_rouillee'], ['la_fourbe'], ['double_lame']],
    style: 'Enchaîne les coups : elle double presque tout le monde.',
  },
  zia: {
    cls: 'lame',
    base: S(18, 5, 9, 11, 4, 3, 1, 8, 5),
    growth: G(70, 40, 50, 55, 35, 20, 20),
    kit: [['couteau_kebab', 'epee_rouillee'], ['la_fourbe'], ['epee_bling']],
    style: 'Punchlines rapides, critiques qui piquent.',
  },
  thomas: {
    cls: 'filou',
    base: S(17, 4, 7, 12, 8, 3, 2, 6, 6),
    growth: G(65, 35, 45, 60, 50, 15, 25),
    kit: [['couteau_kebab', 'canette'], ['ouvre_boite'], ['la_fourbe']],
    style: '« Regarde derrière toi ! » Vole, esquive, s’enfuit.',
  },
  mihai: {
    cls: 'livreur',
    base: S(20, 6, 6, 7, 7, 6, 2, 9, 7),
    growth: G(75, 40, 40, 40, 50, 25, 20),
    kit: [['epee_rouillee', 'manche_balai'], ['javelot_dimanche'], ['lance_bling']],
    style: 'Le sourire qui fait mal, livré à domicile à cheval.',
  },
  clement: {
    cls: 'pyromane',
    base: S(17, 7, 7, 6, 3, 3, 5, 7, 5),
    growth: G(60, 55, 45, 40, 30, 15, 35),
    kit: [['briquet'], ['grenade_barbue'], ['meteore']],
    style: 'Calme, barbu, il lance des grenades de feu à 2 cases.',
  },
  billel: {
    cls: 'gourou',
    base: S(18, 7, 6, 4, 2, 3, 6, 8, 5),
    growth: G(65, 55, 45, 30, 25, 20, 40),
    kit: [['patch_notes'], ['ponction'], ['nerf']],
    style: 'Il explique la méta jusqu’à ce que l’ennemi s’effondre.',
  },
  enola: {
    cls: 'tireur',
    base: S(18, 6, 9, 7, 4, 4, 2, 7, 5),
    growth: G(70, 45, 55, 40, 35, 20, 20),
    kit: [['arc_plastique'], ['arc_sniper'], ['arc_bling']],
    style: 'Lunettes noires, sang-froid, flèches à 2 cases.',
  },
  alex: {
    cls: 'pilote',
    base: S(18, 5, 6, 9, 5, 4, 6, 6, 7),
    growth: G(65, 40, 40, 50, 40, 20, 35),
    kit: [['manche_balai', 'javelot_dimanche'], ['brochette'], ['lance_bling']],
    style: 'Le Doc lui a prêté sa soucoupe. Attention aux arcs.',
  },
  benji: {
    cls: 'infirmier',
    base: S(17, 5, 5, 8, 7, 2, 7, 6, 5),
    growth: G(60, 50, 35, 50, 50, 15, 45),
    kit: [['pansement', 'canette'], ['soin_wifi'], ['trousse']],
    style: '« C’est quoi ta config ? » Il répare tout le monde.',
  },
};

/** Profile of any fighter: a friend's own, or the generic one of a class (lab creations). */
export function profileOf(defId: string, cls?: ClassId): TacticsProfile {
  const p = PROFILES[defId];
  if (p && (!cls || cls === p.cls)) return p;
  const c = CLASSES[cls ?? p?.cls ?? 'bagarreur'];
  return {
    cls: c.id,
    base: { ...c.base },
    growth: { ...c.growth },
    kit: genericKit(c.id),
    style: c.desc,
  };
}

/** default weapons of a class (lab creations) */
export function genericKit(cls: ClassId): [string[], string[], string[]] {
  const w = CLASSES[cls].weapons[0];
  switch (w) {
    case 'sword':
      return [['epee_rouillee', 'canette'], ['epee_chromee'], ['epee_bling']];
    case 'lance':
      return [['manche_balai', 'javelot_dimanche'], ['brochette'], ['lance_bling']];
    case 'axe':
      return [['hachette', 'hache_boomerang'], ['hache_bucheron'], ['hache_bling']];
    case 'bow':
      return [['arc_plastique'], ['arc_compound'], ['arc_bling']];
    case 'anima':
      return [['briquet'], ['grenade_barbue'], ['meteore']];
    case 'light':
      return [['lampe_torche'], ['flash_selfie'], ['neon_sacre']];
    case 'dark':
      return [['patch_notes'], ['tier_list'], ['nerf']];
    case 'staff':
      return [['pansement', 'canette'], ['soin_wifi'], ['trousse']];
  }
}
