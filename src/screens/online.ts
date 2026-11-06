import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import { loadSupports } from '../game/profileStore';
import { fullRoster, sanitizeDef } from '../game/settings';
import type { MatchInfo } from '../game/match';
import { input } from '../input/input';
import { inviteUrl, NetError, NetLink, NET_VERSION, preloadNet, type NetMsg, type NetTeam } from '../net/peer';
import { OnlineSession } from '../net/session';
import { Showroom } from '../render/showroom';
import type { BattleSetup } from '../rules/battle';
import { MAPS } from '../rules/maps';
import { FORMATS } from '../rules/teams';
import { backButton, h, uiRoot } from '../ui/dom';
import { goBattle, goTitle } from './flow';
import { buildSetup, minimap, type MatchOptions } from './setup';
import { TeamBuilder } from './teamBuilder';

type Step = 'menu' | 'hosting' | 'joining' | 'lobby' | 'error';

const OBJ_NAMES: Record<string, string> = { rout: 'DÉROUTE', boss: 'LE CHEF', seize: 'LE TRÔNE', defend: 'DÉFENSE', escape: 'LA FUITE' };

/**
 * Online play by invitation link: the host creates a room and sends the link,
 * the friend opens it; both compose their team (the host picks the map and the
 * rules), then the battle starts (the host plays blue, the guest red).
 */
export class OnlineScreen implements Screen {
  private showroom = new Showroom();
  private step: Step = 'menu';
  private link: NetLink | null = null;
  private status = '';
  private error = '';
  private opts: MatchOptions = { mapId: 'parc', objective: 'rout', format: 'confirmes', fog: false, ai: 'normal', first: 0, turns: 0 };
  private builder: TeamBuilder | null = null;
  private myReady = false;
  private theirTeam: NetTeam | null = null;
  private theirReady = false;
  private started = false;
  private off: (() => void)[] = [];
  private myName = 'BLEUS';

  constructor(
    private app: App,
    private room: string | null,
  ) {}

  enter() {
    void preloadNet().catch(() => {});
    if (this.room) void this.join(this.room);
    else this.render();
  }

  exit() {
    for (const f of this.off) f();
    this.showroom.dispose();
    // the link lives on in the battle (OnlineSession) once started
    if (!this.started) this.link?.close();
  }

  private render() {
    const root = uiRoot();
    root.replaceChildren();
    switch (this.step) {
      case 'menu':
        root.append(this.menuView());
        break;
      case 'hosting':
      case 'joining':
        root.append(this.waitView());
        break;
      case 'lobby':
        root.append(this.lobbyView());
        break;
      case 'error':
        root.append(h('div', { class: 'screen dim' }, h('div', { class: 'h1' }, 'EN LIGNE'), h('div', { class: 'panel status err' }, this.error), backButton(() => goTitle())));
        break;
    }
  }

  private menuView(): HTMLElement {
    const create = h('button', { class: 'btn primary' }, 'CRÉER UNE PARTIE', h('span', { class: 'sub' }, 'Tu envoies le lien à ton pote'));
    create.addEventListener('click', () => void this.host());
    const code = h('input', { class: 'team-name', placeholder: 'CODE', maxlength: '12', 'aria-label': 'Code de la partie' }) as HTMLInputElement;
    const join = h('button', { class: 'btn' }, 'REJOINDRE');
    join.addEventListener('click', () => {
      const c = code.value.trim().toLowerCase();
      if (/^[a-z0-9]{4,12}$/.test(c)) void this.join(c);
    });
    return h(
      'div',
      { class: 'screen dim' },
      h('div', { class: 'h1' }, 'EN LIGNE'),
      h('div', { class: 'panel options' }, create, h('div', { class: 'field' }, 'OU ENTRE LE CODE DE TON POTE', code, join), h('div', { class: 'field-desc' }, 'Le plus simple : ton pote t’envoie son lien et tu l’ouvres. Chacun joue sur son téléphone, tour par tour : pas besoin d’être connectés en même temps à la seconde près, une coupure se rattrape toute seule.')),
      backButton(() => goTitle()),
    );
  }

  private waitView(): HTMLElement {
    const kids: HTMLElement[] = [h('div', { class: 'h1' }, this.step === 'hosting' ? 'TA PARTIE' : 'CONNEXION…'), h('div', { class: 'panel status' }, this.status)];
    if (this.step === 'hosting' && this.link) {
      const url = inviteUrl(this.link.code);
      const share = h('button', { class: 'btn primary' }, 'ENVOYER LE LIEN');
      share.addEventListener('click', async () => {
        try {
          if (navigator.share) await navigator.share({ title: 'BBL TACTICS', text: 'Viens te battre sur BBL TACTICS !', url });
          else {
            await navigator.clipboard.writeText(url);
            share.textContent = 'LIEN COPIÉ !';
          }
        } catch {
          /* cancelled */
        }
      });
      const copy = h('button', { class: 'btn' }, 'COPIER');
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(url);
          copy.textContent = 'COPIÉ !';
        } catch {
          /* ignore */
        }
      });
      kids.push(h('div', { class: 'panel options' }, h('div', { class: 'field' }, 'CODE', h('b', { class: 'room-code' }, this.link.code.toUpperCase())), h('div', { class: 'field-desc' }, url), h('div', { class: 'bt-row' }, share, copy), h('div', { class: 'field-desc' }, 'Garde cette page affichée pendant que ton pote ouvre le lien.')));
    }
    return h('div', { class: 'screen dim' }, ...kids, backButton(() => goTitle()));
  }

  private setStatus(s: string) {
    this.status = s;
    const el = uiRoot().querySelector('.panel.status');
    if (el) el.textContent = s;
  }

  private fail(e: unknown) {
    this.step = 'error';
    this.error = e instanceof NetError ? e.message : 'Connexion impossible : ' + String((e as Error)?.message ?? e);
    this.render();
  }

  private async host() {
    this.step = 'hosting';
    this.status = 'Création de la partie…';
    this.render();
    try {
      this.link = await NetLink.host((s) => this.setStatus(s));
      this.myName = 'BLEUS';
      this.status = 'En attente de ton pote…';
      this.render();
      await this.link.waitForGuest();
      this.connected();
    } catch (e) {
      this.fail(e);
    }
  }

  private async join(code: string) {
    this.step = 'joining';
    this.status = 'Connexion…';
    this.render();
    try {
      this.link = await NetLink.join(code, (s) => this.setStatus(s));
      this.myName = 'ROUGES';
      // the address bar keeps the invitation: clean it so a reload doesn't rejoin forever
      history.replaceState(null, '', location.pathname);
      this.connected();
    } catch (e) {
      this.fail(e);
    }
  }

  private connected() {
    const link = this.link!;
    audio.sfx('confirm');
    this.off.push(link.on((m) => this.receive(m)));
    this.off.push(
      link.onClose((reason) => {
        if (this.started) return;
        this.fail(new Error(reason));
      }),
    );
    link.send({ t: 'hello', version: NET_VERSION, name: this.myName });
    if (link.isHost) link.send({ t: 'opts', opts: this.opts });
    this.step = 'lobby';
    this.render();
  }

  private receive(m: NetMsg) {
    switch (m.t) {
      case 'hello':
        if (m.version !== NET_VERSION) this.fail(new Error('Vous n’avez pas la même version du jeu : rechargez la page tous les deux.'));
        return;
      case 'opts':
        if (!this.link?.isHost) {
          this.opts = { ...this.opts, ...(m.opts as MatchOptions) };
          this.renderOpts();
        }
        return;
      case 'team':
        this.theirTeam = m.team;
        this.theirReady = m.ready;
        this.renderStatus();
        this.maybeStart();
        return;
      case 'start':
        if (!this.link?.isHost) this.startBattle(m.setup as BattleSetup, m.looks);
        return;
      case 'leave':
        if (!this.started) this.fail(new Error('Ton pote a quitté la partie.'));
        return;
      default:
        return;
    }
  }

  private optsBox = h('div', { class: 'panel options' });
  private statusBox = h('div', { class: 'lobby-status' });
  private readyBtn = h('button', { class: 'btn primary' }, 'PRÊT !');

  private lobbyView(): HTMLElement {
    const format = FORMATS.find((f) => f.id === this.opts.format) ?? FORMATS[1];
    this.builder = new TeamBuilder(fullRoster(), format, this.link?.isHost ? 0 : 1, this.link?.isHost ? 'TON ÉQUIPE (BLEUE)' : 'TON ÉQUIPE (ROUGE)', () => {
      this.readyBtn.disabled = !this.builder || this.builder.picks.length === 0;
      if (this.myReady) {
        this.myReady = false;
        this.sendTeam();
      }
    });
    this.readyBtn = h('button', { class: 'btn primary' }, 'PRÊT !');
    this.readyBtn.addEventListener('click', () => {
      if (!this.builder?.picks.length) return;
      this.myReady = !this.myReady;
      audio.sfx(this.myReady ? 'confirm' : 'cancel');
      this.sendTeam();
      this.renderStatus();
      this.maybeStart();
    });
    this.renderOpts();
    this.renderStatus();
    return h('div', { class: 'screen dim team-screen scroll' }, h('div', { class: 'h1' }, 'EN LIGNE'), this.optsBox, this.statusBox, this.builder.el, this.readyBtn, backButton(() => goTitle()));
  }

  private sendTeam() {
    const b = this.builder;
    if (!b || !this.link) return;
    const customs = fullRoster().filter((d) => d.custom && b.picks.some((p) => p.defId === d.id));
    const team: NetTeam = { name: this.myName, picks: b.picks, looks: customs, supports: loadSupports() };
    this.link.send({ t: 'team', team, ready: this.myReady });
  }

  /** match options: editable by the host, shown to the guest */
  private renderOpts() {
    const host = !!this.link?.isHost;
    const map = MAPS.find((m) => m.id === this.opts.mapId) ?? MAPS[0];
    const fmt = FORMATS.find((f) => f.id === this.opts.format) ?? FORMATS[1];
    const line = `${map.name} · ${OBJ_NAMES[this.opts.objective] ?? ''} · ${fmt.name} · brouillard ${this.opts.fog ? 'oui' : 'non'}`;
    if (!host) {
      this.optsBox.replaceChildren(h('div', { class: 'field' }, 'RÈGLES CHOISIES PAR TON POTE'), h('div', { class: 'lobby-opts' }, minimap(map, 4), h('span', null, line)));
      return;
    }
    const cycle = <T,>(label: string, values: T[], get: () => T, set: (v: T) => void, show: (v: T) => string) => {
      const b = h('button', { class: 'btn small' }, `${label} : ${show(get())}`);
      b.addEventListener('click', () => {
        const i = values.indexOf(get());
        set(values[(i + 1) % values.length]);
        this.link?.send({ t: 'opts', opts: this.opts });
        audio.sfx('cursor');
        this.renderOpts();
      });
      return b;
    };
    this.optsBox.replaceChildren(
      h('div', { class: 'field' }, 'RÈGLES (TU CHOISIS)'),
      h('div', { class: 'lobby-opts' }, minimap(map, 4), h('span', null, line)),
      h(
        'div',
        { class: 'chips wrap' },
        cycle('CARTE', MAPS.map((m) => m.id), () => this.opts.mapId, (v) => (this.opts.mapId = v), (v) => MAPS.find((m) => m.id === v)!.name),
        cycle('OBJECTIF', ['rout', 'boss', 'seize', 'defend', 'escape'] as MatchOptions['objective'][], () => this.opts.objective, (v) => (this.opts.objective = v), (v) => OBJ_NAMES[v]),
        cycle('NIVEAU', FORMATS.map((f) => f.id), () => this.opts.format, (v) => (this.opts.format = v), (v) => FORMATS.find((f) => f.id === v)!.name),
        cycle('BROUILLARD', [false, true], () => this.opts.fog, (v) => (this.opts.fog = v), (v) => (v ? 'OUI' : 'NON')),
      ),
    );
  }

  private renderStatus() {
    const them = this.theirTeam ? `${this.theirTeam.picks.length} potes` : 'compose son équipe…';
    this.statusBox.replaceChildren(h('span', { class: this.theirReady ? 'ok' : '' }, `Ton pote : ${this.theirReady ? 'PRÊT ✓' : them}`), h('span', { class: this.myReady ? 'ok' : '' }, `Toi : ${this.myReady ? 'PRÊT ✓' : 'compose ton équipe'}`));
    this.readyBtn.textContent = this.myReady ? 'ANNULER « PRÊT »' : 'PRÊT !';
  }

  /** host: both ready → the battle */
  private maybeStart() {
    const link = this.link;
    if (!link?.isHost || !this.myReady || !this.theirReady || !this.theirTeam || !this.builder || this.started) return;
    const guest = this.theirTeam;
    const looks = guest.looks.map((d) => sanitizeDef(d));
    const objective = this.opts.objective === 'seize' && !['parc', 'quartier', 'collines', 'plage', 'neige', 'chateau'].includes(this.opts.mapId) ? 'rout' : this.opts.objective;
    const setup = buildSetup({ ...this.opts, objective }, [this.myName, guest.name || 'ROUGES'], [this.builder.picks, guest.picks]);
    setup.teams[0].supports = loadSupports();
    setup.teams[1].supports = guest.supports;
    const myLooks = fullRoster().filter((d) => d.custom && this.builder!.picks.some((p) => p.defId === d.id));
    link.send({ t: 'start', setup, looks: [...myLooks, ...looks] });
    this.startBattle(setup, [...myLooks, ...looks]);
  }

  private startBattle(setup: BattleSetup, looksIn: unknown[]) {
    if (this.started || !this.link) return;
    this.started = true;
    for (const f of this.off.splice(0)) f();
    const looks: MatchInfo['looks'] = {};
    for (const d of looksIn as Parameters<typeof sanitizeDef>[0][]) {
      const s = sanitizeDef(d);
      looks[s.id] = s;
    }
    const host = this.link.isHost;
    const info: MatchInfo = { mode: 'online', setup, controllers: host ? ['human', 'remote'] : ['remote', 'human'], ai: 'normal', localTeam: host ? 0 : 1, looks };
    const session = new OnlineSession(this.link, host, this.link.code);
    goBattle(info, undefined, [], session);
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) if (e.action === 'back') goTitle();
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}
