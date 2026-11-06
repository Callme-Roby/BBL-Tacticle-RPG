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
    base: S(29, 7, 5, 4, 2, 5, 5, 12, 5),
    growth: G(100, 60, 35, 35, 50, 10, 35),
    kit: [['hachette', 'hache_boomerang'], ['marteau'], ['arc_bling']],
    style: 'Petit format, gros dégâts : il encaisse et il cogne.',
  },
  isis: {
    cls: 'cogneur',
    base: S(25, 6, 3, 6, 1, 3, 1, 11, 5),
    growth: G(100, 65, 25, 30, 35, 20, 30),
    kit: [['hachette', 'hache_boomerang'], ['tronconneuse'], ['arc_bling']],
    style: 'Hache XXL, critiques XXL.',
  },
  elies: {
    cls: 'mur',
    base: S(25, 6, 2, 3, 3, 8, 1, 13, 4),
    growth: G(95, 45, 50, 25, 35, 60, 25),
    kit: [['manche_balai', 'javelot_dimanche'], ['brochette'], ['harpon']],
    style: 'La moustache tient la ligne. Rien ne passe.',
  },
  matteo: {
    cls: 'mur',
    base: S(22, 9, 5, 1, 6, 7, 1, 14, 4),
    growth: G(80, 60, 50, 15, 25, 50, 5),
    kit: [['manche_balai', 'javelot_dimanche'], ['chasse_kebab'], ['harpon']],
    style: 'Solide sur les appareils, solide sur la carte.',
  },
  rayan: {
    cls: 'bagarreur',
    base: S(20, 5, 6, 8, 6, 6, 1, 9, 5),
    growth: G(85, 55, 30, 55, 35, 15, 25),
    kit: [['couteau_kebab', 'canette'], ['epee_chromee'], ['hache_bling']],
    style: 'Pacifiste… avec une épée. Équilibré partout.',
  },
  aroa: {
    cls: 'bagarreur',
    base: S(19, 5, 7, 8, 6, 3, 0, 7, 5),
    growth: G(65, 30, 45, 50, 50, 15, 15),
    kit: [['couteau_kebab', 'epee_rouillee'], ['epee_wifi'], ['lance_bling']],
    style: 'Enchaîne les coups : elle double presque tout le monde.',
  },
  zia: {
    cls: 'lame',
    base: S(14, 4, 9, 12, 0, 2, 0, 8, 5),
    growth: G(60, 45, 45, 45, 20, 5, 10),
    kit: [['couteau_kebab', 'epee_rouillee'], ['la_fourbe'], ['epee_bling']],
    style: 'Punchlines rapides, critiques qui piquent.',
  },
  thomas: {
    cls: 'filou',
    base: S(19, 5, 8, 12, 7, 4, 7, 6, 6),
    growth: G(50, 25, 30, 45, 35, 10, 10),
    kit: [['epee_rouillee', 'canette'], ['ouvre_boite'], ['double_lame']],
    style: '« Regarde derrière toi ! » Vole, esquive, s’enfuit.',
  },
  mihai: {
    cls: 'livreur',
    base: S(20, 5, 5, 6, 7, 5, 1, 9, 7),
    growth: G(80, 45, 50, 40, 45, 20, 20),
    kit: [['couteau_kebab', 'manche_balai'], ['javelot_dimanche'], ['arc_bling']],
    style: 'Le sourire qui fait mal, livré à domicile à cheval.',
  },
  clement: {
    cls: 'pyromane',
    base: S(17, 7, 6, 6, 3, 3, 3, 7, 5),
    growth: G(80, 55, 45, 45, 20, 15, 25),
    kit: [['briquet'], ['grenade_barbue'], ['meteore']],
    style: 'Calme, barbu, il lance des grenades de feu à 2 cases.',
  },
  billel: {
    cls: 'gourou',
    base: S(18, 7, 8, 5, 2, 3, 7, 8, 5),
    growth: G(85, 55, 45, 25, 15, 35, 45),
    kit: [['patch_notes'], ['tier_list'], ['meteore']],
    style: 'Il explique la méta jusqu’à ce que l’ennemi s’effondre.',
  },
  enola: {
    cls: 'tireur',
    base: S(16, 6, 8, 7, 4, 5, 3, 7, 5),
    growth: G(40, 45, 55, 40, 20, 10, 20),
    kit: [['arc_plastique'], ['arc_sniper'], ['arc_bling']],
    style: 'Lunettes noires, sang-froid, flèches à 2 cases.',
  },
  alex: {
    cls: 'pilote',
    base: S(16, 5, 10, 12, 5, 2, 7, 6, 7),
    growth: G(65, 45, 55, 50, 30, 10, 30),
    kit: [['manche_balai', 'javelot_dimanche'], ['brochette'], ['harpon']],
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
