import * as THREE from 'three';
import type { FighterDef } from '../data/roster';

/**
 * Same friend on both sides: the second copy wears other colours
 * (altCostume() of BBL FIGHTERZ src/game/world.ts, unchanged).
 */
export function altCostume(def: FighterDef): FighterDef {
  const shift = (hex: string, dh: number, dl = 0) => {
    const c = new THREE.Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    // greys/whites become a strong colour, colours get a hue rotation
    if (hsl.s < 0.15) return '#' + new THREE.Color().setHSL(0.0, 0.65, Math.min(0.45, Math.max(0.25, hsl.l * 0.6))).getHexString();
    return '#' + new THREE.Color().setHSL((hsl.h + dh) % 1, hsl.s, Math.min(0.9, Math.max(0.08, hsl.l + dl))).getHexString();
  };
  const o = def.outfit;
  return {
    ...def,
    outfit: { ...o, topColor: shift(o.topColor, 0.5), trimColor: shift(o.trimColor, 0.45, 0.1), pantsColor: shift(o.pantsColor, 0.35, -0.05) },
  };
}
