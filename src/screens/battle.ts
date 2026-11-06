import * as THREE from 'three';
import { chooseAction } from '../ai/ai';
import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import { CameraRig, MapGestures } from '../game/cameraRig';
import { FightScene, type FightSide } from '../game/fightScene';
import { clearMatch, saveMatch, unitLook, type MatchInfo, type MatchLink, type SavedMatch } from '../game/match';
import { saveSettings, settings } from '../game/settings';
import { recordSupports } from '../game/profileStore';
import { input } from '../input/input';
import { BoardView, type Highlight } from '../render/board';
import { Effects } from '../render/effects';
import { loadFace } from '../render/faceTexture';
import { PS1Globals } from '../render/ps1Material';
import { registerTacticsClips } from '../render/tacticsPoses';
import { UnitSprite } from '../render/unitSprite';
import {
  ActionError,
  applyAction,
  canRescue,
  canWield,
  classOf,
  createBattle,
  destinations,
  dist,
  equipped,
  equippedIndex,
  idx,
  isEscapeTile,
  isVisible,
  moveCost,
  onMap,
  pathTo,
  pendingUnits,
  previewAttack,
  reachable,
  ring,
  staffRange,
  supportLevel,
  supportTalks,
  terrainAt,
  unitAt,
  unitByUid,
  usableStaves,
  usableWeapons,
  visibleTiles,
  weaponRange,
  type Action,
  type BattleEvent,
  type BattleState,
  type ItemSlot,
  type LevelUp,
  type Reach,
  type Unit,
} from '../rules/battle';
import { CLASSES, GROW_NAMES, powName } from '../rules/classes';
import { item, WEAPON_ICONS, WEAPON_NAMES, type ItemDef } from '../rules/items';
import { getMap } from '../rules/maps';
import { pairKey, partnersOf, SUPPORT_LETTERS, SUPPORT_THRESHOLDS } from '../rules/supports';
import { TERRAIN, terrainBonus } from '../rules/terrain';
import type { Point, Team } from '../rules/types';
import { SUPPORT_TALKS } from '../data/supportTalks';
import { h, uiRoot } from '../ui/dom';
import { goTitle, goResults } from './flow';
import { trueHit } from '../rules/rng';
import { stateHash } from '../net/session';

type Mode =
  | { m: 'idle' }
  | { m: 'selected'; uid: number; reach: Reach; dests: Set<number> }
  | { m: 'menu'; uid: number; at: Point }
  | { m: 'target'; uid: number; at: Point; kind: 'attack' | 'staff' | 'trade' | 'rescue' | 'drop' | 'steal' | 'support'; item: number; tiles: Point[] }
  | { m: 'preview'; uid: number; at: Point; target: number; weapons: number[]; wi: number }
  | { m: 'staffPreview'; uid: number; at: Point; target: number; item: number }
  | { m: 'items'; uid: number; at: Point }
  | { m: 'trade'; uid: number; at: Point; partner: number; mine: ItemSlot[]; theirs: ItemSlot[]; pick: { side: 0 | 1; i: number } | null }
  | { m: 'steal'; uid: number; at: Point; target: number }
  | { m: 'promote'; uid: number; at: Point; item: number }
  | { m: 'busy' };

const TEAM_NAMES_DEFAULT = ['BLEUS', 'ROUGES'];
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const tmpV = new THREE.Vector3();

export class BattleScreen implements Screen {
  private scene = new THREE.Scene();
  private board!: BoardView;
  private rig!: CameraRig;
  private gestures: MapGestures | null = null;
  private sprites = new Map<number, UnitSprite>();
  private portraits = new Map<string, string>();
  private mode: Mode = { m: 'busy' };
  private root!: HTMLElement;
  private top!: HTMLElement;
  private panel!: HTMLElement;
  private layer!: HTMLElement;
  private ready = false;
  private playing = false;
  private fight: FightScene | null = null;
  private cursor: Point = { x: 0, y: 0 };
  private showCursor = false;
  /** tile / unit shown in the info card while idle */
  private inspect: Point | null = null;
  private log: Action[] = [];
  private covered = false;
  private aiTimer = 0;
  private remoteQueue: Action[] = [];
  private lastPhaseShown = -1;
  private disposed = false;
  private focusIdx = 0;
  /** fast-forward of the other side's turn (tap the screen) */
  private ff = false;
  /** online: checksums received from the other side (log length -> hash) */
  private hashChecks = new Map<number, string>();

  constructor(
    private app: App,
    private info: MatchInfo,
    private state: BattleState = createBattle(info.setup),
    log: Action[] = [],
    private net: MatchLink | null = null,
  ) {
    this.log = log.slice();
    registerTacticsClips();
  }

  // =====================================================================================
  // setup
  // =====================================================================================

  enter() {
    const s = this.state;
    const map = getMap(s.mapId);
    this.board = new BoardView(s.w, s.h, s.tiles, map.theme);
    this.scene.add(this.board.group);
    this.rig = new CameraRig(s.w, s.h);
    this.root = h('div', { class: 'bt passthrough' });
    this.top = h('div', { class: 'bt-top' });
    this.panel = h('div', { class: 'bt-panel' });
    this.layer = h('div', { class: 'bt-layer passthrough' });
    this.root.append(this.top, this.panel, this.layer);
    uiRoot().append(this.root);
    this.layer.append(h('div', { class: 'bt-loading' }, 'CHARGEMENT…'));
    this.gestures = new MapGestures(
      this.app.canvas,
      this.rig,
      (x, y) => this.tapScreen(x, y),
      (x, y) => this.longPress(x, y),
      (x, y) => this.hover(x, y),
    );
    this.layout();
    void this.load();
    if (this.net) {
      const net = this.net;
      net.getState = () => this.state;
      net.onMessage = (m) => {
        if (m.t === 'act') this.remoteQueue.push(m.a as Action);
        else if (m.t === 'hash' && typeof m.n === 'number' && m.h) {
          this.hashChecks.set(m.n, m.h);
          this.checkHash();
        } else if (m.t === 'state' && m.state) {
          // resynchronised from the host
          this.state = m.state as BattleState;
          this.remoteQueue.length = 0;
          this.syncSprites();
          this.mode = { m: 'idle' };
          this.render();
          this.toast('Partie resynchronisée', 1500);
        } else if (m.t === 'leave') {
          this.toast('Ton pote a quitté la partie.', 4000);
        } else if (m.t === 'lost') {
          this.toast('Connexion perdue. Retour au menu dans quelques secondes…', 4000);
          setTimeout(() => goTitle(), 4500);
        }
      };
      net.onStatus = (st) => {
        if (st === 'closed') this.toast('Connexion perdue… reconnexion en cours', 4000);
        if (st === 'open') this.toast('Reconnecté !', 1500);
      };
    }
  }

  private async load() {
    const s = this.state;
    const defs = new Map<string, ReturnType<typeof unitLook>>();
    for (const u of s.units) defs.set(u.defId + (u.alt ? ':alt' : ''), unitLook(this.info, u));
    const faces = new Map<string, Awaited<ReturnType<typeof loadFace>>>();
    await Promise.all(
      [...defs.entries()].map(async ([k, d]) => {
        const f = await loadFace(d);
        faces.set(k, f);
        this.portraits.set(k, f.portraitUrl);
      }),
    );
    if (this.disposed) return;
    for (const u of s.units) {
      const k = u.defId + (u.alt ? ':alt' : '');
      const sp = new UnitSprite(defs.get(k)!, faces.get(k)!, u.team, classOf(u).look, u.leader);
      this.sprites.set(u.uid, sp);
      this.scene.add(sp.group);
    }
    this.syncSprites();
    this.layout();
    this.rig.fitBoard();
    this.rig.setYaw(this.viewYaw(), true);
    // compile every shader now (map, units, effects, a fight scene's materials) so nothing stalls later
    const warm = new Effects();
    warm.sampleAll('parc');
    this.scene.add(warm.group);
    this.applyLighting();
    this.rig.update(0);
    try {
      await this.app.pipeline.prewarm(this.scene, this.rig.camera);
    } catch {
      /* not supported: shaders compile on first use */
    }
    this.scene.remove(warm.group);
    warm.dispose();
    this.layer.replaceChildren();
    this.ready = true;
    audio.playMusic(map0Music(this.state.mapId));
    this.cursor = this.firstUnitPos();
    this.mode = { m: 'idle' };
    // start of a phase not shown yet (new battle or reload)
    this.lastPhaseShown = -1;
    await this.phaseIntro();
    this.render();
  }

  exit() {
    this.disposed = true;
    this.gestures?.dispose();
    this.fight?.dispose();
    for (const sp of this.sprites.values()) sp.dispose();
    this.board?.dispose();
    this.root?.remove();
    if (this.net) {
      this.net.onMessage = null;
      this.net.onStatus = null;
    }
  }

  resized() {
    this.layout();
  }

  /** the panel covers the bottom (portrait) or the right (landscape) */
  private layout() {
    if (!this.rig) return;
    this.rig.setViewport(this.app.width, this.app.height);
    const portrait = this.app.height >= this.app.width * 0.9;
    this.root.classList.toggle('land', !portrait);
    requestAnimationFrame(() => {
      if (!this.panel) return;
      const r = this.panel.getBoundingClientRect();
      this.rig.bottomInset = portrait ? Math.min(this.app.height * 0.55, r.height) * 0.9 : 0;
      this.rig.rightInset = portrait ? 0 : Math.min(this.app.width * 0.5, r.width);
    });
  }

  private viewTeam(): Team {
    if (this.info.mode === 'online') return this.info.localTeam ?? 0;
    if (this.info.mode === 'local') return this.state.phase;
    // vs computer: the human team
    return this.info.controllers[0] === 'human' ? 0 : 1;
  }

  private viewYaw(): number {
    return this.viewTeam() === 1 ? Math.PI : 0;
  }

  private controller(t: Team = this.state.phase) {
    return this.info.controllers[t];
  }

  private myTurn(): boolean {
    return this.controller() === 'human' && this.state.winner === null;
  }

  private teamName(t: Team) {
    return this.state.teams[t].name || TEAM_NAMES_DEFAULT[t];
  }

  private firstUnitPos(): Point {
    const u = onMap(this.state).find((x) => x.team === this.viewTeam());
    return u ? { x: u.x, y: u.y } : { x: 0, y: 0 };
  }

  private portrait(u: Unit): string {
    return this.portraits.get(u.defId + (u.alt ? ':alt' : '')) ?? '';
  }

  // =====================================================================================
  // frame
  // =====================================================================================

  frame(dt: number) {
    if (this.fight) {
      this.fight.render(dt, this.app.aspect);
      return;
    }
    this.handleKeys();
    if (!this.ready) return;
    this.rig.update(dt);
    this.board.update(dt);
    for (const sp of this.sprites.values()) sp.update(dt * (settings.walk === 2 ? 1.6 : 1) * (this.ff ? 2.5 : 1), this.rig.camera);
    this.applyLighting();
    this.app.pipeline.render(this.scene, this.rig.camera, this.board.sky);
    this.drive(dt);
  }

  private applyLighting() {
    PS1Globals.uLightDir.value.set(0.35, 0.85, 0.45).normalize();
    PS1Globals.uLightColor.value.copy(this.board.lightColor);
    PS1Globals.uAmbient.value.copy(this.board.ambient);
    PS1Globals.uFogColor.value.copy(this.board.fogColor);
    PS1Globals.uFogNear.value = 26;
    PS1Globals.uFogFar.value = 70;
  }

  /** computer / remote turns, auto end of turn */
  private drive(dt: number) {
    if (this.playing || this.covered || this.state.winner !== null) return;
    const c = this.controller();
    if (c === 'ai') {
      this.aiTimer -= dt;
      if (this.aiTimer > 0) return;
      this.aiTimer = this.ff ? 0.02 : 0.12;
      const a = chooseAction(this.state, this.info.ai, this.state.rng ^ this.log.length);
      void this.commit(a, false);
    } else if (c === 'remote') {
      const a = this.remoteQueue.shift();
      if (a) void this.commit(a, false);
    } else if (this.mode.m === 'idle' && pendingUnits(this.state).length === 0) {
      // every unit has played: end of the turn by itself
      void this.commit({ k: 'end' }, true);
    }
  }

  // =====================================================================================
  // committing actions & playing their events
  // =====================================================================================

  private async commit(a: Action, mine: boolean) {
    let ev: BattleEvent[] | null = null;
    try {
      ev = applyAction(this.state, a);
    } catch (e) {
      if (!(e instanceof ActionError)) throw e;
      if (mine) {
        this.toast(e.message);
        return;
      }
      if (this.controller() !== 'ai') {
        console.warn('action distante refusée', a, e);
        return;
      }
      // never stall on a bad computer choice: the unit waits (or the turn ends)
      const u = 'uid' in a ? unitByUid(this.state, a.uid) : undefined;
      try {
        a = u ? { k: 'wait', uid: u.uid, x: u.x, y: u.y } : { k: 'end' };
        ev = applyAction(this.state, a);
      } catch {
        a = { k: 'end' };
        ev = applyAction(this.state, a);
      }
    }
    this.log.push(a);
    if (mine && this.net) {
      this.net.send({ t: 'act', a });
      if (a.k === 'end') this.net.sendHash?.(stateHash(this.state));
    }
    this.checkHash();
    this.save();
    this.mode = { m: 'busy' };
    this.render();
    await this.playEvents(ev);
    if (this.disposed) return;
    this.mode = { m: 'idle' };
    this.syncSprites();
    if (this.state.winner !== null) return this.finish();
    this.render();
  }

  /** online: same battle on both sides? (compared at the same number of actions) */
  private checkHash() {
    const h = this.hashChecks.get(this.log.length);
    if (h === undefined) return;
    this.hashChecks.delete(this.log.length);
    if (h !== stateHash(this.state) && this.info.localTeam === 1) {
      console.warn('[en ligne] désynchronisation : récupération de la partie de l’hôte');
      this.net?.requestState?.();
    }
  }

  private save() {
    if (this.info.mode === 'online') return;
    const m: SavedMatch = { v: 1, info: this.info, state: this.state, log: this.log.slice(-400), savedAt: Date.now() };
    saveMatch(m);
  }

  private async playEvents(ev: BattleEvent[]) {
    this.playing = true;
    try {
      for (const e of ev) {
        if (this.disposed) return;
        await this.playEvent(e);
      }
    } finally {
      this.playing = false;
    }
  }

  private sprite(uid: number) {
    return this.sprites.get(uid);
  }

  private seenByViewer(u: Unit | undefined): boolean {
    if (!u) return false;
    return isVisible(this.state, this.viewTeam(), u);
  }

  private async playEvent(e: BattleEvent) {
    const s = this.state;
    switch (e.t) {
      case 'move': {
        const sp = this.sprite(e.uid);
        const u = unitByUid(s, e.uid);
        if (!sp || !u) return;
        const end = e.path[e.path.length - 1];
        const endW = this.board.worldOf(end.x, end.y);
        if (sp.group.position.distanceTo(endW) < 0.05) return;
        // moves hidden by the fog of war: no animation
        if (this.controller(u.team) !== 'human' && !this.seenByViewer(u)) {
          sp.place(endW);
          return;
        }
        if (e.path.length < 2) {
          sp.place(endW);
          return;
        }
        if (this.controller(u.team) !== 'human' && this.seenByViewer(u)) this.rig.focus(this.board.worldOf(e.path[0].x, e.path[0].y));
        const pts = e.path.map((p) => this.board.worldOf(p.x, p.y));
        // first point = where the sprite stands now
        pts[0] = sp.group.position.clone();
        await new Promise<void>((r) => sp.walk(pts, r));
        return;
      }
      case 'combat':
        await this.playCombat(e);
        return;
      case 'staff': {
        const u = unitByUid(s, e.uid)!;
        const t = unitByUid(s, e.target)!;
        const su = this.sprite(u.uid);
        const st = this.sprite(t.uid);
        this.rig.focus(this.board.worldOf(t.x, t.y));
        su?.play('staffHeal');
        audio.sfx('shine');
        await wait(this.fast(500));
        if (st) {
          if (e.amount > 0) {
            st.flash(0x50ff80, 0.9);
            this.floatText(st.group.position, '+' + e.amount, 'heal');
            st.setHp(t.hp / t.stats.hp);
          } else if (e.status) {
            st.flash(e.hit ? 0xb050ff : 0xffffff, 0.8);
            this.floatText(st.group.position, e.hit ? (e.status === 'sleep' ? 'DODO !' : 'MODE AVION !') : 'RATÉ', e.hit ? 'status' : 'miss');
          } else {
            st.flash(0x80e0ff, 0.8);
            this.floatText(st.group.position, 'OK !', 'heal');
          }
        }
        await wait(this.fast(600));
        su?.play(classOf(u).look === 'horse' ? 'ride' : 'mapIdle');
        await this.expPopup(u, e.exp, e.levels);
        return;
      }
      case 'exp': {
        const u = unitByUid(s, e.uid);
        if (u && this.controller(u.team) === 'human') await this.expPopup(u, e.amount, e.levels);
        return;
      }
      case 'heal': {
        const sp = this.sprite(e.uid);
        const u = unitByUid(s, e.uid);
        if (!sp || !u || !this.seenByViewer(u)) return;
        sp.flash(0x50ff80, 0.7);
        sp.setHp(u.hp / u.stats.hp);
        this.floatText(sp.group.position, '+' + e.amount, 'heal');
        audio.sfx('shine', { volume: 0.5 });
        await wait(this.fast(e.source === 'terrain' ? 250 : 600));
        return;
      }
      case 'status': {
        const sp = this.sprite(e.uid);
        if (sp) this.floatText(sp.group.position, 'RÉVEILLÉ', 'heal');
        return;
      }
      case 'promote': {
        const u = unitByUid(s, e.uid)!;
        audio.sfx('powerUp');
        this.sprite(u.uid)?.flash(0xffd040, 1);
        await this.popup(
          h(
            'div',
            { class: 'pop-card promo' },
            h('div', { class: 'pc-title' }, 'PROMOTION !'),
            this.faceEl(u),
            h('div', { class: 'pc-name' }, u.name),
            h('div', { class: 'pc-sub' }, `${CLASSES[e.from].name} → ${CLASSES[e.to].name}`),
            h('div', { class: 'pc-gains' }, ...Object.entries(e.gains).filter(([, v]) => v).map(([k, v]) => h('span', null, `${GROW_NAMES[k as keyof typeof GROW_NAMES] ?? k} +${v}`))),
          ),
          2400,
        );
        // the model keeps its look; the mount may change
        this.rebuildSprite(u);
        return;
      }
      case 'boost':
        this.toast(`${unitByUid(s, e.uid)?.name} : ${GROW_NAMES[e.stat as keyof typeof GROW_NAMES] ?? e.stat} +${e.amount}`);
        await wait(this.fast(500));
        return;
      case 'trade':
        audio.sfx('confirm');
        return;
      case 'rescue': {
        const t = this.sprite(e.target);
        const u = this.sprite(e.uid);
        if (t && u) {
          await new Promise<void>((r) => t.walk([t.group.position.clone(), u.group.position.clone()], r));
          t.setVisible(false);
        }
        audio.sfx('clutch');
        return;
      }
      case 'drop': {
        const t = this.sprite(e.target);
        const u = this.sprite(e.uid);
        if (t && u) {
          t.place(u.group.position.clone());
          t.setVisible(true);
          await new Promise<void>((r) => t.walk([u.group.position.clone(), this.board.worldOf(e.x, e.y)], r));
        }
        return;
      }
      case 'steal': {
        const it = item(e.item);
        this.toast(`${unitByUid(s, e.uid)?.name} vole ${it.name} !`);
        audio.sfx('pin');
        await wait(this.fast(700));
        return;
      }
      case 'break':
        if (this.controller(unitByUid(s, e.uid)!.team) === 'human') {
          this.toast(`${item(e.item).name} est cassé${item(e.item).name.match(/[eé]$/i) ? 'e' : ''} !`);
          await wait(this.fast(500));
        }
        return;
      case 'seize':
        audio.sfx('roundBell');
        return;
      case 'escape': {
        const sp = this.sprite(e.uid);
        this.floatText(sp?.group.position ?? new THREE.Vector3(), 'FUITE !', 'heal');
        audio.sfx('dash');
        await wait(this.fast(500));
        sp?.setVisible(false);
        return;
      }
      case 'support':
        await this.supportTalk(unitByUid(s, e.a)!, unitByUid(s, e.b)!, e.level);
        return;
      case 'phase':
        this.syncSprites();
        await this.phaseIntro();
        return;
      case 'end':
        return;
    }
  }

  private fast(ms: number) {
    return (settings.scenes === 'fast' ? ms / 2 : ms) / (this.ff ? 3 : 1);
  }

  // ---------------------------------------------------------------------------------- combat

  private async playCombat(e: Extract<BattleEvent, { t: 'combat' }>) {
    const s = this.state;
    const a = unitByUid(s, e.a)!;
    const d = unitByUid(s, e.d)!;
    const sa = this.sprite(a.uid);
    const sd = this.sprite(d.uid);
    this.rig.focus(this.board.worldOf(d.x, d.y));
    if (sa && sd) {
      // face each other
      const yaw = Math.atan2(d.x - a.x, d.y - a.y);
      sa.restYaw = yaw;
      sd.restYaw = yaw + Math.PI;
    }
    // HP before the fight (state is already after)
    const hp0 = new Map<number, number>();
    let ha = a.hp;
    let hd = d.hp;
    for (let i = e.strikes.length - 1; i >= 0; i--) {
      const st = e.strikes[i];
      if (st.by === a.uid) {
        hd = hd + st.dmg;
        ha = ha - st.drained;
      } else {
        ha = ha + st.dmg;
        hd = hd - st.drained;
      }
    }
    hp0.set(a.uid, ha);
    hp0.set(d.uid, hd);
    const scenes = settings.scenes;
    if (scenes !== 'off' && e.fc) {
      await wait(150);
      const side = (u: Unit, r: typeof e.fc.a): FightSide => ({
        uid: u.uid,
        def: unitLook(this.info, u),
        name: u.name,
        team: u.team,
        look: classOf(u).look,
        weapon: r.canAttack ? equipped(u) : equipped(u),
        hp: hp0.get(u.uid)!,
        maxHp: u.stats.hp,
        dmg: r.dmg,
        hit: r.hit,
        crit: r.crit,
        canAttack: r.canAttack,
      });
      const overlay = h('div', { class: 'fight-layer' });
      overlay.addEventListener('pointerdown', () => this.fight?.hurry());
      this.layer.append(overlay);
      this.panel.style.visibility = 'hidden';
      this.top.style.visibility = 'hidden';
      try {
        this.fight = await FightScene.create(this.app.pipeline, overlay, side(a, e.fc.a), side(d, e.fc.d), {
          speed: this.ff ? 3 : scenes === 'fast' ? 2 : 1,
          critFx: settings.critFx,
          terrain: terrainAt(s, d.x, d.y),
          sky: this.board.sky,
          ground: new THREE.Color(this.board.palette.plain),
          dist: e.fc.dist,
        });
        await this.fight.play(e.strikes);
      } finally {
        this.fight?.dispose();
        this.fight = null;
        overlay.remove();
        this.panel.style.visibility = '';
        this.top.style.visibility = '';
      }
    } else {
      // map only: lunge + numbers
      for (const st of e.strikes) {
        const by = st.by === a.uid ? a : d;
        const to = by === a ? d : a;
        const sb = this.sprite(by.uid);
        const so = this.sprite(to.uid);
        if (!sb || !so) continue;
        const home = sb.group.position.clone();
        const dir = tmpV.subVectors(so.group.position, home).normalize().multiplyScalar(0.3);
        sb.group.position.add(dir);
        await wait(this.fast(120));
        sb.group.position.copy(home);
        if (st.hit) {
          so.flash(st.crit ? 0xffe060 : 0xffffff, 0.9);
          so.setHp(st.hpAfter / to.stats.hp);
          this.floatText(so.group.position, (st.crit ? 'CRIT ' : '') + st.dmg, st.crit ? 'crit' : '');
          audio.sfx(st.crit ? 'hitHeavy' : 'hitMedium');
          if (st.crit) this.rig.kick(0.25);
        } else {
          this.floatText(so.group.position, 'ESQUIVE', 'miss');
          audio.sfx('whiff');
        }
        await wait(this.fast(380));
      }
    }
    // deaths
    for (const uid of e.deaths) {
      const u = unitByUid(s, uid)!;
      const sp = this.sprite(uid);
      if (sp) {
        sp.flash(0xffffff, 1);
        await wait(this.fast(250));
        sp.setVisible(false);
      }
      if (scenes === 'off') audio.sfx('ko');
      const line = deathLine(u, this.info.mode === 'campaign');
      if (line) this.toast(line, 2200);
    }
    if (sa) sa.restYaw = this.viewYaw();
    if (sd) sd.restYaw = this.viewYaw();
    // experience & level ups (shown for human players)
    for (const x of e.exp) {
      const u = unitByUid(s, x.uid)!;
      const lv = e.levels.find((l) => l.uid === x.uid) ?? null;
      if (this.controller(u.team) === 'human' || lv) await this.expPopup(u, x.amount, lv ? [lv] : []);
    }
  }

  private async expPopup(u: Unit, amount: number, levels: LevelUp[]) {
    if (!amount && !levels.length) return;
    const human = this.controller(u.team) === 'human';
    if (!levels.length) {
      if (!human) return;
      this.toast(`${u.name} +${amount} EXP`, 900);
      return;
    }
    for (const lv of levels) {
      audio.sfx('powerUp');
      this.sprite(u.uid)?.flash(0xffe060, 1);
      const c = classOf(u);
      const rows = (['hp', 'pow', 'skl', 'spd', 'lck', 'def', 'res'] as const).map((k) =>
        h('div', { class: 'lv-row' + (lv.gains[k] ? ' up' : '') }, h('span', null, k === 'pow' ? powName(c) : GROW_NAMES[k]), h('b', null, String(u.stats[k])), lv.gains[k] ? h('i', null, '+' + lv.gains[k]) : null),
      );
      await this.popup(h('div', { class: 'pop-card levelup' }, h('div', { class: 'pc-title' }, 'NIVEAU SUPÉRIEUR !'), this.faceEl(u), h('div', { class: 'pc-name' }, `${u.name} · NIV. ${lv.level}`), h('div', { class: 'lv-grid' }, ...rows)), human ? 2200 : 1500);
    }
  }

  // ---------------------------------------------------------------------------------- phase

  private async phaseIntro() {
    const s = this.state;
    const key = s.turn * 2 + s.phase;
    if (key === this.lastPhaseShown || s.winner !== null) return;
    this.lastPhaseShown = key;
    if (this.controller() === 'human') this.ff = false;
    this.syncSprites();
    // hotseat: hide the map until the next player is ready
    if (this.info.mode === 'local' && this.controller() === 'human') {
      await this.cover();
    }
    this.rig.setYaw(this.viewYaw());
    const who = this.controller() === 'human' ? (this.info.mode === 'local' ? 'À VOUS !' : 'À TOI !') : this.controller() === 'ai' ? 'L’ORDI JOUE' : 'À TON POTE';
    const el = h('div', { class: 'bt-banner t' + s.phase }, h('b', null, this.teamName(s.phase)), h('span', null, `TOUR ${s.turn} · ${who}`));
    this.layer.append(el);
    audio.sfx('roundBell', { volume: 0.6 });
    await wait(1100);
    el.remove();
    if (this.controller() === 'human') {
      const first = pendingUnits(s)[0];
      if (first) {
        this.rig.focus(this.board.worldOf(first.x, first.y));
        this.cursor = { x: first.x, y: first.y };
      }
    }
    this.render();
  }

  /** « Au tour de… » screen hiding the map (two players on one phone) */
  private cover(): Promise<void> {
    this.covered = true;
    const s = this.state;
    return new Promise((resolve) => {
      const go = h('button', { class: 'btn primary big' }, "C'EST MOI, J'Y VAIS !");
      const el = h('div', { class: 'bt-cover t' + s.phase }, h('div', { class: 'cv-small' }, 'PASSE LE TÉLÉPHONE'), h('div', { class: 'cv-big' }, `AU TOUR DE`), h('div', { class: 'cv-team' }, this.teamName(s.phase)), h('div', { class: 'cv-small' }, `Tour ${s.turn}`), go);
      go.addEventListener('click', () => {
        audio.sfx('confirm');
        el.remove();
        this.covered = false;
        resolve();
      });
      this.layer.append(el);
    });
  }

  private async finish() {
    const s = this.state;
    if (this.info.mode !== 'online') clearMatch();
    // supports are remembered between battles
    for (const t of [0, 1] as Team[]) if (this.controller(t) === 'human') recordSupports(s.supports[t]);
    await wait(500);
    goResults(this.info, s);
  }

  // =====================================================================================
  // sprites
  // =====================================================================================

  private syncSprites() {
    const s = this.state;
    const viewer = this.viewTeam();
    const vis = s.fog ? visibleTiles(s, viewer) : null;
    for (const u of s.units) {
      const sp = this.sprite(u.uid);
      if (!sp) continue;
      const shown = u.alive && u.carriedBy === null && !u.escaped && (!vis || u.team === viewer || vis.has(idx(s, u.x, u.y)));
      sp.setVisible(shown);
      if (!sp.walking) sp.place(this.board.worldOf(u.x, u.y));
      sp.setHp(u.hp / u.stats.hp);
      sp.setDone(u.done && u.team === s.phase);
      const w = equipped(u) ?? (usableStaves(u)[0] !== undefined ? item(u.items[usableStaves(u)[0]].id) : null);
      sp.setWeapon(w?.id ?? null, w?.type);
      sp.restYaw = this.viewYaw();
    }
    this.board.setFog(vis);
  }

  private rebuildSprite(u: Unit) {
    const old = this.sprite(u.uid);
    if (!old) return;
    const def = old.def;
    void loadFace(def).then((f) => {
      if (this.disposed) return;
      const sp = new UnitSprite(def, f, u.team, classOf(u).look, u.leader);
      old.dispose();
      this.sprites.set(u.uid, sp);
      this.scene.add(sp.group);
      this.syncSprites();
    });
  }

  // =====================================================================================
  // input
  // =====================================================================================

  private pickTile(cx: number, cy: number): Point | null {
    const r = this.app.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.rig.camera);
    return this.board.pickTile(ray);
  }

  private hover(cx: number, cy: number) {
    if (!this.ready || this.mode.m !== 'selected') return;
    const p = this.pickTile(cx, cy);
    if (p && (p.x !== this.cursor.x || p.y !== this.cursor.y)) {
      this.cursor = p;
      this.render(false);
    }
  }

  private longPress(cx: number, cy: number) {
    const p = this.pickTile(cx, cy);
    if (!p) return;
    const u = unitAt(this.state, p.x, p.y);
    if (u && this.seenByViewer(u)) this.unitSheet(u);
  }

  private tapScreen(cx: number, cy: number) {
    if (!this.ready || this.covered || this.fight) return;
    if (this.controller() !== 'human' && this.state.winner === null) {
      // the other side's turn: a tap speeds it up
      if (!this.ff) this.toast('Avance rapide ▶▶', 900);
      this.ff = true;
      return;
    }
    const p = this.pickTile(cx, cy);
    this.showCursor = false;
    if (p) this.tapTile(p);
  }

  private handleKeys() {
    for (const e of input.menuEvents()) {
      if (!this.ready || this.covered) {
        if (e.action === 'confirm' && this.covered) (this.layer.querySelector('.bt-cover button') as HTMLButtonElement | null)?.click();
        continue;
      }
      // panels with buttons (menus, previews): move the focus among them
      const btns = this.panelButtons();
      const inMenu = this.mode.m !== 'idle' && this.mode.m !== 'selected' && this.mode.m !== 'target' && this.mode.m !== 'busy';
      if (inMenu && btns.length) {
        if (e.action === 'up' || e.action === 'left') this.focusBtn(this.focusIdx - 1);
        else if (e.action === 'down' || e.action === 'right') this.focusBtn(this.focusIdx + 1);
        else if (e.action === 'confirm') btns[Math.min(this.focusIdx, btns.length - 1)]?.click();
        else if (e.action === 'back') this.back();
        continue;
      }
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as Record<string, [number, number]>;
      if (d[e.action]) {
        let [dx, dy] = d[e.action];
        if (this.viewYaw() !== 0) {
          dx = -dx;
          dy = -dy;
        }
        this.cursor = { x: Math.max(0, Math.min(this.state.w - 1, this.cursor.x + dx)), y: Math.max(0, Math.min(this.state.h - 1, this.cursor.y + dy)) };
        this.showCursor = true;
        this.rig.focus(this.board.worldOf(this.cursor.x, this.cursor.y));
        audio.sfx('cursor', { volume: 0.4 });
        this.render(false);
      } else if (e.action === 'confirm') {
        this.showCursor = true;
        this.tapTile(this.cursor);
      } else if (e.action === 'back') this.back();
      else if (e.action === 'start') this.menu();
      else if (e.action === 'nextPage') this.nextUnit(1);
      else if (e.action === 'prevPage') this.nextUnit(-1);
    }
  }

  private panelButtons(): HTMLButtonElement[] {
    return Array.from(this.panel.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
  }

  private focusBtn(i: number) {
    const b = this.panelButtons();
    if (!b.length) return;
    this.focusIdx = (i + b.length) % b.length;
    b.forEach((x, k) => x.classList.toggle('kfocus', k === this.focusIdx));
    audio.sfx('cursor', { volume: 0.4 });
  }

  /** jump to the next unit that hasn't played (L / R) */
  private nextUnit(dir: number) {
    const list = pendingUnits(this.state).filter((u) => this.controller(u.team) === 'human');
    if (!list.length) return;
    const cur = list.findIndex((u) => u.x === this.cursor.x && u.y === this.cursor.y);
    const u = list[(cur + dir + list.length) % list.length];
    this.cursor = { x: u.x, y: u.y };
    this.showCursor = true;
    this.rig.focus(this.board.worldOf(u.x, u.y));
    this.render(false);
  }

  private tapTile(p: Point) {
    const s = this.state;
    const m = this.mode;
    this.cursor = p;
    const u = unitAt(s, p.x, p.y);
    const visible = u && this.seenByViewer(u) ? u : undefined;
    switch (m.m) {
      case 'busy':
        return;
      case 'idle': {
        if (visible && this.myTurn() && visible.team === s.phase && !visible.done && visible.status?.id !== 'sleep') {
          this.select(visible);
          return;
        }
        this.inspect = p;
        audio.sfx('cursor', { volume: 0.5 });
        this.render();
        return;
      }
      case 'selected': {
        const me = unitByUid(s, m.uid)!;
        const i = idx(s, p.x, p.y);
        if (p.x === me.x && p.y === me.y) return this.moveTentative(me, p);
        if (m.dests.has(i)) return this.moveTentative(me, p);
        // enemy in the red zone: walk next to it and open the forecast
        if (visible && visible.team !== me.team) {
          const spot = this.bestSpotToAttack(me, m.reach, visible);
          if (spot) {
            void this.moveTentative(me, spot.at).then(() => this.openPreview(me, spot.at, visible));
            return;
          }
        }
        // another of my units: select it instead
        if (visible && visible.team === s.phase && !visible.done && this.myTurn()) {
          this.cancelMove();
          this.select(visible);
          return;
        }
        this.cancelMove();
        this.mode = { m: 'idle' };
        this.inspect = p;
        this.render();
        return;
      }
      case 'target': {
        const hit = m.tiles.find((t) => t.x === p.x && t.y === p.y);
        if (!hit) return;
        this.pickTarget(m, p);
        return;
      }
      default:
        // menus: a tap on the map does nothing (use the buttons)
        return;
    }
  }

  private select(u: Unit) {
    const reach = reachable(this.state, u);
    const dests = u.moved ? new Set([idx(this.state, u.x, u.y)]) : destinations(this.state, u);
    this.mode = { m: 'selected', uid: u.uid, reach, dests };
    this.rig.focus(this.board.worldOf(u.x, u.y));
    audio.sfx('cursor');
    this.render();
  }

  /** where to stand to attack `t`: reachable free tile in range, best terrain, shortest walk */
  private bestSpotToAttack(u: Unit, reach: Reach, t: Unit): { at: Point } | null {
    const s = this.state;
    let best: { at: Point; score: number } | null = null;
    const ws = usableWeapons(u);
    for (const i of reach.cost.keys()) {
      if (u.moved && i !== idx(s, u.x, u.y)) continue;
      const x = i % s.w;
      const y = (i - x) / s.w;
      const o = unitAt(s, x, y);
      if (o && o.uid !== u.uid) continue;
      const d = dist({ x, y }, t);
      if (!ws.some((wi) => d >= item(u.items[wi].id).min && d <= item(u.items[wi].id).max)) continue;
      const tb = terrainBonus(terrainAt(s, x, y), classOf(u).move);
      const score = tb.avoid + tb.def * 10 - reach.cost.get(i)! * 2 + (d >= 2 ? 15 : 0);
      if (!best || score > best.score) best = { at: { x, y }, score };
    }
    return best ? { at: best.at } : null;
  }

  private moveTentative(u: Unit, p: Point): Promise<void> {
    const sp = this.sprite(u.uid);
    this.mode = { m: 'busy' };
    this.render();
    return new Promise((resolve) => {
      const done = () => {
        this.mode = { m: 'menu', uid: u.uid, at: p };
        audio.sfx('confirm', { volume: 0.5 });
        this.render();
        resolve();
      };
      if (!sp || (p.x === u.x && p.y === u.y)) return done();
      const r = reachable(this.state, u);
      const path = pathTo(this.state, r, p.x, p.y).map((q) => this.board.worldOf(q.x, q.y));
      sp.walk(path.length ? path : [sp.group.position.clone(), this.board.worldOf(p.x, p.y)], done);
    });
  }

  private cancelMove() {
    const m = this.mode;
    if (!('uid' in m)) return;
    const u = unitByUid(this.state, m.uid);
    const sp = u && this.sprite(u.uid);
    if (u && sp) sp.place(this.board.worldOf(u.x, u.y));
  }

  /** RETOUR / Échap / B */
  private back() {
    const m = this.mode;
    audio.sfx('cancel', { volume: 0.6 });
    switch (m.m) {
      case 'selected':
        this.mode = { m: 'idle' };
        break;
      case 'menu': {
        // undo the move: back to the selection
        this.cancelMove();
        const u = unitByUid(this.state, m.uid)!;
        this.select(u);
        return;
      }
      case 'target':
      case 'items':
      case 'promote':
        this.mode = { m: 'menu', uid: m.uid, at: m.at };
        break;
      case 'preview':
      case 'staffPreview':
      case 'steal':
        this.openTargets(unitByUid(this.state, m.uid)!, m.at, m.m === 'staffPreview' ? 'staff' : m.m === 'steal' ? 'steal' : 'attack', m.m === 'staffPreview' ? m.item : -1);
        return;
      case 'trade':
        this.mode = { m: 'menu', uid: m.uid, at: m.at };
        break;
      case 'idle':
        this.inspect = null;
        break;
      default:
        return;
    }
    this.render();
  }

  // =====================================================================================
  // actions available
  // =====================================================================================

  private targetsFor(u: Unit, at: Point, kind: Extract<Mode, { m: 'target' }>['kind'], itemIdx = -1): Point[] {
    const s = this.state;
    const out: Point[] = [];
    const vis = s.fog ? visibleTiles(s, u.team) : null;
    const seen = (o: Unit) => !vis || o.team === u.team || vis.has(idx(s, o.x, o.y));
    const others = onMap(s).filter((o) => o.uid !== u.uid && seen(o));
    switch (kind) {
      case 'attack': {
        const ws = usableWeapons(u);
        for (const o of others) {
          if (o.team === u.team) continue;
          const d = dist(at, o);
          if (ws.some((wi) => d >= item(u.items[wi].id).min && d <= item(u.items[wi].id).max)) out.push({ x: o.x, y: o.y });
        }
        break;
      }
      case 'staff': {
        const list = itemIdx >= 0 ? [itemIdx] : usableStaves(u);
        for (const si of list) {
          const st = item(u.items[si].id);
          const [lo, hi] = staffRange(u, st);
          for (const o of others) {
            const d = dist(at, o);
            if (d < lo || d > hi) continue;
            const hostile = st.staff === 'sleep' || st.staff === 'silence';
            if (hostile ? o.team === u.team || !!o.status : o.team !== u.team) continue;
            if ((st.staff === 'heal' || st.staff === 'physic') && o.hp >= o.stats.hp) continue;
            if (st.staff === 'restore' && !o.status) continue;
            if (!out.some((p) => p.x === o.x && p.y === o.y)) out.push({ x: o.x, y: o.y });
          }
        }
        break;
      }
      case 'trade':
        for (const o of others) if (o.team === u.team && dist(at, o) === 1) out.push({ x: o.x, y: o.y });
        break;
      case 'rescue':
        for (const o of others) if (o.team === u.team && dist(at, o) === 1 && canRescue(u, o)) out.push({ x: o.x, y: o.y });
        break;
      case 'drop': {
        const c = u.carrying !== null ? unitByUid(s, u.carrying) : null;
        if (!c) break;
        for (const p of ring(s, at, 1, 1)) if (!unitAt(s, p.x, p.y) && isFinite(moveCost(s, c, p.x, p.y))) out.push(p);
        break;
      }
      case 'steal':
        for (const o of others) if (o.team !== u.team && dist(at, o) === 1 && u.stats.spd >= o.stats.spd && o.items.some((_, i) => i !== equippedIndex(o))) out.push({ x: o.x, y: o.y });
        break;
      case 'support':
        for (const o of supportTalks(s, u, at)) out.push({ x: o.x, y: o.y });
        break;
    }
    return out;
  }

  private openTargets(u: Unit, at: Point, kind: Extract<Mode, { m: 'target' }>['kind'], itemIdx = -1) {
    const tiles = this.targetsFor(u, at, kind, itemIdx);
    if (tiles.length === 1 && (kind === 'trade' || kind === 'rescue' || kind === 'support')) {
      this.pickTarget({ m: 'target', uid: u.uid, at, kind, item: itemIdx, tiles }, tiles[0]);
      return;
    }
    this.mode = { m: 'target', uid: u.uid, at, kind, item: itemIdx, tiles };
    this.render();
  }

  private pickTarget(m: Extract<Mode, { m: 'target' }>, p: Point) {
    const s = this.state;
    const u = unitByUid(s, m.uid)!;
    const t = unitAt(s, p.x, p.y);
    audio.sfx('confirm', { volume: 0.6 });
    switch (m.kind) {
      case 'attack':
        if (t) this.openPreview(u, m.at, t);
        return;
      case 'staff': {
        if (!t) return;
        const list = (m.item >= 0 ? [m.item] : usableStaves(u)).filter((si) => this.targetsFor(u, m.at, 'staff', si).some((q) => q.x === t.x && q.y === t.y));
        this.mode = { m: 'staffPreview', uid: u.uid, at: m.at, target: t.uid, item: list[0] };
        this.render();
        return;
      }
      case 'trade':
        if (!t) return;
        this.mode = { m: 'trade', uid: u.uid, at: m.at, partner: t.uid, mine: u.items.map((i) => ({ ...i })), theirs: t.items.map((i) => ({ ...i })), pick: null };
        this.render();
        return;
      case 'rescue':
        if (t) void this.commit({ k: 'rescue', uid: u.uid, x: m.at.x, y: m.at.y, target: t.uid }, true);
        return;
      case 'drop':
        void this.commit({ k: 'drop', uid: u.uid, x: m.at.x, y: m.at.y, tx: p.x, ty: p.y }, true);
        return;
      case 'steal':
        if (t) {
          this.mode = { m: 'steal', uid: u.uid, at: m.at, target: t.uid };
          this.render();
        }
        return;
      case 'support':
        if (t) void this.commit({ k: 'support', uid: u.uid, x: m.at.x, y: m.at.y, partner: t.uid }, true);
        return;
    }
  }

  private openPreview(u: Unit, at: Point, t: Unit) {
    const d = dist(at, t);
    const weapons = usableWeapons(u).filter((wi) => {
      const w = item(u.items[wi].id);
      return d >= w.min && d <= w.max;
    });
    if (!weapons.length) return;
    // the weapon giving the best expected damage first
    const score = (wi: number) => {
      const fc = previewAttack(this.state, u, at, t, wi);
      return (fc.a.dmg * (fc.a.doubles ? 2 : 1) * fc.a.hit) / 100;
    };
    const eq = equippedIndex(u);
    const wi = weapons.includes(eq) && score(eq) >= Math.max(...weapons.map(score)) - 0.01 ? eq : weapons.reduce((a, b) => (score(b) > score(a) ? b : a));
    this.mode = { m: 'preview', uid: u.uid, at, target: t.uid, weapons, wi };
    this.render();
  }

  // =====================================================================================
  // rendering of highlights + panels
  // =====================================================================================

  private render(panel = true) {
    if (!this.ready) return;
    this.renderHighlights();
    this.renderTop();
    if (panel) {
      this.focusIdx = 0;
      this.renderPanel();
      this.layout();
    }
  }

  private renderHighlights() {
    const s = this.state;
    const m = this.mode;
    const hl: Highlight[] = [];
    const add = (p: Point, kind: Highlight['kind']) => hl.push({ x: p.x, y: p.y, kind });
    const tilesOf = (set: Iterable<number>) => [...set].map((i) => ({ x: i % s.w, y: Math.floor(i / s.w) }));
    // danger zone (option)
    if (settings.danger && (m.m === 'idle' || m.m === 'selected')) {
      const zone = new Set<number>();
      const viewer = this.viewTeam();
      for (const e of onMap(s)) {
        if (e.team === viewer || !this.seenByViewer(e)) continue;
        for (const p of this.attackZone(e)) zone.add(idx(s, p.x, p.y));
      }
      for (const p of tilesOf(zone)) add(p, 'danger');
    }
    if (s.objective.kind === 'escape') {
      const t = s.objective.attacker;
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (isEscapeTile(s, t, x, y)) add({ x, y }, 'exit');
    }
    if (m.m === 'selected') {
      const u = unitByUid(s, m.uid)!;
      for (const p of tilesOf(m.dests)) add(p, 'move');
      // attack / staff fringe
      const zone = this.attackZone(u, m.reach);
      for (const p of zone) if (!m.dests.has(idx(s, p.x, p.y))) add(p, usableWeapons(u).length ? 'attack' : 'staff');
      // path preview to the cursor
      const ci = idx(s, this.cursor.x, this.cursor.y);
      if (m.dests.has(ci) && !u.moved) for (const p of pathTo(s, m.reach, this.cursor.x, this.cursor.y)) add(p, 'path');
      add(u, 'select');
    } else if (m.m === 'idle' && this.inspect) {
      const u = unitAt(s, this.inspect.x, this.inspect.y);
      if (u && this.seenByViewer(u)) {
        const reach = reachable(s, u);
        for (const i of reach.cost.keys()) add({ x: i % s.w, y: Math.floor(i / s.w) }, u.team === this.viewTeam() ? 'move' : 'danger');
        for (const p of this.attackZone(u, reach)) if (!reach.cost.has(idx(s, p.x, p.y))) add(p, 'attack');
      }
      add(this.inspect, 'cursor');
    } else if (m.m === 'target') {
      for (const p of m.tiles) add(p, m.kind === 'attack' || m.kind === 'steal' ? 'attack' : m.kind === 'staff' && this.isHostileStaff(m) ? 'attack' : m.kind === 'drop' ? 'move' : 'staff');
      add(m.at, 'select');
    } else if (m.m === 'preview' || m.m === 'staffPreview' || m.m === 'steal') {
      const t = unitByUid(s, m.target)!;
      add(t, 'target');
      add(m.at, 'select');
    } else if ('at' in m) add(m.at, 'select');
    if (this.showCursor) add(this.cursor, 'cursor');
    this.board.setHighlights(hl);
  }

  private isHostileStaff(m: Extract<Mode, { m: 'target' }>) {
    if (m.item < 0) return false;
    const u = unitByUid(this.state, m.uid)!;
    const st = item(u.items[m.item].id);
    return st.staff === 'sleep' || st.staff === 'silence';
  }

  /** tiles a unit can strike this turn (from its reachable tiles) */
  private attackZone(u: Unit, reach = reachable(this.state, u)): Point[] {
    const s = this.state;
    const out = new Map<number, Point>();
    const r = weaponRange(u);
    let lo = r?.[0] ?? 99;
    let hi = r?.[1] ?? -1;
    for (const si of usableStaves(u)) {
      const [a, b] = staffRange(u, item(u.items[si].id));
      lo = Math.min(lo, a);
      hi = Math.max(hi, b);
    }
    if (hi < 0) return [];
    for (const i of reach.cost.keys()) {
      const x = i % s.w;
      const y = (i - x) / s.w;
      const o = unitAt(s, x, y);
      if (o && o.uid !== u.uid) continue;
      for (const p of ring(s, { x, y }, lo, hi)) out.set(idx(s, p.x, p.y), p);
    }
    return [...out.values()];
  }

  private renderTop() {
    const s = this.state;
    const obj = objectiveText(s);
    const menuBtn = h('button', { class: 'bt-ico', 'aria-label': 'Menu' }, '☰');
    menuBtn.addEventListener('click', () => this.menu());
    const danger = h('button', { class: 'bt-ico' + (settings.danger ? ' on' : ''), 'aria-label': 'Zone de danger', title: 'Zone de danger' }, '⚠');
    danger.addEventListener('click', () => {
      settings.danger = !settings.danger;
      saveSettings();
      this.toast(settings.danger ? 'Zone de danger affichée' : 'Zone de danger masquée', 900);
      this.render(false);
    });
    const left = onMap(s).filter((u) => u.team === 0).length;
    const right = onMap(s).filter((u) => u.team === 1).length;
    this.top.replaceChildren(
      menuBtn,
      h('div', { class: 'bt-turn t' + s.phase }, h('b', null, `TOUR ${s.turn}`), h('span', null, this.teamName(s.phase)), h('small', null, obj)),
      h('div', { class: 'bt-count' }, h('span', { class: 't0' }, String(left)), ' · ', h('span', { class: 't1' }, String(right))),
      danger,
    );
  }

  private btn(label: string, fn: () => void, cls = '', disabled = false): HTMLButtonElement {
    const b = h('button', { class: 'bbtn ' + cls, disabled }, label);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
    });
    return b;
  }

  private faceEl(u: Unit, cls = 'face'): HTMLElement {
    const src = this.portrait(u);
    return h('div', { class: cls + ' t' + u.team, style: src ? `background-image:url(${src})` : '' });
  }

  /** compact unit card: face, name, class, level, HP, weapon, terrain */
  private unitCard(u: Unit, at: Point = u): HTMLElement {
    const c = classOf(u);
    const w = equipped(u);
    const t = TERRAIN[terrainAt(this.state, at.x, at.y)];
    const tb = terrainBonus(t.id, c.move);
    const hpPct = Math.round((u.hp / u.stats.hp) * 100);
    const info = h('button', { class: 'bt-info', 'aria-label': 'Fiche' }, 'i');
    info.addEventListener('click', (e) => {
      e.stopPropagation();
      this.unitSheet(u);
    });
    return h(
      'div',
      { class: 'ucard t' + u.team },
      this.faceEl(u),
      h(
        'div',
        { class: 'uc-main' },
        h('div', { class: 'uc-name' }, u.leader ? '👑 ' : '', u.name, h('small', null, ` ${c.name} · NIV.${u.level}`)),
        h('div', { class: 'uc-hp' }, h('span', { class: 'uc-bar' }, h('i', { style: `width:${hpPct}%` })), h('b', null, `${u.hp}/${u.stats.hp}`)),
        h('div', { class: 'uc-w' }, w ? `${WEAPON_ICONS[w.type!]} ${w.name} (${u.items[equippedIndex(u)].uses})` : 'Pas d’arme', u.status ? h('em', null, u.status.id === 'sleep' ? ' 💤' : u.status.id === 'silence' ? ' 📵' : ' ☠') : null),
        h('div', { class: 'uc-t' }, `${t.name}${tb.avoid || tb.def ? ` · ESQ+${tb.avoid} DÉF+${tb.def}` : ''}`),
      ),
      info,
    );
  }

  private terrainCard(p: Point): HTMLElement {
    const t = TERRAIN[terrainAt(this.state, p.x, p.y)];
    const cost = (['foot', 'armor', 'horse', 'flier'] as const).map((k) => `${{ foot: '🚶', armor: '🛡', horse: '🐎', flier: '🛸' }[k]}${isFinite(t.cost[k]) ? t.cost[k] : '✕'}`).join(' ');
    return h('div', { class: 'tcard' }, h('b', null, t.name), h('span', null, `ESQ +${t.avoid} · DÉF +${t.def}${t.heal ? ` · SOIN ${t.heal}%` : ''}`), h('small', null, `Coût : ${cost}`));
  }

  private renderPanel() {
    const s = this.state;
    const m = this.mode;
    const p = this.panel;
    p.className = 'bt-panel';
    const endTurn = () => this.btn('FIN DU TOUR', () => this.confirmEnd(), 'end');
    const kids: (HTMLElement | null)[] = [];
    switch (m.m) {
      case 'busy': {
        const c = this.controller();
        kids.push(h('div', { class: 'bt-hint' }, c === 'ai' ? `L'ordinateur joue… ${this.ff ? '▶▶' : '(touche l’écran pour accélérer)'}` : c === 'remote' ? `Au tour de ${this.teamName(s.phase)}… (en ligne)` : '…'));
        break;
      }
      case 'idle': {
        const u = this.inspect ? unitAt(s, this.inspect.x, this.inspect.y) : undefined;
        if (u && this.seenByViewer(u)) kids.push(this.unitCard(u));
        else if (this.inspect) kids.push(this.terrainCard(this.inspect));
        if (this.myTurn()) {
          const left = pendingUnits(s).length;
          if (!u) kids.push(h('div', { class: 'bt-hint' }, left ? `Touche une de tes unités (${left} à jouer). Glisse pour bouger la carte, pince pour zoomer.` : 'Toutes tes unités ont joué.'));
          kids.push(h('div', { class: 'bt-row' }, this.btn('UNITÉ SUIVANTE', () => this.nextUnit(1), 'ghost'), endTurn()));
        } else {
          kids.push(h('div', { class: 'bt-hint' }, this.controller() === 'ai' ? `L'ordinateur joue…` : `Au tour de ${this.teamName(s.phase)}…`));
        }
        break;
      }
      case 'selected': {
        const u = unitByUid(s, m.uid)!;
        kids.push(this.unitCard(u));
        kids.push(h('div', { class: 'bt-hint' }, 'Touche une case bleue pour te déplacer, ou un ennemi pour l’attaquer. Retouche l’unité pour agir sur place.'));
        kids.push(h('div', { class: 'bt-row' }, this.btn('ANNULER', () => this.back(), 'ghost'), this.btn('AGIR ICI', () => void this.moveTentative(u, u))));
        break;
      }
      case 'menu':
        kids.push(...this.actionMenu(unitByUid(s, m.uid)!, m.at));
        break;
      case 'target': {
        const label = { attack: 'Choisis la cible à attaquer', staff: 'Choisis qui soigner', trade: 'Avec qui échanger ?', rescue: 'Qui porter ?', drop: 'Où le déposer ?', steal: 'Qui détrousser ?', support: 'Avec qui parler ?' }[m.kind];
        kids.push(h('div', { class: 'bt-hint big' }, label));
        if (m.tiles.length > 1 && m.kind === 'attack') {
          // quick buttons for each target (one hand: no need to aim at small tiles)
          const row = h('div', { class: 'bt-targets' });
          for (const t of m.tiles) {
            const o = unitAt(s, t.x, t.y);
            if (!o) continue;
            const b = h('button', { class: 'tgt t' + o.team }, this.faceEl(o, 'tface'), h('span', null, o.name), h('small', null, `${o.hp}/${o.stats.hp}`));
            b.addEventListener('click', () => this.pickTarget(m, t));
            row.append(b);
          }
          kids.push(row);
        }
        kids.push(h('div', { class: 'bt-row' }, this.btn('RETOUR', () => this.back(), 'ghost')));
        break;
      }
      case 'preview':
        kids.push(...this.previewPanel(m));
        break;
      case 'staffPreview':
        kids.push(...this.staffPanel(m));
        break;
      case 'items':
        kids.push(...this.itemsPanel(m));
        break;
      case 'trade':
        kids.push(...this.tradePanel(m));
        break;
      case 'steal':
        kids.push(...this.stealPanel(m));
        break;
      case 'promote':
        kids.push(...this.promotePanel(m));
        break;
    }
    p.replaceChildren(...kids.filter((k): k is HTMLElement => !!k));
  }

  private actionMenu(u: Unit, at: Point): HTMLElement[] {
    const s = this.state;
    const acts: HTMLButtonElement[] = [];
    const go = (label: string, fn: () => void, cls = '') => acts.push(this.btn(label, fn, cls));
    if (this.targetsFor(u, at, 'attack').length) go('⚔ ATTAQUER', () => this.openTargets(u, at, 'attack'), 'main');
    if (usableStaves(u).length && this.targetsFor(u, at, 'staff').length) go('✚ BÂTON', () => this.openTargets(u, at, 'staff'), 'main');
    const th = s.thrones[(1 - u.team) as Team];
    if (s.objective.kind === 'seize' && u.leader && th && th.x === at.x && th.y === at.y) go('👑 CAPTURER', () => void this.commit({ k: 'seize', uid: u.uid, x: at.x, y: at.y }, true), 'main');
    if (isEscapeTile(s, u.team, at.x, at.y)) go('🏃 S’ENFUIR', () => void this.commit({ k: 'escape', uid: u.uid, x: at.x, y: at.y }, true), 'main');
    if (this.targetsFor(u, at, 'support').length) go('💬 SOUTIEN', () => this.openTargets(u, at, 'support'), 'main');
    if (classOf(u).steal && this.targetsFor(u, at, 'steal').length) go('🖐 VOLER', () => this.openTargets(u, at, 'steal'));
    if (u.carrying === null && this.targetsFor(u, at, 'rescue').length) go('🤝 SECOURIR', () => this.openTargets(u, at, 'rescue'));
    if (u.carrying !== null && this.targetsFor(u, at, 'drop').length) go('⬇ DÉPOSER', () => this.openTargets(u, at, 'drop'));
    if (u.items.length) go('🎒 OBJETS', () => ((this.mode = { m: 'items', uid: u.uid, at }), this.render()));
    if (this.targetsFor(u, at, 'trade').length) go('🔁 ÉCHANGER', () => this.openTargets(u, at, 'trade'));
    go('✓ ATTENDRE', () => void this.commit({ k: 'wait', uid: u.uid, x: at.x, y: at.y }, true), 'wait');
    const card = this.unitCard(u, at);
    const grid = h('div', { class: 'bt-actions' }, ...acts);
    const undo = this.btn(u.moved ? 'RETOUR' : '↶ ANNULER LE DÉPLACEMENT', () => this.back(), 'ghost');
    return [card, grid, h('div', { class: 'bt-row' }, undo)];
  }

  private previewPanel(m: Extract<Mode, { m: 'preview' }>): HTMLElement[] {
    const s = this.state;
    const u = unitByUid(s, m.uid)!;
    const t = unitByUid(s, m.target)!;
    const fc = previewAttack(s, u, m.at, t, m.wi);
    const w = item(u.items[m.wi].id);
    const tw = equipped(t);
    const arrow = (k: number) => (k > 0 ? h('i', { class: 'tri up' }, '▲') : k < 0 ? h('i', { class: 'tri down' }, '▼') : null);
    const after = (hp: number, dmg: number, times: number, can: boolean) => Math.max(0, hp - (can ? dmg * times : 0));
    const timesA = (fc.a.doubles ? 2 : 1) * (fc.a.brave ? 2 : 1);
    const timesD = (fc.d.doubles ? 2 : 1) * (fc.d.brave ? 2 : 1);
    const col = (x: Unit, r: typeof fc.a, wpn: ItemDef | null, times: number, hpAfter: number) =>
      h(
        'div',
        { class: 'fc-col t' + x.team },
        h('div', { class: 'fc-head' }, this.faceEl(x, 'fface'), h('div', null, h('b', null, x.name), h('small', null, wpn ? `${WEAPON_ICONS[wpn.type!]} ${wpn.name}` : 'Sans arme', arrow(r.triangle)))),
        h('div', { class: 'fc-line' }, h('span', null, 'PV'), h('b', null, `${x.hp} → `, h('em', { class: hpAfter <= 0 ? 'ko' : '' }, hpAfter <= 0 ? 'K.O.' : String(hpAfter)))),
        h('div', { class: 'fc-line' }, h('span', null, 'DÉG'), h('b', null, r.canAttack ? `${r.dmg}${times > 1 ? ` ×${times}` : ''}${r.effective ? ' ★' : ''}` : '—')),
        h('div', { class: 'fc-line' }, h('span', null, 'PRÉ'), h('b', null, r.canAttack ? `${r.hit}%` : '—')),
        h('div', { class: 'fc-line' }, h('span', null, 'CRIT'), h('b', null, r.canAttack ? `${r.crit}%` : '—')),
      );
    const cards = h('div', { class: 'fc' }, col(u, fc.a, w, timesA, after(u.hp, fc.d.dmg, timesD, fc.d.canAttack)), col(t, fc.d, tw, timesD, after(t.hp, fc.a.dmg, timesA, fc.a.canAttack)));
    const notes: string[] = [];
    if (fc.a.triangle > 0) notes.push('Avantage du triangle (+15 PRÉ, +1 DÉG)');
    if (fc.a.triangle < 0) notes.push('Désavantage du triangle (−15 PRÉ, −1 DÉG)');
    if (fc.a.effective) notes.push('Arme efficace : puissance ×3 !');
    if (!fc.d.canAttack) notes.push('Pas de riposte');
    notes.push(`Vraie chance de toucher : ${Math.round(trueHit(fc.a.hit))}% (deux tirages)`);
    const wsel =
      m.weapons.length > 1
        ? h(
            'div',
            { class: 'bt-row wsel' },
            this.btn('◀', () => this.cycleWeapon(m, -1), 'ghost small'),
            h('span', null, `${w.name} (${u.items[m.wi].uses})`),
            this.btn('▶', () => this.cycleWeapon(m, 1), 'ghost small'),
          )
        : null;
    return [
      cards,
      h('div', { class: 'fc-notes' }, notes.join(' · ')),
      wsel as HTMLElement,
      h('div', { class: 'bt-row' }, this.btn('RETOUR', () => this.back(), 'ghost'), this.btn('⚔ ATTAQUER !', () => void this.commit({ k: 'attack', uid: u.uid, x: m.at.x, y: m.at.y, target: t.uid, item: m.wi }, true), 'main go')),
    ];
  }

  private cycleWeapon(m: Extract<Mode, { m: 'preview' }>, d: number) {
    const i = m.weapons.indexOf(m.wi);
    this.mode = { ...m, wi: m.weapons[(i + d + m.weapons.length) % m.weapons.length] };
    audio.sfx('cursor');
    this.render();
  }

  private staffPanel(m: Extract<Mode, { m: 'staffPreview' }>): HTMLElement[] {
    const s = this.state;
    const u = unitByUid(s, m.uid)!;
    const t = unitByUid(s, m.target)!;
    const st = item(u.items[m.item].id);
    let line = '';
    if (st.staff === 'heal' || st.staff === 'physic') {
      const amount = Math.min((st.heal ?? 10) + u.stats.pow, t.stats.hp - t.hp);
      line = `PV ${t.hp} → ${t.hp + amount} (+${amount})`;
    } else if (st.staff === 'restore') line = 'Soigne son état';
    else if (st.staff === 'rescue') line = 'Le fait venir à côté de toi';
    else {
      const d = dist(m.at, t);
      const chance = Math.max(0, Math.min(100, 30 + u.stats.pow * 5 + u.stats.skl - t.stats.res * 5 - d * 2));
      line = `Chance de réussite : ${chance}%`;
    }
    return [
      h('div', { class: 'fc staff' }, h('div', { class: 'fc-col t' + u.team }, h('div', { class: 'fc-head' }, this.faceEl(u, 'fface'), h('div', null, h('b', null, u.name), h('small', null, `${st.name} (${u.items[m.item].uses})`)))), h('div', { class: 'fc-col t' + t.team }, h('div', { class: 'fc-head' }, this.faceEl(t, 'fface'), h('div', null, h('b', null, t.name), h('small', null, line))))),
      h('div', { class: 'fc-notes' }, st.desc),
      h('div', { class: 'bt-row' }, this.btn('RETOUR', () => this.back(), 'ghost'), this.btn('✚ UTILISER', () => void this.commit({ k: 'staff', uid: u.uid, x: m.at.x, y: m.at.y, target: t.uid, item: m.item }, true), 'main go')),
    ];
  }

  private itemsPanel(m: Extract<Mode, { m: 'items' }>): HTMLElement[] {
    const s = this.state;
    const u = unitByUid(s, m.uid)!;
    const rows = u.items.map((slot, i) => {
      const it = item(slot.id);
      const usable = it.kind === 'weapon' || it.kind === 'staff' ? canWield(u, it) : true;
      const isEq = i === equippedIndex(u);
      const btns: HTMLButtonElement[] = [];
      if (it.kind === 'weapon' && usable && !isEq) btns.push(this.btn('ÉQUIPER', () => void this.commitEquip(u, i), 'small'));
      if (it.kind === 'heal') btns.push(this.btn('BOIRE', () => void this.commit({ k: 'use', uid: u.uid, x: m.at.x, y: m.at.y, item: i }, true), 'small', u.hp >= u.stats.hp));
      if (it.kind === 'boost') btns.push(this.btn('UTILISER', () => void this.commit({ k: 'use', uid: u.uid, x: m.at.x, y: m.at.y, item: i }, true), 'small'));
      if (it.kind === 'promo') {
        const ok = classOf(u).tier === 1 && u.level >= 10;
        btns.push(this.btn(ok ? 'PROMOUVOIR' : 'NIV. 10 REQUIS', () => ((this.mode = { m: 'promote', uid: u.uid, at: m.at, item: i }), this.render()), 'small', !ok));
      }
      if (it.kind === 'staff' && usable && this.targetsFor(u, m.at, 'staff', i).length) btns.push(this.btn('UTILISER', () => this.openTargets(u, m.at, 'staff', i), 'small'));
      const stats = it.kind === 'weapon' ? `PUI ${it.mt} · PRÉ ${it.hit} · CRIT ${it.crit} · POIDS ${it.wt} · PORTÉE ${it.min === it.max ? it.min : it.min + '–' + it.max}` : it.desc;
      return h(
        'div',
        { class: 'irow' + (usable ? '' : ' off') + (isEq ? ' eq' : '') },
        h('div', { class: 'ir-main' }, h('b', null, `${it.type ? WEAPON_ICONS[it.type] + ' ' : ''}${it.name}`, isEq ? h('em', null, ' (équipée)') : null), h('small', null, stats)),
        h('span', { class: 'ir-uses' }, `${slot.uses}/${it.uses}`),
        h('div', { class: 'ir-btns' }, ...btns),
      );
    });
    return [h('div', { class: 'bt-hint' }, `Inventaire de ${u.name} (${u.items.length}/5)`), h('div', { class: 'ilist' }, ...rows), h('div', { class: 'bt-row' }, this.btn('RETOUR', () => this.back(), 'ghost'))];
  }

  private async commitEquip(u: Unit, i: number) {
    try {
      applyAction(this.state, { k: 'equip', uid: u.uid, item: i });
    } catch (e) {
      this.toast((e as Error).message);
      return;
    }
    this.log.push({ k: 'equip', uid: u.uid, item: i });
    if (this.net) this.net.send({ t: 'act', a: { k: 'equip', uid: u.uid, item: i } });
    this.syncSprites();
    audio.sfx('confirm');
    this.render();
  }

  private tradePanel(m: Extract<Mode, { m: 'trade' }>): HTMLElement[] {
    const s = this.state;
    const u = unitByUid(s, m.uid)!;
    const p = unitByUid(s, m.partner)!;
    const col = (who: Unit, list: ItemSlot[], side: 0 | 1) =>
      h(
        'div',
        { class: 'tr-col' },
        h('div', { class: 'tr-head' }, this.faceEl(who, 'tface'), h('b', null, who.name)),
        ...[0, 1, 2, 3, 4].map((i) => {
          const slot = list[i];
          const picked = m.pick && m.pick.side === side && m.pick.i === i;
          const b = h('button', { class: 'tr-slot' + (picked ? ' picked' : '') + (slot ? '' : ' empty') }, slot ? `${item(slot.id).type ? WEAPON_ICONS[item(slot.id).type!] + ' ' : ''}${item(slot.id).name} ${slot.uses}` : '—');
          b.addEventListener('click', () => this.tradeTap(side, i));
          return b;
        }),
      );
    const changed = JSON.stringify(m.mine) !== JSON.stringify(u.items) || JSON.stringify(m.theirs) !== JSON.stringify(p.items);
    return [
      h('div', { class: 'bt-hint' }, 'Touche un objet puis l’endroit où le mettre (ou un objet de l’autre pour les échanger).'),
      h('div', { class: 'trade' }, col(u, m.mine, 0), col(p, m.theirs, 1)),
      h(
        'div',
        { class: 'bt-row' },
        this.btn('RETOUR', () => this.back(), 'ghost'),
        this.btn('✓ VALIDER', () => void this.commit({ k: 'trade', uid: u.uid, x: m.at.x, y: m.at.y, partner: p.uid, mine: m.mine, theirs: m.theirs }, true), 'main', !changed),
      ),
    ];
  }

  private tradeTap(side: 0 | 1, i: number) {
    const m = this.mode;
    if (m.m !== 'trade') return;
    const lists = [m.mine, m.theirs];
    if (!m.pick) {
      if (!lists[side][i]) return;
      m.pick = { side, i };
    } else {
      const a = m.pick;
      const la = lists[a.side];
      const lb = lists[side];
      const ia = la[a.i];
      const ib = lb[i];
      if (a.side === side) {
        // reorder inside one inventory
        if (ib) {
          la[a.i] = ib;
          la[i] = ia;
        } else {
          la.splice(a.i, 1);
          la.push(ia);
        }
      } else if (ib) {
        la[a.i] = ib;
        lb[i] = ia;
      } else if (lb.length < 5) {
        la.splice(a.i, 1);
        lb.push(ia);
      }
      m.pick = null;
    }
    audio.sfx('cursor');
    this.render();
  }

  private stealPanel(m: Extract<Mode, { m: 'steal' }>): HTMLElement[] {
    const t = unitByUid(this.state, m.target)!;
    const u = unitByUid(this.state, m.uid)!;
    const eq = equippedIndex(t);
    const rows = t.items.map((slot, i) =>
      this.btn(`${item(slot.id).name} (${slot.uses})${i === eq ? ' — en main' : ''}`, () => void this.commit({ k: 'steal', uid: u.uid, x: m.at.x, y: m.at.y, target: t.uid, item: i }, true), 'wide', i === eq || u.items.length >= 5),
    );
    return [h('div', { class: 'bt-hint' }, `Que voler à ${t.name} ?`), h('div', { class: 'bt-actions one' }, ...rows), h('div', { class: 'bt-row' }, this.btn('RETOUR', () => this.back(), 'ghost'))];
  }

  private promotePanel(m: Extract<Mode, { m: 'promote' }>): HTMLElement[] {
    const u = unitByUid(this.state, m.uid)!;
    const c = classOf(u);
    const opts = (c.promotesTo ?? []).map((id) => {
      const cl = CLASSES[id];
      const b = h('button', { class: 'promo-opt' }, h('b', null, cl.name), h('small', null, cl.weapons.map((w) => WEAPON_ICONS[w] + ' ' + WEAPON_NAMES[w]).join(' · ') + ` · MVT ${cl.mov}`), h('span', null, cl.desc));
      b.addEventListener('click', () => void this.commit({ k: 'use', uid: u.uid, x: m.at.x, y: m.at.y, item: m.item, cls: id }, true));
      return b;
    });
    return [h('div', { class: 'bt-hint big' }, `${u.name} : choisis sa nouvelle classe`), h('div', { class: 'promo-list' }, ...opts), h('div', { class: 'bt-row' }, this.btn('RETOUR', () => this.back(), 'ghost'))];
  }

  // =====================================================================================
  // overlays
  // =====================================================================================

  private confirmEnd() {
    const left = pendingUnits(this.state).length;
    if (!left) {
      void this.commit({ k: 'end' }, true);
      return;
    }
    const yes = h('button', { class: 'btn primary' }, 'OUI, FIN DU TOUR');
    const no = h('button', { class: 'btn' }, 'NON');
    const el = h('div', { class: 'bt-modal' }, h('div', { class: 'bm-box' }, h('b', null, 'Finir le tour ?'), h('span', null, `${left} unité${left > 1 ? 's' : ''} n'${left > 1 ? 'ont' : 'a'} pas encore joué.`), h('div', { class: 'bt-row' }, no, yes)));
    yes.addEventListener('click', () => {
      el.remove();
      void this.commit({ k: 'end' }, true);
    });
    no.addEventListener('click', () => el.remove());
    this.layer.append(el);
  }

  private menu() {
    const close = () => el.remove();
    const item_ = (label: string, fn: () => void) => {
      const b = h('button', { class: 'btn' }, label);
      b.addEventListener('click', () => {
        close();
        fn();
      });
      return b;
    };
    const scenes = { full: 'COMPLÈTES', fast: 'RAPIDES', off: 'COUPÉES' } as const;
    const el = h(
      'div',
      { class: 'bt-modal' },
      h(
        'div',
        { class: 'bm-box menu-box' },
        h('b', null, 'PAUSE'),
        h('span', { class: 'bm-obj' }, objectiveText(this.state, true)),
        item_('REPRENDRE', () => {}),
        item_(`SCÈNES DE COMBAT : ${scenes[settings.scenes]}`, () => {
          settings.scenes = settings.scenes === 'full' ? 'fast' : settings.scenes === 'fast' ? 'off' : 'full';
          saveSettings();
          this.menu();
        }),
        item_(`COUPS CRITIQUES SPÉCIAUX : ${settings.critFx ? 'OUI' : 'NON'}`, () => {
          settings.critFx = !settings.critFx;
          saveSettings();
          this.menu();
        }),
        item_(`ZONE DE DANGER : ${settings.danger ? 'OUI' : 'NON'}`, () => {
          settings.danger = !settings.danger;
          saveSettings();
          this.render(false);
          this.menu();
        }),
        item_('LISTE DES UNITÉS', () => this.unitList()),
        item_(this.info.mode === 'online' ? 'QUITTER LA PARTIE' : 'QUITTER (PARTIE SAUVEGARDÉE)', () => {
          this.net?.close();
          goTitle();
        }),
      ),
    );
    el.addEventListener('click', (e) => {
      if (e.target === el) close();
    });
    this.layer.append(el);
  }

  private unitList() {
    const s = this.state;
    const close = () => el.remove();
    const rows = s.units
      .filter((u) => u.alive && this.seenByViewer(u))
      .sort((a, b) => a.team - b.team)
      .map((u) => {
        const b = h('button', { class: 'ul-row t' + u.team + (u.done ? ' done' : '') }, this.faceEl(u, 'tface'), h('b', null, u.name), h('small', null, `${classOf(u).name} ${u.level}`), h('span', null, `${u.hp}/${u.stats.hp}`));
        b.addEventListener('click', () => {
          close();
          if (u.carriedBy === null && !u.escaped) {
            this.rig.focus(this.board.worldOf(u.x, u.y));
            this.inspect = { x: u.x, y: u.y };
            this.cursor = { x: u.x, y: u.y };
            if (this.mode.m === 'idle') this.render();
          }
        });
        return b;
      });
    const el = h('div', { class: 'bt-modal' }, h('div', { class: 'bm-box sheet' }, h('b', null, 'UNITÉS'), h('div', { class: 'ul-list' }, ...rows), h('button', { class: 'btn', onclick: close }, 'FERMER')));
    this.layer.append(el);
  }

  /** full unit sheet: stats, inventory, supports */
  private unitSheet(u: Unit) {
    const c = classOf(u);
    const close = () => el.remove();
    const stat = (k: keyof typeof GROW_NAMES, label: string) => {
      const v = u.stats[k];
      const cap = c.caps[k];
      return h('div', { class: 'st-row' }, h('span', null, label), h('b', null, String(v)), h('i', { class: 'st-bar' }, h('em', { style: `width:${Math.min(100, (v / (k === 'hp' ? 60 : 30)) * 100)}%` })), h('small', null, `/${cap}`));
    };
    const supports = partnersOf(u.defId).map((pid) => {
      const mate = this.state.units.find((x) => x.defId === pid && x.team === u.team);
      const key = pairKey(u.defId, pid);
      const st = this.state.supports[u.team][key] ?? { pts: 0, level: 0 };
      const lv = mate ? supportLevel(this.state, u, mate) : st.level;
      const next = SUPPORT_THRESHOLDS[Math.min(2, st.level)];
      return h('div', { class: 'sp-row' }, h('b', null, SUPPORT_LETTERS[lv]), h('span', null, SUPPORT_TALKS[key] ? pid.toUpperCase() : pid), st.level < 3 ? h('small', null, `${st.pts}/${next}`) : null);
    });
    const as = u.stats.spd - Math.max(0, (equipped(u)?.wt ?? 0) - u.stats.con);
    const el = h(
      'div',
      { class: 'bt-modal' },
      h(
        'div',
        { class: 'bm-box sheet t' + u.team },
        h('div', { class: 'sh-head' }, this.faceEl(u, 'bigface'), h('div', null, h('b', null, u.name), h('span', null, `${c.name} · NIV. ${u.level} · EXP ${u.exp}`), h('small', null, c.desc))),
        h(
          'div',
          { class: 'sh-stats' },
          stat('hp', 'PV'),
          stat('pow', powName(c)),
          stat('skl', 'TEC'),
          stat('spd', 'VIT'),
          stat('lck', 'CHA'),
          stat('def', 'DÉF'),
          stat('res', 'RÉS'),
          h('div', { class: 'st-row' }, h('span', null, 'CON'), h('b', null, String(u.stats.con)), h('span', null, 'MVT'), h('b', null, String(u.stats.mov)), h('span', null, 'VIT ATT'), h('b', null, String(as))),
        ),
        h('div', { class: 'sh-items' }, ...u.items.map((sl, i) => h('div', { class: i === equippedIndex(u) ? 'eq' : '' }, `${item(sl.id).type ? WEAPON_ICONS[item(sl.id).type!] + ' ' : ''}${item(sl.id).name}`, h('small', null, ` ${sl.uses}/${item(sl.id).uses}`)))),
        supports.length ? h('div', { class: 'sh-sup' }, h('small', null, 'SOUTIENS'), ...supports) : null,
        h('div', { class: 'sh-w' }, `Armes : ${c.weapons.map((w) => WEAPON_ICONS[w] + ' ' + WEAPON_NAMES[w]).join(', ')}`),
        h('div', { class: 'sh-w' }, `Croissances : ${(['hp', 'pow', 'skl', 'spd', 'lck', 'def', 'res'] as const).map((k) => `${k === 'pow' ? powName(c) : GROW_NAMES[k]} ${u.growth[k]}%`).join(' · ')}`),
        c.promotesTo ? h('div', { class: 'sh-w' }, `Promotion (niv. 10 + Diplôme BBL) : ${c.promotesTo.map((x) => CLASSES[x].name).join(' ou ')}`) : null,
        h('button', { class: 'btn', onclick: close }, 'FERMER'),
      ),
    );
    el.addEventListener('click', (e) => {
      if (e.target === el) close();
    });
    this.layer.append(el);
  }

  private async supportTalk(a: Unit, b: Unit, level: number) {
    const key = pairKey(a.defId, b.defId);
    const talk = SUPPORT_TALKS[key]?.[level - 1] ?? [];
    audio.sfx('shine');
    const box = h('div', { class: 'talk-box' });
    const el = h('div', { class: 'bt-modal talk' }, h('div', { class: 'talk-title' }, `SOUTIEN ${SUPPORT_LETTERS[level]} : ${a.name} & ${b.name}`), box);
    this.layer.append(el);
    for (const [who, text] of talk) {
      const u = who === a.defId ? a : who === b.defId ? b : a;
      box.replaceChildren(h('div', { class: 'talk-line t' + u.team }, this.faceEl(u, 'tface'), h('div', null, h('b', null, u.name), h('span', null, text))));
      await new Promise<void>((r) => {
        const t = setTimeout(r, Math.max(2200, text.length * 55));
        el.onclick = () => {
          clearTimeout(t);
          r();
        };
      });
    }
    el.remove();
    this.toast(`Soutien ${SUPPORT_LETTERS[level]} ! Bonus quand ils sont à 3 cases ou moins.`, 2200);
  }

  private popup(card: HTMLElement, ms: number): Promise<void> {
    const el = h('div', { class: 'bt-modal pop' }, card);
    this.layer.append(el);
    return new Promise((r) => {
      const t = setTimeout(done, this.fast(ms));
      function done() {
        clearTimeout(t);
        el.remove();
        r();
      }
      el.addEventListener('click', done);
    });
  }

  private toast(text: string, ms = 1400) {
    const el = h('div', { class: 'bt-toast' }, text);
    this.layer.append(el);
    setTimeout(() => el.remove(), ms);
  }

  private floatText(p: THREE.Vector3, text: string, cls: string) {
    tmpV.copy(p);
    tmpV.y += 1.3;
    tmpV.project(this.rig.camera);
    const r = this.app.canvas.getBoundingClientRect();
    const x = r.left + ((tmpV.x + 1) / 2) * r.width;
    const y = r.top + ((1 - tmpV.y) / 2) * r.height;
    const el = h('div', { class: 'pop ' + cls, style: `left:${x}px;top:${y}px` }, text);
    this.layer.append(el);
    setTimeout(() => el.remove(), 1000);
  }
}

function map0Music(mapId: string) {
  return mapId === 'quartier' ? 'hood' : mapId === 'chateau' ? 'dojo' : mapId === 'neige' ? 'parking' : 'select';
}

export function objectiveText(s: BattleState, long = false): string {
  const o = s.objective;
  const lim = o.turns ? (long ? ` (limite : ${o.turns} tours)` : ` · ${o.turns} T`) : '';
  switch (o.kind) {
    case 'rout':
      return 'Vaincre tous les ennemis' + lim;
    case 'boss':
      return 'Vaincre le chef adverse 👑' + lim;
    case 'seize':
      return 'Capturer le trône adverse avec ton chef' + lim;
    case 'defend':
      return long ? `${s.teams[(1 - o.attacker) as Team].name} doit tenir ${o.turns} tours, ${s.teams[o.attacker].name} doit tout vaincre` : `Tenir ${o.turns} tours / tout vaincre`;
    case 'escape':
      return long ? `${s.teams[o.attacker].name} doit faire fuir son chef par la sortie (violet) en ${o.turns} tours` : `Fuite du chef · ${o.turns} T`;
  }
}

/** a last word when a friend falls */
function deathLine(u: Unit, campaign: boolean): string {
  const lines = ['Je reviendrai…', 'C’était pas mon jour.', 'Dites à ma mère… que j’ai gagné.', 'Aïe. Juste… aïe.', 'Je vous regarde depuis le banc.'];
  const k = (u.uid * 7 + u.level) % lines.length;
  return `${u.name} : « ${lines[k]} »${campaign ? '' : ''}`;
}
