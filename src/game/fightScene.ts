import * as THREE from 'three';
import { audio } from '../audio/audio';
import type { FighterDef } from '../data/roster';
import { Effects } from '../render/effects';
import { loadFace } from '../render/faceTexture';
import { FighterView } from '../render/fighterView';
import type { RetroPipeline } from '../render/pipeline';
import { createPS1Material, makeCanvasTexture, PS1Globals, type PS1Material } from '../render/ps1Material';
import { STRIKE_FRAME } from '../render/tacticsPoses';
import { TEAM_COLORS } from '../render/unitSprite';
import { buildHorse, buildSaucer, buildWeapon, buildArmor, disposeWeapon } from '../render/weapons';
import type { ClassLook } from '../rules/classes';
import type { Strike } from '../rules/combat';
import type { ItemDef } from '../rules/items';
import type { Terrain } from '../rules/types';
import { h } from '../ui/dom';

/** One side of a fight scene. */
export interface FightSide {
  uid: number;
  def: FighterDef;
  name: string;
  team: number;
  look: ClassLook;
  weapon: ItemDef | null;
  hp: number;
  maxHp: number;
  /** forecast numbers shown in the HUD */
  dmg: number;
  hit: number;
  crit: number;
  canAttack: boolean;
}

export interface FightOptions {
  /** 1 = normal, 2 = fast */
  speed: number;
  critFx: boolean;
  terrain: Terrain;
  /** sky / ground colours of the map */
  sky: THREE.Color;
  ground: THREE.Color;
  dist: number;
}

const LEG_BONES = ['thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'] as const;

interface Actor {
  side: FightSide;
  view: FighterView;
  mount: THREE.Object3D | null;
  weapon: THREE.Object3D | null;
  /** x where it stands, x when striking (melee step-in) */
  home: number;
  front: number;
  facing: 1 | -1;
  clip: string;
  clipT: number;
  clipN: number;
  x: number;
  hp: number;
  dead: boolean;
  fade: number;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** attack clip of a weapon */
function attackClip(w: ItemDef | null): string {
  switch (w?.type) {
    case 'sword':
      return 'slash';
    case 'axe':
      return 'chop';
    case 'lance':
      return 'thrust';
    case 'bow':
      return 'bowShot';
    case 'anima':
    case 'light':
    case 'dark':
      return 'cast';
    default:
      return 'move:cross';
  }
}

/**
 * The 2–3 second 3D fight shown when two units clash (BBL FIGHTERZ models
 * and moves): side view, weapon swings, projectiles and spells, damage
 * numbers, misses, criticals (BBL MAX-style close-up, impact frame, speed
 * lines) and K.O. Plays an already-resolved list of strikes.
 */
export class FightScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.05, 200);
  readonly effects = new Effects();
  private actors: Actor[] = [];
  private disposables: { dispose(): void }[] = [];
  private hud: HTMLElement;
  private hpEls: { fill: HTMLElement; num: HTMLElement }[] = [];
  private camPos = new THREE.Vector3(0, 1.5, 6.2);
  private camLook = new THREE.Vector3(0, 1.05, 0);
  private camGoalPos = new THREE.Vector3(0, 1.5, 6.2);
  private camGoalLook = new THREE.Vector3(0, 1.05, 0);
  private shake = 0;
  private clear: THREE.Color;
  private projectiles: { obj: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; arc: number; done: () => void }[] = [];
  private impact = 0;
  private lines = 0;
  private time = 0;
  private skip = false;
  private aspect = 16 / 9;

  /** default side view: both fighters fit the screen, whatever its shape */
  private baseCam() {
    const halfW = this.opts.dist >= 2 ? 3.9 : 2.6;
    const fov = ((this.aspect < 1 ? 50 : 36) * Math.PI) / 180;
    const d = Math.max(this.opts.dist >= 2 ? 7.6 : 6.0, halfW / (Math.tan(fov / 2) * this.aspect));
    this.camGoalPos.set(0, 1.35 + d * 0.05, d);
    this.camGoalLook.set(0, this.aspect < 1 ? 1.25 : 1.05, 0);
  }

  private constructor(
    private pipeline: RetroPipeline,
    private overlay: HTMLElement,
    private opts: FightOptions,
  ) {
    this.clear = opts.sky.clone().multiplyScalar(0.8);
    this.scene.add(this.effects.group);
    this.hud = h('div', { class: 'fight-hud' });
    overlay.append(this.hud);
    this.buildSet();
  }

  static async create(pipeline: RetroPipeline, overlay: HTMLElement, a: FightSide, d: FightSide, opts: FightOptions): Promise<FightScene> {
    const fs = new FightScene(pipeline, overlay, opts);
    await fs.addActors(a, d);
    return fs;
  }

  /** ground strip + backdrop matching the defender's terrain */
  private buildSet() {
    const g = this.opts.ground;
    const t = this.opts.terrain;
    const tex = makeCanvasTexture(
      32,
      32,
      (ctx, w, hh) => {
        ctx.fillStyle = '#' + g.getHexString();
        ctx.fillRect(0, 0, w, hh);
        for (let i = 0; i < 70; i++) {
          const k = 0.8 + Math.random() * 0.4;
          ctx.fillStyle = '#' + g.clone().multiplyScalar(k).getHexString();
          ctx.fillRect(Math.floor(Math.random() * w), Math.floor(Math.random() * hh), 2, 1);
        }
      },
      true,
    );
    const mat = createPS1Material({ map: tex, uvScale: [16, 12] });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 44, 14, 10).rotateX(-Math.PI / 2), mat);
    floor.position.z = 4;
    this.scene.add(floor);
    // gradient backdrop
    const sky = this.opts.sky;
    const wallGeo = new THREE.CylinderGeometry(16, 16, 14, 20, 4, true, Math.PI * 0.55, Math.PI * 0.9);
    const col: number[] = [];
    const pos = wallGeo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const k = (pos.getY(i) + 7) / 14;
      const c = sky.clone().multiplyScalar(0.55 + k * 0.6);
      col.push(c.r, c.g, c.b);
    }
    wallGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const wallMat = createPS1Material({ vertexColors: true, unlit: 1, fog: false, side: THREE.BackSide });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0, 5, 4);
    this.scene.add(wall);
    // a few props in the background for the terrain
    const decoMat = createPS1Material({ vertexColors: true });
    const deco = new THREE.Group();
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const tree = (x: number, z: number, s: number, leaf: number) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 1 * s, 5), createPS1Material({ color: 0x5a3a20 }));
      trunk.position.set(x, 0.5 * s, z);
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 2.2 * s, 6), createPS1Material({ color: leaf }));
      top.position.set(x, 1.9 * s, z);
      deco.add(trunk, top);
    };
    const forest = t === 'forest';
    for (let i = 0; i < (forest ? 14 : 5); i++) tree(rnd(-12, 12), rnd(-8, -3) + (forest && i % 3 === 0 ? 4.8 : 0), rnd(0.8, 1.4), forest ? 0x2a6a2a : 0x3a7a32);
    if (t === 'hill' || t === 'mountain') {
      for (let i = 0; i < 4; i++) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(rnd(3, 5), rnd(3, 6), 6), createPS1Material({ color: 0x7a7468 }));
        m.position.set(rnd(-12, 12), 1.5, rnd(-12, -8));
        deco.add(m);
      }
    }
    if (t === 'fort' || t === 'throne' || t === 'floor' || t === 'pillar') {
      for (let i = -3; i <= 3; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5, 0.7), createPS1Material({ color: 0x8a8690 }));
        p.position.set(i * 3.2, 2.5, -4);
        deco.add(p);
      }
    }
    this.scene.add(deco);
    this.disposables.push(tex, mat, floor.geometry, wallGeo, wallMat, decoMat);
    deco.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) this.disposables.push(m.geometry, m.material as PS1Material);
    });
  }

  private async addActors(a: FightSide, d: FightSide) {
    // team 0 on the right (like the classics: the player on the right), team 1 on the left
    const ranged = this.opts.dist >= 2;
    const sides = [a, d];
    for (const s of sides) {
      const face = await loadFace(s.def);
      const view = new FighterView(s.def, face);
      view.addTo(this.scene);
      const right = s.team === 0;
      const facing: 1 | -1 = right ? -1 : 1;
      const home = (right ? 1 : -1) * (ranged ? 2.7 : 1.45);
      const front = (right ? 1 : -1) * (ranged ? 2.5 : 0.62);
      let mount: THREE.Object3D | null = null;
      if (s.look === 'horse') {
        mount = buildHorse(s.team === 0 ? 0x8a5a34 : 0x4a3a32, TEAM_COLORS[s.team]);
        this.scene.add(mount);
      } else if (s.look === 'flier') {
        mount = buildSaucer(TEAM_COLORS[s.team]);
        mount.scale.setScalar(0.95);
        this.scene.add(mount);
      } else if (s.look === 'armor') {
        const arm = buildArmor(s.team === 0 ? 0x8a9ab8 : 0xb88a7a);
        const b = view.model.bones;
        b.chest.add(arm.chest);
        b.shoulderL.add(arm.shoulderL);
        b.shoulderR.add(arm.shoulderR);
        b.head.add(arm.head);
      }
      const weapon = s.weapon ? buildWeapon(s.weapon.id, s.weapon.type) : null;
      if (weapon) view.model.bones.handR.add(weapon);
      view.prepareTrail();
      this.actors.push({ side: s, view, mount, weapon, home, front, facing, clip: s.look === 'horse' ? 'ride' : 'stance', clipT: 0, clipN: 0, x: home, hp: s.hp, dead: false, fade: 0 });
    }
    this.buildHud();
  }

  private buildHud() {
    this.hud.replaceChildren();
    this.hpEls = [];
    // left = team 1, right = team 0
    const order = [...this.actors].sort((p, q) => q.side.team - p.side.team);
    for (const act of order) {
      const s = act.side;
      const fill = h('i');
      const num = h('b', null, String(s.hp));
      this.hpEls[this.actors.indexOf(act)] = { fill, num };
      const stats = s.canAttack ? `DÉG ${s.dmg} · PRÉ ${s.hit} · CRIT ${s.crit}` : 'PAS DE RIPOSTE';
      this.hud.append(
        h(
          'div',
          { class: 'fh-side t' + s.team },
          h('div', { class: 'fh-name' }, s.name, h('small', null, s.weapon?.name ?? '')),
          h('div', { class: 'fh-hp' }, num, h('span', { class: 'fh-bar' }, fill)),
          h('div', { class: 'fh-stats' }, stats),
        ),
      );
      this.setHp(this.actors.indexOf(act), s.hp);
    }
  }

  private setHp(i: number, hp: number) {
    const el = this.hpEls[i];
    if (!el) return;
    const s = this.actors[i].side;
    el.fill.style.width = `${Math.max(0, (hp / s.maxHp) * 100)}%`;
    el.num.textContent = String(Math.max(0, hp));
  }

  /** skip the rest of the scene (tap) */
  hurry() {
    this.skip = true;
  }

  private ms(n: number) {
    return this.skip ? 0 : n / this.opts.speed;
  }

  /** plays the strikes; resolves when the scene is over */
  async play(strikes: Strike[]): Promise<void> {
    this.time = 0;
    this.baseCam();
    this.camPos.set(this.camGoalPos.x - 1.2, this.camGoalPos.y + 0.6, this.camGoalPos.z + 2);
    audio.sfx('dash', { volume: 0.5 });
    await wait(this.ms(380));
    for (const st of strikes) {
      const att = this.actors.find((x) => x.side.uid === st.by)!;
      const def = this.actors.find((x) => x !== att)!;
      if (att.dead || def.dead) break;
      await this.strike(att, def, st);
      await wait(this.ms(160));
    }
    // winner's little celebration / K.O.
    const dead = this.actors.find((x) => x.dead);
    if (dead) {
      const other = this.actors.find((x) => x !== dead)!;
      if (other.side.look !== 'horse') this.playClip(other, 'cheer');
    }
    await wait(this.ms(dead ? 900 : 450));
  }

  private playClip(act: Actor, clip: string) {
    act.clip = clip;
    act.clipT = 0;
    act.clipN++;
  }

  private async strike(att: Actor, def: Actor, st: Strike) {
    const w = att.side.weapon;
    const melee = this.opts.dist < 2 && w?.type !== 'bow' && !(w && (w.type === 'anima' || w.type === 'light' || w.type === 'dark'));
    // ---- critical: BBL MAX style close-up
    if (st.crit && this.opts.critFx && !this.skip) {
      this.playClip(att, 'superFlash');
      att.view.setGlow(0.5, 0xff9a20);
      const head = att.view.headWorld(new THREE.Vector3());
      head.y -= 0.12;
      // in front of the face, a little toward the gameplay camera
      const back = this.aspect < 1 ? 1.75 : 1.45;
      this.camGoalPos.set(head.x + att.facing * back * 0.8, head.y + 0.1, head.z + back * 0.6);
      this.camGoalLook.copy(head);
      audio.sfx('super');
      const lines = att.side.def.superLines ?? att.side.def.introLines;
      const line = lines[Math.floor(Math.random() * lines.length)] ?? 'CRITIQUE !';
      this.banner('CRITIQUE !', line);
      void audio.say(line, { lang: att.side.def.voice?.lang ?? 'fr-FR', pitch: att.side.def.voice?.pitch, rate: (att.side.def.voice?.rate ?? 1) * 1.1 });
      await wait(this.ms(900));
      att.view.setGlow(0);
      this.baseCam();
    }
    // ---- swing
    this.playClip(att, attackClip(w));
    if (melee) att.x = att.home;
    const strikeMs = (STRIKE_FRAME / 60) * 1000;
    if (melee) {
      // step in during the wind-up
      const t0 = performance.now();
      const dur = this.ms(strikeMs);
      while (performance.now() - t0 < dur) {
        const k = Math.min(1, (performance.now() - t0) / Math.max(1, dur));
        att.x = att.home + (att.front - att.home) * k;
        await wait(16);
      }
      att.x = att.front;
    } else {
      await wait(this.ms(strikeMs));
      await this.projectile(att, def, w);
    }
    // ---- impact
    if (st.hit) {
      def.hp = st.hpAfter;
      this.setHp(this.actors.indexOf(def), def.hp);
      def.view.hitFlash(st.crit ? 0xffe060 : 0xffffff, 0.9);
      const p = def.view.headWorld(new THREE.Vector3());
      p.y -= 0.45;
      this.effects.hit(p.x, p.y, st.crit || st.dmg >= 10 ? 'heavy' : st.dmg >= 5 ? 'medium' : 'light', st.crit, 1, 0.3);
      if (st.crit) {
        this.effects.impactBurst(p.x, p.y, 3, att.facing, true);
        this.impact = 3;
        this.lines = 1;
        this.shake = 0.18;
        audio.sfx('impact');
      } else this.shake = st.dmg >= 8 ? 0.08 : 0.04;
      audio.sfx(st.crit ? 'hitHeavy' : st.dmg >= 8 ? 'hitMedium' : 'hitLight');
      this.popNumber(p, st.dmg > 0 ? String(st.dmg) : 'NUL', st.crit ? 'crit' : st.dmg > 0 ? '' : 'nul');
      if (st.drained > 0) {
        att.hp = Math.min(att.side.maxHp, att.hp + st.drained);
        this.setHp(this.actors.indexOf(att), att.hp);
        att.view.hitFlash(0x50ff80, 0.6);
        this.popNumber(att.view.headWorld(new THREE.Vector3()), '+' + st.drained, 'heal');
      }
      if (def.hp <= 0) {
        def.dead = true;
        this.playClip(def, def.side.look === 'horse' ? 'hitMid' : 'blownAway');
        audio.sfx('ko');
      } else this.playClip(def, def.side.look === 'horse' ? 'hitMid' : st.crit ? 'hitHigh' : 'hitMid');
    } else {
      // dodge: a quick hop back
      this.playClip(def, def.side.look === 'horse' ? 'ride' : 'dashB');
      const p = def.view.headWorld(new THREE.Vector3());
      this.popNumber(p, 'ESQUIVE', 'miss');
      audio.sfx(melee ? 'whiff' : 'whiffHeavy');
    }
    await wait(this.ms(420));
    if (st.broke) this.banner('', `${w?.name ?? 'Son arme'} est cassé${w?.name.endsWith('e') ? 'e' : ''} !`);
    // back home
    if (melee) {
      const t0 = performance.now();
      const dur = this.ms(220);
      while (performance.now() - t0 < dur) {
        const k = Math.min(1, (performance.now() - t0) / Math.max(1, dur));
        att.x = att.front + (att.home - att.front) * k;
        await wait(16);
      }
      att.x = att.home;
    }
    if (!att.dead) this.playClip(att, att.side.look === 'horse' ? 'ride' : 'stance');
    if (!def.dead) this.playClip(def, def.side.look === 'horse' ? 'ride' : 'stance');
  }

  /** arrows and spells fly to the target */
  private projectile(att: Actor, def: Actor, w: ItemDef | null): Promise<void> {
    const from = att.view.model.bones.handR.getWorldPosition(new THREE.Vector3());
    const to = def.view.headWorld(new THREE.Vector3());
    to.y -= 0.45;
    let obj: THREE.Object3D;
    let arc = 0;
    const t = w?.type;
    if (t === 'bow') {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.025, 0.025), createPS1Material({ color: 0xd8c8a0 })));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), createPS1Material({ color: 0xc0c4cc }));
      tip.rotation.z = -Math.PI / 2;
      tip.position.x = 0.34;
      g.add(tip);
      obj = g;
      arc = 0.25;
      audio.sfx('toss', { volume: 0.7 });
    } else {
      const col = t === 'anima' ? (w?.id.includes('orage') ? 0xfff060 : w?.id.includes('seche') ? 0xd0f0ff : 0xff6a20) : t === 'light' ? 0xfff8d0 : 0xb040ff;
      obj = new THREE.Mesh(new THREE.IcosahedronGeometry(t === 'anima' && w?.id.includes('grenade') ? 0.12 : 0.18, 0), createPS1Material({ color: col, unlit: 1 }));
      arc = w?.id.includes('grenade') || w?.id.includes('meteore') ? 0.8 : 0.1;
      audio.sfx('zap', { volume: 0.7 });
    }
    this.scene.add(obj);
    return new Promise((resolve) => {
      this.projectiles.push({
        obj,
        from,
        to,
        t: 0,
        dur: Math.max(0.01, this.ms(320) / 1000),
        arc,
        done: () => {
          const kind = t === 'anima' ? 'grenade' : t === 'light' ? 'energy' : t === 'dark' ? 'words' : null;
          if (kind) this.effects.shotImpact(kind, to.clone(), 'hit');
          if (t === 'anima' && !w?.id.includes('orage')) this.effects.cine('explosion', to.clone(), 0.8);
          if (t === 'light') this.effects.cine('shine', to.clone(), 1.2);
          obj.removeFromParent();
          obj.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) {
              m.geometry.dispose();
              (m.material as THREE.Material).dispose();
            }
          });
          resolve();
        },
      });
    });
  }

  private banner(big: string, small: string) {
    const el = h('div', { class: 'fh-banner' }, big ? h('b', null, big) : null, small ? h('span', null, small) : null);
    this.overlay.append(el);
    setTimeout(() => el.remove(), Math.max(400, this.ms(1300)));
  }

  private popNumber(p: THREE.Vector3, text: string, cls: string) {
    const v = p.clone().project(this.camera);
    const rect = this.pipeline.renderer.domElement.getBoundingClientRect();
    const x = rect.left + ((v.x + 1) / 2) * rect.width;
    const y = rect.top + ((1 - v.y) / 2) * rect.height;
    const el = h('div', { class: 'pop ' + cls, style: `left:${x}px;top:${y}px` }, text);
    this.overlay.append(el);
    setTimeout(() => el.remove(), 900);
  }

  render(dt: number, aspect: number) {
    this.time += dt;
    this.aspect = aspect;
    const k = dt * 60;
    for (const act of this.actors) {
      act.clipT += k * this.opts.speed;
      const v = act.view;
      v.root.position.set(act.x, act.side.look === 'flier' ? 0.62 + Math.sin(this.time * 2.4) * 0.05 : 0, 0);
      if (act.mount) {
        act.mount.position.set(act.x, act.side.look === 'flier' ? 0.05 + Math.sin(this.time * 2.4) * 0.05 : 0, 0);
        act.mount.rotation.y = (act.facing * Math.PI) / 2;
      }
      if (act.side.look === 'horse') v.root.position.y = 1.18 - 0.98 * (act.side.def.height ?? 1) + 0.05;
      v.setFacing(act.facing);
      v.pose(act.clip, act.clipT, k * this.opts.speed, act.clip + ':' + act.clipN, 3);
      // riders keep their legs on the horse
      if (act.side.look === 'horse' && act.clip !== 'ride') {
        const tmp = new THREE.Quaternion();
        for (const b of LEG_BONES) {
          const e = RIDE_LEGS[b];
          tmp.setFromEuler(new THREE.Euler((e[0] * Math.PI) / 180, (e[1] * Math.PI) / 180, (e[2] * Math.PI) / 180, 'XYZ'));
          v.model.bones[b].quaternion.copy(tmp);
        }
      }
      if (act.dead) {
        if (act.fade === 0) for (const m of v.model.materials) m.transparent = true;
        act.fade = Math.min(1, act.fade + dt * 0.9 * this.opts.speed);
        for (const m of v.model.materials) m.uniforms.uOpacity.value = 1 - Math.max(0, act.fade - 0.4) / 0.6;
        if (act.mount) act.mount.visible = act.fade < 0.9;
      }
      v.updateTrail(act.clip === 'superFlash' ? 0xffa030 : null, k);
    }
    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt;
      const u = Math.min(1, p.t / p.dur);
      p.obj.position.lerpVectors(p.from, p.to, u);
      p.obj.position.y += Math.sin(u * Math.PI) * p.arc;
      p.obj.rotation.z = Math.atan2(p.to.y - p.from.y, p.to.x - p.from.x);
      p.obj.rotation.x += dt * 8;
      if (u >= 1) {
        this.projectiles.splice(i, 1);
        p.done();
      }
    }
    this.effects.update(k);
    // camera
    const ck = Math.min(1, dt * 6);
    this.camPos.lerp(this.camGoalPos, ck);
    this.camLook.lerp(this.camGoalLook, ck);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 0.6);
    }
    this.camera.lookAt(this.camLook);
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 1 ? 50 : 36;
    this.camera.updateProjectionMatrix();
    // lighting
    PS1Globals.uLightDir.value.set(0.3, 0.8, 0.6).normalize();
    PS1Globals.uLightColor.value.setRGB(1, 0.96, 0.9);
    PS1Globals.uAmbient.value.setRGB(0.45, 0.45, 0.55);
    PS1Globals.uFogColor.value.copy(this.clear);
    PS1Globals.uFogNear.value = 14;
    PS1Globals.uFogFar.value = 40;
    // impact frame + speed lines (pipeline post pass)
    const post = this.pipeline.post;
    if (this.impact > 0) {
      post.uImpactMode.value = 1;
      post.uImpactTint.value.setRGB(1, 0.35, 0.1);
      post.uImpactSeed.value = Math.random();
      this.impact -= k;
    } else post.uImpactMode.value = 0;
    if (this.lines > 0) {
      post.uLines.value = this.lines;
      post.uLinesSeed.value = Math.floor(this.time * 20);
      this.lines = Math.max(0, this.lines - dt * 2.2);
    } else post.uLines.value = 0;
    this.pipeline.render(this.scene, this.camera, this.clear);
  }

  dispose() {
    const post = this.pipeline.post;
    post.uImpactMode.value = 0;
    post.uLines.value = 0;
    for (const a of this.actors) {
      if (a.weapon) disposeWeapon(a.weapon);
      a.mount?.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
      });
      a.mount?.removeFromParent();
      a.view.dispose();
    }
    this.effects.dispose();
    for (const d of this.disposables) d.dispose();
    this.hud.remove();
  }
}

const RIDE_LEGS: Record<(typeof LEG_BONES)[number], [number, number, number]> = {
  thighL: [-82, 0, 26],
  shinL: [86, 0, 0],
  footL: [-10, 0, 0],
  thighR: [-82, 0, -26],
  shinR: [86, 0, 0],
  footR: [-10, 0, 0],
};
