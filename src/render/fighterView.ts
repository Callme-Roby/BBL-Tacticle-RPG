import * as THREE from 'three';
import type { FighterDef } from '../data/roster';
import { Afterimage } from './afterimage';
import { Animator } from './animator';
import { buildCharacter, type CharacterModel } from './characterModel';
import type { FaceAssets } from './faceTexture';
import { makeCanvasTexture } from './ps1Material';

let shadowTex: THREE.Texture | null = null;
function getShadowTexture() {
  if (!shadowTex) {
    shadowTex = makeCanvasTexture(32, 32, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.65)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }
  return shadowTex;
}

/**
 * One of the friends in 3D (skinned low-poly body + photo face), animated by
 * name from the clip library of poses.ts. Adapted from BBL FIGHTERZ: the
 * fight-simulation driving was removed, the screens play clips directly.
 */
export class FighterView {
  readonly model: CharacterModel;
  readonly animator: Animator;
  readonly shadow: THREE.Mesh;
  private flash = 0;
  private flashColor = new THREE.Color(1, 1, 1);
  private glow = 0;
  private glowColor = new THREE.Color(1, 0.55, 0.1);
  /** dark tint (unit that already moved this turn), 0..1 */
  private grey = 0;
  private headPos = new THREE.Vector3();
  private trail: Afterimage | null = null;
  private parent: THREE.Object3D | null = null;

  constructor(
    readonly def: FighterDef,
    face: FaceAssets,
  ) {
    this.model = buildCharacter(def, face);
    this.animator = new Animator(this.model);
    const mat = new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false });
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
    this.shadow.renderOrder = 1;
  }

  get root() {
    return this.model.root;
  }

  addTo(scene: THREE.Object3D) {
    scene.add(this.model.root, this.shadow);
    this.parent = scene;
    if (this.trail) scene.add(this.trail.group);
  }

  /** ghost trail (afterimages): call every frame with a tint, null = fade out */
  updateTrail(tint: THREE.ColorRepresentation | null, dtFrames: number, interval = 3, alpha = 0.5) {
    if (!this.trail) {
      if (tint === null) return;
      this.trail = new Afterimage(this.model);
      this.parent?.add(this.trail.group);
    }
    this.trail.update(tint, dtFrames, interval, alpha);
  }

  clearTrail() {
    this.trail?.clear();
  }

  /** builds the ghost trail now and compiles its shaders on the next frame */
  prepareTrail() {
    if (!this.trail) {
      this.trail = new Afterimage(this.model);
      this.parent?.add(this.trail.group);
    }
    this.trail.prime();
  }

  hitFlash(color: THREE.ColorRepresentation = 0xffffff, amount = 0.75) {
    this.flash = amount;
    this.flashColor.set(color);
  }

  setGlow(v: number, color?: THREE.ColorRepresentation) {
    this.glow = v;
    if (color !== undefined) this.glowColor.set(color);
  }

  setGrey(v: number) {
    this.grey = v;
  }

  /** world position of the head (for cameras) */
  headWorld(out = this.headPos): THREE.Vector3 {
    this.model.bones.head.getWorldPosition(out);
    out.y += 0.1;
    return out;
  }

  /** side view (fight scenes): +1 faces +X, -1 faces -X */
  setFacing(facing: 1 | -1, sx = 1, sy = 1, sz = 1) {
    this.model.body.rotation.y = (facing * Math.PI) / 2;
    const s = this.def.height ?? 1;
    this.model.body.scale.set(facing * s * sx, s * sy, s * sz);
  }

  /** any direction (map): yaw in radians, 0 = facing +Z */
  setYaw(yaw: number, scale = 1) {
    this.model.body.rotation.y = yaw;
    const s = (this.def.height ?? 1) * scale;
    this.model.body.scale.set(s, s, s);
  }

  /** Play a clip directly (`key` changes = cross-fade from the current pose). */
  pose(clip: string, frame: number, dtFrames: number, key = clip, blend = 6) {
    this.animator.update(key, clip, frame, dtFrames, blend);
    this.updateMaterials(dtFrames);
  }

  private updateMaterials(dtFrames: number) {
    this.flash = Math.max(0, this.flash - dtFrames * 0.12);
    for (const m of this.model.materials) {
      const u = m.uniforms;
      if (this.flash > 0) {
        u.uFlash.value = this.flash;
        u.uFlashColor.value.copy(this.flashColor);
      } else if (this.glow > 0) {
        u.uFlash.value = this.glow;
        u.uFlashColor.value.copy(this.glowColor);
      } else if (this.grey > 0) {
        u.uFlash.value = this.grey;
        u.uFlashColor.value.setRGB(0.22, 0.22, 0.26);
      } else {
        u.uFlash.value = 0;
      }
    }
  }

  dispose() {
    this.trail?.dispose();
    this.trail = null;
    this.model.root.removeFromParent();
    this.shadow.removeFromParent();
    this.model.dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
  }
}
