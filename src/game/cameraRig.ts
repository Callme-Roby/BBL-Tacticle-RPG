import * as THREE from 'three';

/**
 * Tilted top-down camera of the map (PS1 tactics style): a target point on
 * the board, a distance (zoom), a fixed pitch and a yaw (0 = team 0 at the
 * bottom of the screen, π = team 1). `bottomInset` keeps the target centred
 * in the part of the screen not covered by the bottom panel.
 */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  readonly target = new THREE.Vector3();
  /** where the target glides to (auto focus) */
  private goal: THREE.Vector3 | null = null;
  dist = 12;
  minDist = 6;
  maxDist = 26;
  pitch = 0.86;
  yaw = 0;
  private yawGoal = 0;
  /** CSS px covered at the bottom (portrait panel) / on the right (landscape panel) */
  bottomInset = 0;
  rightInset = 0;
  private w = 1;
  private h = 1;
  private shake = 0;

  constructor(
    private boardW: number,
    private boardH: number,
  ) {
    this.target.set(boardW / 2, 0, boardH / 2);
  }

  setYaw(yaw: number, instant = false) {
    this.yawGoal = yaw;
    if (instant) this.yaw = yaw;
  }

  setViewport(w: number, h: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
  }

  /** glide to a world point */
  focus(p: THREE.Vector3, instant = false) {
    if (instant) {
      this.target.set(p.x, 0, p.z);
      this.goal = null;
    } else this.goal = new THREE.Vector3(p.x, 0, p.z);
  }

  /** fits the whole board (game start) */
  fitBoard() {
    const visH = Math.max(1, this.h - this.bottomInset);
    const visW = Math.max(1, this.w - this.rightInset);
    const aspect = visW / visH;
    const fov = (this.camera.fov * Math.PI) / 180;
    const needH = this.boardH * Math.sin(this.pitch) + 1.5;
    const needW = this.boardW + 1;
    const d = Math.max(needH / (2 * Math.tan(fov / 2)), needW / (2 * Math.tan(fov / 2) * aspect));
    this.dist = Math.min(this.maxDist, Math.max(this.minDist, d * 0.95));
    this.target.set(this.boardW / 2, 0, this.boardH / 2);
  }

  /** pan by a screen delta (CSS px) */
  pan(dx: number, dy: number) {
    this.goal = null;
    const k = (this.dist * 2 * Math.tan((this.camera.fov * Math.PI) / 360)) / Math.max(1, this.h);
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    // screen right = world (c, -s) on x/z, screen down = toward the camera (s, c) / sin(pitch)
    const fx = -dx * k;
    const fy = (-dy * k) / Math.max(0.5, Math.sin(this.pitch));
    this.target.x += fx * c + fy * s;
    this.target.z += -fx * s + fy * c;
    this.clamp();
  }

  zoom(factor: number) {
    this.dist = Math.min(this.maxDist, Math.max(this.minDist, this.dist * factor));
  }

  kick(amount: number) {
    this.shake = Math.max(this.shake, amount);
  }

  private clamp() {
    this.target.x = Math.min(this.boardW + 0.5, Math.max(-0.5, this.target.x));
    this.target.z = Math.min(this.boardH + 0.5, Math.max(-0.5, this.target.z));
  }

  update(dt: number) {
    if (this.goal) {
      const k = Math.min(1, dt * 7);
      this.target.lerp(this.goal, k);
      if (this.target.distanceTo(this.goal) < 0.01) this.goal = null;
    }
    let dy = this.yawGoal - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, dt * 5);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const cam = this.camera;
    cam.position.set(this.target.x + Math.sin(this.yaw) * cp * this.dist, this.target.y + sp * this.dist, this.target.z + Math.cos(this.yaw) * cp * this.dist);
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 2);
    }
    cam.lookAt(this.target);
    cam.aspect = this.w / this.h;
    // keep the target in the middle of the free part of the screen
    if (this.bottomInset > 0 || this.rightInset > 0) cam.setViewOffset(this.w + this.rightInset, this.h + this.bottomInset, this.rightInset, this.bottomInset, this.w, this.h);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }
}

/**
 * Touch / mouse gestures on the map canvas: one finger drags the camera
 * (a short touch without moving = a tap on a tile), two fingers pinch to
 * zoom; the mouse wheel zooms, right / middle drag pans.
 */
export class MapGestures {
  private pts = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
  private dragging = false;
  private pinchD = 0;
  private longTimer = 0;
  private longFired = false;
  private off: (() => void)[] = [];

  constructor(
    private el: HTMLElement,
    private rig: CameraRig,
    private onTap: (x: number, y: number) => void,
    private onLongPress?: (x: number, y: number) => void,
    private onHover?: (x: number, y: number) => void,
  ) {
    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn as EventListener, opts);
      this.off.push(() => el.removeEventListener(type, fn as EventListener));
    };
    on('pointerdown', (e) => this.down(e));
    on('pointermove', (e) => this.move(e));
    on('pointerup', (e) => this.up(e));
    on('pointercancel', (e) => this.cancel(e));
    on('wheel', (e) => {
      e.preventDefault();
      this.rig.zoom(e.deltaY > 0 ? 1.1 : 1 / 1.1);
    }, { passive: false });
    on('contextmenu', (e) => e.preventDefault());
  }

  dispose() {
    for (const f of this.off) f();
    clearTimeout(this.longTimer);
  }

  private down(e: PointerEvent) {
    this.el.setPointerCapture?.(e.pointerId);
    this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    if (this.pts.size === 2) {
      const [a, b] = [...this.pts.values()];
      this.pinchD = Math.hypot(a.x - b.x, a.y - b.y);
      this.dragging = true;
      clearTimeout(this.longTimer);
    } else if (this.pts.size === 1) {
      this.dragging = e.button === 1 || e.button === 2;
      this.longFired = false;
      clearTimeout(this.longTimer);
      if (this.onLongPress && e.pointerType === 'touch') {
        this.longTimer = window.setTimeout(() => {
          if (!this.dragging && this.pts.size === 1) {
            this.longFired = true;
            this.onLongPress?.(e.clientX, e.clientY);
          }
        }, 520);
      }
    }
  }

  private move(e: PointerEvent) {
    const p = this.pts.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') this.onHover?.(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pts.size >= 2) {
      const [a, b] = [...this.pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchD > 0 && d > 0) this.rig.zoom(this.pinchD / d);
      this.pinchD = d;
      // the pinch centre pans too
      this.rig.pan(dx / 2, dy / 2);
      return;
    }
    if (!this.dragging && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 9) {
      this.dragging = true;
      clearTimeout(this.longTimer);
    }
    if (this.dragging) this.rig.pan(dx, dy);
    else if (e.pointerType === 'mouse') this.onHover?.(e.clientX, e.clientY);
  }

  private up(e: PointerEvent) {
    const p = this.pts.get(e.pointerId);
    this.pts.delete(e.pointerId);
    clearTimeout(this.longTimer);
    if (!p) return;
    if (this.pts.size === 0) {
      if (!this.dragging && !this.longFired && e.button !== 2) this.onTap(e.clientX, e.clientY);
      this.dragging = false;
    }
  }

  private cancel(e: PointerEvent) {
    this.pts.delete(e.pointerId);
    clearTimeout(this.longTimer);
    if (this.pts.size === 0) this.dragging = false;
  }
}
