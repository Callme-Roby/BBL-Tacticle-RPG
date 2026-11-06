import { describe, expect, it } from 'vitest';
import { PROFILES } from '../src/rules/profiles';
import { autoplay } from '../src/sim/autoplay';
import type { UnitSetup } from '../src/rules/battle';
import { kitFor } from '../src/rules/teams';

const ids = Object.keys(PROFILES);
const team = (list: string[], alt = false): UnitSetup[] =>
  list.map((id, i) => ({ defId: id, name: id.toUpperCase(), cls: PROFILES[id].cls, level: 10, items: kitFor(id, PROFILES[id].cls, 10), leader: i === 0, alt }));

describe('match IA contre IA', () => {
  it('une partie 10 contre 10 se termine avec un vainqueur', () => {
    const r = autoplay({
      mapId: 'parc',
      teams: [
        { name: 'BLEUS', units: team(ids.slice(0, 10)) },
        { name: 'ROUGES', units: team(ids.slice(4, 14), true) },
      ],
      objective: { kind: 'rout', turns: 0, attacker: 0 },
      fog: false,
      seed: 42,
    });
    expect(r.winner).not.toBeNull();
    expect(r.turns).toBeLessThan(40);
  }, 60000);
});
