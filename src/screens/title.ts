import * as THREE from 'three';
import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import { fullRoster } from '../game/settings';
import { loadMatch } from '../game/match';
import { input } from '../input/input';
import { BoardView } from '../render/board';
import { loadFace } from '../render/faceTexture';
import { PS1Globals } from '../render/ps1Material';
import { registerTacticsClips } from '../render/tacticsPoses';
import { UnitSprite } from '../render/unitSprite';
import { CLASSES } from '../rules/classes';
import { getMap, parseMap } from '../rules/maps';
import { PROFILES } from '../rules/profiles';
import { h, Menu, uiRoot } from '../ui/dom';
import { goBattle, goCampaign, goHelp, goLab, goOnline, goOptions, goSetup } from './flow';

/**
 * Title screen: the logo over a slowly turning diorama (a map with a few
 * friends standing on it) and the main menu.
 */
export class TitleScreen implements Screen {
  private scene = new THREE.Scene();
  private board: BoardView;
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
  private sprites: UnitSprite[] = [];
  private menu!: Menu;
  private t = 0;
  private disposed = false;

  constructor(private app: App) {
    registerTacticsClips();
    const maps = ['parc', 'plage', 'collines', 'quartier'];
    const m = parseMap(getMap(maps[Math.floor(Math.random() * maps.length)]));
    this.board = new BoardView(m.w, m.h, m.tiles, m.theme);
    this.scene.add(this.board.group);
  }

  enter() {
    const saved = loadMatch();
    const items = [
      ...(saved ? [{ label: 'CONTINUER', sub: `Partie en cours · tour ${saved.state.turn}`, action: () => goBattle(saved.info, saved.state, saved.log) }] : []),
      { label: 'ESCARMOUCHE', sub: '10 contre 10 contre l’ordinateur', action: () => goSetup('skirmish') },
      { label: 'À DEUX', sub: 'Sur le même téléphone, chacun son tour', action: () => goSetup('local') },
      { label: 'EN LIGNE', sub: 'Invite un pote avec un lien', action: () => goOnline() },
      { label: 'CAMPAGNE', sub: 'L’histoire de la bande', action: () => goCampaign() },
      { label: 'LABO', sub: 'Crée un perso avec une photo', action: () => goLab() },
      { label: 'AIDE', sub: 'Règles du jeu', action: () => goHelp() },
      { label: 'OPTIONS', sub: 'Son, qualité, scènes de combat', action: () => goOptions() },
    ];
    this.menu = new Menu(
      items.map((it) => ({
        ...it,
        action: () => {
          audio.sfx('confirm');
          it.action();
        },
      })),
      () => audio.sfx('cursor'),
    );
    this.menu.el.classList.add('title-menu');
    const logo = h('div', { class: 'logo' }, 'BBL', h('br'), 'TACTICS', h('small', null, 'LA GUERRE DES POTES'));
    uiRoot().append(h('div', { class: 'screen title tt-screen' }, logo, this.menu.el, h('div', { class: 'footer-hint title-foot' }, '© BBL CREW · tactique au tour par tour · photos des potes non contractuelles')));
    audio.playMusic('title');
    void this.spawn();
  }

  private async spawn() {
    const roster = fullRoster().filter((d) => PROFILES[d.id]);
    const picks = roster.sort(() => Math.random() - 0.5).slice(0, 6);
    const spots = [
      [4, 7],
      [6, 8],
      [5, 9],
      [7, 6],
      [3, 9],
      [8, 9],
    ];
    for (let i = 0; i < picks.length; i++) {
      const d = picks[i];
      const face = await loadFace(d);
      if (this.disposed) return;
      const cls = CLASSES[PROFILES[d.id].cls];
      const sp = new UnitSprite(d, face, i % 2, cls.look, false);
      const [x, y] = spots[i];
      sp.place(this.board.worldOf(Math.min(this.board.w - 1, x), Math.min(this.board.h - 1, y)));
      sp.restYaw = (i % 2 ? Math.PI : 0) + (Math.random() - 0.5);
      if (i % 3 === 0) sp.play('cheer');
      this.scene.add(sp.group);
      this.sprites.push(sp);
    }
  }

  exit() {
    this.disposed = true;
    for (const s of this.sprites) s.dispose();
    this.board.dispose();
  }

  frame(dt: number) {
    this.t += dt;
    for (const e of input.menuEvents()) {
      if (e.action === 'up') this.menu.move(-1);
      else if (e.action === 'down') this.menu.move(1);
      else if (e.action === 'confirm' || e.action === 'start') this.menu.activate();
    }
    const cx = this.board.w / 2;
    const cz = this.board.h / 2;
    const a = this.t * 0.12;
    const r = 11;
    this.camera.position.set(cx + Math.sin(a) * r, 7.5, cz + Math.cos(a) * r);
    this.camera.lookAt(cx, 0, cz);
    this.camera.aspect = this.app.aspect;
    this.camera.fov = this.app.aspect < 1 ? 60 : 36;
    this.camera.updateProjectionMatrix();
    for (const s of this.sprites) {
      s.update(dt, this.camera);
      if (s.view && Math.random() < 0.002) s.play('cheer');
    }
    this.board.update(dt);
    PS1Globals.uLightDir.value.set(0.35, 0.85, 0.45).normalize();
    PS1Globals.uLightColor.value.copy(this.board.lightColor);
    PS1Globals.uAmbient.value.copy(this.board.ambient);
    PS1Globals.uFogColor.value.copy(this.board.fogColor);
    PS1Globals.uFogNear.value = 18;
    PS1Globals.uFogFar.value = 45;
    this.app.pipeline.render(this.scene, this.camera, this.board.sky);
  }
}
