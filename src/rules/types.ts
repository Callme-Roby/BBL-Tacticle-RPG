/**
 * Core types of the BBL TACTICS rules (pure data, no three.js, no DOM):
 * the engine runs the same in the browser, in the tests and in the balance
 * simulator (node).
 */

export type StatKey = 'hp' | 'pow' | 'skl' | 'spd' | 'lck' | 'def' | 'res' | 'con' | 'mov';

/** the growing stats (con / mov only change on promotion) */
export const GROW_KEYS = ['hp', 'pow', 'skl', 'spd', 'lck', 'def', 'res'] as const;
export type GrowKey = (typeof GROW_KEYS)[number];

export type Stats = Record<StatKey, number>;
export type Growths = Record<GrowKey, number>;

/** physical: sword > axe > lance > sword; magic: anima > light > dark > anima; bows: outside */
export type WeaponType = 'sword' | 'lance' | 'axe' | 'bow' | 'anima' | 'light' | 'dark' | 'staff';

export const WEAPON_TYPES: readonly WeaponType[] = ['sword', 'lance', 'axe', 'bow', 'anima', 'light', 'dark', 'staff'];

/** foot soldiers, armoured units, mounted units, flying units */
export type MoveType = 'foot' | 'armor' | 'horse' | 'flier';

/** what a weapon can be "effective" (×3 might) against */
export type UnitTag = 'armor' | 'horse' | 'flier';

export type Terrain =
  | 'plain'
  | 'road'
  | 'forest'
  | 'hill'
  | 'mountain'
  | 'wall'
  | 'fort'
  | 'village'
  | 'river'
  | 'bridge'
  | 'sea'
  | 'sand'
  | 'throne'
  | 'floor'
  | 'pillar';

export type Team = 0 | 1;

export type StatusId = 'sleep' | 'silence' | 'poison';

export interface Point {
  x: number;
  y: number;
}
