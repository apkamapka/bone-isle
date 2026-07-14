import "./style.css";
import { VIEW_W, VIEW_H, TILE, GARDEN_RADIUS, GARDEN_HEAL_PER_S, ARROW_MISS_WARN_S, GROUND_DESPAWN_S } from "./config.ts";
import { moveEntity, unstick } from "./world/collision.ts";
import { SPR, itemSprite } from "./gfx/sprites.ts";
import { clamp, dist, rndi } from "./util.ts";
import { playerSpeed, refreshDerived, canCarry, freeCap } from "./entities/player.ts";
import { updateMonsters, MONSTER_DEFS, spawnMonster } from "./entities/monsters.ts";
import { playerAttack, playerShoot, hitDummy, shootDummy, hurtPlayer, grantExp } from "./systems/combat.ts";
import { gatherTick, tickRegrowth } from "./systems/gather.ts";
import { tryPlace, structSprite, structureBonuses, STRUCTS, canAfford, payCost } from "./systems/building.ts";
import { setActiveBonus } from "./systems/derived.ts";
import { useCrystal } from "./systems/crystals.ts";
import { actionSlots, setSlot, BINDABLE_CRYSTALS } from "./systems/actions.ts";
import {
  hudLocked, toggleHudLock, placeHud, moveHudGroup, saveHudLayout, resetHudLayout, loadHudLayout,
  type HudGroup,
} from "./systems/hudLayout.ts";
import { researchById, isResearched, markResearched } from "./systems/tower.ts";
import { quests, claimQuest, syncCollectQuests } from "./systems/quests.ts";
import { acceptTask, abandonTask, handInTask, buyExchange, activeTask } from "./systems/tasks.ts";
import { addItem, removeItem, ITEMS, itemWeight, bagCount, equippedBow, bestArrow, compactBag } from "./items.ts";
import { addFloat, updateFloats, drawFloats } from "./fx.ts";
import { unlockAudio, beep } from "./audio.ts";
import { initInput, moveAxis } from "./input.ts";
import { initTouch, drawJoystick, isTouchDevice } from "./ui/touch.ts";
import { createGame, travelTo, respawnAtHome, type Game } from "./game.ts";
import { saveGame, loadGame } from "./save.ts";
import { drawHud, type HudCtx } from "./ui/hud.ts";
import { drawPanels, type UiState, type Hotspot, type ItemSlot, type PanelActions, type PanelKind, type PanelWindow } from "./ui/panels.ts";
import type { Vec, World, Corpse, GroundItem } from "./world/types.ts";
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
const DESIGN_H = 320; // reference height — on wide desktops this caps HUD/panel size so tall panels fit

function resize(): void {
  const cw = Math.max(1, innerWidth);
  const ch = Math.max(1, innerHeight);
  const dpr = Math.min(devicePixelRatio || 1, 2);

  // Mobile (touch or narrow) keeps the tall, chunky, immersive framing.
  // Desktop zooms out so tiles aren't giant and much more of the island is
  // visible (a classic top-down feel) — HUD sizing is unaffected.
  const mobile = isTouchDevice() || Math.min(cw, ch) < 620;

  // CSS px per internal world px. Larger => more zoomed in / chunkier pixels.
  const f = mobile
    ? clamp(Math.round(Math.min(cw, ch) / 220), 2, 6)   // phones: unchanged
    : clamp(Math.min(cw, ch) / 360, 2, 3.2);            // desktop: wider, finer view
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
  // HUD design unit. On a wide desktop the height is the tight constraint (tall
  // panels must fit), so we take the smaller of the width/height ratios. On a
  // portrait phone width still wins, so mobile sizing is unchanged.
  scale = Math.min(screen.width / DESIGN_W, screen.height / DESIGN_H);
  // The customizable HUD (on-screen buttons, draggable groups, EDIT HUD, rebind
  // picker, quick-swap) is available everywhere — it works with mouse on desktop
  // just as with touch on mobile. Only the world zoom above differs by device.
  touchUI = true;
}
addEventListener("resize", resize);
addEventListener("orientationchange", () => setTimeout(resize, 100));
resize();

loadHudLayout(); // restore any customized mobile HUD positions + lock state

const game: Game = loadGame() ?? createGame();
// keep passive structure bonuses (Garden HP) in sync from the start
setActiveBonus(structureBonuses(game.worlds.home));
refreshDerived(game.player);
// merge any stacks that older saves left fragmented (stack limits grew)
compactBag(game.player.bag); compactBag(game.stash);
const P = game.player;
if (unstick(game.current, P)) { /* freed a player boxed in by an old build */ }
const cam = { x: 0, y: 0 };
let moveMarker: { x: number; y: number; t: number } | null = null;
let waveT = 0;
let saveTimer = 0;
let last = performance.now();

const ui: UiState = { windows: [], placing: null, selSlot: null, loot: null, npc: null, shopTab: "buy", dragging: false, lookMode: false, inspect: null, split: null };
const mouse = { sx: 0, sy: 0 };
let hotspots: Hotspot[] = [];
let itemSlots: ItemSlot[] = [];
// mouse drag-and-drop of inventory items
let suppressClick = false;
let itemDrag: { src: "bag" | "stash"; index: number; kind: ItemKind; n: number; sx: number; sy: number; active: boolean } | null = null;

// mobile HUD customization (Etap 7): rebind picker + group dragging
let assignSlot: number | null = null;
let hudDrag: { id: HudGroup; dx: number; dy: number; moved: boolean } | null = null;
let hudGrips: { id: HudGroup; x: number; y: number; w: number; h: number; gx: number; gy: number }[] = [];
/** True when the mobile HUD is in edit (unlocked) mode. */
function hudEditing(): boolean {
  return touchUI && !hudLocked();
}

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
    case "equip": return { x: 0, y: 0 };
    case "skills": return { x: 0, y: 0 };
    case "bag": return { x: -120 * S, y: 30 * S };
    case "quest": return { x: -30 * S, y: -40 * S };
    case "forge": return { x: 70 * S, y: 10 * S };
    case "tower": return { x: 60 * S, y: -10 * S };
    case "build": return { x: -50 * S, y: -20 * S };
    case "stash": return { x: 40 * S, y: 20 * S };
    case "tasks": return { x: 20 * S, y: -20 * S };
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
    const def = ITEMS[kind];
    const slot = def.slot;
    if (!slot) return;
    if (!removeItem(P.bag, kind, 1)) return;
    const prev = P.eq[slot];
    P.eq[slot] = kind;
    if (prev) addItem(P.bag, prev, 1);
    // Two-handed rule: a bow occupies both hands, so it can't share with a shield.
    if (def.bow && P.eq.shield) { addItem(P.bag, P.eq.shield, 1); P.eq.shield = null; }
    if (slot === "shield" && P.eq.weapon && ITEMS[P.eq.weapon].bow) {
      addItem(P.bag, P.eq.weapon, 1); P.eq.weapon = null;
    }
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
  research: (id: string) => { doResearch(id); },
  buyCrystal: (id: string) => { doBuyCrystal(id); },
  takeLoot: (c: Corpse, index: number) => { takeOne(c, index); },
  takeAllLoot: (c: Corpse) => { takeAll(c); },
  buy: (kind: ItemKind) => { doBuy(kind); },
  sell: (kind: ItemKind) => { doSell(kind); },
  claim: (id: string) => {
    const q = quests.find((x) => x.id === id);
    if (q && claimQuest(P, q, (t) => flash(t, "#ffe9a8"))) beep(560, 0.16, "square", 0.06);
  },
  acceptTask: (id: string) => {
    if (acceptTask(id)) { flash("task accepted", "#9ad0ff"); beep(440, 0.12, "sine", 0.05, 120); }
    else flash("finish your current task first", "#e0a06a");
  },
  abandonTask: () => {
    const a = activeTask();
    if (a) { abandonTask(); flash("task abandoned", "#e0a06a"); beep(240, 0.1, "triangle", 0.05, -80); }
  },
  handInTask: () => {
    const res = handInTask(P, (xp) => grantExp(cw(), P, xp));
    if (res) {
      flash(`+${res.reward.points} TP · task done!`, "#9fe8a8");
      beep(560, 0.18, "square", 0.06, 140);
    } else flash("not ready to hand in", "#e0a06a");
  },
  buyExchange: (id: string) => {
    const r = buyExchange(P, id);
    if (r === "ok") { flash("bought with Task Points", "#9ad0ff"); beep(440, 0.12, "sine", 0.05); }
    else if (r === "poor") flash("not enough Task Points", "#d96a5a");
    else if (r === "full") flash("no room in bag", "#e0a06a");
  },
  moveStack: (src: "bag" | "stash", index: number) => { openMoveChooser(src, index); },
  splitConfirm: (mode: "store" | "take" | "drop") => { splitConfirm(mode); },
  look: (kind: ItemKind) => { ui.inspect = kind; },
  toggleLook: () => { ui.lookMode = !ui.lookMode; if (!ui.lookMode) ui.inspect = null; },
  openBag: () => { openWindow("bag"); },
  close: (kind: PanelKind) => { closeWindow(kind); },
};

/* ---------------- storage chest ---------------- */

/** Store up to `n` of bag slot `index` into the chest. */
function storePartial(index: number, n: number): void {
  const slot = P.bag[index];
  if (!slot) return;
  const take = Math.min(n, slot.n);
  const left = addItem(game.stash, slot.kind, take);
  const moved = take - left;
  if (moved <= 0) { flash("stash full"); return; }
  slot.n -= moved;
  if (slot.n <= 0) P.bag[index] = null;
  compactBag(game.stash); compactBag(P.bag);
  beep(360, 0.06, "sine", 0.04);
}

/** Drop an item stack onto the ground at the player's feet (Tibia-style). */
function dropToGround(kind: ItemKind, n: number): void {
  if (n <= 0) return;
  const world = cw();
  const jitter = () => (Math.random() - 0.5) * 8;
  const gx = P.x + jitter();
  const gy = P.y + 2 + jitter();
  // merge into a very close stack of the same kind to avoid clutter
  const near = world.ground.find((g) => g.kind === kind && Math.hypot(g.x - gx, g.y - gy) < 7);
  if (near) near.n += n;
  else world.ground.push({ kind, n, x: gx, y: gy, t: GROUND_DESPAWN_S });
  flash(`dropped ${n} ${ITEMS[kind].name}`, "#cfa86a");
  beep(200, 0.06, "sine", 0.04, -60);
}

/** Pick a dropped stack back up, as far as weight/space allow. */
function pickupGround(gi: GroundItem): void {
  const world = cw();
  const fitByWeight = Math.floor(freeCap(P) / itemWeight(gi.kind, 1));
  if (fitByWeight <= 0) { flash("too heavy"); return; }
  const want = Math.min(gi.n, fitByWeight);
  const left = addItem(P.bag, gi.kind, want) + (gi.n - want);
  const took = gi.n - left;
  if (took <= 0) { flash("bag full"); return; }
  compactBag(P.bag);
  syncCollectQuests(P, (t) => flash(t, "#ffe9a8"));
  if (left > 0) gi.n = left;
  else { const idx = world.ground.indexOf(gi); if (idx >= 0) world.ground.splice(idx, 1); }
  beep(520, 0.06, "sine", 0.05, 80);
}

/** Take up to `n` of chest slot `index` into the backpack (weight-limited). */
function takePartial(index: number, n: number): void {
  const slot = game.stash[index];
  if (!slot) return;
  const wantByN = Math.min(n, slot.n);
  const fitByWeight = Math.floor(freeCap(P) / itemWeight(slot.kind, 1));
  const want = Math.min(wantByN, Math.max(0, fitByWeight));
  if (want <= 0) { flash("too heavy"); return; }
  const left = addItem(P.bag, slot.kind, want);
  const moved = want - left;
  if (moved <= 0) { flash("bag full"); return; }
  slot.n -= moved;
  if (slot.n <= 0) game.stash[index] = null;
  compactBag(P.bag); compactBag(game.stash);
  syncCollectQuests(P, (t) => flash(t, "#ffe9a8"));
  beep(440, 0.06, "sine", 0.04);
}

/** Drop up to `n` of bag slot `index` on the ground. */
function dropFromBag(index: number, n: number): void {
  const slot = P.bag[index];
  if (!slot) return;
  const take = Math.min(n, slot.n);
  slot.n -= take;
  if (slot.n <= 0) P.bag[index] = null;
  compactBag(P.bag);
  dropToGround(slot.kind, take);
}

type Slots = (({ kind: ItemKind; n: number }) | null)[];
/** Rearrange within one container: fill empty, merge like kinds, else swap. */
function swapOrMerge(arr: Slots, from: number, to: number): void {
  if (from === to) return;
  const a = arr[from];
  if (!a) return;
  const b = arr[to];
  if (!b) { arr[to] = a; arr[from] = null; return; }
  if (b.kind === a.kind) {
    const space = ITEMS[a.kind].stack - b.n;
    const mv = Math.min(space, a.n);
    b.n += mv; a.n -= mv;
    if (a.n <= 0) arr[from] = null;
  } else {
    arr[from] = b; arr[to] = a;
  }
}
const currentN = (src: "bag" | "stash", index: number): number => {
  const s = (src === "bag" ? P.bag : game.stash)[index];
  return s ? s.n : 0;
};

/** Resolve where a dragged item was released: slot, chest window, or ground. */
function resolveItemDrop(rx: number, ry: number): void {
  const d = itemDrag;
  if (!d) return;
  // dropped onto another inventory cell?
  for (let i = itemSlots.length - 1; i >= 0; i--) {
    const it = itemSlots[i];
    if (rx >= it.x && rx < it.x + it.w && ry >= it.y && ry < it.y + it.h) {
      if (it.src === d.src) swapOrMerge(d.src === "bag" ? P.bag : game.stash, d.index, it.index);
      else if (d.src === "bag") storePartial(d.index, currentN("bag", d.index));
      else takePartial(d.index, currentN("stash", d.index));
      return;
    }
  }
  // dropped on an open panel (chest window → store), otherwise cancel
  if (pointInOpenPanel(rx, ry)) {
    const overStash = ui.windows.some((w) => w.kind === "stash" && w.rect &&
      rx >= w.rect.x && rx < w.rect.x + w.rect.w && ry >= w.rect.y && ry < w.rect.y + w.rect.h);
    if (overStash && d.src === "bag") storePartial(d.index, currentN("bag", d.index));
    return;
  }
  // dropped on the world → drop to the ground (backpack items only)
  if (d.src === "bag") dropFromBag(d.index, currentN("bag", d.index));
}

/** Open the quantity chooser for a bag/chest slot (or move a single item flat). */
function openMoveChooser(src: "bag" | "stash", index: number): void {
  const slot = src === "bag" ? P.bag[index] : game.stash[index];
  if (!slot) return;
  const canStore = ui.windows.some((w) => w.kind === "stash");
  // one item, single obvious action → skip the chooser
  if (slot.n <= 1) {
    if (src === "stash") { takePartial(index, 1); return; }
    if (canStore) { storePartial(index, 1); return; }
    dropFromBag(index, 1); return;
  }
  ui.split = { kind: slot.kind, index, src, max: slot.n, n: slot.n, canStore };
}

function splitConfirm(mode: "store" | "take" | "drop"): void {
  const sp = ui.split;
  if (!sp) return;
  const n = Math.max(1, Math.min(sp.max, sp.n));
  if (mode === "store") storePartial(sp.index, n);
  else if (mode === "take") takePartial(sp.index, n);
  else dropFromBag(sp.index, n);
  ui.split = null;
}

import { craftAcross } from "./items.ts";
function craftAt(r: Recipe): boolean {
  if (craftAcross([P.bag, game.stash], r)) {
    flash(`crafted ${ITEMS[r.out].name}`, "#b9e07f");
    return true;
  }
  return false;
}

function doResearch(id: string): void {
  const r = researchById(id);
  if (!r || isResearched(r.id)) return;
  if (!canAfford(P.bag, r.researchCost, game.stash)) { flash("need materials"); return; }
  payCost(P.bag, r.researchCost, game.stash);
  markResearched(r.id);
  flash(`researched ${r.name}`, "#c9a6ff");
  beep(520, 0.18, "square", 0.06, 120);
}

function doBuyCrystal(id: string): void {
  const r = researchById(id);
  if (!r || !isResearched(r.id)) return;
  if (!canAfford(P.bag, r.buyCost, game.stash)) { flash("need materials"); return; }
  if (!canCarry(P, r.crystal, r.buyN)) { flash("too heavy"); return; }
  const moved = r.buyN - addItem(P.bag, r.crystal, r.buyN);
  if (moved < r.buyN) { if (moved > 0) removeItem(P.bag, r.crystal, moved); flash("bag full"); return; }
  payCost(P.bag, r.buyCost, game.stash);
  flash(`+${r.buyN} ${ITEMS[r.crystal].name}`, "#b9e07f");
  beep(440, 0.12, "sine", 0.05, 120);
}

/** Trigger action slot `index` (keys 1–6 / on-screen buttons). */
function useAction(index: number): void {
  const slot = actionSlots[index];
  if (!slot) return;
  if (slot.type === "crystal") { useCrystalItem(slot.item); return; }
  if (slot.type === "swap") { swapWeapon(); return; }
  // "attack" slot type is reserved for a future basic-attack binding.
}

/**
 * Quick weapon swap: toggles the equipped weapon between a bow and a melee
 * weapon, pulling the best matching spare from the backpack. Reuses the normal
 * equip path so the two-handed bow↔shield rule and bag stow-away still apply.
 */
function swapWeapon(): void {
  if (P.dead) return;
  const cur = P.eq.weapon;
  const curIsBow = cur ? !!ITEMS[cur].bow : false;
  const wantBow = !curIsBow; // if a bow is on, swap to melee; otherwise swap to a bow
  let pick: ItemKind | null = null;
  for (const s of P.bag) {
    if (!s) continue;
    const d = ITEMS[s.kind];
    if (d.slot !== "weapon") continue;
    if (!!d.bow === wantBow && (!pick || d.value > ITEMS[pick].value)) pick = s.kind;
  }
  if (!pick) { flash(wantBow ? "no bow in bag" : "no melee weapon in bag", "#e0a06a"); return; }
  act.equipItem(pick, 0); // removes from bag, equips, stows the previous weapon
  flash(`equipped ${ITEMS[pick].name}`, "#b9e07f");
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
  const shop = SHOPS[ui.npc.key];
  if (!shop) return;
  const entry = shop.entries.find((e) => e.kind === kind);
  if (!entry || entry.buy <= 0 || P.gold < entry.buy) return;
  if (!canCarry(P, kind)) { flash("too heavy"); return; }
  if (addItem(P.bag, kind, 1) > 0) { flash("bag full"); return; }
  P.gold -= entry.buy;
  beep(440, 0.1, "sine", 0.05);
}
function doSell(kind: ItemKind): void {
  if (!ui.npc) return;
  const shop = SHOPS[ui.npc.key];
  if (!shop) return;
  const entry = shop.entries.find((e) => e.kind === kind);
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
  // in HUD edit mode only hotspots (slots / lock / reset / picker) act — no walking
  if (hudEditing()) return;
  // an open inspect popup is dismissed by tapping empty space
  if (ui.inspect) { ui.inspect = null; return; }
  if (ui.split) { ui.split = null; return; }
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
  onLook: () => {
    ui.lookMode = !ui.lookMode;
    if (!ui.lookMode) ui.inspect = null;
    flash(ui.lookMode ? "look mode on" : "look mode off", "#8ab6ff");
  },
  onEscape: () => {
    if (assignSlot !== null) { assignSlot = null; return; }
    if (ui.split) { ui.split = null; return; }
    if (ui.inspect) { ui.inspect = null; return; }
    if (ui.placing) { ui.placing = null; return; }
    // close the top-most open panel, one press at a time
    const top = ui.windows[ui.windows.length - 1];
    if (top) closeWindow(top.kind);
  },
  onClick: ({ sx, sy, button }) => {
    if (suppressClick) return;
    if (button === 2) {
      // right-click: pure "walk here", ignore targets (Tibia-style)
      if (P.dead || ui.dragging) return;
      if (ui.placing) return;
      // don't walk when the click lands on an open panel
      if (pointInOpenPanel(sx, sy)) return;
      const w: Vec = { x: sx / vScale + cam.x, y: sy / vScale + cam.y };
      P.dest = { x: w.x, y: w.y };
      P.gather = null;
      // keep a ranged attack target so right-click "walk here" doubles as kiting
      const keepShot = !!P.target
        && (P.target.kind === "mob" || P.target.kind === "dummy")
        && attackMode().ranged;
      if (!keepShot) P.target = null;
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
  // mobile HUD edit: grab a group's drag grip to reposition it
  if (hudEditing()) {
    for (const g of hudGrips) {
      if (s.x >= g.x && s.x < g.x + g.w && s.y >= g.y && s.y < g.y + g.h) {
        hudDrag = { id: g.id, dx: s.x - g.gx, dy: s.y - g.gy, moved: false };
        ui.dragging = true;
        suppressClick = true;
        try { screen.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
        e.preventDefault();
        return;
      }
    }
  }
  // item drag-and-drop (mouse only; touch uses the quantity chooser)
  if (e.pointerType === "mouse" && e.button === 0 && !ui.lookMode && !ui.split && !ui.inspect) {
    for (let i = itemSlots.length - 1; i >= 0; i--) {
      const it = itemSlots[i];
      if (s.x >= it.x && s.x < it.x + it.w && s.y >= it.y && s.y < it.y + it.h) {
        itemDrag = { src: it.src, index: it.index, kind: it.kind, n: it.n, sx: s.x, sy: s.y, active: false };
        suppressClick = true; // the item's click is resolved on release instead
        try { screen.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
        return;
      }
    }
  }
});
screen.addEventListener("pointermove", (e) => {
  if (itemDrag) {
    const s = toScreen(e);
    mouse.sx = s.x; mouse.sy = s.y;
    if (!itemDrag.active && Math.hypot(s.x - itemDrag.sx, s.y - itemDrag.sy) > 5 * scale) itemDrag.active = true;
    e.preventDefault();
    return;
  }
  if (hudDrag) {
    const s = toScreen(e);
    hudDrag.moved = true;
    moveHudGroup(hudDrag.id, s.x - hudDrag.dx, s.y - hudDrag.dy, screen.width, screen.height);
    e.preventDefault();
    return;
  }
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
addEventListener("pointerup", (e) => {
  if (hudDrag) {
    saveHudLayout();
    hudDrag = null;
    ui.dragging = false;
    setTimeout(() => { suppressClick = false; }, 0);
    return;
  }
  if (itemDrag) {
    const s = toScreen(e as PointerEvent);
    if (itemDrag.active) resolveItemDrop(s.x, s.y);
    else handleWorldTap(itemDrag.sx, itemDrag.sy); // no real drag → treat as a click
    itemDrag = null;
    // clear the click suppression after this gesture completes
    setTimeout(() => { suppressClick = false; }, 0);
  }
  endDrag();
});
addEventListener("pointercancel", () => { hudDrag = null; itemDrag = null; suppressClick = false; endDrag(); });

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
  // dropped ground items — pick up on click
  for (const gi of world.ground) {
    if (Math.abs(w.x - gi.x) < 9 && w.y > gi.y - 14 && w.y < gi.y + 4) {
      pickupGround(gi);
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

/**
 * How the player engages a monster right now. A bow with arrows shoots from
 * afar (its own reach); anything else closes to melee range. A bow with no
 * arrows falls back to a melee poke so you're never fully stuck.
 */
function attackMode(): { ranged: boolean; reach: number; arrow: ItemKind | null } {
  const bow = equippedBow(P.eq);
  if (bow) {
    const arrow = bestArrow(P.bag);
    if (arrow) return { ranged: true, reach: bow.range, arrow };
  }
  return { ranged: false, reach: 15, arrow: null };
}

let noArrowWarnT = 0;
function warnNoArrows(): void {
  if (noArrowWarnT > 0) return;
  noArrowWarnT = ARROW_MISS_WARN_S;
  flash("no arrows", "#ff9e6a");
}

/**
 * Fire the currently-kept ranged target when it's within reach and the attack is
 * off cooldown. Runs every frame while kiting, independent of movement, so you
 * can walk away and still loose arrows. Faces the target and drops it on death.
 */
function tickRangedFire(mode: { ranged: boolean; reach: number; arrow: ItemKind | null }): void {
  const t = P.target;
  if (!t || !mode.arrow) return;
  if (t.kind === "mob") {
    const m = t.m;
    // let go of a target that has died or left the current island
    if (m.hp <= 0 || !cw().monsters.includes(m)) { P.target = null; return; }
    P.face = m.x < P.x ? -1 : 1;
    if (dist(P.x, P.y, m.x, m.y) <= mode.reach && P.atkCd <= 0) {
      P.atkCd = P.atkRate;
      if (playerShoot(cw(), P, m, mode.arrow)) P.target = null;
    }
  } else if (t.kind === "dummy") {
    const tp = targetPoint();
    if (!tp) return;
    P.face = tp.x < P.x ? -1 : 1;
    if (dist(P.x, P.y, tp.x, tp.y) <= mode.reach && P.atkCd <= 0) {
      P.atkCd = P.atkRate;
      shootDummy(cw(), P, t.s, mode.arrow);
    }
  }
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

  // With a bow equipped (and arrows), an attack target is a "kite" target:
  // it survives manual movement so you can shoot and run (Tibia-style).
  const mode = attackMode();
  const kiting = !!P.target
    && (P.target.kind === "mob" || P.target.kind === "dummy")
    && mode.ranged;

  // movement: WASD/joystick overrides auto-actions
  const ax = moveAxis();
  if (ax.dx || ax.dy) {
    P.dest = null; P.gather = null;
    if (!kiting) P.target = null; // melee movement still drops the target
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
  } else if (P.target && !kiting) {
    // melee / walk-up targets: approach then act (unchanged behaviour)
    const tp = targetPoint();
    if (tp) {
      const d = dist(P.x, P.y, tp.x, tp.y);
      let reach = 18;
      if (P.target.kind === "dummy" || P.target.kind === "mob") reach = mode.reach;
      if (d > reach) {
        const sp = playerSpeed(P);
        moveEntity(world, P, ((tp.x - P.x) / d) * sp * dt, ((tp.y - P.y) / d) * sp * dt);
        if (tp.x < P.x) P.face = -1; else P.face = 1;
      } else {
        resolveTarget();
      }
    }
  } else if (kiting) {
    // idle bowman: only close the gap if the target drifted out of range
    const tp = targetPoint();
    if (tp) {
      const d = dist(P.x, P.y, tp.x, tp.y);
      if (d > mode.reach) {
        const sp = playerSpeed(P);
        moveEntity(world, P, ((tp.x - P.x) / d) * sp * dt, ((tp.y - P.y) / d) * sp * dt);
        if (tp.x < P.x) P.face = -1; else P.face = 1;
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

  // Ranged fire pass: with a bow, keep shooting the kept target whenever it's in
  // range and off cooldown — whether we're standing still or kiting on the move.
  if (kiting) tickRangedFire(mode);

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

  // dropped items fade from the ground after their lifetime (1h)
  for (let i = world.ground.length - 1; i >= 0; i--) {
    world.ground[i].t -= dt;
    if (world.ground[i].t <= 0) world.ground.splice(i, 1);
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

  // arrows in flight (cosmetic — the hit already landed when fired)
  if (noArrowWarnT > 0) noArrowWarnT = Math.max(0, noArrowWarnT - dt);
  for (let i = world.shots.length - 1; i >= 0; i--) {
    const sh = world.shots[i];
    sh.p += dt / sh.dur;
    if (sh.p >= 1) world.shots.splice(i, 1);
  }

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
    if (P.atkCd <= 0) {
      P.atkCd = P.atkRate;
      const mode = attackMode();
      if (mode.ranged && mode.arrow) {
        if (playerShoot(cw(), P, t.m, mode.arrow)) P.target = null;
      } else {
        if (equippedBow(P.eq)) warnNoArrows();
        if (playerAttack(cw(), P, t.m)) P.target = null;
      }
    }
  } else if (t.kind === "dummy") {
    if (P.atkCd <= 0) {
      P.atkCd = P.atkRate;
      const mode = attackMode();
      if (mode.ranged && mode.arrow) shootDummy(cw(), P, t.s, mode.arrow);
      else { if (equippedBow(P.eq)) warnNoArrows(); hitDummy(cw(), P, t.s); }
    }
  } else if (t.kind === "corpse") {
    ui.loot = t.c; openWindow("loot"); P.target = null;
  } else if (t.kind === "npc") {
    if (t.n.key === "taskmaster") { openWindow("tasks"); }
    else { ui.npc = t.n; ui.shopTab = "buy"; openWindow("shop"); }
    P.target = null;
  } else if (t.kind === "structure") {
    if (t.s.key === "forge") openWindow("forge");
    else if (t.s.key === "tower") openWindow("tower");
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

  // portals — a glowing swirl between islands, a ladder between cave floors
  for (const pt of world.portals) {
    const sx = pt.x - cam.x;
    const sy = pt.y - cam.y;
    if (pt.style) {
      const lw = SPR.ladder.width;
      const lh = SPR.ladder.height;
      vctx.drawImage(SPR.ladder, Math.round(sx - lw / 2), Math.round(sy - lh / 2));
      const down = pt.style === "ladderDown";
      const dir = down ? 1 : -1;
      const ay = down ? sy + lh / 2 + 3 : sy - lh / 2 - 3;
      vctx.fillStyle = down ? "#e6b25a" : "#a6e6c4";
      vctx.beginPath();
      vctx.moveTo(sx - 3, ay);
      vctx.lineTo(sx + 3, ay);
      vctx.lineTo(sx, ay + dir * 3);
      vctx.closePath();
      vctx.fill();
      continue;
    }
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
  // dropped items on the ground
  for (const gi of world.ground) {
    const blink = gi.t < 30 ? (Math.sin(waveT * 8) > 0 ? 1 : 0.45) : 1;
    const spr = itemSprite(gi.kind);
    drawList.push({ y: gi.y, fn: () => {
      vctx.globalAlpha = blink;
      drawShadow(gi.x, gi.y, 6);
      const px = Math.round(gi.x - cam.x - spr.width / 2);
      const py = Math.round(gi.y - cam.y - spr.height);
      vctx.imageSmoothingEnabled = false;
      vctx.drawImage(spr, px, py);
      if (gi.n > 1) {
        vctx.font = "bold 6px monospace";
        vctx.textAlign = "right";
        vctx.fillStyle = "#000";
        vctx.fillText(`${gi.n}`, px + spr.width + 1, py + spr.height + 1);
        vctx.fillStyle = "#ffe9a8";
        vctx.fillText(`${gi.n}`, px + spr.width, py + spr.height);
      }
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

  // arrows in flight — drawn above the sorted scene since they arc overhead
  for (const sh of world.shots) {
    const t = sh.p < 1 ? sh.p : 1;
    const cx = sh.fromX + (sh.toX - sh.fromX) * t;
    const cy = sh.fromY + (sh.toY - sh.fromY) * t - Math.sin(t * Math.PI) * 6;
    const ang = Math.atan2(sh.toY - sh.fromY, sh.toX - sh.fromX);
    const dx = Math.cos(ang) * 3;
    const dy = Math.sin(ang) * 3;
    const px = Math.round(cx - cam.x);
    const py = Math.round(cy - cam.y);
    vctx.strokeStyle = sh.bone ? "#efe9d6" : "#cfd8da";
    vctx.lineWidth = 1;
    vctx.beginPath();
    vctx.moveTo(px - dx, py - dy);
    vctx.lineTo(px + dx, py + dy);
    vctx.stroke();
  }

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
  itemSlots = [];
  for (const win of ui.windows) { win.rect = null; win.titleBar = null; }
  drawPanels({ hud, ui, game, player: P, mouse, act, hotspots, itemSlots });
  // ghost of the item being dragged, following the cursor
  if (itemDrag && itemDrag.active) {
    const spr = itemSprite(itemDrag.kind);
    const gw = spr.width * 2 * scale;
    const gh = spr.height * 2 * scale;
    sctx.imageSmoothingEnabled = false;
    sctx.globalAlpha = 0.85;
    sctx.drawImage(spr, Math.round(mouse.sx - gw / 2), Math.round(mouse.sy - gh / 2), gw, gh);
    sctx.globalAlpha = 1;
    if (itemDrag.n > 1) {
      sctx.font = `bold ${7 * scale}px monospace`;
      sctx.textAlign = "right";
      sctx.fillStyle = "#000";
      sctx.fillText(`${currentN(itemDrag.src, itemDrag.index)}`, Math.round(mouse.sx + gw / 2) + 1, Math.round(mouse.sy + gh / 2) + 1);
      sctx.fillStyle = "#ffe9a8";
      sctx.fillText(`${currentN(itemDrag.src, itemDrag.index)}`, Math.round(mouse.sx + gw / 2), Math.round(mouse.sy + gh / 2));
    }
  }
  if (touchUI) drawTouchControls();
  drawJoystick(sctx);
  drawAssignPicker();
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

/** Tap an action slot: bind it in edit mode, otherwise trigger it. */
function slotTap(i: number): void {
  if (hudEditing()) { assignSlot = i; beep(360, 0.05, "sine", 0.04); }
  else useAction(i);
}

/** A flat rectangular HUD button with a single label. Registers a hotspot. */
function hudBtn(x: number, y: number, w: number, h: number, label: string, on: boolean, fn: () => void): void {
  const ctx = sctx;
  ctx.fillStyle = on ? "rgba(202,162,58,.92)" : "rgba(16,26,24,.85)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = on ? "#ffe9a8" : "#3d5a50";
  ctx.lineWidth = Math.max(1, scale);
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = on ? "#201a10" : "#e9e2c8";
  ctx.font = `bold ${Math.round(h * 0.42)}px 'Courier New',monospace`;
  ctx.fillText(label, x + w / 2, y + h / 2);
  hotspots.push({ x, y, w, h, fn });
  touchButtons.push({ x, y, w, h });
}

/** One action slot (crystal / swap / empty) in the mobile action bar. */
function drawActionSlot(i: number, x: number, y: number, w: number, h: number): void {
  const slot = actionSlots[i];
  const ctx = sctx;
  let label = "", sub = "", usable = false;
  if (slot?.type === "crystal") {
    const charges = bagCount(P.bag, slot.item);
    usable = charges > 0;
    label = ITEMS[slot.item].name.split(" ")[0];
    sub = `${i + 1}·${charges}`;
  } else if (slot?.type === "swap") {
    usable = true;
    label = "SWAP";
    sub = `${i + 1}`;
  } else {
    label = hudEditing() ? "+" : "";
    sub = hudEditing() ? "bind" : `${i + 1}`;
  }
  ctx.fillStyle = usable ? "rgba(46,58,54,.92)" : "rgba(24,26,30,.8)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = hudEditing() ? "#8ab6ff" : usable ? "#caa15a" : "#3a4048";
  ctx.lineWidth = Math.max(1, scale);
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = usable ? "#e9e2c8" : hudEditing() ? "#8ab6ff" : "#7a808a";
  ctx.font = `bold ${Math.round(h * 0.26)}px 'Courier New',monospace`;
  ctx.fillText(label, x + w / 2, y + h * 0.38);
  ctx.font = `${Math.round(h * 0.2)}px 'Courier New',monospace`;
  ctx.fillStyle = usable ? "#ffe9a8" : "#7a808a";
  ctx.fillText(sub, x + w / 2, y + h * 0.74);
  const idx = i;
  hotspots.push({ x, y, w, h, fn: () => slotTap(idx) });
  touchButtons.push({ x, y, w, h });
}

/** Edit-mode outline + a drag handle (grip) for a movable HUD group. */
function drawGroupGrip(id: HudGroup, gx: number, gy: number, gw: number, gh: number): void {
  const ctx = sctx;
  ctx.strokeStyle = "rgba(138,182,255,.9)";
  ctx.lineWidth = Math.max(1, scale);
  ctx.setLineDash([4 * scale, 3 * scale]);
  ctx.strokeRect(gx + 0.5, gy + 0.5, gw - 1, gh - 1);
  ctx.setLineDash([]);
  const bs = clamp(Math.min(screen.width, screen.height) * 0.115, 54, 132);
  const w = Math.min(gw, bs * 0.9);
  const h = bs * 0.34;
  let y = gy - h - 3 * scale;
  if (y < 2 * scale) y = gy + gh + 3 * scale;
  ctx.fillStyle = "rgba(138,182,255,.92)";
  ctx.fillRect(gx, y, w, h);
  ctx.fillStyle = "#0d1622";
  for (let d = 0; d < 3; d++) ctx.fillRect(gx + w / 2 - 6 * scale + d * 5 * scale, y + h / 2 - 0.5 * scale, 3 * scale, scale);
  hudGrips.push({ id, x: gx, y, w, h, gx, gy });
}

function drawTouchControls(): void {
  touchButtons = [];
  hudGrips = [];
  const editing = hudEditing();
  const bs = clamp(Math.min(screen.width, screen.height) * 0.115, 54, 132);
  const m = bs * 0.16;
  const gap = bs * 0.16;
  const sw = screen.width, sh = screen.height;

  // --- panel-button column (group "panels") ---
  const pbtns: [string, string, PanelKind][] = [
    ["Build", "B", "build"], ["Skills", "S", "skills"], ["Equip", "E", "equip"], ["Bag", "I", "bag"], ["Quest", "Q", "quest"],
  ];
  const colH = pbtns.length * bs + (pbtns.length - 1) * gap;
  const panelPos = placeHud("panels", bs, colH, sw, sh);
  let by = panelPos.y;
  for (const [label, glyph, panel] of pbtns) {
    tButton(panelPos.x, by, bs, label, glyph, hasWindow(panel), () => togglePanel(panel));
    by += bs + gap;
  }
  if (editing) drawGroupGrip("panels", panelPos.x, panelPos.y, bs, colH);

  // --- action slots: six independently-placeable squares (group "slot0..5") ---
  const sw6 = bs * 0.92;
  for (let i = 0; i < 6; i++) {
    if (!editing && !actionSlots[i]) continue; // keep the play HUD tidy — empty slots only show in edit mode
    const gid = `slot${i}` as HudGroup;
    const pos = placeHud(gid, sw6, bs, sw, sh);
    drawActionSlot(i, pos.x, pos.y, sw6, bs);
    if (editing) drawGroupGrip(gid, pos.x, pos.y, sw6, bs);
  }

  // --- quick weapon-swap button (group "swap") ---
  const swW = bs * 1.15, swH = bs * 0.62;
  const swapPos = placeHud("swap", swW, swH, sw, sh);
  const bowOn = P.eq.weapon ? !!ITEMS[P.eq.weapon].bow : false;
  hudBtn(swapPos.x, swapPos.y, swW, swH, bowOn ? "→MELEE" : "→BOW", false, () => { if (!editing) swapWeapon(); });
  if (editing) drawGroupGrip("swap", swapPos.x, swapPos.y, swW, swH);

  // --- lock / edit toggle: sits just above the vitals (HP) frame, bottom-left ---
  const vw = 190 * scale, vh = 54 * scale;
  const vp = placeHud("vitals", vw, vh, sw, sh);
  if (editing) drawGroupGrip("vitals", vp.x, vp.y, vw, vh);
  const lockW = bs * 1.6, lockH = bs * 0.5;
  const gripClear = bs * 0.34 + 6 * scale; // leave room for the vitals drag grip in edit mode
  const lockX = clamp(vp.x, m, sw - lockW - m);
  const lockY = clamp(vp.y - lockH - gripClear, m, sh - lockH - m);
  hudBtn(lockX, lockY, lockW, lockH, editing ? "LOCK HUD" : "EDIT HUD", editing, () => {
    toggleHudLock();
    flash(hudLocked() ? "HUD locked" : "HUD unlocked — drag handles, tap slots", "#8ab6ff");
  });
  if (editing) {
    hudBtn(lockX + lockW + gap * 0.5, lockY, lockW, lockH, "RESET", false, () => {
      resetHudLayout();
      flash("HUD layout reset", "#8ab6ff");
    });
    const hy = clamp(lockY - lockH * 0.6, m, sh - m);
    sctx.textAlign = "left";
    sctx.textBaseline = "middle";
    sctx.fillStyle = "rgba(207,232,210,.85)";
    sctx.font = `${Math.round(9 * scale)}px 'Courier New',monospace`;
    sctx.fillText("drag handles · tap a slot to bind", lockX, hy);
  }
}

/** The rebind picker overlay: choose what an action slot triggers. */
function drawAssignPicker(): void {
  if (assignSlot === null) return;
  const slotIdx = assignSlot;
  const ctx = sctx;
  const S = scale;
  const sw = screen.width, sh = screen.height;
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(0, 0, sw, sh);
  // full-screen scrim closes the picker (pushed first, so rows below take priority)
  hotspots.push({ x: 0, y: 0, w: sw, h: sh, fn: () => { assignSlot = null; } });

  const rows: { label: string; sub: string; fn: () => void }[] = [];
  for (const k of BINDABLE_CRYSTALS) {
    rows.push({
      label: ITEMS[k].name, sub: `${bagCount(P.bag, k)} charges`,
      fn: () => { setSlot(slotIdx, { type: "crystal", item: k }); assignSlot = null; saveGame(game); },
    });
  }
  rows.push({ label: "Swap Weapon", sub: "toggle bow / melee", fn: () => { setSlot(slotIdx, { type: "swap" }); assignSlot = null; saveGame(game); } });
  rows.push({ label: "Clear slot", sub: "leave empty", fn: () => { setSlot(slotIdx, null); assignSlot = null; saveGame(game); } });

  const w = clamp(sw * 0.66, 220 * S, 420 * S);
  const rowH = 30 * S;
  const h = 26 * S + rows.length * rowH + 10 * S;
  const x = (sw - w) / 2, y = (sh - h) / 2;
  ctx.fillStyle = "rgba(16,20,24,.97)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#caa23a";
  ctx.lineWidth = Math.max(1, S);
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffe9a8";
  ctx.font = `bold ${Math.round(11 * S)}px 'Courier New',monospace`;
  ctx.fillText(`Bind slot ${slotIdx + 1}`, x + w / 2, y + 14 * S);
  let ry = y + 26 * S;
  for (const r of rows) {
    ctx.fillStyle = "rgba(40,52,60,.92)";
    ctx.fillRect(x + 6 * S, ry + 2 * S, w - 12 * S, rowH - 4 * S);
    ctx.strokeStyle = "#3d5a50";
    ctx.strokeRect(x + 6 * S + 0.5, ry + 2 * S + 0.5, w - 12 * S - 1, rowH - 4 * S - 1);
    ctx.textAlign = "left";
    ctx.fillStyle = "#f3eedd";
    ctx.font = `bold ${Math.round(9 * S)}px 'Courier New',monospace`;
    ctx.fillText(r.label, x + 16 * S, ry + rowH * 0.4);
    ctx.fillStyle = "rgba(220,214,190,.6)";
    ctx.font = `${Math.round(7 * S)}px 'Courier New',monospace`;
    ctx.fillText(r.sub, x + 16 * S, ry + rowH * 0.72);
    const yy = ry, fn = r.fn;
    hotspots.push({ x: x + 6 * S, y: yy + 2 * S, w: w - 12 * S, h: rowH - 4 * S, fn });
    ry += rowH;
  }
}

/** True if a screen point lies on any on-screen button (blocks the joystick). */
function overTouchButton(sx: number, sy: number): boolean {
  if (assignSlot !== null) return true; // rebind picker open — absorb all touches
  if (hudEditing()) return true;        // edit mode — no walking while arranging
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
