import type { StatusId, UnitTag, WeaponType } from './types';

export type ItemKind = 'weapon' | 'staff' | 'heal' | 'promo' | 'boost';

/** what a staff does */
export type StaffEffect = 'heal' | 'physic' | 'restore' | 'sleep' | 'silence' | 'rescue';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  /** weapons and staves */
  type?: WeaponType;
  /** might */
  mt: number;
  hit: number;
  crit: number;
  /** weight */
  wt: number;
  /** attack range (staves: 1 unless `physic` = magic/2) */
  min: number;
  max: number;
  uses: number;
  /** 1 = everyone, 2 = from level 5 of a base class, 3 = advanced classes only */
  rank: 1 | 2 | 3;
  /** ×3 might against these */
  effective?: UnitTag[];
  /** physical weapon striking at range 1-2 with magic (uses POW/2 + mt against RES) */
  magicBlade?: boolean;
  /** heal the attacker by the damage dealt */
  drain?: boolean;
  /** ignores half the target's DEF / RES (rounded down) */
  pierce?: boolean;
  /** the attacker strikes twice in a row (each attack) */
  brave?: boolean;
  /** staves */
  staff?: StaffEffect;
  /** staves / consumables: HP restored (staves add the user's MAG) */
  heal?: number;
  /** status inflicted by the staff */
  status?: StatusId;
  /** boost items: permanent bonus */
  boost?: { stat: 'hp' | 'pow' | 'skl' | 'spd' | 'lck' | 'def' | 'res' | 'con' | 'mov'; amount: number };
  /** staff experience */
  exp?: number;
  /** shown in the item sheet (French) */
  desc: string;
}

const W = (
  id: string,
  name: string,
  type: WeaponType,
  mt: number,
  hit: number,
  crit: number,
  wt: number,
  min: number,
  max: number,
  uses: number,
  rank: 1 | 2 | 3,
  desc: string,
  extra: Partial<ItemDef> = {},
): ItemDef => ({ id, name, kind: 'weapon', type, mt, hit, crit, wt, min, max, uses, rank, desc, ...extra });

const STAFF = (id: string, name: string, staff: StaffEffect, uses: number, rank: 1 | 2 | 3, exp: number, desc: string, extra: Partial<ItemDef> = {}): ItemDef => ({
  id,
  name,
  kind: 'staff',
  type: 'staff',
  mt: 0,
  hit: 100,
  crit: 0,
  wt: 0,
  min: 1,
  max: 1,
  uses,
  rank,
  staff,
  exp,
  desc,
  ...extra,
});

const USE = (id: string, name: string, kind: ItemKind, uses: number, desc: string, extra: Partial<ItemDef> = {}): ItemDef => ({
  id,
  name,
  kind,
  mt: 0,
  hit: 0,
  crit: 0,
  wt: 0,
  min: 0,
  max: 0,
  uses,
  rank: 1,
  desc,
  ...extra,
});

/**
 * Every item of the game (our own names and numbers). Weapon tiers: rouillé
 * (cheap, accurate), chromé (heavy, strong), « bling » (advanced), plus specials.
 */
export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
  [
    // ---------------------------------------------------------------- swords
    W('epee_rouillee', 'Épée Rouillée', 'sword', 5, 90, 0, 5, 1, 1, 46, 1, 'Elle a vécu. Elle vivra encore.'),
    W('couteau_kebab', 'Couteau à Kebab', 'sword', 3, 100, 5, 2, 1, 1, 30, 1, 'Léger, précis, sent l’oignon.'),
    W('epee_chromee', 'Épée Chromée', 'sword', 8, 75, 0, 10, 1, 1, 30, 2, 'Lourde mais elle brille.'),
    W('la_fourbe', 'La Fourbe', 'sword', 9, 75, 30, 7, 1, 1, 20, 2, 'Épée tueuse : +30 % de critique.'),
    W('ouvre_boite', 'Ouvre-Boîte', 'sword', 8, 75, 0, 11, 1, 1, 18, 2, 'Efficace contre les armures.', { effective: ['armor'] }),
    W('epee_wifi', 'Épée Wi-Fi', 'sword', 9, 70, 0, 9, 1, 2, 25, 2, 'Frappe à 2 cases avec la magie (1 barre de réseau).', { magicBlade: true }),
    W('epee_bling', 'Épée Bling-Bling', 'sword', 13, 80, 0, 8, 1, 1, 20, 3, 'Or massif (plaqué).'),
    W('double_lame', 'Double Lame', 'sword', 9, 75, 0, 12, 1, 1, 30, 3, 'Frappe deux fois de suite.', { brave: true }),
    // ---------------------------------------------------------------- lances
    W('manche_balai', 'Manche à Balai', 'lance', 7, 80, 0, 8, 1, 1, 45, 1, 'Il balaie surtout les adversaires.'),
    W('javelot_dimanche', 'Javelot du Dimanche', 'lance', 6, 65, 0, 11, 1, 2, 20, 1, 'Se lance à 1–2 cases.'),
    W('brochette', 'Brochette Géante', 'lance', 10, 70, 0, 13, 1, 1, 30, 2, 'Lance en acier, saveur barbecue.'),
    W('chasse_kebab', 'Pique Anti-Cheval', 'lance', 7, 70, 0, 13, 1, 1, 16, 2, 'Efficace contre les cavaliers.', { effective: ['horse'] }),
    W('lance_tueuse', 'Lance Pointue', 'lance', 10, 70, 30, 9, 1, 1, 20, 2, 'Lance tueuse : +30 % de critique.'),
    W('lance_bling', 'Lance Bling-Bling', 'lance', 14, 75, 0, 10, 1, 1, 20, 3, 'Pointe dorée à l’or fin (du kebab).'),
    W('harpon', 'Harpon de Luxe', 'lance', 11, 60, 0, 14, 1, 2, 18, 3, 'Lance de jet lourde, 1–2 cases.'),
    // ---------------------------------------------------------------- axes
    W('hachette', 'Hachette de Camping', 'axe', 8, 75, 0, 10, 1, 1, 45, 1, 'Coupe le bois et les ego.'),
    W('hache_boomerang', 'Hache Boomerang', 'axe', 7, 60, 0, 12, 1, 2, 20, 1, 'Se lance à 1–2 cases et (presque) revient.'),
    W('hache_bucheron', 'Hache de Bûcheron', 'axe', 11, 65, 0, 15, 1, 1, 30, 2, 'Hache en acier.'),
    W('marteau', 'Marteau-Piqueur', 'axe', 10, 55, 0, 15, 1, 1, 20, 2, 'Efficace contre les armures.', { effective: ['armor'] }),
    W('tronconneuse', 'Tronçonneuse', 'axe', 11, 65, 30, 11, 1, 1, 20, 2, 'Hache tueuse : +30 % de critique.'),
    W('hache_bling', 'Hache Bling-Bling', 'axe', 15, 70, 0, 12, 1, 1, 20, 3, 'Le bling, en plus lourd.'),
    // ---------------------------------------------------------------- bows
    W('arc_plastique', 'Arc en Plastique', 'bow', 6, 85, 0, 5, 2, 2, 45, 1, 'Efficace contre les volants.', { effective: ['flier'] }),
    W('arc_compound', 'Arc à Poulies', 'bow', 9, 70, 0, 9, 2, 2, 30, 2, 'Arc en acier. Efficace contre les volants.', { effective: ['flier'] }),
    W('arc_sniper', 'Arc de Précision', 'bow', 9, 75, 30, 7, 2, 2, 20, 2, 'Arc tueur : +30 % de critique. Efficace contre les volants.', { effective: ['flier'] }),
    W('arc_longue', 'Arc Longue Portée', 'bow', 5, 65, 0, 13, 2, 3, 20, 2, 'Tire à 2–3 cases. Efficace contre les volants.', { effective: ['flier'] }),
    W('arc_bling', 'Arc Bling-Bling', 'bow', 13, 75, 0, 6, 2, 2, 20, 3, 'Flèches à pointe dorée. Efficace contre les volants.', { effective: ['flier'] }),
    // ---------------------------------------------------------------- anima
    W('briquet', 'Briquet', 'anima', 5, 90, 0, 4, 1, 2, 40, 1, 'Magie de feu de base.'),
    W('grenade_barbue', 'Grenade Barbue', 'anima', 10, 80, 5, 10, 1, 2, 30, 2, 'Feu explosif. Tient dans une barbe.'),
    W('orage_poche', 'Orage de Poche', 'anima', 8, 75, 10, 6, 1, 2, 35, 2, 'Foudre : +10 % de critique.'),
    W('seche_cheveux', 'Sèche-Cheveux', 'anima', 6, 85, 5, 3, 1, 2, 30, 2, 'Vent violent : efficace contre les volants.', { effective: ['flier'] }),
    W('meteore', 'Météore de Salon', 'anima', 13, 70, 5, 12, 1, 2, 15, 3, 'Gros feu d’artifice.'),
    // ---------------------------------------------------------------- light
    W('lampe_torche', 'Lampe Torche', 'light', 4, 95, 5, 5, 1, 2, 35, 1, 'Magie de lumière de base.'),
    W('flash_selfie', 'Flash Selfie', 'light', 7, 85, 15, 6, 1, 2, 25, 2, 'Éblouit : +15 % de critique.'),
    W('neon_sacre', 'Néon Sacré', 'light', 11, 80, 10, 8, 1, 2, 20, 3, 'La lumière au bout du couloir.'),
    // ---------------------------------------------------------------- dark
    W('patch_notes', 'Patch Notes', 'dark', 7, 75, 0, 8, 1, 2, 40, 1, 'Ténèbres de base. Personne ne les lit.'),
    W('tier_list', 'Tier List Maudite', 'dark', 11, 70, 0, 12, 1, 2, 30, 2, 'Ténèbres lourdes et puissantes.'),
    W('ponction', 'Ponction de Méta', 'dark', 8, 70, 0, 11, 1, 2, 20, 2, 'Rend au lanceur les PV qu’elle retire.', { drain: true }),
    W('nerf', 'Gros Nerf', 'dark', 9, 65, 0, 14, 1, 2, 15, 3, 'Ignore la moitié de la résistance.', { pierce: true }),
    // ---------------------------------------------------------------- staves
    STAFF('pansement', 'Pansement', 'heal', 30, 1, 11, 'Soigne un allié adjacent (10 + MAG).', { heal: 10 }),
    STAFF('trousse', 'Trousse de Secours', 'heal', 20, 2, 15, 'Soigne un allié adjacent (20 + MAG).', { heal: 20 }),
    STAFF('soin_wifi', 'Soin Wi-Fi', 'physic', 15, 2, 20, 'Soigne à distance (MAG ÷ 2 cases, 10 + MAG).', { heal: 10 }),
    STAFF('remede', 'Remède Miracle', 'restore', 10, 2, 20, 'Guérit les états (sommeil, silence, poison).'),
    STAFF('taxi', 'Taxi de Secours', 'rescue', 3, 3, 30, 'Téléporte un allié (MAG ÷ 2 cases) à côté de toi.'),
    STAFF('berceuse', 'Berceuse', 'sleep', 5, 3, 30, 'Endort un ennemi (MAG ÷ 2 cases) : il ne joue plus pendant 2 tours.', { status: 'sleep' }),
    STAFF('mode_avion', 'Mode Avion', 'silence', 5, 2, 25, 'Coupe la magie d’un ennemi (MAG ÷ 2 cases) pendant 3 tours.', { status: 'silence' }),
    // ---------------------------------------------------------------- consumables
    USE('canette', 'Canette d’Énergie', 'heal', 3, 'Rend 10 PV.', { heal: 10 }),
    USE('kebab', 'Kebab Complet', 'heal', 3, 'Rend 20 PV. Sauce blanche.', { heal: 20 }),
    USE('diplome', 'Diplôme BBL', 'promo', 1, 'Promotion à partir du niveau 10 (choix entre deux classes).'),
    USE('proteine', 'Pot de Protéine', 'boost', 1, 'FOR/MAG +2.', { boost: { stat: 'pow', amount: 2 } }),
    USE('energy_drink', 'Boisson Énergisante', 'boost', 1, 'VIT +2.', { boost: { stat: 'spd', amount: 2 } }),
    USE('trefle', 'Trèfle à Quatre Feuilles', 'boost', 1, 'CHA +2.', { boost: { stat: 'lck', amount: 2 } }),
  ].map((i) => [i.id, i]),
);

export function item(id: string): ItemDef {
  const it = ITEMS[id];
  if (!it) throw new Error('objet inconnu : ' + id);
  return it;
}

/** French name of a weapon type */
export const WEAPON_NAMES: Record<WeaponType, string> = {
  sword: 'Épée',
  lance: 'Lance',
  axe: 'Hache',
  bow: 'Arc',
  anima: 'Anima',
  light: 'Lumière',
  dark: 'Ténèbres',
  staff: 'Bâton',
};

/** small glyph of a weapon type (UI) */
export const WEAPON_ICONS: Record<WeaponType, string> = {
  sword: '🗡',
  lance: '🔱',
  axe: '🪓',
  bow: '🏹',
  anima: '🔥',
  light: '✨',
  dark: '🌀',
  staff: '✚',
};

export function isMagicType(t: WeaponType | undefined): boolean {
  return t === 'anima' || t === 'light' || t === 'dark';
}
