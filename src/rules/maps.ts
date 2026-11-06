import type { Point, Team, Terrain } from './types';

/**
 * Maps are drawn as text, one character per tile:
 *   .  plaine     =  route     F  forêt     h  colline    M  montagne
 *   #  mur        T  fort      V  village   ~  rivière    b  pont
 *   w  mer        s  sable     K  trône     _  dallage    I  pilier
 *   0 / 1  départ de l'équipe 0 (en bas) / 1 (en haut), sur de la plaine
 *   A / B  départ de l'équipe 0 / 1 sur du dallage
 *   E  sortie (objectif « s'enfuir »), sur de la plaine
 *
 * Skirmish maps are given as their top half and completed by a 180° rotation
 * (team 1's half becomes team 0's half): both sides get exactly the same ground.
 */

export type MapTheme = 'parc' | 'ville' | 'colline' | 'chateau' | 'plage' | 'neige';

export interface MapDef {
  id: string;
  name: string;
  desc: string;
  theme: MapTheme;
  rows: string[];
}

export interface ParsedMap {
  id: string;
  name: string;
  theme: MapTheme;
  w: number;
  h: number;
  tiles: Terrain[];
  spawns: [Point[], Point[]];
  /** throne of each team (null = none) */
  thrones: [Point | null, Point | null];
  escapes: Point[];
}

const CHARS: Record<string, Terrain> = {
  '.': 'plain',
  '=': 'road',
  F: 'forest',
  h: 'hill',
  M: 'mountain',
  '#': 'wall',
  T: 'fort',
  V: 'village',
  '~': 'river',
  b: 'bridge',
  w: 'sea',
  s: 'sand',
  K: 'throne',
  _: 'floor',
  I: 'pillar',
  '0': 'plain',
  '1': 'plain',
  A: 'floor',
  B: 'floor',
  E: 'plain',
};

/** completes a half map by a 180° rotation (spawns of team 1 become team 0's) */
export function mirror(top: string[]): string[] {
  const swap: Record<string, string> = { '1': '0', '0': '1', B: 'A', A: 'B' };
  const bottom = top
    .slice()
    .reverse()
    .map((r) => [...r].reverse().map((c) => swap[c] ?? c).join(''));
  return [...top, ...bottom];
}

export const MAPS: MapDef[] = [
  {
    id: 'parc',
    name: 'Le Parc',
    desc: 'Une rivière, trois ponts, des bosquets. Le classique du dimanche.',
    theme: 'parc',
    rows: mirror([
      'F.1.1..1.1.F',
      '.F..1KT1..F.',
      '..1..11..1..',
      '.FF......FF.',
      '..F..==..h..',
      'h....=.....F',
      '..F..=..F...',
      '~~b~~bb~~b~~',
    ]),
  },
  {
    id: 'quartier',
    name: 'Le Quartier',
    desc: 'Ruelles, immeubles et kebabs. Les cavaliers adorent les routes.',
    theme: 'ville',
    rows: mirror([
      '#1.1#..#1.1#',
      '..1.=..=.1..',
      '..1.=..=.1..',
      '..1.=..=.1..',
      '##.====..==#',
      '..=#..V.#=..',
      '.==#..F..=..',
      'F.=..##..=.F',
    ]),
  },
  {
    id: 'collines',
    name: 'Les Collines',
    desc: 'Montagnes, collines et vieux forts : le terrain fait la loi.',
    theme: 'colline',
    rows: mirror([
      'MM.1.11.1.MM',
      'M.1.TK..1.hM',
      '..1..11..1..',
      '.h...FF...h.',
      'hhF......Fhh',
      '..M.h..T.M..',
      '.F...hh...F.',
      '..T.M..h..F.',
    ]),
  },
  {
    id: 'plage',
    name: 'La Plage',
    desc: 'Sable mou, mer turquoise et une épave de pédalo. Les volants s’éclatent.',
    theme: 'plage',
    rows: mirror([
      'ww.1.11.1.ww',
      'w..1.KT.1..w',
      'w.1..11..1.w',
      'ws..F..F..sw',
      'wss......ssw',
      'ws.sFssV.s.w',
      'w..sss..ss.w',
      'ww.s..ss..ww',
    ]),
  },
  {
    id: 'neige',
    name: 'Le Col Enneigé',
    desc: 'Un col étroit entre deux montagnes, un fort au milieu. Ça va bouchonner.',
    theme: 'neige',
    rows: mirror([
      'MM1.1111.1MM',
      'M.1.TK...1.M',
      'MF...11...FM',
      'MM.F....F.MM',
      'MMM..hh..MMM',
      'MM..F..F..MM',
      'MMh..TF..hMM',
      'MM...MM....M',
    ]),
  },
  {
    id: 'chateau',
    name: 'Le Château',
    desc: 'Les défenseurs tiennent le trône, les assaillants arrivent par le pont-levis.',
    theme: 'chateau',
    rows: [
      '############',
      '#___B_K_B__#',
      '#_I_B___B_I#',
      '#__B_I_I_B_#',
      '#_B_______B#',
      '#__B_B_B___#',
      '#I___I_I__I#',
      '###__###_###',
      '#T__.....__#',
      '#...F..F...#',
      '..F.....h...',
      '...h..F...F.',
      '.F........h.',
      '~~~~~bb~~~~~',
      '...0..0..0..',
      '.F0.0.0.0.F.',
      '..0.0..0....',
      'E....0.....E',
    ],
  },
];

export function getMap(id: string): MapDef {
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}

export function parseMap(def: MapDef): ParsedMap {
  const h = def.rows.length;
  const w = def.rows[0].length;
  const tiles: Terrain[] = [];
  const spawns: [Point[], Point[]] = [[], []];
  const thrones: [Point | null, Point | null] = [null, null];
  const escapes: Point[] = [];
  for (let y = 0; y < h; y++) {
    const row = def.rows[y];
    if (row.length !== w) throw new Error(`carte ${def.id} : ligne ${y} de longueur ${row.length} ≠ ${w}`);
    for (let x = 0; x < w; x++) {
      const c = row[x];
      const t = CHARS[c];
      if (!t) throw new Error(`carte ${def.id} : caractère inconnu « ${c} »`);
      tiles.push(t);
      if (c === '0' || c === 'A') spawns[0].push({ x, y });
      if (c === '1' || c === 'B') spawns[1].push({ x, y });
      if (c === 'E') escapes.push({ x, y });
      if (c === 'K') {
        // the throne belongs to the half it stands in (team 1 = top)
        const team: Team = y < h / 2 ? 1 : 0;
        thrones[team] = { x, y };
      }
    }
  }
  // spawns: front rows first (closest to the enemy) so smaller teams fill the front
  spawns[0].sort((a, b) => a.y - b.y || Math.abs(a.x - w / 2) - Math.abs(b.x - w / 2));
  spawns[1].sort((a, b) => b.y - a.y || Math.abs(a.x - w / 2) - Math.abs(b.x - w / 2));
  return { id: def.id, name: def.name, theme: def.theme, w, h, tiles, spawns, thrones, escapes };
}
