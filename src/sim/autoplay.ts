import { chooseAction, type AiLevel } from '../ai/ai';
import { applyAction, createBattle, type BattleSetup, type BattleState } from '../rules/battle';
import type { Team } from '../rules/types';

/** Plays a whole battle AI against AI (balance simulator, tests). */
export function autoplay(setup: BattleSetup, levels: [AiLevel, AiLevel] = ['normal', 'normal'], maxTurns = 40): { state: BattleState; winner: Team | null; turns: number; actions: number } {
  const s = createBattle(setup);
  let actions = 0;
  let guard = 0;
  while (s.winner === null && s.turn <= maxTurns && guard++ < 5000) {
    const a = chooseAction(s, levels[s.phase], setup.seed + actions);
    try {
      applyAction(s, a);
    } catch (e) {
      // a bad AI choice must never stall the game: the unit just waits
      if (a.k !== 'end' && 'uid' in a) applyAction(s, { k: 'wait', uid: a.uid, x: s.units.find((u) => u.uid === a.uid)!.x, y: s.units.find((u) => u.uid === a.uid)!.y });
      else throw e;
    }
    actions++;
  }
  return { state: s, winner: s.winner, turns: s.turn, actions };
}
