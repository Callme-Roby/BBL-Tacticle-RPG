import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import { unitLook, type MatchInfo } from '../game/match';
import { input } from '../input/input';
import { loadFace } from '../render/faceTexture';
import { Showroom } from '../render/showroom';
import type { BattleState } from '../rules/battle';
import { CLASSES } from '../rules/classes';
import type { Team } from '../rules/types';
import { h, uiRoot } from '../ui/dom';
import { goBattle, goCampaign, goTitle } from './flow';
import { campaignAfterBattle } from './campaign';

/** End of a battle: who won and why, the MVP cheering in 3D, the units' tally. */
export class ResultsScreen implements Screen {
  private showroom = new Showroom();

  constructor(
    private app: App,
    private info: MatchInfo,
    private state: BattleState,
  ) {}

  enter() {
    const s = this.state;
    const w = s.winner ?? 0;
    const human = this.info.controllers[w] === 'human';
    const vsAi = this.info.controllers.includes('ai');
    const online = this.info.mode === 'online';
    const mine = online ? this.info.localTeam === w : human;
    const title = vsAi || online ? (mine ? 'VICTOIRE !' : 'DÉFAITE…') : `VICTOIRE DES ${s.teams[w].name} !`;
    // MVP: most kills, then most HP left
    const team = s.units.filter((u) => u.team === w);
    const mvp = [...team].sort((a, b) => b.kills - a.kills || Number(b.alive) - Number(a.alive) || b.hp - a.hp)[0];
    if (mvp) {
      const def = unitLook(this.info, mvp);
      void this.showroom.show(0, def).then(() => this.showroom.play(0, 'win0'));
      void loadFace(def);
    }
    this.showroom.positions = [0, 99];
    audio.playMusic(mine || !vsAi ? 'victory' : 'select');
    void audio.say(mine || !vsAi ? 'Victoire !' : 'Défaite…', { lang: 'fr-FR' });
    const rows = (t: Team) =>
      s.units
        .filter((u) => u.team === t)
        .map((u) =>
          h(
            'div',
            { class: 'rs-row t' + t + (u.alive ? '' : ' ko') },
            h('b', null, (u.leader ? '★ ' : '') + u.name),
            h('small', null, `${CLASSES[u.cls].name} ${u.level}`),
            h('span', null, u.escaped ? 'ENFUI' : u.alive ? `${u.hp} PV` : 'K.O.'),
            h('em', null, u.kills ? `${u.kills} K.O.` : ''),
          ),
        );
    const again = h('button', { class: 'btn primary' }, this.info.mode === 'campaign' ? 'CONTINUER' : 'REVANCHE');
    again.addEventListener('click', () => {
      audio.sfx('confirm');
      if (this.info.mode === 'campaign') {
        campaignAfterBattle(this.info, this.state);
        goCampaign();
        return;
      }
      const setup = { ...this.info.setup, seed: Math.floor(Math.random() * 2 ** 31) };
      goBattle({ ...this.info, setup });
    });
    if (online) again.style.display = 'none';
    const menu = h('button', { class: 'btn' }, 'MENU');
    menu.addEventListener('click', () => {
      if (this.info.mode === 'campaign') campaignAfterBattle(this.info, this.state);
      goTitle();
    });
    uiRoot().append(
      h(
        'div',
        { class: 'screen results' },
        h('div', { class: 'h1 rs-title t' + w }, title),
        h('div', { class: 'rs-reason' }, s.winReason, ` (tour ${s.turn})`),
        mvp ? h('div', { class: 'rs-mvp' }, `MEILLEUR POTE : ${mvp.name}`) : null,
        h('div', { class: 'rs-tables' }, h('div', { class: 'rs-col' }, h('b', null, s.teams[0].name), ...rows(0)), h('div', { class: 'rs-col' }, h('b', null, s.teams[1].name), ...rows(1))),
        h('div', { class: 'rs-btns' }, menu, again),
      ),
    );
  }

  exit() {
    this.showroom.dispose();
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) if (e.action === 'confirm' || e.action === 'back') (uiRoot().querySelector('.rs-btns .btn') as HTMLButtonElement | null)?.click();
    this.showroom.fit = null;
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}
