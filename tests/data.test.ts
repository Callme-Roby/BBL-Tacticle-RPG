import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from '../src/data/campaign';
import { CRIT_MOVES } from '../src/data/critMoves';
import { ROSTER } from '../src/data/roster';
import { CLASSES } from '../src/rules/classes';
import { ITEMS } from '../src/rules/items';
import { MAPS, parseMap } from '../src/rules/maps';
import { PROFILES } from '../src/rules/profiles';
import { FORMATS, kitFor } from '../src/rules/teams';

describe('données du jeu', () => {
  it('chaque pote du roster a un profil tactique, une classe de base et un BBL MAX court', () => {
    for (const d of ROSTER) {
      expect(PROFILES[d.id], d.id).toBeDefined();
      expect(CLASSES[PROFILES[d.id].cls].tier).toBe(1);
      expect(CRIT_MOVES[d.id], d.id).toBeDefined();
    }
  });
  it('les kits ne contiennent que des objets existants, et chacun a une arme ou un bâton dans tous les formats', () => {
    for (const id of Object.keys(PROFILES)) {
      for (const k of PROFILES[id].kit.flat()) expect(ITEMS[k], `${id}: ${k}`).toBeDefined();
      for (const f of FORMATS) {
        const base = PROFILES[id].cls;
        const classes = f.promoted ? CLASSES[base].promotesTo! : [base];
        for (const cls of classes) {
          const kit = kitFor(id, cls, f.level);
          expect(kit.length, `${id} ${cls}`).toBeLessThanOrEqual(5);
          expect(kit.some((i) => ITEMS[i].kind === 'weapon' || ITEMS[i].kind === 'staff'), `${id} ${cls} ${f.id}`).toBe(true);
        }
      }
    }
  });
  it('promotions : chaque classe de base mène à deux classes avancées existantes', () => {
    for (const c of Object.values(CLASSES).filter((x) => x.tier === 1)) {
      expect(c.promotesTo?.length).toBe(2);
      for (const p of c.promotesTo!) expect(CLASSES[p].tier).toBe(2);
    }
  });
  it('campagne : cartes, objets et places de départ valides', () => {
    for (const ch of CAMPAIGN) {
      const m = MAPS.find((x) => x.id === ch.mapId);
      expect(m, ch.id).toBeDefined();
      const pm = parseMap(m!);
      expect(ch.enemies.length).toBeLessThanOrEqual(pm.spawns[1].length);
      for (const e of ch.enemies) for (const i of e.items) expect(ITEMS[i], `${ch.id}: ${i}`).toBeDefined();
      for (const r of ch.rewards ?? []) expect(ITEMS[r]).toBeDefined();
      if (ch.objective.kind === 'seize') expect(pm.thrones[1]).not.toBeNull();
    }
  });
});
