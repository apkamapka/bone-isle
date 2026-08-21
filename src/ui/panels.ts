/** All toggleable UI panels. Each draws itself and pushes clickable hotspots. */
import { SPR, iconW, iconH } from "../gfx/sprites.ts";
import { itemSprite } from "../gfx/itemArt.ts";
import { skills, skillNeed, attackPower, mastery, defenseArmor, shieldBlockMax } from "../systems/skills.ts";
import { stance, setStance, STANCES, STANCE_LABEL, STANCE_COLOR } from "../systems/stance.ts";
import { MIN_HIT_RATIO } from "../config.ts";
import { STRUCTS, STRUCT_KEYS, canAfford, costText, tierOf, maxTier, upgradeCost, buildCost, structSprite, countOwned } from "../systems/building.ts";
import { RESEARCH, isResearched, towerTierOk,
  ATTUNEMENT, isAttuned, offersFor } from "../systems/tower.ts";
import { ELEMENT_LABEL, ELEMENTS, type Element } from "../systems/elements.ts";
import { TASKS, EXCHANGES, activeTask, isTaskUnlocked, progressOf, isComplete, rewardFits, pointsEarned } from "../systems/tasks.ts";
import type { TaskReward } from "../systems/tasks.ts";
import { ITEMS, RECIPES, canCraftAcross, recipeCostText, bagCount, activeArrow, itemInfoLines, countAcross, isContainer, bagSlotsUsed, walletAcross } from "../items.ts";
import { carryCap, carriedWeight } from "../entities/player.ts";
import { quests } from "../systems/quests.ts";
import { SHOPS } from "../entities/npcs.ts";
import { OUTFIT_COLORS, HUE_STEPS, SAT_ROWS, zoneLabels, outfitState, type OutfitZone } from "../systems/outfit.ts";
import { heroPreviewFrame } from "../gfx/heroSheet.ts";
import { hudText, wrapText, hudLines, type HudCtx } from "./hud.ts";
import type { Player } from "../entities/player.ts";
import type { StructKey } from "../systems/building.ts";
import { bestTier } from "../systems/building.ts";
import { smeltYield, canSmelt, COAL_PER_SMELT, GEM_TROPHIES, GEM_TROPHY_KINDS, GEM_COAL } from "../systems/smelt.ts";
import type { EqSlot, ItemKind, ItemStack, Recipe, Bag } from "../items.ts";
import type { Corpse, GroundItem, Npc, Structure } from "../world/types.ts";
import type { ContainerRef } from "../systems/containers.ts";
import { slotsOf, stackAt, baseOf, rootOf } from "../systems/containers.ts";
import { homeChests } from "../game.ts";
import type { Game } from "../game.ts";
import { panelZoom, stepPanelZoom, panelCollapsed, togglePanelCollapsed, panelRows } from "../systems/panelPrefs.ts";
import { CHROME, panelFrame, popupFrame, raisedBox, sunkenBox, slotCell, buttonBox, keyline, bevelPx, frameInset } from "./chrome.ts";
import { NO_DOCK, type DockLayout } from "./dock.ts";
import type { Rect } from "./mobile.ts";
import { drawResizeArrows } from "./icons.ts";

/**
 * Window kinds that may take the phone's side strip.
 *
 * Packs you carry, and nothing else. A corpse is deliberately absent: world
 * loot is a thing you empty and walk away from, so it wants a wide, short,
 * throwaway sheet rather than the tall column you keep open all game.
 *
 * "bag" being in this set is the whole fix. The strip used to look for
 * `kind === "container"`, which is what a nested pack opens as — but the
 * backpack itself, opened from the tab, is `kind === "bag"`. So the first pack
 * never qualified and the strip went to the SECOND one, which is exactly
 * backwards from what it is for.
 */
export const STRIP_KINDS: ReadonlySet<string> = new Set(["bag", "container", "stash"]);

/**
 * Which open window holds the side strip: the earliest one OPENED, not the
 * earliest in the array.
 *
 * The array is z-order and gets reshuffled every time a window is raised, so
 * reading position 0 would hand the strip to whichever pack you last tapped.
 * `seq` is stamped once at creation and never moves.
 */
export function stripCandidate(windows: readonly PanelWindow[]): PanelWindow | undefined {
  let best: PanelWindow | undefined;
  for (const w of windows) {
    if (!STRIP_KINDS.has(w.kind) || w.stripOut) continue;
    if (!best || (w.seq ?? 0) < (best.seq ?? 0)) best = w;
  }
  return best;
}

export type PanelKind =
  | "build" | "skills" | "equip" | "bag" | "quest"
  | "forge" | "tower" | "loot" | "shop" | "stash" | "tasks" | "wardrobe"
  /** A container lying on the ground — the loot bag you left by the corpses. */
  | "floor"
  /**
   * A pack opened from inside another container. UNLIKE every other kind,
   * several of these may be open at once — each addressed by its own `ref`.
   *
   * They exist because a single window per kind made two packs in the same
   * backpack mutually exclusive: you could look in either, never both, so
   * moving something from one to the other was impossible without a detour
   * through the bag itself.
   */
  | "container";

/** Windows that show a container's slots. */
export const CONTAINER_PANELS: readonly PanelKind[] = ["bag", "stash", "loot", "floor", "container"];

/**
 * Windows that may sit in the sidebar.
 *
 * Equipment docks too: in Tibia the inventory paperdoll is one of the fixed
 * sidebar blocks, and it is narrower than a container window, so it simply
 * centres itself in the column.
 *
 * The Storage Chest is a container and still does NOT dock: it is ten columns
 * wide against the column's four, it carries a second grid and an upgrade
 * button, and it is furniture you walk up to rather than something you carry.
 * Tibia's depot is a big central window for exactly the same reasons.
 */
export const DOCKABLE_PANELS: readonly PanelKind[] = ["equip", "bag", "loot", "floor", "container"];

/** Gap between two stacked windows, in design units. */
const DOCK_GAP = 4;

/** Height of the grabbable strip along a container window's bottom edge. */
export const RESIZE_BAR = 6;

/**
 * How many rows of this container to actually show.
 *
 * A container window can be dragged shorter so it takes less of the column,
 * the way Tibia's can. The visible rows are always the FIRST ones, which is
 * what makes this safe to ship before scrolling exists: no slot index ever
 * moves, so item drag-and-drop, drop-on-empty and looting are untouched.
 */
export function visibleRows(kind: PanelKind, totalRows: number): number {
  const want = panelRows(kind);
  if (want <= 0) return totalRows;
  return Math.max(1, Math.min(totalRows, want));
}

/** Width of a container window's scrollbar, in design units. */
export const SCROLLBAR_W = 9;

/**
 * Rows for any container drawn on a phone sheet — a corpse, a pile on the
 * ground, or the second pack.
 *
 * A container shows sixteen slots whatever happens to be in it, so one coin
 * cost four rows of empty frame: on a phone that is nearly half the screen,
 * parked on top of the fight you are still in.
 *
 * So it is sized to the loot instead: one row for a light corpse, two for a
 * heavy one. The cut is at four because four IS one row, and the moment a fifth
 * item lands a second row has to exist anyway.
 *
 * Phone only, and only until the player says otherwise — the -/+ buttons still
 * win, and the desktop keeps the behaviour it had.
 */
export function lootRows(
  p: PanelInput, slots: readonly unknown[], allRows: number, cell: number, gap: number,
): number {
  if (p.strip) return stripRows(p, allRows, cell, gap, 50 * p.hud.scale);
  if (p.sheet && panelRows(p.win.kind) <= 0) {
    const used = slots.reduce<number>((n, x) => n + (x ? 1 : 0), 0);
    return Math.max(1, Math.min(allRows, used > 4 ? 2 : 1));
  }
  return visibleRows(p.win.kind, allRows);
}

/**
 * How many rows a container shows.
 *
 * In the strip it is however many the strip is tall enough to hold, because the
 * strip's height is fixed and any leftover would just be empty frame. Anywhere
 * else it is the player's saved preference, exactly as before.
 */
export function stripRows(
  p: PanelInput, allRows: number, cell: number, gap: number, chrome: number,
): number {
  if (!p.strip) return visibleRows(p.win.kind, allRows);
  const room = Math.floor((p.strip.h - chrome + gap) / (cell + gap));
  return Math.max(1, Math.min(allRows, room));
}

/**
 * The first visible row, clamped to what there is to show.
 *
 * Called every frame rather than trusted, because the container behind the
 * window can shrink under it — loot gets taken, a pack gets emptied — and a
 * stale offset would leave the window staring at rows that no longer exist.
 */
export function scrollRow(win: PanelWindow, totalRows: number, shownRows: number): number {
  const max = Math.max(0, totalRows - shownRows);
  const at = Math.min(Math.max(0, Math.floor(win.scroll ?? 0)), max);
  if (at !== win.scroll) win.scroll = at;
  win.scrollMax = max;
  return at;
}

/**
 * How many rows of a LIST panel fit on screen, and where the view starts.
 *
 * Long lists used to size the panel to their contents and rely on the auto-fit
 * to squeeze it in. That has a floor of 0.35, so a sixty-item shop still ran
 * off the top and bottom of the display — and everything that did fit was too
 * small to read. Capping the rows and scrolling is the only answer that keeps
 * the text the size it was designed at.
 */
export function listView(
  p: PanelInput, total: number, rowH: number, chrome: number,
): { first: number; count: number } {
  const room = p.hud.screenH * 0.88 - chrome;
  const count = Math.max(3, Math.min(total, Math.floor(room / rowH)));
  return { first: scrollRow(p.win, total, count), count };
}

/**
 * The scrollbar down the right of a shortened container.
 *
 * Two arrow buttons and a thumb. The thumb is not draggable: on a four-row bag
 * showing two there are exactly two positions, so a drag would be a fussier
 * way to do what one click already does. Clicking the track above or below the
 * thumb pages by a screenful, which is the part people reach for.
 */
function scrollBar(
  p: PanelInput, x: number, y: number, h: number,
  totalRows: number, shownRows: number, at: number,
): void {
  const { ctx, scale: S } = p.hud;
  const w = SCROLLBAR_W * S;
  const btn = w;
  sunkenBox(ctx, x, y + btn, w, h - 2 * btn, CHROME.slotFace, CHROME.slotDark, CHROME.slotLight, S);

  const step = (dir: -1 | 1, by: number): void => {
    const hot = hovering(p, x, by, w, btn);
    const can = dir < 0 ? at > 0 : at < totalRows - shownRows;
    buttonBox(ctx, x, by, w, btn, S, { hover: hot && can, accent: can ? CHROME.gold : undefined });
    hudText(p.hud, dir < 0 ? "\u25B2" : "\u25BC", x + w / 2, by + btn / 2, 5.5 * S,
      can ? "#ffe9a8" : "rgba(255,233,168,.25)", "center", true);
    if (can) p.hotspots.push({ x, y: by, w, h: btn, fn: () => { p.win.scroll = at + dir; } });
  };
  step(-1, y);
  step(1, y + h - btn);

  // Thumb: as tall a fraction of the track as the window is of the container.
  const track = h - 2 * btn;
  const thumbH = Math.max(6 * S, (track * shownRows) / totalRows);
  const span = track - thumbH;
  const thumbY = y + btn + (totalRows > shownRows ? (span * at) / (totalRows - shownRows) : 0);
  raisedBox(ctx, x + S, thumbY, w - 2 * S, thumbH, "rgba(202,162,58,.55)", CHROME.gold, "#3a2c0e", S);

  // Paging: the track above the thumb goes up a screenful, below goes down.
  const page = Math.max(1, shownRows);
  if (at > 0) {
    p.hotspots.push({ x, y: y + btn, w, h: thumbY - (y + btn), fn: () => { p.win.scroll = at - page; } });
  }
  if (at < totalRows - shownRows) {
    const below = y + h - btn;
    p.hotspots.push({ x, y: thumbY + thumbH, w, h: below - (thumbY + thumbH), fn: () => { p.win.scroll = at + page; } });
  }
}

/**
 * Draw the resize grip and register the window's foot.
 *
 * Windows that are showing everything they have still get the grip: it is the
 * only way to discover that a window can be resized at all.
 */
function resizeGrip(p: PanelInput, x: number, y: number, w: number, h: number): void {
  const { ctx, scale: S } = p.hud;
  /* No foot on a sheet, and this is not a nicety.
   *
   * A sheet is pinned to the bottom of its band and auto-fitted to it, so
   * dragging the foot changes a height that the anchor immediately converts
   * into a move — the foot slides out from under the finger, the next pointer
   * event reads a different row count, and the window shakes for as long as you
   * hold it. Nothing is lost: the title bar's own -/+ still change the rows. */
  if (p.sheet) { p.win.resizeBar = null; return; }
  /* One rect for both the highlight and the hit test. A strip that lights up
   * somewhere you cannot actually grab is worse than no highlight at all. */
  const bar = RESIZE_BAR * 1.6 * S;
  const by = y + h - bar;
  const hot = hovering(p, x, by, w, bar);
  if (hot) {
    ctx.fillStyle = "rgba(202,162,58,.22)";
    ctx.fillRect(Math.round(x), Math.round(by), Math.round(w), Math.round(bar));
  }
  drawResizeArrows(ctx, x + w / 2, by + bar / 2, bar,
    hot ? "#ffe9a8" : "rgba(255,233,168,.45)");
  p.win.resizeBar = { x, y: by, w, h: bar };
}

/**
 * A sheet may grow this much over its natural size and no further.
 *
 * Growth is what makes a four-column grid finger-sized on a phone; the ceiling
 * is what stops a two-row panel being blown up until scrolling it is a chore.
 */
export const SHEET_MAX_GROW = 2.2;

/**
 * Scroll buttons for a sheet that is taller than its band.
 *
 * Drawn AFTER the window is unclipped, so they ride above it rather than
 * scrolling away with the content they control. A page at a time, less an
 * overlap, because losing your place is the one thing a long list must not do.
 */
function sheetScrollBar(p: PanelInput, s: Rect, over: number): void {
  const { ctx } = p.hud;
  const win = p.win;
  const sc = Math.max(0, Math.min(over, win.sheetScroll ?? 0));
  const bs = Math.round(Math.min(s.w * 0.16, s.h * 0.22));
  const bx = Math.round(s.x + s.w - bs);
  const step = Math.round(s.h * 0.8);

  const btn = (by: number, glyph: string, on: boolean, to: number): void => {
    buttonBox(ctx, bx, by, bs, bs, p.hud.scale, { face: on ? undefined : "rgba(16,26,24,.5)" });
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = on ? "#ffe9a8" : "rgba(255,233,168,.25)";
    ctx.font = `bold ${Math.round(bs * 0.5)}px 'Courier New',monospace`;
    ctx.fillText(glyph, bx + bs / 2, by + bs / 2);
    if (!on) return;
    p.hotspots.push({ x: bx, y: by, w: bs, h: bs, fn: () => { win.sheetScroll = to; } });
  };

  btn(Math.round(s.y), "\u25b2", sc > 0, Math.max(0, sc - step));
  btn(Math.round(s.y + s.h - bs), "\u25bc", sc < over, Math.min(over, sc + step));

  // how far down the list you are, as a track down the right-hand edge
  const trackY = Math.round(s.y + bs);
  const trackH = Math.max(1, Math.round(s.h - 2 * bs));
  ctx.fillStyle = "rgba(0,0,0,.45)";
  ctx.fillRect(bx + Math.round(bs * 0.32), trackY, Math.round(bs * 0.36), trackH);
  const thumbH = Math.max(Math.round(bs * 0.4), Math.round((trackH * s.h) / (s.h + over)));
  const thumbY = trackY + Math.round(((trackH - thumbH) * sc) / over);
  ctx.fillStyle = "rgba(202,162,58,.85)";
  ctx.fillRect(bx + Math.round(bs * 0.32), thumbY, Math.round(bs * 0.36), thumbH);
}

/** Is this window in the column right now? */
export function isDocked(win: PanelWindow, dock: DockLayout): boolean {
  return dock.w > 0 && win.docked !== false && DOCKABLE_PANELS.includes(win.kind);
}

/**
 * The width a docked window must be. Every dockable window is naturally
 * `DOCK_INNER` units wide (that is where the constant came from), so at the
 * column's own unit this is an exact fit and nothing is rescaled — the
 * narrower corpse grid simply centres itself, which keeps a stack of windows
 * flush down one edge.
 */
function dockedW(p: PanelInput, natural: number): number {
  return isDocked(p.win, p.dock) ? p.dock.innerW : natural;
}

/**
 * Where this window's top-left corner goes.
 *
 * Fourteen windows used to carry their own copy of the centring expression,
 * which is why there was nowhere to put docking. Docked windows stack from
 * the top of the free area, measured against the windows already drawn THIS
 * frame — the array is drawn in order, so their rects are fresh and the stack
 * never lags a frame behind.
 */
function anchor(p: PanelInput, w: number, h: number): { x: number; y: number } {
  const { screenW, screenH, scale: S } = p.hud;
  const d = p.dock;
  /* A phone has exactly one place a panel can go, so there is nothing to
   * decide: the sheet band, bottom-aligned. Bottom rather than top because the
   * panel's own footer — close button, scroll arrows, slot counter — then sits
   * next to the deck within the thumb's reach, while the part that scrolls off
   * the top is the part you only read. */
  /* The strip is docked, so it takes no offset at all.
   *
   * This is what pushed it back off the edge: a bag window carries a desktop
   * starting offset of -120 design units, meant to keep a fresh window clear of
   * the others, and the sheet branch below was dutifully adding it. On a phone
   * that is most of a thumb's width of map covered for no reason. Right-aligned
   * rather than centred, so the panel hugs the glass even when it comes out
   * narrower than the lane it was given. */
  if (p.strip) {
    const s = p.strip;
    const over = Math.max(0, h - s.h);
    const sc = Math.max(0, Math.min(over, p.win.sheetScroll ?? 0));
    p.win.sheetScroll = sc;
    p.win.sheetY = undefined;
    return { x: Math.round(s.x + s.w - w), y: Math.round(s.y - sc) };
  }
  if (p.sheet) {
    const s = p.sheet;
    const band = p.sheetBand ?? { top: s.y, bottom: s.y + s.h };
    /* Free in both axes, clamped to the screen. Vertical-only was the first
     * answer and it was too clever: a full-width sheet has little to gain from
     * moving sideways, but "little" is not "nothing", and taking the axis away
     * meant the window fought the finger instead of following it. */
    const cx = Math.round(s.x + (s.w - w) / 2 + p.win.offset.x);
    const x = Math.round(Math.max(0, Math.min(Math.max(0, screenW - w), cx)));

    const over = Math.max(0, h - s.h);
    if (over > 0) {
      /* Taller than the band: the window sits still and the VIEWPORT moves over
       * it. Bottom-pinning a scrolling panel would mean its top drifted every
       * time a row appeared. */
      const sc = Math.max(0, Math.min(over, p.win.sheetScroll ?? 0));
      p.win.sheetScroll = sc;
      p.win.sheetY = undefined;
      return { x, y: Math.round(s.y - sc) };
    }
    p.win.sheetScroll = 0;
    const want = s.y + s.h - h + p.win.offset.y;
    const y = Math.round(Math.max(band.top, Math.min(Math.max(band.top, band.bottom - h), want)));
    /* Hold still through a pixel or two of self-inflicted movement. */
    const held = p.win.sheetY;
    const settled = held !== undefined && Math.abs(held - y) <= 2 ? held : y;
    p.win.sheetY = settled;
    return { x, y: settled };
  }
  if (isDocked(p.win, d)) {
    let y = d.stackTop;
    for (const q of p.ui.windows) {
      if (q === p.win) break;
      if (q.rect && isDocked(q, d)) y += q.rect.h + DOCK_GAP * S;
    }
    // The column is full. Rather than hide the window or invent a scrollbar,
    // it floats — visible, grabbable, and back in the stack the moment
    // something above it is closed or rolled up.
    if (y + h <= d.stackBottom) return { x: d.innerX, y };
  }
  // Centre on the MAP, not the whole canvas: with a sidebar open, dead centre
  // of the canvas is off-centre to everything the player is looking at.
  return {
    x: (screenW - d.w - w) / 2 + p.win.offset.x,
    y: (screenH - h) / 2 + p.win.offset.y,
  };
}

export interface Hotspot {
  x: number;
  y: number;
  w: number;
  h: number;
  fn: () => void;
}

/** A draggable inventory cell recorded during draw. */
export interface ItemSlot {
  x: number;
  y: number;
  w: number;
  h: number;
  index: number;
  kind: ItemKind;
  n: number;
  /** A cell inside some container. Mutually exclusive with `eqSlot`. */
  ref?: ContainerRef;
  /** A paperdoll cell: a worn gear slot, or "pack" for the worn backpack. */
  eqSlot?: EqSlot | "pack";
}

/** One open, draggable window. Multiple can be open at once (z-order = array order). */
export interface PanelWindow {
  kind: PanelKind;
  /**
   * Container windows: the container this window shows, as an ABSOLUTE
   * address. Replaced the old "root kind plus a trail of slot indices"
   * because a trail can only ever describe ONE path per window kind, and the
   * player needs two packs from the same bag side by side.
   */
  ref?: ContainerRef;
  /** User drag offset from the panel's default anchor. */
  offset: { x: number; y: number };
  /** Panel body rect this frame (screen px); set during draw. */
  rect: { x: number; y: number; w: number; h: number } | null;
  /** Draggable title-bar hitbox this frame (screen px); set during draw. */
  titleBar: { x: number; y: number; w: number; h: number } | null;
  /** Auto-fit factor (≤1) applied to this window so it never spills off-screen. */
  fit?: number;
  /**
   * Torn out of the phone's side strip by dragging it, and living as an
   * ordinary sheet from now on. Without this the strip would be the one window
   * on the phone that refuses to follow your finger.
   */
  stripOut?: boolean;
  /** Creation order, so "the first pack you opened" survives z-order raising. */
  seq?: number;
  /**
   * Last settled top edge as a sheet, in screen px.
   *
   * A sheet is pinned to the BOTTOM of its band, so its top is derived from its
   * own height — and any content that measures a pixel taller on one frame than
   * the next drags the whole window, and everything the finger is aiming at,
   * up and down with it. Remembering where it settled and ignoring changes of a
   * pixel or two turns that shiver into stillness.
   */
  sheetY?: number;
  /**
   * How far the sheet VIEWPORT is scrolled, in screen px.
   *
   * Distinct from `scroll`, which walks a container's rows. This one moves the
   * whole window behind a window-shaped hole, and it exists because the first
   * version had no such hole: a panel taller than the band was SHRUNK to fit,
   * so a shopkeeper with forty wares came out as a finger-wide ribbon of
   * unreadable text. Long lists are not a container problem — the shop, the
   * forge, the tower and the task board all have them — so the fix belongs
   * here, where every panel passes through, rather than in each of them.
   */
  sheetScroll?: number;
  /**
   * How far this window can be scrolled, in rows. Zero means it cannot.
   *
   * Written while drawing, so the wheel handler can serve container grids and
   * list panels through one path instead of re-deriving each kind's extent.
   */
  scrollMax?: number;
  /**
   * First visible row when the window is too short to show them all.
   *
   * Rows, not cells. Reset whenever the window navigates somewhere else, so a
   * pack you walk into never opens already scrolled.
   */
  scroll?: number;
  /**
   * The strip along the bottom edge you can grab to resize the window.
   *
   * Set while drawing, like `titleBar`, so the pointer handler in main.ts can
   * hit-test it without knowing anything about how the window is laid out.
   */
  resizeBar?: { x: number; y: number; w: number; h: number } | null;
  /**
   * Sitting in the right-hand column rather than floating over the map.
   *
   * UNDEFINED means "yes, if you can" — a container opens docked without
   * anyone having to ask for it, which is the whole point. Only dragging one
   * out ever writes `false`, so the preference is remembered per window and
   * a torn-out backpack stays torn out.
   */
  docked?: boolean;
}

export interface UiState {
  /** Open windows, back-to-front. The last one is drawn on top and grabs input first. */
  windows: PanelWindow[];
  placing: StructKey | null;
  selSlot: EqSlot | null;
  loot: Corpse | null;
  npc: Npc | null;
  /** The Storage Chest whose window is open (chests are independent now). */
  stash: Structure | null;
  /** The container on the ground whose window is open, if any. */
  floor: GroundItem | null;
  shopTab: "buy" | "sell";
  /** Which tab of the Forge window is showing (Etap 24). */
  forgeTab: "craft" | "smelt" | "gems" | "test";
  /** Which page of the Forge's TEST grid is showing. */
  testPage: number;
  /** Which elemental lane the Alchemy Tower window is showing. */
  towerTab: string;
  /** The structure whose upgrade is being offered in the build window. */
  upgrading: Structure | null;
  dragging: boolean;
  /** Look/inspect mode: taps describe items instead of using them. */
  lookMode: boolean;
  /** Item currently shown in the inspect popup, if any. */
  inspect: ItemKind | null;
  /** Quantity chooser for moving/dropping part of a stack. */
  split: {
    kind: ItemKind; index: number; ref: ContainerRef; max: number; n: number; canStore: boolean;
    /** A throw already aimed by the drag. */
    at?: { x: number; y: number };
    /** A destination already chosen by the drag — the drop that is waiting on
     *  an amount. Tibia asks the same question for the same gesture. */
    to?: { ref: ContainerRef; index: number | null };
  } | null;
}

export interface PanelActions {
  startPlacing: (key: StructKey) => void;
  useItem: (kind: ItemKind, slotIndex: number) => void;
  equipItem: (kind: ItemKind, slotIndex: number) => void;
  unequip: (slot: EqSlot) => void;
  craft: (r: Recipe) => void;
  smelt: (kind: ItemKind) => void;
  testGrant: (kind: ItemKind) => void;
  makeGem: () => void;
  upgrade: (s: Structure) => void;
  attune: (el: Element) => void;
  research: (id: string) => void;
  buyOffer: (id: string) => void;
  buyCrystal: (id: string) => void;
  takeLoot: (c: Corpse, index: number) => void;
  /** Empty a world container into the bag. Null means "whatever this window shows". */
  takeAllLoot: (c: Corpse | null) => void;
  buy: (kind: ItemKind) => void;
  sell: (kind: ItemKind) => void;
  claim: (id: string) => void;
  acceptTask: (id: string) => void;
  abandonTask: () => void;
  handInTask: () => void;
  buyExchange: (id: string) => void;
  moveStack: (ref: ContainerRef, index: number) => void;
  /** Walk this window down into the container sitting in slot `index`. */
  /** Open the container in slot `index` of `ref` — in its own window. */
  /**
   * Walk into the pack in `index` of `ref`.
   *
   * `win` is the window the click came from, and it decides everything: if
   * that window is the one already showing `ref`, it navigates IN PLACE the
   * way Tibia does. Only a click from somewhere else — the chest window draws
   * your backpack in its lower half — opens a window of its own.
   */
  openNested: (ref: ContainerRef, index: number, win: PanelWindow) => void;
  /** Back up to the container holding this one. */
  navUp: (ref: ContainerRef, win: PanelWindow) => void;
  /** Take the worn backpack off — it has to go somewhere, so this drops it. */
  removePack: () => void;
  setOutfitColor: (zone: OutfitZone, idx: number) => void;
  resetOutfitColors: () => void;
  look: (kind: ItemKind) => void;
  toggleLook: () => void;
  openBag: () => void;
  cycleAmmo: () => void;
  splitConfirm: (mode: "store" | "take" | "drop" | "throw" | "move") => void;
  close: (kind: PanelKind) => void;
}

export interface PanelInput {
  hud: HudCtx;
  ui: UiState;
  game: Game;
  player: Player;
  mouse: { sx: number; sy: number };
  act: PanelActions;
  hotspots: Hotspot[];
  /** Draggable inventory cells recorded this frame (for mouse drag-and-drop). */
  itemSlots: ItemSlot[];
  /** The window currently being drawn (position, drag offset, hitboxes). */
  win: PanelWindow;
  /** Geometry of the docked sidebar; zero-width when there is no sidebar. */
  dock: DockLayout;
  /**
   * On a portrait phone, the band a panel is allowed to occupy: full width,
   * pinned against the thumb deck. Absent everywhere else.
   *
   * A sheet is not a floating window that happens to sit near the bottom. It
   * has no free position — dragging it could only make it worse — and it is
   * sized to the band rather than to its own contents, which is the opposite of
   * every other window here and the reason it needs a field of its own.
   */
  sheet?: Rect | null;
  /** How far up and down a sheet may be dragged; the world band's edges. */
  sheetBand?: { top: number; bottom: number } | null;
  /**
   * Set on the ONE container docked to the phone's side strip.
   *
   * Its presence changes how a container draws itself: one column instead of
   * four, and as many rows as the strip is tall rather than as many as the
   * saved preference asks for. A four-column grid squeezed into a strip would
   * be four columns of specks; one column of full-size cells is the point.
   */
  strip?: Rect | null;
}

/** A small square title-bar button; returns nothing, pushes its hotspot. */
function titleBtn(
  p: PanelInput, bx: number, by: number, bs: number,
  glyph: string, fill: string, border: string, fg: string, fn: () => void,
): void {
  const { ctx, scale: S } = p.hud;
  // `border` still selects the accent so the close button stays visibly red,
  // but the box itself is a raised plate now, not an outline.
  buttonBox(ctx, bx, by, bs, bs, S, {
    face: fill,
    hover: hovering(p, bx, by, bs, bs),
    accent: border === "#6e571f" ? undefined : border,
  });
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = fg;
  ctx.font = `bold ${Math.round(9 * S)}px 'Courier New',monospace`;
  ctx.fillText(glyph, bx + bs / 2, by + bs / 2 + 0.5 * S);
  p.hotspots.push({ x: bx - 1.5 * S, y: by - 2 * S, w: bs + 3 * S, h: bs + 4 * S, fn });
}

/**
 * Panel chrome: frame, title bar with drag grip and the [−][+][▾][X] buttons.
 * Returns TRUE when the body should be drawn; FALSE when the window is rolled
 * up to its title bar (Tibia-style), in which case only the bar was drawn.
 */
function goldPanel(p: PanelInput, x: number, y: number, w: number, h: number, title: string): boolean {
  const { ctx, scale: S } = p.hud;
  const kind = p.win.kind;
  const collapsed = panelCollapsed(kind);
  const barH = 14 * S;
  const ph = collapsed ? barH + 2 * S : h; // rolled up: just the bar + border
  const inset = frameInset(S);
  panelFrame(ctx, x, y, w, ph, S);
  // The bar is its own raised plate INSIDE the frame, so the seam under it
  // does the job the old flat gold line was doing — but with a direction.
  raisedBox(ctx, x + inset, y + inset, w - 2 * inset, barH - inset,
    CHROME.barFace, CHROME.barLight, CHROME.barDark, S);
  hudText(p.hud, title, x + w / 2, y + 7 * S, 9 * S, CHROME.goldText, "center", true);
  // grip dots hinting the title bar is draggable
  ctx.fillStyle = "rgba(255,233,168,.5)";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + 6 * S + i * 3 * S, y + 4 * S, S, S);
    ctx.fillRect(x + 6 * S + i * 3 * S, y + 8 * S, S, S);
  }
  p.win.rect = { x, y, w, h: ph };
  // title-bar buttons, right to left: [X] [▾/▸] and, when expanded, [+] [−]
  const bs = 13 * S;
  const gap = 2 * S;
  const by = y + (barH - bs) / 2;
  let bx = x + w - bs - 2 * S;
  // close (X)
  titleBtn(p, bx, by, bs, "", "rgba(160,40,30,.9)", "#ffcabf", "#fff", () => p.act.close(kind));
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(1, 1.4 * S);
  ctx.beginPath();
  ctx.moveTo(bx + 3.5 * S, by + 3.5 * S);
  ctx.lineTo(bx + bs - 3.5 * S, by + bs - 3.5 * S);
  ctx.moveTo(bx + bs - 3.5 * S, by + 3.5 * S);
  ctx.lineTo(bx + 3.5 * S, by + bs - 3.5 * S);
  ctx.stroke();
  /* In the strip only the close box fits, or means anything. Four buttons
   * crammed into one column's width overlapped into an unreadable smear, and
   * three of the four were lying: the strip sets its own row count from its
   * height, and zooming a window that is sized to the screen edge does nothing. */
  if (!p.strip) {
    // collapse / expand toggle
    bx -= bs + gap;
    titleBtn(p, bx, by, bs, collapsed ? "▸" : "▾", "rgba(40,32,20,.9)", "#6e571f", "#cfa86a",
      () => togglePanelCollapsed(kind));
    if (!collapsed && !isDocked(p.win, p.dock)) {
      // zoom + / −  (per-window, persisted). Hidden while docked: the column has
      // ONE width, so a button that promises to change this window's is lying.
      bx -= bs + gap;
      titleBtn(p, bx, by, bs, "+", "rgba(40,32,20,.9)", "#6e571f", "#cfa86a", () => stepPanelZoom(kind, 1));
      bx -= bs + gap;
      titleBtn(p, bx, by, bs, "−", "rgba(40,32,20,.9)", "#6e571f", "#cfa86a", () => stepPanelZoom(kind, -1));
    }
  }
  // draggable region is the title bar minus the button cluster
  p.win.titleBar = { x, y, w: Math.max(20 * S, bx - x - 4 * S), h: barH };
  return !collapsed;
}

function hovering(p: PanelInput, x: number, y: number, w: number, h: number): boolean {
  return p.mouse.sx >= x && p.mouse.sx < x + w && p.mouse.sy >= y && p.mouse.sy < y + h;
}

/**
 * Draw a sprite as a UI icon. `sc` is screen px per LEGACY (16-px-era) art
 * pixel — iconW/iconH divide the bake scale back out, so every call site keeps
 * the number it was authored with and every icon keeps its exact footprint,
 * however chunky the underlying sprite got.
 */
function icon(p: PanelInput, spr: HTMLCanvasElement, x: number, y: number, sc: number): void {
  p.hud.ctx.imageSmoothingEnabled = false;
  p.hud.ctx.drawImage(spr, x, y, iconW(spr, sc), iconH(spr, sc));
}

/** Set each frame by whichever slot the mouse is over; drawn as a hover tooltip. */
let tooltipKind: ItemKind | null = null;
/** The actual stack the tooltip is describing, when the hover was over one.
 *  Containers need it: their weight is not a property of their KIND. */
let tooltipStack: ItemStack | null = null;

/** A small "Look" toggle in the panel body; taps describe items when it's on. */
/**
 * The Look toggle, on the title bar.
 *
 * It used to sit at y+15S — one row under the bar and directly over the first
 * row of slots, which is what made it look like it had escaped the frame. On
 * the bar it overlaps nothing, costs no height (which matters in a column),
 * and sits with the other mode buttons where a toggle belongs.
 */
function lookToggle(p: PanelInput, x: number, y: number, w: number): void {
  const { ctx, scale: S } = p.hud;
  const bw = 26 * S;
  const bh = 10 * S;
  const bx = x + w - bw - 60 * S; // clear of the −/+/▾/× cluster on the right
  const by = y + 2 * S;
  const on = p.ui.lookMode;
  buttonBox(ctx, bx, by, bw, bh, S, {
    on, face: on ? "rgba(90,161,232,.85)" : undefined,
    hover: hovering(p, bx, by, bw, bh), accent: on ? "#cfe8ff" : undefined,
  });
  hudText(p.hud, "Look", bx + bw / 2, by + bh / 2, 6.5 * S, on ? "#0b2036" : "#cfa86a", "center", true, bw - 2 * S);
  p.hotspots.push({ x: bx, y: by, w: bw, h: bh, fn: () => p.act.toggleLook() });
  /* Carve it out of the drag region, or pressing it just moves the window:
   * the title bar is grabbed on pointerdown, long before hotspots are read. */
  const tb = p.win.titleBar;
  if (tb) {
    const cut = tb.x + tb.w - bx;
    if (cut > 0) tb.w = Math.max(0, tb.w - cut);
  }
}

/** Draw the queued hover tooltip (if any) near the cursor, then clear it. */
function drawItemTooltip(base: Omit<PanelInput, "win">): void {
  if (!tooltipKind) return;
  const kind = tooltipKind;
  const stack = tooltipStack;
  tooltipKind = null;
  tooltipStack = null;
  const { ctx, scale: S, screenW, screenH } = base.hud;
  const lines = itemInfoLines(kind, stack);
  const title = ITEMS[kind].name;
  const fs = 7 * S;
  ctx.font = `${fs}px monospace`;
  let tw = ctx.measureText(title).width;
  for (const l of lines) tw = Math.max(tw, ctx.measureText(l).width);
  const pad = 6 * S;
  const w = tw + pad * 2;
  const h = pad * 2 + (lines.length + 1) * (fs + 2 * S);
  let x = base.mouse.sx + 12 * S;
  let y = base.mouse.sy + 12 * S;
  if (x + w > screenW) x = screenW - w - 4 * S;
  if (y + h > screenH) y = screenH - h - 4 * S;
  popupFrame(ctx, x, y, w, h, S, "rgba(22,17,10,.96)");
  let ly = y + pad + fs / 2;
  hudText(base.hud, title, x + pad, ly, fs, "#ffe9a8", "left", true);
  ly += fs + 2 * S;
  for (const l of lines) {
    hudText(base.hud, l, x + pad, ly, fs, "#d7d2c0", "left");
    ly += fs + 2 * S;
  }
}

/** Centered inspect popup (mobile/keyboard Look). Tap it or press Esc to close. */
function drawInspect(base: Omit<PanelInput, "win">): void {
  const kind = base.ui.inspect;
  if (!kind) return;
  const { ctx, scale: S, screenW, screenH } = base.hud;
  // full-screen backdrop: any tap off the popup dismisses it (and is consumed)
  base.hotspots.push({ x: 0, y: 0, w: screenW, h: screenH, fn: () => { base.ui.inspect = null; } });
  const lines = itemInfoLines(kind);
  const title = ITEMS[kind].name;
  const fs = 9 * S;
  ctx.font = `${fs}px monospace`;
  let tw = ctx.measureText(title).width;
  for (const l of lines) tw = Math.max(tw, ctx.measureText(l).width);
  const pad = 10 * S;
  const w = Math.max(140 * S, tw + pad * 2);
  const h = pad * 2 + 16 * S + (lines.length) * (fs + 3 * S) + 14 * S;
  const x = (screenW - w) / 2;
  const y = (screenH - h) / 2;
  popupFrame(ctx, x, y, w, h, S, "rgba(22,17,10,.97)");
  const spr = itemSprite(kind);
  icon(base as PanelInput, spr, x + pad, y + pad, 2 * S);
  hudText(base.hud, title, x + pad + iconW(spr, 2 * S) + 8 * S, y + pad + 8 * S, fs, "#ffe9a8", "left", true);
  let ly = y + pad + 26 * S;
  for (const l of lines) {
    hudText(base.hud, l, x + pad, ly, fs, "#d7d2c0", "left");
    ly += fs + 3 * S;
  }
  hudText(base.hud, "tap / Esc to close", x + w / 2, y + h - 8 * S, 7 * S, "rgba(220,214,190,.6)", "center");
  base.hotspots.push({ x, y, w, h, fn: () => { base.ui.inspect = null; } });
}

/** Quantity chooser for moving/dropping part of a stack (bag ⇄ chest / drop). */
function drawSplit(base: Omit<PanelInput, "win">): void {
  const sp = base.ui.split;
  if (!sp) return;
  const { ctx, scale: S, screenW, screenH } = base.hud;
  // backdrop: tapping outside the chooser cancels it (and is consumed)
  base.hotspots.push({ x: 0, y: 0, w: screenW, h: screenH, fn: () => { base.ui.split = null; } });
  const w = 210 * S;
  const h = 118 * S;
  const x = (screenW - w) / 2;
  const y = (screenH - h) / 2;
  popupFrame(ctx, x, y, w, h, S, "rgba(22,17,10,.98)");
  const spr = itemSprite(sp.kind);
  icon(base as PanelInput, spr, x + 10 * S, y + 8 * S, 2 * S);
  hudText(base.hud, ITEMS[sp.kind].name, x + 10 * S + iconW(spr, 2 * S) + 8 * S, y + 14 * S, 9 * S, "#ffe9a8", "left", true);
  hudText(base.hud, `How many?  (max ${sp.max})`, x + w / 2, y + 34 * S, 7 * S, "rgba(220,214,190,.7)", "center");
  hudText(base.hud, `${sp.n}`, x + w / 2, y + 52 * S, 14 * S, "#ffe9a8", "center", true);

  const clampN = (v: number): number => Math.max(1, Math.min(sp.max, v));
  const stepBtn = (bx: number, by: number, bw: number, label: string, fn: () => void): void => {
    buttonBox(ctx, bx, by, bw, 14 * S, S, {
      hover: base.mouse.sx >= bx && base.mouse.sx < bx + bw
        && base.mouse.sy >= by && base.mouse.sy < by + 14 * S,
    });
    hudText(base.hud, label, bx + bw / 2, by + 7 * S, 7 * S, "#e8dcc0", "center", true);
    base.hotspots.push({ x: bx, y: by, w: bw, h: 14 * S, fn });
  };
  const steps: [string, number][] = [["-10", -10], ["-1", -1], ["+1", 1], ["+10", 10]];
  const sw = 34 * S;
  let bx = x + (w - (sw * 4 + 6 * S * 3)) / 2;
  const sry = y + 62 * S;
  for (const [lbl, d] of steps) { stepBtn(bx, sry, sw, lbl, () => { sp.n = clampN(sp.n + d); }); bx += sw + 6 * S; }
  const hw = 46 * S;
  const hy = sry + 18 * S;
  let hx = x + (w - (hw * 2 + 8 * S)) / 2;
  stepBtn(hx, hy, hw, "Half", () => { sp.n = clampN(Math.floor(sp.max / 2) || 1); }); hx += hw + 8 * S;
  stepBtn(hx, hy, hw, "All", () => { sp.n = sp.max; });

  const acts: [string, "store" | "take" | "drop" | "throw" | "move"][] = [];
  if (sp.at) acts.push(["Throw", "throw"]); // target already aimed by the drag
  else if (sp.to) acts.push(["Move", "move"]); // destination already aimed by the drag
  // anything OUT in the world offers only "take": you cannot drop from a chest
  // onto the floor in one gesture, and a corpse has nothing to store into
  else if (rootOf(sp.ref) === "world") acts.push(["Take", "take"]);
  else {
    if (sp.canStore) acts.push(["Store", "store"]);
    acts.push(["Drop", "drop"]);
    acts.push(["Throw", "throw"]); // arm a throw: the next map tap is the target
  }
  acts.push(["Cancel", "drop"]);
  const aw = (w - 20 * S - (acts.length - 1) * 6 * S) / acts.length;
  let ax = x + 10 * S;
  const ay = y + h - 20 * S;
  for (const [lbl, mode] of acts) {
    const isCancel = lbl === "Cancel";
    const col = isCancel ? "#d08a7a" : lbl === "Drop" ? "#d0a24a" : lbl === "Throw" ? "#8ab6ff" : "#8fd08a";
    buttonBox(ctx, ax, ay, aw, 15 * S, S, {
      face: isCancel ? "rgba(60,30,26,.95)" : "rgba(30,44,30,.95)", accent: col,
    });
    hudText(base.hud, lbl, ax + aw / 2, ay + 7 * S, 8 * S, col, "center", true);
    const capturedMode = mode;
    base.hotspots.push({ x: ax, y: ay, w: aw, h: 15 * S, fn: () => {
      if (isCancel) { base.ui.split = null; return; }
      base.act.splitConfirm(capturedMode);
    } });
    ax += aw + 6 * S;
  }
}

export function drawPanels(
  base: Omit<PanelInput, "win" | "dock" | "sheet" | "strip">
    & { dock?: DockLayout; sheets?: Rect[] | null; strip?: Rect | null },
): void {
  /* An absent dock is a legal state, not an oversight — every headless caller
   * and every narrow screen is in it. Normalising here means no drawing code
   * below has to ask whether the sidebar exists. */
  const dock = base.dock ?? NO_DOCK;
  const sheets = base.sheets ?? null;
  const band = base.sheetBand ?? null;
  /* One container gets the strip: the first one opened that has not been torn
   * out of it. Everything else — shops, the paperdoll, a second pack — queues
   * for the sheets, which have already been narrowed to clear the strip. */
  const strip = base.strip ?? null;
  const stripWin = strip ? stripCandidate(base.ui.windows) : undefined;
  let sheetAt = 0;
  const full: Omit<PanelInput, "win"> = {
    ...base, dock, sheet: sheets?.[0] ?? null, sheetBand: band, strip: null,
  };
  const hud = base.hud;
  const origScale = hud.scale;
  const baseScale = hud.panelScale ?? hud.scale;
  base.ui.windows.forEach((win) => {
    const onStrip = !!strip && win === stripWin;
    const sheet = onStrip
      ? strip
      : sheets && sheets.length
        ? sheets[Math.min(sheetAt++, sheets.length - 1)]
        : null;
    /* Draw each window at the panel scale, times the user's per-window zoom,
     * shrunk by its auto-fit factor so it can never spill off-screen.
     *
     * A DOCKED window skips both: it is drawn at the plain base scale, which
     * is the one scale at which its natural width equals the column's. Zoom
     * and auto-fit would each break that fit, and a column of windows that
     * do not line up is worse than no column. */
    /* A docked window is drawn at the COLUMN's unit, at full size. The column
     * has its own fixed-pixel ruler precisely so that windows in it need not
     * be shrunk; per-window zoom and auto-fit are skipped because the column
     * has one width and a stack that does not line up is worse than none. */
    const docked = isDocked(win, dock) && !sheet;
    hud.scale = docked ? dock.s : baseScale * panelZoom(win.kind) * (win.fit ?? 1);
    const p: PanelInput = { ...base, win, dock, sheet, sheetBand: band, strip: onStrip ? strip : null };
    /* Clip a scrolling sheet to its band, and remember where this window's
     * hitboxes start so the ones that end up outside the hole can be dropped.
     * A button you cannot see but can still press is worse than no button. */
    const overflowing = !!sheet && !!win.rect && win.rect.h > sheet.h;
    const hsFrom = base.hotspots.length;
    const isFrom = base.itemSlots.length;
    if (overflowing && sheet) {
      hud.ctx.save();
      hud.ctx.beginPath();
      hud.ctx.rect(sheet.x, sheet.y, sheet.w, sheet.h);
      hud.ctx.clip();
    }
    switch (win.kind) {
      case "build": drawBuild(p); break;
      case "skills": drawSkills(p); break;
      case "equip": drawEquip(p); break;
      case "bag": drawBag(p); break;
      case "forge": drawForge(p); break;
      case "tower": drawTower(p); break;
      case "loot": drawLoot(p); break;
      case "floor": drawFloor(p); break;
      case "container": drawContainerWin(p); break;
      case "shop": drawShop(p); break;
      case "quest": drawQuests(p); break;
      case "tasks": drawTasks(p); break;
      case "stash": drawStash(p); break;
      case "wardrobe": drawWardrobe(p); break;
      default: break;
    }
    if (overflowing && sheet) {
      hud.ctx.restore();
      const inside = (r: { y: number; h: number }): boolean =>
        r.y + r.h > sheet.y && r.y < sheet.y + sheet.h;
      base.hotspots.splice(hsFrom, base.hotspots.length - hsFrom,
        ...base.hotspots.slice(hsFrom).filter(inside));
      base.itemSlots.splice(isFrom, base.itemSlots.length - isFrom,
        ...base.itemSlots.slice(isFrom).filter(inside));
      sheetScrollBar(p, sheet, win.rect!.h - sheet.h);
    }
    // Auto-fit: if the window (at fit=1) wouldn't fit on screen, compute the
    // exact factor that makes it fit. Corrects on the next frame (invisible
    // at 60fps) and adapts both ways when the window's contents change.
    if (win.rect && !docked) {
      const cur = win.fit ?? 1;
      const natW = win.rect.w / cur;
      const natH = win.rect.h / cur;
      if (sheet) {
        /* WIDTH decides, and height is not consulted at all.
         *
         * Taking the smaller of the two was the bug behind the ribbon-shaped
         * shop: a panel whose natural height ran to three screens got a factor
         * of about a third, and everything in it — text, icons, prices — shrank
         * with it. Height overflow is not a sizing problem, it is a scrolling
         * problem, and it is handled by the viewport below.
         *
         * Width alone is also what makes this stable: a panel's width in design
         * units does not depend on the scale it is drawn at, so the factor
         * settles on the first frame and stays there. Wrapped text changes a
         * panel's HEIGHT as it grows, which is exactly the loop that could set
         * a bottom-pinned window shivering. */
        win.fit = Math.max(0.35, Math.min(SHEET_MAX_GROW, sheet.w / natW));
      } else {
        const f = Math.min(1, (hud.screenW * 0.96) / natW, (hud.screenH * 0.96) / natH);
        win.fit = Math.max(0.35, f);
      }
    }
    if (!sheet) win.sheetY = undefined; // off a phone the memory is meaningless
  });
  hud.scale = origScale;
  if (base.ui.placing) drawPlacingHint(full);
  drawItemTooltip(full);
  drawInspect(full);
  drawSplit(full);
}

/* ---------------- Build ---------------- */

function drawBuild(p: PanelInput): void {
  const { hud, player } = p;
  const { scale: S } = hud;
  const w = 268 * S;
  const baseRowH = 44 * S;
  const home = p.game.worlds.home;
  const chests = homeChests(p.game);
  /** Width the two wrapped lines of a row have to live in. */
  const textW = w - 60 * S;

  /* Rows are MEASURED before the panel is sized, because a cost line that
   * wraps makes its row taller and the frame has to be tall enough to hold it.
   * Cutting the line with an ellipsis was the previous answer and it was the
   * wrong one: the numbers are the entire reason the line exists. */
  interface Row {
    key: typeof STRUCT_KEYS[number];
    def: typeof STRUCTS[keyof typeof STRUCTS];
    owned: Structure | null;
    many: boolean; count: number; tier: number; top: number;
    nextCost: ReturnType<typeof buildCost> | null;
    maxed: boolean; afford: boolean; clickable: boolean;
    head: string[]; note: string[]; rowH: number;
  }
  const rows: Row[] = STRUCT_KEYS.map((key) => {
    const def = STRUCTS[key];
    // The best one standing decides what this row offers: nothing built yet
    // means "build tier I", otherwise it means "raise the one you have".
    //
    // Structures you may own several of never offer an upgrade here, because
    // the row cannot say WHICH one it would raise — it used to silently pick
    // the best, which left every other copy unraisable. Those are upgraded
    // from their own window instead, where the player has already picked one
    // by opening it, and this row only ever sells another at tier I.
    let owned: Structure | null = null;
    for (const st of home.structures) {
      if (st.key === key && (!owned || tierOf(st) > tierOf(owned))) owned = st;
    }
    const many = def.multi === true;
    const count = many ? countOwned(home, key) : 0;
    const tier = owned ? tierOf(owned) : 0;
    const top = maxTier(key);
    const nextCost = many ? buildCost(key, count) : owned ? upgradeCost(key, tier) : buildCost(key);
    const maxed = !many && owned !== null && nextCost === null;
    const afford = nextCost !== null && canAfford(player.bag, nextCost, chests);

    let head: string[] = [];
    let note: string[] = [];
    if (maxed) {
      head = ["top tier reached"];
      note = wrapText(hud, def.tiers[tier - 1].desc, 7 * S, textW);
    } else if (nextCost) {
      const verb = many ? (count > 0 ? "Build another:" : "Build:")
        : owned ? `Upgrade to ${"I".repeat(tier + 1)}:` : "Build:";
      head = wrapText(hud, `${verb} ${costText(nextCost)}`, 8 * S, textW);
      note = wrapText(hud, many ? "Starts at tier I — raise it from the chest itself" : def.tiers[tier].desc, 7 * S, textW);
    }
    const extra = Math.max(0, head.length - 1) * 10 * S + Math.max(0, note.length - 1) * 9 * S;
    return {
      key, def, owned, many, count, tier, top, nextCost, maxed, afford,
      clickable: afford && !maxed, head, note, rowH: baseRowH + extra,
    };
  });
  const h = 20 * S + rows.reduce((a, r) => a + r.rowH, 0) + 30 * S;
  const { x, y } = anchor(p, w, h);
  if (!goldPanel(p, x, y, w, h, "BUILD — structures & upgrades")) return;
  let ry = y + 18 * S;
  for (const r of rows) {
    const { key, def, owned, many, count, tier, top, maxed, clickable, rowH } = r;

    if (hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S) && clickable) {
      hud.ctx.fillStyle = "rgba(202,162,58,.15)";
      hud.ctx.fillRect(x + 4 * S, ry, w - 8 * S, rowH - 2 * S);
    }
    // Show the tier this row is OFFERING, not the one already standing: the
    // picture beside "Upgrade to II" is then the thing being paid for. A maxed
    // row has nothing left to offer and shows what it owns.
    const shown = many ? 1 : maxed ? tier : Math.min(top, tier + 1);
    const spr = structSprite(key, shown);
    // Drawn buildings stand three tiles tall and would burst the row, so the
    // fit is allowed to go fractional below 1x. At or above it, whole steps
    // only — that is what keeps the small baked sprites crisp.
    const fit = (rowH - 12 * S) / iconH(spr, 1);
    const isc = fit >= 1 ? Math.floor(fit) : fit;
    icon(p, spr, x + 10 * S, ry + (rowH - iconH(spr, isc)) / 2, isc);

    const label = many
      ? (count > 0 ? `${def.name}  x${count}` : def.name)
      : tier > 0 ? `${def.name}  ${"I".repeat(tier)}` : def.name;
    hudText(hud, label, x + 48 * S, ry + 9 * S, 10 * S, clickable || maxed ? "#f3eedd" : "#8a8070", "left", true);
    if (top > 1) {
      const right = many ? `${count} built` : tier > 0 ? `tier ${tier} / ${top}` : `tier 0 / ${top}`;
      hudText(hud, right, x + w - 12 * S, ry + 9 * S, 7 * S, "#e8dcc0", "right");
    }
    // Both blocks are already wrapped; each line simply follows the last.
    const headColor = maxed ? "#9fe8a8" : r.afford ? "#b9e07f" : "#d96a5a";
    const afterHead = hudLines(hud, r.head, x + 48 * S, ry + 21 * S, 8 * S, headColor);
    hudLines(hud, r.note, x + 48 * S, Math.max(afterHead, ry + 31 * S), 7 * S, "rgba(220,214,190,.6)");
    if (clickable) {
      const ryy = ry;
      const target = many ? null : owned;
      p.hotspots.push({
        x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S,
        fn: target ? () => p.act.upgrade(target) : () => p.act.startPlacing(key),
      });
    }
    ry += rowH;
  }
  hudText(hud, "Upgrades apply to the structure you already own · [Esc] cancel",
    x + w / 2, y + h - 10 * S, 7 * S, "rgba(220,214,190,.6)", "center", false, w - 12 * S);
}

function drawPlacingHint(p: { hud: HudCtx; ui: UiState }): void {
  const { hud, ui } = p;
  const key = ui.placing;
  if (!key) return;
  const msg = hud.touchInput
    ? `Placing: ${STRUCTS[key].name} — tap a tile to aim, tap it again to build`
    : `Placing: ${STRUCTS[key].name} — click any clear grass on Home Isle ([Esc] cancel)`;
  hudText(hud, msg, hud.screenW / 2, (hud.contentTop ?? 0) + 18 * hud.scale, 9 * hud.scale, "#9fe8a8", "center", true);
}

/* ---------------- Skills ---------------- */

function drawSkills(p: PanelInput): void {
  const { hud } = p;
  const { scale: S } = hud;
  const w = 216 * S;
  const rows = Object.keys(skills) as (keyof typeof skills)[];
  const h = 20 * S + rows.length * 26 * S + 62 * S;
  const { x, y } = anchor(p, w, h);
  if (!goldPanel(p, x, y, w, h, "SKILLS")) return;
  let ry = y + 20 * S;
  for (const key of rows) {
    const s = skills[key];
    const need = skillNeed(s);
    const pct = s.active ? Math.floor((s.pts / need) * 100) : 0;
    hudText(hud, s.name, x + 10 * S, ry + 5 * S, 8 * S, "#f3eedd", "left", true);
    hudText(hud, `Lv ${s.lv}`, x + w - 46 * S, ry + 5 * S, 8 * S, "#ffe9a8", "right");
    hudText(hud, `${pct}%`, x + w - 12 * S, ry + 5 * S, 8 * S, s.active ? "#cfe8d2" : "#8a8070", "right");
    skillBar(p, x + 10 * S, ry + 11 * S, w - 22 * S, 6 * S, s.active ? s.pts / need : 0, s.color);
    if (!s.active) hudText(hud, "(coming soon)", x + 12 * S, ry + 14 * S, 6 * S, "rgba(220,214,190,.45)");
    ry += 26 * S;
  }

  // ---- stance: three buttons, because a fight mode is a choice, not a toggle
  hudText(hud, "Stance", x + 10 * S, ry + 5 * S, 7 * S, "rgba(220,214,190,.7)");
  const cur = stance();
  const bw = (w - 20 * S) / STANCES.length;
  const by = ry + 11 * S;
  STANCES.forEach((st, i) => {
    const bx = x + 10 * S + i * bw;
    const on = st === cur;
    buttonBox(hud.ctx, bx + 1 * S, by, bw - 2 * S, 14 * S, S, {
      on, face: on ? "rgba(0,0,0,.45)" : "rgba(0,0,0,.2)",
      hover: hovering(p, bx + 1 * S, by, bw - 2 * S, 14 * S),
      accent: on ? STANCE_COLOR[st] : undefined,
    });
    hudText(hud, STANCE_LABEL[st], bx + bw / 2, by + 7 * S, 7 * S, on ? STANCE_COLOR[st] : "rgba(220,214,190,.55)", "center", on);
    p.hotspots.push({ x: bx + 1 * S, y: by, w: bw - 2 * S, h: 14 * S, fn: () => setStance(st) });
  });

  // ---- what those numbers actually come out as, so the maths is inspectable
  const pl = p.player;
  const maxMelee = attackPower(pl.level, pl.eq);
  const spec = Math.round((mastery("sword") - 1) * 100);
  hudText(hud, `Max hit ${Math.round(maxMelee * MIN_HIT_RATIO)}–${maxMelee}`, x + 10 * S, ry + 33 * S, 7 * S, "#e8dcc0");
  hudText(hud, spec > 0 ? `Specialist +${spec}%` : "Hybrid — no specialist bonus", x + w - 12 * S, ry + 33 * S, 7 * S, spec > 0 ? "#9fe8a8" : "rgba(220,214,190,.5)", "right");
  hudText(hud, `Armor ${defenseArmor(pl.eq)} · shield block ≤${shieldBlockMax(pl.eq).toFixed(1)}`, x + 10 * S, ry + 43 * S, 7 * S, "rgba(154,208,255,.8)");

  // fed status (Tibia-style regeneration): time left, or a nudge to eat
  const fed = pl.fedS;
  if (fed > 0) {
    const mm = Math.floor(fed / 60);
    const ss = Math.floor(fed % 60).toString().padStart(2, "0");
    hudText(hud, `Fed ${mm}:${ss} — regenerating`, x + 10 * S, ry + 53 * S, 7 * S, "#9ad08a");
  } else {
    hudText(hud, "Hungry — eat food to regenerate", x + 10 * S, ry + 53 * S, 7 * S, "rgba(224,160,106,.9)");
  }
}

function skillBar(p: PanelInput, x: number, y: number, w: number, h: number, frac: number, fg: string): void {
  const { ctx } = p.hud;
  ctx.fillStyle = "#000";
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = "#241c12";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fg;
  ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h);
}

/* ---------------- Equipment ---------------- */

const SLOT_ICONS: Readonly<Record<EqSlot, HTMLCanvasElement>> = {
  amulet: SPR.eqAmulet, head: SPR.eqHead, ring: SPR.eqRing,
  weapon: SPR.sword, body: SPR.eqBody, shield: SPR.eqShield,
  legs: SPR.eqLegs, boots: SPR.eqBoots,
};
const SLOT_LABEL: Readonly<Record<EqSlot, string>> = {
  amulet: "Amulet", head: "Head", ring: "Ring", weapon: "Weapon",
  body: "Body", shield: "Shield", legs: "Legs", boots: "Boots",
};

/**
 * Equipment grid arranged like Tibia's paperdoll: amulet & head up top, the two
 * hands flanking the body, ring & legs below, boots at the foot, and the ammo
 * slot the player loads by hand. Empty cells keep the diamond.
 */
type EqCell = EqSlot | "ammo" | "backpack" | null;
const EQ_LAYOUT: readonly EqCell[] = [
  "amulet", "head",   "backpack",
  "weapon", "body",   "shield",
  "ring",   "legs",   "ammo",
  null,     "boots",  null,
];

function drawEquip(p: PanelInput): void {
  const { hud, player } = p;
  const { ctx, scale: S } = hud;
  const slot = 30 * S;
  const gap = 6 * S;
  const cols = 3;
  const rows = 4;
  const gridW = slot * cols + gap * (cols - 1);
  const w = dockedW(p, gridW + 28 * S);
  const h = 20 * S + slot * rows + gap * (rows - 1) + 60 * S;
  const { x, y } = anchor(p, w, h);
  if (!goldPanel(p, x, y, w, h, "EQUIPMENT")) return;
  const gx = x + (w - gridW) / 2;
  const gy = y + 20 * S;
  const ammoKind = activeArrow(player.bag, player.ammo);
  EQ_LAYOUT.forEach((cell, i) => {
    if (cell === null) return;
    const cx = gx + (i % cols) * (slot + gap);
    const cy = gy + Math.floor(i / cols) * (slot + gap);

    if (cell === "backpack") {
      /* A REAL slot now, not a button that opens a window. The backpack is a
       * thing you wear: drag one in to put it on, drag it out to take it off,
       * and with the slot empty you are carrying nothing to carry things in.
       * That is Tibia, and it is what makes a backpack worth 40 gold. */
      const worn = player.pack;
      slotCell(ctx, cx, cy, slot, slot, S, {
        hover: hovering(p, cx, cy, slot, slot),
        accent: worn ? CHROME.gold : undefined,
      });
      const spr = itemSprite("backpack");
      ctx.globalAlpha = worn ? 1 : 0.35;
      icon(p, spr, cx + (slot - iconW(spr, 2 * S)) / 2, cy + (slot - iconH(spr, 2 * S)) / 2 - 3 * S, 2 * S);
      ctx.globalAlpha = 1;
      /* Registered as a drop target EVEN WHEN EMPTY. An empty slot that is not
       * a target is the one state you can never get out of: with no pack worn
       * there is nowhere to drag a pack to, so taking your backpack off would
       * be permanent. */
      p.itemSlots.push({ x: cx, y: cy, w: slot, h: slot, index: 0, kind: "backpack", n: worn ? 1 : 0, eqSlot: "pack" });
      if (worn) {
        if (hovering(p, cx, cy, slot, slot)) { tooltipKind = worn.kind; tooltipStack = worn; }
        const used = (worn.items ?? []).filter((q) => q !== null).length;
        hudText(hud, `${used}/${worn.items?.length ?? 0}`, cx + slot - 3 * S, cy + 9 * S, 6 * S, "#ffe9a8", "right");
        p.hotspots.push({ x: cx, y: cy, w: slot, h: slot,
          fn: () => (p.ui.lookMode ? p.act.look(worn.kind) : p.act.openBag()) });
      }
      hudText(hud, "Bag", cx + slot / 2, cy + slot - 5 * S, 6 * S,
        worn ? "rgba(220,214,190,.85)" : "rgba(220,214,190,.45)", "center");
      return;
    }

    if (cell === "ammo") {
      slotCell(ctx, cx, cy, slot, slot, S, {
        hover: hovering(p, cx, cy, slot, slot),
        accent: ammoKind ? CHROME.slotFilled : undefined,
      });
      const spr = ammoKind ? itemSprite(ammoKind) : SPR.arrow;
      ctx.globalAlpha = ammoKind ? 1 : 0.4;
      icon(p, spr, cx + (slot - iconW(spr, 2 * S)) / 2, cy + (slot - iconH(spr, 2 * S)) / 2 - 3 * S, 2 * S);
      ctx.globalAlpha = 1;
      if (ammoKind) {
        const n = bagCount(player.bag, ammoKind);
        hudText(hud, `${n}`, cx + slot - 3 * S, cy + slot - 6 * S, 7 * S, "#ffe9a8", "right");
        if (hovering(p, cx, cy, slot, slot)) tooltipKind = ammoKind;
      }
      // Clicking cycles through the ammo actually in the bag. Look mode still
      // inspects, so the slot never stops being readable.
      const k = ammoKind;
      p.hotspots.push({
        x: cx, y: cy, w: slot, h: slot,
        fn: () => (p.ui.lookMode && k ? p.act.look(k) : p.act.cycleAmmo()),
      });
      // An explicit pick is worth showing: "auto" and "I chose these" behave
      // differently the moment the stack runs out.
      const label = player.ammo && ammoKind === player.ammo ? "Ammo *" : "Ammo";
      hudText(hud, label, cx + slot / 2, cy + slot - 5 * S, 6 * S, "rgba(220,214,190,.7)", "center");
      return;
    }

    const key = cell;
    const equipped = player.eq[key];
    slotCell(ctx, cx, cy, slot, slot, S, {
      hover: hovering(p, cx, cy, slot, slot),
      accent: equipped ? CHROME.slotFilled : undefined,
    });
    if (equipped) {
      const spr = itemSprite(equipped);
      icon(p, spr, cx + (slot - iconW(spr, 2 * S)) / 2, cy + (slot - iconH(spr, 2 * S)) / 2 - 3 * S, 2 * S);
      if (hovering(p, cx, cy, slot, slot)) tooltipKind = equipped;
      const eqk = equipped;
      // register as a draggable item cell so worn gear can be dragged straight
      // to the ground / bag / storage chest, exactly like a backpack item
      p.itemSlots.push({ x: cx, y: cy, w: slot, h: slot, index: 0, kind: eqk, n: 1, eqSlot: key });
      p.hotspots.push({ x: cx, y: cy, w: slot, h: slot, fn: () => (p.ui.lookMode ? p.act.look(eqk) : p.act.unequip(key)) });
    } else {
      const spr = SLOT_ICONS[key];
      ctx.globalAlpha = 0.4;
      icon(p, spr, cx + (slot - iconW(spr, 2 * S)) / 2, cy + (slot - iconH(spr, 2 * S)) / 2 - 3 * S, 2 * S);
      ctx.globalAlpha = 1;
      // an EMPTY gear cell takes a drop too — dragging a helmet onto the bare
      // head slot is the obvious gesture, and it used to do nothing at all
      p.itemSlots.push({ x: cx, y: cy, w: slot, h: slot, index: 0, kind: "backpack", n: 0, eqSlot: key });
    }
    hudText(hud, SLOT_LABEL[key], cx + slot / 2, cy + slot - 5 * S, 6 * S, "rgba(220,214,190,.7)", "center");
  });

  let sy = gy + slot * rows + gap * (rows - 1) + 10 * S;
  ctx.fillStyle = "#6e571f";
  ctx.fillRect(x + 8 * S, sy, w - 16 * S, S);
  sy += 9 * S;
  const cap = carryCap(player);
  const used = Math.round(carriedWeight(player));
  const stats: ReadonlyArray<readonly [string, string]> = [
    ["HP", `${Math.ceil(player.hp)} / ${player.maxhp}`],
    ["Cap", `${used} / ${cap} oz`],
  ];
  for (const [k, v] of stats) {
    hudText(hud, k, x + 12 * S, sy, 8 * S, "#cfe8d2");
    hudText(hud, v, x + w - 12 * S, sy, 8 * S, "#ffe9a8", "right");
    sy += 11 * S;
  }
}

/* ---------------- Bag ---------------- */

function drawBag(p: PanelInput): void {
  const { hud, player } = p;
  const { ctx, scale: S } = hud;

  /* Navigated into a pack inside the bag: this window IS a container view now.
   * Tibia never opens a second window for a bag-in-a-bag — it walks the one
   * you clicked in, and the back arrow walks it out again. */
  if (p.win.ref && p.win.ref.c !== "bag") { drawContainerWin(p); return; }

  // No backpack, no window worth drawing — say so plainly instead of showing
  // an empty grid the player will try to click things into.
  if (!player.pack) {
    const w = dockedW(p, 190 * S);
    const h = 62 * S;
    const { x, y } = anchor(p, w, h);
    if (!goldPanel(p, x, y, w, h, "NO BACKPACK")) return;
    hudText(hud, "You are not wearing a backpack.", x + w / 2, y + 26 * S, 8 * S, "#e0a06a", "center");
    hudText(hud, "Drag one onto the Bag slot to carry things.", x + w / 2, y + 40 * S, 7 * S, "rgba(220,214,190,.6)", "center");
    return;
  }

  const ref: ContainerRef = { c: "bag" };
  const slots = slotsOf(ref, player);
  if (!slots) return;

  const cols = p.strip ? 1 : 4;
  const allRows = Math.ceil(slots.length / cols);
  const cell = 32 * S;
  const gap = 4 * S;
  const rows = lootRows(p, slots, allRows, cell, gap);
  const gridW = cols * cell + (cols - 1) * gap;
  const w = dockedW(p, gridW + 24 * S);
  const h = 20 * S + rows * cell + (rows - 1) * gap + 20 * S + RESIZE_BAR * S;
  const { x, y } = anchor(p, w, h);
  if (!goldPanel(p, x, y, w, h, "BACKPACK")) return;
  lookToggle(p, x, y, w);
  /* No gold line here any more. Money is coins in these very cells now, so a
   * separate total would be printing the same thing twice — and worse, in a
   * different unit: the row said "3157 gold" while the slot beside it said 31,
   * because that slot holds 31 PLATINUM. The running total lives on the HUD. */
  const gx = x + (w - gridW) / 2;
  const gy = y + 20 * S;

  const at = scrollRow(p.win, allRows, rows);
  const from = at * cols;
  const cap = from + rows * cols;
  slots.forEach((stackSlot, i) => {
    /* Cells outside the visible window are skipped completely — not drawn, not
     * clickable, not a drop target. And the index a cell CARRIES stays `i`
     * while only its POSITION shifts by the scroll; swapping those two is how
     * a scrolled grid silently moves items into the wrong slots. */
    if (i < from || i >= cap) return;
    const v = i - from;
    const cx = gx + (v % cols) * (cell + gap);
    const cy = gy + Math.floor(v / cols) * (cell + gap);
    const hov = hovering(p, cx, cy, cell, cell);
    // A pack inside the bag keeps its gold keyline: it is the one cell whose
    // click OPENS something rather than using it, and that is worth marking.
    slotCell(ctx, cx, cy, cell, cell, S, { hover: hov, accent: stackSlot?.items ? CHROME.gold : undefined });
    if (stackSlot) {
      const spr = itemSprite(stackSlot.kind);
      const dw = iconW(spr, 2 * S);
      const dh = iconH(spr, 2 * S);
      icon(p, spr, cx + (cell - dw) / 2, cy + (cell - dh) / 2 - 2 * S, 2 * S);
      if (stackSlot.n > 1) hudText(hud, `${stackSlot.n}`, cx + cell - 3 * S, cy + cell - 4 * S, 7 * S, "#ffe9a8", "right");
      if (stackSlot.items) {
        const used = stackSlot.items.filter((q) => q !== null).length;
        hudText(hud, `${used}/${stackSlot.items.length}`, cx + cell / 2, cy + cell - 4 * S, 6 * S,
          used >= stackSlot.items.length ? "#d96a5a" : "rgba(220,214,190,.75)", "center");
      }
      if (hov) { tooltipKind = stackSlot.kind; tooltipStack = stackSlot; }
      const def = ITEMS[stackSlot.kind];
      const idx = i;
      const k = stackSlot.kind;
      p.itemSlots.push({ x: cx, y: cy, w: cell, h: cell, ref, index: idx, kind: k, n: stackSlot.n });
      if (p.ui.lookMode) {
        p.hotspots.push({ x: cx, y: cy, w: cell, h: cell, fn: () => p.act.look(k) });
      } else if (isContainer(k)) {
        // a pack opens; it is never "used" and never worn from here
        p.hotspots.push({ x: cx, y: cy, w: cell, h: cell, fn: () => p.act.openNested(ref, idx, p.win) });
      } else if (def.slot) {
        p.hotspots.push({ x: cx, y: cy, w: cell, h: cell, fn: () => p.act.equipItem(k, idx) });
      } else if (def.heal || def.food || def.crystal || def.boost) {
        p.hotspots.push({ x: cx, y: cy, w: cell, h: cell, fn: () => p.act.useItem(k, idx) });
      } else {
        p.hotspots.push({ x: cx, y: cy, w: cell, h: cell, fn: () => p.act.moveStack(ref, idx) });
      }
    } else {
      // empty cells take a drop here too — see the note in drawGrid
      p.itemSlots.push({ x: cx, y: cy, w: cell, h: cell, ref, index: i, kind: "wood", n: 0 });
    }
  });
  /* Say so when rows are hidden. Until scrolling exists they are genuinely
   * out of reach, and a window that quietly stops showing half your bag is
   * far worse than one that admits it. */
  if (rows < allRows) {
    scrollBar(p, x + w - (SCROLLBAR_W + 2) * S, gy, rows * (cell + gap) - gap, allRows, rows, at);
  }
  const hint = rows < allRows
    ? `${from + 1}\u2013${Math.min(cap, slots.length)} of ${slots.length}`
    : p.ui.lookMode ? "Look mode — click any item to inspect it"
      : "Click gear to equip · potion/food to use · a pack to open it";
  hudText(hud, hint, x + w / 2, y + h - 13 * S, 7 * S,
    rows < allRows ? "#e8c06a" : "rgba(220,214,190,.6)", "center", false, w - 12 * S);
  resizeGrip(p, x, y, w, h);
}

/* ---------------- Forge (craft · smelt · gems) ---------------- */

/** A row of tabs across the top of a panel. Returns the tab body's top Y. */
function tabRow(
  p: PanelInput, x: number, y: number, w: number,
  tabs: readonly { id: string; label: string; on: boolean }[],
  active: string, pick: (id: string) => void,
): number {
  const { ctx, scale: S } = p.hud;
  const tw = (w - 8 * S) / tabs.length;
  const th = 15 * S;
  tabs.forEach((t, i) => {
    const tx = x + 4 * S + i * tw;
    const sel = t.id === active;
    ctx.fillStyle = sel ? "rgba(202,162,58,.28)" : t.on ? "rgba(0,0,0,.22)" : "rgba(0,0,0,.4)";
    ctx.fillRect(tx, y, tw - 2 * S, th);
    hudText(p.hud, t.label, tx + (tw - 2 * S) / 2, y + 5 * S, 8 * S,
      !t.on ? "#6d6659" : sel ? "#ffe9a8" : "#c8c0aa", "center", sel);
    if (t.on) p.hotspots.push({ x: tx, y, w: tw - 2 * S, h: th, fn: () => pick(t.id) });
  });
  return y + th + 4 * S;
}

function drawForge(p: PanelInput): void {
  const { hud, player, ui, game } = p;
  const { scale: S } = hud;
  const tier = Math.max(1, bestTier(game.worlds.home, "forge"));
  // Tabs the forge cannot serve stay visible but dead: a player who has not
  // built a Forge III should be able to SEE that gem-cutting is what the
  // third tier buys, otherwise the upgrade is a number with no picture.
  if (ui.forgeTab === "gems" && tier < 3) ui.forgeTab = "smelt";

  const smeltables = smeltableRows(player, homeChests(game));
  const rowH = 26 * S;
  const bodyRows = ui.forgeTab === "craft" ? RECIPES.length
    : ui.forgeTab === "smelt" ? Math.max(1, smeltables.length)
    : ui.forgeTab === "test" ? 10
    : Math.max(1, GEM_TROPHIES.length);
  const w = 292 * S;
  const h = 20 * S + 19 * S + Math.min(bodyRows, 12) * rowH + 22 * S;
  const { x, y } = anchor(p, w, h);
  if (!goldPanel(p, x, y, w, h, `FORGE ${"I".repeat(tier)}`)) return;

  let ry = tabRow(p, x, y + 16 * S, w, [
    { id: "craft", label: "CRAFT", on: true },
    { id: "smelt", label: "SMELT", on: true },
    { id: "gems", label: "GEMS", on: tier >= 3 },
    { id: "test", label: "TEST", on: true },
  ], ui.forgeTab, (id) => { ui.forgeTab = id as "craft" | "smelt" | "gems" | "test"; });

  if (ui.forgeTab === "craft") ry = forgeCraft(p, x, ry, w, rowH);
  else if (ui.forgeTab === "smelt") ry = forgeSmelt(p, x, ry, w, rowH, tier, smeltables);
  else if (ui.forgeTab === "test") ry = forgeTest(p, x, ry, w);
  else ry = forgeGems(p, x, ry, w);

  const foot = ui.forgeTab === "craft" ? "Uses backpack + storage chest"
    : ui.forgeTab === "smelt" ? `Burns ${COAL_PER_SMELT} coal per piece · tier ${tier} furnace`
    : ui.forgeTab === "test" ? "TEST ONLY — 1 gold buys a full stack, gear one piece"
    : `${GEM_TROPHY_KINDS} different trophies + ${GEM_COAL} coal per gem`;
  hudText(hud, foot, x + w / 2, y + h - 9 * S, 7 * S, "rgba(220,214,190,.6)", "center");
}

function forgeCraft(p: PanelInput, x: number, ry: number, w: number, rowH: number): number {
  const { hud, player } = p;
  const S = hud.scale;
  const bags = [player.bag, ...homeChests(p.game)];
  // Anyone hunting for "make iron" opens CRAFT first and finds three arrows.
  hudText(hud, "Iron, steel and gems are not crafted -> see SMELT", x + w / 2, ry, 7 * S, "rgba(220,214,190,.55)", "center");
  ry += 11 * S;
  for (const r of RECIPES) {
    const ok = canCraftAcross(bags, r) && walletAcross(bags) >= (r.gold ?? 0);
    if (hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S) && ok) {
      hud.ctx.fillStyle = "rgba(202,162,58,.15)";
      hud.ctx.fillRect(x + 4 * S, ry, w - 8 * S, rowH - 2 * S);
    }
    const spr = itemSprite(r.out);
    icon(p, spr, x + 10 * S, ry + (rowH - iconH(spr, 2 * S)) / 2, 2 * S);
    hudText(hud, ITEMS[r.out].name, x + 34 * S, ry + 8 * S, 9 * S, ok ? "#f3eedd" : "#8a8070", "left", true);
    hudText(hud, recipeCostText(r), x + 34 * S, ry + 18 * S, 7 * S, ok ? "#b9e07f" : "#d96a5a");
    if (ok) {
      const rr = r; const ryy = ry;
      p.hotspots.push({ x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S, fn: () => p.act.craft(rr) });
    }
    ry += rowH;
  }
  return ry;
}

/**
 * Everything the furnace will accept, across the backpack AND every storage
 * chest, one row per KIND with a count.
 *
 * Both halves of that matter. Reading only the backpack made the tab look
 * empty for anyone who does the natural thing and dumps loot in a chest
 * before walking to the forge. And one row per SLOT meant a stack of six
 * breastplates drew six identical rows, which reads as a rendering bug.
 */
function smeltableRows(player: Player, chests: readonly Bag[]): { kind: ItemKind; n: number }[] {
  const seen = new Map<ItemKind, number>();
  for (const bag of [player.bag, ...chests]) {
    for (const sl of bag) {
      if (sl && canSmelt(sl.kind)) seen.set(sl.kind, (seen.get(sl.kind) ?? 0) + sl.n);
    }
  }
  return [...seen].map(([kind, n]) => ({ kind, n }));
}

function forgeSmelt(
  p: PanelInput, x: number, ry: number, w: number, rowH: number,
  tier: number, rows: { kind: ItemKind; n: number }[],
): number {
  const { hud, player } = p;
  const S = hud.scale;
  const coal = countAcross([player.bag, ...homeChests(p.game)], "coal");
  // Coal gets its own line rather than just grey rows. A row that is dark for
  // an unstated reason is indistinguishable from a broken button.
  if (coal < COAL_PER_SMELT) {
    hudText(hud, "NO COAL — the furnace will not light.", x + w / 2, ry, 8 * S, "#d96a5a", "center", true);
    hudText(hud, "Coal drops from people, orcs, goblins and minotaurs.", x + w / 2, ry + 10 * S, 7 * S, "rgba(220,214,190,.55)", "center");
    ry += 22 * S;
  }
  if (!rows.length) {
    hudText(hud, "Nothing you own will melt.", x + w / 2, ry + 6 * S, 8 * S, "rgba(220,214,190,.55)", "center");
    hudText(hud, "Leather, snakeskin, bone and dragon scale never do.", x + w / 2, ry + 16 * S, 7 * S, "rgba(220,214,190,.4)", "center");
    return ry + rowH;
  }
  for (const row of rows.slice(0, 12)) {
    const y = smeltYield(row.kind, tier as 1 | 2 | 3, ITEMS[row.kind].slot);
    const ok = coal >= COAL_PER_SMELT;
    if (hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S) && ok) {
      hud.ctx.fillStyle = "rgba(202,162,58,.15)";
      hud.ctx.fillRect(x + 4 * S, ry, w - 8 * S, rowH - 2 * S);
    }
    const spr = itemSprite(row.kind);
    icon(p, spr, x + 10 * S, ry + (rowH - iconH(spr, 2 * S)) / 2, 2 * S);
    const label = row.n > 1 ? `${ITEMS[row.kind].name}  x${row.n}` : ITEMS[row.kind].name;
    hudText(hud, label, x + 34 * S, ry + 8 * S, 9 * S, ok ? "#f3eedd" : "#8a8070", "left", true);
    const parts = [y.iron > 0 ? `${y.iron} iron` : "", y.steel > 0 ? `${y.steel} steel` : ""].filter(Boolean);
    hudText(hud, `-> ${parts.join(" + ")}`, x + 34 * S, ry + 18 * S, 7 * S, ok ? "#b9e07f" : "#8a8070");
    hudText(hud, `${ITEMS[row.kind].value}g at Borin`, x + w - 12 * S, ry + 13 * S, 7 * S, "rgba(220,214,190,.45)", "right");
    if (ok) {
      const rr = row; const ryy = ry;
      p.hotspots.push({ x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S, fn: () => p.act.smelt(rr.kind) });
    }
    ry += rowH;
  }
  return ry;
}

/**
 * TEST ONLY — a grid of the entire catalog, one slot's worth for a gold:
 * a full stack of anything that stacks, a single piece of anything that does not.
 *
 * This exists so a feature can be exercised without first farming for it: 500
 * steel is a legitimate evening of play and a ridiculous prerequisite for
 * checking that a panel lays out correctly. It is deliberately loud (its own
 * tab, red heading, "TEST" in the label) so it cannot be mistaken for a real
 * shop and cannot be shipped by accident.
 */
export const TEST_KINDS = Object.keys(ITEMS) as ItemKind[];
const TEST_COLS = 10;
const TEST_ROWS = 8;
const TEST_PER_PAGE = TEST_COLS * TEST_ROWS;

function forgeTest(p: PanelInput, x: number, ry: number, w: number): number {
  const { hud, player, ui } = p;
  const S = hud.scale;
  const pages = Math.ceil(TEST_KINDS.length / TEST_PER_PAGE);
  ui.testPage = ((ui.testPage % pages) + pages) % pages;

  hudText(hud, "TEST — click an item for a stack @ 1 gold", x + w / 2, ry, 8 * S, "#e08a7a", "center", true);
  // page arrows
  const ay = ry - 1 * S;
  for (const [glyph, dir, ax] of [["<", -1, x + 10 * S], [">", 1, x + w - 22 * S]] as const) {
    hud.ctx.fillStyle = "rgba(0,0,0,.3)";
    hud.ctx.fillRect(ax, ay, 12 * S, 11 * S);
    hudText(hud, glyph, ax + 6 * S, ay + 2 * S, 8 * S, "#e8dcc0", "center", true);
    const d = dir;
    p.hotspots.push({ x: ax, y: ay, w: 12 * S, h: 11 * S, fn: () => { ui.testPage += d; } });
  }
  hudText(hud, `${ui.testPage + 1}/${pages}`, x + w - 34 * S, ry, 7 * S, "rgba(220,214,190,.6)", "right");
  ry += 13 * S;

  const cell = (w - 20 * S) / TEST_COLS;
  const start = ui.testPage * TEST_PER_PAGE;
  for (let i = 0; i < TEST_PER_PAGE; i++) {
    const kind = TEST_KINDS[start + i];
    if (!kind) break;
    const cx = x + 10 * S + (i % TEST_COLS) * cell;
    const cy = ry + Math.floor(i / TEST_COLS) * cell;
    const hot = hovering(p, cx, cy, cell - 1 * S, cell - 1 * S);
    hud.ctx.fillStyle = hot ? "rgba(202,162,58,.25)" : "rgba(0,0,0,.22)";
    hud.ctx.fillRect(cx, cy, cell - 1 * S, cell - 1 * S);
    const spr = itemSprite(kind);
    const sc = Math.max(1, Math.floor((cell - 4 * S) / iconH(spr, 1)));
    icon(p, spr, cx + (cell - 1 * S - iconH(spr, sc)) / 2, cy + (cell - 1 * S - iconH(spr, sc)) / 2, sc);
    if (hot) hudText(hud, ITEMS[kind].name, x + w / 2, ry + TEST_ROWS * cell + 2 * S, 8 * S, "#ffe9a8", "center", true);
    const k = kind;
    p.hotspots.push({ x: cx, y: cy, w: cell - 1 * S, h: cell - 1 * S, fn: () => p.act.testGrant(k) });
  }
  if (player.gold < 1) {
    hudText(hud, "(no gold)", x + w / 2, ry + TEST_ROWS * cell + 2 * S, 8 * S, "#d96a5a", "center");
  }
  return ry + TEST_ROWS * cell + 12 * S;
}

function forgeGems(p: PanelInput, x: number, ry: number, w: number): number {
  const { hud, player } = p;
  const S = hud.scale;
  const bags = [player.bag, ...homeChests(p.game)];
  const coal = countAcross(bags, "coal");
  const held = GEM_TROPHIES.map((t) => ({ t, n: countAcross(bags, t) }));
  const kinds = held.filter((h) => h.n > 0).length;
  const ready = kinds >= GEM_TROPHY_KINDS && coal >= GEM_COAL;

  const btnH = 20 * S;
  hud.ctx.fillStyle = ready ? "rgba(160,120,220,.32)" : "rgba(0,0,0,.3)";
  hud.ctx.fillRect(x + 8 * S, ry, w - 16 * S, btnH);
  hudText(hud, ready ? "CUT AN ESSENTIAL GEM" : `${kinds}/${GEM_TROPHY_KINDS} trophy kinds · ${coal}/${GEM_COAL} coal`,
    x + w / 2, ry + 7 * S, 9 * S, ready ? "#e0ccff" : "#8a8070", "center", true);
  if (ready) {
    const ryy = ry;
    p.hotspots.push({ x: x + 8 * S, y: ryy, w: w - 16 * S, h: btnH, fn: () => p.act.makeGem() });
  }
  ry += btnH + 6 * S;

  for (const h of held) {
    const spr = itemSprite(h.t);
    icon(p, spr, x + 12 * S, ry + 2 * S, 2 * S);
    hudText(hud, ITEMS[h.t].name, x + 34 * S, ry + 5 * S, 8 * S, h.n > 0 ? "#f3eedd" : "#6d6659", "left");
    hudText(hud, String(h.n), x + w - 14 * S, ry + 5 * S, 8 * S, h.n > 0 ? "#b9e07f" : "#6d6659", "right");
    ry += 15 * S;
  }
  return ry;
}

/* ---------------- Alchemy Tower ---------------- */

/**
 * The tower's tabs: the five elemental lanes, then everything older.
 *
 * Labels are DERIVED from `ELEMENT_LABEL` rather than typed out. They used to
 * be a hand-written list beside the ids, which is how the shelf went on saying
 * SHADOW for a week after the element was renamed Wind everywhere else — the
 * id is still `shadow` and always will be, since it keys seventy-five items,
 * so a literal label here has nothing tying it to the truth.
 */
export const TOWER_TABS: readonly { id: string; label: string }[] = [
  ...ELEMENTS.map((el) => ({ id: el, label: ELEMENT_LABEL[el].toUpperCase() })),
  { id: "other", label: "OTHER" },
];

/**
 * Which projects a tab shows.
 *
 * Elemental lanes show ONLY the tier matching the tower you have built — a
 * tier-II tower offers Flame and nothing else. The exception is anything
 * already researched, which stays on the list whatever tier it was: you paid
 * to unlock that crystal, and hiding it would quietly cut off the charges you
 * are still buying.
 *
 * The OTHER tab holds the four crystals that predate the elemental system
 * (Life, Fire, Recall, Fire Spear). They are not part of the ladder and are
 * never hidden — there is no better version of Recall waiting at tier III.
 */
/**
 * The four originals only. The elemental tabs are a shop rather than a
 * research tree now, so they come from offersFor() instead.
 */
export function towerRows(tab: string, _towerTier: number): typeof RESEARCH[number][] {
  return tab === "other" ? RESEARCH.filter((r) => r.element === undefined) : [];
}

/**
 * One cost line, materials and gold together. Either half may be empty: the
 * elemental line is gold-only, the four originals are materials-only, and the
 * strongest crystals are both.
 */
function priceText(cost: Parameters<typeof costText>[0], gold: number | undefined): string {
  const parts = [costText(cost), gold ? `${gold} gold` : ""].filter(Boolean);
  return parts.join(" + ") || "free";
}

function drawTower(p: PanelInput): void {
  const { hud, player, game, ui } = p;
  const { ctx, scale: S } = hud;
  const tt = Math.max(1, bestTier(game.worlds.home, "tower"));
  const el = ui.towerTab === "other" ? null : (ui.towerTab as Element);
  const rows = towerRows(ui.towerTab, tt);
  const offers = el ? offersFor(el, tt) : [];
  // Before the stone is spent the shelf is EMPTY — not a list of locked rows.
  // Naming what you cannot have teaches less than an empty shelf and makes
  // choosing an element feel like a checklist instead of a decision.
  const showAttune = el !== null && !isAttuned(el);
  const w = 300 * S;
  const rowH = 34 * S;
  const bodyRows = Math.max(1, rows.length + offers.length);
  const h = 20 * S + 19 * S + (showAttune ? rowH : 0) + bodyRows * rowH + 22 * S;
  const { x, y } = anchor(p, w, h);
  if (!goldPanel(p, x, y, w, h, `ALCHEMY TOWER ${"I".repeat(tt)}`)) return;

  let ry = tabRow(p, x, y + 16 * S, w,
    TOWER_TABS.map((t) => ({ id: t.id, label: t.label, on: true })),
    ui.towerTab, (id) => { ui.towerTab = id; });

  const row = (fill: boolean): void => {
    if (fill) {
      ctx.fillStyle = "rgba(202,162,58,.15)";
      ctx.fillRect(x + 4 * S, ry, w - 8 * S, rowH - 2 * S);
    }
  };

  if (showAttune && el) {
    const key = ATTUNEMENT[el];
    const held = canAfford(player.bag, { [key]: 1 }, homeChests(game));
    row(hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S) && held);
    const spr = itemSprite(key);
    icon(p, spr, x + 10 * S, ry + (rowH - iconH(spr, 2 * S)) / 2, 2 * S);
    hudText(hud, `Attune ${ELEMENT_LABEL[el]}`, x + 34 * S, ry + 8 * S, 9 * S, "#f3eedd", "left", true);
    hudText(hud, "SEALED", x + w - 12 * S, ry + 8 * S, 7 * S, "#c98a5a", "right");
    hudText(hud, `Spend:  1 ${ITEMS[key].name}`, x + 34 * S, ry + 19 * S, 7 * S, held ? "#c9a6ff" : "#d96a5a");
    hudText(hud, "Opens this element for good. Choose carefully — stones are rare.",
      x + 34 * S, ry + 28 * S, 6.5 * S, "rgba(220,214,190,.5)");
    if (held) {
      const ryy = ry;
      const e = el;
      p.hotspots.push({ x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S, fn: () => p.act.attune(e) });
    }
    ry += rowH;
  }

  if (!rows.length && !offers.length && !showAttune) {
    hudText(hud, "Nothing at this tier yet.", x + w / 2, ry + 10 * S, 8 * S, "rgba(220,214,190,.55)", "center");
    ry += rowH;
  }

  // --- the elemental shelf: five crystals, bought outright ---
  for (const o of offers) {
    const affordable = canAfford(player.bag, o.cost, homeChests(game))
      && walletAcross([player.bag, ...homeChests(game)]) >= o.gold;
    row(hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S) && affordable);
    const spr = itemSprite(o.crystal);
    icon(p, spr, x + 10 * S, ry + (rowH - iconH(spr, 2 * S)) / 2, 2 * S);
    hudText(hud, ITEMS[o.crystal].name, x + 34 * S, ry + 8 * S, 9 * S, "#f3eedd", "left", true);
    hudText(hud, `owned: ${bagCount(player.bag, o.crystal)}`, x + w - 12 * S, ry + 8 * S, 7 * S, "#e8dcc0", "right");
    hudText(hud, `Buy x${o.buyN}:  ${priceText(o.cost, o.gold)}`, x + 34 * S, ry + 19 * S, 7 * S, affordable ? "#b9e07f" : "#d96a5a");
    hudText(hud, o.desc, x + 34 * S, ry + 28 * S, 6.5 * S, "rgba(220,214,190,.5)");
    if (affordable) {
      const id = o.id;
      const ryy = ry;
      p.hotspots.push({ x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S, fn: () => p.act.buyOffer(id) });
    }
    ry += rowH;
  }

  // --- the four originals, still researched with materials ---
  for (const r of rows) {
    const researched = isResearched(r.id);
    const cost = researched ? r.buyCost : r.researchCost;
    const gold = researched ? r.buyGold : r.researchGold;
    const affordable = canAfford(player.bag, cost, homeChests(game))
      && walletAcross([player.bag, ...homeChests(game)]) >= (gold ?? 0);
    const clickable = affordable && (researched || towerTierOk(r, tt));
    row(hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S) && clickable);
    const spr = itemSprite(r.crystal);
    icon(p, spr, x + 10 * S, ry + (rowH - iconH(spr, 2 * S)) / 2, 2 * S);
    hudText(hud, r.name, x + 34 * S, ry + 8 * S, 9 * S, "#f3eedd", "left", true);
    if (researched) {
      hudText(hud, `owned: ${bagCount(player.bag, r.crystal)}`, x + w - 12 * S, ry + 8 * S, 7 * S, "#e8dcc0", "right");
      hudText(hud, `Buy x${r.buyN}:  ${priceText(r.buyCost, r.buyGold)}`, x + 34 * S, ry + 19 * S, 7 * S, affordable ? "#b9e07f" : "#d96a5a");
    } else {
      hudText(hud, "LOCKED", x + w - 12 * S, ry + 8 * S, 7 * S, "#c98a5a", "right");
      hudText(hud, `Research:  ${priceText(r.researchCost, r.researchGold)}`, x + 34 * S, ry + 19 * S, 7 * S, affordable ? "#c9a6ff" : "#d96a5a");
    }
    hudText(hud, r.desc, x + 34 * S, ry + 28 * S, 6.5 * S, "rgba(220,214,190,.5)");
    if (clickable) {
      const id = r.id;
      const ryy = ry;
      const fn = researched ? () => p.act.buyCrystal(id) : () => p.act.research(id);
      p.hotspots.push({ x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S, fn });
    }
    ry += rowH;
  }

  const foot = ui.towerTab === "other"
    ? "The originals — no tiers, never hidden"
    : showAttune
      ? "Sealed. An attunement stone opens this element."
      : `Showing tier ${tt} · upgrade the tower for the next five`;
  hudText(hud, foot, x + w / 2, y + h - 9 * S, 7 * S, "rgba(220,214,190,.6)", "center");
}

/* ---------------- Corpse loot & floor containers ---------------- */

/**
 * A corpse, or a container lying on the ground. One renderer, because from
 * the player's side they are the same object: a grid of slots out in the
 * world that you can take from, drop into, and walk away from.
 *
 * The old corpse window was a list of rows with a "take" hotspot each, which
 * is why loot could only ever travel one direction. A grid of real cells is
 * what makes the loot bag work at all — dragging from a body into a backpack
 * on the floor is just a move between two containers now.
 */
function drawWorldContainer(
  p: PanelInput, ref: ContainerRef, topTitle: string, onTakeAll: () => void,
): void {
  const { hud } = p;
  const { ctx, scale: S } = hud;
  const slots = slotsOf(ref, p.player);
  if (!slots) return;

  const cols = p.strip ? 1 : 4;
  const allRows = Math.ceil(slots.length / cols);
  const cell = 30 * S;
  const gap = 4 * S;
  const rows = lootRows(p, slots, allRows, cell, gap);
  const gridW = cols * cell + (cols - 1) * gap;
  const w = dockedW(p, gridW + 24 * S);
  const h = 20 * S + rows * cell + (rows - 1) * gap + 30 * S + RESIZE_BAR * S;
  const { x, y } = anchor(p, w, h);
  if (!goldPanel(p, x, y, w, h, topTitle)) return;

  const gx = x + (w - gridW) / 2;
  let gy = y + 18 * S;
  const at = scrollRow(p.win, allRows, rows);
  drawGrid(p, slots, gx, gy, cols, cell, gap, (i) => p.act.moveStack(ref, i), ref, rows, at);
  if (rows < allRows) {
    scrollBar(p, x + w - (SCROLLBAR_W + 2) * S, gy, rows * (cell + gap) - gap, allRows, rows, at);
  }
  gy += rows * (cell + gap) + 4 * S;

  const bw = w - 24 * S;
  const by = y + h - 24 * S;
  buttonBox(ctx, x + 12 * S, by, bw, 14 * S, S, {
    face: "rgba(202,162,58,.25)", accent: CHROME.gold,
    hover: hovering(p, x + 12 * S, by, bw, 14 * S),
  });
  /* "Take all" still empties the WHOLE container, not just the visible rows —
   * it works on the loot, not on what happens to be on screen. */
  hudText(hud, rows < allRows ? `Take all (${slots.length})` : "Take all",
    x + w / 2, by + 7 * S, 8 * S, "#ffe9a8", "center", true, bw - 6 * S);
  p.hotspots.push({ x: x + 12 * S, y: by, w: bw, h: 14 * S, fn: onTakeAll });
  resizeGrip(p, x, y, w, h);
}

/**
 * A pack opened from inside another container, in a window of its very own.
 *
 * Several of these can be on screen at once, each pointing at a different
 * container — which is the whole reason they exist. The address is absolute,
 * so a window keeps showing the same pack no matter what happens to the cells
 * around it, and goes away the moment that pack does.
 */
function drawContainerWin(p: PanelInput): void {
  const { hud, player } = p;
  const { scale: S } = hud;
  const ref = p.win.ref;
  if (!ref) return;
  const slots = slotsOf(ref, player);
  if (!slots) return;

  const cols = p.strip ? 1 : 4;
  const allRows = Math.ceil(slots.length / cols);
  const cell = 32 * S;
  const gap = 4 * S;
  const rows = lootRows(p, slots, allRows, cell, gap);
  const gridW = cols * cell + (cols - 1) * gap;
  const w = dockedW(p, gridW + 24 * S);
  const h = 20 * S + rows * cell + (rows - 1) * gap + 16 * S + RESIZE_BAR * S;
  const { x, y } = anchor(p, w, h);
  if (!goldPanel(p, x, y, w, h, containerTitle(p, ref, "CONTAINER"))) return;
  navBar(p, x, y, ref);

  const gx = x + (w - gridW) / 2;
  const gy = y + 20 * S;
  const at = scrollRow(p.win, allRows, rows);
  drawGrid(p, slots, gx, gy, cols, cell, gap, (i) => p.act.moveStack(ref, i), ref, rows, at);
  if (rows < allRows) {
    scrollBar(p, x + w - (SCROLLBAR_W + 2) * S, gy, rows * (cell + gap) - gap, allRows, rows, at);
  }
  const used = slots.filter((q) => q !== null).length;
  const foot = rows < allRows
    ? `${used}/${slots.length} · ${at * cols + 1}\u2013${Math.min((at + rows) * cols, slots.length)}`
    : `${used}/${slots.length} · ${containerHome(ref)}`;
  hudText(hud, foot, x + w / 2, y + h - 11 * S, 6.5 * S,
    rows < allRows ? "#e8c06a" : "rgba(220,214,190,.6)", "center", false, w - 12 * S);
  resizeGrip(p, x, y, w, h);
}

function drawLoot(p: PanelInput): void {
  const c = p.ui.loot;
  if (!c) return;
  drawWorldContainer(p, { c: "corpse", body: c }, "CORPSE — loot",
    () => p.act.takeAllLoot(c));
}

function drawFloor(p: PanelInput): void {
  const gi = p.ui.floor;
  if (!gi) return;
  drawWorldContainer(p, { c: "ground", gi }, ITEMS[gi.kind].name.toUpperCase(),
    () => p.act.takeAllLoot(null));
}

/* ---------------- NPC shop ---------------- */

function drawShop(p: PanelInput): void {
  const { hud, ui, player } = p;
  const npc = ui.npc;
  if (!npc) return;
  const shop = SHOPS[npc.key];
  if (!shop) return;
  const { ctx, scale: S } = hud;
  const w = 300 * S;
  const rowH = 24 * S;
  const rows = shop.entries.filter((e) => (ui.shopTab === "buy" ? e.buy > 0 : e.sell > 0));
  const chrome = 58 * S;
  const { first, count } = listView(p, Math.max(1, rows.length), rowH, chrome);
  const h = 34 * S + count * rowH + 24 * S;
  const { x, y } = anchor(p, w, h);
  if (!goldPanel(p, x, y, w, h, npc.name)) return;
  const tabW = 60 * S;
  (["buy", "sell"] as const).forEach((tab, i) => {
    const tx = x + 12 * S + i * (tabW + 6 * S);
    const ty = y + 16 * S;
    const on = ui.shopTab === tab;
    buttonBox(ctx, tx, ty, tabW, 12 * S, S, {
      on, face: on ? "rgba(202,162,58,.3)" : undefined,
      hover: hovering(p, tx, ty, tabW, 12 * S), accent: on ? CHROME.gold : undefined,
    });
    hudText(hud, tab === "buy" ? "Buy" : "Sell", tx + tabW / 2, ty + 6 * S, 8 * S, on ? "#ffe9a8" : "#cfa86a", "center", true);
    // Switching tab shows a different list; keeping the old offset would open
    // it part-way down, or past its end.
    p.hotspots.push({ x: tx, y: ty, w: tabW, h: 12 * S, fn: () => { ui.shopTab = tab; p.win.scroll = 0; } });
  });
  /* Labelled "carried" on purpose: the HUD counts your chests too, and a shop
   * does not. Without the word, the two numbers disagreeing looks like a bug. */
  hudText(hud, `Your gold (carried): ${player.gold}`, x + w - 12 * S, y + 22 * S, 8 * S, "#ffe9a8", "right");
  const listY = y + 32 * S;
  let ry = listY;
  if (rows.length === 0) {
    hudText(hud, ui.shopTab === "buy" ? "Nothing for sale." : "You have nothing to sell here.", x + w / 2, ry + 8 * S, 8 * S, "rgba(220,214,190,.5)", "center");
  }
  if (rows.length > count) {
    scrollBar(p, x + w - (SCROLLBAR_W + 4) * S, listY, count * rowH, rows.length, count, first);
  }
  for (const e of rows.slice(first, first + count)) {
    const price = ui.shopTab === "buy" ? e.buy : e.sell;
    const have = bagCount(player.bag, e.kind);
    const canDo = ui.shopTab === "buy" ? player.gold >= price : have > 0;
    if (hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S) && canDo) {
      ctx.fillStyle = "rgba(202,162,58,.15)";
      ctx.fillRect(x + 4 * S, ry, w - 8 * S, rowH - 2 * S);
    }
    const spr = itemSprite(e.kind);
    icon(p, spr, x + 10 * S, ry + (rowH - iconH(spr, 2 * S)) / 2, 2 * S);
    hudText(hud, ITEMS[e.kind].name, x + 34 * S, ry + 8 * S, 8 * S, canDo ? "#f3eedd" : "#8a8070", "left", true);
    if (ui.shopTab === "sell") hudText(hud, `you have ${have}`, x + 34 * S, ry + 18 * S, 7 * S, "rgba(220,214,190,.55)");
    hudText(hud, `${price}g`, x + w - 14 * S, ry + rowH / 2, 9 * S, canDo ? "#ffe9a8" : "#d96a5a", "right");
    if (canDo) {
      const kind = e.kind;
      const ryy = ry;
      p.hotspots.push({
        x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S,
        fn: () => (ui.shopTab === "buy" ? p.act.buy(kind) : p.act.sell(kind)),
      });
    }
    ry += rowH;
  }
  hudText(hud, "Click a row to trade one · [Esc] to leave", x + w / 2, y + h - 9 * S, 7 * S, "rgba(220,214,190,.6)", "center");
}

/* ---------------- Quests ---------------- */

function drawQuests(p: PanelInput): void {
  const { hud } = p;
  const { ctx, scale: S } = hud;
  const w = 320 * S;
  const rowH = 40 * S;
  const h = 20 * S + quests.length * rowH + 16 * S;
  const { x, y } = anchor(p, w, h);
  if (!goldPanel(p, x, y, w, h, "QUEST LOG")) return;
  let ry = y + 18 * S;
  for (const q of quests) {
    const need = q.goal.kind === "build" ? 1 : q.goal.need;
    const prog = Math.min(q.progress, need);
    const color = q.claimed ? "#7a8a7c" : q.done ? "#9fe8a8" : "#f3eedd";
    hudText(hud, q.title, x + 12 * S, ry + 7 * S, 9 * S, color, "left", true);
    const status = q.claimed ? "claimed" : q.done ? `${prog}/${need} — click to claim!` : `${prog}/${need}`;
    hudText(hud, status, x + w - 12 * S, ry + 7 * S, 8 * S, q.done && !q.claimed ? "#ffe9a8" : "rgba(220,214,190,.7)", "right");
    hudText(hud, q.desc, x + 12 * S, ry + 19 * S, 7 * S, "rgba(220,214,190,.6)");
    const r = q.reward;
    const parts: string[] = [];
    if (r.exp) parts.push(`${r.exp} xp`);
    if (r.gold) parts.push(`${r.gold} gold`);
    if (r.item) parts.push(`${r.itemN ?? 1}x ${ITEMS[r.item].name}`);
    hudText(hud, "Reward: " + parts.join(", "), x + 12 * S, ry + 29 * S, 7 * S, "rgba(202,162,58,.85)");
    ctx.fillStyle = "#3a3222";
    ctx.fillRect(x + 12 * S, ry + rowH - 6 * S, w - 24 * S, 2 * S);
    ctx.fillStyle = q.claimed ? "#5a6a5c" : "#9fe8a8";
    ctx.fillRect(x + 12 * S, ry + rowH - 6 * S, (w - 24 * S) * (prog / need), 2 * S);
    if (q.done && !q.claimed) {
      const id = q.id;
      const ryy = ry;
      p.hotspots.push({ x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S, fn: () => p.act.claim(id) });
    }
    ry += rowH;
  }
}

/* ---------------- Task board (Grizzly Adams tasks) ---------------- */

function rewardText(r: TaskReward): string {
  const parts: string[] = [`${r.points} TP`];
  if (r.gold) parts.push(`${r.gold}g`);
  if (r.exp) parts.push(`${r.exp}xp`);
  if (r.item) parts.push(`${r.itemN ?? 1}x ${ITEMS[r.item].name}`);
  return parts.join(" · ");
}

function drawTasks(p: PanelInput): void {
  const { hud, player } = p;
  const { ctx, scale: S } = hud;
  const active = activeTask();
  const unlocked = TASKS.filter(isTaskUnlocked);
  const lockedCount = TASKS.length - unlocked.length;
  const taskRowH = 28 * S;
  const exRowH = 22 * S;

  const w = 330 * S;
  const headerH = 24 * S;
  const activeH = 48 * S;
  const listLabelH = 12 * S;
  const listH = unlocked.length * taskRowH + (lockedCount > 0 ? 12 * S : 0);
  const exLabelH = 12 * S;
  const exH = EXCHANGES.length * exRowH;
  const h = 18 * S + headerH + activeH + listLabelH + listH + exLabelH + exH + 14 * S;

  const { x, y } = anchor(p, w, h);
  if (!goldPanel(p, x, y, w, h, "TASK BOARD — Grizelda")) return;

  let ry = y + 18 * S;
  // points header
  hudText(hud, `Task Points: ${player.taskPoints}`, x + 12 * S, ry + 6 * S, 9 * S, "#9ad0ff", "left", true);
  hudText(hud, `lifetime ${pointsEarned()}`, x + w - 12 * S, ry + 6 * S, 7 * S, "rgba(220,214,190,.55)", "right");
  ry += headerH;

  // active-task block
  ctx.fillStyle = "rgba(20,30,40,.5)";
  ctx.fillRect(x + 8 * S, ry, w - 16 * S, activeH - 6 * S);
  if (active) {
    const need = active.goal.need;
    const prog = progressOf(active, player.bag);
    const complete = isComplete(active, player.bag);
    const fits = rewardFits(player, active);
    hudText(hud, active.title, x + 14 * S, ry + 9 * S, 9 * S, "#ffe9a8", "left", true);
    hudText(hud, active.desc, x + 14 * S, ry + 20 * S, 6.5 * S, "rgba(220,214,190,.6)");
    ctx.fillStyle = "#2a3a30";
    ctx.fillRect(x + 14 * S, ry + 27 * S, w - 118 * S, 3 * S);
    ctx.fillStyle = complete ? "#9fe8a8" : "#caa15a";
    ctx.fillRect(x + 14 * S, ry + 27 * S, (w - 118 * S) * (prog / need), 3 * S);
    hudText(hud, `${prog}/${need}`, x + 14 * S, ry + 38 * S, 7 * S, complete ? "#9fe8a8" : "#e8dcc0");
    // hand-in button
    const bw = 78 * S, bh = 24 * S, bx = x + w - bw - 10 * S, by = ry + 7 * S;
    const canHand = complete && fits;
    buttonBox(ctx, bx, by, bw, bh, S, {
      face: canHand ? "rgba(52,110,52,.92)" : "rgba(48,48,48,.7)",
      accent: canHand ? "#9fe8a8" : undefined,
      hover: canHand && hovering(p, bx, by, bw, bh),
    });
    const label = canHand ? "HAND IN" : complete ? "bag full" : "in progress";
    hudText(hud, label, bx + bw / 2, by + bh / 2, 8 * S, canHand ? "#eaffea" : "#9a9a9a", "center", true);
    if (canHand) p.hotspots.push({ x: bx, y: by, w: bw, h: bh, fn: () => p.act.handInTask() });
    // abandon
    hudText(hud, "[abandon]", x + 14 * S, ry + activeH - 10 * S, 6.5 * S, "rgba(230,130,110,.85)", "left");
    p.hotspots.push({ x: x + 12 * S, y: ry + activeH - 16 * S, w: 58 * S, h: 12 * S, fn: () => p.act.abandonTask() });
  } else {
    hudText(hud, "No active task.", x + 14 * S, ry + 13 * S, 9 * S, "#e8dcc0", "left", true);
    hudText(hud, "Pick one below to start hunting.", x + 14 * S, ry + 26 * S, 7 * S, "rgba(220,214,190,.6)");
  }
  ry += activeH;

  // available list
  hudText(hud, active ? "AVAILABLE — finish current first" : "AVAILABLE TASKS", x + 12 * S, ry + 6 * S, 7 * S, "rgba(255,233,168,.85)", "left", true);
  ry += listLabelH;
  for (const t of unlocked) {
    const isActive = active?.id === t.id;
    const canAccept = !active;
    if (hovering(p, x + 6 * S, ry, w - 12 * S, taskRowH - 2 * S) && canAccept) {
      ctx.fillStyle = "rgba(202,162,58,.15)";
      ctx.fillRect(x + 6 * S, ry, w - 12 * S, taskRowH - 2 * S);
    }
    const goalTxt = t.goal.kind === "kill"
      ? `Kill ${t.goal.need} ${t.goal.monster}`
      : `Deliver ${t.goal.need} ${ITEMS[t.goal.item].name}`;
    const col = isActive ? "#9fe8a8" : canAccept ? "#f3eedd" : "#8a8070";
    hudText(hud, t.title + (isActive ? "  (active)" : ""), x + 12 * S, ry + 9 * S, 8.5 * S, col, "left", true);
    hudText(hud, goalTxt, x + 12 * S, ry + 19 * S, 6.5 * S, "rgba(220,214,190,.6)");
    hudText(hud, rewardText(t.reward), x + w - 12 * S, ry + 13 * S, 6.5 * S, "rgba(202,162,58,.9)", "right");
    if (canAccept && !isActive) {
      const id = t.id;
      const yy = ry;
      p.hotspots.push({ x: x + 6 * S, y: yy, w: w - 12 * S, h: taskRowH - 2 * S, fn: () => p.act.acceptTask(id) });
    }
    ry += taskRowH;
  }
  if (lockedCount > 0) {
    hudText(hud, `+${lockedCount} more unlock at higher Task Points`, x + w / 2, ry + 6 * S, 6.5 * S, "rgba(200,138,90,.8)", "center");
    ry += 12 * S;
  }

  // point exchange
  hudText(hud, "SPEND POINTS", x + 12 * S, ry + 6 * S, 7 * S, "rgba(154,208,255,.85)", "left", true);
  ry += exLabelH;
  for (const e of EXCHANGES) {
    const can = player.taskPoints >= e.cost;
    if (hovering(p, x + 6 * S, ry, w - 12 * S, exRowH - 2 * S) && can) {
      ctx.fillStyle = "rgba(154,208,255,.12)";
      ctx.fillRect(x + 6 * S, ry, w - 12 * S, exRowH - 2 * S);
    }
    const spr = itemSprite(e.item);
    icon(p, spr, x + 10 * S, ry + (exRowH - iconH(spr, 2 * S)) / 2, 2 * S);
    hudText(hud, `${e.itemN}x ${ITEMS[e.item].name}`, x + 34 * S, ry + 8 * S, 8 * S, can ? "#f3eedd" : "#8a8070", "left", true);
    hudText(hud, e.desc, x + 34 * S, ry + 17 * S, 6 * S, "rgba(220,214,190,.5)");
    hudText(hud, `${e.cost} TP`, x + w - 12 * S, ry + exRowH / 2, 8 * S, can ? "#9ad0ff" : "#d96a5a", "right");
    if (can) {
      const id = e.id;
      const yy = ry;
      p.hotspots.push({ x: x + 6 * S, y: yy, w: w - 12 * S, h: exRowH - 2 * S, fn: () => p.act.buyExchange(id) });
    }
    ry += exRowH;
  }
  hudText(hud, "One task at a time · kills count only while active", x + w / 2, y + h - 8 * S, 6.5 * S, "rgba(220,214,190,.55)", "center");
}

/* ---------------- Storage chest (stash) ---------------- */

/**
 * One grid of container cells — the single renderer behind the backpack, the
 * chest, a corpse and a loot bag on the floor.
 *
 * Clicking a CONTAINER cell always navigates into it instead of running
 * `onClick`. That is Tibia's rule and it is also the only sane one: "use" on
 * a backpack can hardly mean anything but "open it", and without it a pack in
 * a chest would be a box you can see and never look inside.
 */
function drawGrid(
  p: PanelInput,
  slots: Bag,
  gx: number,
  gy: number,
  cols: number,
  cell: number,
  gap: number,
  onClick: (index: number) => void,
  ref?: ContainerRef,
  /**
   * Draw only this many rows.
   *
   * Cells outside the window are skipped ENTIRELY — no hotspot, no drop
   * target. A cell you cannot see must not be able to swallow an item.
   */
  maxRows?: number,
  /** First visible row. Everything above it is scrolled out of sight. */
  firstRow = 0,
): void {
  const { hud } = p;
  const { ctx, scale: S } = hud;
  /* The index a cell CARRIES and the place it is DRAWN come apart the moment
   * the grid scrolls. Everything registered — hotspot, drop target, tooltip —
   * uses the true index `i`; only the position uses the visible one. Getting
   * that backwards silently moves items into the wrong slots. */
  const from = firstRow * cols;
  const cap = maxRows === undefined ? slots.length : Math.min(slots.length, from + maxRows * cols);
  slots.forEach((slot, i) => {
    if (i < from || i >= cap) return;
    const v = i - from;
    const cx = gx + (v % cols) * (cell + gap);
    const cy = gy + Math.floor(v / cols) * (cell + gap);
    const hov = hovering(p, cx, cy, cell, cell);
    slotCell(ctx, cx, cy, cell, cell, S, { hover: hov, accent: slot?.items ? CHROME.gold : undefined });
    if (slot) {
      const spr = itemSprite(slot.kind);
      const dw = iconW(spr, 2 * S);
      const dh = iconH(spr, 2 * S);
      icon(p, spr, cx + (cell - dw) / 2, cy + (cell - dh) / 2 - 2 * S, 2 * S);
      if (slot.n > 1) hudText(hud, `${slot.n}`, cx + cell - 3 * S, cy + cell - 4 * S, 7 * S, "#ffe9a8", "right");
      // a pack shows how full it is, so you can tell your loot bag from your
      // spare without opening either
      if (slot.items) {
        const used = slot.items.filter((q) => q !== null).length;
        hudText(hud, `${used}/${slot.items.length}`, cx + cell / 2, cy + cell - 4 * S, 6 * S,
          used >= slot.items.length ? "#d96a5a" : "rgba(220,214,190,.75)", "center");
      }
      if (hov) { tooltipKind = slot.kind; tooltipStack = slot; }
      const idx = i;
      const kind = slot.kind;
      const nested = isContainer(kind);
      if (ref) p.itemSlots.push({ x: cx, y: cy, w: cell, h: cell, ref, index: idx, kind, n: slot.n });
      p.hotspots.push({
        x: cx, y: cy, w: cell, h: cell,
        fn: () => (p.ui.lookMode ? p.act.look(kind)
          : nested && ref ? p.act.openNested(ref, idx, p.win)
          : onClick(idx)),
      });
    } else if (ref) {
      /* An EMPTY cell is a drop target too.
       *
       * Without this a drag can only ever land on something already there, so
       * the release falls through to "somewhere on this window" — and inside
       * the chest window the backpack grid IS part of the chest window, so
       * dragging chest → bag resolved as chest → chest and quietly did
       * nothing. Storing worked only because the chest happened to be the
       * window under the cursor either way. */
      p.itemSlots.push({ x: cx, y: cy, w: cell, h: cell, ref, index: i, kind: "wood", n: 0 });
    }
  });
}

/** The title bar's "up one level" arrow. Only drawn when there is a way up. */
function navBar(p: PanelInput, x: number, y: number, ref: ContainerRef): void {
  const { ctx, scale: S } = p.hud;
  if (ref.c !== "nested") return;
  const bs = 12 * S;
  const bx = x + 6 * S;
  const by = y + 3 * S;
  const hot = hovering(p, bx, by, bs, bs);
  buttonBox(ctx, bx, by, bs, bs, S, { hover: hot, accent: CHROME.gold });
  hudText(p.hud, "\u25B2", bx + bs / 2, by + bs / 2, 7 * S, "#ffe9a8", "center", true);
  p.hotspots.push({ x: bx, y: by, w: bs, h: bs, fn: () => p.act.navUp(ref, p.win) });
  /* Carve this button OUT of the title bar's drag region.
   *
   * Pressing the title bar starts moving the window, and that happens on
   * pointerdown, before hotspots are ever consulted — so a button drawn on the
   * bar looks perfectly clickable and does nothing but drag the panel. The bar
   * is set by `goldPanel`, which runs first, so trimming it here is enough. */
  const tb = p.win.titleBar;
  if (tb) {
    const cut = bx + bs + 4 * S - tb.x;
    if (cut > 0) { tb.x += cut; tb.w = Math.max(0, tb.w - cut); }
  }
}

/** What to write on a container window's title bar. */
function containerTitle(p: PanelInput, ref: ContainerRef, top: string): string {
  const st = stackAt(ref, p.player);
  return st ? ITEMS[st.kind].name.toUpperCase() : top;
}

/** Where a nested container window says it lives, for the footer hint. */
function containerHome(ref: ContainerRef): string {
  switch (baseOf(ref).c) {
    case "bag": return "in your backpack";
    case "stash": return "in the storage chest";
    case "corpse": return "in the corpse";
    case "ground": return "on the ground";
  }
}

function drawStash(p: PanelInput): void {
  const { hud, player } = p;
  const { ctx, scale: S } = hud;
  const chest = p.ui.stash;
  const inv = chest?.inv;
  if (!chest || !inv) return;
  const cols = 10;
  const cell = 26 * S;
  const gap = 3 * S;
  const gridW = cols * cell + (cols - 1) * gap;
  const stashRows = Math.ceil(inv.length / cols);
  const bagRows = Math.ceil(player.bag.length / cols);
  const w = gridW + 24 * S;
  const headH = 12 * S;
  // Chests are the one structure a player can own several of, so raising one
  // has to happen here rather than in the build panel: the window belongs to a
  // particular chest, which answers "which one?" before it can be asked.
  const chestTier = tierOf(chest);
  const upCost = upgradeCost(chest.key, chestTier);
  const upH = 22 * S;
  const h = 20 * S + headH + stashRows * (cell + gap) + 14 * S + headH + bagRows * (cell + gap) + 10 * S + upH;
  const { x, y } = anchor(p, w, h);
  if (!goldPanel(p, x, y, w, h, "STORAGE CHEST")) return;
  const gx = x + (w - gridW) / 2;
  let gy = y + 18 * S;

  /* The load counts EVERY slot in the chest's tree, not just the top row.
   * A backpack in here costs its own cell plus one per thing inside it —
   * otherwise nesting would turn a 50-slot chest into 800 and the whole
   * 10 / 50 / 100 upgrade ladder would stop being worth building. */
  const used = bagSlotsUsed(inv);
  const full = used >= inv.length;
  hudText(hud, `Chest — click to take  (${used}/${inv.length})`, x + 12 * S, gy + 5 * S, 8 * S,
    full ? "#d96a5a" : "#cfe8d2", "left", true);
  gy += headH;
  const stashRef: ContainerRef = { c: "stash", s: chest };
  const shown = slotsOf(stashRef, player) ?? inv;
  drawGrid(p, shown, gx, gy, cols, cell, gap, (i) => p.act.moveStack(stashRef, i), stashRef);
  gy += stashRows * (cell + gap) + 8 * S;

  ctx.fillStyle = "#6e571f";
  ctx.fillRect(x + 8 * S, gy, w - 16 * S, S);
  gy += 8 * S;

  hudText(hud, "Backpack — click to store", x + 12 * S, gy + 5 * S, 8 * S, "#cfe8d2", "left", true);
  gy += headH;
  drawGrid(p, player.bag, gx, gy, cols, cell, gap, (i) => p.act.moveStack({ c: "bag" }, i), { c: "bag" });
  gy += bagRows * (cell + gap) + 4 * S;

  const roman = "I".repeat(chestTier);
  if (!upCost) {
    hudText(hud, `Tier ${roman} — top tier reached`, x + 12 * S, gy + 8 * S, 8 * S, "#9fe8a8", "left");
    return;
  }
  const canPay = canAfford(player.bag, upCost, homeChests(p.game));
  const bw = 150 * S;
  const bx = x + w - bw - 12 * S;
  const by = gy + 2 * S;
  const bh = 14 * S;
  const hot = hovering(p, bx, by, bw, bh);
  hudText(hud, `Tier ${roman} — ${inv.length} slots`, x + 12 * S, gy + 9 * S, 8 * S, "#cfe8d2", "left");
  buttonBox(ctx, bx, by, bw, bh, S, {
    face: canPay ? (hot ? "rgba(140,200,110,.34)" : "rgba(90,140,70,.24)") : "rgba(60,50,40,.5)",
    accent: canPay ? "#b9e07f" : undefined,
  });
  hudText(hud, `Upgrade to ${"I".repeat(chestTier + 1)}: ${costText(upCost)}`, bx + bw / 2, by + 9 * S, 7 * S,
    canPay ? "#b9e07f" : "#d96a5a", "center", false, bw - 8 * S);
  if (canPay) p.hotspots.push({ x: bx, y: by, w: bw, h: bh, fn: () => p.act.upgrade(chest) });
}

/* ---------------- Wardrobe (outfit dyes) ---------------- */

/**
 * Vesper's dressing room: a live preview of the player plus one dye row per
 * zone (hair / tunic / legs). Clicking a swatch re-tints instantly — the
 * preview IS the player sprite, so it always matches what walks out the door.
 * Outfit SHAPES (loot-box unlocks) plug in here later; for now colors only.
 */
/** Which dye zone the shared palette grid is currently painting. */
let dyeZone: OutfitZone = "primary";

function drawWardrobe(p: PanelInput): void {
  const { hud, player } = p;
  const { ctx, scale: S } = hud;
  const st = outfitState();
  const zones: readonly OutfitZone[] = ["hair", "primary", "secondary", "shoes"];

  // Tibia's layout: preview + zone selector on the left, one shared 19 x 7
  // palette on the right. Three separate 133-swatch rows would never fit.
  const sw = 7 * S;                 // swatch size
  const sg = 1 * S;                 // swatch gap
  const gridW = HUE_STEPS * (sw + sg) - sg;
  const gridH = SAT_ROWS * (sw + sg) - sg;
  const btnW = 46 * S;
  const btnH = 12 * S;
  const previewW = 52 * S;
  const previewH = 58 * S;
  const leftW = Math.max(previewW, btnW);
  const pad = 10 * S;

  const w = leftW + gridW + pad * 3;
  const bodyH = Math.max(previewH + 4 * S + zones.length * (btnH + 3 * S), gridH);
  const h = 20 * S + bodyH + 30 * S;
  const { x, y } = anchor(p, w, h);
  if (!goldPanel(p, x, y, w, h, "WARDROBE — Vesper")) return;

  const top = y + 18 * S;
  const lx = x + pad;

  // live preview: the LPC hero that actually walks around, so the dyes you pick
  // are exactly what you'll wear. Falls back to the baked outfit headless / if
  // the layer sheets fail to load.
  slotCell(ctx, lx, top, previewW, previewH, S);
  const lpc = heroPreviewFrame();
  if (lpc) {
    const psc = Math.max(1, Math.floor((previewH - 6 * S) / 64));
    const dw = 64 * psc, dh = 64 * psc;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lpc, lx + (previewW - dw) / 2, top + (previewH - dh) / 2, dw, dh);
  } else {
    const spr = player.spr;
    const psc = Math.max(1, Math.floor((previewH - 8 * S) / iconH(spr, 1)));
    icon(p, spr, lx + (previewW - iconW(spr, psc)) / 2, top + (previewH - iconH(spr, psc)) / 2, psc);
  }

  // zone selector — the grid paints whichever one is armed
  let by = top + previewH + 4 * S;
  for (const zone of zones) {
    const on = dyeZone === zone;
    buttonBox(ctx, lx, by, btnW, btnH, S, {
      on, face: on ? "rgba(110,87,31,.9)" : undefined,
      hover: hovering(p, lx, by, btnW, btnH), accent: on ? CHROME.gold : undefined,
    });
    hudText(hud, zoneLabels()[zone], lx + btnW / 2, by + btnH / 2, 6.5 * S,
      on ? "#fff4d0" : "#cfe8d2", "center", true);
    const z = zone;
    p.hotspots.push({ x: lx, y: by, w: btnW, h: btnH, fn: () => { dyeZone = z; } });
    by += btnH + 3 * S;
  }

  // the shared palette: 19 hues across, 7 saturation/value rows down
  const gx0 = x + leftW + pad * 2;
  const gy0 = top;
  const cur = st[dyeZone];
  for (let i = 0; i < OUTFIT_COLORS.length; i++) {
    const gx = gx0 + (i % HUE_STEPS) * (sw + sg);
    const gy = gy0 + Math.floor(i / HUE_STEPS) * (sw + sg);
    ctx.fillStyle = OUTFIT_COLORS[i];
    ctx.fillRect(gx, gy, sw, sw);
    if (cur === i) {
      const b = bevelPx(S);
      keyline(ctx, gx - 2 * b, gy - 2 * b, sw + 4 * b, sw + 4 * b, CHROME.goldText, S);
    }
    const ii = i;
    p.hotspots.push({ x: gx, y: gy, w: sw, h: sw, fn: () => p.act.setOutfitColor(dyeZone, ii) });
  }

  // reset to the classic look
  const bw = 90 * S;
  const bh = 13 * S;
  const bx = x + (w - bw) / 2;
  const ry = y + h - 22 * S;
  buttonBox(ctx, bx, ry, bw, bh, S, { hover: hovering(p, bx, ry, bw, bh) });
  hudText(hud, "Classic look", bx + bw / 2, ry + bh / 2, 7 * S, "#e8dcc0", "center", true);
  p.hotspots.push({ x: bx, y: ry, w: bw, h: bh, fn: () => p.act.resetOutfitColors() });
  hudText(hud, "Pick a zone, then a dye — free, any time", x + w / 2, y + h - 6 * S, 6.5 * S, "rgba(220,214,190,.55)", "center");
}
