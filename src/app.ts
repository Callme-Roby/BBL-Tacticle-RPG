import { audio } from './audio/audio';
import { input } from './input/input';
import { RetroPipeline } from './render/pipeline';
import { settings } from './game/settings';
import { clearUi } from './ui/dom';

export interface Screen {
  /** called once when the screen becomes active */
  enter?(): void;
  /** called every animation frame */
  frame(dt: number): void;
  exit?(): void;
  /** the window changed size */
  resized?(): void;
}

/**
 * Owns the renderer, the active screen and the main loop (from BBL FIGHTERZ:
 * low-res PS1 pipeline, automatic quality, frame-rate counter). BBL TACTICS
 * is played by touch: the 3D view always fills the window, the UI floats on it.
 */
export class App {
  readonly pipeline: RetroPipeline;
  readonly canvas: HTMLCanvasElement;
  private screen: Screen | null = null;
  private last = performance.now();
  private root: HTMLElement;
  private pixelW = 0;
  private pixelH = 0;
  /** automatic quality: highest resolution allowed on this device (lowered when it struggles) */
  private autoCap = 9999;
  private perfFrames: number[] = [];
  private perfLast = 0;
  private fpsEl: HTMLElement | null = null;
  /** size of the 3D view (CSS px) */
  width = 1;
  height = 1;

  constructor() {
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.root = document.getElementById('app') ?? document.body;
    this.pipeline = new RetroPipeline(this.canvas);
    this.applySettings();
    const relayout = () => this.resize();
    window.addEventListener('resize', relayout);
    window.addEventListener('orientationchange', () => {
      relayout();
      // some browsers report the new size a little after the event
      setTimeout(relayout, 250);
    });
    window.visualViewport?.addEventListener('resize', relayout);
    this.resize();
    // audio needs a user gesture
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    requestAnimationFrame((t) => this.loop(t));
  }

  /** aspect ratio of the 3D view */
  get aspect() {
    return this.width / Math.max(1, this.height);
  }

  get portrait() {
    return this.height > this.width;
  }

  applySettings() {
    this.pipeline.lines = settings.autoQuality === false ? settings.lines : Math.min(settings.lines, this.autoCap);
    this.updateFpsCounter();
    this.pipeline.dither = settings.dither;
    this.resize(true);
  }

  resize(force = false) {
    const W = Math.max(1, this.root.clientWidth || window.innerWidth);
    const H = Math.max(1, this.root.clientHeight || window.innerHeight);
    this.width = W;
    this.height = H;
    this.root.classList.toggle('portrait', H > W);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(W * dpr);
    const ph = Math.round(H * dpr);
    if (!force && pw === this.pixelW && ph === this.pixelH) return;
    this.pixelW = pw;
    this.pixelH = ph;
    this.pipeline.setSize(pw, ph);
    this.screen?.resized?.();
  }

  go(screen: Screen) {
    this.screen?.exit?.();
    clearUi();
    input.clearMenu();
    this.screen = screen;
    screen.enter?.();
    this.resize();
  }

  get current(): Screen | null {
    return this.screen;
  }

  private updateFpsCounter() {
    if (settings.showFps && !this.fpsEl) {
      this.fpsEl = document.createElement('div');
      this.fpsEl.className = 'fps';
      document.body.append(this.fpsEl);
    } else if (!settings.showFps && this.fpsEl) {
      this.fpsEl.remove();
      this.fpsEl = null;
    }
  }

  /**
   * Frame-rate watch: shows the counter and, if the device stays well under 60 images / s
   * for a few seconds, lowers the internal resolution one step (480 → 360 → 270; this
   * session only, the saved setting is kept).
   */
  private watchPerf(t: number, rawDt: number) {
    if (rawDt > 250 || document.visibilityState !== 'visible') {
      this.perfFrames.length = 0;
      return;
    }
    this.perfFrames.push(rawDt);
    if (t - this.perfLast < 3000) return;
    this.perfLast = t;
    const n = this.perfFrames.length;
    const fps = n ? (1000 * n) / this.perfFrames.reduce((a, b) => a + b, 0) : 60;
    this.perfFrames.length = 0;
    const lines = this.pipeline.lines;
    if (settings.autoQuality !== false && n > 30 && fps < 45 && lines > 270) {
      this.autoCap = lines > 360 ? 360 : 270;
      console.info(`[qualité auto] ${fps.toFixed(0)} images/s : résolution ${this.autoCap}p`);
      this.applySettings();
    }
    if (this.fpsEl) this.fpsEl.textContent = `${fps.toFixed(0)} IPS · ${this.pipeline.lines}p`;
  }

  private loop(t: number) {
    const rawDt = t - this.last;
    const dt = Math.min(0.1, rawDt / 1000);
    this.last = t;
    this.watchPerf(t, rawDt);
    input.poll();
    try {
      this.screen?.frame(dt);
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame((tt) => this.loop(tt));
  }
}
