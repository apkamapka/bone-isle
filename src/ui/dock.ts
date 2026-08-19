/**
 * The docked sidebar.
 *
 * Free-floating windows are fine until you have three open: on a real session
 * the equipment window covers the backpack, the backpack covers the build
 * list, and all of them cover the map you are trying to fight on. Tibia never
 * had that problem because containers do not float there — they stack in a
 * column down the right edge, and the map is simply narrower.
 *
 * This file owns only the GEOMETRY of that column. Who draws into it lives in
 * main.ts (the vitals, gold row and minimap) and panels.ts (the windows).
 *
 * `HudCtx.sidebarW` already existed and `drawHud` already respected it — the
 * hook was written and never filled in. This fills it in.
 */

/**
 * A container window's natural width: 4 columns of 32, three 4-unit gaps, and
 * 24 units of margin.
 */
const CONTAINER_W = 4 * 32 + 3 * 4 + 24;

/**
 * Design units across the column's contents.
 *
 * NOT the container's natural width, which was the first guess and was wrong.
 * The HUD is authored against a 480-unit-wide screen, so a full-size bag is
 * already a third of the display; a column that wide is not a sidebar, it is
 * a second screen. 100 units plus padding is 23% of the design width — about
 * what Tibia spends — and docked windows are drawn smaller to suit, which is
 * the trade a column is FOR: several containers at once beats one big one.
 *
 * The number is a measurement, not a taste. At 164 (a container's own width)
 * a single window filled the whole column on a 1600x900 laptop; at 112 it
 * still did, missing by five pixels. 100 is the first width at which two full
 * containers stack on that machine and three on a 1080p desktop.
 */
export const DOCK_INNER = 100;
/** Breathing room either side of the contents. */
export const DOCK_PAD = 6;
/** Total column width in design units. */
export const DOCK_W = DOCK_INNER + 2 * DOCK_PAD;

/** Scale factor applied to a window while it is docked. */
export const DOCK_FIT = DOCK_INNER / CONTAINER_W;

/** Vitals are authored 190 wide; shrink them to share the column's ruler. */
export const VITALS_FIT = DOCK_INNER / 190;

/** Height of the compact gold + task-points row, in design units. */
export const GOLD_ROW_H = 14;
/** Vitals are 68 units tall before the column's rescale. */
const VITALS_H_UNITS = 68;

/**
 * Narrower than this (CSS px) and the column would cost more map than it
 * saves, so there is no sidebar at all and every window floats exactly as it
 * did before. Phones therefore keep today's behaviour untouched.
 */
export const DOCK_MIN_SCREEN = 900;

/** Is the sidebar showing at this window size? */
export function dockEnabled(cssW: number): boolean {
  return cssW >= DOCK_MIN_SCREEN;
}

export interface DockLayout {
  /** Column width in device px (0 when there is no sidebar). */
  w: number;
  /** Left edge of the column in device px. */
  x: number;
  /** Left edge of the column's CONTENTS. */
  innerX: number;
  /** Content width in device px. */
  innerW: number;
  /** Top of the area container windows stack into. */
  stackTop: number;
  /** First y a stacked window may NOT occupy. */
  stackBottom: number;
  /** Top of the pinned gold + task-points row. */
  goldY: number;
  /** Top of the pinned vitals block. */
  vitalsY: number;
  /** Height of the gold row in device px. */
  goldH: number;
}

/**
 * Measure the column. `S` is the HUD design unit; the fixed furniture is laid
 * out here so the drawing code and the window stacker agree on the free space.
 *
 * Containers take the TOP and the furniture is pinned to the BOTTOM. Putting
 * the furniture first cost 146 of 320 design units before a single window was
 * placed, which left room for one container — and one container in a column
 * is worse than no column. The minimap stays floating over the map for the
 * same reason: square, at the column's width, it is a third of the screen.
 */
export function dockLayout(
  screenW: number, screenH: number, S: number, enabled: boolean,
): DockLayout {
  if (!enabled) {
    return { ...NO_DOCK, x: screenW, innerX: screenW };
  }
  const w = Math.round(DOCK_W * S);
  const x = screenW - w;
  const innerX = x + Math.round(DOCK_PAD * S);
  const innerW = Math.round(DOCK_INNER * S);
  const pad = Math.round(DOCK_PAD * S);
  const goldH = Math.round(GOLD_ROW_H * S);
  const vitalsH = Math.round(VITALS_H_UNITS * VITALS_FIT * S);
  const furniture = goldH + pad + vitalsH + pad;
  return {
    w, x, innerX, innerW,
    stackTop: pad,
    stackBottom: screenH - pad - furniture,
    goldY: screenH - pad - furniture + pad,
    vitalsY: screenH - pad - vitalsH,
    goldH,
  };
}

/** No sidebar. The safe default for any caller that has not measured one. */
export const NO_DOCK: DockLayout =
  { w: 0, x: 0, innerX: 0, innerW: 0, stackTop: 0, stackBottom: 0, goldY: 0, vitalsY: 0, goldH: 0 };

/** Is this point inside the column? Used to decide a drag's destination. */
export function overDock(d: DockLayout, sx: number, sy: number): boolean {
  return d.w > 0 && sx >= d.x && sy >= 0 && sy < d.stackBottom;
}
