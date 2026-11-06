import type { CineFx } from '../render/effects';
import type { PropId } from '../render/props';

/**
 * Short « BBL MAX » for critical hits: the title of each friend's ultimate in
 * BBL FIGHTERZ, a signature prop from its cinematic (held during the close-up)
 * and a signature effect. Off with the « coups critiques spéciaux » option.
 */
export interface CritMove {
  name: string;
  prop?: PropId;
  bone?: 'handR' | 'handL' | 'head' | 'hips';
  pos?: [number, number, number];
  /** both hands (boxing gloves) */
  pair?: boolean;
  fx: CineFx[];
}

export const CRIT_MOVES: Record<string, CritMove> = {
  elies: { name: 'RETOUR EN ENFANCE', fx: ['poof', 'exclaim'] },
  thomas: { name: 'REGARDE DERRIÈRE TOI !', fx: ['question', 'speed'] },
  dylan: { name: 'JAMBES DE FEU', fx: ['explosion', 'pain'] },
  mihai: { name: 'SUPER SAYAN BBL', prop: 'shades', bone: 'head', fx: ['powerAura', 'shine'] },
  benji: { name: "C'EST QUOI TA CONFIG ?", prop: 'phone', bone: 'handL', fx: ['question'] },
  alex: { name: 'VIENS LÀ MON MIGNON', prop: 'flask', bone: 'handL', fx: ['shine', 'confetti'] },
  isis: { name: 'MUSCLES XXL', fx: ['veins', 'powerAura'] },
  zia: { name: 'RAP CONTENDERS', prop: 'mic', bone: 'handL', fx: ['confetti', 'exclaim'] },
  clement: { name: 'ARSENAL BARBU', prop: 'bazooka', bone: 'handR', pos: [0, 0.45, 0.1], fx: ['explosion', 'smoke'] },
  enola: { name: 'SPIDER-POTE', fx: ['web', 'speed'] },
  rayan: { name: 'PACIFISTE… OU PAS', prop: 'glove', bone: 'handL', pair: true, fx: ['stars'] },
  billel: { name: 'LA MÉTA', prop: 'goggles', bone: 'head', fx: ['speed', 'exclaim'] },
  matteo: { name: 'POIL DE FION', prop: 'hairbush', bone: 'hips', pos: [0, -0.02, -0.1], fx: ['hair'] },
  aroa: { name: 'PEEK-A-BOO', prop: 'glove', bone: 'handL', pair: true, fx: ['speed', 'stars'] },
};
