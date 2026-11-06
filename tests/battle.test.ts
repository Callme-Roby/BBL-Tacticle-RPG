import { describe, expect, it } from 'vitest';
import {
  applyAction,
  cloneBattle,
  combatant,
  createBattle,
  destinations,
  idx,
  previewAttack,
  reachable,
  supportBonuses,
  supportTalks,
  unitByUid,
  type BattleSetup,
  type BattleState,
  type UnitSetup,
} from '../src/rules/battle';
import { pairKey, SUPPORT_THRESHOLDS } from '../src/rules/supports';

/*
 Le Parc (12 × 16):
  0 F.1.1..1.1.F
  1 .F..1KT1..F.
  2 ..1..11..1..
  3 .FF......FF.
  4 ..F..==..h..
  5 h....=.....F
  6 ..F..=..F...
  7 ~~b~~bb~~b~~
  8 ~~b~~bb~~b~~
  9 ...F..=..F..
 10 F.....=....h
 11 ..h..==..F..
 12 .FF......FF.
 13 ..0..00..0..
 14 .F..0TK0..F.
 15 F.0.0..0.0.F
*/

const U = (defId: string, cls: UnitSetup['cls'], x: number, y: number, items: string[], extra: Partial<UnitSetup> = {}): UnitSetup => ({
  defId,
  name: defId.toUpperCase(),
  cls,
  level: 10,
  items,
  at: { x, y },
  ...extra,
});

function battle(t0: UnitSetup[], t1: UnitSetup[], extra: Partial<BattleSetup> = {}): BattleState {
  return createBattle({
    mapId: 'parc',
    teams: [
      { name: 'BLEUS', units: t0 },
      { name: 'ROUGES', units: t1 },
    ],
    objective: { kind: 'rout', turns: 0, attacker: 0 },
    fog: false,
    seed: 1234,
    ...extra,
  });
}

describe('déplacement', () => {
  it('coûts de terrain par type d’unité (cavalier gêné en forêt, volant partout)', () => {
    const s = battle(
      [U('mihai', 'livreur', 1, 10, ['epee_rouillee']), U('alex', 'pilote', 0, 9, ['manche_balai']), U('rayan', 'bagarreur', 3, 10, ['epee_rouillee'])],
      [U('dylan', 'cogneur', 11, 0, ['hachette'])],
    );
    const horse = unitByUid(s, 1)!;
    const flier = unitByUid(s, 2)!;
    const r = reachable(s, horse);
    // (1,11) plain then (1,12) forest: 1 + 3 for a horse (1 + 2 on foot)
    expect(r.cost.get(idx(s, 1, 12))).toBe(1 + 3);
    expect(reachable(s, unitByUid(s, 3)!, 9, false, { x: 1, y: 10 }).cost.get(idx(s, 1, 12))).toBe(1 + 2);
    // the river is closed to horses, open to fliers
    expect(r.cost.has(idx(s, 0, 8))).toBe(false);
    expect(reachable(s, flier).cost.get(idx(s, 0, 7))).toBe(2);
    // allies can be crossed but not ended on
    expect(r.cost.has(idx(s, 3, 10))).toBe(true);
    expect(destinations(s, horse).has(idx(s, 3, 10))).toBe(false);
  });
  it('les ennemis bloquent le passage', () => {
    const s = battle([U('rayan', 'bagarreur', 6, 9, ['epee_rouillee'])], [U('dylan', 'cogneur', 6, 8, ['hachette']), U('isis', 'cogneur', 5, 9, ['hachette']), U('elies', 'mur', 7, 9, ['manche_balai'])]);
    const r = reachable(s, unitByUid(s, 1)!);
    expect(r.cost.has(idx(s, 6, 8))).toBe(false);
    expect(r.cost.has(idx(s, 6, 7))).toBe(false);
  });
});

describe('combat sur la carte', () => {
  it('attaquer : PV, riposte, usure, expérience', () => {
    const s = battle([U('rayan', 'bagarreur', 6, 10, ['epee_rouillee'])], [U('dylan', 'cogneur', 6, 9, ['hachette'])]);
    const a = unitByUid(s, 1)!;
    const d = unitByUid(s, 2)!;
    const fc = previewAttack(s, a, a, d, 0);
    const ev = applyAction(s, { k: 'attack', uid: 1, x: 6, y: 10, target: 2, item: 0 });
    const c = ev.find((e) => e.t === 'combat');
    expect(c && c.t === 'combat').toBe(true);
    if (c?.t !== 'combat') return;
    expect(c.fc.a.triangle).toBe(1);
    const dealt = c.strikes.filter((x) => x.by === 1).reduce((t, x) => t + x.dmg, 0);
    const taken = c.strikes.filter((x) => x.by === 2).reduce((t, x) => t + x.dmg, 0);
    expect(d.hp).toBe(d.stats.hp - dealt);
    expect(a.hp).toBe(a.stats.hp - taken);
    expect(a.items[0].uses).toBe(46 - c.strikes.filter((x) => x.by === 1).length);
    expect(c.exp.find((e) => e.uid === 1)!.amount).toBeGreaterThan(0);
    expect(a.done).toBe(true);
    expect(fc.a.dmg).toBeGreaterThan(0);
  });
  it('bonus du fort : esquive et défense dans la prévisualisation', () => {
    const s = battle([U('rayan', 'bagarreur', 5, 13, ['epee_rouillee'])], [U('dylan', 'cogneur', 5, 14, ['hachette'])]);
    // (5,14) is a fort: +20 avoid, +2 def
    const a = unitByUid(s, 1)!;
    const d = unitByUid(s, 2)!;
    const onFort = previewAttack(s, a, a, d, 0);
    expect(combatant(s, d).terrainAvoid).toBe(20);
    expect(combatant(s, d).terrainDef).toBe(2);
    d.y = 13;
    d.x = 6;
    const onPlain = previewAttack(s, a, a, d, 0);
    expect(onPlain.a.dmg - onFort.a.dmg).toBe(2);
    expect(onPlain.a.hit).toBeGreaterThan(onFort.a.hit);
  });
  it('les forts soignent au début du tour de leur occupant', () => {
    const s = battle([U('rayan', 'bagarreur', 5, 14, ['epee_rouillee'])], [U('dylan', 'cogneur', 11, 0, ['hachette'])]);
    const r = unitByUid(s, 1)!;
    r.hp = 5;
    applyAction(s, { k: 'end' });
    applyAction(s, { k: 'end' });
    expect(s.turn).toBe(2);
    expect(r.hp).toBe(5 + Math.round(r.stats.hp * 0.2));
  });
});

describe('objets, bâtons, échanges, secours, vol', () => {
  it('bâton de soin : 10 + MAG, à distance avec Soin Wi-Fi (MAG/2 cases)', () => {
    const s = battle([U('benji', 'infirmier', 6, 12, ['pansement', 'soin_wifi']), U('rayan', 'bagarreur', 6, 13, ['epee_rouillee']), U('aroa', 'bagarreur', 9, 12, ['epee_rouillee'])], [U('dylan', 'cogneur', 11, 0, ['hachette'])]);
    const b = unitByUid(s, 1)!;
    const r = unitByUid(s, 2)!;
    r.hp = 3;
    applyAction(s, { k: 'staff', uid: 1, x: 6, y: 12, target: 2, item: 0 });
    expect(r.hp).toBe(Math.min(r.stats.hp, 3 + 10 + b.stats.pow));
    expect(b.items[0].uses).toBe(29);
    // physic: range MAG / 2
    const s2 = battle([U('benji', 'infirmier', 6, 12, ['soin_wifi']), U('aroa', 'bagarreur', 6 + 3, 12, ['epee_rouillee'])], [U('dylan', 'cogneur', 11, 0, ['hachette'])]);
    const b2 = unitByUid(s2, 1)!;
    unitByUid(s2, 2)!.hp = 2;
    const range = Math.floor(b2.stats.pow / 2);
    if (range >= 3) expect(() => applyAction(s2, { k: 'staff', uid: 1, x: 6, y: 12, target: 2, item: 0 })).not.toThrow();
    else expect(() => applyAction(s2, { k: 'staff', uid: 1, x: 6, y: 12, target: 2, item: 0 })).toThrow();
  });
  it('échanger avec un allié adjacent (on peut encore agir ensuite)', () => {
    const s = battle([U('rayan', 'bagarreur', 6, 12, ['epee_rouillee', 'canette']), U('aroa', 'bagarreur', 6, 13, ['couteau_kebab'])], [U('dylan', 'cogneur', 11, 0, ['hachette'])]);
    const r = unitByUid(s, 1)!;
    const a = unitByUid(s, 2)!;
    const mine = [r.items[0]];
    const theirs = [a.items[0], r.items[1]];
    applyAction(s, { k: 'trade', uid: 1, x: 6, y: 12, partner: 2, mine, theirs });
    expect(a.items.map((i) => i.id)).toEqual(['couteau_kebab', 'canette']);
    expect(r.done).toBe(false);
    // cheating trades are refused
    expect(() => applyAction(s, { k: 'trade', uid: 1, x: 6, y: 12, partner: 2, mine: [{ id: 'epee_bling', uses: 20 }], theirs: [] })).toThrow();
  });
  it('secourir : porter un allié léger divise TEC et VIT par deux, puis le déposer', () => {
    const s = battle([U('mihai', 'livreur', 6, 12, ['epee_rouillee']), U('thomas', 'filou', 6, 13, ['couteau_kebab'])], [U('dylan', 'cogneur', 11, 0, ['hachette'])]);
    const m = unitByUid(s, 1)!;
    const t = unitByUid(s, 2)!;
    const before = combatant(s, m);
    applyAction(s, { k: 'rescue', uid: 1, x: 6, y: 12, target: 2 });
    expect(t.carriedBy).toBe(1);
    expect(combatant(s, m).spd).toBe(Math.floor(before.spd / 2));
    expect(combatant(s, m).skl).toBe(Math.floor(before.skl / 2));
    applyAction(s, { k: 'end' });
    applyAction(s, { k: 'end' });
    applyAction(s, { k: 'drop', uid: 1, x: 6, y: 12, tx: 7, ty: 12 });
    expect(t.carriedBy).toBe(null);
    expect([t.x, t.y]).toEqual([7, 12]);
  });
  it('voler : seulement un voleur, plus rapide, et pas l’arme en main', () => {
    const s = battle([U('thomas', 'filou', 6, 10, ['couteau_kebab'])], [U('dylan', 'cogneur', 6, 9, ['hachette', 'kebab'])]);
    expect(() => applyAction(s, { k: 'steal', uid: 1, x: 6, y: 10, target: 2, item: 0 })).toThrow();
    applyAction(s, { k: 'steal', uid: 1, x: 6, y: 10, target: 2, item: 1 });
    expect(unitByUid(s, 1)!.items.map((i) => i.id)).toContain('kebab');
  });
  it('promotion au niveau 10 avec le Diplôme : choix de classe, bonus, niveau 1', () => {
    const s = battle([U('rayan', 'bagarreur', 6, 12, ['epee_rouillee', 'diplome'])], [U('dylan', 'cogneur', 11, 0, ['hachette'])]);
    const r = unitByUid(s, 1)!;
    const hp = r.stats.hp;
    applyAction(s, { k: 'use', uid: 1, x: 6, y: 12, item: 1, cls: 'gladiateur' });
    expect(r.cls).toBe('gladiateur');
    expect(r.level).toBe(1);
    expect(r.stats.hp).toBe(hp + 5);
    expect(r.stats.mov).toBe(6);
    expect(r.items.some((i) => i.id === 'diplome')).toBe(false);
    const low = battle([U('rayan', 'bagarreur', 6, 12, ['diplome'], { level: 9 })], [U('dylan', 'cogneur', 11, 0, ['hachette'])]);
    expect(() => applyAction(low, { k: 'use', uid: 1, x: 6, y: 12, item: 0 })).toThrow();
  });
  it('berceuse : l’unité endormie ne joue plus, puis se réveille', () => {
    const s = battle([U('billel', 'influenceur', 6, 12, ['berceuse'], { level: 15 })], [U('dylan', 'cogneur', 6, 10, ['hachette'])]);
    let slept = false;
    for (let i = 0; i < 6 && !slept; i++) {
      const b = cloneBattle(s);
      b.rng = 1000 + i;
      applyAction(b, { k: 'staff', uid: 1, x: 6, y: 12, target: 2, item: 0 });
      if (unitByUid(b, 2)!.status?.id === 'sleep') {
        slept = true;
        applyAction(b, { k: 'end' });
        expect(() => applyAction(b, { k: 'wait', uid: 2, x: 6, y: 10 })).toThrow();
        applyAction(b, { k: 'end' });
        applyAction(b, { k: 'end' });
        applyAction(b, { k: 'end' });
        expect(unitByUid(b, 2)!.status).toBe(null);
      }
    }
    expect(slept).toBe(true);
  });
});

describe('objectifs', () => {
  it('vaincre le chef', () => {
    const s = battle([U('isis', 'cogneur', 6, 10, ['tronconneuse'], { level: 20, leader: true })], [U('benji', 'infirmier', 6, 9, ['pansement'], { leader: true, level: 1 }), U('dylan', 'cogneur', 11, 0, ['hachette'])], {
      objective: { kind: 'boss', turns: 0, attacker: 0 },
    });
    for (let i = 0; i < 20 && s.winner === null; i++) {
      const isis = unitByUid(s, 1)!;
      if (s.phase === 0 && !isis.done) applyAction(s, { k: 'attack', uid: 1, x: 6, y: 10, target: 2, item: 0 });
      else applyAction(s, { k: 'end' });
    }
    expect(s.winner).toBe(0);
    expect(s.winReason).toContain('chef');
  });
  it('capturer le trône adverse avec son chef', () => {
    const s = battle([U('mihai', 'livreur', 5, 2, ['epee_rouillee'], { leader: true })], [U('dylan', 'cogneur', 11, 15, ['hachette'], { leader: true })], {
      objective: { kind: 'seize', turns: 0, attacker: 0 },
    });
    // team 1's throne is at (5,1)
    applyAction(s, { k: 'seize', uid: 1, x: 5, y: 1 });
    expect(s.winner).toBe(0);
  });
  it('défense : tenir le nombre de tours', () => {
    const s = battle([U('rayan', 'bagarreur', 6, 13, ['epee_rouillee'])], [U('dylan', 'cogneur', 6, 2, ['hachette'])], { objective: { kind: 'defend', turns: 3, attacker: 0 } });
    for (let i = 0; i < 6; i++) applyAction(s, { k: 'end' });
    expect(s.winner).toBe(1);
  });
  it('fuite : le chef sort par le bord adverse', () => {
    const s = battle([U('thomas', 'filou', 6, 2, ['couteau_kebab'], { leader: true })], [U('dylan', 'cogneur', 0, 15, ['hachette'])], { objective: { kind: 'escape', turns: 15, attacker: 0 } });
    applyAction(s, { k: 'escape', uid: 1, x: 6, y: 0 });
    expect(s.winner).toBe(0);
  });
});

describe('soutiens', () => {
  it('points en fin de tour côte à côte, conversation au seuil, bonus à 3 cases', () => {
    const s = battle([U('elies', 'mur', 6, 12, ['manche_balai']), U('rayan', 'bagarreur', 6, 13, ['epee_rouillee'])], [U('dylan', 'cogneur', 11, 0, ['hachette'])]);
    const e = unitByUid(s, 1)!;
    const r = unitByUid(s, 2)!;
    expect(supportBonuses(s, e).hit).toBe(0);
    for (let i = 0; i < SUPPORT_THRESHOLDS[0] * 2; i++) applyAction(s, { k: 'end' });
    expect(s.supports[0][pairKey('elies', 'rayan')].pts).toBe(SUPPORT_THRESHOLDS[0]);
    expect(supportTalks(s, e).map((u) => u.uid)).toEqual([2]);
    const ev = applyAction(s, { k: 'support', uid: 1, x: 6, y: 12, partner: 2 });
    expect(ev.some((x) => x.t === 'support' && x.level === 1)).toBe(true);
    expect(supportBonuses(s, e).hit).toBe(5);
    expect(supportBonuses(s, r).avoid).toBe(5);
  });
});

describe('déterminisme (jeu en ligne : on n’envoie que les actions)', () => {
  it('rejouer les mêmes actions donne exactement le même état', () => {
    const mk = () => battle([U('rayan', 'bagarreur', 6, 10, ['epee_rouillee']), U('enola', 'tireur', 7, 11, ['arc_plastique'])], [U('dylan', 'cogneur', 6, 9, ['hachette']), U('alex', 'pilote', 8, 9, ['manche_balai'])]);
    const a = mk();
    const b = mk();
    const actions = [
      { k: 'attack', uid: 1, x: 6, y: 10, target: 3, item: 0 },
      { k: 'attack', uid: 2, x: 8, y: 11, target: 4, item: 0 },
      { k: 'end' },
    ] as const;
    for (const x of actions) {
      applyAction(a, x as never);
      applyAction(b, x as never);
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
