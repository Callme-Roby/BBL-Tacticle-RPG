import type { App, Screen } from '../app';
import { input } from '../input/input';
import { Showroom } from '../render/showroom';
import { backButton, h, uiRoot } from '../ui/dom';
import { goTitle } from './flow';

/** Online play (step f). */
export class OnlineScreen implements Screen {
  private showroom = new Showroom();
  constructor(
    private app: App,
    private room: string | null,
  ) {}
  enter() {
    uiRoot().append(h('div', { class: 'screen dim' }, h('div', { class: 'h1' }, 'EN LIGNE'), h('div', { class: 'panel' }, `Bientôt disponible.${this.room ? ' (salle ' + this.room + ')' : ''}`), backButton(() => goTitle())));
  }
  exit() {
    this.showroom.dispose();
  }
  frame(dt: number) {
    for (const e of input.menuEvents()) if (e.action === 'back') goTitle();
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}
