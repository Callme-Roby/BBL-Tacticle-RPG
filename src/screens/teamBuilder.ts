import { audio } from '../audio/audio';
import type { FighterDef } from '../data/roster';
import { loadFace } from '../render/faceTexture';
import { CLASSES, type ClassId } from '../rules/classes';
import { WEAPON_ICONS } from '../rules/items';
import { PROFILES } from '../rules/profiles';
import { classFor, type Format } from '../rules/teams';
import { h } from '../ui/dom';
import { PagedGrid } from './rosterPages';

export interface Pick {
  defId: string;
  name: string;
  /** lab creation: its class */
  lab?: string;
  /** advanced format: which of the two promotions */
  promo: number;
  leader: boolean;
}

export const TEAM_SIZE = 10;

/** class of a roster entry (friends: their profile, lab creations: the class chosen in the lab) */
export function baseClassOf(def: FighterDef): ClassId {
  if (PROFILES[def.id]) return PROFILES[def.id].cls;
  return (def.tactics && def.tactics in CLASSES ? def.tactics : 'bagarreur') as ClassId;
}

/**
 * Team composition: the roster in catalogues (tap to add), the team (tap to
 * remove, ★ = chef, class switch for advanced formats), HASARD / VIDER.
 */
export class TeamBuilder {
  readonly el: HTMLElement;
  picks: Pick[] = [];
  private list: HTMLElement;
  private grid: PagedGrid;
  private count: HTMLElement;
  private faces = new Map<string, string>();

  constructor(
    private roster: FighterDef[],
    private format: Format,
    readonly team: 0 | 1,
    title: string,
    private onChange?: (tb: TeamBuilder) => void,
  ) {
    this.count = h('span', { class: 'tb-count' });
    this.list = h('div', { class: 'tb-list' });
    this.grid = new PagedGrid(roster, {
      cols: 5,
      onCell: (i) => this.add(roster[i]),
      onFlip: (d) => this.grid.show((this.grid.shown + d + this.grid.count) % this.grid.count),
      onFace: (def, url) => {
        this.faces.set(def.id, url);
        this.renderList();
      },
    });
    // class tag under each name
    roster.forEach((d, i) => {
      const c = CLASSES[classFor(d.id, format.promoted, 0, PROFILES[d.id] ? undefined : baseClassOf(d))];
      this.grid.cells[i]?.append(h('div', { class: 'cls' }, `${WEAPON_ICONS[c.weapons[0]]} ${c.name}`));
    });
    const rnd = h('button', { class: 'btn small' }, '🎲 HASARD');
    rnd.addEventListener('click', () => this.random());
    const clear = h('button', { class: 'btn small' }, 'VIDER');
    clear.addEventListener('click', () => {
      this.picks = [];
      this.renderList();
    });
    this.el = h(
      'div',
      { class: 'tb t' + team },
      h('div', { class: 'tb-head' }, h('b', null, title), this.count, rnd, clear),
      this.list,
      h('div', { class: 'tb-hint' }, 'Touche un pote pour l’ajouter ou le retirer (le même pote peut être dans les deux équipes, avec d’autres couleurs). ★ = chef.'),
      this.grid.el,
    );
    this.renderList();
  }

  get full() {
    return this.picks.length >= TEAM_SIZE;
  }

  setPicks(p: Pick[]) {
    this.picks = p.slice(0, TEAM_SIZE);
    this.renderList();
  }

  private add(def: FighterDef) {
    // one copy of a friend per team: a second tap removes it
    const at = this.picks.findIndex((p) => p.defId === def.id);
    if (at >= 0) {
      this.picks.splice(at, 1);
      audio.sfx('cancel', { volume: 0.6 });
      this.renderList();
      return;
    }
    if (this.full) {
      audio.sfx('cancel');
      return;
    }
    audio.sfx('confirm', { volume: 0.6 });
    this.picks.push({ defId: def.id, name: def.name, lab: PROFILES[def.id] ? undefined : baseClassOf(def), promo: 0, leader: this.picks.length === 0 });
    void loadFace(def).then((f) => {
      this.faces.set(def.id, f.portraitUrl);
      this.renderList();
    });
    this.renderList();
  }

  /** a random team: varied classes (at most 2 of each base class), one healer if possible */
  random() {
    const pool = [...this.roster].sort(() => Math.random() - 0.5);
    const per = new Map<string, number>();
    const out: Pick[] = [];
    // a healer first
    const healer = pool.find((d) => CLASSES[baseClassOf(d)].weapons.includes('staff'));
    const take = (d: FighterDef) => {
      const c = baseClassOf(d);
      per.set(c, (per.get(c) ?? 0) + 1);
      out.push({ defId: d.id, name: d.name, lab: PROFILES[d.id] ? undefined : c, promo: Math.random() < 0.5 ? 0 : 1, leader: false });
    };
    if (healer) take(healer);
    for (const d of pool) {
      if (out.length >= TEAM_SIZE) break;
      if (out.some((p) => p.defId === d.id)) continue;
      if ((per.get(baseClassOf(d)) ?? 0) >= 2) continue;
      take(d);
    }
    for (const d of pool) {
      if (out.length >= TEAM_SIZE) break;
      if (!out.some((p) => p.defId === d.id)) take(d);
    }
    // the chef: a sturdy one
    const best = out.reduce((a, b) => ((PROFILES[b.defId]?.base.hp ?? 18) > (PROFILES[a.defId]?.base.hp ?? 18) ? b : a), out[0]);
    if (best) best.leader = true;
    this.picks = out;
    for (const p of out) {
      const d = this.roster.find((x) => x.id === p.defId);
      if (d)
        void loadFace(d).then((f) => {
          this.faces.set(d.id, f.portraitUrl);
          this.renderList();
        });
    }
    audio.sfx('confirm');
    this.renderList();
  }

  private renderList() {
    this.count.textContent = `${this.picks.length}/${TEAM_SIZE}`;
    // picked friends lit in the catalogue
    this.roster.forEach((d, i) => this.grid?.cells[i]?.classList.toggle(this.team === 0 ? 'p1' : 'p2', this.picks.some((p) => p.defId === d.id)));
    if (!this.picks.some((p) => p.leader) && this.picks[0]) this.picks[0].leader = true;
    const rows = this.picks.map((p, i) => {
      const cls = CLASSES[classFor(p.defId, this.format.promoted, p.promo, p.lab)];
      const face = this.faces.get(p.defId);
      const star = h('button', { class: 'tb-star' + (p.leader ? ' on' : ''), 'aria-label': 'Chef' }, '★');
      star.addEventListener('click', (e) => {
        e.stopPropagation();
        for (const q of this.picks) q.leader = false;
        p.leader = true;
        audio.sfx('cursor');
        this.renderList();
      });
      const clsBtn = h('button', { class: 'tb-cls' + (this.format.promoted ? ' sw' : '') }, `${WEAPON_ICONS[cls.weapons[0]]} ${cls.name}`);
      clsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.format.promoted) return;
        p.promo = 1 - p.promo;
        audio.sfx('cursor');
        this.renderList();
      });
      const row = h('div', { class: 'tb-row' }, h('div', { class: 'tb-face', style: face ? `background-image:url(${face})` : '' }), h('b', null, p.name), clsBtn, star, h('button', { class: 'tb-del', 'aria-label': 'Retirer' }, '✕'));
      row.querySelector('.tb-del')!.addEventListener('click', (e) => {
        e.stopPropagation();
        this.picks.splice(i, 1);
        audio.sfx('cancel', { volume: 0.6 });
        this.renderList();
      });
      return row;
    });
    for (let i = this.picks.length; i < TEAM_SIZE; i++) rows.push(h('div', { class: 'tb-row empty' }, h('div', { class: 'tb-face' }), h('span', null, '—')));
    this.list.replaceChildren(...rows);
    this.onChange?.(this);
  }
}
