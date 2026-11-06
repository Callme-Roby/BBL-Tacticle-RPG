import * as THREE from 'three';
import type { FighterDef } from '../data/roster';
import type { ClassLook } from '../rules/classes';
import type { WeaponType } from '../rules/types';
import { createPS1Material, type PS1Material } from './ps1Material';
import { FighterView } from './fighterView';
import type { FaceAssets } from './faceTexture';
import { buildArmor, buildHorse, buildSaucer, buildWeapon, disposeWeapon } from './weapons';

/** team colours (rings, HP bars, mounts' cloth) */
export const TEAM_COLORS = [0x3a7cff, 0xff4434] as const;

/** size of a friend on the map (1 = fight size, ~1.8 m) */
export const MAP_SCALE = 0.52;

const tmpV = new THREE.Vector3();

let ringGeo: THREE.BufferGeometry | null = null;
const ringMats: PS1Material[] = [];
function ring(team: number): THREE.Mesh {
  if (!ringGeo) ringGeo = new THREE.RingGeometry(0.3, 0.42, 16).rotateX(-Math.PI / 2);
  if (!ringMats[team]) ringMats[team] = createPS1Material({ color: TEAM_COLORS[team], unlit: 1, transparent: true, opacity: 0.85, depthWrite: false, snap: false });
  const m = new THREE.Mesh(ringGeo, ringMats[team]);
  m.renderOrder = 3;
  return m;
}

/**
 * A friend standing on the map: the 3D model (shrunk), its mount (horse /
 * saucer), armour pieces, the weapon in hand, a team ring and a HP bar.
 */
export class UnitSprite {
  readonly group = new THREE.Group();
  readonly view: FighterView;
  private mount: THREE.Object3D | null = null;
  private weapon: THREE.Object3D | null = null;
  private weaponKey = '';
  private ring: THREE.Mesh;
  private bar = new THREE.Group();
  private barFill: THREE.Mesh;
  private crown: THREE.Mesh | null = null;
  private time = Math.random() * 10;
  private path: THREE.Vector3[] = [];
  private onArrive: (() => void) | null = null;
  /** current yaw of the body (0 = facing +Z) and the one to rest at */
  private yaw = 0;
  restYaw = 0;
  private clip = 'mapIdle';
  private clipStart = 0;
  private hover = 0;
  private hpRatio = 1;
  private grey = 0;

  constructor(
    readonly def: FighterDef,
    face: FaceAssets,
    readonly team: number,
    readonly look: ClassLook,
    leader: boolean,
  ) {
    // big heads on the map: the friends' faces stay recognisable from above
    this.view = new FighterView({ ...def, headScale: Math.min(1.75, (def.headScale ?? 1.18) * 1.42) }, face);
    this.view.addTo(this.group);
    this.view.root.scale.setScalar(MAP_SCALE);
    this.view.shadow.scale.set(0.55, 1, 0.45);
    this.view.shadow.position.y = 0.012;
    this.ring = ring(team);
    this.ring.position.y = 0.02;
    this.group.add(this.ring);
    const cloth = TEAM_COLORS[team];
    if (look === 'horse') {
      this.mount = buildHorse(team === 0 ? 0x8a5a34 : 0x4a3a32, cloth);
      this.mount.scale.setScalar(0.5);
      this.group.add(this.mount);
      // hips on the saddle
      this.view.root.position.y = 0.6 - 0.98 * (def.height ?? 1) * MAP_SCALE + 0.04;
      this.clip = 'ride';
    } else if (look === 'flier') {
      this.mount = buildSaucer(cloth);
      this.mount.scale.setScalar(0.42);
      this.group.add(this.mount);
      this.hover = 0.32;
    } else if (look === 'armor') {
      const a = buildArmor(team === 0 ? 0x8a9ab8 : 0xb88a7a);
      const b = this.view.model.bones;
      b.chest.add(a.chest);
      b.shoulderL.add(a.shoulderL);
      b.shoulderR.add(a.shoulderR);
      b.head.add(a.head);
    }
    // HP bar (billboard)
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.09), new THREE.MeshBasicMaterial({ color: 0x101018, depthTest: false }));
    this.barFill = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.055), new THREE.MeshBasicMaterial({ color: team === 0 ? 0x50c8ff : 0xff6a50, depthTest: false }));
    this.barFill.position.z = 0.001;
    bg.renderOrder = 20;
    this.barFill.renderOrder = 21;
    this.bar.add(bg, this.barFill);
    this.bar.position.y = 1.32 + (look === 'horse' ? 0.4 : 0) + this.hover;
    this.group.add(this.bar);
    if (leader) {
      const g = new THREE.ConeGeometry(0.09, 0.14, 4);
      this.crown = new THREE.Mesh(g, createPS1Material({ color: 0xffd040, unlit: 0.6 }));
      this.crown.position.y = this.bar.position.y + 0.14;
      this.group.add(this.crown);
    }
  }

  setWeapon(id: string | null, type: WeaponType | undefined) {
    const key = id ?? '';
    if (key === this.weaponKey) return;
    this.weaponKey = key;
    if (this.weapon) {
      this.weapon.removeFromParent();
      disposeWeapon(this.weapon);
      this.weapon = null;
    }
    if (!id) return;
    this.weapon = buildWeapon(id, type);
    if (this.weapon) this.view.model.bones.handR.add(this.weapon);
  }

  setHp(ratio: number) {
    this.hpRatio = Math.max(0, Math.min(1, ratio));
    this.barFill.scale.x = Math.max(0.001, this.hpRatio);
    this.barFill.position.x = -0.29 * (1 - this.hpRatio);
  }

  /** greyed out once it has played this turn */
  setDone(done: boolean) {
    this.grey = done ? 0.55 : 0;
    this.view.setGrey(this.grey);
  }

  setVisible(v: boolean) {
    this.group.visible = v;
  }

  place(p: THREE.Vector3) {
    this.group.position.copy(p);
    this.path.length = 0;
  }

  /** walk along world points (tile centres), then call `done` */
  walk(points: THREE.Vector3[], done?: () => void) {
    this.path = points.slice(1);
    this.onArrive = done ?? null;
    if (!this.path.length) {
      this.onArrive?.();
      this.onArrive = null;
    }
  }

  get walking(): boolean {
    return this.path.length > 0;
  }

  play(clip: string) {
    this.clip = clip;
    this.clipStart = this.time;
  }

  /** a short hop / flash (hit, heal, level-up on the map) */
  flash(color: THREE.ColorRepresentation, amount = 0.8) {
    this.view.hitFlash(color, amount);
  }

  /** time not yet given to the idle animation (see `animate`) */
  private animAcc = 0;

  /**
   * @param animate false = skip the skeleton update this frame (idle units are
   * animated every other frame, in turns: half the skinning work on phones)
   */
  update(dt: number, camera: THREE.Camera, animate = true) {
    this.time += dt;
    const g = this.group.position;
    let moving = false;
    if (this.path.length) {
      moving = true;
      const target = this.path[0];
      const speed = 6.5 * dt;
      tmpV.subVectors(target, g);
      const d = Math.hypot(tmpV.x, tmpV.z);
      if (d > 0.001) this.yaw = Math.atan2(tmpV.x, tmpV.z);
      if (d <= speed) {
        g.copy(target);
        this.path.shift();
        if (!this.path.length) {
          const cb = this.onArrive;
          this.onArrive = null;
          cb?.();
        }
      } else {
        g.x += (tmpV.x / d) * speed;
        g.z += (tmpV.z / d) * speed;
        g.y += (target.y - g.y) * Math.min(1, dt * 12);
      }
    } else {
      // turn back toward the camera
      let dy = this.restYaw - this.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * Math.min(1, dt * 8);
    }
    const s = (this.def.height ?? 1) * MAP_SCALE;
    this.view.model.body.rotation.y = this.yaw;
    this.view.model.body.scale.setScalar(this.def.height ?? 1);
    void s;
    if (this.mount) this.mount.rotation.y = this.yaw;
    const bob = this.hover ? Math.sin(this.time * 2.4) * 0.04 : 0;
    if (this.mount && this.hover) this.mount.position.y = this.hover - 0.22 + bob;
    if (this.hover) this.view.root.position.y = this.hover + 0.04 + bob;
    const clip = moving && this.look !== 'horse' && this.look !== 'flier' ? 'walkF' : this.clip;
    const frame = moving ? this.time * 90 : (this.time - this.clipStart) * 60;
    this.animAcc += dt;
    if (animate || moving) {
      this.view.pose(clip, frame, this.animAcc * 60, clip === 'walkF' ? 'walk' : clip + this.clipStart);
      this.animAcc = 0;
    }
    // billboard bar
    this.bar.quaternion.copy(camera.quaternion);
    if (this.crown) this.crown.rotation.y += dt * 2;
  }

  dispose() {
    if (this.weapon) disposeWeapon(this.weapon);
    this.mount?.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).geometry.dispose();
    });
    for (const m of this.bar.children as THREE.Mesh[]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.crown?.geometry.dispose();
    this.view.dispose();
    this.group.removeFromParent();
  }
}
