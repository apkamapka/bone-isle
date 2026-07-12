import "./style.css";
import { VIEW_W, VIEW_H, TILE, GARDEN_RADIUS, GARDEN_HEAL_PER_S } from "./config.ts";
import { moveEntity } from "./world/collision.ts";
import { SPR } from "./gfx/sprites.ts";
import { clamp, dist, rndi } from "./util.ts";
import { playerSpeed, refreshDerived, canCarry, freeCap } from "./entities/player.ts";
import { updateMonsters, MONSTER_DEFS, spawnMonster } from "./entities/monsters.ts";
import { playerAttack, hitDummy, hurtPlayer, grantExp } from "./systems/combat.ts";
import { gatherTick, tickRegrowth } from "./systems/gather.ts";
import { tryPlace, structSprite, structureBonuses, STRUCTS } from "./systems/building.ts";
import { setActiveBonus } from "./systems/derived.ts";
import { useCrystal } from "./systems/crystals.ts";
import { actionSlots } from "./systems/actions.ts";
import { quests, claimQuest, syncCollectQuests } from "./systems/quests.ts";
import { addItem, removeItem, ITEMS, itemWeight, bagCount } from "./items.ts";
import { addFloat, updateFloats, drawFloats } from "./fx.ts";
import { unlockAudio, beep } from "./audio.ts";
import { initInput, moveAxis } from "./input.ts";
import { initTouch, drawJoystick, isTouchDevice } from "./ui/touch.ts";
import { createGame, travelTo, respawnAtHome, type Game } from "./game.ts";
import { saveGame, loadGame } from "./save.ts";
import { drawHud, type HudCtx } from "./ui/hud.ts";
import { drawPanels, type UiState, type Hotspot, type PanelActions, type PanelKind, type PanelWindow } from "./ui/panels.ts";
import type { Vec, World, Corpse } from "./world/types.ts";
import type { EqSlot, ItemKind, Recipe } from "./items.ts";
import type { StructKey } from "./systems/building.ts";

/* ------------------------------------------------------------------
   The full modular prototype: three islands, combat, corpses & loot,
   NPC shops, crafting, spells, quests, mobile controls, and saves.
   ------------------------------------------------------------------ */

const screen = document.createElement("canvas");
screen.style.imageRendering = "pixelated";
document.body.appendChild(screen);
const sctx = screen.getContext("2d", { alpha: false })!;

const view = document.createElement("canvas");
const vctx = view.getContext("2d")!;

/**
 * Responsive sizing. The world renders to `view` at an internal resolution
 * derived from the window aspect ratio (so phones in portrait get a tall,
 * full-screen view instead of a letterboxed 480x320 strip). `screen` is the
 * device-pixel backing store that fills the whole viewport.
 *
 *   VW,VH   internal world-render resolution (px)
 *   vScale  device px per internal world px (world→screen zoom)
 *   scale   HUD unit: device px per design px (HUD/text/button sizing)
 */
let VW = VIEW_W;
let VH = VIEW_H;
let vScale = 2;
let scale = 2;
let touchUI = false;

const DESIGN_W = 480; // reference width the HUD is authored against

function resize(): void {
  const cw = Math.max(1, innerWidth);
  const ch = Math.max(1, innerHeight);
  const dpr = Math.min(devicePixelRatio || 1, 2);

  // CSS px per internal world px. Larger => more zoomed in / chunkier pixels.
  // Tuned so tiles land around 30-40 CSS px on phones and desktops alike.
  const f = clamp(Math.round(Math.min(cw, ch) / 220), 2, 6);
  VW = Math.max(160, Math.ceil(cw / f));
  VH = Math.max(120, Math.ceil(ch / f));
  view.width = VW;
  view.height = VH;

  screen.width = Math.round(cw * dpr);
  screen.height = Math.round(ch * dpr);
  screen.style.width = cw + "px";
  screen.style.height = ch + "px";
  sctx.imageSmoothingEnabled = false;

  vScale = screen.width / VW;          // device px per world px
  scale = screen.width / DESIGN_W;     // HUD design unit
  touchUI = isTouchDevice() || Math.min(cw, ch) < 620;
}
addEventListener("resize", resize);
addEventListener("orientationchange", () => setTimeout(resize, 100));
resize();

const game: Game = loadGame() ?? createGame();
// keep passive structure bonuses (Garden HP) in sync from the start
setActiveBonus(structureBonuses(game.worlds.home));
refreshDerived(game.player);
const P = game.player;
const cam = { x: 0, y: 0 };
let moveMarker: { x: number; y: number; t: number } | null = null;
let waveT = 0;
let saveTimer = 0;
let last = performance.now();

const ui: UiState = { windows: [], placing: null, selSlot: null, loot: null, npc: null, shopTab: "buy", dragging: false };
const mouse = { sx: 0, sy: 0 };
let hotspots: Hotspot[] = [];

const cw = (): World => game.current;
const flash = (t: string, c = "#ffe9a8"): void => addFloat(cw(), P.x, P.y - 30, t, c);

/** Recompute the player's max HP from current owned structures. */
function recomputeBonuses(): void {
  setActiveBonus(structureBonuses(game.worlds.home));
  refreshDerived(P);
}

/* ---------------- window management (multiple panels open at once) ---------------- */

function findWindow(kind: PanelKind): PanelWindow | undefined {
  return ui.windows.find((w) => w.kind === kind);
}
function hasWindow(kind: PanelKind): boolean {
  return ui.windows.some((w) => w.kind === kind);
}

/** A tidy starting offset per panel so a fresh window doesn't bury the others. */
function defaultOffset(kind: PanelKind): { x: number; y: number } {
  const S = scale;
  switch (kind) {
    case "equip": return { x: 0, y: -70 * S };
    case "skills": return { x: 0, y: 80 * S };
    case "bag": return { x: -120 * S, y: 30 * S };
    case "quest": return { x: -30 * S, y: -40 * S };
    case "forge": return { x: 70 * S, y: 10 * S };
    case "build": return { x: -50 * S, y: -20 * S };
    case "stash": return { x: 40 * S, y: 20 * S };
    case "loot": return { x: 60 * S, y: 40 * S };
    default: return { x: 0, y: 0 };
  }
}

function bringToFront(kind: PanelKind): void {
  const i = ui.windows.findIndex((w) => w.kind === kind);
  if (i >= 0 && i < ui.windows.length - 1) {
    const [w] = ui.windows.splice(i, 1);
    ui.windows.push(w);
  }
}

function openWindow(kind: PanelKind): void {
  const existing = findWindow(kind);
  if (existing) { bringToFront(kind); return; }
  // cascade slightly if several windows are already stacked
  const base = defaultOffset(kind);
  const n = ui.windows.length;
  ui.windows.push({
    kind,
    offset: { x: base.x + n * 6 * scale, y: base.y + n * 6 * scale },
    rect: null,
    titleBar: null,
  });
}

function closeWindow(kind: PanelKind): void {
  const i = ui.windows.findIndex((w) => w.kind === kind);
  if (i >= 0) ui.windows.splice(i, 1);
  if (kind === "loot") ui.loot = null;
  if (kind === "shop") ui.npc = null;
  beep(300, 0.05, "sine", 0.04);
}

function toggleWindow(kind: PanelKind): void {
  ui.placing = null;
  if (hasWindow(kind)) closeWindow(kind);
  else openWindow(kind);
}

function togglePanel(which: PanelKind): void {
  toggleWindow(which);
}

/* ---------------- panel actions ---------------- */

const act: PanelActions = {
  startPlacing: (key: StructKey) => { ui.placing = key; closeWindow("build"); },
  useItem: (kind: ItemKind) => {
    const def = ITEMS[kind];
    if (def.crystal) { useCrystalItem(kind); return; }
    if (!removeItem(P.bag, kind, 1)) return;
    if (def.heal) { P.hp = Math.min(P.maxhp, P.hp + def.heal); flash(`+${def.heal} hp`, "#7dff9e"); }
    beep(500, 0.12, "sine", 0.05, 180);
  },
  equipItem: (kind: ItemKind) => {
    const slot = ITEMS[kind].slot;
    if (!slot) return;
    if (!removeItem(P.bag, kind, 1)) return;
    const prev = P.eq[slot];
    P.eq[slot] = kind;
    if (prev) addItem(P.bag, prev, 1);
    refreshDerived(P);
    beep(420, 0.1, "triangle", 0.05);
  },
  unequip: (slot: EqSlot) => {
    const cur = P.eq[slot];
    if (!cur) return;
    if (addItem(P.bag, cur, 1) > 0) { flash("bag full"); return; }
    P.eq[slot] = null;
    refreshDerived(P);
    beep(300, 0.08, "triangle", 0.05);
  },
  craft: (r: Recipe) => {
    // craft requires standing at a Forge; enforced by only opening forge there
    if (craftAt(r)) beep(360, 0.14, "square", 0.05);
  },
  takeLoot: (c: Corpse, index: number) => { takeOne(c, index); },
  takeAllLoot: (c: Corpse) => { takeAll(c); },
  buy: (kind: ItemKind) => { doBuy(kind); },
  sell: (kind: ItemKind) => { doSell(kind); },
  claim: (id: string) => {
    const q = quests.find((x) => x.id === id);
    if (q && claimQuest(P, q, (t) => flash(t, "#ffe9a8"))) beep(560, 0.16, "square", 0.06);
  },
  deposit: (index: number) => { depositToStash(index); },
  withdraw: (index: number) => { withdrawFromStash(index); },
  close: (kind: PanelKind) => { closeWindow(kind); },
};

/* ---------------- storage chest ---------------- */

function depositToStash(index: number): void {
  const slot = P.bag[index];
  if (!slot) return;
  const left = addItem(game.stash, slot.kind, slot.n);
  const moved = slot.n - left;
  if (moved <= 0) { flash("stash full"); return; }
  if (left > 0) slot.n = left;
  else P.bag[index] = null;
  beep(360, 0.06, "sine", 0.04);
}

function withdrawFromStash(index: number): void {
  const slot = game.stash[index];
  if (!slot) return;
  const left = addItem(P.bag, slot.kind, slot.n);
  const moved = slot.n - left;
  if (moved <= 0) { flash("bag full"); return; }
  if (left > 0) slot.n = left;
  else game.stash[index] = null;
  syncCollectQuests(P, (t) => flash(t, "#ffe9a8"));
  beep(440, 0.06, "sine", 0.04);
}

import { craft as craftRecipe } from "./items.ts";
function craftAt(r: Recipe): boolean {
  if (craftRecipe(P.bag, r)) {
    flash(`crafted ${ITEMS[r.out].name}`, "#b9e07f");
    return true;
  }
  return false;
}

/** Trigger action slot `index` (keys 1–6 / on-screen buttons). */
function useAction(index: number): void {
  const slot = actionSlots[index];
  if (!slot) return;
  if (slot.type === "crystal") { useCrystalItem(slot.item); return; }
  // "attack" / "swap" slot types are wired up in a later stage.
}

/** Apply a crystal by kind: Recall travels home, others hit self/target. */
function useCrystalItem(kind: ItemKind): void {
  if (P.dead) return;
  if (kind === "recallCrystal") { doRecall(); return; }
  useCrystal(cw(), P, kind);
}

function doRecall(): void {
  if (P.dead) return;
  if (cw() === game.worlds.home) { flash("already home", "#8ab6ff"); return; }
  if (bagCount(P.bag, "recallCrystal") <= 0) { flash("no recall crystal", "#8ab6ff"); return; }
  removeItem(P.bag, "recallCrystal", 1);
  travelTo(game, "home");
  flash("recalled home", "#c9a6ff");
}

function takeOne(c: Corpse, index: number): void {
  const it = c.items[index];
  if (!it) return;
  if (!canCarry(P, it.kind)) { flash("too heavy"); return; }
  const left = addItem(P.bag, it.kind, it.n);
  const took = it.n - left;
  if (took > 0) {
    syncCollectQuests(P, (t) => flash(t, "#ffe9a8"));
    if (left > 0) it.n = left;
    else c.items.splice(index, 1);
  } else {
    flash("bag full");
  }
  closeCorpseIfEmpty(c);
}

function takeAll(c: Corpse): void {
  if (c.gold > 0) { P.gold += c.gold; c.gold = 0; }
  let heavy = false;
  for (let i = c.items.length - 1; i >= 0; i--) {
    const it = c.items[i];
    const fitByWeight = Math.floor(freeCap(P) / itemWeight(it.kind, 1));
    if (fitByWeight <= 0) { heavy = true; break; }
    const want = Math.min(it.n, fitByWeight);
    const notFitSlots = addItem(P.bag, it.kind, want);
    const moved = want - notFitSlots;
    const remaining = it.n - moved;
    if (remaining > 0) { it.n = remaining; heavy = true; break; }
    c.items.splice(i, 1);
  }
  if (heavy) flash("too heavy");
  syncCollectQuests(P, (t) => flash(t, "#ffe9a8"));
  closeCorpseIfEmpty(c);
}

function closeCorpseIfEmpty(c: Corpse): void {
  if (c.items.length === 0 && c.gold === 0) {
    const w = cw();
    const idx = w.corpses.indexOf(c);
    if (idx >= 0) w.corpses.splice(idx, 1);
    if (ui.loot === c) { ui.loot = null; closeWindow("loot"); }
  }
}

import { SHOPS } from "./entities/npcs.ts";
function doBuy(kind: ItemKind): void {
  if (!ui.npc) return;
  const entry = SHOPS[ui.npc.key].entries.find((e) => e.kind === kind);
  if (!entry || entry.buy <= 0 || P.gold < entry.buy) return;
  if (!canCarry(P, kind)) { flash("too heavy"); return; }
  if (addItem(P.bag, kind, 1) > 0) { flash("bag full"); return; }
  P.gold -= entry.buy;
  beep(440, 0.1, "sine", 0.05);
}
function doSell(kind: ItemKind): void {
  if (!ui.npc) return;
  const entry = SHOPS[ui.npc.key].entries.find((e) => e.kind === kind);
  if (!entry || entry.sell <= 0) return;
  if (!removeItem(P.bag, kind, 1)) return;
  P.gold += entry.sell;
  beep(360, 0.1, "sine", 0.05);
}

/* ---------------- input wiring ---------------- */

function pointInOpenPanel(sx: number, sy: number): boolean {
  for (const win of ui.windows) {
    const r = win.rect;
    if (r && sx >= r.x && sx < r.x + r.w && sy >= r.y && sy < r.y + r.h) return true;
  }
  return false;
}

function handleWorldTap(sx: number, sy: number): void {
  unlockAudio();
  // hotspots are collected during draw; the topmost window's are last, so
  // check them first (reverse) to respect z-order on overlapping panels.
  for (let i = hotspots.length - 1; i >= 0; i--) {
    const hsp = hotspots[i];
    if (sx >= hsp.x && sx < hsp.x + hsp.w && sy >= hsp.y && sy < hsp.y + hsp.h) {
      hsp.fn();
      return;
    }
  }
  // clicking anywhere on an open panel body (not a hotspot) is swallowed so it
  // doesn't walk the player; panels stay open (Tibia-style) until you close them.
  if (pointInOpenPanel(sx, sy)) return;
  const w: Vec = { x: sx / vScale + cam.x, y: sy / vScale + cam.y };
  if (ui.placing) {
    if (cw() === game.worlds.home) {
      if (tryPlace(game.worlds.home, P, ui.placing, w.x, w.y, game.stash)) recomputeBonuses();
    }
    ui.placing = null;
    return;
  }
  worldClick(w);
}

initInput(screen, {
  toWorld: (sx, sy): Vec => ({ x: sx / vScale + cam.x, y: sy / vScale + cam.y }),
  onMove: (sx, sy) => { mouse.sx = sx; mouse.sy = sy; },
  onPanel: togglePanel,
  onSpell: (i) => useAction(i),
  onEscape: () => {
    if (ui.placing) { ui.placing = null; return; }
    // close the top-most open panel, one press at a time
    const top = ui.windows[ui.windows.length - 1];
    if (top) closeWindow(top.kind);
  },
  onClick: ({ sx, sy, button }) => {
    if (button === 2) {
      // right-click: pure "walk here", ignore targets (Tibia-style)
      if (P.dead || ui.dragging) return;
      if (ui.placing) return;
      // don't walk when the click lands on an open panel
      if (pointInOpenPanel(sx, sy)) return;
      const w: Vec = { x: sx / vScale + cam.x, y: sy / vScale + cam.y };
      P.dest = { x: w.x, y: w.y };
      P.target = null; P.gather = null;
      moveMarker = { x: w.x, y: w.y, t: 0.5 };
      return;
    }
    handleWorldTap(sx, sy);
  },
});
if (isTouchDevice()) initTouch(screen, handleWorldTap, overTouchButton);

// Right-click: suppress the browser's context menu so it never interrupts play.
screen.addEventListener("contextmenu", (e) => e.preventDefault());

// Drag any open panel by grabbing its title bar (works with mouse, pen, touch).
let drag: { win: PanelWindow; gx: number; gy: number; ox: number; oy: number; baseX: number; baseY: number; w: number; h: number } | null = null;
const toScreen = (e: PointerEvent): { x: number; y: number } => {
  const r = screen.getBoundingClientRect();
  const kx = r.width ? screen.width / r.width : 1;
  const ky = r.height ? screen.height / r.height : 1;
  return { x: (e.clientX - r.left) * kx, y: (e.clientY - r.top) * ky };
};
screen.addEventListener("pointerdown", (e) => {
  const s = toScreen(e);
  // search top-most first so the visually-front window wins the grab
  for (let i = ui.windows.length - 1; i >= 0; i--) {
    const win = ui.windows[i];
    const tb = win.titleBar;
    const pr = win.rect;
    if (!tb || !pr) continue;
    if (s.x >= tb.x && s.x < tb.x + tb.w && s.y >= tb.y && s.y < tb.y + tb.h) {
      bringToFront(win.kind);
      drag = { win, gx: s.x, gy: s.y, ox: win.offset.x, oy: win.offset.y, baseX: pr.x - win.offset.x, baseY: pr.y - win.offset.y, w: pr.w, h: pr.h };
      ui.dragging = true;
      try { screen.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
      e.preventDefault();
      return;
    }
  }
});
screen.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const s = toScreen(e);
  let nx = drag.ox + (s.x - drag.gx);
  let ny = drag.oy + (s.y - drag.gy);
  // keep at least a strip of the panel on screen so it stays grabbable
  const keep = 60 * scale;
  const left = clamp(drag.baseX + nx, keep - drag.w, screen.width - keep);
  const top = clamp(drag.baseY + ny, 0, screen.height - 20 * scale);
  nx = left - drag.baseX;
  ny = top - drag.baseY;
  drag.win.offset.x = nx;
  drag.win.offset.y = ny;
  e.preventDefault();
});
const endDrag = (): void => { drag = null; ui.dragging = false; };
addEventListener("pointerup", endDrag);
addEventListener("pointercancel", endDrag);

function worldClick(w: Vec): void {
  if (P.dead) return;
  const world = cw();
  // monsters
  for (const m of world.monsters) {
    if (Math.abs(w.x - m.x) < 9 && w.y > m.y - 16 && w.y < m.y + 5) {
      P.target = { kind: "mob", m };
      P.dest = null; P.gather = null; moveMarker = null;
      return;
    }
  }
  // corpses
  for (const c of world.corpses) {
    if (Math.abs(w.x - c.x) < 10 && Math.abs(w.y - c.y) < 8) {
      P.target = { kind: "corpse", c };
      P.dest = null; P.gather = null; moveMarker = null;
      return;
    }
  }
  // NPCs
  for (const n of world.npcs) {
    if (Math.abs(w.x - n.x) < 9 && w.y > n.y - 16 && w.y < n.y + 5) {
      P.target = { kind: "npc", n };
      P.dest = null; P.gather = null; moveMarker = null;
      return;
    }
  }
  // structures (dummy to hit, forge/chest to use).
  // Sprites are drawn centered on the 2x2 pad, bottom at ty*TILE + 2*TILE,
  // so the hitbox must use that same anchor (generously sized).
  for (const s of world.structures) {
    const cx = s.tx * TILE + TILE;        // pad center x
    const baseY = s.ty * TILE + TILE * 2; // sprite base y
    if (Math.abs(w.x - cx) < 16 && w.y > baseY - 30 && w.y < baseY + 4) {
      if (s.key === "dummy" || s.key === "dummyII") P.target = { kind: "dummy", s };
      else if (s.key === "garden") { continue; } // walk-through: ignore clicks
      else P.target = { kind: "structure", s };
      P.dest = null; P.gather = null; moveMarker = null;
      return;
    }
  }
  // trees
  for (const tr of world.trees) {
    if (tr.stump) continue;
    const cx = tr.tx * TILE + TILE / 2;
    if (Math.abs(w.x - cx) < 8 && w.y > tr.ty * TILE + TILE - 27 && w.y < tr.ty * TILE + TILE + 2) {
      P.gather = { kind: "tree", obj: tr };
      P.target = null; P.dest = null; moveMarker = null;
      return;
    }
  }
  // rocks
  for (const rk of world.rocks) {
    if (rk.depleted) continue;
    const cx = rk.tx * TILE + TILE / 2;
    const cy = rk.ty * TILE + TILE / 2;
    if (Math.abs(w.x - cx) < 8 && Math.abs(w.y - cy) < 8) {
      P.gather = { kind: "rock", obj: rk };
      P.target = null; P.dest = null; moveMarker = null;
      return;
    }
  }
  // herbs
  for (const hb of world.herbs) {
    if (hb.picked) continue;
    const cx = hb.tx * TILE + TILE / 2;
    const cy = hb.ty * TILE + TILE / 2;
    if (Math.abs(w.x - cx) < 8 && Math.abs(w.y - cy) < 8) {
      P.gather = { kind: "herb", obj: hb };
      P.target = null; P.dest = null; moveMarker = null;
      return;
    }
  }
  // otherwise: walk there
  P.dest = { x: w.x, y: w.y };
  P.target = null; P.gather = null;
  moveMarker = { x: w.x, y: w.y, t: 0.5 };
}

/* ---------------- interaction ranges ---------------- */

function targetPoint(): Vec | null {
  const t = P.target;
  if (!t) return null;
  if (t.kind === "mob") return { x: t.m.x, y: t.m.y };
  if (t.kind === "corpse") return { x: t.c.x, y: t.c.y };
  if (t.kind === "npc") return { x: t.n.x, y: t.n.y };
  // structure: stand just below the sprite base (the pad's lower edge)
  return { x: t.s.tx * TILE + TILE, y: t.s.ty * TILE + TILE * 2 - 2 };
}

function gatherPoint(): Vec | null {
  const g = P.gather;
  if (!g) return null;
  const o = g.obj;
  return { x: o.tx * TILE + TILE / 2, y: o.ty * TILE + TILE / 2 };
}

/* ---------------- update ---------------- */

function checkPortals(): void {
  if (P.tpCd > 0) return;
  for (const pt of cw().portals) {
    if (dist(P.x, P.y, pt.x, pt.y) < 11) {
      travelTo(game, pt.dest);
      return;
    }
  }
}

function update(dt: number): void {
  const world = cw();
  waveT += dt;
  P.tpCd = Math.max(0, P.tpCd - dt);
  P.atkCd = Math.max(0, P.atkCd - dt);
  P.bob += dt;

  // death → respawn countdown
  if (P.dead) {
    P.deadT -= dt;
    if (P.deadT <= 0) respawnAtHome(game);
    updateFloats(dt);
    return;
  }

  // movement: WASD/joystick overrides auto-actions
  const ax = moveAxis();
  if (ax.dx || ax.dy) {
    P.dest = null; P.target = null; P.gather = null;
    const len = Math.hypot(ax.dx, ax.dy) || 1;
    const sp = playerSpeed(P);
    moveEntity(world, P, (ax.dx / len) * sp * dt, (ax.dy / len) * sp * dt);
    if (ax.dx) P.face = ax.dx < 0 ? -1 : 1;
  } else if (P.dest) {
    const d = dist(P.x, P.y, P.dest.x, P.dest.y);
    if (d < 3) P.dest = null;
    else {
      const sp = playerSpeed(P);
      moveEntity(world, P, ((P.dest.x - P.x) / d) * sp * dt, ((P.dest.y - P.y) / d) * sp * dt);
      if (P.dest.x < P.x) P.face = -1; else P.face = 1;
    }
  } else if (P.target) {
    const tp = targetPoint();
    if (tp) {
      const d = dist(P.x, P.y, tp.x, tp.y);
      const reach = P.target.kind === "mob" || P.target.kind === "dummy" ? 15 : 18;
      if (d > reach) {
        const sp = playerSpeed(P);
        moveEntity(world, P, ((tp.x - P.x) / d) * sp * dt, ((tp.y - P.y) / d) * sp * dt);
        if (tp.x < P.x) P.face = -1; else P.face = 1;
      } else {
        resolveTarget();
      }
    }
  } else if (P.gather) {
    const gp = gatherPoint();
    if (gp) {
      const d = dist(P.x, P.y, gp.x, gp.y);
      if (d > 17) {
        const sp = playerSpeed(P);
        moveEntity(world, P, ((gp.x - P.x) / d) * sp * dt, ((gp.y - P.y) / d) * sp * dt);
        if (gp.x < P.x) P.face = -1; else P.face = 1;
      } else if (P.atkCd <= 0 && P.gather) {
        gatherTick(world, P, P.gather, (t) => flash(t, "#ffe9a8"));
      }
    }
  }

  // monsters attack the player (only on dangerous islands)
  if (!world.safe) {
    updateMonsters(world, dt, { x: P.x, y: P.y, dead: P.dead }, (m) => {
      const d = MONSTER_DEFS[m.kind];
      hurtPlayer(world, P, rndi(d.dmg[0], d.dmg[1]));
    });
    // respawns
    for (let i = world.respawns.length - 1; i >= 0; i--) {
      const r = world.respawns[i];
      r.t -= dt;
      if (r.t <= 0) { spawnMonster(world, r.kind); world.respawns.splice(i, 1); }
    }
  }

  // corpse decay
  for (let i = world.corpses.length - 1; i >= 0; i--) {
    world.corpses[i].t -= dt;
    if (world.corpses[i].t <= 0) {
      if (ui.loot === world.corpses[i]) { ui.loot = null; closeWindow("loot"); }
      world.corpses.splice(i, 1);
    }
  }

  // garden aura heal (HP) on home
  for (const s of game.worlds.home.structures) {
    if (s.key === "garden" && cw() === game.worlds.home) {
      const gx = s.tx * TILE + TILE;
      const gy = s.ty * TILE + TILE;
      if (dist(P.x, P.y, gx, gy) < GARDEN_RADIUS) {
        if (P.hp < P.maxhp) P.hp = Math.min(P.maxhp, P.hp + GARDEN_HEAL_PER_S * dt);
      }
    }
  }
  // structure anim
  for (const s of world.structures) { s.anim = (s.anim ?? 0) + dt; if (s.hurtT) s.hurtT = Math.max(0, s.hurtT - dt); }

  tickRegrowth(world, dt, P.x, P.y, true);
  checkPortals();
  updateFloats(dt);
  if (moveMarker) { moveMarker.t -= dt; if (moveMarker.t <= 0) moveMarker = null; }

  // autosave every 5s
  saveTimer += dt;
  if (saveTimer > 5) { saveTimer = 0; saveGame(game); }
}

function resolveTarget(): void {
  const t = P.target;
  if (!t) return;
  if (t.kind === "mob") {
    if (P.atkCd <= 0) { P.atkCd = P.atkRate; if (playerAttack(cw(), P, t.m)) P.target = null; }
  } else if (t.kind === "dummy") {
    if (P.atkCd <= 0) { P.atkCd = P.atkRate; hitDummy(cw(), P, t.s); }
  } else if (t.kind === "corpse") {
    ui.loot = t.c; openWindow("loot"); P.target = null;
  } else if (t.kind === "npc") {
    ui.npc = t.n; ui.shopTab = "buy"; openWindow("shop"); P.target = null;
  } else if (t.kind === "structure") {
    if (t.s.key === "forge") openWindow("forge");
    else if (t.s.key === "chest") openWindow("stash");
    P.target = null;
  }
}

/* ---------------- render ---------------- */

function drawShadow(x: number, y: number, w = 8): void {
  vctx.fillStyle = "rgba(0,0,0,.22)";
  vctx.beginPath();
  vctx.ellipse(x - cam.x, y - cam.y + 1, w, w * 0.4, 0, 0, 6.2832);
  vctx.fill();
}

function drawSprite(spr: HTMLCanvasElement, x: number, y: number, face = 1, bobY = 0): void {
  const dx = Math.round(x - cam.x - spr.width / 2);
  const dy = Math.round(y - cam.y - spr.height + bobY);
  vctx.save();
  if (face < 0) {
    vctx.translate(dx + spr.width, dy);
    vctx.scale(-1, 1);
    vctx.drawImage(spr, 0, 0);
  } else {
    vctx.drawImage(spr, dx, dy);
  }
  vctx.restore();
}

function hpBar(x: number, y: number, frac: number, w = 14): void {
  vctx.fillStyle = "#000";
  vctx.fillRect(Math.round(x - cam.x - w / 2) - 1, Math.round(y - cam.y) - 1, w + 2, 4);
  vctx.fillStyle = "#5d1a14";
  vctx.fillRect(Math.round(x - cam.x - w / 2), Math.round(y - cam.y), w, 2);
  vctx.fillStyle = "#e1483b";
  vctx.fillRect(Math.round(x - cam.x - w / 2), Math.round(y - cam.y), Math.round(w * clamp(frac, 0, 1)), 2);
}

function render(): void {
  const world = cw();
  // camera follows player, clamped to island
  cam.x = clamp(P.x - VW / 2, 0, Math.max(0, world.w * TILE - VW));
  cam.y = clamp(P.y - VH / 2, 0, Math.max(0, world.h * TILE - VH));

  vctx.fillStyle = "#1c6060";
  vctx.fillRect(0, 0, VW, VH);
  // baked terrain
  vctx.drawImage(world.mapCanvas, -Math.round(cam.x), -Math.round(cam.y));

  // animated coastal foam
  vctx.fillStyle = "rgba(200,240,235,.5)";
  for (const cwv of world.coastWater) {
    const sx = cwv.x - cam.x;
    const sy = cwv.y - cam.y;
    if (sx < -TILE || sy < -TILE || sx > VW || sy > VH) continue;
    const a = 0.5 + 0.5 * Math.sin(waveT * 2 + cwv.ph);
    if (a > 0.6) vctx.fillRect(Math.round(sx + 2), Math.round(sy + 6), 6, 1);
  }

  // build pads (home) glow
  if (world === game.worlds.home) {
    for (const b of world.buildSpots) {
      if (b.built) continue;
      const gx = b.tx * TILE - cam.x;
      const gy = b.ty * TILE - cam.y;
      const a = 0.35 + 0.2 * Math.sin(waveT * 3);
      vctx.fillStyle = `rgba(255,220,120,${a})`;
      vctx.fillRect(gx, gy, TILE * 2, TILE * 2);
      vctx.strokeStyle = "rgba(255,235,160,.8)";
      vctx.strokeRect(gx + 0.5, gy + 0.5, TILE * 2 - 1, TILE * 2 - 1);
    }
  }

  // portals (glowing swirl)
  for (const pt of world.portals) {
    const sx = pt.x - cam.x;
    const sy = pt.y - cam.y;
    for (let r = 8; r > 0; r -= 2) {
      const a = 0.15 + 0.12 * Math.sin(waveT * 4 + r);
      vctx.fillStyle = `rgba(150,110,230,${a})`;
      vctx.beginPath();
      vctx.ellipse(sx, sy, r, r * 0.6, 0, 0, 6.2832);
      vctx.fill();
    }
    vctx.fillStyle = "#c9a6ff";
    vctx.fillRect(Math.round(sx) - 1, Math.round(sy - 4 + Math.sin(waveT * 5) * 2), 2, 8);
  }

  // gather nodes: trees, rocks, herbs (sorted by y with actors below)
  type Drawable = { y: number; fn: () => void };
  const drawList: Drawable[] = [];

  for (const tr of world.trees) {
    const bx = tr.tx * TILE + TILE / 2;
    const by = tr.ty * TILE + TILE;
    if (tr.stump) {
      drawList.push({ y: by, fn: () => { drawShadow(bx, by); drawSprite(SPR.stump, bx, by); } });
    } else {
      drawList.push({ y: by, fn: () => {
        drawShadow(bx, by, 6);
        const shake = tr.hurtT > 0 ? Math.round(Math.sin(tr.hurtT * 40) * 1.5) : 0;
        drawSprite(tr.spr, bx + shake, by);
        if (tr.hp < tr.maxhp) hpBar(bx, tr.ty * TILE - 4, tr.hp / tr.maxhp);
      } });
    }
  }
  for (const rk of world.rocks) {
    const bx = rk.tx * TILE + TILE / 2;
    const by = rk.ty * TILE + TILE;
    if (rk.depleted) {
      drawList.push({ y: by, fn: () => { drawShadow(bx, by); drawSprite(SPR.rubble, bx, by); } });
    } else {
      drawList.push({ y: by, fn: () => {
        drawShadow(bx, by);
        const shake = rk.hurtT > 0 ? Math.round(Math.sin(rk.hurtT * 40) * 1.5) : 0;
        drawSprite(SPR.rock, bx + shake, by);
        if (rk.hp < rk.maxhp) hpBar(bx, rk.ty * TILE - 2, rk.hp / rk.maxhp);
      } });
    }
  }
  for (const hb of world.herbs) {
    if (hb.picked) continue;
    const bx = hb.tx * TILE + TILE / 2;
    const by = hb.ty * TILE + TILE;
    drawList.push({ y: by, fn: () => drawSprite(SPR.herb, bx, by) });
  }
  // structures
  for (const s of world.structures) {
    const spr = structSprite(s.key);
    const bx = s.tx * TILE + TILE;
    const by = s.ty * TILE + TILE * 2;
    drawList.push({ y: by, fn: () => {
      drawShadow(bx, by, spr.width / 2);
      const shake = s.hurtT ? Math.round(Math.sin(s.hurtT * 40) * 1.5) : 0;
      drawSprite(spr, bx + shake, by);
      if (s.key === "forge") {
        vctx.fillStyle = `rgba(255,${140 + Math.round(Math.sin(waveT * 8) * 40)},60,.8)`;
        vctx.fillRect(Math.round(bx - cam.x - 2), Math.round(by - cam.y - 6 + Math.sin(waveT * 6)), 2, 2);
      }
    } });
  }
  // corpses
  for (const c of world.corpses) {
    const blink = c.t < 10 ? (Math.sin(waveT * 8) > 0 ? 1 : 0.4) : 1;
    drawList.push({ y: c.y, fn: () => {
      vctx.globalAlpha = blink;
      drawShadow(c.x, c.y);
      drawSprite(SPR.corpse, c.x, c.y + 4);
      vctx.globalAlpha = 1;
    } });
  }
  // NPCs
  for (const n of world.npcs) {
    const bob = Math.sin(waveT * 2 + n.bob) * 1.2;
    drawList.push({ y: n.y, fn: () => {
      drawShadow(n.x, n.y);
      drawSprite(n.spr, n.x, n.y, 1, bob);
      // name tag
      vctx.font = "bold 6px monospace";
      vctx.textAlign = "center";
      vctx.fillStyle = "#000";
      vctx.fillText("!", Math.round(n.x - cam.x) + 1, Math.round(n.y - cam.y - n.spr.height - 3) + 1);
      vctx.fillStyle = "#ffe9a8";
      vctx.fillText("!", Math.round(n.x - cam.x), Math.round(n.y - cam.y - n.spr.height - 3));
    } });
  }
  // monsters
  for (const m of world.monsters) {
    const bob = Math.sin(m.bob) * 1.5;
    drawList.push({ y: m.y, fn: () => {
      drawShadow(m.x, m.y);
      vctx.globalAlpha = m.hurtT > 0 && Math.sin(m.hurtT * 60) > 0 ? 0.5 : 1;
      drawSprite(m.spr, m.x, m.y, 1, bob);
      vctx.globalAlpha = 1;
      hpBar(m.x, m.y - m.spr.height - 4, m.hp / m.maxhp);
    } });
  }
  // player
  const pbob = (P.dest || P.target || P.gather || moveAxisNonZero()) ? Math.sin(P.bob * 10) * 1.2 : 0;
  drawList.push({ y: P.y, fn: () => {
    drawShadow(P.x, P.y);
    vctx.globalAlpha = P.dead ? 0.4 : 1;
    drawSprite(P.spr, P.x, P.y, P.face, pbob);
    vctx.globalAlpha = 1;
  } });

  drawList.sort((a, b) => a.y - b.y);
  for (const d of drawList) d.fn();

  // target reticle
  if (P.target && (P.target.kind === "mob" || P.target.kind === "dummy")) {
    const tp = targetPoint();
    if (tp) {
      const sx = Math.round(tp.x - cam.x);
      const sy = Math.round(tp.y - cam.y);
      vctx.strokeStyle = "#ff5a4a";
      vctx.lineWidth = 1;
      const s = 9;
      for (const [ox, oy, dx, dy] of [[-s, -s, 3, 0], [-s, -s, 0, 3], [s, -s, -3, 0], [s, -s, 0, 3], [-s, s, 3, 0], [-s, s, 0, -3], [s, s, -3, 0], [s, s, 0, -3]] as const) {
        vctx.beginPath();
        vctx.moveTo(sx + ox, sy + oy);
        vctx.lineTo(sx + ox + dx, sy + oy + dy);
        vctx.stroke();
      }
    }
  }
  // gather marker
  if (P.gather) {
    const gp = gatherPoint();
    if (gp) {
      vctx.strokeStyle = "#8ce06a";
      vctx.strokeRect(Math.round(gp.x - cam.x) - 8, Math.round(gp.y - cam.y) - 8, 16, 16);
    }
  }
  // move marker
  if (moveMarker) {
    const a = moveMarker.t / 0.5;
    vctx.strokeStyle = `rgba(255,255,255,${a})`;
    const r = (1 - a) * 6 + 2;
    vctx.beginPath();
    vctx.arc(moveMarker.x - cam.x, moveMarker.y - cam.y, r, 0, 6.2832);
    vctx.stroke();
  }

  // floating text
  drawFloats(vctx, world, cam.x, cam.y);

  // teleport flash
  if (game.tpFlash > 0) {
    vctx.fillStyle = `rgba(255,255,255,${game.tpFlash})`;
    vctx.fillRect(0, 0, VW, VH);
  }

  // scale up to screen
  sctx.drawImage(view, 0, 0, VW, VH, 0, 0, screen.width, screen.height);

  // HUD + panels (screen space)
  const hud: HudCtx = { ctx: sctx, scale, screenW: screen.width, screenH: screen.height, touch: touchUI };
  drawHud(hud, game, P);
  hotspots = [];
  for (const win of ui.windows) { win.rect = null; win.titleBar = null; }
  drawPanels({ hud, ui, game, player: P, mouse, act, hotspots });
  if (touchUI) drawTouchControls();
  drawJoystick(sctx);
}

/** On-screen buttons (panel toggles + action crystals) for touch. */
let touchButtons: { x: number; y: number; w: number; h: number }[] = [];

function tButton(x: number, y: number, s: number, label: string, glyph: string, on: boolean, fn: () => void): void {
  const ctx = sctx;
  ctx.fillStyle = on ? "rgba(202,162,58,.92)" : "rgba(16,26,24,.82)";
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = on ? "#ffe9a8" : "#3d5a50";
  ctx.lineWidth = Math.max(1, scale);
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = on ? "#201a10" : "#e9e2c8";
  ctx.font = `bold ${Math.round(s * 0.42)}px 'Courier New',monospace`;
  ctx.fillText(glyph, x + s / 2, y + s * 0.4);
  ctx.font = `${Math.round(s * 0.2)}px 'Courier New',monospace`;
  ctx.fillText(label, x + s / 2, y + s * 0.82);
  hotspots.push({ x, y, w: s, h: s, fn });
  touchButtons.push({ x, y, w: s, h: s });
}

function drawTouchControls(): void {
  touchButtons = [];
  const bs = clamp(Math.min(screen.width, screen.height) * 0.115, 54, 132);
  const m = bs * 0.16;
  const gap = bs * 0.16;

  // right-edge vertical column of panel toggles
  const btns: [string, string, PanelKind][] = [
    ["Build", "B", "build"],
    ["Skills", "S", "skills"],
    ["Equip", "E", "equip"],
    ["Bag", "I", "bag"],
    ["Quest", "Q", "quest"],
  ];
  const colH = btns.length * bs + (btns.length - 1) * gap;
  let by = clamp((screen.height - colH) / 2, screen.height * 0.14, screen.height - colH - m);
  const bx = screen.width - bs - m;
  for (const [label, glyph, panel] of btns) {
    tButton(bx, by, bs, label, glyph, hasWindow(panel), () => togglePanel(panel));
    by += bs + gap;
  }

  // action buttons (bottom, left of the panel column) — bound crystals
  const sw = bs * 1.05;
  let sxp = screen.width - bs - m - gap - sw;
  const syp = screen.height - bs - m;
  actionSlots.forEach((slot, i) => {
    if (!slot || slot.type !== "crystal") return;
    const item = slot.item;
    const charges = bagCount(P.bag, item);
    const usable = charges > 0;
    const x = sxp;
    sxp -= sw + gap;
    sctx.fillStyle = usable ? "rgba(46,58,54,.92)" : "rgba(24,26,30,.8)";
    sctx.fillRect(x, syp, sw, bs);
    sctx.strokeStyle = usable ? "#caa15a" : "#3a4048";
    sctx.lineWidth = Math.max(1, scale);
    sctx.strokeRect(x + 0.5, syp + 0.5, sw - 1, bs - 1);
    sctx.textAlign = "center";
    sctx.textBaseline = "middle";
    sctx.fillStyle = usable ? "#e9e2c8" : "#7a808a";
    sctx.font = `bold ${Math.round(bs * 0.26)}px 'Courier New',monospace`;
    sctx.fillText(ITEMS[item].name.split(" ")[0], x + sw / 2, syp + bs * 0.38);
    sctx.font = `${Math.round(bs * 0.22)}px 'Courier New',monospace`;
    sctx.fillStyle = usable ? "#ffe9a8" : "#7a808a";
    sctx.fillText(`${i + 1}·${charges}`, x + sw / 2, syp + bs * 0.74);
    const idx = i;
    hotspots.push({ x, y: syp, w: sw, h: bs, fn: () => useAction(idx) });
    touchButtons.push({ x, y: syp, w: sw, h: bs });
  });
}

/** True if a screen point lies on any on-screen button (blocks the joystick). */
function overTouchButton(sx: number, sy: number): boolean {
  for (const b of touchButtons) {
    if (sx >= b.x && sx < b.x + b.w && sy >= b.y && sy < b.y + b.h) return true;
  }
  return pointInOpenPanel(sx, sy);
}

function moveAxisNonZero(): boolean {
  const a = moveAxis();
  return a.dx !== 0 || a.dy !== 0;
}

/* ---------------- main loop ---------------- */

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  if (game.tpFlash > 0) game.tpFlash = Math.max(0, game.tpFlash - dt * 2.2);
  if (game.zoneFlash.t > 0) game.zoneFlash.t -= dt;
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

addEventListener("beforeunload", () => saveGame(game));

// silence unused-import complaints for values referenced only in types/paths
void STRUCTS;
void grantExp;
