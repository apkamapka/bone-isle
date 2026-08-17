import "./style.css";
import { VIEW_W, VIEW_H, TILE, SPRITE_SCALE, MIN_VIEW_W, MIN_VIEW_H, NPC_TALK_HOLD_S, ARROW_MISS_WARN_S, GROUND_DESPAWN_S, MONSTERS_ENABLED, USE_RANGE_PX, RESPAWN_RETRY_S, THROW_RANGE_PX, ITEM_MOVE_REACH_PX, FED_MAX_S, FED_HP_PER_S, MELEE_REACH_PX, worldZoom, WATER_GLINT_COLOR, WATER_GLINT_PCT, WATER_GLINT_ALPHA, WATER_GLINT_DRIFT, WATER_GLINT_LEN, PORTAL_LIVE_HALO, PORTAL_LIVE_CORE, PORTAL_DORMANT_HALO, PORTAL_DORMANT_CORE } from "./config.ts";
import { PACK_BONUS_SLOTS, PACK_MAX, BAG_SIZE } from "./config.ts";
import { unstick, blockedAt, lineOfSight, groundBlocked, portalCovers } from "./world/collision.ts";
import { toTile, glideWalker, tryStep, stepDir, atCenter, findPath, type Occupied } from "./world/grid.ts";
import { mobFrame, npcFrame, corpseSprite } from "./gfx/mobSheet.ts";
import { campfireFrame, FIRE_LIFT, FIRE_BURN_TICK_S, FIRE_BURN_DMG } from "./gfx/fireSheet.ts";
import { scenerySprite, FOOTPRINT } from "./gfx/sceneryArt.ts";
import { updateNpcs, faceToward } from "./entities/npcs.ts";
import { SPR, iconW, iconH, hasPropArt, propSprite } from "./gfx/sprites.ts";
import { itemSprite } from "./gfx/itemArt.ts";
import { loadHeroSheet, heroSprite, heroCorpse } from "./gfx/heroSheet.ts";
import { clamp, dist, rndi } from "./util.ts";
import { playerSpeed, refreshDerived, canCarry, freeCap } from "./entities/player.ts";
import { updateMonsters, MONSTER_DEFS, spawnMonster, spawnMonsterInCamp, spawnWilderness, spawnAtPost } from "./entities/monsters.ts";
import { playerAttack, playerShoot, hitDummy, shootDummy, hurtPlayer, grantExp } from "./systems/combat.ts";
import { gatherTick, tickRegrowth } from "./systems/gather.ts";
import { tryPlace, tryUpgrade, structSprite, STRUCTS, canAfford, payCost, structCenter, canPlaceAt, buildCost, upgradeCost, tierOf, bestTier, footprint, solidRows, countOwned } from "./systems/building.ts";
import { buildingFrame, buildingShadow, hasBuildingArt, recoilFrameIndex, recoilRow } from "./gfx/buildingArt.ts";
import { drawBuildingFx, fxSeed, hasBuildingFx } from "./gfx/buildingFx.ts";
import { applySmelt, smeltBlocker, applyGem, GEM_TROPHY_KINDS, type ForgeTier } from "./systems/smelt.ts";
import { setActiveBonus } from "./systems/derived.ts";
import { applyOutfit, setOutfitColor, resetOutfitColors, type OutfitZone } from "./systems/outfit.ts";
import { useCrystal, tickCrystalCooldown, isAimedCrystal, BURST_TILES, CRYSTAL_SPECS } from "./systems/crystals.ts";
import { actionSlots, setSlot, BINDABLE_CRYSTALS } from "./systems/actions.ts";
import {
  hudLocked, toggleHudLock, placeHud, moveHudGroup, saveHudLayout, resetHudLayout, loadHudLayout,
  hudUserScale, stepHudUserScale, hudMenuOpen, toggleHudMenu, applyHudPreset, snapHudGroup,
  type HudGroup,
} from "./systems/hudLayout.ts";
import { researchById, isResearched, markResearched, towerTierOk, towerTierFor,
  ATTUNEMENT, isAttuned, markAttuned, attunementOk, offerById } from "./systems/tower.ts";
import { ELEMENT_LABEL, ELEMENT_COLOR, type Element } from "./systems/elements.ts";
import { loadPanelPrefs } from "./systems/panelPrefs.ts";
import { skills, type SkillKey } from "./systems/skills.ts";
import { cycleStance, STANCE_LABEL, STANCE_COLOR } from "./systems/stance.ts";
import { totalExpFor } from "./config.ts";
import { quests, claimQuest, syncCollectQuests } from "./systems/quests.ts";
import { acceptTask, abandonTask, handInTask, buyExchange, activeTask } from "./systems/tasks.ts";
import { addItem, removeItem, ITEMS, itemWeight, bagCount, equippedBow, activeArrow, bestPracticeArrow, cycleArrow, compactBag } from "./items.ts";
import { addFloat, updateFloats, drawFloats } from "./fx.ts";
import { updateSpellFx, drawSpellBolts, spellBlastDrawables } from "./gfx/spellFx.ts";
import { updateMonsterSpells } from "./systems/monsterSpells.ts";
import { unlockAudio, beep } from "./audio.ts";
import { initInput, moveAxis } from "./input.ts";
import { initTouch, drawJoystick, isTouchDevice } from "./ui/touch.ts";
import { createGame, travelTo, applyGates, respawnAtHome, homeChests, CHEST_PRIZES, type Game } from "./game.ts";
import { saveGame, loadGame } from "./save.ts";
import { drawHud, type HudCtx } from "./ui/hud.ts";
import { drawPanels, type UiState, type Hotspot, type ItemSlot, type PanelActions, type PanelKind, type PanelWindow } from "./ui/panels.ts";
import { Tile } from "./world/types.ts";
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

  const f = worldZoom(cw, ch, mobile);
  VW = Math.max(MIN_VIEW_W, Math.ceil(cw / f));
  VH = Math.max(MIN_VIEW_H, Math.ceil(ch / f));
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
loadHeroSheet();
resize();

loadHudLayout(); // restore any customized mobile HUD positions + lock state
loadPanelPrefs(); // restore per-window zoom + collapse preferences

const game: Game = loadGame() ?? createGame();
// keep passive structure bonuses (Garden HP) in sync from the start
setActiveBonus({ maxhp: 0 });
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
/**
 * Walk-cycle clock for the hero sheet. Advanced only on frames where the
 * player's position actually CHANGED — intent flags are not motion. Having a
 * combat target, a queued destination or a held key all mean "about to move",
 * and driving the stride off those made the sprite march on the spot whenever
 * the player stood still attacking or bumped into a wall.
 */
let walkT = 0;
let walking = false;
let lastPX = Number.NaN;
let lastPY = Number.NaN;
let saveTimer = 0;
let last = performance.now();

const ui: UiState = { windows: [], placing: null, selSlot: null, loot: null, npc: null, stash: null, shopTab: "buy",
  forgeTab: "craft",
  testPage: 0,
  towerTab: "fire",
  upgrading: null, dragging: false, lookMode: false, inspect: null, split: null };

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
let itemDrag: { src: "bag" | "stash" | "ground" | "eq"; index: number; kind: ItemKind; n: number; sx: number; sy: number; active: boolean; gi?: GroundItem; eqSlot?: EqSlot; touch?: boolean } | null = null;
/** Pending mobile throw (chosen in the quantity popup): next world tap aims it. */
let throwPending: { kind: ItemKind; n: number } | null = null;
/**
 * An armed Burst. Selecting the crystal does not cast it — it puts the game in
 * targeting mode and the NEXT world click says where the fireball lands, which
 * is how Tibia has always thrown a great fireball. Cleared by the click either
 * way, by Escape, by right-click, and by dying.
 */
let aimPending: ItemKind | null = null;

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
    if (Math.abs(wx - gi.x) < 18 && wy > gi.y - 28 && wy < gi.y + 8) {
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
      itemDrag = { src: it.src, index: it.index, kind: it.kind, n: it.n, sx, sy, active: false, touch: isTouch, eqSlot: it.eqSlot };
      return true;
    }
  }
  return false;
}

// mobile HUD customization (Etap 7): rebind picker + group dragging
let assignSlot: number | null = null;
let hudDrag: { id: HudGroup; dx: number; dy: number; moved: boolean; gw: number; gh: number } | null = null;
let hudGrips: { id: HudGroup; x: number; y: number; w: number; h: number; gx: number; gy: number; gw: number; gh: number }[] = [];
/** True when the customizable HUD is in edit (unlocked) mode. The same
 *  drag-and-drop HUD is used everywhere — desktop included (Etap 13). */
function hudEditing(): boolean {
  return touchUI && !hudLocked();
}

const cw = (): World => game.current;
const flash = (t: string, c = "#ffe9a8"): void => addFloat(cw(), P.x, P.y - 60, t, c);

/** Recompute the player's max HP from current owned structures. */
function recomputeBonuses(): void {
  setActiveBonus({ maxhp: 0 });
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
  smelt: (kind: ItemKind) => { doSmelt(kind); },
  testGrant: (kind: ItemKind) => { doTestGrant(kind); },
  makeGem: () => { doMakeGem(); },
  upgrade: (s: Structure) => { doUpgrade(s); },
  craft: (r: Recipe) => {
    // craft requires standing at a Forge; enforced by only opening forge there
    if (craftAt(r)) beep(360, 0.14, "square", 0.05);
  },
  attune: (el: Element) => { doAttune(el); },
  buyOffer: (id: string) => { doBuyOffer(id); },
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
  cycleAmmo: () => {
    const next = cycleArrow(P.bag, P.ammo);
    if (!next) { flash("no ammo to load", "#cfa86a"); return; }
    P.ammo = next;
    flash(`ammo: ${ITEMS[next].name}`, "#ffe9a8");
    beep(520, 0.05, "sine", 0.04, 60);
  },
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

/** Is this pixel over open water? */
function waterAt(w: World, px: number, py: number): boolean {
  const x = Math.floor(px / TILE);
  const y = Math.floor(py / TILE);
  if (x < 0 || y < 0 || x >= w.w || y >= w.h) return false;
  return w.tile[y][x] === Tile.Water;
}

/**
 * Where a throw aimed at (tx,ty) actually lands. The target is clamped to
 * THROW_RANGE_PX from the player, snapped to the tile centre, then — if that
 * tile is solid or out of sight — slides back along the throw line toward the
 * player half a tile at a time until it's legal (Tibia does the same: an item
 * thrown at a wall falls at its foot). Worst case it lands at your feet.
 *
 * WATER is a legal landing spot even though it is not walkable, and `sank`
 * says so. The sea is the game's rubbish bin: what goes in does not come
 * back, there is no prompt, and the throw range is the ordinary one — the
 * whole gesture has to be as cheap as throwing onto grass or it stops being
 * a way to get rid of things.
 */
function resolveThrowTarget(tx: number, ty: number): { x: number; y: number; sank: boolean } {
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
    if (!lineOfSight(world, P.x, P.y, cx, cy)) continue;
    const wet = waterAt(world, cx, cy);
    if (wet || !blockedAt(world, cx, cy)) return { x: cx, y: cy, sank: wet };
  }
  return { x: P.x, y: P.y + 4, sank: false };
}

/** Swallow a stack thrown into the sea. Nothing is recoverable. */
function sink(kind: ItemKind, n: number, x: number, y: number): void {
  addFloat(cw(), x, y - 12, "splash", "#8ecfff");
  flash(`${n} ${ITEMS[kind].name} sank`, "#8ecfff");
  beep(150, 0.18, "sine", 0.05, -90);
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
  const gx = (back?.x ?? dest.w * TILE / 2) + (Math.random() - 0.5) * 16;
  const gy = (back?.y ?? dest.h * TILE / 2) + 28;
  const near = dest.ground.find((g) => g.kind === kind && Math.hypot(g.x - gx, g.y - gy) < 14);
  if (near) near.n += n;
  else dest.ground.push({ kind, n, x: gx, y: gy, t: GROUND_DESPAWN_S });
  flash(`whoosh — ${n} ${ITEMS[kind].name} through the portal!`, "#8ab6ff");
  beep(600, 0.12, "sine", 0.05, -220);
}

/** The portal (if any) whose swirl covers world point (x,y). A dormant pad is
 *  not a portal for this purpose: it refuses to carry the player, so it must
 *  not swallow a thrown stack either — the goods would land on the far side of
 *  a door that doesn't open. Items simply drop on top of it instead. */
function portalAt(x: number, y: number): { dest: WorldKey } | null {
  for (const pt of cw().portals) {
    if (pt.inactive) continue;
    if (portalCovers(pt, x, y, 24)) return pt;
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
    if (t.sank) { sink(kind, n, t.x, t.y); return; }
    gx = t.x; gy = t.y;
  } else {
    const jitter = () => (Math.random() - 0.5) * 16;
    gx = P.x + jitter();
    gy = P.y + 4 + jitter();
  }
  // merge into a very close stack of the same kind to avoid clutter
  const near = world.ground.find((g) => g.kind === kind && Math.hypot(g.x - gx, g.y - gy) < 14);
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
  // ...and shoving one into the sea loses it, exactly like a bag throw
  if (t.sank) {
    const idx = world.ground.indexOf(gi);
    if (idx >= 0) world.ground.splice(idx, 1);
    sink(gi.kind, gi.n, t.x, t.y);
    return;
  }
  const near = world.ground.find((g) => g !== gi && g.kind === gi.kind && Math.hypot(g.x - t.x, g.y - t.y) < 14);
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

/** Take gear off a paperdoll slot and throw it on the ground (optionally aimed).
 *  Worn gear never counted toward carry cap, so this needs no weight check —
 *  it goes straight from the body to the floor, Tibia-style. */
function dropFromEq(slot: EqSlot, tx?: number, ty?: number): void {
  const kind = P.eq[slot];
  if (!kind) return;
  P.eq[slot] = null;
  refreshDerived(P);
  dropToGround(kind, 1, tx, ty);
  beep(300, 0.08, "triangle", 0.05);
}

/** Move gear from a paperdoll slot straight into the open storage chest. */
function storeFromEq(slot: EqSlot): void {
  const kind = P.eq[slot];
  if (!kind) return;
  const stash = openStash();
  if (!stash) return;
  if (addItem(stash, kind, 1) > 0) { flash("chest full"); return; }
  P.eq[slot] = null;
  refreshDerived(P);
  beep(300, 0.08, "triangle", 0.05);
}

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
      // worn gear dropped onto a bag cell → unequip; onto a chest cell → store
      else if (d.src === "eq") {
        if (!d.eqSlot) return;
        if (it.src === "stash") storeFromEq(d.eqSlot);
        else act.unequip(d.eqSlot);
      }
      // something dropped onto an equipment cell → wear it
      else if (it.src === "eq") {
        if (d.src === "bag") act.equipItem(d.kind, d.index);
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
    else if (overStash && d.src === "eq" && d.eqSlot) storeFromEq(d.eqSlot);
    else if (d.src === "eq" && d.eqSlot) {
      // dropped anywhere on the bag panel → unequip into the backpack
      const overBag = ui.windows.some((w) => w.kind === "bag" && w.rect &&
        rx >= w.rect.x && rx < w.rect.x + w.rect.w && ry >= w.rect.y && ry < w.rect.y + w.rect.h);
      if (overBag) act.unequip(d.eqSlot);
    }
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
  } else if (d.src === "eq" && d.eqSlot) {
    // worn gear thrown onto the map — the reported bug: this had no path at all
    dropFromEq(d.eqSlot, wx, wy);
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

/**
 * TEST ONLY — 100 of anything for one gold.
 *
 * Weight is deliberately not checked: the point is to put a feature in front
 * of the developer immediately, and refusing on encumbrance would defeat that.
 * Bag SLOTS still apply, because a full backpack has nowhere to put them and
 * silently eating the gold would be worse than saying so.
 */
/**
 * TEST ONLY — a gold buys one slot's worth of anything.
 *
 * "One slot's worth" rather than a flat 100, because the two halves of the
 * catalog want different numbers. Wood, arrows and coal are things you hold a
 * hundred of, and handing over one is useless for testing. A sword is a thing
 * you hold ONE of: a hundred of them buries the backpack, the chest and the
 * carry limit under a single click, which is exactly what happened before
 * this read the stack size.
 */
function doTestGrant(kind: ItemKind): void {
  if (P.gold < 1) { flash("no gold", "#d96a5a"); return; }
  const want = Math.min(100, ITEMS[kind].stack);
  const left = addItem(P.bag, kind, want);
  if (left === want) { flash("bag full", "#d96a5a"); return; }
  P.gold -= 1;
  flash(`TEST +${want - left} ${ITEMS[kind].name}`, "#e08a7a");
}

/** Best Forge standing on Home Isle: 0 none, 1..3 otherwise. */
function forgeTier(): ForgeTier {
  return Math.max(1, bestTier(game.worlds.home, "forge")) as ForgeTier;
}
/** Best Alchemy Tower standing on Home Isle. */
function towerTier(): number {
  return bestTier(game.worlds.home, "tower");
}

/**
 * Put one piece of gear in the furnace.
 *
 * Only ever consumes from the BACKPACK, never from a chest: melting is
 * destructive and irreversible, and reaching into storage to destroy
 * something the player did not have in hand is exactly the kind of help
 * nobody wants. Coal, being a bulk material like any other, may come from
 * the chest.
 */
function doSmelt(kind: ItemKind): void {
  const bags = [P.bag, ...homeChests(game)];
  const why = smeltBlocker(bags, kind, forgeTier());
  if (why === "no-coal") { flash("no coal for the furnace", "#d96a5a"); return; }
  if (why !== null) return;
  const y = applySmelt(bags, kind, forgeTier())!;
  giveMaterial("iron", y.iron);
  giveMaterial("steel", y.steel);
  const parts = [y.iron > 0 ? `${y.iron} iron` : "", y.steel > 0 ? `${y.steel} steel` : ""].filter(Boolean);
  flash(`smelted → ${parts.join(" + ")}`, "#b9e07f");
  beep(180, 0.16, "sawtooth", 0.05, 60);
}

/** Backpack first, then the chests, then the floor — never nowhere. */
function giveMaterial(kind: ItemKind, n: number): void {
  if (n <= 0) return;
  let left = addItem(P.bag, kind, n);
  for (const ch of homeChests(game)) { if (left <= 0) break; left = addItem(ch, kind, left); }
  if (left <= 0) return;
  const w0 = cw();
  const near = w0.ground.find((gi) => gi.kind === kind && Math.hypot(gi.x - P.x, gi.y - P.y) < 14);
  if (near) near.n += left;
  else w0.ground.push({ kind, n: left, x: P.x, y: P.y, t: GROUND_DESPAWN_S });
  flash(`${left} ${ITEMS[kind].name} dropped at your feet`, "#e0a06a");
}

/** Cut one Essential Gem from three DIFFERENT trophies plus coal. */
function doMakeGem(): void {
  if (forgeTier() < 3) { flash("needs a Forge III", "#d96a5a"); return; }
  const bags = [P.bag, ...homeChests(game)];
  const spent = applyGem(bags);
  if (!spent) { flash(`needs ${GEM_TROPHY_KINDS} different trophies + coal`, "#d96a5a"); return; }
  giveMaterial("essentialGem", 1);
  flash("cut an Essential Gem", "#c9a6ff");
  beep(660, 0.2, "sine", 0.06, 140);
}

/** Raise the structure the player is standing at by one tier. */
function doUpgrade(s: Structure): void {
  const cost = upgradeCost(s.key, tierOf(s));
  if (!cost) { flash("already at the top tier", "#e0a06a"); return; }
  if (!canAfford(P.bag, cost, homeChests(game))) { flash("not enough materials", "#d96a5a"); return; }
  tryUpgrade(game.worlds.home, P, s, homeChests(game));
}

/**
 * Spend one attunement stone to open an element's lane.
 *
 * Deliberately separate from doResearch: attunement is not a project, has no
 * tower-tier gate, and must stay reachable at every tier so a lane can never
 * strand itself off the bottom of the panel.
 */
function doAttune(el: Element): void {
  if (isAttuned(el)) return;
  const key = ATTUNEMENT[el];
  if (!canAfford(P.bag, { [key]: 1 }, homeChests(game))) {
    flash(`needs a ${ITEMS[key].name}`, "#d96a5a");
    return;
  }
  payCost(P.bag, { [key]: 1 }, homeChests(game));
  markAttuned(el);
  flash(`attuned to ${ELEMENT_LABEL[el]}`, "#c9a6ff");
  beep(600, 0.22, "square", 0.06, 140);
}

/**
 * Buy a batch off the elemental shelf. No research step: the stone opened the
 * element, the tower sets the price, and gold does the rest.
 */
function doBuyOffer(id: string): void {
  const o = offerById(id);
  if (!o || !isAttuned(o.element)) return;
  if (!canAfford(P.bag, o.cost, homeChests(game))) { flash("need materials"); return; }
  if (P.gold < o.gold) { flash("need gold", "#d96a5a"); return; }
  if (!canCarry(P, o.crystal, o.buyN)) { flash("too heavy"); return; }
  const moved = o.buyN - addItem(P.bag, o.crystal, o.buyN);
  if (moved < o.buyN) { if (moved > 0) removeItem(P.bag, o.crystal, moved); flash("bag full"); return; }
  payCost(P.bag, o.cost, homeChests(game));
  P.gold -= o.gold;
  flash(`+${o.buyN} ${ITEMS[o.crystal].name}`, "#b9e07f");
  beep(520, 0.18, "square", 0.05, 90);
}

function doResearch(id: string): void {
  const r = researchById(id);
  if (!r || isResearched(r.id)) return;
  if (!towerTierOk(r, towerTier())) { flash(`needs an Alchemy Tower ${"I".repeat(towerTierFor(r))}`, "#d96a5a"); return; }
  if (!attunementOk(r)) { flash("attune this element first", "#d96a5a"); return; }
  if (!canAfford(P.bag, r.researchCost, homeChests(game))) { flash("need materials"); return; }
  if (P.gold < (r.researchGold ?? 0)) { flash("need gold", "#d96a5a"); return; }
  payCost(P.bag, r.researchCost, homeChests(game));
  P.gold -= r.researchGold ?? 0;
  markResearched(r.id);
  flash(`researched ${r.name}`, "#c9a6ff");
  beep(520, 0.18, "square", 0.06, 120);
}

function doBuyCrystal(id: string): void {
  const r = researchById(id);
  if (!r || !isResearched(r.id)) return;
  if (!canAfford(P.bag, r.buyCost, homeChests(game))) { flash("need materials"); return; }
  if (P.gold < (r.buyGold ?? 0)) { flash("need gold", "#d96a5a"); return; }
  if (!canCarry(P, r.crystal, r.buyN)) { flash("too heavy"); return; }
  const moved = r.buyN - addItem(P.bag, r.crystal, r.buyN);
  if (moved < r.buyN) { if (moved > 0) removeItem(P.bag, r.crystal, moved); flash("bag full"); return; }
  payCost(P.bag, r.buyCost, homeChests(game));
  P.gold -= r.buyGold ?? 0;
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
  if (isAimedCrystal(kind)) {
    // selecting the armed crystal again puts the cursor away, the same toggle
    // clicking your own target uses to stop attacking
    if (aimPending === kind) { aimPending = null; flash("cast cancelled", "#8ab6ff"); return; }
    // check the stack BEFORE arming, so selecting an empty one says so now
    // rather than after the player has picked a square
    if (bagCount(P.bag, kind) <= 0) { flash("no crystal", "#8ab6ff"); return; }
    aimPending = kind;
    flash(`${ITEMS[kind].name}: click a target`, "#ffce4a");
    return;
  }
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
  // an armed Burst lands here. The cursor is spent by the click whether or not
  // the throw was legal, exactly as Tibia spends it — a miss costs the aim,
  // never the charge, and re-arming is one click.
  if (aimPending) {
    const kind = aimPending;
    aimPending = null;
    useCrystal(cw(), P, kind, { x: w.x, y: w.y });
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
    } else if (!canAfford(P.bag, buildCost(key, countOwned(game.worlds.home, key)), homeChests(game))) {
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
  onStance: () => {
    const s = cycleStance();
    flash(STANCE_LABEL[s], STANCE_COLOR[s]);
  },
  onEscape: () => {
    if (throwPending) { throwPending = null; flash("throw cancelled", "#8ab6ff"); return; }
    if (aimPending) { aimPending = null; flash("cast cancelled", "#8ab6ff"); return; }
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
      // …except while aiming, where it puts the cursor away instead of
      // marching the player into his own fireball
      if (aimPending) { aimPending = null; flash("cast cancelled", "#8ab6ff"); return; }
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
  // mouse convenience: right-click an action slot to open the rebind picker
  if (e.button === 2) {
    for (const r of actionSlotRects) {
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
  // World-keyed prizes (the Marrow set). A chest may hold more than one piece
  // — Orc Deep -1 buries both plate pieces together — and anything unmapped
  // falls back to the classic blade, so old saves behave identically.
  const prizes: readonly ItemKind[] = CHEST_PRIZES[cw().key] ?? ["marrowBlade"];
  for (const prize of prizes) {
    const fits = freeCap(P) >= itemWeight(prize, 1) && addItem(P.bag, prize, 1) === 0;
    if (!fits) dropToGround(prize, 1);
  }
  flash(`You have found ${prizes.map((k) => ITEMS[k].name).join(" and ")}.`, "#ffe9a8");
  beep(660, 0.18, "sine", 0.06, 220);
  saveGame(game);
}

function worldClick(w: Vec): void {
  if (P.dead) return;
  const world = cw();
  // monsters
  for (const m of world.monsters) {
    if (Math.abs(w.x - m.x) < m.spr.width / 2 && w.y > m.y - m.spr.height && w.y < m.y + 10) {
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
    if (Math.abs(w.x - gi.x) < 18 && w.y > gi.y - 28 && w.y < gi.y + 8) {
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
    if (Math.abs(w.x - c.x) < 20 && Math.abs(w.y - c.y) < 16) {
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
    const spr = npcSpr(n);
    if (Math.abs(w.x - n.x) < spr.width / 2 && w.y > n.y - spr.height && w.y < n.y + 10) {
      P.target = { kind: "npc", n };
      // clicked: he stops where he is and turns to face you, Tibia-style. The
      // hold is refreshed by tickNpcTalk for as long as the conversation lasts.
      n.talk = NPC_TALK_HOLD_S;
      faceToward(n, P.x, P.y);
      P.dest = null; P.gather = null; moveMarker = null;
      return;
    }
  }
  // structures (dummy to hit, forge/chest to use). The hitbox covers the tiles
  // the structure BLOCKS: a click there could never have been a step, so
  // reading it as "use this" costs nothing, and a click anywhere else stays a
  // walk order. That keeps the row behind a chest reachable — it is walkable,
  // so it is not part of the box — while making the wide drawn buildings
  // clickable across their whole base instead of a 30 px patch in the middle,
  // which is all the old fixed box covered once the artwork trebled in size.
  for (const s of world.structures) {
    const c = structCenter(s);
    const n = footprint(s.key);
    const half = Math.max(SPR.corpse.width / 2, (n * TILE) / 2);
    const reach = Math.max(SPR.corpse.height * 2, solidRows(s.key) * TILE);
    if (Math.abs(w.x - c.x) < half && w.y > c.baseY - reach && w.y < c.baseY + 8) {
      if (s.key === "dummy" || s.key === "range") {
        // re-clicking the dummy you're training on stops the attack (toggle)
        if (P.target?.kind === "dummy" && P.target.s === s) {
          P.target = null;
          flash("attack stopped", "#8ab6ff");
          return;
        }
        P.target = { kind: "dummy", s };
      }
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
    if (Math.abs(w.x - cx) < 16 && w.y > tr.ty * TILE + TILE - 54 && w.y < tr.ty * TILE + TILE + 4) {
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
    if (Math.abs(w.x - cx) < 16 && Math.abs(w.y - cy) < 16) {
      P.gather = { kind: "rock", obj: rk };
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
  return { x: c.x, y: c.baseY - 4 };
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
      ? bestPracticeArrow(P.bag, P.ammo)
      : activeArrow(P.bag, P.ammo);
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
    faceDelta(m.x - P.x, m.y - P.y);
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
    faceDelta(tp.x - P.x, tp.y - P.y);
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
    faceDelta(m.x - P.x, m.y - P.y);
    if (equippedBow(P.eq)) warnNoArrows(); // bow with an empty quiver pokes, but nags
    if (playerAttack(cw(), P, m)) P.target = null;
  }
}

/* ---------------- grid walking (player) ---------------- */

/** Cached A* route the player is currently following (tile coords). */
let walkRoute: { x: number; y: number }[] = [];
let walkKey = "";

/**
 * Tiles claimed by creatures — the player can never step onto one. Townsfolk
 * count: now that the smith walks, sharing his square would let him slide
 * through you, and A* routes around him for free anyway.
 */
function playerOcc(world: World): Occupied {
  return (tx, ty) => world.monsters.some((m) => m.tx === tx && m.ty === ty)
    || world.npcs.some((n) => n.tx === tx && n.ty === ty);
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
      faceDelta(sx, sy);
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
      faceDelta(s2x, s2y);
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

/**
 * Refresh the "someone is talking to me" hold. A townsperson is in conversation
 * while you hold them as a target OR while the window they opened is up — the
 * shop for its own NPC, the board for the taskmaster, the wardrobe for the
 * tailor. The hold decays on its own once all of that stops being true, so
 * nobody needs to remember to release it.
 */
function tickNpcTalk(world: World): void {
  const hold = (n: Npc | null | undefined): void => {
    if (n && world.npcs.includes(n)) n.talk = NPC_TALK_HOLD_S;
  };
  if (P.target?.kind === "npc") hold(P.target.n);
  if (hasWindow("shop")) hold(ui.npc);
  if (hasWindow("tasks")) hold(world.npcs.find((n) => n.key === "taskmaster"));
  if (hasWindow("wardrobe")) hold(world.npcs.find((n) => n.key === "tailor"));
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

/**
 * Standing in a campfire burns you.
 *
 * A camp fire seals nothing — its artwork is one tile exactly and only
 * twenty-one rows of it are flame, so a third of a solid square used to read as
 * bare ground the player was refused entry to. Making it walkable removed that
 * lie; this puts the cost back, which is what "walk through it if you like"
 * ought to mean.
 *
 * Deliberately the same shape as the burning ground a monster's fire field
 * leaves: elemental, so it goes straight past shield and armour — you cannot
 * raise a buckler against a fire you are standing in — one bite per tile per
 * tick, and no floating label, because the flame under your feet is the label.
 * The clock is keyed per TILE, so crossing three fires in a row costs three
 * bites while standing in one costs one.
 */
const fireClock = new Map<string, number>();
let fireT = 0;

function tickCampfireBurn(world: World, dt: number): void {
  fireT += dt;
  if (P.dead) return;
  for (const f of world.fires) {
    if (f.tx !== P.tx || f.ty !== P.ty) continue;
    const key = `${world.key}|${f.tx}|${f.ty}`;
    const next = fireClock.get(key) ?? 0;
    if (fireT < next) continue;
    fireClock.set(key, fireT + FIRE_BURN_TICK_S);
    hurtPlayer(world, P, rndi(FIRE_BURN_DMG[0], FIRE_BURN_DMG[1]), true);
  }
  // the map's fires never move, but travelling between worlds retires the keys
  if (fireClock.size > 64) {
    for (const k of fireClock.keys()) if (!k.startsWith(`${world.key}|`)) fireClock.delete(k);
  }
}

function checkPortals(): void {
  if (P.tpCd > 0) return;
  for (const pt of cw().portals) {
    if (portalCovers(pt, P.x, P.y)) {
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
  // actual displacement this tick, not what the player meant to do
  walking = P.x !== lastPX || P.y !== lastPY;
  if (walking) walkT += dt;
  lastPX = P.x;
  lastPY = P.y;

  // death → respawn countdown
  if (P.dead) {
    P.deadT -= dt;
    if (P.deadT <= 0) respawnAtHome(game);
    updateFloats(dt);
    updateSpellFx(dt);  // the spell that killed you still gets to finish
    // …and so does the cast behind it: a creature rooted in its windup when
    // you died would still be rooted when you walked back in.
    updateMonsterSpells(game.current, dt, { tx: P.tx, ty: P.ty, dead: true }, () => {});
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
  // Tibia-style grid walking: whatever state we're in, ALWAYS finish the
  // in-flight glide toward the current tile centre FIRST. A step, once begun,
  // always completes — so the player can never come to rest between tiles
  // (releasing the key mid-step no longer freezes it half-way; approaching a
  // monster / node settles it cleanly too). The unspent budget then funds any
  // NEW steps below. While the glide is still running this frame `budget`
  // comes back 0 and every branch simply waits a frame.
  let budget = playerSpeed(P) * dt;
  budget = glideWalker(P, budget);
  if (ax.dx || ax.dy) {
    P.dest = null; P.gather = null; pendingLoot = null;
    if (!kiting && !holdMelee) P.target = null; // non-combat targets still drop
    const occ = playerOcc(world);
    for (;;) {
      if (budget <= 0) break;
      const { sx, sy } = stepDir(ax.dx, ax.dy);
      if (!sx && !sy) break;
      // diagonal blocked → slide along whichever axis is free (wall hugging)
      if (!tryStep(world, P, sx, sy, occ)
        && !(sx && sy && (tryStep(world, P, sx, 0, occ) || tryStep(world, P, 0, sy, occ)))) break;
      budget = glideWalker(P, budget); // glide onto the freshly-claimed tile
    }
    walkKey = ""; // manual steps invalidate any cached auto-route
    faceDelta(ax.dx, ax.dy);
  } else if (P.dest) {
    const gx = toTile(P.dest.x);
    const gy = toTile(P.dest.y);
    const there = P.tx === gx && P.ty === gy && atCenter(P);
    if (there) P.dest = null;
    else {
      const moved = walkGrid(world, gx, gy, budget);
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
      if (d > reach) walkGrid(world, toTile(tp.x), toTile(tp.y), budget);
      else resolveTarget();
    }
  } else if (kiting) {
    // idle bowman: close the gap when the target drifted out of range OR a
    // wall blocks the shot (walk around the corner instead of standing dumb)
    const tp = targetPoint();
    if (tp) {
      const d = dist(P.x, P.y, tp.x, tp.y);
      const blocked = P.target?.kind === "mob" && !lineOfSight(world, P.x, P.y, tp.x, tp.y);
      if (d > mode.reach || blocked) walkGrid(world, toTile(tp.x), toTile(tp.y), budget);
    }
  } else if (P.gather) {
    const gp = gatherPoint();
    if (gp) {
      const d = dist(P.x, P.y, gp.x, gp.y);
      if (d > MELEE_REACH_PX) walkGrid(world, toTile(gp.x), toTile(gp.y), budget);
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
          // caves respawn uniformly across the floor (same as populate), so
          // kills don't slowly re-clump every creature back into one corner.
          const caveUniform = world.key !== "wild" && world.key !== "deepwild";
          const done = r.guard
            ? spawnAtPost(world, r.kind, r.guard.tx, r.guard.ty, P)
            : camp
              ? spawnMonsterInCamp(world, r.kind, camp, P)
              : world.key === "deepwild"
                ? spawnWilderness(world, r.kind, P)
                : spawnMonster(world, r.kind, P, caveUniform);
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

  // structure anim
  for (const s of world.structures) { s.anim = (s.anim ?? 0) + dt; if (s.hurtT) s.hurtT = Math.max(0, s.hurtT - dt); }

  // arrows in flight (cosmetic — the hit already landed when fired)
  if (noArrowWarnT > 0) noArrowWarnT = Math.max(0, noArrowWarnT - dt);
  for (let i = world.shots.length - 1; i >= 0; i--) {
    const sh = world.shots[i];
    sh.p += dt / sh.dur;
    if (sh.p >= 1) world.shots.splice(i, 1);
  }

  // spell bolts and the blooms they leave (also cosmetic, same rule)
  updateSpellFx(dt);
  // monster casts: windups landing, and the ground they left on fire. This is
  // the one place spell damage reaches the player from a creature, so it is
  // deliberately the same `hurtPlayer` the melee exchange uses — elemental
  // damage ignores armor on its own, inside the damage roll.
  updateMonsterSpells(world, dt, { tx: P.tx, ty: P.ty, dead: P.dead }, (dmg, el, name) => {
    hurtPlayer(world, P, dmg, true);
    // Only the discrete hits announce themselves. The per-second burn passes
    // `null`: it already draws a number every tick, and stacking the word
    // "burning" on top of it once a second buried the player under his own
    // damage log while he was standing in a fire he can plainly see.
    if (name) addFloat(world, P.x, P.y - 26, name, ELEMENT_COLOR[el]);
  });

  tickCampfireBurn(world, dt);

  tickRegrowth(world, dt, P.x, P.y, true);
  tickNpcTalk(world);
  updateNpcs(world, dt, P.x, P.y);
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
    // Someone with neither a shop nor a panel of their own has nothing to open
    // yet — say so rather than putting an empty window on screen.
    else if (!SHOPS[t.n.key]) { flash(`${t.n.name} has nothing to say… yet`, "#b9a6d8"); }
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

/**
 * How wide a creature's shadow is, when the default 16 is wrong.
 *
 * This is a HALF-width: `drawShadow` takes it as an ellipse radius.
 *
 * Hand-tuned per kind, the same arrangement the buildings use, and for the
 * same reason: the number that looks right is the width of what actually
 * TOUCHES the ground, which no sprite dimension reports. The dragon's frame is
 * 110 px across and only 90 of that is animal — the rest is the transparent
 * padding that keeps its anchor over its feet — while the stance itself, front
 * paws to hind, spans barely half the body. Derived from the frame it would
 * fall under the tail; derived from the sprite it would fall under thin air.
 */
const MOB_SHADOW: Readonly<Record<string, number>> = {
  dragon: 24,
};

function drawShadow(x: number, y: number, w = 16): void {
  vctx.fillStyle = "rgba(0,0,0,.22)";
  vctx.beginPath();
  vctx.ellipse(x - cam.x, y - cam.y + 2, w, w * 0.4, 0, 0, 6.2832);
  vctx.fill();
}


/**
 * Pick the render facing from a movement/aim delta. Vertical wins only when it
 * clearly dominates, so diagonal movement keeps the more readable side view —
 * the same bias Tibia's outfits use.
 */
function faceDelta(dx: number, dy: number): void {
  const P = game.player;
  if (Math.abs(dy) > Math.abs(dx) * 1.4) P.dir = dy < 0 ? "up" : "down";
  else if (dx !== 0) { P.dir = "side"; P.face = dx < 0 ? -1 : 1; }
}

/**
 * The sprite a townsperson is showing right now: their walk-sheet frame if one
 * is loaded, otherwise the baked stand-in. Hit-testing, drawing and the quest
 * marker all go through here so the click box always matches the pixels.
 */
function npcSpr(n: Npc): HTMLCanvasElement {
  return npcFrame(n.key, n.dir, n.moving, n.phase) ?? n.spr;
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

function hpBar(x: number, y: number, frac: number, w = 28): void {
  vctx.fillStyle = "#000";
  vctx.fillRect(Math.round(x - cam.x - w / 2) - 2, Math.round(y - cam.y) - 2, w + 4, 8);
  vctx.fillStyle = "#5d1a14";
  vctx.fillRect(Math.round(x - cam.x - w / 2), Math.round(y - cam.y), w, 4);
  vctx.fillStyle = "#e1483b";
  vctx.fillRect(Math.round(x - cam.x - w / 2), Math.round(y - cam.y), Math.round(w * clamp(frac, 0, 1)), 4);
}

function render(): void {
  const world = cw();
  // camera follows player, clamped to island
  cam.x = clamp(P.x - VW / 2, 0, Math.max(0, world.w * TILE - VW));
  cam.y = clamp(P.y - VH / 2, 0, Math.max(0, world.h * TILE - VH));

  vctx.fillStyle = "#1c6060";
  vctx.fillRect(0, 0, VW, VH);
  // baked terrain — blit ONLY the visible source rect. Drawing the whole
  // canvas with an offset made the browser shuffle the full baked bitmap
  // every frame; on the 368x272-tile continent that's a ~5900x4350 px image
  // and was the single biggest source of big-map lag. The source rect is
  // clamped so small islands (map smaller than the view) stay correct.
  // Since Etap 17 that canvas is painted at MAP_TILE (legacy 16 px per tile)
  // and blown up SPRITE_SCALE times right here — nearest-neighbour, so what
  // lands on screen is the exact 16-px-era terrain, only chunkier. Baking it at
  // TILE instead would quadruple a bitmap that is already ~25 Mpx on the
  // continent, which phones refuse to allocate. The source rect is floored to
  // whole source pixels and the remainder paid back on the destination, so the
  // camera still pans one world pixel at a time with no wobble.
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
  // A Tiled export is already at native tile resolution, so it blits 1:1;
  // the procedural bake is half-scale and gets blown up by SPRITE_SCALE.
  const art = world.mapImage;
  const srcImg: CanvasImageSource = art ?? world.mapCanvas;
  const artW = art ? art.naturalWidth : world.mapCanvas.width;
  const artH = art ? art.naturalHeight : world.mapCanvas.height;
  const K = art ? 1 : SPRITE_SCALE;
  const sx0 = Math.floor(camX / K);
  const sy0 = Math.floor(camY / K);
  const offX = camX - sx0 * K;
  const offY = camY - sy0 * K;
  const srcW = Math.min(Math.ceil(VW / K) + 1, artW - sx0);
  const srcH = Math.min(Math.ceil(VH / K) + 1, artH - sy0);
  vctx.imageSmoothingEnabled = false;
  if (srcW > 0 && srcH > 0) {
    vctx.drawImage(srcImg, sx0, sy0, srcW, srcH, -offX, -offY, srcW * K, srcH * K);
  }

  // Animated sea over a still export: drifting glints on the water tiles the
  // collision grid already knows about. Only the visible window is walked.
  if (art) {
    vctx.fillStyle = WATER_GLINT_COLOR;
    const tx0 = Math.max(0, Math.floor(cam.x / TILE));
    const ty0 = Math.max(0, Math.floor(cam.y / TILE));
    const tx1 = Math.min(world.w - 1, Math.ceil((cam.x + VW) / TILE));
    const ty1 = Math.min(world.h - 1, Math.ceil((cam.y + VH) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (world.tile[ty][tx] !== Tile.Water) continue;
        // a cheap spatial hash: stable per tile, no per-tile state to store
        const h = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
        if (h % 100 >= WATER_GLINT_PCT) continue;
        const ph = (h % 628) / 100;
        const a = 0.5 + 0.5 * Math.sin(waveT * 1.5 + ph);
        if (a < 0.5) continue; // dark half of the cycle: the dash is absent
        const drift = (waveT * WATER_GLINT_DRIFT + ph * 9) % TILE;
        const sx = tx * TILE + drift - cam.x;
        const sy = ty * TILE + (h % (TILE - 2)) + 1 - cam.y;
        vctx.globalAlpha = (a - 0.5) * 2 * WATER_GLINT_ALPHA;
        vctx.fillRect(Math.round(sx), Math.round(sy), WATER_GLINT_LEN, 1);
      }
    }
    vctx.globalAlpha = 1;
  }

  // animated coastal foam — only on procedurally baked terrain
  vctx.fillStyle = "rgba(200,240,235,.5)";
  for (const cwv of art ? [] : world.coastWater) {
    const sx = cwv.x - cam.x;
    const sy = cwv.y - cam.y;
    if (sx < -TILE || sy < -TILE || sx > VW || sy > VH) continue;
    const a = 0.5 + 0.5 * Math.sin(waveT * 2 + cwv.ph);
    if (a > 0.6) vctx.fillRect(Math.round(sx + 4), Math.round(sy + 12), 12, 2);
  }

  // No footprint is painted on the ground. `telegraphTiles()` still reports
  // one and the tests still hold it to its contract, but drawing it turned
  // every spell into a puzzle with the answer printed underneath — the shape
  // appeared, you stepped off it, nothing happened. The tell is the creature
  // planting its feet, which is what a Tibia player reads anyway.

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
    vctx.lineWidth = 2;
    vctx.strokeRect(gx + 1, gy + 1, TILE * n - 2, TILE * n - 2);
    const spr = structSprite(key, 1);
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
      vctx.ellipse(sx, sy + 12, 30, 12, 0, 0, 6.2832);
      vctx.fill();
      vctx.strokeStyle = `rgba(230,178,90,${0.25 + 0.35 * pulse})`;
      vctx.lineWidth = 3;
      vctx.beginPath();
      vctx.ellipse(sx, sy + 4, 26 + pulse * 6, 18 + pulse * 4, 0, 0, 6.2832);
      vctx.stroke();
      const cmp = SPR.caveMouth;
      vctx.drawImage(cmp, Math.round(sx - cmp.width / 2), Math.round(sy - cmp.height + 12));
      continue;
    }
    if (pt.style) {
      const lw = SPR.ladder.width;
      const lh = SPR.ladder.height;
      vctx.drawImage(SPR.ladder, Math.round(sx - lw / 2), Math.round(sy - lh / 2));
      const down = pt.style === "ladderDown";
      const dir = down ? 1 : -1;
      const ay = down ? sy + lh / 2 + 6 : sy - lh / 2 - 6;
      vctx.fillStyle = down ? "#e6b25a" : "#a6e6c4";
      vctx.beginPath();
      vctx.moveTo(sx - 6, ay);
      vctx.lineTo(sx + 6, ay);
      vctx.lineTo(sx, ay + dir * 6);
      vctx.closePath();
      vctx.fill();
      continue;
    }
    const dormant = !!pt.inactive;
    // A spanned pad draws ONE swirl across the whole block rather than a
    // cluster of little ones in the corners — the pad reads as a single door.
    const span = pt.span ?? 1;
    const step = 4 * span;
    for (let r = 16 * span; r > 0; r -= step) {
      // a dormant pad smoulders red and barely breathes; a live portal
      // pulses violet — the state reads at a glance from across the hall
      const a = dormant ? 0.12 + 0.06 * Math.sin(waveT * 1.5 + r) : 0.15 + 0.12 * Math.sin(waveT * 4 + r);
      vctx.fillStyle = `rgba(${dormant ? PORTAL_DORMANT_HALO : PORTAL_LIVE_HALO},${a})`;
      vctx.beginPath();
      vctx.ellipse(sx, sy, r, r * 0.6, 0, 0, 6.2832);
      vctx.fill();
    }
    vctx.fillStyle = dormant ? PORTAL_DORMANT_CORE : PORTAL_LIVE_CORE;
    const bw = 4 * span;
    const bh = 16 * span;
    vctx.fillRect(
      Math.round(sx) - bw / 2,
      Math.round(sy - bh / 2 + (dormant ? 0 : Math.sin(waveT * 5) * 4)),
      bw, bh,
    );
  }


  // level gates — a portcullis seals the doorway until the level is reached;
  // an open gate leaves bare doorway (the bars withdrew into the ceiling)
  for (const gt of world.gates) {
    if (P.level >= gt.lv) continue;
    const gx = gt.tx * TILE + TILE / 2 - cam.x;
    const gy = gt.ty * TILE + TILE - cam.y;
    vctx.drawImage(SPR.gate, Math.round(gx - SPR.gate.width / 2), Math.round(gy - SPR.gate.height - 4));
    vctx.font = "bold 12px monospace";
    vctx.fillStyle = "#14171a";
    vctx.fillText(`${gt.lv}`, Math.round(gx) - 6 + 2, Math.round(gy) - 10 + 2);
    vctx.fillStyle = "#ffd98a";
    vctx.fillText(`${gt.lv}`, Math.round(gx) - 6, Math.round(gy) - 10);
  }

  // gather nodes: trees and rocks (sorted by y with actors below)
  type Drawable = { y: number; fn: () => void };
  const drawList: Drawable[] = [];
  // Viewport culling: anything whose base sits outside the camera view (plus
  // a margin for tall sprites and shadows) is skipped BEFORE a closure is
  // allocated. On the continent (~1000 drawables) this cuts the per-frame
  // build + sort of the draw list down to just the on-screen handful.
  const CULL = 96;
  const inView = (x: number, y: number): boolean =>
    x >= cam.x - CULL && x <= cam.x + VW + CULL && y >= cam.y - CULL && y <= cam.y + VH + CULL;

  // Drawn artwork carries its own painted shadow, so the engine must not add
  // a second one underneath it.
  const artShadow = hasPropArt() ? () => {} : drawShadow;
  for (const tr of world.trees) {
    const bx = tr.tx * TILE + TILE / 2;
    const by = tr.ty * TILE + TILE;
    if (!inView(bx, by)) continue;
    if (tr.stump) {
      drawList.push({ y: by, fn: () => { artShadow(bx, by); drawSprite(propSprite("stump"), bx, by); } });
    } else {
      drawList.push({ y: by, fn: () => {
        artShadow(bx, by, 12);
        const shake = tr.hurtT > 0 ? Math.round(Math.sin(tr.hurtT * 40) * 3) : 0;
        drawSprite(tr.spr, bx + shake, by);
        if (tr.hp < tr.maxhp) hpBar(bx, tr.ty * TILE - 8, tr.hp / tr.maxhp);
      } });
    }
  }
  for (const rk of world.rocks) {
    const bx = rk.tx * TILE + TILE / 2;
    // anchor the sprite so it sits CENTRED in its square (a rock is a squat
    // 10x6 sprite — bottom-of-tile anchoring made it hug the tile edge and
    // look like it belonged to the boundary, not the square it blocks)
    const by = rk.ty * TILE + ((TILE + (rk.depleted ? propSprite("rubble") : propSprite("rock")).height) >> 1);
    if (!inView(bx, by)) continue;
    if (rk.depleted) {
      drawList.push({ y: by, fn: () => { artShadow(bx, by); drawSprite(propSprite("rubble"), bx, by); } });
    } else {
      drawList.push({ y: by, fn: () => {
        artShadow(bx, by);
        const shake = rk.hurtT > 0 ? Math.round(Math.sin(rk.hurtT * 40) * 3) : 0;
        drawSprite(propSprite("rock"), bx + shake, by);
        if (rk.hp < rk.maxhp) hpBar(bx, rk.ty * TILE - 4, rk.hp / rk.maxhp);
      } });
    }
  }
  // Standing scenery — totems, dead trees. Anchored at the bottom of their own
  // tile, so the part that overhangs the tile above is drawn after anything
  // standing up there: walk north of a totem and it hides you, like a tree.
  for (const sc of world.scenery) {
    const fp = FOOTPRINT[sc.kind];
    const bx = sc.tx * TILE + (fp.w * TILE) / 2;
    const by = (sc.ty + fp.h) * TILE;
    if (!inView(bx, by)) continue;
    drawList.push({ y: by, fn: () => {
      artShadow(bx, by, 10);
      drawSprite(scenerySprite(sc.kind), bx, by);
    } });
  }
  // Spell effects. In the sort like everything else: a flame north of the
  // player is drawn before him and so passes behind his shoulders, and a
  // flame on a tree's tile is drawn before the trunk and burns behind it.
  // Pushed HERE — ahead of corpses, creatures and the player — so that when a
  // flame ties with an actor on the same tile the actor wins and stays legible.
  for (const bd of spellBlastDrawables(world)) {
    if (!inView(bd.x, bd.y)) continue;
    drawList.push({ y: bd.y, fn: () => bd.fn(vctx, cam.x, cam.y) });
  }

  // Campfires. Unlike every other piece of scenery these are NOT baked into
  // the map canvas: the flame has to be recut each frame, so they ride the
  // depth-sorted list and the player can walk behind one. `waveT` is the same
  // clock the water glint uses, and each fire's own phase keeps two fires in
  // one camp from pulsing together. Without the artwork the baked sprite
  // stands in, still but present.
  for (const fr of world.fires) {
    const bx = fr.tx * TILE + TILE / 2;
    const by = fr.ty * TILE + TILE;
    if (!inView(bx, by)) continue;
    // Sorted on the true bottom of its square, drawn FIRE_LIFT pixels above it:
    // the lift is there to make the flame cover the tile it seals, and letting
    // it move the sort key too would slip the fire behind things standing level
    // with it.
    drawList.push({ y: by, fn: () => {
      drawSprite(campfireFrame(waveT, fr.phase) ?? SPR.campfire, bx, by - FIRE_LIFT);
    } });
  }
  // structures. Artwork splits a building by tier, so the tier has to be read
  // before the sprite is; a training post goes further and answers with a cell
  // of its recoil sheet, leaning away from whoever last hit it. The shadow is
  // sized off the FOOTPRINT rather than the sprite: a building overhangs its
  // pad by design (a two-tile forge is three tiles of roof), and a shadow as
  // wide as the roof would put the whole pad in shade.
  for (const s of world.structures) {
    const tier = tierOf(s);
    const c = structCenter(s);
    const bx = c.x;
    const by = c.baseY;
    if (!inView(bx, by)) continue;
    const recoil = buildingFrame(s.key, tier, recoilRow(bx - P.x, by - P.y), recoilFrameIndex(s.anim ?? 0));
    const drawn = hasBuildingArt(s.key, tier);
    const spr = recoil ?? structSprite(s.key, tier);
    const sh = buildingShadow(s.key, footprint(s.key) * TILE * 0.42);
    drawList.push({ y: by, fn: () => {
      drawShadow(bx, by + sh.dy, sh.w);
      // A struck building jolts. A post that has its own lean is exempt —
      // shaking a drawn recoil reads as noise on top of the reaction.
      const shake = s.hurtT && !recoil ? Math.round(Math.sin(s.hurtT * 40) * 3) : 0;
      drawSprite(spr, bx + shake, by);
      // Firelight, smoke and alchemical motes ride on top of the artwork, and
      // only on the artwork: their anchors are measured off the drawing, so
      // over a baked stand-in they would land nowhere in particular.
      if (drawn && hasBuildingFx(s.key)) {
        drawBuildingFx(vctx, s.key, tier, Math.round(bx - cam.x + shake), Math.round(by - cam.y), waveT, fxSeed(s.tx, s.ty));
      }
      // The ember that stood in for the forge's fire before there was a forge
      // to draw. The artwork burns its own.
      if (s.key === "forge" && !drawn) {
        vctx.fillStyle = `rgba(255,${140 + Math.round(Math.sin(waveT * 8) * 40)},60,.8)`;
        vctx.fillRect(Math.round(bx - cam.x - 4), Math.round(by - cam.y - 12 + Math.sin(waveT * 6) * 2), 4, 4);
      }
    } });
  }
  // corpses — real bodies where the art exists, the bone pile everywhere else.
  // A body lies flat, so it hangs off the BOTTOM edge of its tile rather than
  // the centre line every standing sprite uses. Feet-at-tile-centre is right
  // for something upright — the mass is above the anchor — but a body pinned
  // there floats in the tile's upper half with the ground showing beneath it.
  // The shadow follows the body down; the bone pile keeps the nudge it was
  // drawn for, so every other creature in the bestiary is untouched.
  for (const c of world.corpses) {
    if (!inView(c.x, c.y)) continue;
    const blink = c.t < 10 ? (Math.sin(waveT * 8) > 0 ? 1 : 0.4) : 1;
    const body = c.name === "your body" ? heroCorpse() : corpseSprite(c.name);
    const baseY = c.y + TILE / 2;
    drawList.push({ y: c.y, fn: () => {
      vctx.globalAlpha = blink;
      if (body) {
        drawShadow(c.x, baseY);
        drawSprite(body, c.x, baseY);
      } else {
        drawShadow(c.x, c.y);
        drawSprite(SPR.corpse, c.x, c.y + 8);
      }
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
      drawShadow(gi.x, gi.y, 12);
      const px = Math.round(gi.x - cam.x - spr.width / 2);
      const py = Math.round(gi.y - cam.y - spr.height);
      vctx.imageSmoothingEnabled = false;
      vctx.drawImage(spr, px, py);
      if (gi.n > 1) {
        vctx.font = "bold 12px monospace";
        vctx.textAlign = "right";
        vctx.fillStyle = "#000";
        vctx.fillText(`${gi.n}`, px + spr.width + 2, py + spr.height + 2);
        vctx.fillStyle = "#ffe9a8";
        vctx.fillText(`${gi.n}`, px + spr.width, py + spr.height);
      }
      vctx.globalAlpha = 1;
    } });
  }
  // NPCs
  for (const n of world.npcs) {
    if (!inView(n.x, n.y)) continue;
    // the walk cycle carries its own weight shift, so a walking NPC must not
    // also bob — that reads as a limp. Only the rooted, baked ones bob.
    const spr = npcSpr(n);
    const bob = n.moving ? 0 : Math.sin(waveT * 2 + n.bob) * 2.4;
    drawList.push({ y: n.y, fn: () => {
      drawShadow(n.x, n.y);
      drawSprite(spr, n.x, n.y, 1, bob);
      // name tag
      vctx.font = "bold 12px monospace";
      vctx.textAlign = "center";
      vctx.fillStyle = "#000";
      vctx.fillText("!", Math.round(n.x - cam.x) + 2, Math.round(n.y - cam.y - spr.height - 6) + 2);
      vctx.fillStyle = "#ffe9a8";
      vctx.fillText("!", Math.round(n.x - cam.x), Math.round(n.y - cam.y - spr.height - 6));
    } });
  }
  // monsters
  for (const m of world.monsters) {
    if (!inView(m.x, m.y)) continue;
    // Creatures with a walk sheet stride and face where they are going; the
    // rest keep the old idle bob, which on an animated body reads as a limp.
    const walk = mobFrame(m.kind, m.dir, !atCenter(m), waveT + m.bob);
    const bob = walk ? 0 : Math.sin(m.bob) * 3;
    const spr = walk ?? m.spr;
    drawList.push({ y: m.y, fn: () => {
      drawShadow(m.x, m.y, MOB_SHADOW[m.kind]);
      vctx.globalAlpha = m.hurtT > 0 && Math.sin(m.hurtT * 60) > 0 ? 0.5 : 1;
      drawSprite(spr, m.x, m.y, 1, bob);
      vctx.globalAlpha = 1;
      hpBar(m.x, m.y - spr.height - 8, m.hp / m.maxhp);
    } });
  }
  // player — hand-drawn LPC art when the sheet is up, the baked outfit until then
  const pbob = (P.dest || P.target || P.gather || moveAxisNonZero() || !atCenter(P)) ? Math.sin(P.bob * 10) * 2.4 : 0;
  drawList.push({ y: P.y, fn: () => {
    drawShadow(P.x, P.y);
    const lpc = heroSprite(P.dir, P.face, walking, walkT, waveT, P.dead);
    // the LPC body is a real lying-down frame, so it is not faded like the
    // stand-in would be; the baked outfit still gets the ghosting treatment
    vctx.globalAlpha = P.dead && !lpc ? 0.4 : 1;
    if (lpc) drawSprite(lpc, P.x, P.y, 1, 0);
    else drawSprite(P.sprDir[P.dir], P.x, P.y, P.dir === "side" ? P.face : 1, pbob);
    vctx.globalAlpha = 1;
  } });

  drawList.sort((a, b) => a.y - b.y);
  for (const d of drawList) d.fn();

  // arrows in flight — drawn above the sorted scene since they arc overhead
  for (const sh of world.shots) {
    const t = sh.p < 1 ? sh.p : 1;
    const cx = sh.fromX + (sh.toX - sh.fromX) * t;
    const cy = sh.fromY + (sh.toY - sh.fromY) * t - Math.sin(t * Math.PI) * 12;
    const ang = Math.atan2(sh.toY - sh.fromY, sh.toX - sh.fromX);
    const dx = Math.cos(ang) * 6;
    const dy = Math.sin(ang) * 6;
    const px = Math.round(cx - cam.x);
    const py = Math.round(cy - cam.y);
    vctx.strokeStyle = sh.color ?? (sh.bone ? "#efe9d6" : "#cfd8da");
    vctx.lineWidth = sh.wide ? 4 : 2;
    vctx.beginPath();
    vctx.moveTo(px - dx, py - dy);
    vctx.lineTo(px + dx, py + dy);
    vctx.stroke();
  }

  // spell projectiles fly overhead, with the arrows — the blasts they leave
  // went into the depth sort above
  drawSpellBolts(vctx, world, cam.x, cam.y);

  // Aiming a Burst: show the twenty-five tiles it would cover, under the
  // cursor, before a charge is spent. Tibia never drew this and never had to —
  // its players knew the shape by heart from a decade of throwing them. A
  // footprint this size, invented this week, has to show its work.
  if (aimPending) {
    const spec = CRYSTAL_SPECS[aimPending];
    const wx = mouse.sx / vScale + cam.x;
    const wy = mouse.sy / vScale + cam.y;
    const legal = dist(P.x, P.y, wx, wy) <= spec.range && lineOfSight(world, P.x, P.y, wx, wy);
    const ox = Math.floor(wx / TILE);
    const oy = Math.floor(wy / TILE);
    vctx.strokeStyle = legal ? ELEMENT_COLOR[spec.element] : "#ff5a4a";
    vctx.lineWidth = 1;
    vctx.globalAlpha = 0.75;
    for (const [dx, dy] of BURST_TILES) {
      const tx = ox + dx;
      const ty = oy + dy;
      if (groundBlocked(world, tx, ty)) continue;
      vctx.strokeRect(tx * TILE - cam.x + 0.5, ty * TILE - cam.y + 0.5, TILE - 1, TILE - 1);
    }
    // the centre square marked harder, so the player is aiming at a point
    // rather than somewhere inside a cloud of outlines
    vctx.lineWidth = 2;
    vctx.globalAlpha = 1;
    vctx.strokeRect(ox * TILE - cam.x + 1, oy * TILE - cam.y + 1, TILE - 2, TILE - 2);
  }

  // target reticle
  if (P.target && (P.target.kind === "mob" || P.target.kind === "dummy")) {
    const tp = targetPoint();
    if (tp) {
      const sx = Math.round(tp.x - cam.x);
      const sy = Math.round(tp.y - cam.y);
      vctx.strokeStyle = "#ff5a4a";
      vctx.lineWidth = 2;
      const s = 18;
      for (const [ox, oy, dx, dy] of [[-s, -s, 6, 0], [-s, -s, 0, 6], [s, -s, -6, 0], [s, -s, 0, 6], [-s, s, 6, 0], [-s, s, 0, -6], [s, s, -6, 0], [s, s, 0, -6]] as const) {
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
      vctx.lineWidth = 2;
      vctx.strokeRect(Math.round(gp.x - cam.x) - 16, Math.round(gp.y - cam.y) - 16, 32, 32);
    }
  }
  // move marker
  if (moveMarker) {
    const a = moveMarker.t / 0.5;
    vctx.strokeStyle = `rgba(255,255,255,${a})`;
    vctx.lineWidth = 2;
    const r = (1 - a) * 12 + 4;
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

  // HUD + panels (screen space). One UI everywhere (Etap 13): desktop uses the
  // same customizable HUD and panel sizing as mobile; each panel still
  // auto-shrinks per window if it would spill off-screen.
  const hud: HudCtx = {
    ctx: sctx, scale,
    screenW: screen.width, screenH: screen.height, touch: touchUI,
    touchInput: isTouchDevice(),
  };
  drawHud(hud, game, P);
  hotspots = [];
  itemSlots = [];
  for (const win of ui.windows) { win.rect = null; win.titleBar = null; }
  drawPanels({ hud, ui, game, player: P, mouse, act, hotspots, itemSlots });
  // ghost of the item being dragged, following the cursor
  if (itemDrag && itemDrag.active) {
    const spr = itemSprite(itemDrag.kind);
    const gw = iconW(spr, 2 * scale);
    const gh = iconH(spr, 2 * scale);
    sctx.imageSmoothingEnabled = false;
    sctx.globalAlpha = 0.85;
    sctx.drawImage(spr, Math.round(mouse.sx - gw / 2), Math.round(mouse.sy - gh / 2), gw, gh);
    sctx.globalAlpha = 1;
    if (itemDrag.n > 1 && itemDrag.src !== "eq") {
      const dn = currentN(itemDrag.src, itemDrag.index);
      sctx.font = `bold ${7 * scale}px monospace`;
      sctx.textAlign = "right";
      sctx.fillStyle = "#000";
      sctx.fillText(`${dn}`, Math.round(mouse.sx + gw / 2) + 1, Math.round(mouse.sy + gh / 2) + 1);
      sctx.fillStyle = "#ffe9a8";
      sctx.fillText(`${dn}`, Math.round(mouse.sx + gw / 2), Math.round(mouse.sy + gh / 2));
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
  actionSlotRects.push({ i: idx, x, y, w, h });
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

/** Action-slot rects this frame (mouse right-click = open the rebind picker). */
let actionSlotRects: { i: number; x: number; y: number; w: number; h: number }[] = [];

function drawTouchControls(): void {
  touchButtons = [];
  hudGrips = [];
  actionSlotRects = [];

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
  if (aimPending) return true;          // aiming a Burst — likewise
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
