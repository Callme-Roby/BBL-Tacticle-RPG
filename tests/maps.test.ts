import { describe, expect, it } from 'vitest';
import { MAPS, parseMap } from '../src/rules/maps';
import { TERRAIN } from '../src/rules/terrain';

describe('cartes', () => {
  for (const def of MAPS) {
    it(`${def.id} : 10 départs par équipe, tous reliés à pied`, () => {
      const m = parseMap(def);
      expect(m.spawns[0].length).toBeGreaterThanOrEqual(10);
      expect(m.spawns[1].length).toBeGreaterThanOrEqual(10);
      // flood fill for foot units from team 0's first spawn
      const seen = new Set<number>();
      const start = m.spawns[0][0];
      const stack = [start.y * m.w + start.x];
      while (stack.length) {
        const i = stack.pop()!;
        if (seen.has(i)) continue;
        seen.add(i);
        const x = i % m.w;
        const y = (i - x) / m.w;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
          const j = ny * m.w + nx;
          if (isFinite(TERRAIN[m.tiles[j]].cost.foot)) stack.push(j);
        }
      }
      for (const p of [...m.spawns[0], ...m.spawns[1]]) expect(seen.has(p.y * m.w + p.x)).toBe(true);
    });
  }
});
