import type { App, Screen } from '../app';
import type { MatchInfo } from '../game/match';
import { input } from '../input/input';
import { Showroom } from '../render/showroom';
import type { BattleState } from '../rules/battle';
import { backButton, h, uiRoot } from '../ui/dom';
import { goTitle } from './flow';

/** Campaign (step g). */
export class CampaignScreen implements Screen {
  private showroom = new Showroom();
  constructor(private app: App) {}
  enter() {
    uiRoot().append(h('div', { class: 'screen dim' }, h('div', { class: 'h1' }, 'CAMPAGNE'), h('div', { class: 'panel' }, 'Bientôt disponible.'), backButton(() => goTitle())));
  }
  exit() {
    this.showroom.dispose();
  }
  frame(dt: number) {
    for (const e of input.menuEvents()) if (e.action === 'back') goTitle();
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}

export function campaignAfterBattle(info: MatchInfo, state: BattleState) {
  void info;
  void state;
}
