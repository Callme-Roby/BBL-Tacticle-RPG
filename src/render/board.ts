import * as THREE from 'three';
import type { MapTheme } from '../rules/maps';
import type { Terrain } from '../rules/types';
import { createPS1Material, type PS1Material } from './ps1Material';
import { blob, C, crack, Kit, noiseRect, shade, T, type Batch, type UVRect } from './stages/kit';

/**
 * The battle map in 3D: one tile = 1 × 1 m, tile (x, y) centred on world
 * (x + 0.5, h, y + 0.5). Ground and decor are merged per material by the stage
 * kit (a handful of draw calls); highlights (move / attack / staff / path) live
 * in a small mesh rebuilt when they change.
 */

export type HighlightKind = 'move' | 'attack' | 'staff' | 'path' | 'cursor' | 'select' | 'danger' | 'target' | 'exit';

export interface Highlight {
  x: number;
  y: number;
  kind: HighlightKind;
}

interface Palette {
  plain: number;
  plain2: number;
  road: number;
  dirt: number;
  sand: number;
  water: number;
  wall: number;
  wallTop: number;
  roof: number;
  leaf: number;
  floor: number;
  sky: number;
  fog: number;
  light: number;
  ambient: number;
}

const PALETTES: Record<MapTheme, Palette> = {
  parc: { plain: 0x5c9a3c, plain2: 0x4e8a34, road: 0xb59a6a, dirt: 0x7a5a3a, sand: 0xd8c48a, water: 0x2f78c0, wall: 0x8a8478, wallTop: 0xa49c8e, roof: 0xb84a32, leaf: 0x2f7a2c, floor: 0xa0a0a8, sky: 0x8cc4f0, fog: 0x9cc8ec, light: 0xfff2dc, ambient: 0x6a7088 },
  ville: { plain: 0x7a7c80, plain2: 0x6a6c72, road: 0x3a3c42, dirt: 0x5a5048, sand: 0xc8b88a, water: 0x2a5a8a, wall: 0x9a7a6a, wallTop: 0x5a5a62, roof: 0x8a3a2a, leaf: 0x3a7a32, floor: 0x9a9aa2, sky: 0xe0a070, fog: 0xd89a70, light: 0xffd0a0, ambient: 0x6a6070 },
  colline: { plain: 0x8a9a48, plain2: 0x7a8a3e, road: 0xb09a6a, dirt: 0x806040, sand: 0xc8b480, water: 0x3a7ab0, wall: 0x8a7a66, wallTop: 0x9a8a76, roof: 0xa04a2a, leaf: 0x4a6a24, floor: 0xa09a90, sky: 0xa0c8e8, fog: 0xb0c8dc, light: 0xfff0d0, ambient: 0x707060 },
  plage: { plain: 0x9ab85a, plain2: 0x8aa84e, road: 0xd8c890, dirt: 0x9a7a52, sand: 0xe8d8a0, water: 0x28a8c8, wall: 0xc8b8a0, wallTop: 0xd8c8b0, roof: 0x2a8ac8, leaf: 0x3a8a3a, floor: 0xc8c0b0, sky: 0x88d8f8, fog: 0xa8e0f4, light: 0xfff8e8, ambient: 0x7888a0 },
  neige: { plain: 0xe8eef4, plain2: 0xd8e2ec, road: 0xa8a8b0, dirt: 0x6a6a74, sand: 0xc8c8d0, water: 0x4a7aa8, wall: 0x7a7a86, wallTop: 0xe8eef4, roof: 0x7a2a2a, leaf: 0x2a5a3a, floor: 0xb0b4bc, sky: 0xb8c8dc, fog: 0xc8d4e4, light: 0xf0f4ff, ambient: 0x8088a0 },
  chateau: { plain: 0x5a8a3a, plain2: 0x4e7a32, road: 0xa8946a, dirt: 0x6a5038, sand: 0xc8b480, water: 0x2a5a8a, wall: 0x6a6670, wallTop: 0x7e7a84, roof: 0x5a2a6a, leaf: 0x2a6a2a, floor: 0x8a8690, sky: 0x2a2a4a, fog: 0x30304e, light: 0xffe0b0, ambient: 0x585878 },
};

/** surface height of a terrain (where units stand) */
export function terrainHeight(t: Terrain): number {
  switch (t) {
    case 'hill':
      return 0.28;
    case 'mountain':
      return 0.62;
    case 'wall':
      return 1.1;
    case 'river':
    case 'sea':
      return -0.14;
    case 'fort':
    case 'throne':
    case 'floor':
    case 'pillar':
      return 0.06;
    default:
      return 0;
  }
}

/** atlas cells (4 × 4, 32 px) */
const CELL = {
  grass: 0,
  grass2: 1,
  road: 2,
  sand: 3,
  water: 4,
  dirt: 5,
  rock: 6,
  brick: 7,
  floor: 8,
  plank: 9,
  roof: 10,
  carpet: 11,
  snowrock: 12,
  window: 13,
  leaf: 14,
  wallTop: 15,
} as const;

function cellUV(c: number, inset = 0.02): UVRect {
  const cx = c % 4;
  const cy = Math.floor(c / 4);
  // canvas y goes down, uv v goes up
  const u0 = cx / 4 + inset / 4;
  const u1 = (cx + 1) / 4 - inset / 4;
  const v1 = 1 - cy / 4 - inset / 4;
  const v0 = 1 - (cy + 1) / 4 + inset / 4;
  return [u0, v0, u1, v1];
}

const HL_COLORS: Record<HighlightKind, [number, number]> = {
  move: [0x3a7cff, 0.5],
  attack: [0xff3a30, 0.5],
  staff: [0x3adc6a, 0.5],
  danger: [0xff6a20, 0.28],
  path: [0xffe040, 0.85],
  cursor: [0xffffff, 0.9],
  select: [0x40f0ff, 0.9],
  target: [0xff2020, 0.95],
  exit: [0xc060ff, 0.45],
};

export class BoardView {
  readonly group = new THREE.Group();
  readonly kit: Kit;
  readonly palette: Palette;
  readonly heights: Float32Array;
  private pick: THREE.Mesh;
  private hlMeshes = new Map<HighlightKind, THREE.Mesh>();
  private hlMats = new Map<HighlightKind, PS1Material>();
  private hlKey = '';
  private fogMesh: THREE.Mesh | null = null;
  private fogKey = '';
  private water: THREE.Mesh[] = [];
  private time = 0;

  constructor(
    readonly w: number,
    readonly h: number,
    readonly tiles: readonly Terrain[],
    readonly theme: MapTheme,
  ) {
    this.kit = new Kit(w * 131 + h * 7 + tiles.length, 'board');
    this.palette = PALETTES[theme];
    this.heights = new Float32Array(w * h);
    for (let i = 0; i < tiles.length; i++) this.heights[i] = terrainHeight(tiles[i]);
    this.group.add(this.kit.group);
    this.build();
    this.pick = this.buildPick();
    for (const k of Object.keys(HL_COLORS) as HighlightKind[]) {
      const [col, op] = HL_COLORS[k];
      const m = createPS1Material({ color: col, unlit: 1, transparent: true, opacity: op, depthWrite: false, fog: false, snap: false });
      this.hlMats.set(k, m);
    }
  }

  get sky(): THREE.Color {
    return C(this.palette.sky);
  }

  get fogColor(): THREE.Color {
    return C(this.palette.fog);
  }

  get lightColor(): THREE.Color {
    return C(this.palette.light);
  }

  get ambient(): THREE.Color {
    return C(this.palette.ambient);
  }

  heightAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.heights[y * this.w + x];
  }

  /** world position of a tile centre (on its surface) */
  worldOf(x: number, y: number, out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(x + 0.5, this.heightAt(x, y), y + 0.5);
  }

  /** tile under a ray (screen picking) */
  pickTile(ray: THREE.Raycaster): { x: number; y: number } | null {
    const hit = ray.intersectObject(this.pick, false)[0];
    if (!hit || hit.faceIndex === undefined || hit.faceIndex === null) return null;
    const i = Math.floor(hit.faceIndex / 2);
    return { x: i % this.w, y: Math.floor(i / this.w) };
  }

  // ------------------------------------------------------------------ build

  private atlas(): THREE.CanvasTexture {
    const P = this.palette;
    const k = this.kit;
    return k.tex(128, 128, (ctx) => {
      const r = k.rand;
      const at = (c: number) => [(c % 4) * 32, Math.floor(c / 4) * 32] as const;
      const fill = (c: number, hex: number, amp: number) => {
        const [x, y] = at(c);
        noiseRect(ctx, x, y, 32, 32, r, hex, amp);
        return [x, y] as const;
      };
      const border = (c: number, hex: number, k2 = 0.82) => {
        const [x, y] = at(c);
        ctx.fillStyle = shade(hex, k2);
        ctx.fillRect(x, y, 32, 1);
        ctx.fillRect(x, y, 1, 32);
        ctx.fillStyle = shade(hex, 1.08);
        ctx.fillRect(x, y + 31, 32, 1);
        ctx.fillRect(x + 31, y, 1, 32);
      };
      const sub = (c: number, draw: (c2: CanvasRenderingContext2D) => void) => {
        const [x, y] = at(c);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, 32, 32);
        ctx.clip();
        ctx.translate(x, y);
        draw(ctx);
        ctx.restore();
      };
      // grass (two shades), with tufts
      for (const [c, col] of [
        [CELL.grass, P.plain],
        [CELL.grass2, P.plain2],
      ] as const) {
        fill(c, col, 22);
        sub(c, (g) => {
          for (let i = 0; i < 26; i++) blob(g, 32, 32, r, Math.floor(r() * 32), Math.floor(r() * 32), 1, shade(col, r() < 0.5 ? 0.82 : 1.15), 0.8);
        });
        border(c, col);
      }
      fill(CELL.road, P.road, 18);
      sub(CELL.road, (g) => {
        if (this.theme === 'ville') {
          g.fillStyle = '#d8c040';
          g.fillRect(14, 2, 4, 10);
          g.fillRect(14, 20, 4, 10);
        } else for (let i = 0; i < 14; i++) blob(g, 32, 32, r, Math.floor(r() * 32), Math.floor(r() * 32), 1, shade(P.road, 0.8), 0.6);
      });
      border(CELL.road, P.road, 0.9);
      fill(CELL.sand, P.sand, 20);
      sub(CELL.sand, (g) => {
        for (let i = 0; i < 6; i++) {
          g.fillStyle = shade(P.sand, 0.88);
          g.fillRect(Math.floor(r() * 28), Math.floor(r() * 30), 5, 1);
        }
      });
      border(CELL.sand, P.sand, 0.9);
      fill(CELL.water, P.water, 16);
      sub(CELL.water, (g) => {
        g.fillStyle = shade(P.water, 1.35);
        for (let i = 0; i < 7; i++) g.fillRect(Math.floor(r() * 26), Math.floor(r() * 30), 4 + Math.floor(r() * 4), 1);
      });
      fill(CELL.dirt, P.dirt, 24);
      fill(CELL.rock, 0x7a746c, 30);
      sub(CELL.rock, (g) => {
        for (let i = 0; i < 4; i++) crack(g, 32, 32, r, r() * 32, r() * 32, 14, shade(0x7a746c, 0.6));
      });
      fill(CELL.brick, P.wall, 14);
      sub(CELL.brick, (g) => {
        g.fillStyle = shade(P.wall, 0.65);
        for (let row = 0; row < 4; row++) {
          g.fillRect(0, row * 8 + 7, 32, 1);
          for (let col = 0; col < 3; col++) g.fillRect(((col * 12 + (row % 2) * 6) % 32) + 0, row * 8, 1, 8);
        }
      });
      fill(CELL.floor, P.floor, 14);
      sub(CELL.floor, (g) => {
        g.fillStyle = shade(P.floor, 0.72);
        g.fillRect(0, 15, 32, 1);
        g.fillRect(15, 0, 1, 32);
      });
      border(CELL.floor, P.floor, 0.7);
      fill(CELL.plank, 0x8a5a32, 16);
      sub(CELL.plank, (g) => {
        g.fillStyle = shade(0x8a5a32, 0.6);
        for (let i = 0; i < 4; i++) g.fillRect(i * 8 + 7, 0, 1, 32);
      });
      fill(CELL.roof, P.roof, 16);
      sub(CELL.roof, (g) => {
        g.fillStyle = shade(P.roof, 0.7);
        for (let i = 0; i < 6; i++) g.fillRect(0, i * 6 + 5, 32, 1);
      });
      fill(CELL.carpet, 0xa02030, 10);
      sub(CELL.carpet, (g) => {
        g.fillStyle = '#e0b030';
        g.fillRect(3, 0, 2, 32);
        g.fillRect(27, 0, 2, 32);
      });
      fill(CELL.snowrock, 0x8a8a96, 28);
      sub(CELL.snowrock, (g) => {
        for (let i = 0; i < 10; i++) blob(g, 32, 32, r, Math.floor(r() * 32), Math.floor(r() * 12), 2, '#eef2f8', 0.8);
      });
      fill(CELL.window, P.wall, 12);
      sub(CELL.window, (g) => {
        for (let wy = 0; wy < 2; wy++)
          for (let wx = 0; wx < 2; wx++) {
            g.fillStyle = r() < 0.6 ? '#ffe090' : '#30384a';
            g.fillRect(4 + wx * 16, 4 + wy * 16, 9, 10);
          }
      });
      fill(CELL.leaf, P.leaf, 30);
      fill(CELL.wallTop, P.wallTop, 16);
      border(CELL.wallTop, P.wallTop, 0.7);
    });
  }

  private build() {
    const k = this.kit;
    const tex = this.atlas();
    const ground = k.batch({ map: tex, vertexColors: true }, 'ground');
    const deco = k.batch({ vertexColors: true }, 'deco');
    const decoTex = k.batch({ map: tex, vertexColors: true }, 'decoTex');
    const waterB = k.batch({ map: tex, vertexColors: true, unlit: 0.35 }, 'water');
    const P = this.palette;
    const I = new THREE.Matrix4();
    const w = this.w;
    const theme = this.theme;
    const grassCell = (x: number, y: number) => ((x * 7 + y * 13) % 5 === 0 ? CELL.grass2 : CELL.grass);
    const top = (b: Batch, x: number, y: number, hgt: number, cell: number, color: THREE.ColorRepresentation = 0xffffff) => {
      b.quad(I, [
        [x, hgt, y + 1],
        [x + 1, hgt, y + 1],
        [x + 1, hgt, y],
        [x, hgt, y],
      ], cellUV(cell), color);
    };
    /** vertical sides of a raised / sunken tile down to `to` */
    const sides = (b: Batch, x: number, y: number, hgt: number, to: number, cell: number) => {
      if (Math.abs(hgt - to) < 0.001) return;
      const uv = cellUV(cell);
      const nb = (dx: number, dy: number) => this.heightAt(x + dx, y + dy);
      const faces: [number, number, [number, number, number, number]][] = [
        [0, 1, [x, y + 1, x + 1, y + 1]],
        [1, 0, [x + 1, y + 1, x + 1, y]],
        [0, -1, [x + 1, y, x, y]],
        [-1, 0, [x, y, x, y + 1]],
      ];
      for (const [dx, dy, [ax, az, bx, bz]] of faces) {
        const inMap = x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < this.h;
        const low = inMap ? Math.min(nb(dx, dy), hgt) : to;
        if (inMap && nb(dx, dy) >= hgt) continue;
        b.quad(I, [
          [ax, low, az],
          [bx, low, bz],
          [bx, hgt, bz],
          [ax, hgt, az],
        ], uv, 0xffffff, 0x9a9a9a);
      }
    };

    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < w; x++) {
        const t = this.tiles[y * w + x];
        const hgt = this.heights[y * w + x];
        const r = k.rand;
        switch (t) {
          case 'plain':
            top(ground, x, y, 0, theme === 'ville' ? CELL.floor : grassCell(x, y));
            break;
          case 'road':
            top(ground, x, y, 0, CELL.road);
            break;
          case 'sand':
            top(ground, x, y, 0, CELL.sand);
            break;
          case 'floor':
          case 'throne':
          case 'pillar':
            top(ground, x, y, hgt, t === 'throne' ? CELL.carpet : CELL.floor);
            sides(ground, x, y, hgt, 0, CELL.brick);
            if (t === 'throne') {
              // the throne itself, at the back of the tile
              deco.box(I, x + 0.5, hgt, y + 0.18, 0.62, 0.42, 0.42, { color: 0xc8a030, bottom: 0x806020 });
              deco.box(I, x + 0.5, hgt + 0.42, y + 0.08, 0.62, 0.7, 0.14, { color: 0xe8c040, bottom: 0xa07a20 });
              deco.box(I, x + 0.5, hgt + 0.42, y + 0.2, 0.46, 0.06, 0.26, { color: 0xb02030 });
            }
            if (t === 'pillar') deco.cyl(I, x + 0.2, hgt, y + 0.2, 0.13, 0.15, 1.7, 8, { color: 0xc8c4bc, bottom: 0x8a8680 });
            break;
          case 'forest': {
            top(ground, x, y, 0, theme === 'ville' ? CELL.grass : CELL.grass2);
            const n = 2 + Math.floor(r() * 2);
            const spots = [
              [0.22, 0.25],
              [0.76, 0.3],
              [0.3, 0.78],
              [0.78, 0.76],
            ];
            for (let i = 0; i < n; i++) {
              const [sx, sz] = spots[(i * 2 + x + y) % 4];
              const tx = x + sx + (r() - 0.5) * 0.1;
              const tz = y + sz + (r() - 0.5) * 0.1;
              const hh = 0.55 + r() * 0.35;
              deco.cyl(I, tx, 0, tz, 0.05, 0.07, 0.25, 5, { color: 0x6a4a2a, bottom: 0x4a3018 });
              if (theme === 'plage') {
                // palm tree
                deco.cyl(I, tx, 0.2, tz, 0.04, 0.05, hh, 5, { color: 0x9a7a4a });
                for (let j = 0; j < 4; j++) {
                  const a = (j / 4) * Math.PI * 2 + r();
                  deco.box(T(tx + Math.sin(a) * 0.18, 0.2 + hh, tz + Math.cos(a) * 0.18, a, 0.3), 0, 0, 0, 0.12, 0.03, 0.42, { color: P.leaf });
                }
              } else {
                const col = theme === 'neige' ? 0x3a6a4a : P.leaf;
                decoTex.cyl(I, tx, 0.18, tz, 0, 0.3, hh * 0.6, 6, { color: C(col).multiplyScalar(1.15), bottom: C(col).multiplyScalar(0.8), uvMul: [0.25, 0.25], uvAdd: [0.5, 0.0] });
                decoTex.cyl(I, tx, 0.18 + hh * 0.38, tz, 0, 0.22, hh * 0.5, 6, { color: theme === 'neige' ? 0xe8eef4 : C(col).multiplyScalar(1.3), bottom: C(col), uvMul: [0.25, 0.25], uvAdd: [0.5, 0.0] });
              }
            }
            break;
          }
          case 'hill':
            top(ground, x, y, hgt, theme === 'neige' ? CELL.grass : CELL.grass2, 0xe8e8d8);
            sides(ground, x, y, hgt, 0, CELL.dirt);
            deco.box(I, x + 0.3 + r() * 0.3, hgt, y + 0.3, 0.18, 0.1, 0.14, { color: 0x8a847a });
            break;
          case 'mountain': {
            top(ground, x, y, hgt, theme === 'neige' ? CELL.snowrock : CELL.rock);
            sides(ground, x, y, hgt, 0, CELL.rock);
            const peak = 0.5 + r() * 0.45;
            const g = new THREE.ConeGeometry(0.42, peak, 5);
            g.translate(x + 0.5 + (r() - 0.5) * 0.15, hgt + peak / 2, y + 0.45);
            decoTex.geo(I, g, { color: 0xffffff, bottom: 0xb0b0b0, uvMul: [0.25, 0.25], uvAdd: [theme === 'neige' ? 0.0 : 0.5, theme === 'neige' ? 0.0 : 0.25] });
            g.dispose();
            break;
          }
          case 'wall':
            top(ground, x, y, hgt, theme === 'ville' ? CELL.roof : CELL.wallTop);
            sides(ground, x, y, hgt, 0, theme === 'ville' ? CELL.window : CELL.brick);
            break;
          case 'fort':
            top(ground, x, y, hgt, CELL.floor);
            sides(ground, x, y, hgt, 0, CELL.brick);
            // low walls on three sides + a little tower with a flag
            decoTex.box(I, x + 0.5, hgt, y + 0.06, 1, 0.3, 0.12, { uv: cellUV(CELL.brick) });
            decoTex.box(I, x + 0.06, hgt, y + 0.5, 0.12, 0.3, 1, { uv: cellUV(CELL.brick) });
            decoTex.box(I, x + 0.94, hgt, y + 0.5, 0.12, 0.3, 1, { uv: cellUV(CELL.brick) });
            decoTex.box(I, x + 0.12, hgt, y + 0.12, 0.24, 0.65, 0.24, { uv: cellUV(CELL.brick) });
            deco.box(I, x + 0.12, hgt + 0.65, y + 0.12, 0.02, 0.35, 0.02, { color: 0x3a3a3a });
            deco.box(I, x + 0.22, hgt + 0.88, y + 0.12, 0.2, 0.12, 0.02, { color: 0xe0c020 });
            break;
          case 'village':
            top(ground, x, y, 0, CELL.road);
            decoTex.box(I, x + 0.5, 0, y + 0.22, 0.8, 0.42, 0.36, { uv: cellUV(theme === 'ville' ? CELL.window : CELL.brick) });
            {
              const roof = new THREE.CylinderGeometry(0.01, 0.52, 0.3, 4, 1);
              roof.rotateY(Math.PI / 4);
              roof.scale(1.1, 1, 0.55);
              roof.translate(x + 0.5, 0.57, y + 0.22);
              decoTex.geo(I, roof, { uvMul: [0.25, 0.25], uvAdd: [0.5, 0.25] });
              roof.dispose();
            }
            break;
          case 'river':
          case 'sea':
            top(waterB, x, y, hgt, CELL.water);
            sides(ground, x, y, 0, hgt, CELL.dirt);
            // banks: sunken sides are drawn by the neighbours (their `sides` go down to the water)
            break;
          case 'bridge':
            top(waterB, x, y, -0.14, CELL.water);
            top(ground, x, y, 0.02, CELL.plank);
            deco.box(I, x + 0.5, 0.02, y + 0.04, 1, 0.16, 0.05, { color: 0x6a4024 });
            deco.box(I, x + 0.5, 0.02, y + 0.96, 1, 0.16, 0.05, { color: 0x6a4024 });
            break;
        }
        // flat land next to water: drop a bank down to the water level
        if (hgt >= 0 && t !== 'bridge') {
          for (const [dx, dy] of [
            [0, 1],
            [1, 0],
            [0, -1],
            [-1, 0],
          ]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= this.h) continue;
            const nt = this.tiles[ny * w + nx];
            if (nt !== 'river' && nt !== 'sea') continue;
            // only plain-height tiles need it (raised tiles already have sides)
            if (hgt > 0.001) continue;
            const ax = dx === 1 ? x + 1 : dx === -1 ? x : dy === 1 ? x + 1 : x;
            const az = dy === 1 ? y + 1 : dy === -1 ? y : dx === 1 ? y : y + 1;
            const bx = dx === 1 ? x + 1 : dx === -1 ? x : dy === 1 ? x : x + 1;
            const bz = dy === 1 ? y + 1 : dy === -1 ? y : dx === 1 ? y + 1 : y;
            ground.quad(I, [
              [ax, -0.14, az],
              [bx, -0.14, bz],
              [bx, 0, bz],
              [ax, 0, az],
            ], cellUV(CELL.dirt), 0xffffff, 0x808080);
          }
        }
      }
    // a skirt around the board so it reads as a diorama
    const skirt = k.batch({ vertexColors: true }, 'skirt');
    const d = 0.6;
    skirt.box(I, w / 2, -d, -0.05, w + 0.1, d, 0.1, { color: 0x3a3028, bottom: 0x1a1410 });
    skirt.box(I, w / 2, -d, this.h + 0.05, w + 0.1, d, 0.1, { color: 0x3a3028, bottom: 0x1a1410 });
    skirt.box(I, -0.05, -d, this.h / 2, 0.1, d, this.h + 0.2, { color: 0x3a3028, bottom: 0x1a1410 });
    skirt.box(I, w + 0.05, -d, this.h / 2, 0.1, d, this.h + 0.2, { color: 0x3a3028, bottom: 0x1a1410 });
    // a wide ground plane far below (fog hides its edges)
    const under = k.batch({ vertexColors: true }, 'under');
    under.quad(I, [
      [-40, -d, 40 + this.h],
      [40 + w, -d, 40 + this.h],
      [40 + w, -d, -40],
      [-40, -d, -40],
    ], [0, 0, 1, 1], C(this.palette.plain2).multiplyScalar(0.55));
    k.finish();
    this.kit.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.name === 'water') this.water.push(o as THREE.Mesh);
    });
  }

  /** invisible flat quads (one per tile, in order) used to pick the tile under a finger */
  private buildPick(): THREE.Mesh {
    const pos: number[] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const hh = Math.max(0, this.heightAt(x, y));
        pos.push(x, hh, y, x, hh, y + 1, x + 1, hh, y + 1, x, hh, y, x + 1, hh, y + 1, x + 1, hh, y);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    m.updateMatrixWorld();
    return m;
  }

  // ------------------------------------------------------------------ highlights

  setHighlights(list: Highlight[]) {
    const key = list.map((l) => l.kind[0] + l.x + ',' + l.y).join(';');
    if (key === this.hlKey) return;
    this.hlKey = key;
    for (const m of this.hlMeshes.values()) {
      m.geometry.dispose();
      m.removeFromParent();
    }
    this.hlMeshes.clear();
    const byKind = new Map<HighlightKind, Highlight[]>();
    for (const l of list) {
      const arr = byKind.get(l.kind) ?? [];
      arr.push(l);
      byKind.set(l.kind, arr);
    }
    const order: HighlightKind[] = ['danger', 'exit', 'move', 'staff', 'attack', 'path', 'target', 'select', 'cursor'];
    order.forEach((kind, oi) => {
      const arr = byKind.get(kind);
      if (!arr?.length) return;
      const pos: number[] = [];
      const lift = 0.025 + oi * 0.004;
      for (const l of arr) {
        const y0 = Math.max(this.heightAt(l.x, l.y), kind === 'move' || kind === 'attack' ? -0.1 : -0.12) + lift;
        if (kind === 'cursor' || kind === 'select' || kind === 'target') {
          // frame
          const t = kind === 'cursor' ? 0.08 : 0.06;
          const quad = (x0: number, z0: number, x1: number, z1: number) => pos.push(x0, y0, z0, x0, y0, z1, x1, y0, z1, x0, y0, z0, x1, y0, z1, x1, y0, z0);
          const X = l.x;
          const Z = l.y;
          quad(X, Z, X + 1, Z + t);
          quad(X, Z + 1 - t, X + 1, Z + 1);
          quad(X, Z + t, X + t, Z + 1 - t);
          quad(X + 1 - t, Z + t, X + 1, Z + 1 - t);
        } else if (kind === 'path') {
          const s = 0.32;
          const x0 = l.x + 0.5 - s / 2;
          const z0 = l.y + 0.5 - s / 2;
          pos.push(x0, y0, z0, x0, y0, z0 + s, x0 + s, y0, z0 + s, x0, y0, z0, x0 + s, y0, z0 + s, x0 + s, y0, z0);
        } else {
          const i = 0.05;
          const x0 = l.x + i;
          const z0 = l.y + i;
          const x1 = l.x + 1 - i;
          const z1 = l.y + 1 - i;
          pos.push(x0, y0, z0, x0, y0, z1, x1, y0, z1, x0, y0, z0, x1, y0, z1, x1, y0, z0);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, j) => (j % 3 === 1 ? 1 : 0)), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
      const m = new THREE.Mesh(g, this.hlMats.get(kind)!);
      m.renderOrder = 5 + oi;
      this.group.add(m);
      this.hlMeshes.set(kind, m);
    });
  }

  /** darkens the tiles outside `visible` (fog of war); null = no fog */
  setFog(visible: Set<number> | null) {
    const key = visible ? [...visible].sort((a, b) => a - b).join(',') : '';
    if (key === this.fogKey) return;
    this.fogKey = key;
    if (this.fogMesh) {
      this.fogMesh.geometry.dispose();
      this.fogMesh.removeFromParent();
      this.fogMesh = null;
    }
    if (!visible) return;
    const pos: number[] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (visible.has(y * this.w + x)) continue;
        const y0 = Math.max(0, this.heightAt(x, y)) + 0.02;
        pos.push(x, y0, y, x, y0, y + 1, x + 1, y0, y + 1, x, y0, y, x + 1, y0, y + 1, x + 1, y0, y);
      }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
    const mat = createPS1Material({ color: 0x0a0a1a, unlit: 1, transparent: true, opacity: 0.55, depthWrite: false, fog: false, snap: false });
    this.fogMesh = new THREE.Mesh(g, mat);
    this.fogMesh.renderOrder = 4;
    this.group.add(this.fogMesh);
  }

  update(dt: number) {
    this.time += dt;
    // gentle water shimmer
    const k = 0.92 + Math.sin(this.time * 2) * 0.06;
    for (const m of this.water) (m.material as PS1Material).uniforms.uColor.value.setRGB(k, k, 1);
  }

  dispose() {
    for (const m of this.hlMeshes.values()) m.geometry.dispose();
    for (const m of this.hlMats.values()) m.dispose();
    if (this.fogMesh) {
      this.fogMesh.geometry.dispose();
      (this.fogMesh.material as THREE.Material).dispose();
    }
    this.pick.geometry.dispose();
    (this.pick.material as THREE.Material).dispose();
    this.kit.dispose();
    this.group.removeFromParent();
  }
}
