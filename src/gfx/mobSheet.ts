/**
 * Directional creature artwork.
 *
 * Most creatures are a single sprite that simply slides around. Humanoids read
 * badly that way — a bandit that moonwalks north is worse than no animation at
 * all — so they get the same treatment as the player: a four-direction walk
 * cycle cut from an LPC sheet.
 *
 * The sheet is 9 frames across by 4 rows down (up, left, down, right), and it
 * is cropped to ONE rectangle shared by every frame. That matters: crop each
 * frame to its own bounds and the arms' swing changes the width, so the body
 * jitters sideways as the cycle plays.
 *
 * Column 0 of a row is the standing pose; columns 1-8 are the stride. A
 * creature standing still shows column 0 and never ticks a clock.
 *
 * Loading is asynchronous. Until the sheet lands `frame()` returns null and the
 * caller falls back to the flat sprite, so nothing here can break a headless
 * run or a slow connection.
 */
import { adoptSprite } from "./sprites.ts";
import type { MonsterKind, NpcKey } from "../world/types.ts";

/** Facing, in the row order the LPC sheet uses. */
export type MobDir = "up" | "left" | "down" | "right";

const DIR_ROW: Record<MobDir, number> = { up: 0, left: 1, down: 2, right: 3 };
const COLS = 9;
const WALK_FPS = 8;

/**
 * Sheets to load, keyed by creature. Townsfolk live in the same registry under
 * an `npc:` prefix — a walking smith is the same problem as a walking bandit,
 * and one loader means one place where the LPC layout is spelled out.
 */
const SHEET_SRC: Record<string, string> = {
  bandit: "./mob-bandit-walk.png",
  "npc:smith": "./npc-smith.png",
  "npc:herbalist": "./npc-herbalist.png",
  "npc:elder": "./npc-elder.png",
  "npc:taskmaster": "./npc-taskmaster.png",
  "npc:tailor": "./npc-tailor.png",
};

type Cut = HTMLCanvasElement[][]; // [row][col]
const sheets: Record<string, Cut | undefined> = {};

/** Slice a loaded sheet into its 4 x 9 grid of frames. */
function slice(img: HTMLImageElement): Cut {
  const fw = Math.floor(img.naturalWidth / COLS);
  const fh = Math.floor(img.naturalHeight / 4);
  const rows: Cut = [];
  for (let r = 0; r < 4; r++) {
    const row: HTMLCanvasElement[] = [];
    for (let c = 0; c < COLS; c++) {
      const cv = document.createElement("canvas");
      cv.width = fw;
      cv.height = fh;
      const x = cv.getContext("2d")!;
      x.imageSmoothingEnabled = false;
      x.drawImage(img, c * fw, r * fh, fw, fh, 0, 0, fw, fh);
      row.push(adoptSprite(cv));
    }
    rows.push(row);
  }
  return rows;
}

/** Start loading every directional sheet. No-op headless, safe to repeat. */
export function loadMobSheets(): void {
  if (typeof Image === "undefined" || typeof document === "undefined") return;
  for (const id of Object.keys(SHEET_SRC)) {
    if (sheets[id]) continue;
    const img = new Image();
    img.onload = () => { sheets[id] = slice(img); };
    img.onerror = () => {
      console.warn(`walk sheet for '${id}' failed to load, it will slide instead`);
    };
    img.src = SHEET_SRC[id];
  }
}

/** True once this creature can be drawn directionally. */
export function hasWalkSheet(kind: MonsterKind): boolean {
  return sheets[kind] !== undefined;
}

/**
 * The frame to draw, or null when there is no sheet for this creature.
 * `moving` picks stride over stance; `phase` is any freely running seconds
 * value — pass a per-creature offset so a pack does not march in lockstep.
 */
export function mobFrame(
  kind: MonsterKind, dir: MobDir, moving: boolean, phase: number,
): HTMLCanvasElement | null {
  return frameOf(kind, dir, moving, phase);
}

/**
 * The same thing for a townsperson. Returns null for anyone without a sheet —
 * four of the five still use their baked stand-in and never move.
 */
export function npcFrame(
  key: NpcKey, dir: MobDir, moving: boolean, phase: number,
): HTMLCanvasElement | null {
  return frameOf("npc:" + key, dir, moving, phase);
}

function frameOf(
  id: string, dir: MobDir, moving: boolean, phase: number,
): HTMLCanvasElement | null {
  const cut = sheets[id];
  if (!cut) return null;
  const row = cut[DIR_ROW[dir]];
  if (!moving) return row[0];
  const step = 1 + (Math.floor(phase * WALK_FPS) % (COLS - 1));
  return row[step];
}

/** Facing implied by a grid step. Ties break to the vertical, matching the
 *  player: diagonals read as up/down with a sideways drift. */
export function dirOfStep(sx: number, sy: number): MobDir | null {
  if (sx === 0 && sy === 0) return null;
  if (Math.abs(sy) >= Math.abs(sx)) return sy < 0 ? "up" : "down";
  return sx < 0 ? "left" : "right";
}
