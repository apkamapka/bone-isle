/**
 * The docked sidebar, laid out the way Tibia's is.
 *
 * Two things were wrong with the first attempt, and the second is the
 * interesting one.
 *
 * ORDER. Tibia's main right sidebar carries a fixed block in a fixed order —
 * minimap, status bar, inventory (minimisable), combat controls — and open
 * containers stack BELOW it; no widget may sit above that block. The first
 * version had it upside down: containers on top, vitals pinned to the floor.
 *
 * SCALE. Tibia's sidebar does not scale with the display. It is a couple of
 * hundred real pixels wide on a laptop and on a 4K monitor alike, and the game
 * window takes whatever is left. The first version inherited the HUD's design
 * unit, which on a desktop is enormous — the HUD is authored against a 480x320
 * phone — so the column came out three times too fat and a single backpack
 * filled it. Shrinking the windows to compensate was treating the symptom.
 *
 * So the column has its OWN unit, fixed in CSS pixels, and windows inside it
 * are drawn at full size against that unit. Everything below is in design
 * units; `dockScale` converts.
 */
import { panelCollapsed, togglePanelCollapsed } from "../systems/panelPrefs.ts";

/**
 * CSS pixels per design unit inside the column.
 *
 * This one number sets the column's real-world size. At 1.25 a slot is 40 CSS
 * px and the whole column is 220 — about 11% of a 1920 display, which is the
 * proportion Tibia's own sidebar occupies.
 */
export const DOCK_UNIT_CSS = 1.25;

/** A container window's natural width: 4 columns of 32, 3 gaps of 4, 24 margin. */
export const DOCK_INNER = 4 * 32 + 3 * 4 + 24;
/** Breathing room either side of the contents. */
export const DOCK_PAD = 6;
/** Total column width in design units. */
export const DOCK_W = DOCK_INNER + 2 * DOCK_PAD;

/** Vitals are authored 190 wide; rescale them onto the column's ruler. */
export const VITALS_FIT = DOCK_INNER / 190;

/** Height of a collapsed block: its header bar and nothing else. */
export const BLOCK_BAR = 12;
/** Gap between blocks, and between the buttons inside them. */
const GAP = 4;

/** Fixed-block heights, expanded, in design units. */
export const MINIMAP_H = 120;
export const GOLD_ROW_H = 14;
export const STATUS_H = GOLD_ROW_H + GAP + Math.round(68 * VITALS_FIT);
/**
 * Panel-button row and weapon swap.
 *
 * The action slots were a third row here and have moved to a bar across the
 * foot of the map: six of them across a hundred-unit column came out sixteen
 * units each, which no font makes "Recall 3·12" fit into. Losing the row also
 * buys the column another container.
 */
/* Square, and derived rather than picked: five buttons across the column's
 * hundred units leaves about seventeen each, and a 17x34 button is a stretched
 * slot with a small picture floating in the middle of it. */
export const BTN_ROW_H = Math.floor((DOCK_INNER - 4 * GAP) / 5);
export const SWAP_H = 20;
export const CONTROLS_H = BTN_ROW_H + GAP + SWAP_H;

/**
 * Narrower than this (CSS px) and the column costs more map than it saves, so
 * there is no sidebar at all and every window floats as it did before. Phones
 * therefore keep today's behaviour untouched.
 */
export const DOCK_MIN_SCREEN = 900;

/** Is the sidebar showing at this window size? */
export function dockEnabled(cssW: number): boolean {
  return cssW >= DOCK_MIN_SCREEN;
}

/**
 * Device px per design unit inside the column.
 *
 * Capped by the HUD's own scale so that on a small window the column can never
 * be drawn LARGER than the interface around it.
 */
export function dockScale(hudScale: number, dpr: number): number {
  return Math.min(hudScale, DOCK_UNIT_CSS * Math.max(1, dpr));
}

/** The three fixed blocks, in Tibia's order. Containers stack under them. */
export type DockBlock = "minimap" | "status" | "controls";
export const DOCK_BLOCKS: readonly DockBlock[] = ["minimap", "status", "controls"];

/** Expanded height of a block, in design units. */
export function blockHeight(b: DockBlock): number {
  if (b === "minimap") return MINIMAP_H;
  if (b === "status") return STATUS_H;
  return CONTROLS_H;
}

/** Persisted per-block collapse, sharing the panel-preference store. */
export function blockCollapsed(b: DockBlock): boolean {
  return panelCollapsed(`dock:${b}`);
}
export function toggleBlock(b: DockBlock): void {
  togglePanelCollapsed(`dock:${b}`);
}

export interface BlockRect {
  /** Top of the block, header bar included. */
  y: number;
  /** Total height, bar included. */
  h: number;
  /** Top of the block's CONTENT, below the bar. */
  bodyY: number;
  /** Content height; zero when collapsed. */
  bodyH: number;
  collapsed: boolean;
}

export interface DockLayout {
  /** Column width in device px (0 when there is no sidebar). */
  w: number;
  /** Left edge of the column in device px. */
  x: number;
  /** Left edge of the column's contents. */
  innerX: number;
  /** Content width in device px. */
  innerW: number;
  /** Device px per design unit inside the column. */
  s: number;
  /** The fixed blocks, already positioned. */
  blocks: Record<DockBlock, BlockRect>;
  /** Top of the area container windows stack into. */
  stackTop: number;
  /** First y a stacked window may NOT occupy. */
  stackBottom: number;
}

const EMPTY_BLOCK: BlockRect = { y: 0, h: 0, bodyY: 0, bodyH: 0, collapsed: true };

/** No sidebar. The safe default for any caller that has not measured one. */
export const NO_DOCK: DockLayout = {
  w: 0, x: 0, innerX: 0, innerW: 0, s: 1,
  blocks: { minimap: EMPTY_BLOCK, status: EMPTY_BLOCK, controls: EMPTY_BLOCK },
  stackTop: 0, stackBottom: 0,
};

/**
 * Measure the column. `s` is the DOCK's unit (see `dockScale`), not the HUD's.
 *
 * Collapsing a fixed block is how room is recovered — Tibia lets you minimise
 * the inventory for exactly this reason. It is a better trade than shrinking
 * everything permanently: you pay for the space only when you want it.
 */
export function dockLayout(screenW: number, screenH: number, s: number, enabled: boolean): DockLayout {
  if (!enabled) return { ...NO_DOCK, x: screenW, innerX: screenW };

  const w = Math.round(DOCK_W * s);
  const x = screenW - w;
  const pad = Math.round(DOCK_PAD * s);
  const innerX = x + pad;
  const innerW = Math.round(DOCK_INNER * s);
  const bar = Math.round(BLOCK_BAR * s);
  const gap = Math.round(GAP * s);

  let y = pad;
  const blocks = {} as Record<DockBlock, BlockRect>;
  for (const b of DOCK_BLOCKS) {
    const collapsed = blockCollapsed(b);
    const bodyH = collapsed ? 0 : Math.round(blockHeight(b) * s);
    const h = bar + bodyH;
    blocks[b] = { y, h, bodyY: y + bar, bodyH, collapsed };
    y += h + gap;
  }

  return { w, x, innerX, innerW, s, blocks, stackTop: y, stackBottom: screenH - pad };
}

/** Is this point inside the column? Used to decide a drag's destination. */
export function overDock(d: DockLayout, sx: number, sy: number): boolean {
  return d.w > 0 && sx >= d.x && sy >= 0 && sy < d.stackBottom;
}

/** Which fixed block's header bar is at this point, if any. */
export function blockBarAt(d: DockLayout, sx: number, sy: number): DockBlock | null {
  if (d.w === 0 || sx < d.x) return null;
  const bar = Math.round(BLOCK_BAR * d.s);
  for (const b of DOCK_BLOCKS) {
    const r = d.blocks[b];
    if (sy >= r.y && sy < r.y + bar) return b;
  }
  return null;
}
