import "./style.css";
import { VIEW_W, VIEW_H, TILE, GARDEN_RADIUS, GARDEN_HEAL_PER_S, ARROW_MISS_WARN_S, GROUND_DESPAWN_S, MONSTERS_ENABLED, USE_RANGE_PX, RESPAWN_RETRY_S, THROW_RANGE_PX, ITEM_MOVE_REACH_PX, FED_MAX_S, FED_HP_PER_S, MELEE_REACH_PX } from "./config.ts";
import { PACK_BONUS_SLOTS, PACK_MAX, BAG_SIZE } from "./config.ts";
import { unstick, blockedAt, lineOfSight } from "./world/collision.ts";
import { toTile, glideWalker, tryStep, stepDir, atCenter, findPath, type Occupied } from "./world/grid.ts";
import { SPR, itemSprite } from "./gfx/sprites.ts";
import { clamp, dist, rndi } from "./util.ts";
import { playerSpeed, refreshDerived, canCarry, freeCap } from "./entities/player.ts";
import { updateMonsters, MONSTER_DEFS, spawnMonster, spawnMonsterInCamp, spawnWilderness } from "./entities/monsters.ts";
import { playerAttack, playerShoot, hitDummy, shootDummy, hurtPlayer, grantExp } from "./systems/combat.ts";
import { gatherTick, tickRegrowth } from "./systems/gather.ts";
import { tryPlace, structSprite, structureBonuses, STRUCTS, canAfford, payCost, structCenter, canPlaceAt } from "./systems/building.ts";
import { setActiveBonus } from "./systems/derived.ts";
import { applyOutfit, setOutfitColor, resetOutfitColors, type OutfitZone } from "./systems/outfit.ts";
import { useCrystal, tickCrystalCooldown } from "./systems/crystals.ts";
import { actionSlots, setSlot, BINDABLE_CRYSTALS } from "./systems/actions.ts";
import {
  hudLocked, toggleHudLock, placeHud, moveHudGroup, saveHudLayout, resetHudLayout, loadHudLayout,
  hudUserScale, stepHudUserScale, hudMenuOpen, toggleHudMenu, applyHudPreset, snapHudGroup,
  type HudGroup,
} from "./systems/hudLayout.ts";
import { researchById, isResearched, markResearched } from "./systems/tower.ts";
import { loadPanelPrefs } from "./systems/panelPrefs.ts";
import { skills, type SkillKey } from "./systems/skills.ts";
import { totalExpFor } from "./config.ts";
import { quests, claimQuest, syncCollectQuests } from "./systems/quests.ts";
import { acceptTask, abandonTask, handInTask, buyExchange, activeTask } from "./systems/tasks.ts";
import { addItem, removeItem, ITEMS, itemWeight, bagCount, equippedBow, bestArrow, bestPracticeArrow, compactBag } from "./items.ts";
import { addFloat, updateFloats, drawFloats } from "./fx.ts";
import { unlockAudio, beep } from "./audio.ts";
import { initInput, moveAxis } from "./input.ts";
import { initTouch, drawJoystick, isTouchDevice } from "./ui/touch.ts";
import { createGame, travelTo, applyGates, respawnAtHome, homeChests, CHEST_PRIZES, type Game } from "./game.ts";
import { saveGame, loadGame } from "./save.ts";
import { drawHud, drawVitals, drawMinimapAt, drawGoldTP, hudText, VITALS_W, VITALS_H, type HudCtx } from "./ui/hud.ts";
import { drawPanels, type UiState, type Hotspot, type ItemSlot, type PanelActions, type PanelKind, type PanelWindow } from "./ui/panels.ts";
import type { Vec, World, WorldKey, Corpse, GroundItem, Npc, Structure } from "./world/types.ts";
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
/** True on a desktop-sized layout — panels render smaller there. */
let desktopUI = false;

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
  desktopUI = !mobile;

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
loadPanelPrefs(); // restore per-window zoom + collapse preferences

const game: Game = loadGame() ?? createGame();
// keep passive structure bonuses (Garden HP) in sync from the start
setActiveBonus(structureBonuses(game.worlds.home));
refreshDerived(game.player);
// merge any stacks that older saves left fragmented (stack limits grew)
compactBag(game.player.bag);
for (const inv of homeChests(game)) compactBag(inv);
const P = game.player;
applyOutfit(P); // wear the saved dyes (or the classic look) from frame one
if (unstick(game.current, P)) { /* freed a player boxed in by an old build */ }
const cam = { x: 0, y: 0 };
/**
 * Mobile build placement (Etap 11): touch has no hover, so the ghost preview
 * was invisible and every tap tried to place blind. Two-tap flow instead —
 * the first tap PARKS the green/red ghost on that tile, a second tap on the
 * same tile confirms. Desktop keeps the classic hover-and-click.
 */
let placeGhost: { tx: number; ty: number } | null = null;
let moveMarker: { x: number; y: number; t: number } | null = null;
/** A corpse clicked mid-fight: we walk over WITHOUT dropping the attack
 *  target, and the loot window pops the moment it's in use range. */
let pendingLoot: Corpse | null = null;
let waveT = 0;
let saveTimer = 0;
let last = performance.now();

const ui: UiState = { windows: [], placing: null, selSlot: null, loot: null, npc: null, stash: null, shopTab: "buy", dragging: false, lookMode: false, inspect: null, split: null };

/** The inventory of the chest whose window is open, or null. Every stash
 *  operation routes through here — chests are independent now (Etap 11). */
function openStash(): (typeof P.bag) | null {
  const s = ui.stash;
  if (!s || !hasWindow("stash")) return null;
  return s.inv ?? null;
}
const mouse = { sx: 0, sy: 0 };
let hotspots: Hotspot[] = [];
let itemSlots: ItemSlot[] = [];
// mouse drag-and-drop of inventory items
let suppressClick = false;
let itemDrag: { src: "bag" | "stash" | "ground"; index: number; kind: ItemKind; n: number; sx: number; sy: number; active: boolean; gi?: GroundItem; touch?: boolean } | null = null;
/** Pending mobile throw (chosen in the quantity popup): next world tap aims it. */
let throwPending: { kind: ItemKind; n: number } | null = null;

/** Begin a (not yet active) drag of a loose ground item under (sx,sy).
 *  Shared by mouse pointerdown and the touch drag hooks. A plain tap/click
 *  (release without movement) still resolves as walk-over-and-pick-up. */
function probeGroundDrag(sx: number, sy: number, isTouch: boolean): boolean {
  if (P.dead || ui.lookMode || ui.split || ui.inspect) return false;
  if (pointInOpenPanel(sx, sy) || ui.placing || hudEditing()) return false;
  const wx = sx / vScale + cam.x;
  const wy = sy / vScale + cam.y;
  const world = cw();
  for (const gi of world.ground) {
    if (Math.abs(wx - gi.x) < 9 && wy > gi.y - 14 && wy < gi.y + 4) {
      itemDrag = { src: "ground", index: -1, kind: gi.kind, n: gi.n, sx, sy, active: false, gi, touch: isTouch };
      return true;
    }
  }
  return false;
}

/** Begin a (not yet active) item drag if (sx,sy) lands on an inventory slot.
 *  Shared by mouse pointerdown and the touch drag hooks. */
function probeSlotDrag(sx: number, sy: number, isTouch: boolean): boolean {
  if (ui.lookMode || ui.split || ui.inspect) return false;
  for (let i = itemSlots.length - 1; i >= 0; i--) {
    const it = itemSlots[i];
    if (sx >= it.x && sx < it.x + it.w && sy >= it.y && sy < it.y + it.h) {
      itemDrag = { src: it.src, index: it.index, kind: it.kind, n: it.n, sx, sy, active: false, touch: isTouch };
      return true;
    }
  }
  return false;
}

// mobile HUD customization (Etap 7): rebind picker + group dragging
let assignSlot: number | null = null;
let hudDrag: { id: HudGroup; dx: number; dy: number; moved: boolean; gw: number; gh: number } | null = null;
let hudGrips: { id: HudGroup; x: number; y: number; w: number; h: number; gx: number; gy: number; gw: number; gh: number }[] = [];
/** True when the mobile HUD is in edit (unlocked) mode. The desktop uses the
 *  fixed docked sidebar instead, so edit mode never applies there. */
function hudEditing(): boolean {
  return touchUI && !desktopUI && !hudLocked();
}

/** Width (device px) of the docked desktop sidebar; 0 on mobile. */
function sidebarWidth(): number {
  return desktopUI ? Math.round(64 * scale) : 0;
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
    case "wardrobe": return { x: 0, y: 10 * S };
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
  if (kind === "stash") ui.stash = null;
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
  startPlacing: (key: StructKey) => { ui.placing = key; placeGhost = null; closeWindow("build"); },
  useItem: (kind: ItemKind) => {
    const def = ITEMS[kind];
    if (def.crystal) { useCrystalItem(kind); return; }
    if (def.food) {
      // Tibia rule: you can bank at most 20 minutes of fed time — eating past
      // it is refused (and the food is NOT consumed)
      if (P.fedS + def.food > FED_MAX_S) { flash("you are full", "#e0a06a"); return; }
      if (!removeItem(P.bag, kind, 1)) return;
      P.fedS += def.food;
      flash(["Munch.", "Gulp.", "Mmmh."][rndi(0, 2)], "#e8dcc0");
      beep(360, 0.08, "sine", 0.05, 60);
      return;
    }
    if (def.boost) {
      // TEST item (Dopalacz): +5 levels and +20 to every skill, instantly.
      if (!removeItem(P.bag, kind, 1)) return;
      const targetLv = P.level + 5;
      const missing = totalExpFor(targetLv) - (totalExpFor(P.level) + P.exp);
      if (missing > 0) grantExp(cw(), P, missing);
      for (const k of Object.keys(skills) as SkillKey[]) {
        const sk = skills[k];
        if (!sk.active) continue;
        sk.lv += 20;
        sk.pts = 0;
      }
      refreshDerived(P);
      P.hp = P.maxhp;
      flash("DOPALACZ! +5 levels, +20 skills", "#ff9e3a");
      beep(700, 0.25, "square", 0.07, 200);
      return;
    }
    // don't waste a potion charge when already at full health
    if (def.heal && P.hp >= P.maxhp) { flash("full hp", "#7dff9e"); return; }
    if (!removeItem(P.bag, kind, 1)) return;
    if (def.heal) { P.hp = Math.min(P.maxhp, P.hp + def.heal); flash(`+${def.heal} hp`, "#7dff9e"); }
    beep(500, 0.12, "sine", 0.05, 180);
  },
  equipItem: (kind: ItemKind) => {
    const def = ITEMS[kind];
    const slot = def.slot;
    if (!slot) return;
    if (!removeItem(P.bag, kind, 1)) return;
    // stow a displaced piece into the bag; if the bag is somehow full, drop it
    // at the player's feet instead of silently destroying it
    const stowOrDrop = (k: ItemKind): void => {
      if (addItem(P.bag, k, 1) > 0) dropToGround(k, 1);
    };
    const prev = P.eq[slot];
    P.eq[slot] = kind;
    if (prev) stowOrDrop(prev);
    // Two-handed rule: a bow occupies both hands, so it can't share with a shield.
    if (def.bow && P.eq.shield) { stowOrDrop(P.eq.shield); P.eq.shield = null; }
    if (slot === "shield" && P.eq.weapon && ITEMS[P.eq.weapon].bow) {
      stowOrDrop(P.eq.weapon); P.eq.weapon = null;
    }
    refreshDerived(P);
    beep(420, 0.1, "triangle", 0.05);
  },
  unequip: (slot: EqSlot) => {
    const cur = P.eq[slot];
    if (!cur) return;
    // worn gear doesn't count toward carry cap, so moving it into the bag adds
    // weight — respect the cap the same way every other pickup does
    if (!canCarry(P, cur)) { flash("too heavy"); return; }
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
  takeGold: (c: Corpse) => {
    if (c.gold > 0) {
      P.gold += c.gold;
      c.gold = 0;
      beep(520, 0.08, "sine", 0.05, 80);
    }
    closeCorpseIfEmpty(c);
  },
  takeAllLoot: (c: Corpse) => { takeAll(c); },
  buy: (kind: ItemKind) => { doBuy(kind); },
  sell: (kind: ItemKind) => { doSell(kind); },
  claim: (id: string) => {
    const q = quests.find((x) => x.id === id);
    if (!q) return;
    const r = q.reward;
    if (r.item && !canCarry(P, r.item, r.itemN ?? 1)) { flash("too heavy"); return; }
    const res = claimQuest(P, q, (xp) => grantExp(cw(), P, xp), (t) => flash(t, "#ffe9a8"));
    if (res === "ok") beep(560, 0.16, "square", 0.06);
    else if (res === "full") flash("bag full");
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
    else if (r === "heavy") flash("too heavy", "#e0a06a");
  },
  moveStack: (src: "bag" | "stash", index: number) => { openMoveChooser(src, index); },
  splitConfirm: (mode: "store" | "take" | "drop" | "throw") => { splitConfirm(mode); },
  look: (kind: ItemKind) => { ui.inspect = kind; },
  toggleLook: () => { ui.lookMode = !ui.lookMode; if (!ui.lookMode) ui.inspect = null; },
  openBag: () => { openWindow("bag"); },
  setOutfitColor: (zone: OutfitZone, idx: number) => {
    setOutfitColor(P, zone, idx);
    beep(480, 0.05, "sine", 0.04, 60);
  },
  resetOutfitColors: () => {
    resetOutfitColors(P);
    flash("back to the classic look", "#e8dcc0");
    beep(360, 0.08, "sine", 0.04);
  },
  close: (kind: PanelKind) => { closeWindow(kind); },
};

/* ---------------- storage chest ---------------- */

/** Store up to `n` of bag slot `index` into the chest. */
function storePartial(index: number, n: number): void {
  const inv = openStash();
  const slot = P.bag[index];
  if (!inv || !slot) return;
  const take = Math.min(n, slot.n);
  const left = addItem(inv, slot.kind, take);
  const moved = take - left;
  if (moved <= 0) { flash("chest full"); return; }
  slot.n -= moved;
  if (slot.n <= 0) P.bag[index] = null;
  compactBag(inv); compactBag(P.bag);
  beep(360, 0.06, "sine", 0.04);
}

/**
 * Where a throw aimed at (tx,ty) actually lands. The target is clamped to
 * THROW_RANGE_PX from the player, snapped to the tile centre, then — if that
 * tile is solid or out of sight — slides back along the throw line toward the
 * player half a tile at a time until it's legal (Tibia does the same: an item
 * thrown at a wall falls at its foot). Worst case it lands at your feet.
 */
function resolveThrowTarget(tx: number, ty: number): { x: number; y: number } {
  const world = cw();
  let dx = tx - P.x;
  let dy = ty - P.y;
  const d = Math.hypot(dx, dy);
  if (d > THROW_RANGE_PX) { dx *= THROW_RANGE_PX / d; dy *= THROW_RANGE_PX / d; }
  const steps = Math.ceil(Math.hypot(dx, dy) / (TILE / 2));
  for (let i = steps; i >= 1; i--) {
    const px = P.x + dx * (i / steps);
    const py = P.y + dy * (i / steps);
    // snap to the tile centre so thrown loot sits tidily on the grid
    const cx = Math.floor(px / TILE) * TILE + TILE / 2;
    const cy = Math.floor(py / TILE) * TILE + TILE / 2;
    if (!blockedAt(world, cx, cy) && lineOfSight(world, P.x, P.y, cx, cy)) return { x: cx, y: cy };
  }
  return { x: P.x, y: P.y + 2 };
}

/**
 * A thrown stack that lands on a portal travels THROUGH it (Etap 11) — the
 * classic loot-bag trick: pitch your haul into the teleport and it drops out
 * beside the matching portal on the far side, exactly where you'd arrive.
 */
function sendThroughPortal(kind: ItemKind, n: number, pt: { dest: WorldKey }): void {
  const from = cw();
  const dest = game.worlds[pt.dest];
  const back = dest.portals.find((p2) => p2.dest === from.key) ?? dest.portals[0];
  const gx = (back?.x ?? dest.w * TILE / 2) + (Math.random() - 0.5) * 8;
  const gy = (back?.y ?? dest.h * TILE / 2) + 14;
  const near = dest.ground.find((g) => g.kind === kind && Math.hypot(g.x - gx, g.y - gy) < 7);
  if (near) near.n += n;
  else dest.ground.push({ kind, n, x: gx, y: gy, t: GROUND_DESPAWN_S });
  flash(`whoosh — ${n} ${ITEMS[kind].name} through the portal!`, "#8ab6ff");
  beep(600, 0.12, "sine", 0.05, -220);
}

/** The portal (if any) whose swirl covers world point (x,y). */
function portalAt(x: number, y: number): { dest: WorldKey } | null {
  for (const pt of cw().portals) {
    if (dist(x, y, pt.x, pt.y) < 12) return pt;
  }
  return null;
}

/** Drop an item stack onto the ground — at the player's feet, or thrown to a
 *  target spot (Tibia-style) when (tx,ty) is given. */
function dropToGround(kind: ItemKind, n: number, tx?: number, ty?: number): void {
  if (n <= 0) return;
  const world = cw();
  let gx: number;
  let gy: number;
  if (tx !== undefined && ty !== undefined) {
    const t = resolveThrowTarget(tx, ty);
    // aimed at a portal → the stack takes the trip instead of landing
    const pt = portalAt(t.x, t.y);
    if (pt) { sendThroughPortal(kind, n, pt); return; }
    gx = t.x; gy = t.y;
  } else {
    const jitter = () => (Math.random() - 0.5) * 8;
    gx = P.x + jitter();
    gy = P.y + 2 + jitter();
  }
  // merge into a very close stack of the same kind to avoid clutter
  const near = world.ground.find((g) => g.kind === kind && Math.hypot(g.x - gx, g.y - gy) < 7);
  if (near) near.n += n;
  else world.ground.push({ kind, n, x: gx, y: gy, t: GROUND_DESPAWN_S });
  flash(`dropped ${n} ${ITEMS[kind].name}`, "#cfa86a");
  beep(200, 0.06, "sine", 0.04, -60);
}

/** Move an already-dropped ground stack to another spot (drag-throw). Same
 *  legality rules as a bag throw; merges into a near stack at the landing. */
function throwGroundItem(gi: GroundItem, tx: number, ty: number): void {
  const world = cw();
  if (!world.ground.includes(gi)) return;
  const t = resolveThrowTarget(tx, ty);
  // shoving a ground stack into a portal sends it through too
  const pt = portalAt(t.x, t.y);
  if (pt) {
    const idx = world.ground.indexOf(gi);
    if (idx >= 0) world.ground.splice(idx, 1);
    sendThroughPortal(gi.kind, gi.n, pt);
    return;
  }
  const near = world.ground.find((g) => g !== gi && g.kind === gi.kind && Math.hypot(g.x - t.x, g.y - t.y) < 7);
  if (near) {
    near.n += gi.n;
    const idx = world.ground.indexOf(gi);
    if (idx >= 0) world.ground.splice(idx, 1);
  } else {
    gi.x = t.x;
    gi.y = t.y;
  }
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
  const inv = openStash();
  if (!inv) return;
  const slot = inv[index];
  if (!slot) return;
  const wantByN = Math.min(n, slot.n);
  const fitByWeight = Math.floor(freeCap(P) / itemWeight(slot.kind, 1));
  const want = Math.min(wantByN, Math.max(0, fitByWeight));
  if (want <= 0) { flash("too heavy"); return; }
  const left = addItem(P.bag, slot.kind, want);
  const moved = want - left;
  if (moved <= 0) { flash("bag full"); return; }
  slot.n -= moved;
  if (slot.n <= 0) inv[index] = null;
  compactBag(P.bag); compactBag(inv);
  syncCollectQuests(P, (t) => flash(t, "#ffe9a8"));
  beep(440, 0.06, "sine", 0.04);
}

/** Drop up to `n` of bag slot `index` on the ground. */
function dropFromBag(index: number, n: number, tx?: number, ty?: number): void {
  const slot = P.bag[index];
  if (!slot) return;
  const take = Math.min(n, slot.n);
  slot.n -= take;
  if (slot.n <= 0) P.bag[index] = null;
  compactBag(P.bag);
  dropToGround(slot.kind, take, tx, ty);
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
const currentN = (src: "bag" | "stash" | "ground", index: number): number => {
  if (src === "ground") return itemDrag?.gi?.n ?? 0;
  const arr = src === "bag" ? P.bag : openStash();
  const s = arr ? arr[index] : null;
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
      if (d.src === "ground") {
        if (!d.gi) return;
        if (dist(P.x, P.y, d.gi.x, d.gi.y) > ITEM_MOVE_REACH_PX) { flash("too far away", "#d96a5a"); return; }
        pickupGround(d.gi);
      }
      else if (it.src === d.src) {
        const arr = d.src === "bag" ? P.bag : openStash();
        if (arr) swapOrMerge(arr, d.index, it.index);
      }
      else if (d.src === "bag") storePartial(d.index, currentN("bag", d.index));
      else takePartial(d.index, currentN("stash", d.index));
      return;
    }
  }
  // dropped on an open panel (chest window → store, bag panel → pick up), else cancel
  if (pointInOpenPanel(rx, ry)) {
    const overStash = ui.windows.some((w) => w.kind === "stash" && w.rect &&
      rx >= w.rect.x && rx < w.rect.x + w.rect.w && ry >= w.rect.y && ry < w.rect.y + w.rect.h);
    if (overStash && d.src === "bag") storePartial(d.index, currentN("bag", d.index));
    else if (d.src === "ground" && d.gi) {
      const overBag = ui.windows.some((w) => w.kind === "bag" && w.rect &&
        rx >= w.rect.x && rx < w.rect.x + w.rect.w && ry >= w.rect.y && ry < w.rect.y + w.rect.h);
      if (overBag) {
        if (dist(P.x, P.y, d.gi.x, d.gi.y) > ITEM_MOVE_REACH_PX) { flash("too far away", "#d96a5a"); return; }
        pickupGround(d.gi);
      }
    }
    return;
  }
  // dropped on the world → throw it to that spot (Tibia-style)
  const wx = rx / vScale + cam.x;
  const wy = ry / vScale + cam.y;
  if (d.src === "bag") {
    const n = currentN("bag", d.index);
    if (n > 1) {
      // a stack asks how many to throw; the aimed spot rides along in `at`
      ui.split = { kind: d.kind, index: d.index, src: "bag", max: n, n, canStore: false, at: { x: wx, y: wy } };
    } else if (n === 1) {
      dropFromBag(d.index, 1, wx, wy);
    }
  } else if (d.src === "ground" && d.gi) {
    // no telekinesis: pushing loot around requires standing near it
    if (dist(P.x, P.y, d.gi.x, d.gi.y) > ITEM_MOVE_REACH_PX) { flash("too far away", "#d96a5a"); return; }
    throwGroundItem(d.gi, wx, wy);
  }
}

/** Open the quantity chooser for a bag/chest slot (or move a single item flat). */
function openMoveChooser(src: "bag" | "stash", index: number): void {
  const arr = src === "bag" ? P.bag : openStash();
  const slot = arr ? arr[index] : null;
  if (!slot) return;
  const canStore = ui.windows.some((w) => w.kind === "stash");
  // one item, single obvious action → skip the chooser. On touch a bag item
  // still opens it, because Drop vs Throw is a real choice there (no mouse
  // drag exists to aim a throw with).
  if (slot.n <= 1) {
    if (src === "stash") { takePartial(index, 1); return; }
    if (canStore) { storePartial(index, 1); return; }
    if (!touchUI) { dropFromBag(index, 1); return; }
  }
  ui.split = { kind: slot.kind, index, src, max: slot.n, n: slot.n, canStore };
}

function splitConfirm(mode: "store" | "take" | "drop" | "throw"): void {
  const sp = ui.split;
  if (!sp) return;
  // the chest window may have auto-closed (walked out of range) while the
  // chooser was open — a chest transfer without the chest present is invalid
  if ((mode === "store" || mode === "take") && !hasWindow("stash")) { ui.split = null; return; }
  const n = Math.max(1, Math.min(sp.max, sp.n));
  if (mode === "store") storePartial(sp.index, n);
  else if (mode === "take") takePartial(sp.index, n);
  else if (mode === "throw") {
    if (sp.at) dropFromBag(sp.index, n, sp.at.x, sp.at.y); // aimed by the drag
    else {
      // arm the throw: the NEXT tap on the map is the target tile
      throwPending = { kind: sp.kind, n };
      flash("tap the ground to throw", "#8ab6ff");
    }
  }
  else dropFromBag(sp.index, n);
  ui.split = null;
}

import { craftAcross } from "./items.ts";
function craftAt(r: Recipe): boolean {
  const goldCost = r.gold ?? 0;
  if (P.gold < goldCost) { flash("not enough gold", "#d96a5a"); return false; }
  if (craftAcross([P.bag, ...homeChests(game)], r)) {
    P.gold -= goldCost;
    flash(`crafted ${ITEMS[r.out].name}`, "#b9e07f");
    return true;
  }
  return false;
}

function doResearch(id: string): void {
  const r = researchById(id);
  if (!r || isResearched(r.id)) return;
  if (!canAfford(P.bag, r.researchCost, homeChests(game))) { flash("need materials"); return; }
  payCost(P.bag, r.researchCost, homeChests(game));
  markResearched(r.id);
  flash(`researched ${r.name}`, "#c9a6ff");
  beep(520, 0.18, "square", 0.06, 120);
}

function doBuyCrystal(id: string): void {
  const r = researchById(id);
  if (!r || !isResearched(r.id)) return;
  if (!canAfford(P.bag, r.buyCost, homeChests(game))) { flash("need materials"); return; }
  if (!canCarry(P, r.crystal, r.buyN)) { flash("too heavy"); return; }
  const moved = r.buyN - addItem(P.bag, r.crystal, r.buyN);
  if (moved < r.buyN) { if (moved > 0) removeItem(P.bag, r.crystal, moved); flash("bag full"); return; }
  payCost(P.bag, r.buyCost, homeChests(game));
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
  // switching back to melee also restores a shield: the bow forced it into the
  // bag, so a full swap means weapon AND shield come back together
  if (!wantBow && !P.eq.shield) {
    let sh: ItemKind | null = null;
    for (const s of P.bag) {
      if (!s) continue;
      const d = ITEMS[s.kind];
      if (d.slot === "shield" && (!sh || d.value > ITEMS[sh].value)) sh = s.kind;
    }
    if (sh) act.equipItem(sh, 0);
  }
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
  // limit the whole stack by free carry weight (not just a single item's worth)
  const fitByWeight = Math.floor(freeCap(P) / itemWeight(it.kind, 1));
  if (fitByWeight <= 0) { flash("too heavy"); return; }
  const want = Math.min(it.n, fitByWeight);
  const left = addItem(P.bag, it.kind, want) + (it.n - want);
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
  // an armed throw (mobile quantity chooser) aims at this tap and resolves it
  if (throwPending) {
    const t = throwPending;
    throwPending = null;
    const idx = P.bag.findIndex((s) => s !== null && s.kind === t.kind);
    if (idx >= 0) dropFromBag(idx, t.n, w.x, w.y);
    return;
  }
  if (ui.placing) {
    if (cw() !== game.worlds.home) {
      flash("you can only build on Home Isle", "#e0a06a");
      ui.placing = null;
      placeGhost = null;
      return;
    }
    const key = ui.placing;
    const n = STRUCTS[key].single ? 1 : 2;
    const tx = Math.round(w.x / TILE - n / 2);
    const ty = Math.round(w.y / TILE - n / 2);
    // Touch: first tap parks the ghost, a second tap on the SAME tile builds.
    // (No hover on a phone — without this the preview never showed at all.)
    if (isTouchDevice() && !(placeGhost && placeGhost.tx === tx && placeGhost.ty === ty)) {
      placeGhost = { tx, ty };
      if (!canPlaceAt(game.worlds.home, key, tx, ty)) flash("can't build here — pick another tile", "#e0a06a");
      else flash("tap again to build", "#9fe8a8");
      return;
    }
    if (tryPlace(game.worlds.home, P, key, w.x, w.y, homeChests(game))) {
      recomputeBonuses();
      ui.placing = null; // placed — leave build mode
      placeGhost = null;
    } else if (!canAfford(P.bag, STRUCTS[key].cost, homeChests(game))) {
      flash("not enough materials", "#d96a5a");
      ui.placing = null;
      placeGhost = null;
    } else {
      // invalid spot — stay in placing mode so the player can try elsewhere
      flash("can't build here", "#e0a06a");
    }
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
    if (throwPending) { throwPending = null; flash("throw cancelled", "#8ab6ff"); return; }
    if (assignSlot !== null) { assignSlot = null; return; }
    if (ui.split) { ui.split = null; return; }
    if (ui.inspect) { ui.inspect = null; return; }
    if (ui.placing) { ui.placing = null; placeGhost = null; return; }
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
if (isTouchDevice()) initTouch(screen, handleWorldTap, overTouchButton, {
  // finger drag-and-drop from inventory panels: still finger = tap (use/
  // equip/chooser as before), moving finger = drag with the same drop rules
  // as the mouse (swap/merge, store, pick up, throw onto the world)
  probe: (sx, sy) => probeSlotDrag(sx, sy, true) || probeGroundDrag(sx, sy, true),
  move: (sx, sy) => {
    if (!itemDrag) return;
    mouse.sx = sx; mouse.sy = sy;
    if (!itemDrag.active && Math.hypot(sx - itemDrag.sx, sy - itemDrag.sy) > 8 * scale) itemDrag.active = true;
  },
  end: (sx, sy, moved) => {
    if (!itemDrag) { if (!moved) handleWorldTap(sx, sy); return; }
    if (itemDrag.active) resolveItemDrop(sx, sy);
    else if (!moved) handleWorldTap(itemDrag.sx, itemDrag.sy); // a plain tap
    itemDrag = null;
  },
});

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
  // desktop sidebar: right-click an action slot to open the rebind picker
  if (desktopUI && e.button === 2) {
    for (const r of sidebarSlotRects) {
      if (s.x >= r.x && s.x < r.x + r.w && s.y >= r.y && s.y < r.y + r.h) {
        assignSlot = r.i;
        e.preventDefault();
        return;
      }
    }
  }
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
        hudDrag = { id: g.id, dx: s.x - g.gx, dy: s.y - g.gy, moved: false, gw: g.gw, gh: g.gh };
        ui.dragging = true;
        suppressClick = true;
        try { screen.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
        e.preventDefault();
        return;
      }
    }
  }
  // item drag-and-drop (mouse; touch drags run through the touch.ts hooks)
  if (e.pointerType === "mouse" && e.button === 0 && !ui.lookMode && !ui.split && !ui.inspect) {
    if (probeSlotDrag(s.x, s.y, false)) {
      suppressClick = true; // the item's click is resolved on release instead
      try { screen.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
      return;
    }
    // ground items can be grabbed too: drag to another tile to push them
    // around (Tibia-style) or onto the bag panel to pick them up. A plain
    // click (no movement) walks over and picks up, resolved on release.
    if (probeGroundDrag(s.x, s.y, false)) {
      suppressClick = true;
      try { screen.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
      return;
    }
  }
});
screen.addEventListener("pointermove", (e) => {
  if (itemDrag && !itemDrag.touch) {
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
    // tidy up: snap to a pixel grid, magnetize to nearby screen edges
    if (hudDrag.moved) {
      snapHudGroup(
        hudDrag.id, hudDrag.gw, hudDrag.gh, screen.width, screen.height,
        8 * scale, 16 * scale, 6 * scale,
      );
    }
    saveHudLayout();
    hudDrag = null;
    ui.dragging = false;
    setTimeout(() => { suppressClick = false; }, 0);
    return;
  }
  if (itemDrag && !itemDrag.touch) {
    const s = toScreen(e as PointerEvent);
    if (itemDrag.active) resolveItemDrop(s.x, s.y);
    else handleWorldTap(itemDrag.sx, itemDrag.sy); // no real drag → treat as a click
    itemDrag = null;
    // clear the click suppression after this gesture completes
    setTimeout(() => { suppressClick = false; }, 0);
  }
  endDrag();
});
addEventListener("pointercancel", () => { hudDrag = null; if (itemDrag && !itemDrag.touch) itemDrag = null; suppressClick = false; endDrag(); });

/**
 * One-time treasure chests, Tibia-style: the first open yields the prize with
 * the classic "You have found a ...", every later open is just an empty chest.
 * Opened IDs persist in the save. If the reward doesn't fit the bag (weight or
 * slots), it drops at the player's feet instead of being lost.
 */
function openTreasure(s: Structure): void {
  const id = `treasure:${cw().key}:${s.tx},${s.ty}`;
  if (game.opened.includes(id)) { flash("the chest is empty", "#bdb59c"); return; }
  game.opened.push(id);
  // world-keyed prizes (the Marrow set on the deepest lair floors); anything
  // unmapped falls back to the classic blade, so old saves behave identically
  const prize: ItemKind = CHEST_PRIZES[cw().key] ?? "marrowBlade";
  const fits = freeCap(P) >= itemWeight(prize, 1) && addItem(P.bag, prize, 1) === 0;
  if (!fits) dropToGround(prize, 1);
  flash(`You have found a ${ITEMS[prize].name}.`, "#ffe9a8");
  beep(660, 0.18, "sine", 0.06, 220);
  saveGame(game);
}

function worldClick(w: Vec): void {
  if (P.dead) return;
  const world = cw();
  // monsters
  for (const m of world.monsters) {
    if (Math.abs(w.x - m.x) < 9 && w.y > m.y - 16 && w.y < m.y + 5) {
      // clicking the monster you're already attacking STOPS the attack (Tibia-style toggle)
      if (P.target?.kind === "mob" && P.target.m === m) {
        P.target = null;
        flash("attack stopped", "#8ab6ff");
        return;
      }
      P.target = { kind: "mob", m };
      P.dest = null; P.gather = null; moveMarker = null;
      return;
    }
  }
  // dropped ground items — walk over and pick up (Tibia-style, no telekinesis)
  for (const gi of world.ground) {
    if (Math.abs(w.x - gi.x) < 9 && w.y > gi.y - 14 && w.y < gi.y + 4) {
      P.target = { kind: "ground", gi };
      P.dest = null; P.gather = null; moveMarker = null;
      return;
    }
  }
  // corpses. While an ATTACK is held (melee or bow), looting must not break
  // it: in range the loot window opens straight away, out of range we walk
  // over (pendingLoot pops it on arrival) — the marked monster stays marked
  // and tickMeleeFire / tickRangedFire keep the blows coming the whole time.
  for (const c of world.corpses) {
    if (Math.abs(w.x - c.x) < 10 && Math.abs(w.y - c.y) < 8) {
      if (P.target?.kind === "mob") {
        if (dist(P.x, P.y, c.x, c.y) < USE_RANGE_PX) {
          ui.loot = c; openWindow("loot");
        } else {
          pendingLoot = c;
          P.dest = { x: c.x, y: c.y };
        }
        moveMarker = null;
        return;
      }
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
  // structures (dummy to hit, forge/chest to use). Hitbox anchored to the
  // structure's real footprint centre (1×1 dummies vs 2×2 buildings).
  for (const s of world.structures) {
    const c = structCenter(s);
    if (Math.abs(w.x - c.x) < 16 && w.y > c.baseY - 30 && w.y < c.baseY + 4) {
      if (s.key === "dummy" || s.key === "dummyII" || s.key === "range") {
        // re-clicking the dummy you're training on stops the attack (toggle)
        if (P.target?.kind === "dummy" && P.target.s === s) {
          P.target = null;
          flash("attack stopped", "#8ab6ff");
          return;
        }
        P.target = { kind: "dummy", s };
      }
      else if (s.key === "garden") { continue; } // walk-through: ignore clicks
      else P.target = { kind: "structure", s };
      P.dest = null; P.gather = null; moveMarker = null;
      return;
    }
  }
  // sealed level gates — a click tells you what it takes to pass
  for (const gt of world.gates) {
    if (P.level < gt.lv && toTile(w.x) === gt.tx && toTile(w.y) === gt.ty) {
      flash(`sealed — requires level ${gt.lv}`, "#e0a06a");
      return;
    }
  }
  // trees
  for (const tr of world.trees) {
    if (tr.stump) continue;
    const cx = tr.tx * TILE + TILE / 2;
    if (Math.abs(w.x - cx) < 8 && w.y > tr.ty * TILE + TILE - 27 && w.y < tr.ty * TILE + TILE + 2) {
      P.gather = { kind: "tree", obj: tr };
      P.target = null; P.dest = null; moveMarker = null; pendingLoot = null;
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
      P.target = null; P.dest = null; moveMarker = null; pendingLoot = null;
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
      P.target = null; P.dest = null; moveMarker = null; pendingLoot = null;
      return;
    }
  }
  // otherwise: walk there
  P.dest = { x: w.x, y: w.y };
  P.target = null; P.gather = null; pendingLoot = null;
  moveMarker = { x: w.x, y: w.y, t: 0.5 };
}

/* ---------------- interaction ranges ---------------- */

function targetPoint(): Vec | null {
  const t = P.target;
  if (!t) return null;
  if (t.kind === "mob") return { x: t.m.x, y: t.m.y };
  if (t.kind === "corpse") return { x: t.c.x, y: t.c.y };
  if (t.kind === "ground") return { x: t.gi.x, y: t.gi.y };
  if (t.kind === "npc") return { x: t.n.x, y: t.n.y };
  // structure: stand just below the sprite base (footprint-aware anchor)
  const c = structCenter(t.s);
  return { x: c.x, y: c.baseY - 2 };
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
    // at the Archery Range practice arrows fire first (that's their job);
    // against anything else only combat arrows count.
    const t = P.target;
    const arrow = t?.kind === "dummy" && t.s.key === "range"
      ? bestPracticeArrow(P.bag)
      : bestArrow(P.bag);
    if (arrow) return { ranged: true, reach: bow.range, arrow };
  }
  return { ranged: false, reach: MELEE_REACH_PX, arrow: null };
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
    // range AND a clear line of fire — arrows no longer thread cave walls
    // (which made the dragon a shooting-gallery target from total safety)
    if (dist(P.x, P.y, m.x, m.y) <= mode.reach && P.atkCd <= 0
      && lineOfSight(cw(), P.x, P.y, m.x, m.y)) {
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

/**
 * Swing at the currently-kept MELEE target whenever it's within arm's reach
 * and the attack is off cooldown. Runs every frame (like tickRangedFire), so
 * the attack persists through manual movement and looting. Slightly more
 * reach slack than the approach stop-distance so a wiggling monster doesn't
 * stutter in and out of range.
 */
function tickMeleeFire(): void {
  const t = P.target;
  if (!t || t.kind !== "mob") return;
  const m = t.m;
  if (m.hp <= 0 || !cw().monsters.includes(m)) { P.target = null; return; }
  if (dist(P.x, P.y, m.x, m.y) <= MELEE_REACH_PX && P.atkCd <= 0) {
    P.atkCd = P.atkRate;
    P.face = m.x < P.x ? -1 : 1;
    if (equippedBow(P.eq)) warnNoArrows(); // bow with an empty quiver pokes, but nags
    if (playerAttack(cw(), P, m)) P.target = null;
  }
}

/* ---------------- grid walking (player) ---------------- */

/** Cached A* route the player is currently following (tile coords). */
let walkRoute: { x: number; y: number }[] = [];
let walkKey = "";

/** Tiles claimed by creatures — the player can never step onto one. */
function playerOcc(world: World): Occupied {
  return (tx, ty) => world.monsters.some((m) => m.tx === tx && m.ty === ty);
}

/**
 * Walk the player toward the goal tile along an A*-planned route, spending up
 * to `budget` px of movement this frame. The route is cached and replanned
 * only when the goal changes or a monster steps into the next square, so the
 * cost stays negligible. Returns true while genuinely progressing — false
 * means "stuck or arrived", letting callers clear their destination.
 */
function walkGrid(world: World, gx: number, gy: number, budget: number): boolean {
  const occ = playerOcc(world);
  const key = world.key + ":" + gx + "," + gy;
  if (key !== walkKey) {
    walkKey = key;
    walkRoute = [];
  }
  let moved = false;
  for (;;) {
    const left = glideWalker(P, budget);
    if (left < budget) moved = true; // some glide happened
    budget = left;
    if (budget <= 0) break;
    if (P.tx === gx && P.ty === gy) break;
    if (!walkRoute.length) {
      walkRoute = findPath(world, P.tx, P.ty, gx, gy, occ);
      if (!walkRoute.length) break;
    }
    const n = walkRoute[0];
    const sx = n.x - P.tx;
    const sy = n.y - P.ty;
    const ok = Math.abs(sx) <= 1 && Math.abs(sy) <= 1 && tryStep(world, P, sx, sy, occ);
    if (ok) {
      walkRoute.shift();
      if (sx) P.face = sx < 0 ? -1 : 1;
      moved = true;
      continue;
    }
    // a monster claimed the next square (or the route went stale): replan once
    walkRoute = findPath(world, P.tx, P.ty, gx, gy, occ);
    const n2 = walkRoute[0];
    const s2x = n2 ? n2.x - P.tx : 0;
    const s2y = n2 ? n2.y - P.ty : 0;
    if (n2 && tryStep(world, P, s2x, s2y, occ)) {
      walkRoute.shift();
      if (s2x) P.face = s2x < 0 ? -1 : 1;
      moved = true;
      continue;
    }
    break; // boxed in this frame — try again next frame
  }
  return moved;
}

/* ---------------- update ---------------- */

/* ---------------- proximity panels (Tibia-style auto-close) ---------------- */

/** Is the player near any owned Home-Isle structure of the given kinds? */
function nearStructure(...keys: string[]): boolean {
  if (cw() !== game.worlds.home) return false;
  for (const s of game.worlds.home.structures) {
    if (!keys.includes(s.key)) continue;
    const c = structCenter(s);
    if (dist(P.x, P.y, c.x, c.y) < USE_RANGE_PX) return true;
  }
  return false;
}

/** Is the player near an NPC accepted by `match` on the current island? */
function nearNpc(match: (n: Npc) => boolean): boolean {
  return cw().npcs.some((n) => match(n) && dist(P.x, P.y, n.x, n.y) < USE_RANGE_PX);
}

let proximityT = 0;
/**
 * Interaction panels stay open while dragging other windows around (Tibia-style
 * — clicking elsewhere never closes them), but they DO close when the player
 * walks away from their source. Without this, an open Storage Chest would allow
 * remote deposits from the Wildlands, sidestepping the carry-cap design, and
 * shops / the Forge / the task board could be used from anywhere.
 */
function tickProximityPanels(dt: number): void {
  proximityT -= dt;
  if (proximityT > 0) return;
  proximityT = 0.25;
  const checks: ReadonlyArray<readonly [PanelKind, () => boolean]> = [
    ["forge", () => nearStructure("forge")],
    ["tower", () => nearStructure("tower")],
    ["stash", () => {
      const st = ui.stash;
      if (!st || cw() !== game.worlds.home || !game.worlds.home.structures.includes(st)) return false;
      const c = structCenter(st);
      return dist(P.x, P.y, c.x, c.y) < USE_RANGE_PX;
    }],
    ["shop", () => !!ui.npc && cw().npcs.includes(ui.npc) && nearNpc((n) => n === ui.npc)],
    ["tasks", () => nearNpc((n) => n.key === "taskmaster")],
    ["wardrobe", () => nearNpc((n) => n.key === "tailor")],
    ["loot", () => !!ui.loot && cw().corpses.includes(ui.loot)
      && dist(P.x, P.y, ui.loot.x, ui.loot.y) < USE_RANGE_PX],
  ];
  for (const [kind, inRange] of checks) {
    if (hasWindow(kind) && !inRange()) {
      closeWindow(kind);
      flash("too far away", "#e0a06a");
    }
  }
}

function checkPortals(): void {
  if (P.tpCd > 0) return;
  for (const pt of cw().portals) {
    if (dist(P.x, P.y, pt.x, pt.y) < 11) {
      if (pt.inactive) {
        // a dormant quest pad: hum, but do not travel (yet)
        flash("the portal is dormant… for now", "#b9a6d8");
        P.tpCd = 1.6; // don't spam the flash while standing on the pad
        return;
      }
      travelTo(game, pt.dest);
      return;
    }
  }
}

/**
 * Keep the bag's slot count in step with carried Backpacks: 16 base + 8 per
 * pack (max 2). Shrinking spills anything stranded in the lost slots onto the
 * ground at your feet — Tibia would drop the container with its contents.
 */
function syncBagSize(): void {
  const packs = Math.min(PACK_MAX, bagCount(P.bag, "backpack"));
  const target = BAG_SIZE + packs * PACK_BONUS_SLOTS;
  if (P.bag.length < target) {
    while (P.bag.length < target) P.bag.push(null);
  } else if (P.bag.length > target) {
    for (let i = target; i < P.bag.length; i++) {
      const st = P.bag[i];
      if (st) dropToGround(st.kind, st.n);
    }
    P.bag.length = target;
  }
}

function update(dt: number): void {
  syncBagSize();
  const world = cw();
  // level gates: seal/open against the current level (also right after level-ups)
  applyGates(world, P.level);
  waveT += dt;
  P.tpCd = Math.max(0, P.tpCd - dt);
  P.atkCd = Math.max(0, P.atkCd - dt);
  tickCrystalCooldown(dt);
  // mid-fight loot walk: the corpse clicked during combat pops open the
  // moment we're in range (or is forgotten if it despawned / got looted away)
  if (pendingLoot) {
    if (!world.corpses.includes(pendingLoot)) pendingLoot = null;
    else if (dist(P.x, P.y, pendingLoot.x, pendingLoot.y) < USE_RANGE_PX) {
      ui.loot = pendingLoot;
      openWindow("loot");
      pendingLoot = null;
      P.dest = null;
    }
  }
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
  // A MELEE attack on a monster is just as sticky now: the marked target
  // survives manual movement, and tickMeleeFire below swings whenever the
  // monster is in reach — so you can step around, loot, and keep fighting.
  const holdMelee = !!P.target && P.target.kind === "mob" && !mode.ranged;

  // movement: WASD/joystick overrides auto-actions. All walking is grid
  // walking now (Tibia-style): the player stands on ONE tile, glides toward
  // its centre, and only from the centre claims an adjacent square. Monsters
  // hard-block their tiles — a free square is always a real escape route.
  const ax = moveAxis();
  if (ax.dx || ax.dy) {
    P.dest = null; P.gather = null; pendingLoot = null;
    if (!kiting && !holdMelee) P.target = null; // non-combat targets still drop
    const occ = playerOcc(world);
    let budget = playerSpeed(P) * dt;
    for (;;) {
      budget = glideWalker(P, budget);
      if (budget <= 0) break;
      const { sx, sy } = stepDir(ax.dx, ax.dy);
      if (!sx && !sy) break;
      // diagonal blocked → slide along whichever axis is free (wall hugging)
      if (!tryStep(world, P, sx, sy, occ)
        && !(sx && sy && (tryStep(world, P, sx, 0, occ) || tryStep(world, P, 0, sy, occ)))) break;
    }
    walkKey = ""; // manual steps invalidate any cached auto-route
    if (ax.dx) P.face = ax.dx < 0 ? -1 : 1;
  } else if (P.dest) {
    const gx = toTile(P.dest.x);
    const gy = toTile(P.dest.y);
    const there = P.tx === gx && P.ty === gy && atCenter(P);
    if (there) P.dest = null;
    else {
      const moved = walkGrid(world, gx, gy, playerSpeed(P) * dt);
      if (P.tx === gx && P.ty === gy && atCenter(P)) P.dest = null;
      // unreachable click (water, rock): the best-effort route ended — stop
      else if (!moved && atCenter(P)) P.dest = null;
    }
  } else if (P.target && !kiting) {
    // melee / walk-up targets: approach along the grid, then act
    const tp = targetPoint();
    if (tp) {
      const d = dist(P.x, P.y, tp.x, tp.y);
      let reach = MELEE_REACH_PX;
      if (P.target.kind === "dummy" || P.target.kind === "mob") reach = mode.reach;
      if (d > reach) walkGrid(world, toTile(tp.x), toTile(tp.y), playerSpeed(P) * dt);
      else resolveTarget();
    }
  } else if (kiting) {
    // idle bowman: close the gap when the target drifted out of range OR a
    // wall blocks the shot (walk around the corner instead of standing dumb)
    const tp = targetPoint();
    if (tp) {
      const d = dist(P.x, P.y, tp.x, tp.y);
      const blocked = P.target?.kind === "mob" && !lineOfSight(world, P.x, P.y, tp.x, tp.y);
      if (d > mode.reach || blocked) walkGrid(world, toTile(tp.x), toTile(tp.y), playerSpeed(P) * dt);
    }
  } else if (P.gather) {
    const gp = gatherPoint();
    if (gp) {
      const d = dist(P.x, P.y, gp.x, gp.y);
      if (d > MELEE_REACH_PX) walkGrid(world, toTile(gp.x), toTile(gp.y), playerSpeed(P) * dt);
      else if (P.atkCd <= 0 && P.gather) {
        gatherTick(world, P, P.gather, (t) => flash(t, "#ffe9a8"));
      }
    }
  }

  // Ranged fire pass: with a bow, keep shooting the kept target whenever it's in
  // range and off cooldown — whether we're standing still or kiting on the move.
  if (kiting) tickRangedFire(mode);
  // Melee fire pass — the sword-arm mirror of the above: the marked monster
  // eats a swing whenever it's within reach and the attack is off cooldown,
  // even while the player is walking or has a loot window open.
  else if (holdMelee) tickMeleeFire();

  // monsters attack the player (only on dangerous islands)
  if (!world.safe) {
    updateMonsters(world, dt, { x: P.x, y: P.y, tx: P.tx, ty: P.ty, dead: P.dead }, (m, ranged) => {
      const d = MONSTER_DEFS[m.kind];
      const roll = ranged && d.ranged ? d.ranged.dmg : d.dmg;
      hurtPlayer(world, P, rndi(roll[0], roll[1]));
    });
    // respawns — never on top of the player (Tibia: nothing spawns on screen);
    // if the whole area is camped, the respawn retries a few seconds later.
    // Camp dwellers return to their settlement; frontier roamers to the wilds.
    if (MONSTERS_ENABLED) {
      for (let i = world.respawns.length - 1; i >= 0; i--) {
        const r = world.respawns[i];
        r.t -= dt;
        if (r.t <= 0) {
          const camp = r.camp ? world.camps.find((c) => c.key === r.camp) : undefined;
          const done = camp
            ? spawnMonsterInCamp(world, r.kind, camp, P)
            : world.key === "deepwild"
              ? spawnWilderness(world, r.kind, P)
              : spawnMonster(world, r.kind, P);
          if (done) world.respawns.splice(i, 1);
          else r.t = RESPAWN_RETRY_S;
        }
      }
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

  // fed regeneration (Tibia-style): HP trickles back only while fed. The fed
  // clock ticks down regardless of HP, exactly like the original.
  if (P.fedS > 0) {
    P.fedS = Math.max(0, P.fedS - dt);
    if (!P.dead && P.hp < P.maxhp) P.hp = Math.min(P.maxhp, P.hp + FED_HP_PER_S * dt);
  }

  // garden aura heal (HP) on home
  for (const s of game.worlds.home.structures) {
    if (s.key === "garden" && cw() === game.worlds.home) {
      const c = structCenter(s);
      if (dist(P.x, P.y, c.x, c.y) < GARDEN_RADIUS) {
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
  tickProximityPanels(dt);
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
      else if (t.s.key === "range") {
        // the straw butt only takes arrows — no bow (or an empty quiver)
        // means nothing to train with, so let go instead of punching it
        flash("you need a bow and arrows", "#e0a06a");
        P.target = null;
      }
      else { if (equippedBow(P.eq)) warnNoArrows(); hitDummy(cw(), P, t.s); }
    }
  } else if (t.kind === "corpse") {
    ui.loot = t.c; openWindow("loot"); P.target = null;
  } else if (t.kind === "ground") {
    if (cw().ground.includes(t.gi)) pickupGround(t.gi);
    P.target = null;
  } else if (t.kind === "npc") {
    if (t.n.key === "taskmaster") { openWindow("tasks"); }
    else if (t.n.key === "tailor") { openWindow("wardrobe"); }
    else { ui.npc = t.n; ui.shopTab = "buy"; openWindow("shop"); }
    P.target = null;
  } else if (t.kind === "structure") {
    if (t.s.key === "forge") openWindow("forge");
    else if (t.s.key === "tower") openWindow("tower");
    else if (t.s.key === "chest") { ui.stash = t.s; openWindow("stash"); }
    else if (t.s.key === "treasure") openTreasure(t.s);
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
  // camera follows player, clamped to island. On desktop the docked sidebar
  // covers the right edge, so the camera shifts by half its width to keep the
  // player centered in the VISIBLE part of the screen.
  const sbWorld = sidebarWidth() / vScale;
  cam.x = clamp(P.x - (VW - sbWorld) / 2, 0, Math.max(0, world.w * TILE - VW));
  cam.y = clamp(P.y - VH / 2, 0, Math.max(0, world.h * TILE - VH));

  vctx.fillStyle = "#1c6060";
  vctx.fillRect(0, 0, VW, VH);
  // baked terrain — blit ONLY the visible source rect. Drawing the whole
  // canvas with an offset made the browser shuffle the full baked bitmap
  // every frame; on the 368x272-tile continent that's a ~5900x4350 px image
  // and was the single biggest source of big-map lag. The source rect is
  // clamped so small islands (map smaller than the view) stay correct.
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
  const srcW = Math.min(VW, world.mapCanvas.width - camX);
  const srcH = Math.min(VH, world.mapCanvas.height - camY);
  vctx.drawImage(world.mapCanvas, camX, camY, srcW, srcH, 0, 0, srcW, srcH);

  // animated coastal foam
  vctx.fillStyle = "rgba(200,240,235,.5)";
  for (const cwv of world.coastWater) {
    const sx = cwv.x - cam.x;
    const sy = cwv.y - cam.y;
    if (sx < -TILE || sy < -TILE || sx > VW || sy > VH) continue;
    const a = 0.5 + 0.5 * Math.sin(waveT * 2 + cwv.ph);
    if (a > 0.6) vctx.fillRect(Math.round(sx + 2), Math.round(sy + 6), 6, 1);
  }

  // building ghost: while placing, preview the structure under the cursor
  // (green = valid spot, red = blocked) anywhere on Home Isle
  if (ui.placing && world === game.worlds.home) {
    const key = ui.placing;
    const n = STRUCTS[key].single ? 1 : 2;
    let tx: number;
    let ty: number;
    if (isTouchDevice()) {
      // no hover on touch: draw the ghost parked by the last tap, or (before
      // any tap) preview it one tile below the player so it's always visible
      if (placeGhost) { tx = placeGhost.tx; ty = placeGhost.ty; }
      else {
        tx = Math.round(P.x / TILE - n / 2);
        ty = Math.round((P.y + TILE) / TILE - n / 2) + 1;
      }
    } else {
      const wx = mouse.sx / vScale + cam.x;
      const wy = mouse.sy / vScale + cam.y;
      tx = Math.round(wx / TILE - n / 2);
      ty = Math.round(wy / TILE - n / 2);
    }
    const ok = canPlaceAt(world, key, tx, ty);
    const gx = tx * TILE - cam.x;
    const gy = ty * TILE - cam.y;
    const a = 0.3 + 0.15 * Math.sin(waveT * 4);
    vctx.fillStyle = ok ? `rgba(120,230,140,${a})` : `rgba(230,90,70,${a})`;
    vctx.fillRect(gx, gy, TILE * n, TILE * n);
    vctx.strokeStyle = ok ? "rgba(180,255,190,.9)" : "rgba(255,140,120,.9)";
    vctx.strokeRect(gx + 0.5, gy + 0.5, TILE * n - 1, TILE * n - 1);
    const spr = structSprite(key);
    vctx.globalAlpha = 0.6;
    vctx.imageSmoothingEnabled = false;
    vctx.drawImage(spr, Math.round(gx + (TILE * n - spr.width) / 2), Math.round(gy + TILE * n - spr.height));
    vctx.globalAlpha = 1;
  }

  // portals — a swirl between islands, a cave mouth / ladder for the caverns
  for (const pt of world.portals) {
    const sx = pt.x - cam.x;
    const sy = pt.y - cam.y;
    if (pt.style === "caveMouth") {
      // a big, unmistakable cave-mouth landmark: shadow, pulsing ring, sprite
      const pulse = 0.5 + 0.5 * Math.sin(waveT * 3);
      vctx.fillStyle = "rgba(20,16,14,0.35)";
      vctx.beginPath();
      vctx.ellipse(sx, sy + 6, 15, 6, 0, 0, 6.2832);
      vctx.fill();
      vctx.strokeStyle = `rgba(230,178,90,${0.25 + 0.35 * pulse})`;
      vctx.lineWidth = 1.5;
      vctx.beginPath();
      vctx.ellipse(sx, sy + 2, 13 + pulse * 3, 9 + pulse * 2, 0, 0, 6.2832);
      vctx.stroke();
      const cmp = SPR.caveMouth;
      vctx.drawImage(cmp, Math.round(sx - cmp.width / 2), Math.round(sy - cmp.height + 6));
      continue;
    }
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
    const dormant = !!pt.inactive;
    for (let r = 8; r > 0; r -= 2) {
      // a dormant pad smoulders ash-grey and barely breathes; a live portal
      // pulses violet — the state reads at a glance from across the hall
      const a = dormant ? 0.10 + 0.04 * Math.sin(waveT * 1.5 + r) : 0.15 + 0.12 * Math.sin(waveT * 4 + r);
      vctx.fillStyle = dormant ? `rgba(140,140,148,${a})` : `rgba(150,110,230,${a})`;
      vctx.beginPath();
      vctx.ellipse(sx, sy, r, r * 0.6, 0, 0, 6.2832);
      vctx.fill();
    }
    vctx.fillStyle = dormant ? "#8d939a" : "#c9a6ff";
    vctx.fillRect(Math.round(sx) - 1, Math.round(sy - 4 + (dormant ? 0 : Math.sin(waveT * 5) * 2)), 2, 8);
  }


  // level gates — a portcullis seals the doorway until the level is reached;
  // an open gate leaves bare doorway (the bars withdrew into the ceiling)
  for (const gt of world.gates) {
    if (P.level >= gt.lv) continue;
    const gx = gt.tx * TILE + TILE / 2 - cam.x;
    const gy = gt.ty * TILE + TILE - cam.y;
    vctx.drawImage(SPR.gate, Math.round(gx - SPR.gate.width / 2), Math.round(gy - SPR.gate.height - 2));
    vctx.font = "bold 6px monospace";
    vctx.fillStyle = "#14171a";
    vctx.fillText(`${gt.lv}`, Math.round(gx) - 3 + 1, Math.round(gy) - 5 + 1);
    vctx.fillStyle = "#ffd98a";
    vctx.fillText(`${gt.lv}`, Math.round(gx) - 3, Math.round(gy) - 5);
  }

  // gather nodes: trees, rocks, herbs (sorted by y with actors below)
  type Drawable = { y: number; fn: () => void };
  const drawList: Drawable[] = [];
  // Viewport culling: anything whose base sits outside the camera view (plus
  // a margin for tall sprites and shadows) is skipped BEFORE a closure is
  // allocated. On the continent (~1000 drawables) this cuts the per-frame
  // build + sort of the draw list down to just the on-screen handful.
  const CULL = 48;
  const inView = (x: number, y: number): boolean =>
    x >= cam.x - CULL && x <= cam.x + VW + CULL && y >= cam.y - CULL && y <= cam.y + VH + CULL;

  for (const tr of world.trees) {
    const bx = tr.tx * TILE + TILE / 2;
    const by = tr.ty * TILE + TILE;
    if (!inView(bx, by)) continue;
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
    // anchor the sprite so it sits CENTRED in its square (a rock is a squat
    // 10x6 sprite — bottom-of-tile anchoring made it hug the tile edge and
    // look like it belonged to the boundary, not the square it blocks)
    const by = rk.ty * TILE + ((TILE + (rk.depleted ? SPR.rubble : SPR.rock).height) >> 1);
    if (!inView(bx, by)) continue;
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
    if (!inView(bx, by)) continue;
    drawList.push({ y: by, fn: () => drawSprite(SPR.herb, bx, by) });
  }
  // structures
  for (const s of world.structures) {
    const spr = structSprite(s.key);
    const c = structCenter(s);
    const bx = c.x;
    const by = c.baseY;
    if (!inView(bx, by)) continue;
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
    if (!inView(c.x, c.y)) continue;
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
    if (!inView(gi.x, gi.y)) continue;
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
    if (!inView(n.x, n.y)) continue;
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
    if (!inView(m.x, m.y)) continue;
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
  const pbob = (P.dest || P.target || P.gather || moveAxisNonZero() || !atCenter(P)) ? Math.sin(P.bob * 10) * 1.2 : 0;
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
    vctx.strokeStyle = sh.color ?? (sh.bone ? "#efe9d6" : "#cfd8da");
    vctx.lineWidth = sh.wide ? 2 : 1;
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

  // HUD + panels (screen space). On desktop the panel windows render at ~70%
  // of the HUD scale (they were comically large on big monitors) and each one
  // additionally auto-shrinks if it would still spill off-screen.
  const sbW = sidebarWidth();
  const hud: HudCtx = {
    ctx: sctx, scale, panelScale: desktopUI ? scale * 0.7 : scale,
    screenW: screen.width, screenH: screen.height, touch: touchUI,
    touchInput: isTouchDevice(), sidebarW: sbW,
  };
  drawHud(hud, game, P);
  hotspots = [];
  itemSlots = [];
  for (const win of ui.windows) { win.rect = null; win.titleBar = null; }
  // panels center themselves on hud.screenW — hand them the VISIBLE width so
  // they open beside the desktop sidebar instead of underneath it
  const hudPanels: HudCtx = sbW > 0 ? { ...hud, screenW: screen.width - sbW } : hud;
  drawPanels({ hud: hudPanels, ui, game, player: P, mouse, act, hotspots, itemSlots });
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
  hudGrips.push({ id, x: gx, y, w, h, gx, gy, gw, gh });
}

/** Slot rects in the desktop sidebar this frame (right-click = rebind). */
let sidebarSlotRects: { i: number; x: number; y: number; w: number; h: number }[] = [];

/** The docked, Tibia-style desktop sidebar: minimap, vitals, gold/TP, panel
 *  buttons, the six action slots and the weapon-swap button in one fixed
 *  opaque column on the right edge. */
function drawSidebar(): void {
  const ctx = sctx;
  const S = scale;
  const sw = screen.width, sh = screen.height;
  const sbW = sidebarWidth();
  const x0 = sw - sbW;
  const pad = 4 * S;
  const inner = sbW - 2 * pad;
  const hud: HudCtx = { ctx, scale: S, screenW: sw, screenH: sh, touch: true, touchInput: isTouchDevice() };
  ctx.textBaseline = "middle";

  // opaque backdrop + left divider (Tibia-style: UI never overlaps the world)
  ctx.fillStyle = "#101c19";
  ctx.fillRect(x0, 0, sbW, sh);
  ctx.fillStyle = "#3d5a50";
  ctx.fillRect(x0, 0, Math.max(1, S), sh);
  // swallow every tap/click on the sidebar so it never walks the player
  // (pushed FIRST so the buttons below win; hotspots are checked in reverse)
  hotspots.push({ x: x0, y: 0, w: sbW, h: sh, fn: () => { /* absorb */ } });
  touchButtons.push({ x: x0, y: 0, w: sbW, h: sh });

  let y = pad;
  // minimap
  drawMinimapAt(hud, game, P, x0 + pad + 2 * S, y + 2 * S, inner - 4 * S);
  y += inner;
  // vitals (HP / EXP / Cap), scaled to the column width
  const Sv = inner / VITALS_W;
  drawVitals(hud, P, x0 + pad, y, Sv);
  y += VITALS_H * Sv + 3 * S;
  // gold + TP
  drawGoldTP(hud, P, x0 + pad, y, inner, 14 * S);
  y += 14 * S + 4 * S;

  // panel toggle buttons (one row of five)
  const pbtns: [string, string, PanelKind][] = [
    ["Build", "B", "build"], ["Skill", "K", "skills"], ["Equip", "E", "equip"], ["Bag", "I", "bag"], ["Quest", "Q", "quest"],
  ];
  const bgap = 1.5 * S;
  const bsz = (inner - (pbtns.length - 1) * bgap) / pbtns.length;
  let bx = x0 + pad;
  for (const [label, glyph, panel] of pbtns) {
    tButton(bx, y, bsz, label, glyph, hasWindow(panel), () => togglePanel(panel));
    bx += bsz + bgap;
  }
  y += bsz + 4 * S;

  // action slots 1–6 in a 3x2 grid (right-click a slot to rebind it)
  sidebarSlotRects = [];
  const cell = (inner - 2 * bgap) / 3;
  for (let i = 0; i < 6; i++) {
    const cxp = x0 + pad + (i % 3) * (cell + bgap);
    const cyp = y + Math.floor(i / 3) * (cell + bgap);
    drawActionSlot(i, cxp, cyp, cell, cell);
    sidebarSlotRects.push({ i, x: cxp, y: cyp, w: cell, h: cell });
  }
  y += 2 * cell + bgap + 4 * S;

  // weapon swap, full width
  const bowOn = P.eq.weapon ? !!ITEMS[P.eq.weapon].bow : false;
  hudBtn(x0 + pad, y, inner, 11 * S, bowOn ? "→MELEE" : "→BOW", false, () => swapWeapon());
  y += 11 * S + 3 * S;

  hudText(hud, "1–6 use · right-click = bind", x0 + sbW / 2, y + 3 * S, 5 * S, "rgba(220,214,190,.5)", "center");
}

function drawTouchControls(): void {
  touchButtons = [];
  hudGrips = [];
  if (desktopUI) { drawSidebar(); return; }

  const editing = hudEditing();
  const u = hudUserScale();
  const bs = clamp(Math.min(screen.width, screen.height) * 0.115, 54, 132) * u;
  const m = bs * 0.16;
  const gap = bs * 0.16;
  const sw = screen.width, sh = screen.height;

  // --- panel-button column (group "panels"), collapsible behind a ≡ button ---
  const pbtns: [string, string, PanelKind][] = [
    ["Build", "B", "build"], ["Skills", "K", "skills"], ["Equip", "E", "equip"], ["Bag", "I", "bag"], ["Quest", "Q", "quest"],
  ];
  const menuOpen = hudMenuOpen() || editing; // edit mode always shows the column
  const togH = bs * 0.5;
  const colH = togH + (menuOpen ? gap + pbtns.length * bs + (pbtns.length - 1) * gap : 0);
  const panelPos = placeHud("panels", bs, colH, sw, sh);
  const anyOpen = pbtns.some(([, , k]) => hasWindow(k));
  hudBtn(panelPos.x, panelPos.y, bs, togH, menuOpen ? "≡ ×" : "≡", !menuOpen && anyOpen, () => {
    if (!editing) toggleHudMenu();
  });
  if (menuOpen) {
    let by = panelPos.y + togH + gap;
    for (const [label, glyph, panel] of pbtns) {
      tButton(panelPos.x, by, bs, label, glyph, hasWindow(panel), () => togglePanel(panel));
      by += bs + gap;
    }
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

  // --- lock / edit toggle: sits just above the vitals (HP) frame ---
  const vw = 190 * scale * u, vh = 54 * scale * u;
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

  // --- edit strip: scale, presets, reset — pinned top-center while editing ---
  if (editing) {
    const btnH = bs * 0.5;
    const sq = bs * 0.55;
    const pctW = bs * 1.1;
    const row1W = sq * 2 + pctW + bs * 1.3 + gap * 3;
    let ex = clamp((sw - row1W) / 2, m, sw - row1W - m);
    const ey = m + 2 * scale;
    hudBtn(ex, ey, sq, btnH, "−", false, () => { stepHudUserScale(-1); saveHudLayout(); });
    ex += sq + gap;
    sctx.fillStyle = "rgba(16,26,24,.85)";
    sctx.fillRect(ex, ey, pctW, btnH);
    sctx.strokeStyle = "#3d5a50";
    sctx.lineWidth = Math.max(1, scale);
    sctx.strokeRect(ex + 0.5, ey + 0.5, pctW - 1, btnH - 1);
    sctx.textAlign = "center";
    sctx.textBaseline = "middle";
    sctx.fillStyle = "#e9e2c8";
    sctx.font = `bold ${Math.round(btnH * 0.42)}px 'Courier New',monospace`;
    sctx.fillText(`${Math.round(u * 100)}%`, ex + pctW / 2, ey + btnH / 2);
    ex += pctW + gap;
    hudBtn(ex, ey, sq, btnH, "+", false, () => { stepHudUserScale(1); saveHudLayout(); });
    ex += sq + gap;
    hudBtn(ex, ey, bs * 1.3, btnH, "RESET", false, () => {
      resetHudLayout();
      flash("HUD layout reset", "#8ab6ff");
    });
    // presets row
    const pw3 = bs * 1.5;
    const row2W = pw3 * 3 + gap * 2;
    let px2 = clamp((sw - row2W) / 2, m, sw - row2W - m);
    const py2 = ey + btnH + gap;
    for (const [label, name] of [["CLASSIC", "classic"], ["COMPACT", "compact"], ["LEFTY", "lefty"]] as const) {
      hudBtn(px2, py2, pw3, btnH, label, false, () => {
        applyHudPreset(name);
        flash(`preset: ${label.toLowerCase()}`, "#8ab6ff");
      });
      px2 += pw3 + gap;
    }
    const hy = clamp(py2 + btnH + gap, m, sh - m);
    sctx.textAlign = "center";
    sctx.textBaseline = "middle";
    sctx.fillStyle = "rgba(207,232,210,.85)";
    sctx.font = `${Math.round(9 * scale)}px 'Courier New',monospace`;
    sctx.fillText("drag handles · tap a slot to bind · groups snap to a grid", sw / 2, hy);
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
  if (throwPending) return true;        // aiming a throw — the tap must land, not steer
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
