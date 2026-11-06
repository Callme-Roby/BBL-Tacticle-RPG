import type { GrowKey, Growths, MoveType, Stats, UnitTag, WeaponType } from './types';

export type ClassId =
  // base classes
  | 'bagarreur'
  | 'lame'
  | 'filou'
  | 'cogneur'
  | 'mur'
  | 'livreur'
  | 'tireur'
  | 'pyromane'
  | 'gourou'
  | 'illumine'
  | 'infirmier'
  | 'pilote'
  // advanced classes
  | 'champion'
  | 'gladiateur'
  | 'sabreur'
  | 'ninja'
  | 'ombre'
  | 'arnaqueur'
  | 'demolisseur'
  | 'grosbras'
  | 'forteresse'
  | 'tank'
  | 'paladin'
  | 'ranger'
  | 'sniper'
  | 'archer_monte'
  | 'archimage'
  | 'motard'
  | 'grandgourou'
  | 'influenceur'
  | 'predicateur'
  | 'neonrider'
  | 'urgentiste'
  | 'ambulancier'
  | 'as'
  | 'dragon';

/** How the unit looks on the map / in fights (mount, armour). */
export type ClassLook = 'foot' | 'armor' | 'horse' | 'flier';

export interface ClassDef {
  id: ClassId;
  name: string;
  tier: 1 | 2;
  move: MoveType;
  look: ClassLook;
  /** movement points */
  mov: number;
  weapons: WeaponType[];
  /** what this class counts as for "effective" weapons */
  tags: UnitTag[];
  /** class critical bonus (sword masters, berserkers, snipers) */
  crit: number;
  /** POW reads MAG (magic users) */
  magic: boolean;
  /** base classes: the two possible promotions */
  promotesTo?: [ClassId, ClassId];
  /** advanced classes: stats gained on promotion */
  promo?: Partial<Stats>;
  /** stat caps */
  caps: Stats;
  /** generic level-1 stats (lab creations, generic units) */
  base: Stats;
  /** generic growths (%) */
  growth: Growths;
  /** extra vision in the fog */
  vision: number;
  /** can steal an item from a slower enemy (no weapon in hand) */
  steal?: boolean;
  /** one-line description (French, shown in the class sheet) */
  desc: string;
}

const S = (hp: number, pow: number, skl: number, spd: number, lck: number, def: number, res: number, con: number, mov: number): Stats => ({ hp, pow, skl, spd, lck, def, res, con, mov });
const G = (hp: number, pow: number, skl: number, spd: number, lck: number, def: number, res: number): Growths => ({ hp, pow, skl, spd, lck, def, res });
const CAP1 = S(60, 20, 20, 20, 30, 20, 20, 20, 15);
const cap2 = (pow: number, skl: number, spd: number, def: number, res: number, con = 20): Stats => S(60, pow, skl, spd, 30, def, res, con, 15);

function base(o: Omit<ClassDef, 'tier' | 'caps' | 'vision' | 'crit'> & { crit?: number; vision?: number }): ClassDef {
  return { tier: 1, caps: CAP1, crit: 0, vision: 0, ...o };
}
function adv(o: Omit<ClassDef, 'tier' | 'base' | 'growth' | 'vision' | 'crit'> & { crit?: number; vision?: number }, from: ClassId): ClassDef {
  // generic stats of an advanced class = its base class's (filled in below)
  return { tier: 2, crit: 0, vision: 0, base: S(0, 0, 0, 0, 0, 0, 0, 0, 0), growth: G(0, 0, 0, 0, 0, 0, 0), ...o, _from: from } as ClassDef;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  // ------------------------------------------------------------------ base
  bagarreur: base({
    id: 'bagarreur', name: 'Bagarreur', move: 'foot', look: 'foot', mov: 5, weapons: ['sword'], tags: [], magic: false,
    promotesTo: ['champion', 'gladiateur'],
    base: S(20, 5, 7, 7, 3, 5, 1, 9, 5), growth: G(80, 45, 40, 40, 30, 25, 20),
    desc: "Épéiste de rue, solide partout. Gants de boxe en option, lame obligatoire.",
  }),
  lame: base({
    id: 'lame', name: 'Lame Express', move: 'foot', look: 'foot', mov: 5, weapons: ['sword'], tags: [], magic: false,
    promotesTo: ['sabreur', 'ninja'],
    base: S(17, 4, 9, 11, 4, 3, 1, 6, 5), growth: G(70, 35, 45, 55, 40, 20, 25),
    desc: 'Rapide comme une livraison en retard. Frappe deux fois avant que tu dises « attends ».',
  }),
  filou: base({
    id: 'filou', name: 'Filou', move: 'foot', look: 'foot', mov: 6, weapons: ['sword'], tags: [], magic: false, steal: true, vision: 3,
    promotesTo: ['ombre', 'arnaqueur'],
    base: S(16, 3, 6, 11, 8, 2, 1, 6, 6), growth: G(65, 30, 40, 60, 50, 15, 20),
    desc: 'Vole un objet à un ennemi plus lent. Voit plus loin dans le brouillard.',
  }),
  cogneur: base({
    id: 'cogneur', name: 'Cogneur', move: 'foot', look: 'foot', mov: 5, weapons: ['axe'], tags: [], magic: false,
    promotesTo: ['demolisseur', 'grosbras'],
    base: S(24, 7, 4, 5, 2, 4, 0, 11, 5), growth: G(90, 55, 30, 30, 25, 20, 10),
    desc: 'Beaucoup de PV, beaucoup de dégâts, un peu moins de précision.',
  }),
  mur: base({
    id: 'mur', name: 'Mur Porteur', move: 'armor', look: 'armor', mov: 4, weapons: ['lance'], tags: ['armor'], magic: false,
    promotesTo: ['forteresse', 'tank'],
    base: S(21, 6, 4, 2, 2, 10, 0, 13, 4), growth: G(85, 45, 35, 15, 25, 50, 10),
    desc: 'Défense énorme, mobilité de frigo. Craint la magie et les ouvre-boîtes.',
  }),
  livreur: base({
    id: 'livreur', name: 'Livreur à Cheval', move: 'horse', look: 'horse', mov: 7, weapons: ['sword', 'lance'], tags: ['horse'], magic: false,
    promotesTo: ['paladin', 'ranger'],
    base: S(20, 6, 5, 6, 3, 6, 1, 9, 7), growth: G(75, 40, 35, 40, 35, 25, 20),
    desc: 'Livre des coups dans les 30 minutes. Déteste les forêts et les piques.',
  }),
  tireur: base({
    id: 'tireur', name: 'Tireur', move: 'foot', look: 'foot', mov: 5, weapons: ['bow'], tags: [], magic: false,
    promotesTo: ['sniper', 'archer_monte'],
    base: S(18, 5, 8, 6, 3, 4, 1, 7, 5), growth: G(70, 40, 50, 35, 35, 20, 20),
    desc: 'Tire à 2 cases sans riposte. Ne peut pas répondre au corps à corps.',
  }),
  pyromane: base({
    id: 'pyromane', name: 'Pyromane', move: 'foot', look: 'foot', mov: 5, weapons: ['anima'], tags: [], magic: true,
    promotesTo: ['archimage', 'motard'],
    base: S(16, 6, 6, 6, 3, 2, 5, 6, 5), growth: G(60, 55, 40, 40, 30, 10, 35),
    desc: 'Magie anima (feu, foudre, vent). Bat la lumière, perd contre les ténèbres.',
  }),
  gourou: base({
    id: 'gourou', name: 'Gourou', move: 'foot', look: 'foot', mov: 5, weapons: ['dark'], tags: [], magic: true,
    promotesTo: ['grandgourou', 'influenceur'],
    base: S(18, 6, 5, 4, 1, 3, 6, 8, 5), growth: G(70, 55, 40, 25, 20, 20, 35),
    desc: 'Magie des ténèbres : lourde mais puissante. Bat l’anima, perd contre la lumière.',
  }),
  illumine: base({
    id: 'illumine', name: 'Illuminé', move: 'foot', look: 'foot', mov: 5, weapons: ['light'], tags: [], magic: true,
    promotesTo: ['predicateur', 'neonrider'],
    base: S(17, 5, 6, 6, 6, 2, 7, 6, 5), growth: G(60, 45, 40, 40, 45, 10, 45),
    desc: 'Magie de lumière, précise. Bat les ténèbres, perd contre l’anima.',
  }),
  infirmier: base({
    id: 'infirmier', name: 'Infirmier', move: 'foot', look: 'foot', mov: 5, weapons: ['staff'], tags: [], magic: true,
    promotesTo: ['urgentiste', 'ambulancier'],
    base: S(16, 5, 5, 6, 6, 1, 7, 5, 5), growth: G(55, 50, 35, 45, 50, 10, 50),
    desc: 'Soigne avec ses bâtons. Ne se bat pas : protège-le !',
  }),
  pilote: base({
    id: 'pilote', name: 'Pilote de Soucoupe', move: 'flier', look: 'flier', mov: 7, weapons: ['lance'], tags: ['flier'], magic: false,
    promotesTo: ['as', 'dragon'],
    base: S(17, 5, 6, 9, 5, 3, 5, 5, 7), growth: G(65, 35, 40, 50, 40, 15, 35),
    desc: 'Survole tout le terrain. Les arcs lui font très, très mal.',
  }),
  // ------------------------------------------------------------------ advanced
  champion: adv({
    id: 'champion', name: 'Champion de Quartier', move: 'foot', look: 'foot', mov: 6, weapons: ['sword', 'axe'], tags: [], magic: false,
    promo: { hp: 4, pow: 2, skl: 2, spd: 2, def: 2, res: 2, con: 1, mov: 1 }, caps: cap2(25, 30, 26, 25, 22),
    desc: 'Épée et hache : le patron du quartier.',
  }, 'bagarreur'),
  gladiateur: adv({
    id: 'gladiateur', name: 'Gladiateur', move: 'foot', look: 'foot', mov: 6, weapons: ['sword', 'lance'], tags: [], magic: false,
    promo: { hp: 5, pow: 2, skl: 1, spd: 1, def: 3, res: 1, con: 2, mov: 1 }, caps: cap2(26, 27, 25, 27, 21),
    desc: 'Épée et lance, plus encaisseur.',
  }, 'bagarreur'),
  sabreur: adv({
    id: 'sabreur', name: 'Sabreur Zen', move: 'foot', look: 'foot', mov: 6, weapons: ['sword'], tags: [], magic: false, crit: 15,
    promo: { hp: 5, pow: 2, skl: 2, spd: 1, def: 2, res: 1, con: 1, mov: 1 }, caps: cap2(24, 29, 30, 22, 23),
    desc: '+15 % de critique. Respire. Tranche.',
  }, 'lame'),
  ninja: adv({
    id: 'ninja', name: 'Ninja du Bled', move: 'foot', look: 'foot', mov: 7, weapons: ['sword', 'bow'], tags: [], magic: false, crit: 5, vision: 2,
    promo: { hp: 4, pow: 1, skl: 2, spd: 2, def: 1, res: 2, con: 1, mov: 2 }, caps: cap2(23, 28, 30, 21, 25),
    desc: 'Épée et arc, très mobile.',
  }, 'lame'),
  ombre: adv({
    id: 'ombre', name: 'Ombre', move: 'foot', look: 'foot', mov: 7, weapons: ['sword'], tags: [], magic: false, crit: 15, steal: true, vision: 4,
    promo: { hp: 4, pow: 2, skl: 2, spd: 1, def: 2, res: 2, con: 1, mov: 1 }, caps: cap2(22, 29, 30, 21, 24),
    desc: '+15 % de critique, vole, voit loin.',
  }, 'filou'),
  arnaqueur: adv({
    id: 'arnaqueur', name: 'Arnaqueur', move: 'foot', look: 'foot', mov: 7, weapons: ['sword', 'staff'], tags: [], magic: false, steal: true, vision: 3,
    promo: { hp: 4, pow: 1, skl: 2, spd: 1, def: 1, res: 3, con: 1, mov: 1 }, caps: cap2(22, 27, 29, 20, 26),
    desc: 'Épée et bâtons : vole le matin, soigne l’après-midi.',
  }, 'filou'),
  demolisseur: adv({
    id: 'demolisseur', name: 'Démolisseur', move: 'foot', look: 'foot', mov: 6, weapons: ['axe'], tags: [], magic: false, crit: 15,
    promo: { hp: 5, pow: 2, skl: 2, spd: 1, def: 2, res: 1, con: 2, mov: 1 }, caps: cap2(29, 27, 25, 23, 20),
    desc: '+15 % de critique. Rase les murs, porteurs ou pas.',
  }, 'cogneur'),
  grosbras: adv({
    id: 'grosbras', name: 'Gros Bras', move: 'foot', look: 'foot', mov: 6, weapons: ['axe', 'bow'], tags: [], magic: false,
    promo: { hp: 6, pow: 2, skl: 2, spd: 1, def: 2, res: 1, con: 3, mov: 1 }, caps: cap2(30, 27, 23, 25, 20),
    desc: 'Hache et arc : frappe de près comme de loin.',
  }, 'cogneur'),
  forteresse: adv({
    id: 'forteresse', name: 'Forteresse', move: 'armor', look: 'armor', mov: 5, weapons: ['lance', 'axe'], tags: ['armor'], magic: false,
    promo: { hp: 5, pow: 2, skl: 2, spd: 2, def: 3, res: 3, con: 2, mov: 1 }, caps: cap2(28, 26, 22, 30, 25, 25),
    desc: 'Lance et hache. Le mur porteur est devenu immeuble.',
  }, 'mur'),
  tank: adv({
    id: 'tank', name: 'Chevalier Tank', move: 'horse', look: 'horse', mov: 6, weapons: ['sword', 'lance', 'axe'], tags: ['armor', 'horse'], magic: false,
    promo: { hp: 4, pow: 2, skl: 1, spd: 2, def: 2, res: 1, con: 2, mov: 2 }, caps: cap2(27, 25, 23, 28, 21, 25),
    desc: 'Une armure sur un cheval. Trois armes, deux faiblesses.',
  }, 'mur'),
  paladin: adv({
    id: 'paladin', name: 'Paladin du Kebab', move: 'horse', look: 'horse', mov: 8, weapons: ['sword', 'lance', 'axe'], tags: ['horse'], magic: false,
    promo: { hp: 3, pow: 2, skl: 1, spd: 1, def: 2, res: 3, con: 2, mov: 1 }, caps: cap2(25, 26, 24, 25, 25),
    desc: 'Épée, lance, hache. Livraison en armure dorée.',
  }, 'livreur'),
  ranger: adv({
    id: 'ranger', name: 'Ranger', move: 'horse', look: 'horse', mov: 8, weapons: ['sword', 'bow'], tags: ['horse'], magic: false,
    promo: { hp: 3, pow: 1, skl: 2, spd: 2, def: 1, res: 2, con: 1, mov: 1 }, caps: cap2(24, 28, 28, 22, 24),
    desc: 'Épée et arc, à cheval.',
  }, 'livreur'),
  sniper: adv({
    id: 'sniper', name: 'Sniper', move: 'foot', look: 'foot', mov: 6, weapons: ['bow'], tags: [], magic: false, crit: 15,
    promo: { hp: 4, pow: 2, skl: 2, spd: 2, def: 2, res: 2, con: 1, mov: 1 }, caps: cap2(25, 30, 28, 24, 23),
    desc: '+15 % de critique à l’arc.',
  }, 'tireur'),
  archer_monte: adv({
    id: 'archer_monte', name: 'Archer Monté', move: 'horse', look: 'horse', mov: 8, weapons: ['bow', 'sword'], tags: ['horse'], magic: false,
    promo: { hp: 3, pow: 1, skl: 2, spd: 2, def: 1, res: 2, con: 2, mov: 3 }, caps: cap2(24, 29, 28, 22, 23),
    desc: 'Arc et épée, à cheval.',
  }, 'tireur'),
  archimage: adv({
    id: 'archimage', name: 'Archimage', move: 'foot', look: 'foot', mov: 6, weapons: ['anima', 'staff'], tags: [], magic: true,
    promo: { hp: 4, pow: 2, skl: 2, spd: 1, def: 2, res: 3, con: 1, mov: 1 }, caps: cap2(30, 28, 26, 21, 28),
    desc: 'Anima et bâtons.',
  }, 'pyromane'),
  motard: adv({
    id: 'motard', name: 'Mage Motard', move: 'horse', look: 'horse', mov: 8, weapons: ['anima', 'staff'], tags: ['horse'], magic: true,
    promo: { hp: 4, pow: 1, skl: 2, spd: 2, def: 2, res: 2, con: 2, mov: 3 }, caps: cap2(27, 26, 26, 22, 26),
    desc: 'Anima et bâtons, à toute vitesse.',
  }, 'pyromane'),
  grandgourou: adv({
    id: 'grandgourou', name: 'Grand Gourou', move: 'foot', look: 'foot', mov: 6, weapons: ['dark', 'anima', 'staff'], tags: [], magic: true,
    promo: { hp: 4, pow: 2, skl: 2, spd: 2, def: 2, res: 2, con: 1, mov: 1 }, caps: cap2(30, 26, 25, 22, 29),
    desc: 'Ténèbres, anima et bâtons. Il a une théorie sur tout.',
  }, 'gourou'),
  influenceur: adv({
    id: 'influenceur', name: 'Influenceur', move: 'foot', look: 'foot', mov: 6, weapons: ['dark', 'staff'], tags: [], magic: true,
    promo: { hp: 5, pow: 2, skl: 1, spd: 1, def: 3, res: 3, con: 2, mov: 1 }, caps: cap2(29, 25, 24, 24, 30),
    desc: 'Ténèbres et bâtons. Abonne-toi ou soigne-toi.',
  }, 'gourou'),
  predicateur: adv({
    id: 'predicateur', name: 'Prédicateur', move: 'foot', look: 'foot', mov: 6, weapons: ['light', 'staff'], tags: [], magic: true,
    promo: { hp: 4, pow: 2, skl: 2, spd: 1, def: 2, res: 3, con: 1, mov: 1 }, caps: cap2(27, 28, 26, 22, 30),
    desc: 'Lumière et bâtons.',
  }, 'illumine'),
  neonrider: adv({
    id: 'neonrider', name: 'Néon Rider', move: 'horse', look: 'horse', mov: 8, weapons: ['light', 'staff'], tags: ['horse'], magic: true,
    promo: { hp: 3, pow: 1, skl: 2, spd: 2, def: 1, res: 3, con: 2, mov: 3 }, caps: cap2(25, 26, 27, 21, 30),
    desc: 'Lumière et bâtons, à cheval.',
  }, 'illumine'),
  urgentiste: adv({
    id: 'urgentiste', name: 'Chef des Urgences', move: 'foot', look: 'foot', mov: 6, weapons: ['staff', 'light'], tags: [], magic: true,
    promo: { hp: 4, pow: 2, skl: 2, spd: 1, def: 2, res: 3, con: 1, mov: 1 }, caps: cap2(27, 26, 26, 21, 30),
    desc: 'Bâtons et lumière. Ne laisse personne tomber.',
  }, 'infirmier'),
  ambulancier: adv({
    id: 'ambulancier', name: 'Ambulancier', move: 'horse', look: 'horse', mov: 8, weapons: ['staff', 'anima'], tags: ['horse'], magic: true,
    promo: { hp: 3, pow: 1, skl: 2, spd: 2, def: 1, res: 2, con: 2, mov: 3 }, caps: cap2(25, 25, 28, 21, 29),
    desc: 'Bâtons et anima, à cheval. Pin-pon.',
  }, 'infirmier'),
  as: adv({
    id: 'as', name: 'As du Ciel', move: 'flier', look: 'flier', mov: 8, weapons: ['lance', 'sword'], tags: ['flier'], magic: false,
    promo: { hp: 4, pow: 2, skl: 2, spd: 2, def: 2, res: 2, con: 1, mov: 1 }, caps: cap2(24, 27, 30, 22, 28),
    desc: 'Lance et épée, en soucoupe tunée.',
  }, 'pilote'),
  dragon: adv({
    id: 'dragon', name: 'Pilote de Combat', move: 'flier', look: 'flier', mov: 7, weapons: ['lance', 'axe'], tags: ['flier'], magic: false,
    promo: { hp: 6, pow: 3, skl: 1, spd: 0, def: 4, res: 0, con: 3, mov: 0 }, caps: cap2(28, 25, 24, 28, 20, 25),
    desc: 'Lance et hache. Soucoupe blindée, plus lente.',
  }, 'pilote'),
};

// advanced classes: generic stats derived from their base class + promotion bonus
for (const c of Object.values(CLASSES)) {
  const from = (c as ClassDef & { _from?: ClassId })._from;
  if (!from) continue;
  const b = CLASSES[from];
  const out = { ...b.base };
  for (const [k, v] of Object.entries(c.promo ?? {})) out[k as keyof Stats] += v as number;
  out.mov = c.mov;
  c.base = out;
  c.growth = { ...b.growth };
  delete (c as ClassDef & { _from?: ClassId })._from;
}

/** the base class an advanced class comes from */
export function baseClassOf(id: ClassId): ClassId {
  const c = CLASSES[id];
  if (c.tier === 1) return id;
  return (Object.values(CLASSES).find((b) => b.promotesTo?.includes(id))?.id ?? id) as ClassId;
}

export const BASE_CLASSES = Object.values(CLASSES).filter((c) => c.tier === 1);

export const GROW_NAMES: Record<GrowKey | 'con' | 'mov', string> = {
  hp: 'PV',
  pow: 'FOR',
  skl: 'TEC',
  spd: 'VIT',
  lck: 'CHA',
  def: 'DÉF',
  res: 'RÉS',
  con: 'CON',
  mov: 'MVT',
};

/** stat name of POW for a class (FOR / MAG) */
export function powName(c: ClassDef): string {
  return c.magic ? 'MAG' : 'FOR';
}
