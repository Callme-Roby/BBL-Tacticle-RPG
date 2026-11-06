import { describe, expect, it } from 'vitest';
import { attackSpeed, combatExp, forecast, rates, resolve, strikeOrder, triangle, type Combatant } from '../src/rules/combat';
import { item } from '../src/rules/items';
import { trueHit } from '../src/rules/rng';

/** a combatant with round numbers, overridable */
function C(o: Partial<Combatant> & { w?: string | null } = {}): Combatant {
  const { w, ...rest } = o;
  return {
    uid: 1,
    hp: 30,
    maxHp: 30,
    pow: 10,
    skl: 10,
    spd: 10,
    lck: 10,
    def: 5,
    res: 3,
    con: 10,
    classCrit: 0,
    tags: [],
    weapon: w === null ? null : item(w ?? 'epee_rouillee'),
    terrainAvoid: 0,
    terrainDef: 0,
    supportHit: 0,
    supportAvoid: 0,
    supportCrit: 0,
    supportDodge: 0,
    ...rest,
  };
}

describe('triangle des armes', () => {
  it('épée > hache > lance > épée', () => {
    expect(triangle('sword', 'axe')).toBe(1);
    expect(triangle('axe', 'lance')).toBe(1);
    expect(triangle('lance', 'sword')).toBe(1);
    expect(triangle('axe', 'sword')).toBe(-1);
    expect(triangle('sword', 'sword')).toBe(0);
  });
  it('anima > lumière > ténèbres > anima ; arcs et bâtons hors triangle', () => {
    expect(triangle('anima', 'light')).toBe(1);
    expect(triangle('light', 'dark')).toBe(1);
    expect(triangle('dark', 'anima')).toBe(1);
    expect(triangle('light', 'anima')).toBe(-1);
    expect(triangle('bow', 'sword')).toBe(0);
    expect(triangle('sword', 'bow')).toBe(0);
    expect(triangle('staff', 'axe')).toBe(0);
  });
  it('avantage : +15 précision et +1 dégât (désavantage : l’inverse)', () => {
    const a = C({ w: 'epee_rouillee' });
    const neutral = rates(a, C({ w: 'epee_rouillee' }), 1);
    const adv = rates(a, C({ w: 'hachette' }), 1);
    const dis = rates(a, C({ w: 'manche_balai' }), 1);
    // the defender's weapon changes its attack speed: equalise weights for a clean comparison
    expect(adv.triangle).toBe(1);
    expect(dis.triangle).toBe(-1);
    expect(adv.dmg - neutral.dmg).toBe(1);
    expect(neutral.dmg - dis.dmg).toBe(1);
    // hachette (wt 10) and manche à balai (wt 8) don't slow a CON 10 defender: same avoid as the iron sword
    expect(adv.hit - neutral.hit).toBe(15);
    expect(neutral.hit - dis.hit).toBe(15);
  });
});

describe('vitesse d’attaque et doublé', () => {
  it('le poids au-delà de la constitution ralentit', () => {
    expect(attackSpeed(C({ spd: 10, con: 10, w: 'hache_bucheron' }))).toBe(10 - 5); // wt 15
    expect(attackSpeed(C({ spd: 10, con: 15, w: 'hache_bucheron' }))).toBe(10);
    expect(attackSpeed(C({ spd: 10, con: 2, w: 'couteau_kebab' }))).toBe(10); // wt 2
  });
  it('on frappe deux fois à partir de 4 de vitesse d’attaque en plus', () => {
    expect(rates(C({ spd: 14 }), C({ spd: 10 }), 1).doubles).toBe(true);
    expect(rates(C({ spd: 13 }), C({ spd: 10 }), 1).doubles).toBe(false);
  });
  it('ordre des coups : A, D, puis le plus rapide ; les armes doubles frappent deux fois', () => {
    const fast = forecast(C({ spd: 15 }), C({ spd: 10 }), 1);
    expect(strikeOrder(fast)).toEqual(['a', 'd', 'a']);
    const slow = forecast(C({ spd: 6 }), C({ spd: 10 }), 1);
    expect(strikeOrder(slow)).toEqual(['a', 'd', 'd']);
    const brave = forecast(C({ spd: 15, w: 'double_lame', con: 12 }), C({ spd: 10 }), 1);
    expect(strikeOrder(brave)).toEqual(['a', 'a', 'd', 'a', 'a']);
  });
});

describe('précision, esquive, critique, dégâts', () => {
  it('précision = arme + TEC×2 + CHA/2 + triangle − (VA×2 + CHA + terrain)', () => {
    const a = C({ skl: 9, lck: 7, w: 'epee_rouillee' }); // hit 90
    const d = C({ spd: 8, lck: 5, terrainAvoid: 20, w: 'epee_rouillee' });
    const r = rates(a, d, 1);
    expect(r.hit).toBe(90 + 18 + 3 - (16 + 5 + 20));
  });
  it('critique = arme + TEC/2 + bonus de classe − CHA de la cible', () => {
    const a = C({ skl: 11, classCrit: 15, w: 'la_fourbe' }); // crit 30
    const d = C({ lck: 6 });
    expect(rates(a, d, 1).crit).toBe(30 + 5 + 15 - 6);
  });
  it('dégâts = FOR + puissance − DÉF − bonus de terrain (jamais négatif)', () => {
    const a = C({ pow: 8, w: 'epee_rouillee' }); // mt 5
    expect(rates(a, C({ def: 4, terrainDef: 1 }), 1).dmg).toBe(8 + 5 - 4 - 1);
    expect(rates(a, C({ def: 40 }), 1).dmg).toBe(0);
  });
  it('la magie frappe la résistance', () => {
    const a = C({ pow: 8, w: 'briquet' }); // mt 5, anima
    expect(rates(a, C({ def: 20, res: 3, w: null }), 1).dmg).toBe(8 + 5 - 3);
  });
  it('arcs ×3 contre les volants, armes efficaces contre les armures / cavaliers', () => {
    const bow = C({ pow: 6, w: 'arc_plastique' }); // mt 6
    expect(rates(bow, C({ def: 4, tags: ['flier'] }), 2).dmg).toBe(6 + 18 - 4);
    expect(rates(bow, C({ def: 4 }), 2).dmg).toBe(6 + 6 - 4);
    const slayer = C({ pow: 6, w: 'ouvre_boite' }); // mt 8, armor
    expect(rates(slayer, C({ def: 12, tags: ['armor'] }), 1).effective).toBe(true);
    expect(rates(slayer, C({ def: 12, tags: ['armor'] }), 1).dmg).toBe(6 + 24 - 12);
    const pike = C({ pow: 6, w: 'chasse_kebab' });
    expect(rates(pike, C({ def: 5, tags: ['horse'] }), 1).effective).toBe(true);
  });
  it('épée magique : à 2 cases elle utilise FOR/2 contre la RÉS', () => {
    const a = C({ pow: 10, w: 'epee_wifi' }); // mt 9
    const d = C({ def: 8, res: 2 });
    expect(rates(a, d, 1).dmg).toBe(10 + 9 - 8);
    expect(rates(a, d, 2).magic).toBe(true);
    expect(rates(a, d, 2).dmg).toBe(5 + 9 - 2);
  });
  it('une unité endormie n’esquive pas et ne riposte pas', () => {
    const r = rates(C({ skl: 0, lck: 0, w: 'hachette' }), C({ spd: 20, lck: 20, asleep: true, w: null }), 1);
    expect(r.hit).toBe(75);
    expect(rates(C({ asleep: true }), C(), 1).canAttack).toBe(false);
  });
});

describe('portée et riposte', () => {
  it('épée 1, lance / hache de jet 1–2, arc 2, magie 1–2', () => {
    expect(rates(C({ w: 'epee_rouillee' }), C(), 2).canAttack).toBe(false);
    expect(rates(C({ w: 'javelot_dimanche' }), C(), 2).canAttack).toBe(true);
    expect(rates(C({ w: 'hache_boomerang' }), C(), 1).canAttack).toBe(true);
    expect(rates(C({ w: 'arc_plastique' }), C(), 1).canAttack).toBe(false);
    expect(rates(C({ w: 'arc_plastique' }), C(), 2).canAttack).toBe(true);
    expect(rates(C({ w: 'arc_longue' }), C(), 3).canAttack).toBe(true);
    expect(rates(C({ w: 'patch_notes' }), C(), 1).canAttack).toBe(true);
    expect(rates(C({ w: 'patch_notes' }), C(), 2).canAttack).toBe(true);
  });
  it('riposte automatique seulement si l’arme porte', () => {
    const f1 = forecast(C({ w: 'arc_plastique' }), C({ w: 'epee_rouillee' }), 2);
    expect(f1.d.canAttack).toBe(false);
    const f2 = forecast(C({ w: 'epee_rouillee' }), C({ w: 'javelot_dimanche' }), 1);
    expect(f2.d.canAttack).toBe(true);
    const f3 = forecast(C({ w: 'epee_rouillee' }), C({ w: null }), 1);
    expect(f3.d.canAttack).toBe(false);
  });
});

describe('deux tirages (2RN)', () => {
  it('la vraie chance de toucher suit une courbe en S', () => {
    expect(trueHit(0)).toBe(0);
    expect(trueHit(100)).toBe(100);
    expect(Math.abs(trueHit(50) - 50)).toBeLessThan(1);
    expect(trueHit(80)).toBeGreaterThan(91);
    expect(trueHit(80)).toBeLessThan(93);
    expect(trueHit(30)).toBeGreaterThan(17);
    expect(trueHit(30)).toBeLessThan(19);
  });
  it('résolution : PV, usure de l’arme, critique ×3, arrêt à la mort', () => {
    // 100 % hit, 100 % crit, 4 damage ×3 = 12 per strike
    const a = C({ pow: 9, skl: 30, lck: 0, w: 'la_fourbe', classCrit: 100 });
    const d = C({ hp: 20, maxHp: 20, spd: 0, lck: 0, def: 14, w: 'epee_rouillee' });
    const fc = forecast(a, d, 1);
    expect(fc.a.hit).toBe(100);
    expect(fc.a.crit).toBe(100);
    const uses = { a: 20, d: 46 };
    const st = resolve(fc, a, d, { rng: 12345 }, uses);
    expect(st[0].crit).toBe(true);
    expect(st[0].dmg).toBe(12);
    expect(st[st.length - 1].hpAfter).toBe(0);
    // A hits, D counters, A doubles and kills: 2 uses of A's weapon
    expect(uses.a).toBe(18);
    expect(uses.d).toBe(45);
  });
  it('arme qui casse : plus de coups après la dernière utilisation', () => {
    const a = C({ spd: 20, w: 'epee_rouillee' });
    const d = C({ hp: 99, maxHp: 99, w: null });
    const fc = forecast(a, d, 1);
    const uses = { a: 1, d: 0 };
    const st = resolve(fc, a, d, { rng: 7 }, uses);
    expect(st.length).toBe(1);
    expect(st[0].broke).toBe(true);
  });
});

describe('expérience', () => {
  it('raté = 1, dégâts ≈ (31 + écart de niveau)/3, K.O. = + bonus de niveau + 20', () => {
    expect(combatExp({ level: 5, tier: 1 }, { level: 5, tier: 1 }, false, false, false)).toBe(1);
    expect(combatExp({ level: 5, tier: 1 }, { level: 5, tier: 1 }, true, false, false)).toBe(10);
    expect(combatExp({ level: 5, tier: 1 }, { level: 8, tier: 1 }, true, false, false)).toBe(11);
    expect(combatExp({ level: 5, tier: 1 }, { level: 5, tier: 1 }, true, true, false)).toBe(30);
    expect(combatExp({ level: 5, tier: 1 }, { level: 5, tier: 1 }, true, true, true)).toBe(70);
    // a promoted unit learns less from base units
    expect(combatExp({ level: 5, tier: 2 }, { level: 5, tier: 1 }, true, false, false)).toBe(3);
    expect(combatExp({ level: 20, tier: 2 }, { level: 5, tier: 1 }, true, true, false)).toBe(0);
  });
});
