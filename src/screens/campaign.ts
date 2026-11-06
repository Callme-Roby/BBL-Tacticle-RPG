import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import { CAMPAIGN } from '../data/campaign';
import type { TalkLine } from '../data/supportTalks';
import { addRecruits, applyChapterResult, chapterSetup, loadCampaign, newCampaign, nextChapter, saveCampaign, speakerLook, type CampaignSave } from '../game/campaign';
import type { MatchInfo } from '../game/match';
import { fullRoster } from '../game/settings';
import { input } from '../input/input';
import { loadFace } from '../render/faceTexture';
import { Showroom } from '../render/showroom';
import { registerTacticsClips } from '../render/tacticsPoses';
import type { BattleState } from '../rules/battle';
import { CLASSES } from '../rules/classes';
import { getMap } from '../rules/maps';
import { backButton, h, uiRoot } from '../ui/dom';
import { getApp, goBattle, goTitle } from './flow';
import { objectiveText } from './battle';
import { minimap } from './setup';

/**
 * Campaign menu: new campaign (Classique / Décontracté), the chapters, the
 * crew; then for each chapter: intro talk → battle → outro talk.
 */
export class CampaignScreen implements Screen {
  private showroom = new Showroom();
  private save: CampaignSave | null = loadCampaign();

  constructor(private app: App) {}

  enter() {
    const s = this.save;
    if (s && s.stage === 'outro' && !s.done) {
      // a won battle: its outro talk, then the next chapter
      const ch = CAMPAIGN[s.chapter];
      this.app.go(
        new TalkScreen(this.app, ch.outro, `${ch.title} — VICTOIRE`, () => {
          nextChapter(s);
          getApp().go(new CampaignScreen(getApp()));
        }),
      );
      return;
    }
    this.render();
    audio.playMusic('select');
  }

  private render() {
    const s = this.save;
    const root = uiRoot();
    root.replaceChildren();
    if (!s) {
      const mode = (m: CampaignSave['mode'], label: string, desc: string) => {
        const b = h('button', { class: 'promo-opt' }, h('b', null, label), h('span', null, desc));
        b.addEventListener('click', () => {
          audio.sfx('confirm');
          this.save = newCampaign(m);
          this.render();
        });
        return b;
      };
      root.append(
        h(
          'div',
          { class: 'screen dim scroll' },
          h('div', { class: 'h1' }, 'CAMPAGNE'),
          h('div', { class: 'panel options' }, h('div', { class: 'cp-title' }, 'LA PHOTOCOPIEUSE À POTES'), h('div', { class: 'field-desc' }, 'Le Doc a voulu rendre la bande immortelle. Sa machine a raté : des Faux Potes aux couleurs bizarres envahissent la ville. 5 chapitres, avec Mihaï comme chef — s’il tombe, on recommence le chapitre.')),
          h('div', { class: 'promo-list', style: 'width:min(720px,100%)' }, mode('classic', 'CLASSIQUE', 'Un pote K.O. est perdu pour le reste de la campagne. Pour les vrais.'), mode('casual', 'DÉCONTRACTÉ', 'Les potes K.O. reviennent au chapitre suivant. Pour profiter de l’histoire.')),
          backButton(() => goTitle()),
        ),
      );
      return;
    }
    const chapters = CAMPAIGN.map((ch, i) => {
      const done = i < s.chapter;
      const cur = i === s.chapter && !s.done;
      return h('div', { class: 'cp-ch' + (done ? ' done' : '') + (cur ? ' cur' : '') }, minimap(getMap(ch.mapId), 3), h('div', null, h('b', null, `${ch.title} · ${ch.subtitle}`), h('small', null, done ? 'Terminé ✓' : cur ? 'À jouer' : 'Verrouillé')));
    });
    const crew = s.units.map((u) =>
      h('div', { class: 'cp-unit' }, h('b', null, (fullRoster().find((d) => d.id === u.defId)?.name ?? u.defId).toUpperCase()), h('small', null, `${CLASSES[u.cls].name} ${u.level}`)),
    );
    const play = h('button', { class: 'btn primary' }, s.done ? 'CAMPAGNE TERMINÉE !' : `JOUER : ${CAMPAIGN[s.chapter].title}`);
    play.disabled = s.done;
    play.addEventListener('click', () => {
      audio.sfx('confirm');
      this.playChapter();
    });
    const reset = h('button', { class: 'btn small' }, 'NOUVELLE CAMPAGNE');
    reset.addEventListener('click', () => {
      if (!confirm('Effacer la campagne en cours ?')) return;
      this.save = null;
      try {
        localStorage.removeItem('bbltactics.campaign');
      } catch {
        /* ignore */
      }
      this.render();
    });
    root.append(
      h(
        'div',
        { class: 'screen dim scroll' },
        h('div', { class: 'h1' }, 'CAMPAGNE'),
        h('div', { class: 'cp-mode' }, s.mode === 'classic' ? 'Mode CLASSIQUE' : 'Mode DÉCONTRACTÉ', s.fallen.length ? ` · tombés : ${s.fallen.map((x) => x.toUpperCase()).join(', ')}` : ''),
        h('div', { class: 'cp-list' }, ...chapters),
        crew.length ? h('div', { class: 'panel cp-crew' }, h('div', { class: 'field' }, 'LA BANDE'), h('div', { class: 'cp-units' }, ...crew)) : null,
        play,
        reset,
        backButton(() => goTitle()),
      ),
    );
  }

  private playChapter() {
    const s = this.save!;
    const i = s.chapter;
    const ch = CAMPAIGN[i];
    addRecruits(s, ch);
    saveCampaign(s);
    const start = () => {
      s.stage = 'battle';
      saveCampaign(s);
      const setup = chapterSetup(s, i);
      const info: MatchInfo = { mode: 'campaign', setup, controllers: ['human', 'ai'], ai: 'normal', chapter: i, looks: {} };
      goBattle(info);
    };
    if (s.stage === 'intro') this.app.go(new TalkScreen(this.app, ch.intro, `${ch.title} — ${ch.subtitle.toUpperCase()}`, start, objectiveText({ objective: { ...ch.objective }, teams: [{ name: 'LA BANDE' }, { name: 'FAUX POTES' }] } as unknown as BattleState, true)));
    else start();
  }

  exit() {
    this.showroom.dispose();
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) {
      if (e.action === 'back') goTitle();
      if (e.action === 'confirm') (uiRoot().querySelector('.btn.primary, .promo-opt') as HTMLButtonElement | null)?.click();
    }
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}

/** results screen → campaign progress */
export function campaignAfterBattle(info: MatchInfo, state: BattleState) {
  const s = loadCampaign();
  if (!s || info.chapter !== s.chapter) return;
  applyChapterResult(s, state);
}

/**
 * A conversation scene: the two speakers in 3D (showroom), a comic-style text
 * box with the current line (read aloud), tap to go on, PASSER to skip.
 */
export class TalkScreen implements Screen {
  private showroom = new Showroom();
  private i = -1;
  private box!: HTMLElement;
  private slots: (string | null)[] = [null, null];
  private ended = false;

  constructor(
    private app: App,
    private lines: TalkLine[],
    private title: string,
    private done: () => void,
    private goal = '',
  ) {
    registerTacticsClips();
  }

  enter() {
    this.box = h('div', { class: 'talk-box' });
    const skip = h('button', { class: 'btn small talk-skip' }, 'PASSER ▶▶');
    skip.addEventListener('click', (e) => {
      e.stopPropagation();
      this.finish();
    });
    const root = h('div', { class: 'screen talk-screen' }, h('div', { class: 'talk-head' }, h('b', null, this.title), this.goal ? h('small', null, 'Objectif : ' + this.goal) : null), skip, this.box);
    root.addEventListener('click', () => this.next());
    uiRoot().append(root);
    this.showroom.positions = [-0.95, 0.95];
    this.next();
  }

  private next() {
    if (this.ended) return;
    this.i++;
    if (this.i >= this.lines.length) return this.finish();
    const [who, text] = this.lines[this.i];
    const look = speakerLook(who);
    if (look.def) {
      // keep each speaker on its side: a new one replaces the one who spoke longest ago
      let slot = this.slots.indexOf(who);
      if (slot < 0) {
        slot = this.lastSlot === 0 ? 1 : 0;
        this.slots[slot] = who;
        void this.showroom.show(slot as 0 | 1, look.def);
      }
      this.lastSlot = slot;
      this.showroom.play(slot as 0 | 1, 'cheer');
      void loadFace(look.def).then((f) => {
        const el = this.box.querySelector('.tface') as HTMLElement | null;
        if (el && this.lines[this.i]?.[0] === who) el.style.backgroundImage = `url(${f.portraitUrl})`;
      });
      void audio.say(text, { lang: look.def.voice?.lang ?? 'fr-FR', pitch: look.def.voice?.pitch, rate: look.def.voice?.rate });
    }
    const side = this.lastSlot === 1 ? 't1' : 't0';
    this.box.replaceChildren(
      look.def
        ? h('div', { class: 'talk-line ' + side }, h('div', { class: 'tface ' + side }), h('div', null, h('b', null, look.name), h('span', null, text)))
        : h('div', { class: 'talk-line narr' }, h('div', null, h('span', null, text))),
    );
    audio.sfx('cursor', { volume: 0.4 });
  }

  private lastSlot = 1;

  private finish() {
    if (this.ended) return;
    this.ended = true;
    this.done();
  }

  exit() {
    this.showroom.dispose();
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) {
      if (e.action === 'confirm') this.next();
      if (e.action === 'back' || e.action === 'start') this.finish();
    }
    // both speakers in view, even on a phone held upright
    this.showroom.positions = this.app.aspect < 1 ? [-0.58, 0.58] : [-0.95, 0.95];
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}
