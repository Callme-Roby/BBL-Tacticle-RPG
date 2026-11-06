import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import { loadSupports } from '../game/profileStore';
import { fullRoster, saveSettings, settings, type AiLevel } from '../game/settings';
import type { MatchInfo } from '../game/match';
import { input } from '../input/input';
import { Showroom } from '../render/showroom';
import type { BattleSetup, ObjectiveKind } from '../rules/battle';
import { MAPS, parseMap, type MapDef } from '../rules/maps';
import { FORMATS, skirmishTeam, type Format } from '../rules/teams';
import type { Team } from '../rules/types';
import { backButton, h, uiRoot } from '../ui/dom';
import { goBattle, goTitle } from './flow';
import { TeamBuilder, type Pick } from './teamBuilder';

export type SetupKind = 'skirmish' | 'local';

export interface MatchOptions {
  mapId: string;
  objective: ObjectiveKind;
  format: string;
  fog: boolean;
  ai: AiLevel;
  first: Team;
  turns: number;
}

const OBJECTIVES: { id: ObjectiveKind; name: string; desc: string }[] = [
  { id: 'rout', name: 'DÉROUTE', desc: 'Vaincre toute l’équipe adverse.' },
  { id: 'boss', name: 'LE CHEF', desc: 'Vaincre le chef adverse (★).' },
  { id: 'seize', name: 'LE TRÔNE', desc: 'Ton chef capture le trône adverse (ou tu bats son chef).' },
  { id: 'defend', name: 'DÉFENSE', desc: 'Les rouges tiennent 12 tours, les bleus doivent tout vaincre.' },
  { id: 'escape', name: 'LA FUITE', desc: 'Le chef bleu s’enfuit par le bord rouge en 15 tours, les rouges l’en empêchent.' },
];

/** small top view of a map (spawns in team colours) */
export function minimap(def: MapDef, px = 6): HTMLCanvasElement {
  const m = parseMap(def);
  const c = document.createElement('canvas');
  c.width = m.w * px;
  c.height = m.h * px;
  const ctx = c.getContext('2d')!;
  const col: Record<string, string> = {
    plain: '#5c9a3c',
    road: '#b59a6a',
    floor: '#a0a0a8',
    forest: '#2f6a2c',
    hill: '#8a9a48',
    mountain: '#7a746c',
    wall: '#4a4650',
    pillar: '#8a8690',
    fort: '#c8b080',
    village: '#c86a40',
    river: '#2f78c0',
    bridge: '#8a5a32',
    sea: '#2a8ac8',
    sand: '#d8c48a',
    throne: '#e0b030',
  };
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      ctx.fillStyle = col[m.tiles[y * m.w + x]] ?? '#000';
      ctx.fillRect(x * px, y * px, px, px);
    }
  for (const [t, list] of m.spawns.entries()) {
    ctx.fillStyle = t === 0 ? '#5ab0ff' : '#ff6a50';
    for (const p of list.slice(0, 10)) ctx.fillRect(p.x * px + 1, p.y * px + 1, px - 2, px - 2);
  }
  return c;
}

export function objectiveFor(o: MatchOptions): BattleSetup['objective'] {
  switch (o.objective) {
    case 'defend':
      return { kind: 'defend', turns: o.turns || 12, attacker: 0 };
    case 'escape':
      return { kind: 'escape', turns: o.turns || 15, attacker: 0 };
    default:
      return { kind: o.objective, turns: o.turns, attacker: 0 };
  }
}

/** turns the two teams' picks into a battle setup (the copy of a friend present in both teams wears other colours) */
export function buildSetup(o: MatchOptions, names: [string, string], picks: [Pick[], Pick[]], seed = Math.floor(Math.random() * 2 ** 31)): BattleSetup {
  const format = FORMATS.find((f) => f.id === o.format) ?? FORMATS[1];
  const ids0 = new Set(picks[0].map((p) => p.defId));
  const t0 = skirmishTeam(picks[0], format);
  const t1 = skirmishTeam(
    picks[1].map((p) => ({ ...p, alt: ids0.has(p.defId) })),
    format,
  );
  return {
    mapId: o.mapId,
    teams: [
      { name: names[0], units: t0 },
      { name: names[1], units: t1 },
    ],
    objective: objectiveFor(o),
    fog: o.fog,
    seed,
    first: o.first,
  };
}

function chips<T extends string | number | boolean>(options: [T, string][], get: () => T, set: (v: T) => void) {
  const wrap = h('div', { class: 'chips' });
  const render = () => {
    wrap.replaceChildren(
      ...options.map(([v, label]) => {
        const b = h('button', { class: get() === v ? 'on' : '' }, label);
        b.addEventListener('click', () => {
          set(v);
          audio.sfx('cursor');
          render();
        });
        return b;
      }),
    );
  };
  render();
  return wrap;
}

const LAST_KEY = 'bbltactics.lastSetup';

/** Match options, then each team's composition, then the battle. */
export class SetupScreen implements Screen {
  private showroom = new Showroom();
  private step: 'options' | 'team0' | 'team1' = 'options';
  private opts: MatchOptions;
  private picks: [Pick[], Pick[]] = [[], []];
  private names: [string, string];

  constructor(
    private app: App,
    private kind: SetupKind,
  ) {
    let last: Partial<MatchOptions> & { picks?: [Pick[], Pick[]] } = {};
    try {
      last = JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}');
    } catch {
      /* ignore */
    }
    this.opts = { mapId: 'parc', objective: 'rout', format: 'confirmes', fog: false, ai: settings.ai, first: 0, turns: 0, ...last };
    if (last.picks && kind === 'skirmish') this.picks[0] = last.picks[0] ?? [];
    if (last.picks && kind === 'local') this.picks = last.picks;
    this.names = kind === 'skirmish' ? ['TOI', 'L’ORDI'] : ['BLEUS', 'ROUGES'];
  }

  enter() {
    this.render();
  }

  exit() {
    this.showroom.dispose();
  }

  private remember() {
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({ ...this.opts, picks: this.picks }));
    } catch {
      /* ignore */
    }
  }

  private get format(): Format {
    return FORMATS.find((f) => f.id === this.opts.format) ?? FORMATS[1];
  }

  private render() {
    const root = uiRoot();
    root.replaceChildren();
    if (this.step === 'options') root.append(this.optionsView());
    else root.append(this.teamView(this.step === 'team0' ? 0 : 1));
  }

  private optionsView(): HTMLElement {
    const maps = h('div', { class: 'maps' });
    const renderMaps = () => {
      maps.replaceChildren(
        ...MAPS.map((m) => {
          const card = h('button', { class: 'map-card' + (m.id === this.opts.mapId ? ' on' : '') }, minimap(m, 5), h('b', null, m.name), h('small', null, m.desc));
          card.addEventListener('click', () => {
            this.opts.mapId = m.id;
            if (m.id === 'chateau' && this.opts.objective === 'rout') this.opts.objective = 'seize';
            audio.sfx('cursor');
            renderMaps();
            renderObj();
          });
          return card;
        }),
      );
    };
    const objWrap = h('div', { class: 'field' });
    const renderObj = () => {
      const def = MAPS.find((m) => m.id === this.opts.mapId)!;
      const hasThrone = parseMap(def).thrones.some(Boolean);
      const list = OBJECTIVES.filter((o) => o.id !== 'seize' || hasThrone);
      if (!list.some((o) => o.id === this.opts.objective)) this.opts.objective = 'rout';
      const cur = OBJECTIVES.find((o) => o.id === this.opts.objective)!;
      objWrap.replaceChildren(
        'OBJECTIF',
        chips(
          list.map((o) => [o.id, o.name] as [ObjectiveKind, string]),
          () => this.opts.objective,
          (v) => {
            this.opts.objective = v;
            renderObj();
          },
        ),
        h('small', { class: 'field-desc' }, cur.desc),
      );
    };
    renderMaps();
    renderObj();
    const fmtDesc = h('small', { class: 'field-desc' }, this.format.desc);
    const fields = [
      h('div', { class: 'field' }, 'CARTE', maps),
      objWrap,
      h(
        'div',
        { class: 'field' },
        'NIVEAU DES ÉQUIPES',
        chips(
          FORMATS.map((f) => [f.id, f.name] as [string, string]),
          () => this.opts.format,
          (v) => {
            this.opts.format = v;
            fmtDesc.textContent = this.format.desc;
          },
        ),
        fmtDesc,
      ),
      h('div', { class: 'field' }, 'BROUILLARD DE GUERRE', chips([[false, 'NON'], [true, 'OUI']], () => this.opts.fog, (v) => (this.opts.fog = v))),
      this.kind === 'skirmish'
        ? h(
            'div',
            { class: 'field' },
            'NIVEAU DE L’ORDINATEUR',
            chips(
              [
                ['easy', 'FACILE'],
                ['normal', 'NORMAL'],
                ['hard', 'DIFFICILE'],
              ],
              () => this.opts.ai,
              (v) => {
                this.opts.ai = v;
                settings.ai = v;
                saveSettings();
              },
            ),
          )
        : null,
      h('div', { class: 'field' }, 'QUI COMMENCE', chips([[0 as Team, this.names[0]], [1 as Team, this.names[1]]], () => this.opts.first, (v) => (this.opts.first = v))),
      h(
        'div',
        { class: 'field' },
        'LIMITE DE TOURS',
        chips(
          [
            [0, 'AUCUNE'],
            [15, '15'],
            [25, '25'],
          ],
          () => this.opts.turns,
          (v) => (this.opts.turns = v),
        ),
      ),
    ];
    const next = h('button', { class: 'btn primary' }, 'COMPOSER LES ÉQUIPES ▶');
    next.addEventListener('click', () => {
      audio.sfx('confirm');
      this.step = 'team0';
      this.render();
    });
    return h(
      'div',
      { class: 'screen dim setup-screen scroll' },
      h('div', { class: 'h1' }, this.kind === 'skirmish' ? 'ESCARMOUCHE' : 'À DEUX'),
      h('div', { class: 'panel options' }, ...fields.filter((f) => !!f)),
      next,
      backButton(() => goTitle()),
    );
  }

  private teamView(team: 0 | 1): HTMLElement {
    const roster = fullRoster();
    const title = this.kind === 'skirmish' ? (team === 0 ? 'TON ÉQUIPE' : 'L’ÉQUIPE DE L’ORDI') : team === 0 ? 'ÉQUIPE BLEUE' : 'ÉQUIPE ROUGE';
    const go = h('button', { class: 'btn primary' }, team === 0 && this.kind === 'local' ? 'ÉQUIPE ROUGE ▶' : team === 0 && this.kind === 'skirmish' ? 'ÉQUIPE DE L’ORDI ▶' : 'AU COMBAT !');
    const tb = new TeamBuilder(roster, this.format, team, title, (b) => {
      go.disabled = b.picks.length === 0;
      go.querySelector('small')?.remove();
      if (b.picks.length && b.picks.length < 10) go.append(h('small', null, ` (${b.picks.length} potes)`));
    });
    if (this.picks[team].length) tb.setPicks(this.picks[team]);
    else if (team === 1 && this.kind === 'skirmish') tb.random();
    const nameIn = h('input', { class: 'team-name', value: this.names[team], maxlength: '12', 'aria-label': 'Nom de l’équipe' }) as HTMLInputElement;
    nameIn.addEventListener('input', () => (this.names[team] = nameIn.value.toUpperCase() || (team ? 'ROUGES' : 'BLEUS')));
    go.addEventListener('click', () => {
      this.picks[team] = tb.picks.slice();
      audio.sfx('confirm');
      this.remember();
      if (team === 0) {
        this.step = 'team1';
        this.render();
      } else this.start();
    });
    const back = () => {
      this.picks[team] = tb.picks.slice();
      this.step = team === 0 ? 'options' : 'team0';
      this.render();
    };
    return h('div', { class: 'screen dim team-screen scroll' }, h('div', { class: 'tb-top' }, nameIn), tb.el, go, backButton(back));
  }

  private start() {
    const setup = buildSetup(this.opts, this.names, this.picks);
    // supports remembered on this device (the human teams)
    const sup = loadSupports();
    setup.teams[0].supports = sup;
    if (this.kind === 'local') setup.teams[1].supports = sup;
    const looks: MatchInfo['looks'] = {};
    for (const d of fullRoster()) if (d.custom) looks[d.id] = d;
    const info: MatchInfo = {
      mode: this.kind,
      setup,
      controllers: this.kind === 'skirmish' ? ['human', 'ai'] : ['human', 'human'],
      ai: this.opts.ai,
      looks,
    };
    goBattle(info);
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) {
      if (e.action === 'back') {
        audio.sfx('cancel');
        if (this.step === 'options') goTitle();
        else {
          this.step = this.step === 'team1' ? 'team0' : 'options';
          this.render();
        }
        return;
      }
    }
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}
