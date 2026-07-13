/** All toggleable UI panels. Each draws itself and pushes clickable hotspots. */
import { SPR, itemSprite } from "../gfx/sprites.ts";
import { skills, skillNeed } from "../systems/skills.ts";
import { STRUCTS, STRUCT_KEYS, canAfford, costText } from "../systems/building.ts";
import { RESEARCH, isResearched } from "../systems/tower.ts";
import { TASKS, EXCHANGES, activeTask, isTaskUnlocked, progressOf, isComplete, rewardFits, pointsEarned } from "../systems/tasks.ts";
import type { TaskReward } from "../systems/tasks.ts";
import { ITEMS, RECIPES, canCraftAcross, recipeCostText, bagCount, bestArrow, itemInfoLines } from "../items.ts";
import { carryCap, carriedWeight } from "../entities/player.ts";
import { quests } from "../systems/quests.ts";
import { SHOPS } from "../entities/npcs.ts";
import { hudText, type HudCtx } from "./hud.ts";
import type { Player } from "../entities/player.ts";
import type { StructKey } from "../systems/building.ts";
import type { EqSlot, ItemKind, Recipe } from "../items.ts";
import type { Corpse, Npc } from "../world/types.ts";
import type { Game } from "../game.ts";

export type PanelKind =
  | "build" | "skills" | "equip" | "bag" | "quest"
  | "forge" | "tower" | "loot" | "shop" | "stash" | "tasks";

export interface Hotspot {
  x: number;
  y: number;
  w: number;
  h: number;
  fn: () => void;
}

/** A draggable inventory cell (backpack or chest) recorded during draw. */
export interface ItemSlot {
  x: number;
  y: number;
  w: number;
  h: number;
  src: "bag" | "stash";
  index: number;
  kind: ItemKind;
  n: number;
}

/** One open, draggable window. Multiple can be open at once (z-order = array order). */
export interface PanelWindow {
  kind: PanelKind;
  /** User drag offset from the panel's default anchor. */
  offset: { x: number; y: number };
  /** Panel body rect this frame (screen px); set during draw. */
  rect: { x: number; y: number; w: number; h: number } | null;
  /** Draggable title-bar hitbox this frame (screen px); set during draw. */
  titleBar: { x: number; y: number; w: number; h: number } | null;
}

export interface UiState {
  /** Open windows, back-to-front. The last one is drawn on top and grabs input first. */
  windows: PanelWindow[];
  placing: StructKey | null;
  selSlot: EqSlot | null;
  loot: Corpse | null;
  npc: Npc | null;
  shopTab: "buy" | "sell";
  dragging: boolean;
  /** Look/inspect mode: taps describe items instead of using them. */
  lookMode: boolean;
  /** Item currently shown in the inspect popup, if any. */
  inspect: ItemKind | null;
  /** Quantity chooser for moving/dropping part of a stack. */
  split: { kind: ItemKind; index: number; src: "bag" | "stash"; max: number; n: number; canStore: boolean } | null;
}

export interface PanelActions {
  startPlacing: (key: StructKey) => void;
  useItem: (kind: ItemKind, slotIndex: number) => void;
  equipItem: (kind: ItemKind, slotIndex: number) => void;
  unequip: (slot: EqSlot) => void;
  craft: (r: Recipe) => void;
  research: (id: string) => void;
  buyCrystal: (id: string) => void;
  takeLoot: (c: Corpse, index: number) => void;
  takeAllLoot: (c: Corpse) => void;
  buy: (kind: ItemKind) => void;
  sell: (kind: ItemKind) => void;
  claim: (id: string) => void;
  acceptTask: (id: string) => void;
  abandonTask: () => void;
  handInTask: () => void;
  buyExchange: (id: string) => void;
  moveStack: (src: "bag" | "stash", index: number) => void;
  look: (kind: ItemKind) => void;
  toggleLook: () => void;
  openBag: () => void;
  splitConfirm: (mode: "store" | "take" | "drop") => void;
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
}

function goldPanel(p: PanelInput, x: number, y: number, w: number, h: number, title: string): void {
  const { ctx, scale: S } = p.hud;
  ctx.fillStyle = "rgba(16,12,8,.94)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#caa23a";
  ctx.lineWidth = S;
  ctx.strokeRect(x + S / 2, y + S / 2, w - S, h - S);
  ctx.strokeStyle = "#6e571f";
  ctx.strokeRect(x + 2.5 * S, y + 2.5 * S, w - 5 * S, h - 5 * S);
  ctx.fillStyle = "#caa23a";
  ctx.fillRect(x, y + 13 * S, w, S);
  hudText(p.hud, title, x + w / 2, y + 7 * S, 9 * S, "#ffe9a8", "center", true);
  // grip dots hinting the title bar is draggable
  ctx.fillStyle = "rgba(255,233,168,.5)";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + 6 * S + i * 3 * S, y + 4 * S, S, S);
    ctx.fillRect(x + 6 * S + i * 3 * S, y + 8 * S, S, S);
  }
  p.win.rect = { x, y, w, h };
  // close (X) button in the top-right of the title bar
  const bs = 13 * S;
  const bx = x + w - bs - 2 * S;
  const by = y + (14 * S - bs) / 2;
  // draggable region is the title bar minus the close button
  p.win.titleBar = { x, y, w: w - bs - 6 * S, h: 14 * S };
  ctx.fillStyle = "rgba(160,40,30,.9)";
  ctx.fillRect(bx, by, bs, bs);
  ctx.strokeStyle = "#ffcabf";
  ctx.lineWidth = S;
  ctx.strokeRect(bx + S / 2, by + S / 2, bs - S, bs - S);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(1, 1.4 * S);
  ctx.beginPath();
  ctx.moveTo(bx + 3.5 * S, by + 3.5 * S);
  ctx.lineTo(bx + bs - 3.5 * S, by + bs - 3.5 * S);
  ctx.moveTo(bx + bs - 3.5 * S, by + 3.5 * S);
  ctx.lineTo(bx + 3.5 * S, by + bs - 3.5 * S);
  ctx.stroke();
  const kind = p.win.kind;
  p.hotspots.push({ x: bx - 2 * S, y: by - 2 * S, w: bs + 4 * S, h: bs + 4 * S, fn: () => p.act.close(kind) });
}

function hovering(p: PanelInput, x: number, y: number, w: number, h: number): boolean {
  return p.mouse.sx >= x && p.mouse.sx < x + w && p.mouse.sy >= y && p.mouse.sy < y + h;
}

function icon(p: PanelInput, spr: HTMLCanvasElement, x: number, y: number, sc: number): void {
  p.hud.ctx.imageSmoothingEnabled = false;
  p.hud.ctx.drawImage(spr, x, y, spr.width * sc, spr.height * sc);
}

/** Set each frame by whichever slot the mouse is over; drawn as a hover tooltip. */
let tooltipKind: ItemKind | null = null;

/** A small "Look" toggle in the panel body; taps describe items when it's on. */
function lookToggle(p: PanelInput, x: number, y: number, w: number): void {
  const { ctx, scale: S } = p.hud;
  const bw = 40 * S;
  const bh = 11 * S;
  const bx = x + w - bw - 6 * S;
  const by = y + 15 * S;
  const on = p.ui.lookMode;
  ctx.fillStyle = on ? "rgba(90,161,232,.85)" : "rgba(40,32,20,.9)";
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = on ? "#cfe8ff" : "#6e571f";
  ctx.lineWidth = S;
  ctx.strokeRect(bx + S / 2, by + S / 2, bw - S, bh - S);
  hudText(p.hud, on ? "Look ON" : "Look", bx + bw / 2, by + bh / 2, 7 * S, on ? "#0b2036" : "#cfa86a", "center", true);
  p.hotspots.push({ x: bx - 2 * S, y: by - 2 * S, w: bw + 4 * S, h: bh + 4 * S, fn: () => p.act.toggleLook() });
}

/** Draw the queued hover tooltip (if any) near the cursor, then clear it. */
function drawItemTooltip(base: Omit<PanelInput, "win">): void {
  if (!tooltipKind) return;
  const kind = tooltipKind;
  tooltipKind = null;
  const { ctx, scale: S, screenW, screenH } = base.hud;
  const lines = itemInfoLines(kind);
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
  ctx.fillStyle = "rgba(16,12,8,.96)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#caa23a";
  ctx.lineWidth = S;
  ctx.strokeRect(x + S / 2, y + S / 2, w - S, h - S);
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
  ctx.fillStyle = "rgba(16,12,8,.97)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#caa23a";
  ctx.lineWidth = S;
  ctx.strokeRect(x + S / 2, y + S / 2, w - S, h - S);
  const spr = itemSprite(kind);
  icon(base as PanelInput, spr, x + pad, y + pad, 2 * S);
  hudText(base.hud, title, x + pad + spr.width * 2 * S + 8 * S, y + pad + 8 * S, fs, "#ffe9a8", "left", true);
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
  ctx.fillStyle = "rgba(16,12,8,.98)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#caa23a";
  ctx.lineWidth = S;
  ctx.strokeRect(x + S / 2, y + S / 2, w - S, h - S);
  const spr = itemSprite(sp.kind);
  icon(base as PanelInput, spr, x + 10 * S, y + 8 * S, 2 * S);
  hudText(base.hud, ITEMS[sp.kind].name, x + 10 * S + spr.width * 2 * S + 8 * S, y + 14 * S, 9 * S, "#ffe9a8", "left", true);
  hudText(base.hud, `How many?  (max ${sp.max})`, x + w / 2, y + 34 * S, 7 * S, "rgba(220,214,190,.7)", "center");
  hudText(base.hud, `${sp.n}`, x + w / 2, y + 52 * S, 14 * S, "#ffe9a8", "center", true);

  const clampN = (v: number): number => Math.max(1, Math.min(sp.max, v));
  const stepBtn = (bx: number, by: number, bw: number, label: string, fn: () => void): void => {
    ctx.fillStyle = "rgba(40,32,20,.95)";
    ctx.fillRect(bx, by, bw, 14 * S);
    ctx.strokeStyle = "#6e571f";
    ctx.lineWidth = S;
    ctx.strokeRect(bx + S / 2, by + S / 2, bw - S, 14 * S - S);
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

  const acts: [string, "store" | "take" | "drop"][] = [];
  if (sp.src === "stash") acts.push(["Take", "take"]);
  else { if (sp.canStore) acts.push(["Store", "store"]); acts.push(["Drop", "drop"]); }
  acts.push(["Cancel", "drop"]);
  const aw = (w - 20 * S - (acts.length - 1) * 6 * S) / acts.length;
  let ax = x + 10 * S;
  const ay = y + h - 20 * S;
  for (const [lbl, mode] of acts) {
    const isCancel = lbl === "Cancel";
    const col = isCancel ? "#d08a7a" : lbl === "Drop" ? "#d0a24a" : "#8fd08a";
    ctx.fillStyle = isCancel ? "rgba(60,30,26,.95)" : "rgba(30,44,30,.95)";
    ctx.fillRect(ax, ay, aw, 15 * S);
    ctx.strokeStyle = col;
    ctx.lineWidth = S;
    ctx.strokeRect(ax + S / 2, ay + S / 2, aw - S, 15 * S - S);
    hudText(base.hud, lbl, ax + aw / 2, ay + 7 * S, 8 * S, col, "center", true);
    const capturedMode = mode;
    base.hotspots.push({ x: ax, y: ay, w: aw, h: 15 * S, fn: () => {
      if (isCancel) { base.ui.split = null; return; }
      base.act.splitConfirm(capturedMode);
    } });
    ax += aw + 6 * S;
  }
}

export function drawPanels(base: Omit<PanelInput, "win">): void {
  for (const win of base.ui.windows) {
    const p: PanelInput = { ...base, win };
    switch (win.kind) {
      case "build": drawBuild(p); break;
      case "skills": drawSkills(p); break;
      case "equip": drawEquip(p); break;
      case "bag": drawBag(p); break;
      case "forge": drawForge(p); break;
      case "tower": drawTower(p); break;
      case "loot": drawLoot(p); break;
      case "shop": drawShop(p); break;
      case "quest": drawQuests(p); break;
      case "tasks": drawTasks(p); break;
      case "stash": drawStash(p); break;
      default: break;
    }
  }
  if (base.ui.placing) drawPlacingHint(base);
  drawItemTooltip(base);
  drawInspect(base);
  drawSplit(base);
}

/* ---------------- Build ---------------- */

function drawBuild(p: PanelInput): void {
  const { hud, player } = p;
  const { scale: S, screenW, screenH } = hud;
  const w = 246 * S;
  const rowH = 36 * S;
  const h = 20 * S + STRUCT_KEYS.length * rowH + 22 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "BUILD — choose a structure");
  let ry = y + 18 * S;
  for (const key of STRUCT_KEYS) {
    const def = STRUCTS[key];
    const afford = canAfford(player.bag, def.cost, p.game.stash);
    if (hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S) && afford) {
      hud.ctx.fillStyle = "rgba(202,162,58,.15)";
      hud.ctx.fillRect(x + 4 * S, ry, w - 8 * S, rowH - 2 * S);
    }
    const spr = def.spr;
    const isc = Math.max(1, Math.floor((rowH - 10 * S) / spr.height));
    icon(p, spr, x + 10 * S, ry + (rowH - spr.height * isc) / 2, isc);
    hudText(hud, def.name, x + 48 * S, ry + 9 * S, 10 * S, afford ? "#f3eedd" : "#8a8070", "left", true);
    hudText(hud, costText(def.cost), x + 48 * S, ry + 20 * S, 8 * S, afford ? "#b9e07f" : "#d96a5a");
    hudText(hud, def.desc, x + 48 * S, ry + 29 * S, 7 * S, "rgba(220,214,190,.6)");
    if (afford) {
      const ryy = ry;
      p.hotspots.push({ x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S, fn: () => p.act.startPlacing(key) });
    }
    ry += rowH;
  }
  hudText(hud, "Costs draw from backpack + Storage Chest · [Esc] cancel", x + w / 2, y + h - 10 * S, 7 * S, "rgba(220,214,190,.6)", "center");
}

function drawPlacingHint(p: { hud: HudCtx; ui: UiState }): void {
  const { hud, ui } = p;
  const key = ui.placing;
  if (!key) return;
  hudText(hud, `Placing: ${STRUCTS[key].name} — click a glowing pad ([Esc] to cancel)`, hud.screenW / 2, 18 * hud.scale, 9 * hud.scale, "#9fe8a8", "center", true);
}

/* ---------------- Skills ---------------- */

function drawSkills(p: PanelInput): void {
  const { hud } = p;
  const { scale: S, screenW, screenH } = hud;
  const w = 216 * S;
  const rows = Object.keys(skills) as (keyof typeof skills)[];
  const h = 20 * S + rows.length * 26 * S + 10 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "SKILLS");
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
 * hands flanking the body, ring & legs below, boots at the foot, and a read-only
 * ammo slot showing which arrows a bow would fire. Empty cells keep the diamond.
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
  const { ctx, scale: S, screenW, screenH } = hud;
  const slot = 30 * S;
  const gap = 6 * S;
  const cols = 3;
  const rows = 4;
  const gridW = slot * cols + gap * (cols - 1);
  const w = gridW + 28 * S;
  const h = 20 * S + slot * rows + gap * (rows - 1) + 60 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "EQUIPMENT");
  const gx = x + (w - gridW) / 2;
  const gy = y + 20 * S;
  const ammoKind = bestArrow(player.bag);
  EQ_LAYOUT.forEach((cell, i) => {
    if (cell === null) return;
    const cx = gx + (i % cols) * (slot + gap);
    const cy = gy + Math.floor(i / cols) * (slot + gap);

    if (cell === "backpack") {
      ctx.fillStyle = "rgba(40,32,20,.9)";
      ctx.fillRect(cx, cy, slot, slot);
      ctx.strokeStyle = "#caa23a";
      ctx.lineWidth = S;
      ctx.strokeRect(cx + S / 2, cy + S / 2, slot - S, slot - S);
      const spr = SPR.pack;
      icon(p, spr, cx + (slot - spr.width * 2 * S) / 2, cy + (slot - spr.height * 2 * S) / 2 - 3 * S, 2 * S);
      hudText(hud, "Bag", cx + slot / 2, cy + slot - 5 * S, 6 * S, "rgba(220,214,190,.85)", "center");
      p.hotspots.push({ x: cx, y: cy, w: slot, h: slot, fn: () => p.act.openBag() });
      return;
    }

    if (cell === "ammo") {
      ctx.fillStyle = "rgba(40,32,20,.9)";
      ctx.fillRect(cx, cy, slot, slot);
      ctx.strokeStyle = ammoKind ? "#ffe9a8" : "#6e571f";
      ctx.lineWidth = S;
      ctx.strokeRect(cx + S / 2, cy + S / 2, slot - S, slot - S);
      const spr = ammoKind ? itemSprite(ammoKind) : SPR.arrow;
      ctx.globalAlpha = ammoKind ? 1 : 0.4;
      icon(p, spr, cx + (slot - spr.width * 2 * S) / 2, cy + (slot - spr.height * 2 * S) / 2 - 3 * S, 2 * S);
      ctx.globalAlpha = 1;
      if (ammoKind) {
        const n = bagCount(player.bag, ammoKind);
        hudText(hud, `${n}`, cx + slot - 3 * S, cy + slot - 6 * S, 7 * S, "#ffe9a8", "right");
        if (hovering(p, cx, cy, slot, slot)) tooltipKind = ammoKind;
        const k = ammoKind;
        p.hotspots.push({ x: cx, y: cy, w: slot, h: slot, fn: () => p.act.look(k) });
      }
      hudText(hud, "Ammo", cx + slot / 2, cy + slot - 5 * S, 6 * S, "rgba(220,214,190,.7)", "center");
      return;
    }

    const key = cell;
    const equipped = player.eq[key];
    ctx.fillStyle = "rgba(40,32,20,.9)";
    ctx.fillRect(cx, cy, slot, slot);
    ctx.strokeStyle = equipped ? "#ffe9a8" : "#6e571f";
    ctx.lineWidth = S;
    ctx.strokeRect(cx + S / 2, cy + S / 2, slot - S, slot - S);
    if (equipped) {
      const spr = itemSprite(equipped);
      icon(p, spr, cx + (slot - spr.width * 2 * S) / 2, cy + (slot - spr.height * 2 * S) / 2 - 3 * S, 2 * S);
      if (hovering(p, cx, cy, slot, slot)) tooltipKind = equipped;
      const eqk = equipped;
      p.hotspots.push({ x: cx, y: cy, w: slot, h: slot, fn: () => (p.ui.lookMode ? p.act.look(eqk) : p.act.unequip(key)) });
    } else {
      const spr = SLOT_ICONS[key];
      ctx.globalAlpha = 0.4;
      icon(p, spr, cx + (slot - spr.width * 2 * S) / 2, cy + (slot - spr.height * 2 * S) / 2 - 3 * S, 2 * S);
      ctx.globalAlpha = 1;
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
  const { ctx, scale: S, screenW, screenH } = hud;
  const cols = 4;
  const rows = 4;
  const cell = 32 * S;
  const gap = 4 * S;
  const goldRow = 16 * S;
  const gridW = cols * cell + (cols - 1) * gap;
  const w = gridW + 24 * S;
  const h = 20 * S + goldRow + rows * cell + (rows - 1) * gap + 20 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "BACKPACK");
  lookToggle(p, x, y, w);
  // gold, shown here like any other carried item
  const gx = x + (w - gridW) / 2;
  const coin = SPR.coin;
  icon(p, coin, gx, y + 18 * S, 2 * S);
  hudText(hud, `${player.gold} gold`, gx + coin.width * 2 * S + 6 * S, y + 18 * S + coin.height * S, 8 * S, "#ffe9a8", "left", true);
  const gy = y + 20 * S + goldRow;
  player.bag.forEach((stackSlot, i) => {
    const cx = gx + (i % cols) * (cell + gap);
    const cy = gy + Math.floor(i / cols) * (cell + gap);
    const hov = hovering(p, cx, cy, cell, cell);
    ctx.fillStyle = hov ? "rgba(202,162,58,.18)" : "rgba(40,32,20,.9)";
    ctx.fillRect(cx, cy, cell, cell);
    ctx.strokeStyle = "#6e571f";
    ctx.lineWidth = S;
    ctx.strokeRect(cx + S / 2, cy + S / 2, cell - S, cell - S);
    if (stackSlot) {
      const spr = itemSprite(stackSlot.kind);
      const dw = spr.width * 2 * S;
      const dh = spr.height * 2 * S;
      icon(p, spr, cx + (cell - dw) / 2, cy + (cell - dh) / 2 - 2 * S, 2 * S);
      if (stackSlot.n > 1) hudText(hud, `${stackSlot.n}`, cx + cell - 3 * S, cy + cell - 4 * S, 7 * S, "#ffe9a8", "right");
      if (hov) tooltipKind = stackSlot.kind;
      const def = ITEMS[stackSlot.kind];
      const idx = i;
      const k = stackSlot.kind;
      p.itemSlots.push({ x: cx, y: cy, w: cell, h: cell, src: "bag", index: idx, kind: k, n: stackSlot.n });
      if (p.ui.lookMode) {
        p.hotspots.push({ x: cx, y: cy, w: cell, h: cell, fn: () => p.act.look(k) });
      } else if (def.slot) {
        p.hotspots.push({ x: cx, y: cy, w: cell, h: cell, fn: () => p.act.equipItem(k, idx) });
      } else if (def.heal || def.crystal) {
        p.hotspots.push({ x: cx, y: cy, w: cell, h: cell, fn: () => p.act.useItem(k, idx) });
      } else {
        p.hotspots.push({ x: cx, y: cy, w: cell, h: cell, fn: () => p.act.moveStack("bag", idx) });
      }
    }
  });
  const hint = p.ui.lookMode ? "Look mode — click any item to inspect it" : "Click gear to equip · potion/food to use · Look for stats";
  hudText(hud, hint, x + w / 2, y + h - 9 * S, 7 * S, "rgba(220,214,190,.6)", "center");
}

/* ---------------- Forge (crafting) ---------------- */

function drawForge(p: PanelInput): void {
  const { hud, player } = p;
  const { ctx, scale: S, screenW, screenH } = hud;
  const w = 280 * S;
  const rowH = 26 * S;
  const h = 20 * S + RECIPES.length * rowH + 20 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "FORGE — craft gear");
  const bags = [player.bag, p.game.stash];
  let ry = y + 18 * S;
  for (const r of RECIPES) {
    const ok = canCraftAcross(bags, r);
    if (hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S) && ok) {
      ctx.fillStyle = "rgba(202,162,58,.15)";
      ctx.fillRect(x + 4 * S, ry, w - 8 * S, rowH - 2 * S);
    }
    const spr = itemSprite(r.out);
    icon(p, spr, x + 10 * S, ry + (rowH - spr.height * 2 * S) / 2, 2 * S);
    hudText(hud, ITEMS[r.out].name, x + 34 * S, ry + 8 * S, 9 * S, ok ? "#f3eedd" : "#8a8070", "left", true);
    hudText(hud, recipeCostText(r), x + 34 * S, ry + 18 * S, 7 * S, ok ? "#b9e07f" : "#d96a5a");
    if (ok) {
      const rr = r;
      const ryy = ry;
      p.hotspots.push({ x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S, fn: () => p.act.craft(rr) });
    }
    ry += rowH;
  }
  hudText(hud, "Click a recipe to craft (uses backpack + storage chest)", x + w / 2, y + h - 9 * S, 7 * S, "rgba(220,214,190,.6)", "center");
}

/* ---------------- Alchemy Tower ---------------- */

function drawTower(p: PanelInput): void {
  const { hud, player, game } = p;
  const { ctx, scale: S, screenW, screenH } = hud;
  const w = 300 * S;
  const rowH = 34 * S;
  const h = 20 * S + RESEARCH.length * rowH + 22 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "ALCHEMY TOWER");
  let ry = y + 18 * S;
  for (const r of RESEARCH) {
    const researched = isResearched(r.id);
    const cost = researched ? r.buyCost : r.researchCost;
    const affordable = canAfford(player.bag, cost, game.stash);
    const clickable = affordable; // research or buy both need materials
    if (hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S) && clickable) {
      ctx.fillStyle = "rgba(202,162,58,.15)";
      ctx.fillRect(x + 4 * S, ry, w - 8 * S, rowH - 2 * S);
    }
    const spr = itemSprite(r.crystal);
    icon(p, spr, x + 10 * S, ry + (rowH - spr.height * 2 * S) / 2, 2 * S);
    const owned = bagCount(player.bag, r.crystal);
    hudText(hud, r.name, x + 34 * S, ry + 8 * S, 9 * S, "#f3eedd", "left", true);
    if (researched) {
      hudText(hud, `owned: ${owned}`, x + w - 12 * S, ry + 8 * S, 7 * S, "#e8dcc0", "right");
      hudText(hud, `Buy x${r.buyN}:  ${costText(r.buyCost)}`, x + 34 * S, ry + 19 * S, 7 * S, affordable ? "#b9e07f" : "#d96a5a");
      hudText(hud, r.desc, x + 34 * S, ry + 28 * S, 6.5 * S, "rgba(220,214,190,.5)");
    } else {
      hudText(hud, "LOCKED", x + w - 12 * S, ry + 8 * S, 7 * S, "#c98a5a", "right");
      hudText(hud, `Research:  ${costText(r.researchCost)}`, x + 34 * S, ry + 19 * S, 7 * S, affordable ? "#c9a6ff" : "#d96a5a");
      hudText(hud, r.desc, x + 34 * S, ry + 28 * S, 6.5 * S, "rgba(220,214,190,.5)");
    }
    if (clickable) {
      const id = r.id;
      const ryy = ry;
      const fn = researched ? () => p.act.buyCrystal(id) : () => p.act.research(id);
      p.hotspots.push({ x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S, fn });
    }
    ry += rowH;
  }
  hudText(hud, "Research once to unlock · then buy charges · uses bag + chest", x + w / 2, y + h - 9 * S, 7 * S, "rgba(220,214,190,.6)", "center");
}

/* ---------------- Corpse loot ---------------- */

function drawLoot(p: PanelInput): void {
  const { hud, ui } = p;
  const c = ui.loot;
  if (!c) return;
  const { ctx, scale: S, screenW, screenH } = hud;
  const w = 220 * S;
  const rowH = 22 * S;
  const nRows = c.items.length + (c.gold > 0 ? 1 : 0);
  const h = 20 * S + Math.max(1, nRows) * rowH + 26 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "CORPSE — loot");
  let ry = y + 18 * S;
  if (nRows === 0) {
    hudText(hud, "(empty)", x + w / 2, ry + 8 * S, 8 * S, "rgba(220,214,190,.5)", "center");
    ry += rowH;
  }
  if (c.gold > 0) {
    icon(p, SPR.coin, x + 10 * S, ry + 2 * S, 2 * S);
    hudText(hud, `${c.gold} gold`, x + 34 * S, ry + 8 * S, 9 * S, "#ffe9a8", "left", true);
    ry += rowH;
  }
  c.items.forEach((it, i) => {
    if (hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S)) {
      ctx.fillStyle = "rgba(202,162,58,.15)";
      ctx.fillRect(x + 4 * S, ry, w - 8 * S, rowH - 2 * S);
    }
    const spr = itemSprite(it.kind);
    icon(p, spr, x + 10 * S, ry + 2 * S, 2 * S);
    hudText(hud, `${ITEMS[it.kind].name} x${it.n}`, x + 34 * S, ry + 8 * S, 8 * S, "#f3eedd", "left");
    const idx = i;
    const ryy = ry;
    p.hotspots.push({ x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S, fn: () => p.act.takeLoot(c, idx) });
    ry += rowH;
  });
  const bw = w - 24 * S;
  const by = y + h - 20 * S;
  ctx.fillStyle = "rgba(202,162,58,.25)";
  ctx.fillRect(x + 12 * S, by, bw, 14 * S);
  ctx.strokeStyle = "#caa23a";
  ctx.lineWidth = S;
  ctx.strokeRect(x + 12 * S + S / 2, by + S / 2, bw - S, 14 * S - S);
  hudText(hud, "Take all", x + w / 2, by + 7 * S, 8 * S, "#ffe9a8", "center", true);
  p.hotspots.push({ x: x + 12 * S, y: by, w: bw, h: 14 * S, fn: () => p.act.takeAllLoot(c) });
}

/* ---------------- NPC shop ---------------- */

function drawShop(p: PanelInput): void {
  const { hud, ui, player } = p;
  const npc = ui.npc;
  if (!npc) return;
  const shop = SHOPS[npc.key];
  if (!shop) return;
  const { ctx, scale: S, screenW, screenH } = hud;
  const w = 300 * S;
  const rowH = 24 * S;
  const rows = shop.entries.filter((e) => (ui.shopTab === "buy" ? e.buy > 0 : e.sell > 0));
  const h = 34 * S + Math.max(1, rows.length) * rowH + 24 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, npc.name);
  const tabW = 60 * S;
  (["buy", "sell"] as const).forEach((tab, i) => {
    const tx = x + 12 * S + i * (tabW + 6 * S);
    const ty = y + 16 * S;
    const on = ui.shopTab === tab;
    ctx.fillStyle = on ? "rgba(202,162,58,.3)" : "rgba(40,32,20,.8)";
    ctx.fillRect(tx, ty, tabW, 12 * S);
    ctx.strokeStyle = on ? "#ffe9a8" : "#6e571f";
    ctx.lineWidth = S;
    ctx.strokeRect(tx + S / 2, ty + S / 2, tabW - S, 12 * S - S);
    hudText(hud, tab === "buy" ? "Buy" : "Sell", tx + tabW / 2, ty + 6 * S, 8 * S, on ? "#ffe9a8" : "#cfa86a", "center", true);
    p.hotspots.push({ x: tx, y: ty, w: tabW, h: 12 * S, fn: () => { ui.shopTab = tab; } });
  });
  hudText(hud, `Your gold: ${player.gold}`, x + w - 12 * S, y + 22 * S, 8 * S, "#ffe9a8", "right");
  let ry = y + 32 * S;
  if (rows.length === 0) {
    hudText(hud, ui.shopTab === "buy" ? "Nothing for sale." : "You have nothing to sell here.", x + w / 2, ry + 8 * S, 8 * S, "rgba(220,214,190,.5)", "center");
  }
  for (const e of rows) {
    const price = ui.shopTab === "buy" ? e.buy : e.sell;
    const have = bagCount(player.bag, e.kind);
    const canDo = ui.shopTab === "buy" ? player.gold >= price : have > 0;
    if (hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S) && canDo) {
      ctx.fillStyle = "rgba(202,162,58,.15)";
      ctx.fillRect(x + 4 * S, ry, w - 8 * S, rowH - 2 * S);
    }
    const spr = itemSprite(e.kind);
    icon(p, spr, x + 10 * S, ry + (rowH - spr.height * 2 * S) / 2, 2 * S);
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
  const { ctx, scale: S, screenW, screenH } = hud;
  const w = 320 * S;
  const rowH = 40 * S;
  const h = 20 * S + quests.length * rowH + 16 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "QUEST LOG");
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
  const { ctx, scale: S, screenW, screenH } = hud;
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

  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "TASK BOARD — Grizelda");

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
    const fits = rewardFits(player.bag, active);
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
    ctx.fillStyle = canHand ? "rgba(52,110,52,.92)" : "rgba(48,48,48,.7)";
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = canHand ? "#9fe8a8" : "#556";
    ctx.lineWidth = S;
    ctx.strokeRect(bx + S / 2, by + S / 2, bw - S, bh - S);
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
    icon(p, spr, x + 10 * S, ry + (exRowH - spr.height * 2 * S) / 2, 2 * S);
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

function drawGrid(
  p: PanelInput,
  slots: ReadonlyArray<{ kind: ItemKind; n: number } | null>,
  gx: number,
  gy: number,
  cols: number,
  cell: number,
  gap: number,
  onClick: (index: number) => void,
  src?: "bag" | "stash",
): void {
  const { hud } = p;
  const { ctx, scale: S } = hud;
  slots.forEach((slot, i) => {
    const cx = gx + (i % cols) * (cell + gap);
    const cy = gy + Math.floor(i / cols) * (cell + gap);
    const hov = hovering(p, cx, cy, cell, cell);
    ctx.fillStyle = hov ? "rgba(202,162,58,.18)" : "rgba(40,32,20,.9)";
    ctx.fillRect(cx, cy, cell, cell);
    ctx.strokeStyle = "#6e571f";
    ctx.lineWidth = S;
    ctx.strokeRect(cx + S / 2, cy + S / 2, cell - S, cell - S);
    if (slot) {
      const spr = itemSprite(slot.kind);
      const dw = spr.width * 2 * S;
      const dh = spr.height * 2 * S;
      icon(p, spr, cx + (cell - dw) / 2, cy + (cell - dh) / 2 - 2 * S, 2 * S);
      if (slot.n > 1) hudText(hud, `${slot.n}`, cx + cell - 3 * S, cy + cell - 4 * S, 7 * S, "#ffe9a8", "right");
      if (hov) tooltipKind = slot.kind;
      const idx = i;
      const kind = slot.kind;
      if (src) p.itemSlots.push({ x: cx, y: cy, w: cell, h: cell, src, index: idx, kind, n: slot.n });
      p.hotspots.push({ x: cx, y: cy, w: cell, h: cell, fn: () => (p.ui.lookMode ? p.act.look(kind) : onClick(idx)) });
    }
  });
}

function drawStash(p: PanelInput): void {
  const { hud, player, game } = p;
  const { ctx, scale: S, screenW, screenH } = hud;
  const cols = 5;
  const cell = 30 * S;
  const gap = 4 * S;
  const gridW = cols * cell + (cols - 1) * gap;
  const stashRows = Math.ceil(game.stash.length / cols);
  const bagRows = Math.ceil(player.bag.length / cols);
  const w = gridW + 24 * S;
  const headH = 12 * S;
  const h = 20 * S + headH + stashRows * (cell + gap) + 14 * S + headH + bagRows * (cell + gap) + 10 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "STORAGE CHEST");
  const gx = x + (w - gridW) / 2;
  let gy = y + 18 * S;

  hudText(hud, "Chest — click to take", x + 12 * S, gy + 5 * S, 8 * S, "#cfe8d2", "left", true);
  gy += headH;
  drawGrid(p, game.stash, gx, gy, cols, cell, gap, (i) => p.act.moveStack("stash", i), "stash");
  gy += stashRows * (cell + gap) + 8 * S;

  ctx.fillStyle = "#6e571f";
  ctx.fillRect(x + 8 * S, gy, w - 16 * S, S);
  gy += 8 * S;

  hudText(hud, "Backpack — click to store", x + 12 * S, gy + 5 * S, 8 * S, "#cfe8d2", "left", true);
  gy += headH;
  drawGrid(p, player.bag, gx, gy, cols, cell, gap, (i) => p.act.moveStack("bag", i), "bag");
}
