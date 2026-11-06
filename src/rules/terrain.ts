import type { MoveType, Terrain } from './types';

export interface TerrainDef {
  id: Terrain;
  name: string;
  /** avoid bonus (%) for the unit standing on it */
  avoid: number;
  /** defence AND resistance bonus */
  def: number;
  /** % of max HP healed at the start of its owner's turn */
  heal: number;
  /** movement cost per move type (Infinity = impassable) */
  cost: Record<MoveType, number>;
  /** fliers lose their terrain bonuses (they hover above it) */
  short: string;
}

const X = Infinity;
const T = (id: Terrain, name: string, short: string, avoid: number, def: number, heal: number, foot: number, armor: number, horse: number, flier: number): TerrainDef => ({
  id,
  name,
  short,
  avoid,
  def,
  heal,
  cost: { foot, armor, horse, flier },
});

/**
 * Terrain table (our own values, GBA-like logic): forests and hills slow the
 * cavalry down, armour hates slopes, fliers pay 1 everywhere except walls but
 * get no bonus from the ground; forts / thrones heal their occupant.
 */
export const TERRAIN: Record<Terrain, TerrainDef> = {
  plain: T('plain', 'Plaine', 'PLAINE', 0, 0, 0, 1, 1, 1, 1),
  road: T('road', 'Route', 'ROUTE', 0, 0, 0, 1, 1, 1, 1),
  floor: T('floor', 'Dallage', 'DALLE', 0, 0, 0, 1, 1, 1, 1),
  forest: T('forest', 'Forêt', 'FORÊT', 20, 1, 0, 2, 2, 3, 1),
  hill: T('hill', 'Colline', 'COLLINE', 30, 1, 0, 3, 4, 4, 1),
  mountain: T('mountain', 'Montagne', 'MONTAGNE', 40, 2, 0, X, X, X, 1),
  wall: T('wall', 'Mur', 'MUR', 0, 0, 0, X, X, X, X),
  pillar: T('pillar', 'Pilier', 'PILIER', 20, 1, 0, 2, 3, 3, 1),
  fort: T('fort', 'Fort', 'FORT', 20, 2, 20, 2, 2, 2, 1),
  village: T('village', 'Village', 'VILLAGE', 10, 0, 10, 1, 1, 1, 1),
  river: T('river', 'Rivière', 'RIVIÈRE', 20, 0, 0, 5, X, X, 1),
  bridge: T('bridge', 'Pont', 'PONT', 0, 0, 0, 1, 1, 1, 1),
  sea: T('sea', 'Mer', 'MER', 10, 0, 0, X, X, X, 1),
  sand: T('sand', 'Sable', 'SABLE', 5, 0, 0, 2, 3, 3, 1),
  throne: T('throne', 'Trône', 'TRÔNE', 30, 3, 10, 1, 1, 1, 1),
};

/** terrain bonuses as they apply to a unit (fliers hover: no bonus) */
export function terrainBonus(t: Terrain, move: MoveType): { avoid: number; def: number } {
  if (move === 'flier') return { avoid: 0, def: 0 };
  const d = TERRAIN[t];
  return { avoid: d.avoid, def: d.def };
}
