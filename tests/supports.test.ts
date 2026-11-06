import { describe, expect, it } from 'vitest';
import { SUPPORT_TALKS } from '../src/data/supportTalks';
import { ROSTER } from '../src/data/roster';
import { partnersOf } from '../src/rules/supports';
import { PROFILES } from '../src/rules/profiles';

describe('conversations de soutien', () => {
  const ids = new Set(ROSTER.map((d) => d.id));
  it('clés triées, persos existants, 3 rangs, chaque réplique dite par l’un des deux', () => {
    for (const [key, talk] of Object.entries(SUPPORT_TALKS)) {
      const [a, b] = key.split('|');
      expect(a < b, key).toBe(true);
      expect(ids.has(a) && ids.has(b), key).toBe(true);
      expect(talk.length).toBe(3);
      for (const conv of talk) {
        expect(conv.length).toBeGreaterThanOrEqual(3);
        for (const [who, text] of conv) {
          expect([a, b], key).toContain(who);
          expect(text.length).toBeGreaterThan(0);
        }
      }
    }
  });
  it('chaque pote a au moins 3 partenaires de soutien', () => {
    for (const id of Object.keys(PROFILES)) expect(partnersOf(id).length, id).toBeGreaterThanOrEqual(3);
  });
});
