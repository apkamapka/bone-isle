import "./style.css";
import { VIEW_W, VIEW_H, TILE, SPRITE_SCALE, MIN_VIEW_W, MIN_VIEW_H, NPC_TALK_HOLD_S, ARROW_MISS_WARN_S, GROUND_DESPAWN_S, MONSTERS_ENABLED, USE_RANGE_PX, PANEL_REACH_TILES, RESPAWN_RETRY_S, THROW_RANGE_PX, FED_MAX_S, FED_HP_PER_S, MELEE_REACH_PX, worldZoom, WATER_GLINT_COLOR, WATER_GLINT_PCT, WATER_GLINT_ALPHA, WATER_GLINT_DRIFT, WATER_GLINT_LEN, PORTAL_LIVE_HALO, PORTAL_LIVE_CORE, PORTAL_DORMANT_HALO, PORTAL_DORMANT_CORE } from "./config.ts";
import { unstick, blockedAt, lineOfSight, groundBlocked, portalCovers, isSafeTile } from "./world/collision.ts";
import { carryCap, carriedWeight } from "./entities/player.ts";
import { toTile, glideWalker, tryStep, stepDir, atCenter, findPath, chebToPoint, type Occupied } from "./world/grid.ts";
import { nearestHit, footprintHit } from "./world/pick.ts";
import { mobFrame, npcFrame, corpseSprite } from "./gfx/mobSheet.ts";
import { campfireFrame, FIRE_LIFT, FIRE_BURN_TICK_S, FIRE_BURN_DMG } from "./gfx/fireSheet.ts";
import { scenerySprite, FOOTPRINT, SCENERY_NAME } from "./gfx/sceneryArt.ts";
import { updateNpcs, faceToward } from "./entities/npcs.ts";
import { SPR, iconW, iconH, hasPropArt, propSprite } from "./gfx/sprites.ts";
import { itemSprite } from "./gfx/itemArt.ts";
import { loadHeroSheet, heroSprite, heroCorpse } from "./gfx/heroSheet.ts";
import { clamp, dist, rndi } from "./util.ts";
import { playerSpeed, refreshDerived, canCarry, freeCap } from "./entities/player.ts";
import type { Target } from "./entities/player.ts";
import { updateMonsters, MONSTER_DEFS, spawnMonster, spawnMonsterInCamp, spawnWilderness, spawnAtPost } from "./entities/monsters.ts";
import { playerAttack, playerShoot, hitDummy, shootDummy, hurtPlayer, grantExp } from "./systems/combat.ts";
import { gatherTick, tickRegrowth } from "./systems/gather.ts";
import { tryPlace, tryUpgrade, structSprite, STRUCTS, canAfford, payCost, structCenter, structGap, canPlaceAt, buildCost, upgradeCost, tierOf, bestTier, footprint, solidRows, countOwned } from "./systems/building.ts";
import { buildingFrame, buildingShadow, hasBuildingArt, recoilFrameIndex, recoilRow } from "./gfx/buildingArt.ts";
import { drawBuildingFx, fxSeed, hasBuildingFx } from "./gfx/buildingFx.ts";
import { applySmelt, smeltBlocker, applyGem, GEM_TROPHY_KINDS, type ForgeTier } from "./systems/smelt.ts";
import { setActiveBonus } from "./systems/derived.ts";
import { applyOutfit, setOutfitColor, resetOutfitColors, type OutfitZone } from "./systems/outfit.ts";
import { useCrystal, tickCrystalCooldown, isAimedCrystal, BURST_TILES, CRYSTAL_SPECS } from "./systems/crystals.ts";
import {
  actionSlots, setSlot, BINDABLE_CRYSTALS,
  actionSlotCount, addActionSlots, removeActionSlots,
  ACTION_SLOTS_MIN, ACTION_SLOTS_MAX, ACTION_SLOT_STEP,
} from "./systems/actions.ts";
import {
  hudLocked, toggleHudLock, placeHud, moveHudGroup, saveHudLayout, resetHudLayout, loadHudLayout,
  hudUserScale, stepHudUserScale, hudMenuOpen, toggleHudMenu, applyHudPreset, snapHudGroup,
  type HudGroup,
} from "./systems/hudLayout.ts";
import { researchById, isResearched, markResearched, towerTierOk, towerTierFor,
  ATTUNEMENT, isAttuned, markAttuned, attunementOk, offerById } from "./systems/tower.ts";
import { ELEMENT_LABEL, ELEMENT_COLOR, type Element } from "./systems/elements.ts";
import { loadPanelPrefs, panelZoom, setPanelRows } from "./systems/panelPrefs.ts";
import { skills, type SkillKey } from "./systems/skills.ts";
import { cycleStance, STANCE_LABEL, STANCE_COLOR } from "./systems/stance.ts";
import { totalExpFor } from "./config.ts";
import { questList, claimQuest, syncCollectQuests } from "./systems/quests.ts";
import { chasing, toggleChase } from "./systems/playerState.ts";
import { pvpArmed, togglePvpArmed, skull, skullIcon, tickSkull, type Skull } from "./systems/pvp.ts";
import { nextEntityId, byId, monsterById, corpseById, groundById, npcById, structureById } from "./world/entities.ts";
import { TARGET_SEEK_PX } from "./config.ts";
import { acceptTask, abandonTask, handInTask, buyExchange, activeTask } from "./systems/tasks.ts";
import { addItem, addStack, removeItem, removeItemUnpacked, ITEMS, itemWeight, bagWeight, bagCount, bagSlotsUsed, stackSlotCost, isContainer, giveGold, takeGold, walletAcross, takeGoldAcross, walletRoomFor, equippedBow, activeArrow, bestPracticeArrow, cycleArrow, compactBag } from "./items.ts";
import { addFloat, updateFloats, drawFloats } from "./fx.ts";
import {
  SELF, activeChannel, bubbleFor, formatLine, lineAlpha, logServer,
  markAllRead, overlayLines, say, tickChat, unread,
} from "./systems/chat.ts";
import { chatInput, initChatInput } from "./ui/chatInput.ts";
import { groundEntries, playerEntries, type ContextMenu, type MenuEntry } from "./ui/contextMenu.ts";
import { updateSpellFx, drawSpellBolts, spellBlastDrawables } from "./gfx/spellFx.ts";
import { updateMonsterSpells } from "./systems/monsterSpells.ts";
import { unlockAudio, beep } from "./audio.ts";
import { initInput, moveAxis } from "./input.ts";
import { initTouch, drawJoystick, isTouchDevice } from "./ui/touch.ts";
import { createGame, travelTo, applyGates, respawnAtHome, homeChests, CHEST_PRIZES, type Game } from "./game.ts";
import { saveGame, loadGame } from "./save.ts";
import { drawHud, drawVitals, drawGoldTP, drawMinimapAt, hudText, totalGold, type HudCtx } from "./ui/hud.ts";
import { buttonBox, slotCell, popupFrame, raisedBox, sunkenBox, CHROME } from "./ui/chrome.ts";
import { deckEnabled, mobileLayout, noDeck, overDeck, TOUCH_MIN_CSS, mapFocusFrac, mapFocusFracX, sheetSlots, sheetBand, stripRect, stripHandle, stripClaim, DECK_TABS, MAX_SHEETS, type MobileLayout } from "./ui/mobile.ts";
import { drawControlIcon, ICON_SRC, type ControlIcon } from "./ui/icons.ts";
import {
  dockEnabled, dockLayout, dockScale, overDock, toggleBlock, NO_DOCK,
  dockOverflow, dockScroll, setDockScroll, scrollDock,
  VITALS_FIT, GOLD_ROW_H, BTN_ROW_H, SWAP_H, BLOCK_BAR,
  type DockLayout, type DockBlock,
} from "./ui/dock.ts";
import { drawPanels, isDocked, visibleRows, stripCandidate, STRIP_KINDS, DOCKABLE_PANELS, type UiState, type Hotspot, type ItemSlot, type PanelActions, type PanelKind, type PanelWindow } from "./ui/panels.ts";
import { Tile } from "./world/types.ts";
import type { Vec, World, WorldKey, Corpse, GroundItem, Npc, Structure, Monster } from "./world/types.ts";
import type { Bag, EqSlot, ItemKind, ItemStack, Recipe } from "./items.ts";
import { slotsOf, baseOf, rootOf, sameRef, isInside, groundDecays } from "./systems/containers.ts";
import type { ContainerRef, RefWorld } from "./systems/containers.ts";
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
/** Width of the docked sidebar in device px; 0 when there is no sidebar. */
let sidebarW = 0;
/** The column as last measured, for pointer handlers that run between frames. */
let lastDock: DockLayout = NO_DOCK;
/** Device px per design unit INSIDE the column (see dock.ts). */
let dockUnit = 1;
/**
 * The portrait-phone layout. `on` is false on desktop and on a phone held
 * sideways, and every consumer below checks it — there is exactly one mobile
 * code path and it is switched here, so nothing about the desktop view can
 * drift by accident.
 */
let deck: MobileLayout = noDeck();
/**
 * Is the phone's panel drop-down showing?
 *
 * Deliberately NOT persisted, unlike the old HUD's collapsible column. This is
 * a transient reveal — it is dismissed by the tap that uses it — and a menu
 * that came back open next session would be a menu you have to close before you
 * can see where you are standing.
 */
let deckMenu = false;

/**
 * The side strip's geometry this frame, or null when nothing is docked to it.
 *
 * Read by the renderer AND by the camera, which is why it is a function rather
 * than a field: the two run at different points in the frame, and a stale copy
 * would leave the player standing off-centre for one tick every time a bag
 * opened or closed.
 */
/**
 * Is the side strip slid away?
 *
 * Transient, like the drop-down: a pack tucked out of the way for one fight
 * should not still be tucked away next session, when you have forgotten you
 * put it there and can only see a tab.
 */
let stripAway = false;

function activeStrip(): { x: number; y: number; w: number; h: number } | null {
  if (!deck.on) return null;
  return stripCandidate(ui.windows) ? stripRect(deck, stripAway ? 1 : 0) : null;
}

/** Width the strip and its tab are claiming from the map this frame. */
function stripWidth(): number {
  const s = activeStrip();
  return s ? stripClaim(deck, s, screen.width) : 0;
}

/**
 * Stamped onto every window as it opens.
 *
 * The window array is z-order and gets reshuffled whenever one is raised, so
 * "the first pack you opened" cannot be read off position 0 — tapping the
 * second pack would hand it the strip.
 */
let winSeq = 0;

/**
 * Notch and gesture-bar insets, in CSS px.
 *
 * `env(safe-area-inset-*)` is a CSS value and the canvas cannot read it, so a
 * zero-sized hidden probe carries it into script. Without this the bottom row
 * of action slots sits underneath Android's gesture bar, where a press is a
 * system swipe and never reaches the game at all.
 */
let safeProbe: HTMLElement | null = null;
function safeInsets(): { top: number; bottom: number } {
  if (typeof document === "undefined" || !document.body) return { top: 0, bottom: 0 };
  if (!safeProbe) {
    safeProbe = document.createElement("div");
    safeProbe.id = "safe-probe";
    document.body.appendChild(safeProbe);
  }
  const cs = getComputedStyle(safeProbe);
  return { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
}


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

  screen.width = Math.round(cw * dpr);
  screen.height = Math.round(ch * dpr);
  screen.style.width = cw + "px";
  screen.style.height = ch + "px";
  sctx.imageSmoothingEnabled = false;

  // HUD design unit. On a wide desktop the height is the tight constraint (tall
  // panels must fit), so we take the smaller of the width/height ratios. On a
  // portrait phone width still wins, so mobile sizing is unchanged.
  scale = Math.min(screen.width / DESIGN_W, screen.height / DESIGN_H);

  /* The sidebar takes its width OUT OF THE MAP rather than sitting on top of
   * it: a column that covers the world is a bigger version of the overlapping
   * -windows problem it exists to solve.
   *
   * It is measured ONCE, here, in device px, from the same dockLayout the
   * renderer calls. Measuring it a second time in CSS px and converting was
   * the obvious way to write this and left a one-pixel seam between the map
   * and the column, because the two roundings disagree. */
  /* The column has its OWN unit, fixed in CSS pixels — it does not scale with
   * the display, exactly as Tibia's does not. Inheriting the HUD unit (which
   * is authored for a 480x320 phone) made the column three times too wide on
   * a desktop, which is what forced the windows inside it to be shrunk. */
  dockUnit = dockScale(scale, dpr);
  sidebarW = dockEnabled(cw) && !mobile
    ? dockLayout(screen.width, screen.height, dockUnit, true).w
    : 0;

  /* The phone's two bands are measured here, from the same numbers the
   * renderer uses, for the same reason the column is: one measurement, no
   * chance of the plate and the hit areas disagreeing by a rounding. */
  if (deckEnabled(cw, ch, isTouchDevice())) {
    const safe = safeInsets();
    deck = mobileLayout(screen.width, screen.height, dpr, safe.top * dpr, safe.bottom * dpr,
      actionSlotCount());
  } else {
    deck = noDeck(screen.height);
  }

  const f = worldZoom(cw, ch, mobile);
  VW = Math.max(MIN_VIEW_W, Math.ceil(((screen.width - sidebarW) / dpr) / f));
  VH = Math.max(MIN_VIEW_H, Math.ceil(ch / f));
  view.width = VW;
  view.height = VH;

  // World pixels map onto the VISIBLE strip, not the whole canvas, so every
  // screen->world conversion in the file keeps working untouched.
  vScale = (screen.width - sidebarW) / VW;
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

const ui: UiState = { windows: [], placing: null, selSlot: null, loot: null, npc: null, stash: null, floor: null, shopTab: "buy",
  forgeTab: "craft",
  testPage: 0,
  towerTab: "fire",
  upgrading: null, dragging: false, lookMode: false, inspect: null, split: null };

const mouse = { sx: 0, sy: 0 };
let hotspots: Hotspot[] = [];
let itemSlots: ItemSlot[] = [];
// mouse drag-and-drop of inventory items
let suppressClick = false;
/**
 * A drag in flight. Exactly one of `ref` / `eqSlot` / `floor` says where it
 * came from: a cell in some container, the paperdoll, or a loose stack lying
 * on the map. `active` stays false until the pointer actually moves, so a
 * plain click still resolves as a click.
 */
let itemDrag: {
  index: number; kind: ItemKind; n: number; sx: number; sy: number; active: boolean; touch?: boolean;
  ref?: ContainerRef;
  eqSlot?: EqSlot | "pack";
  floor?: GroundItem;
} | null = null;
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
  /* An open menu is MODAL over the world.
   *
   * It is drawn last, on top of everything, and it opens right beside the
   * thing it is about — so its entries routinely lie over the very ground
   * item they describe. Without this the press that means "Take" is claimed
   * as the start of a drag of that same item, `suppressClick` is set, and the
   * entry never runs: the menu appears to do nothing at exactly the moment it
   * is most obviously correct. `contextMenuTap` already treats every press as
   * spent on the menu while it is up; this is the same rule, enforced one
   * layer earlier where the drag probes live. */
  if (ctxMenu) return false;
  if (pointInOpenPanel(sx, sy) || ui.placing || hudEditing()) return false;
  const wx = sx / vScale + cam.x;
  const wy = sy / vScale + cam.y;
  const world = cw();
  for (const gi of world.ground) {
    if (Math.abs(wx - gi.x) < 18 && wy > gi.y - 28 && wy < gi.y + 8) {
      itemDrag = { index: -1, kind: gi.kind, n: gi.n, sx, sy, active: false, floor: gi, touch: isTouch };
      return true;
    }
  }
  return false;
}

/** Begin a (not yet active) item drag if (sx,sy) lands on an inventory slot.
 *  Shared by mouse pointerdown and the touch drag hooks. */
function probeSlotDrag(sx: number, sy: number, isTouch: boolean): boolean {
  if (ui.lookMode || ui.split || ui.inspect) return false;
  if (ctxMenu) return false; // modal — see the note in probeGroundDrag
  for (let i = itemSlots.length - 1; i >= 0; i--) {
    const it = itemSlots[i];
    if (sx >= it.x && sx < it.x + it.w && sy >= it.y && sy < it.y + it.h) {
      // empty cells are registered so things can be dropped INTO them; there
      // is nothing in one to pick up
      if (it.n <= 0) return false;
      itemDrag = { index: it.index, kind: it.kind, n: it.n, sx, sy, active: false, touch: isTouch, ref: it.ref, eqSlot: it.eqSlot };
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
/**
 * Are the action slots being re-bound right now?
 *
 * This used to require `touchUI`, which quietly meant a desktop player had six
 * action slots and no way to put anything in them — the bar was configurable
 * on a phone and read-only on a computer, which is precisely backwards. The
 * lock defaults to on, so nothing changes until the EDIT button is pressed.
 */
function hudEditing(): boolean {
  return !hudLocked();
}

const cw = (): World => game.current;
/**
 * What a container address needs in order to resolve.
 *
 * Rebuilt on every call rather than cached: `game.current` changes when the
 * player takes a ladder, and a stale context would resolve a corpse id
 * against the floor above. It is three property reads.
 */
const refCtx = (): RefWorld => ({ bag: P.bag, world: game.current, home: game.worlds.home });
/**
 * Say something to the player.
 *
 * Two places at once, on purpose. The float is how it is READ — it appears
 * where the eyes already are and needs no attention — and the log is how it is
 * RE-read, which nothing before this could do: a refusal you blinked past was
 * simply gone. Every one of the hundred-odd `flash` calls in this file became
 * a Server Log line for free the moment this one line changed.
 */
const flash = (t: string, c = "#ffe9a8"): void => {
  addFloat(cw(), P.x, P.y - 60, t, c);
  logServer(t, c);
};

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

/** Raise one specific window object (container windows are not unique). */
function raise(win: PanelWindow): void {
  const i = ui.windows.indexOf(win);
  if (i >= 0 && i < ui.windows.length - 1) {
    ui.windows.splice(i, 1);
    ui.windows.push(win);
  }
}

/** The open window showing exactly this container, if there is one. */
function windowShowing(ref: ContainerRef): PanelWindow | undefined {
  return ui.windows.find((w) => w.ref && sameRef(w.ref, ref))
    ?? ui.windows.find((w) => {
      // Only an UNNAVIGATED window answers for its home container. One that
      // has walked into a sub-pack is showing something else, and treating it
      // as the backpack is what makes a second backpack window impossible.
      if (w.ref) return false;
      const base = baseRefOf(w.kind);
      return !!base && sameRef(base, ref);
    });
}

/**
 * Open a pack in a window of its own — or raise the one already showing it.
 *
 * A window per container, rather than one window per KIND with a path walked
 * into it. The old shape could describe only one path at a time, so two packs
 * sitting in the same backpack were mutually exclusive: you could look in
 * either and never both, which made moving anything from one to the other
 * impossible without a detour through the bag between them.
 */
function openContainer(ref: ContainerRef): void {
  if (!slotsOf(ref, refCtx())) return;
  const open = windowShowing(ref);
  if (open) { raise(open); return; }
  /* Containers push straight onto the stack rather than going through
   * openWindow, so the phone's two-sheet ceiling has to be applied here too —
   * without it a bag opened from a corpse opened from a chest quietly made a
   * third sheet that nothing had room to draw. */
  if (deck.on) while (ui.windows.length >= MAX_SHEETS) ui.windows.shift();
  const n = ui.windows.length;
  ui.windows.push({
    kind: "container",
    ref,
    seq: winSeq++,
    offset: deck.on ? { x: 0, y: 0 } : { x: -40 * scale + n * 8 * scale, y: -20 * scale + n * 8 * scale },
    rect: null,
    titleBar: null,
  });
  beep(380, 0.05, "sine", 0.04, 40);
}

/**
 * Point the mouse cursor at what it is over.
 *
 * The arrows on a window's foot say which way it moves; the cursor says that
 * it moves at all, before the pointer has even settled. It is the one resize
 * affordance people read without thinking about it.
 */
let cursorNow = "";
function updateCursor(): void {
  let want = "";
  if (sizing) want = "ns-resize";
  else {
    for (let i = ui.windows.length - 1; i >= 0; i--) {
      const rb = ui.windows[i].resizeBar;
      if (!rb) continue;
      if (mouse.sx >= rb.x && mouse.sx < rb.x + rb.w && mouse.sy >= rb.y && mouse.sy < rb.y + rb.h) {
        want = "ns-resize";
        break;
      }
    }
  }
  // Only on change: assigning a style every frame is a needless style recalc.
  if (want !== cursorNow) {
    cursorNow = want;
    screen.style.cursor = want;
  }
}

/**
 * How many rows the container behind this window has in total.
 *
 * Zero for anything that is not a resizable container, which is how the foot
 * test skips windows with no rows to hide.
 */
function rowsInWindow(win: PanelWindow): number {
  const ref = viewRefOf(win);
  if (!ref) return 0;
  const slots = slotsOf(ref, refCtx());
  if (!slots) return 0;
  return Math.ceil(slots.length / 4);
}

/**
 * Height of one row of this window, in device px.
 *
 * Taken from the scale the panel was actually drawn at: a docked window uses
 * the column's fixed unit and a floating one the HUD's, so assuming either
 * would be wrong half the time and the drag would slip.
 */
function rowPixels(win: PanelWindow): number {
  const base = isDocked(win, lastDock) ? lastDock.s : scale * panelZoom(win.kind) * (win.fit ?? 1);
  const cell = win.kind === "loot" || win.kind === "floor" ? 30 : 32;
  return (cell + 4) * base;
}

/** Close every container window whose pack has gone (moved, dropped, looted). */
function sweepContainerWindows(): void {
  for (let i = ui.windows.length - 1; i >= 0; i--) {
    const w = ui.windows[i];
    if (w.kind !== "container" || !w.ref) continue;
    // a window pointing at a pack that no longer exists has nothing to show
    // and, worse, is a live drop target aimed at nowhere
    if (!slotsOf(w.ref, refCtx()) || !refUsable(w.ref)) ui.windows.splice(i, 1);
  }
}

function openWindow(kind: PanelKind): void {
  const existing = findWindow(kind);
  if (existing) { bringToFront(kind); return; }
  /* A phone holds TWO panels, and the oldest gives way.
   *
   * One was the first answer and it was wrong: every real inventory job is a
   * move between two places. Loot out of a corpse, a sword onto the paperdoll,
   * a stack into a chest — each needs both ends on screen, and with a single
   * sheet there was no second end. Two fit; a third would be one row of items
   * apiece with no world left over. */
  if (deck.on) while (ui.windows.length >= MAX_SHEETS) ui.windows.shift();
  // cascade slightly if several windows are already stacked
  const base = defaultOffset(kind);
  const n = ui.windows.length;
  ui.windows.push({
    kind,
    seq: winSeq++,
    /* The phone places windows itself — into a lane, centred — so the desktop
     * starting offsets are not a tidy stagger here, they are a panel shoved a
     * thumb's width off to one side for no reason the player can see. */
    offset: deck.on ? { x: 0, y: 0 } : { x: base.x + n * 6 * scale, y: base.y + n * 6 * scale },
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
  if (kind === "floor") ui.floor = null;
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
  takeAllLoot: (c: Corpse | null) => {
    // null = "whatever the front container window is showing" (a floor bag)
    const ref = c ? ({ c: "corpse", id: c.id } as ContainerRef)
      : ui.floor ? ({ c: "ground", id: ui.floor.id } as ContainerRef) : null;
    if (ref) takeAllFrom(ref);
  },
  buy: (kind: ItemKind) => { doBuy(kind); },
  sell: (kind: ItemKind) => { doSell(kind); },
  claim: (id: string) => {
    const q = questList().find((x) => x.id === id);
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
  moveStack: (ref: ContainerRef, index: number) => { openMoveChooser(ref, index); },
  openNested: (ref: ContainerRef, index: number, win: PanelWindow) => { navInto(ref, index, win); },
  navUp: (ref: ContainerRef) => { navUp(ref); },
  removePack: () => { dropWornPack(); },
  splitConfirm: (mode: "store" | "take" | "drop" | "throw" | "move") => { splitConfirm(mode); },
  look: (kind: ItemKind) => { ui.inspect = kind; },
  toggleLook: () => { ui.lookMode = !ui.lookMode; if (!ui.lookMode) ui.inspect = null; },
  /* Opening the pack from the equipment slot asks for a VIEW of the backpack,
   * not for "the bag window" — which, once it has walked into a sub-pack, is
   * showing something else entirely. Routing through openContainer means an
   * already-open root view is raised and otherwise a second window appears,
   * which is how you get two packs side by side, as in Tibia. */
  openBag: () => { openContainer({ c: "bag" }); },
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

/* ---------------- container moves (one rule for every window) ---------------- */

/** The slots behind an address, or null if the address has gone stale. */
function refSlots(ref: ContainerRef): Bag | null {
  return slotsOf(ref, refCtx());
}

/**
 * Can the player act on this container at all right now?
 *
 * Two different questions folded into one: does the thing still EXIST (the
 * corpse may have rotted, the pack may have been picked up, the chest torn
 * down), and is the player close enough to touch it. Both have to be asked on
 * every single move, because a window can outlive its subject by a frame and
 * a drag can outlive the walk that started it.
 */
function refUsable(ref: ContainerRef): boolean {
  const base = baseOf(ref);
  const world = cw();
  switch (base.c) {
    case "bag": return !!P.pack;
    case "stash": {
      // Deliberately looked up in HOME only, not through the home fallback:
      // a chest is reachable when you are standing on the island with it.
      const st = byId(game.worlds.home.structures, base.id);
      return cw() === game.worlds.home && !!st && structInReach(st);
    }
    // The "is it still there?" half of these used to be an `includes()` call
    // beside the reach test. A missing entity now simply fails to resolve.
    case "corpse": {
      const c = corpseById(world, base.id);
      return !!c && withinReach(c.x, c.y);
    }
    case "ground": {
      const gi = groundById(world, base.id);
      return !!gi && withinReach(gi.x, gi.y);
    }
    // Held in hand for one statement, by code that already checked the source.
    case "loose": return true;
  }
}

/**
 * Slots still free in a Storage Chest's whole tree, or null for anything else.
 *
 * The chest is the one container with a budget rather than a shape, and the
 * budget is recursive on purpose (see the panel's comment): a pack inside it
 * costs its own cell plus one for everything within.
 */
function chestRoomLeft(ref: ContainerRef): number | null {
  const base = baseOf(ref);
  if (base.c !== "stash") return null;
  const inv = structureById(cw(), base.id, game.worlds.home)?.inv;
  if (!inv) return null;
  return inv.length - bagSlotsUsed(inv);
}

/** Rearrange within one container: fill empty, merge like kinds, else swap. */
function swapOrMerge(arr: Bag, from: number, to: number): void {
  if (from === to) return;
  const a = arr[from];
  if (!a) return;
  const b = arr[to];
  if (!b) { arr[to] = a; arr[from] = null; return; }
  if (b.kind === a.kind && ITEMS[a.kind].stack > 1 && !a.items && !b.items) {
    const space = ITEMS[a.kind].stack - b.n;
    const mv = Math.min(space, a.n);
    b.n += mv; a.n -= mv;
    if (a.n <= 0) arr[from] = null;
  } else {
    arr[from] = b; arr[to] = a;
  }
}

/**
 * Move part or all of one slot into another container. THE move — every
 * window, every direction, every nesting depth goes through here.
 *
 * `ti` is where the drag was released; null means "wherever it fits". A
 * container always travels whole, contents included, because splitting one
 * is meaningless and merging two would silently destroy the contents of one.
 */
function moveItems(
  from: ContainerRef, fi: number, to: ContainerRef, ti: number | null, n: number,
  opts?: { sourceChecked?: boolean },
): boolean {
  const src = refSlots(from);
  const dst = refSlots(to);
  if (!src || !dst) return false;
  // `sourceChecked` is for a source that is NOT a live container in the world
  // — a loose stack on the floor, wrapped in a throwaway holder by
  // `liftFloorStack`. Asking `refUsable` about that holder always says no,
  // because it is not in `world.corpses` and never will be.
  if ((!opts?.sourceChecked && !refUsable(from)) || !refUsable(to)) {
    flash("too far away", "#d96a5a");
    return false;
  }
  const st = src[fi];
  if (!st) return false;

  /* Dropping ONTO a container puts the thing INSIDE it rather than swapping
   * cells with it. Tibia's rule, and the one a player assumes: an open box is
   * a destination, not an obstacle. Without it, dragging wood onto the spare
   * backpack in your bag merely traded their positions — the two of them
   * looked identical afterwards and nothing had gone in. */
  if (ti !== null && !(sameRef(from, to) && ti === fi)) {
    const cell = dst[ti];
    if (cell?.items && cell !== st) {
      return moveItems(from, fi, { c: "nested", via: to, i: ti }, null, n, opts);
    }
  }

  // same container: pure rearrangement, no rules to check
  if (sameRef(from, to)) {
    if (ti !== null) swapOrMerge(src, fi, ti);
    return true;
  }

  /* A container may not be put inside itself, at any depth. Without this the
   * tree becomes a cycle: the pack still renders, but its contents are now
   * unreachable from any root and every recursive walk runs forever. */
  if (st.items && isInside(to, { c: "nested", via: from, i: fi })) {
    flash("it will not fit inside itself", "#d96a5a");
    return false;
  }

  const whole = !!st.items || ITEMS[st.kind].stack === 1;
  const take = whole ? st.n : Math.max(1, Math.min(n, st.n));

  // weight is charged only on the way IN to the player
  if (rootOf(to) === "player" && rootOf(from) === "world") {
    const wgt = ITEMS[st.kind].weight * take + (st.items ? bagWeight(st.items) : 0);
    if (wgt > freeCap(P)) { flash("too heavy", "#d96a5a"); return false; }
  }
  // …and the chest budget only on the way in to a chest
  const room = chestRoomLeft(to);
  if (room !== null) {
    const cost = whole ? stackSlotCost(st) : 1;
    // topping up a stack already in the chest costs no new slot
    const merging = ti !== null && dst[ti]?.kind === st.kind && !whole;
    if (!merging && cost > room) { flash("the chest is full", "#d96a5a"); return false; }
  }

  if (whole) {
    // detach first, so addStack cannot see it in two places at once
    src[fi] = null;
    const placed = ti !== null && dst[ti] === null ? (dst[ti] = st, true) : addStack(dst, st);
    if (!placed) { src[fi] = st; flash("no room", "#d96a5a"); return false; }
  } else {
    const before = take;
    let left: number;
    if (ti !== null && (dst[ti] === null || dst[ti]?.kind === st.kind)) {
      const cell = dst[ti];
      if (!cell) { dst[ti] = { kind: st.kind, n: take }; left = 0; }
      else {
        const space = ITEMS[st.kind].stack - cell.n;
        const mv = Math.min(space, take);
        cell.n += mv;
        left = take - mv;
      }
    } else {
      left = addItem(dst, st.kind, take);
    }
    const moved = before - left;
    if (moved <= 0) { flash("no room", "#d96a5a"); return false; }
    st.n -= moved;
    if (st.n <= 0) src[fi] = null;
  }

  if (rootOf(to) === "player" || rootOf(from) === "player") {
    syncCollectQuests(P, (t) => flash(t, "#ffe9a8"));
  }
  beep(rootOf(to) === "player" ? 440 : 360, 0.06, "sine", 0.04);
  return true;
}

/** Empty a world container into the bag, as far as weight and space allow. */
function takeAllFrom(ref: ContainerRef): void {
  const slots = refSlots(ref);
  if (!slots) return;
  let blocked = false;
  for (let i = slots.length - 1; i >= 0; i--) {
    if (!slots[i]) continue;
    if (!moveItems(ref, i, { c: "bag" }, null, slots[i]!.n)) { blocked = true; break; }
  }
  if (!blocked) closeIfEmpty(ref);
}

/** A looted-out corpse disappears, exactly as it always did. */
function closeIfEmpty(ref: ContainerRef): void {
  const base = baseOf(ref);
  if (base.c !== "corpse") return;
  const c = corpseById(cw(), base.id);
  if (!c || c.items.some((s) => s !== null)) return;
  const w = cw();
  const idx = w.corpses.indexOf(c);
  if (idx >= 0) w.corpses.splice(idx, 1);
  if (ui.loot === c) { ui.loot = null; closeWindow("loot"); }
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
function sendThroughPortal(kind: ItemKind, n: number, pt: { dest: WorldKey }, contents?: Bag): void {
  const from = cw();
  const dest = game.worlds[pt.dest];
  const back = dest.portals.find((p2) => p2.dest === from.key) ?? dest.portals[0];
  const gx = (back?.x ?? dest.w * TILE / 2) + (Math.random() - 0.5) * 16;
  const gy = (back?.y ?? dest.h * TILE / 2) + 28;
  /* A pack shoved through arrives WITH what is in it, and never merges: it is
   * one object, and folding two backpacks into a stack of two would fuse two
   * sets of contents and silently delete the loser's. */
  const near = contents ? undefined
    : dest.ground.find((g) => g.kind === kind && !g.items && Math.hypot(g.x - gx, g.y - gy) < 14);
  if (near) near.n += n;
  else dest.ground.push({ id: nextEntityId(), kind, n, x: gx, y: gy, t: GROUND_DESPAWN_S, ...(contents ? { items: contents } : {}) });
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
  // merge into a very close stack of the same kind to avoid clutter — never
  // into a container, whose `n` is an object count and not a quantity
  const near = world.ground.find((g) => g.kind === kind && !g.items && Math.hypot(g.x - gx, g.y - gy) < 14);
  if (near) near.n += n;
  else world.ground.push({ id: nextEntityId(), kind, n, x: gx, y: gy, t: GROUND_DESPAWN_S });
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
    sendThroughPortal(gi.kind, gi.n, pt, gi.items);
    return;
  }
  // ...and shoving one into the sea loses it, exactly like a bag throw
  if (t.sank) {
    const idx = world.ground.indexOf(gi);
    if (idx >= 0) world.ground.splice(idx, 1);
    sink(gi.kind, gi.n, t.x, t.y);
    return;
  }
  // two backpacks are two objects: merging them would fuse two sets of
  // contents into one and quietly delete the loser's
  const near = gi.items ? undefined
    : world.ground.find((g) => g !== gi && g.kind === gi.kind && !g.items && Math.hypot(g.x - t.x, g.y - t.y) < 14);
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
  /* A container has to travel as ONE object. Routing it through `addItem`
   * would mint a fresh empty pack of the same kind and leave everything
   * inside it on the floor with no owner — a silent, unrecoverable loss. */
  if (isContainer(gi.kind)) {
    const st: ItemStack = { kind: gi.kind, n: 1, items: gi.items };
    if (bagWeight([st]) + ITEMS[gi.kind].weight > freeCap(P)) { flash("too heavy"); return; }
    if (!addStack(P.bag, st)) { flash("bag full"); return; }
    const i = world.ground.indexOf(gi);
    if (i >= 0) world.ground.splice(i, 1);
    if (ui.floor === gi) { ui.floor = null; closeWindow("floor"); }
    beep(520, 0.06, "sine", 0.05, 80);
    return;
  }
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

/** How many are actually in a slot right now (the drag may be stale). */
const currentN = (ref: ContainerRef, index: number): number => {
  const arr = refSlots(ref);
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

/**
 * Resolve where a dragged item was released.
 *
 * Three kinds of thing can be dragged — a cell in some container, a worn
 * paperdoll piece, and a loose stack lying on the floor — and each can land
 * on a container cell, on an open window's body, on the paperdoll, or on the
 * map. Every container-to-container case now funnels into `moveItems`, so the
 * rules (reach, weight, chest budget, no-pack-inside-itself) are stated once.
 */
function resolveItemDrop(rx: number, ry: number): void {
  const d = itemDrag;
  if (!d) return;

  // ---- released over a specific cell ----
  for (let i = itemSlots.length - 1; i >= 0; i--) {
    const it = itemSlots[i];
    if (!(rx >= it.x && rx < it.x + it.w && ry >= it.y && ry < it.y + it.h)) continue;

    // onto the paperdoll
    if (it.eqSlot) {
      if (it.eqSlot === "pack") { wearPackFrom(d); return; }
      if (d.ref) act.equipItem(d.kind, d.index);
      return;
    }
    if (!it.ref) return;

    // from the paperdoll
    if (d.eqSlot) {
      if (d.eqSlot === "pack") { movePackTo(it.ref); return; }
      unequipInto(d.eqSlot, it.ref);
      return;
    }
    // from the floor
    if (d.floor) { liftFloorStack(d.floor, it.ref, it.index); return; }
    // container → container
    if (d.ref) askThenMove(d.ref, d.index, it.ref, it.index);
    return;
  }

  // ---- released over a window, but not on a cell: aim at that container ----
  const overRef = containerWindowAt(rx, ry);
  if (overRef) {
    if (d.eqSlot === "pack") { movePackTo(overRef); return; }
    if (d.eqSlot) { unequipInto(d.eqSlot, overRef); return; }
    if (d.floor) { liftFloorStack(d.floor, overRef, null); return; }
    if (d.ref) askThenMove(d.ref, d.index, overRef, null);
    return;
  }
  if (pointInOpenPanel(rx, ry)) return; // some other panel — cancel quietly

  // ---- released on the map → throw it there (Tibia-style) ----
  const wx = rx / vScale + cam.x;
  const wy = ry / vScale + cam.y;
  if (d.eqSlot === "pack") { dropWornPack(wx, wy); return; }
  if (d.eqSlot) { dropFromEq(d.eqSlot, wx, wy); return; }
  if (d.floor) {
    // no telekinesis: pushing loot around requires standing near it
    if (!withinReach(d.floor.x, d.floor.y)) { flash("too far away", "#d96a5a"); return; }
    throwGroundItem(d.floor, wx, wy);
    return;
  }
  if (!d.ref) return;
  if (rootOf(d.ref) === "world") {
    // straight from a corpse or a floor bag onto the ground beside it —
    // point 3 of the brief: loot you do not want should not have to detour
    // through your backpack to reach the floor
    if (!refUsable(d.ref)) { flash("too far away", "#d96a5a"); return; }
    dropFromContainer(d.ref, d.index, currentN(d.ref, d.index), wx, wy);
    return;
  }
  const n = currentN(d.ref, d.index);
  const slots = refSlots(d.ref);
  const st = slots ? slots[d.index] : null;
  if (n > 1 && !st?.items) {
    // a stack asks how many to throw; the aimed spot rides along in `at`
    ui.split = { kind: d.kind, index: d.index, ref: d.ref, max: n, n, canStore: false, at: { x: wx, y: wy } };
  } else if (n >= 1) {
    dropFromContainer(d.ref, d.index, n, wx, wy);
  }
}

/**
 * Complete a drag between containers, asking HOW MANY first when the stack is
 * worth asking about.
 *
 * Clicking a stack has always opened the amount chooser; dragging one silently
 * moved the lot, so the same stack answered two different questions depending
 * on which gesture you used. Tibia asks on the drag too. A single item, or a
 * container (which is one object and cannot be split), goes straight over —
 * a dialog with only one possible answer is just a second click.
 */
function askThenMove(from: ContainerRef, fi: number, to: ContainerRef, ti: number | null): void {
  const slots = refSlots(from);
  const st = slots ? slots[fi] : null;
  if (!st) return;
  // rearranging INSIDE one container is positional, never a quantity question
  const rearrange = sameRef(from, to) && !(ti !== null && slots![ti]?.items);
  if (st.items || st.n <= 1 || rearrange) {
    if (moveItems(from, fi, to, ti, st.n)) closeIfEmpty(from);
    return;
  }
  ui.split = { kind: st.kind, index: fi, ref: from, max: st.n, n: st.n, canStore: false, to: { ref: to, index: ti } };
}

/**
 * What a window is currently looking at.
 *
 * A window's kind gives its HOME container; `ref` overrides it once the window
 * has been navigated somewhere. Both callers below need the same answer, and
 * getting it inconsistent is how a back arrow ends up closing the wrong panel.
 */
function viewRefOf(w: PanelWindow): ContainerRef | null {
  return w.ref ?? baseRefOf(w.kind);
}

/** The container window under this screen point, if the point missed its cells. */
function containerWindowAt(rx: number, ry: number): ContainerRef | null {
  for (let i = ui.windows.length - 1; i >= 0; i--) {
    const w = ui.windows[i];
    if (!w.rect) continue;
    if (!(rx >= w.rect.x && rx < w.rect.x + w.rect.w && ry >= w.rect.y && ry < w.rect.y + w.rect.h)) continue;
    return viewRefOf(w);
  }
  return null;
}

/** The container a root window shows. Nested windows carry their own `ref`. */
function baseRefOf(kind: PanelKind): ContainerRef | null {
  if (kind === "bag") return P.pack ? { c: "bag" } : null;
  if (kind === "stash") return ui.stash ? { c: "stash", id: ui.stash.id } : null;
  if (kind === "loot") return ui.loot ? { c: "corpse", id: ui.loot.id } : null;
  if (kind === "floor") return ui.floor ? { c: "ground", id: ui.floor.id } : null;
  return null;
}

/**
 * Double-tap a stack to send it to the other open container.
 *
 * WHY THIS IS NOT JUST A CONVENIENCE
 * ----------------------------------
 * Dragging works and will keep working, but it is the gesture that survives a
 * network worst. A drag is a conversation: finger down, something lifts, it
 * follows, it lands. Over a wire the middle of that conversation is a
 * prediction — the client has already lifted the item and drawn it under the
 * thumb before the server has agreed to any of it — so a rejected drag has to
 * be un-drawn, mid-gesture, with the finger still down. That is the ugliest
 * failure mode in the whole inventory.
 *
 * A double tap has no middle. It is one message, and a rejected one simply
 * does not happen: the stack stays where it was and a line appears in the log.
 * Building it now means the drag code never has to become the only way to
 * move anything, which is the position it would otherwise be in the day the
 * server arrives.
 *
 * WHERE "THE OTHER ONE" IS
 * ------------------------
 * The topmost open container that is not the one holding the stack. That is
 * unambiguous whenever two are open, which is the case this is for — bag and
 * chest, bag and corpse. With only the bag open there is no other side and it
 * says so rather than guessing at the floor, because "send" quietly meaning
 * "drop on the ground" is how you lose a rare.
 */
function sendStack(from: ContainerRef, index: number): boolean {
  const slots = refSlots(from);
  const st = slots?.[index];
  if (!slots || !st) return false;

  // Newest window first: with three containers open, the one you just opened
  // is the one you are filling.
  const open: ContainerRef[] = [];
  for (let i = ui.windows.length - 1; i >= 0; i--) {
    const r = viewRefOf(ui.windows[i]);
    if (r) open.push(r);
  }
  if (P.pack) open.push({ c: "bag" });

  const dest = open.find((r) => !sameRef(baseOf(r), baseOf(from)) && !isInside(r, from) && refUsable(r));
  if (!dest) {
    flash("open another container to send to", "#e0a06a");
    return false;
  }
  if (!moveItems(from, index, dest, null, st.n)) return false;
  beep(420, 0.04, "sine", 0.03, -30);
  return true;
}

/** Take `n` out of a container and put them on the ground (optionally aimed). */
function dropFromContainer(ref: ContainerRef, index: number, n: number, tx?: number, ty?: number): void {
  const slots = refSlots(ref);
  const st = slots ? slots[index] : null;
  if (!slots || !st) return;
  if (st.items) {
    // a pack goes down whole, contents and all — that IS the loot bag
    slots[index] = null;
    dropContainerToGround(st, tx, ty);
    return;
  }
  const take = Math.min(n, st.n);
  st.n -= take;
  if (st.n <= 0) slots[index] = null;
  dropToGround(st.kind, take, tx, ty);
}

/** Put a whole container object on the floor, keeping what is inside it. */
function dropContainerToGround(st: ItemStack, tx?: number, ty?: number): void {
  const world = cw();
  let gx: number;
  let gy: number;
  if (tx !== undefined && ty !== undefined) {
    const t = resolveThrowTarget(tx, ty);
    // a pack aimed at a portal takes the trip, contents and all — the same
    // deal a loose stack gets, and the one a player will assume
    const pt = portalAt(t.x, t.y);
    if (pt) { sendThroughPortal(st.kind, 1, pt, st.items); return; }
    // …and a pack thrown into the sea is a pack, and everything in it, gone
    if (t.sank) { sink(st.kind, 1, t.x, t.y); return; }
    gx = t.x; gy = t.y;
  } else {
    gx = P.x + (Math.random() - 0.5) * 16;
    gy = P.y + 4 + (Math.random() - 0.5) * 16;
  }
  // never merged into a nearby stack: two backpacks are two objects
  world.ground.push({ id: nextEntityId(), kind: st.kind, n: 1, x: gx, y: gy, t: GROUND_DESPAWN_S, items: st.items });
  flash(`dropped ${ITEMS[st.kind].name}`, "#cfa86a");
  beep(200, 0.06, "sine", 0.04, -60);
}

/** A loose floor stack dragged into a container. */
function liftFloorStack(gi: GroundItem, to: ContainerRef, ti: number | null): void {
  const world = cw();
  if (!world.ground.includes(gi)) return;
  if (!withinReach(gi.x, gi.y)) { flash("too far away", "#d96a5a"); return; }
  if (!refUsable(to)) { flash("too far away", "#d96a5a"); return; }
  const dst = refSlots(to);
  if (!dst) return;
  // a pack cannot be lifted into itself
  if (baseOf(to).c === "ground" && (baseOf(to) as { id: number }).id === gi.id) {
    flash("it will not fit inside itself", "#d96a5a");
    return;
  }
  /* Route it through a throwaway one-slot holder so the ONE move with all the
   * rules in it stays the only code that puts something somewhere. The holder
   * is not in the world, so its reach was checked above instead — hence
   * `sourceChecked`. */
  const shim: Bag = [{ kind: gi.kind, n: gi.n, items: gi.items }];
    /* A `loose` address rather than a fake corpse. The stack being lifted is
   * not in any container yet, so it is handed an address that names the shim
   * directly — which is exactly what the `loose` member exists for, and it
   * stops this from being a body that pretends to lie on the floor. */
  const via: ContainerRef = { c: "loose", slots: shim };
  if (!moveItems(via, 0, to, ti, gi.n, { sourceChecked: true })) return;
  const leftover = shim[0];
  if (leftover) { gi.n = leftover.n; gi.items = leftover.items; }
  else {
    const idx = world.ground.indexOf(gi);
    if (idx >= 0) world.ground.splice(idx, 1);
  }
}

/* ---------------- the worn backpack ---------------- */

/** Put on the backpack the player just dragged onto the Bag slot. */
function wearPackFrom(d: NonNullable<typeof itemDrag>): void {
  if (d.floor) { wearPackFromFloor(d.floor); return; }
  if (d.eqSlot || !d.ref) return;
  const slots = refSlots(d.ref);
  const st = slots ? slots[d.index] : null;
  if (!slots || !st) return;
  if (!isContainer(st.kind)) { flash("that is not a backpack", "#d96a5a"); return; }
  if (!refUsable(d.ref)) { flash("too far away", "#d96a5a"); return; }
  const old = P.pack;
  slots[d.index] = null;
  P.pack = st;
  /* The pack being replaced goes INSIDE the new one. It has to go somewhere,
   * and the alternative — refuse the swap — is a dead end, because the new
   * pack is almost always sitting in the old one and could not be worn at
   * all. Detaching first is what keeps that from becoming a cycle. */
  if (old) {
    if (!addStack(st.items!, old)) dropContainerToGround(old);
  }
  flash("backpack on", "#b9e07f");
  beep(420, 0.07, "sine", 0.05);
}

/** …the same, but the pack was lying on the floor. */
function wearPackFromFloor(gi: GroundItem): void {
  const world = cw();
  if (!isContainer(gi.kind)) { flash("that is not a backpack", "#d96a5a"); return; }
  if (!world.ground.includes(gi)) return;
  if (!withinReach(gi.x, gi.y)) { flash("too far away", "#d96a5a"); return; }
  const st: ItemStack = { kind: gi.kind, n: 1, items: gi.items };
  const old = P.pack;
  P.pack = st;
  const idx = world.ground.indexOf(gi);
  if (idx >= 0) world.ground.splice(idx, 1);
  if (old && !addStack(st.items ?? [], old)) dropContainerToGround(old);
  if (ui.floor === gi) { ui.floor = null; closeWindow("floor"); }
  flash("backpack on", "#b9e07f");
}

/** Take the worn pack off into some other container. */
function movePackTo(to: ContainerRef): void {
  const st = P.pack;
  if (!st) return;
  // it cannot go into itself, and "the bag" IS itself
  if (baseOf(to).c === "bag") { flash("it will not fit inside itself", "#d96a5a"); return; }
  if (!refUsable(to)) { flash("too far away", "#d96a5a"); return; }
  const dst = refSlots(to);
  if (!dst) return;
  const room = chestRoomLeft(to);
  if (room !== null && stackSlotCost(st) > room) { flash("the chest is full", "#d96a5a"); return; }
  if (!addStack(dst, st)) { flash("no room", "#d96a5a"); return; }
  P.pack = null;
  flash("backpack off", "#e0a06a");
}

/** Take the worn pack off onto the ground. */
function dropWornPack(tx?: number, ty?: number): void {
  const st = P.pack;
  if (!st) return;
  P.pack = null;
  dropContainerToGround(st, tx, ty);
  flash("backpack off", "#e0a06a");
}

/** Unequip a worn gear piece into a specific container. */
function unequipInto(slot: EqSlot, to: ContainerRef): void {
  const kind = P.eq[slot];
  if (!kind) return;
  if (!refUsable(to)) { flash("too far away", "#d96a5a"); return; }
  const dst = refSlots(to);
  if (!dst) return;
  const room = chestRoomLeft(to);
  if (room !== null && room < 1) { flash("the chest is full", "#d96a5a"); return; }
  // worn gear never counted toward carry cap, so putting it in the bag can
  // push you over — the same check a pickup gets
  if (rootOf(to) === "player" && itemWeight(kind, 1) > freeCap(P)) { flash("too heavy", "#d96a5a"); return; }
  if (!addStack(dst, { kind, n: 1 })) { flash("no room", "#d96a5a"); return; }
  P.eq[slot] = null;
  refreshDerived(P);
  beep(300, 0.08, "triangle", 0.05);
}

/** Open the quantity chooser for a container slot (or move a single item flat). */
function openMoveChooser(ref: ContainerRef, index: number): void {
  const arr = refSlots(ref);
  const slot = arr ? arr[index] : null;
  if (!slot) return;
  // a container is never split, and tapping one opens it rather than moving it
  if (slot.items) return;
  const canStore = ui.windows.some((w) => w.kind === "stash");
  // one item, single obvious action → skip the chooser. On touch a bag item
  // still opens it, because Drop vs Throw is a real choice there (no mouse
  // drag exists to aim a throw with).
  if (slot.n <= 1) {
    if (rootOf(ref) === "world") { moveItems(ref, index, { c: "bag" }, null, 1); closeIfEmpty(ref); return; }
    if (canStore && ui.stash) { moveItems(ref, index, { c: "stash", id: ui.stash.id }, null, 1); return; }
    if (!touchUI) { dropFromContainer(ref, index, 1); return; }
  }
  ui.split = { kind: slot.kind, index, ref, max: slot.n, n: slot.n, canStore };
}

function splitConfirm(mode: "store" | "take" | "drop" | "throw" | "move"): void {
  const sp = ui.split;
  if (!sp) return;
  const n = Math.max(1, Math.min(sp.max, sp.n));
  // the source may have walked out of reach or rotted while the chooser sat
  // open, so every path re-validates rather than trusting the captured ref
  if (mode === "move") {
    if (sp.to) { moveItems(sp.ref, sp.index, sp.to.ref, sp.to.index, n); closeIfEmpty(sp.ref); }
  } else if (mode === "store") {
    if (!ui.stash || !hasWindow("stash")) { ui.split = null; return; }
    moveItems(sp.ref, sp.index, { c: "stash", id: ui.stash.id }, null, n);
  } else if (mode === "take") {
    moveItems(sp.ref, sp.index, { c: "bag" }, null, n);
    closeIfEmpty(sp.ref);
  } else if (mode === "throw") {
    if (sp.at) dropFromContainer(sp.ref, sp.index, n, sp.at.x, sp.at.y); // aimed by the drag
    else {
      // arm the throw: the NEXT tap on the map is the target tile
      throwPending = { kind: sp.kind, n };
      flash("tap the ground to throw", "#8ab6ff");
    }
  } else {
    dropFromContainer(sp.ref, sp.index, n);
  }
  ui.split = null;
}

import { craftAcross } from "./items.ts";
function craftAt(r: Recipe): boolean {
  const goldCost = r.gold ?? 0;
  // the Forge already spends materials out of your chests; its fee follows the
  // same purse, or you would be told you cannot afford what is ten feet away
  const purse = [P.bag, ...homeChests(game)];
  if (walletAcross(purse) < goldCost) { flash("not enough gold", "#d96a5a"); return false; }
  if (craftAcross([P.bag, ...homeChests(game)], r)) {
    takeGoldAcross(purse, goldCost);
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
  takeGold(P.bag, 1);
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
  else w0.ground.push({ id: nextEntityId(), kind, n: left, x: P.x, y: P.y, t: GROUND_DESPAWN_S });
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
  if (walletAcross([P.bag, ...homeChests(game)]) < o.gold) { flash("need gold", "#d96a5a"); return; }
  if (!canCarry(P, o.crystal, o.buyN)) { flash("too heavy"); return; }
  const moved = o.buyN - addItem(P.bag, o.crystal, o.buyN);
  if (moved < o.buyN) { if (moved > 0) removeItem(P.bag, o.crystal, moved); flash("bag full"); return; }
  payCost(P.bag, o.cost, homeChests(game));
  takeGoldAcross([P.bag, ...homeChests(game)], o.gold);
  flash(`+${o.buyN} ${ITEMS[o.crystal].name}`, "#b9e07f");
  beep(520, 0.18, "square", 0.05, 90);
}

function doResearch(id: string): void {
  const r = researchById(id);
  if (!r || isResearched(r.id)) return;
  if (!towerTierOk(r, towerTier())) { flash(`needs an Alchemy Tower ${"I".repeat(towerTierFor(r))}`, "#d96a5a"); return; }
  if (!attunementOk(r)) { flash("attune this element first", "#d96a5a"); return; }
  if (!canAfford(P.bag, r.researchCost, homeChests(game))) { flash("need materials"); return; }
  if (walletAcross([P.bag, ...homeChests(game)]) < (r.researchGold ?? 0)) { flash("need gold", "#d96a5a"); return; }
  payCost(P.bag, r.researchCost, homeChests(game));
  takeGoldAcross([P.bag, ...homeChests(game)], r.researchGold ?? 0);
  markResearched(r.id);
  flash(`researched ${r.name}`, "#c9a6ff");
  beep(520, 0.18, "square", 0.06, 120);
}

function doBuyCrystal(id: string): void {
  const r = researchById(id);
  if (!r || !isResearched(r.id)) return;
  if (!canAfford(P.bag, r.buyCost, homeChests(game))) { flash("need materials"); return; }
  if (walletAcross([P.bag, ...homeChests(game)]) < (r.buyGold ?? 0)) { flash("need gold", "#d96a5a"); return; }
  if (!canCarry(P, r.crystal, r.buyN)) { flash("too heavy"); return; }
  const moved = r.buyN - addItem(P.bag, r.crystal, r.buyN);
  if (moved < r.buyN) { if (moved > 0) removeItem(P.bag, r.crystal, moved); flash("bag full"); return; }
  payCost(P.bag, r.buyCost, homeChests(game));
  takeGoldAcross([P.bag, ...homeChests(game)], r.buyGold ?? 0);
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
  const ref: ContainerRef = { c: "corpse", id: c.id };
  moveItems(ref, index, { c: "bag" }, null, refSlots(ref)?.[index]?.n ?? 1);
  closeIfEmpty(ref);
}

/* ---------------- container window navigation ---------------- */

/**
 * Open the pack in slot `index` of `ref`.
 *
 * `ref` is passed in rather than guessed from whichever window is frontmost —
 * guessing was a real bug. The Storage Chest window draws YOUR backpack in its
 * lower half, so clicking a pack there asked the front window (the chest) to
 * walk into a slot index that meant something entirely different inside the
 * chest, and usually nothing at all.
 */
function navInto(ref: ContainerRef, index: number, win?: PanelWindow): void {
  const target: ContainerRef = { c: "nested", via: ref, i: index };
  if (!slotsOf(target, refCtx())) return;
  /* In place, if the click came from the window already showing `ref`. That is
   * the Tibia behaviour and the one Radek asked for: a bag inside a bag
   * replaces the view you clicked in, rather than throwing a fresh window into
   * the middle of the screen. Want two open at once? Walk one in, then open
   * the backpack again from the equipment slot — that gets its own window. */
  const view = win ? viewRefOf(win) : null;
  /* On a phone, a spare sheet beats navigating in place.
   *
   * Walking a bag into its sub-pack replaces the only view you had, which is
   * fine with a mouse and a screenful of windows and useless on a phone: two
   * packs side by side is the whole reason you opened the first one. So when
   * a second sheet is free the sub-pack takes it, and once both are full the
   * Tibia in-place behaviour returns. */
  const spareSheet = deck.on && ui.windows.length < MAX_SHEETS;
  if (win && view && sameRef(view, ref) && !spareSheet) {
    win.ref = target;
    // A pack you walk into opens at the top, never half-way down the one you
    // just left.
    win.scroll = 0;
    beep(380, 0.05, "sine", 0.04, 40);
    return;
  }
  openContainer(target);
}

/**
 * Go up to the container holding this one.
 *
 * If the parent already has a window, this one is redundant and closes —
 * otherwise pressing up would leave two windows showing the same pack.
 */
function navUp(ref: ContainerRef, win?: PanelWindow): void {
  if (ref.c !== "nested") return;
  // In place, mirroring navInto: the arrow walks THIS window back out.
  const view = win ? viewRefOf(win) : null;
  if (win && view && sameRef(view, ref)) {
    const home = baseRefOf(win.kind);
    win.ref = home && sameRef(home, ref.via) ? undefined : ref.via;
    win.scroll = 0;
    beep(300, 0.05, "sine", 0.04, -40);
    return;
  }
  const here = ui.windows.find((w) => w.ref && sameRef(w.ref, ref));
  const parent = ref.via;
  const parentOpen = windowShowing(parent);
  if (here) ui.windows.splice(ui.windows.indexOf(here), 1);
  if (parentOpen) raise(parentOpen);
  else if (parent.c === "nested") openContainer(parent);
  else if (parent.c === "bag") openWindow("bag");
  else if (parent.c === "stash") {
    const st = structureById(cw(), parent.id, game.worlds.home);
    if (st) { ui.stash = st; openWindow("stash"); }
  } else if (parent.c === "corpse") {
    const c = corpseById(cw(), parent.id);
    if (c) { ui.loot = c; openWindow("loot"); }
  } else if (parent.c === "ground") {
    const gi = groundById(cw(), parent.id);
    if (gi) { ui.floor = gi; openWindow("floor"); }
  }
  beep(300, 0.05, "sine", 0.04, -40);
}

import { SHOPS } from "./entities/npcs.ts";
function doBuy(kind: ItemKind): void {
  if (!ui.npc) return;
  const shop = SHOPS[ui.npc.key];
  if (!shop) return;
  const entry = shop.entries.find((e) => e.kind === kind);
  if (!entry || entry.buy <= 0 || P.gold < entry.buy) return;
  if (!canCarry(P, kind)) { flash("too heavy"); return; }
  // pay FIRST: coins leaving the bag can be the very slot the goods need,
  // and a purse of loose change is exactly when that happens
  if (!takeGold(P.bag, entry.buy)) { flash("not enough gold", "#d96a5a"); return; }
  if (addItem(P.bag, kind, 1) > 0) { giveGold(P.bag, entry.buy); flash("bag full"); return; }
  beep(440, 0.1, "sine", 0.05);
}
function doSell(kind: ItemKind): void {
  if (!ui.npc) return;
  const shop = SHOPS[ui.npc.key];
  if (!shop) return;
  const entry = shop.entries.find((e) => e.kind === kind);
  if (!entry || entry.sell <= 0) return;
  // coins are goods too, and selling them to buy them back would be a bug
  if (ITEMS[kind].coin) return;
  // check the change will fit BEFORE handing the goods over, or a full bag
  // turns a sale into a donation
  if (!walletRoomFor(P.bag, entry.sell)) { flash("no room for the coins", "#e0a06a"); return; }
  // a pack with things in it is not merchandise — see removeItemUnpacked
  if (!removeItemUnpacked(P.bag, kind, 1)) {
    flash(isContainer(kind) ? "empty it first" : "you have none", "#e0a06a");
    return;
  }
  giveGold(P.bag, entry.sell);
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

/** "snake" -> "Snake"; monster kinds are stored as their lowercase key. */
function titleCase(k: string): string {
  return k.charAt(0).toUpperCase() + k.slice(1);
}

/**
 * Describe what is on a tile, into the log.
 *
 * Tibia's "look" writes a sentence rather than opening anything, and that is
 * the right shape for a phone: a popup would cover the thing being looked at.
 * It also gives the log its first job that is not a warning.
 */
/** What a structure is called, tier and all. */
function structureName(s: Structure): string {
  const def = STRUCTS[s.key as keyof typeof STRUCTS];
  if (!def) return s.key === "treasure" ? "a treasure chest" : "something built here";
  const tier = (s.tier ?? 1) > 1 ? ` (tier ${s.tier})` : "";
  return `${def.name}${tier}`;
}

/**
 * Is that tile the one the player is standing on?
 *
 * Exact, not the ±1 the entity searches use — those are loose because a
 * sprite is taller than its tile and you are aiming at a drawn body rather
 * than a square. You are never aiming at your OWN body: you are aiming at a
 * tile you already know, and a loose test would answer "yourself" for the
 * square beside you, which is the square you meant to walk to.
 *
 * Shared by the menu and by the look so the two cannot disagree about who is
 * being pointed at — a menu headed "Look at yourself" whose Look then
 * describes the floor is worse than either behaviour on its own.
 */
function onPlayerTile(tx: number, ty: number): boolean {
  return P.tx === tx && P.ty === ty;
}

function lookAtTile(at: Vec): void {
  const world = cw();
  const tx = toTile(at.x);
  const ty = toTile(at.y);

  /* Yourself first, for the same reason the menu resolves people before
   * things: if you pointed at your own square, the answer is you, even with
   * a rat breathing on the next tile that the loose search below would
   * otherwise claim. */
  if (onPlayerTile(tx, ty)) {
    logServer(`You see yourself — level ${P.level}, ${Math.ceil(P.hp)}/${P.maxhp} hp.`);
    const s = skull();
    if (s !== "none") {
      logServer(s === "red"
        ? "You are marked with a red skull."
        : "You are marked with a white skull.");
    }
    return;
  }

  /* Then things that MOVE, then things that were dropped, then things that
   * were built, then the landscape. Roughly "how likely is this what you
   * meant", and it matters: a coin lying at the foot of a chest should be
   * the coin, and a rat standing in front of the chest should be the rat. */
  const m = nearestHit(world.monsters, at, (x) => x.hp > 0);
  if (m) { logServer(`You see ${titleCase(m.kind)} — ${Math.ceil(m.hp)}/${m.maxhp} hp.`); return; }
  const n = nearestHit(world.npcs, at);
  if (n) { logServer(`You see ${n.name}.`); return; }
  const gi = nearestHit(world.ground, at);
  if (gi) { logServer(`You see ${gi.n > 1 ? `${gi.n} ` : ""}${ITEMS[gi.kind].name}.`); return; }
  const c = nearestHit(world.corpses, at);
  if (c) { logServer(`You see the remains of ${titleCase(c.name)}.`); return; }

  /* Everything below is addressed by TILE rather than by pixel, and each one
   * has a footprint bigger than the square that names it — which is why
   * looking at a chest used to report the ground. A structure is anchored by
   * its top-left tile, so three of its four squares matched nothing at all
   * and fell through to the floor. That is the bug Radek hit on the chest,
   * and the rocks and trees below were simply never searched. */
  const st = footprintHit(world.structures, tx, ty,
    (s) => { const k = footprint(s.key); return { w: k, h: k }; });
  if (st) { logServer(`You see ${structureName(st)}.`); return; }
  const tr = world.trees.find((t) => t.tx === tx && t.ty === ty);
  if (tr) { logServer(tr.stump ? "You see a tree stump." : "You see a tree."); return; }
  const rk = world.rocks.find((r) => r.tx === tx && r.ty === ty);
  if (rk) { logServer(rk.depleted ? "You see a spent rock." : "You see a rock."); return; }
  const sc = footprintHit(world.scenery, tx, ty, (s) => FOOTPRINT[s.kind]);
  if (sc) { logServer(`You see ${SCENERY_NAME[sc.kind]}.`); return; }
  const fi = world.fires.find((f) => f.tx === tx && f.ty === ty);
  if (fi) { logServer("You see a campfire."); return; }

  logServer(`You see the ground. (${tx}, ${ty})`);
}

/* ---------------- the long-press menu ---------------- */

let ctxMenu: ContextMenu | null = null;

/**
 * Walk to a world point, the way every route into "go there" wants it.
 *
 * Shared by the menu's "Walk here" and by whatever else asks. The one subtle
 * part is the ranged target: with a bow drawn, walking must NOT drop the mark,
 * or shoot-and-run stops working the moment you tell the character where to
 * stand. That rule used to live only in the desktop right-click branch, which
 * is exactly where it got lost when right-click became a menu.
 */
function walkToPoint(at: Vec): void {
  P.dest = { x: at.x, y: at.y };
  P.gather = null;
  const keepShot = !!P.target
    && (P.target.kind === "mob" || P.target.kind === "dummy")
    && attackMode().ranged;
  if (!keepShot) P.target = null;
  moveMarker = { x: at.x, y: at.y, t: 0.5 };
}

/**
 * Build and open the menu for whatever is under the pointer.
 *
 * Opened by a right-click on a desktop and by a long press on a phone — the
 * same menu, the same entries, built here once. Those are the same gesture on
 * two devices and there is no reason for them to have different answers.
 *
 * Ordered the way the verbs are urgent: what is ON the tile first, walking
 * last. That is the opposite of how the list reads, so "Walk here" sits at the
 * bottom where the thumb naturally rests and the object's own verbs sit above
 * it, closest to the thing they act on.
 */
function openContextMenu(sx: number, sy: number): void {
  if (P.dead || hudEditing()) return;

  /* AN INVENTORY SLOT, before anything else.
   *
   * Slots live inside panels, so this has to come above the panel guard below
   * or the menu would refuse the press for being "on chrome". Reverse order
   * for the same reason the tap sweep uses it: the topmost window's slots are
   * registered last, and on overlapping panels the top one owns the pixel.
   *
   * Look is the only entry. Every other verb an item has — use, equip, split,
   * drop — already has a one-click or drag gesture that works, and adding a
   * second way to do each would be two code paths per verb to keep in step.
   * Describing an item was the one thing with no gesture at all: it used to
   * happen by ITSELF whenever the cursor drifted over a slot, which is not a
   * gesture, it is an accident that happens to be useful sometimes. */
  for (let i = itemSlots.length - 1; i >= 0; i--) {
    const it = itemSlots[i];
    if (sx < it.x || sx >= it.x + it.w || sy < it.y || sy >= it.y + it.h) continue;
    if (it.n <= 0) return; // an empty cell has nothing to describe
    const kind = it.kind;
    ctxMenu = {
      sx, sy, at: { x: 0, y: 0 },
      entries: [{ verb: "look", label: `Look at ${ITEMS[kind].name}`, enabled: true,
        run: () => { ui.inspect = kind; } }],
      rects: [],
    };
    return;
  }

  // A press on the rest of the chrome is a press on chrome; this is for the world.
  if (pointInOpenPanel(sx, sy) || overTouchButton(sx, sy)) return;

  const at: Vec = { x: sx / vScale + cam.x, y: sy / vScale + cam.y };
  const world = cw();
  const entries: MenuEntry[] = [];
  const tx = toTile(at.x);
  const ty = toTile(at.y);

  /* PEOPLE FIRST, and today that means exactly one person: you.
   *
   * The player is not an entity in `world` — there has only ever been one, so
   * he never needed to be in a list — which is why this is a coordinate test
   * rather than a `find`. When other players arrive they WILL be entities and
   * this becomes the same lookup as the four below it, feeding the same
   * builder with `self: false`. That is the whole reason the builder takes a
   * name and a flag instead of reading the player directly. */
  if (onPlayerTile(tx, ty)) {
    entries.push(...playerEntries(
      { name: SELF, self: true, tradeLive: false, mayAttack: false },
      { look: () => lookAtTile(at), trade: () => undefined, attack: () => undefined },
    ));
  }

  /* `nearestHit`, not `find` — same reason as the look. A menu offering
   * "Take Plate Armor" while the cursor is on the knight armour beside it is
   * worse than the look getting it wrong, because the look only misinforms
   * and the menu acts. */
  const m = nearestHit(world.monsters, at, (x) => x.hp > 0);
  if (m) {
    entries.push({ verb: "attack", label: `Attack ${titleCase(m.kind)}`, enabled: true,
      run: () => { P.target = { kind: "mob", id: m.id }; P.dest = null; P.gather = null; } });
  }
  const c = nearestHit(world.corpses, at);
  if (c) {
    entries.push({ verb: "loot", label: "Look inside", enabled: true,
      run: () => { P.target = { kind: "corpse", id: c.id }; P.dest = null; } });
  }
  const gi = nearestHit(world.ground, at);
  if (gi) {
    entries.push({ verb: "take", label: `Take ${ITEMS[gi.kind].name}`, enabled: true,
      run: () => { P.target = { kind: "ground", id: gi.id }; P.dest = null; } });
  }
  const n = nearestHit(world.npcs, at);
  if (n) {
    entries.push({ verb: "talk", label: `Talk to ${n.name}`, enabled: true,
      run: () => { P.target = { kind: "npc", id: n.id }; n.talk = NPC_TALK_HOLD_S; P.dest = null; } });
    /* The entry this whole menu was built for. Greyed rather than missing:
     * the shape the player learns today is the shape they keep. */
    entries.push({ verb: "trade", label: `Trade with ${n.name}`, enabled: false,
      why: "Trading opens with the world." });
  }
  /* Walk, and Look ONLY WHERE A POINTER CAN AFFORD IT.
   *
   * On a desktop, Look belongs here: the cursor is a pixel, the menu opens
   * away from it, and you can see what you asked about while you read the
   * answer.
   *
   * On a phone none of that holds. The menu opens under a fingertip that has
   * been resting on the target for four hundred milliseconds, so the menu
   * covers the very thing being described — and the finger covered it before
   * the menu did. Radek's verdict after playing it was that it worked badly,
   * and it is not a bug to be tuned: it is the gesture being wrong for the
   * verb. Touch gets the LOOK toggle on the drop-down instead, where you tap
   * a thing once, briefly, and read an answer that is nowhere near your hand.
   *
   * `deck.on` rather than `isTouchDevice()`: a laptop with a touchscreen has
   * a mouse too, and the question is which INTERFACE is on screen. */
  entries.push(...(deck.on
    ? [{ verb: "walk" as const, label: "Walk here", enabled: true, run: () => walkToPoint(at) }]
    : groundEntries(() => walkToPoint(at), () => lookAtTile(at))));

  ctxMenu = { sx, sy, at, entries, rects: [] };
}

function closeContextMenu(): void {
  ctxMenu = null;
}

/** A tap while the menu is open: run an entry, or dismiss. Returns handled. */
function contextMenuTap(sx: number, sy: number): boolean {
  if (!ctxMenu) return false;
  for (const r of ctxMenu.rects) {
    if (sx >= r.x && sx < r.x + r.w && sy >= r.y && sy < r.y + r.h) {
      const e = ctxMenu.entries[r.i];
      closeContextMenu();
      if (!e.enabled) { flash(e.why ?? "not yet", "#e0a06a"); return true; }
      e.run?.();
      return true;
    }
  }
  closeContextMenu();
  return true; // the dismissing tap is spent on dismissing; it does not also walk
}

function handleWorldTap(sx: number, sy: number): void {
  unlockAudio();
  if (contextMenuTap(sx, sy)) return;
  // hotspots are collected during draw; the topmost window's are last, so
  // check them first (reverse) to respect z-order on overlapping panels.
  for (let i = hotspots.length - 1; i >= 0; i--) {
    const hsp = hotspots[i];
    if (sx >= hsp.x && sx < hsp.x + hsp.w && sy >= hsp.y && sy < hsp.y + hsp.h) {
      hsp.fn();
      return;
    }
  }
  /* The drop-down is dismissed by the tap that misses it, like every menu.
   * Reached only after the hotspot sweep above, so a tap that DID land on a tab
   * has already opened its panel and closed the menu itself. */
  if (deckMenu) { deckMenu = false; return; }
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
    if (idx >= 0) dropFromContainer({ c: "bag" }, idx, t.n, w.x, w.y);
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
  /* Look mode: the tap DESCRIBES what it landed on and does nothing else.
   *
   * Below the armed cursors on purpose. A throw or a Burst is something the
   * player armed one tap ago and is about to spend; look mode is a standing
   * setting they may have left on since Tuesday, and the recent, deliberate
   * thing has to win. Above walking, obviously, or the mode would do nothing
   * at all on the one surface it exists for.
   *
   * This is the whole of "look at everything" on a phone. It used to reach
   * only inventory slots — the panels honoured `lookMode` and the world knew
   * nothing about it — which is why the toggle felt broken: you turned looking
   * on, tapped a chest, and walked to it.
   */
  if (ui.lookMode) { lookAtTile(w); return; }
  worldClick(w);
}

/* ---------------- screen wake lock ---------------- */

/**
 * Stop the phone dimming out mid-hunt.
 *
 * A bow fight is thirty seconds of watching and one tap; the screen timeout
 * does not know the difference between that and a phone face-down on a table,
 * so it dims exactly when the fight gets interesting. Native games get this
 * for free from the OS. On the web it is one API, and one that is genuinely
 * optional: `wakeLock` is absent on older iOS and the request can be refused
 * outright on low battery, so every path here fails quietly and the game
 * carries on. A dimming screen is a nuisance; a crash on start-up is not.
 *
 * The lock is dropped by the browser whenever the tab is hidden and has to be
 * taken again on return — hence the visibility listener, without which it
 * works exactly once per session and then silently stops.
 */
let wakeLock: { release: () => Promise<void>; released: boolean } | null = null;

async function acquireWakeLock(): Promise<void> {
  const nav = navigator as unknown as {
    wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void>; released: boolean }> };
  };
  if (!nav.wakeLock || document.visibilityState !== "visible") return;
  try {
    wakeLock = await nav.wakeLock.request("screen");
  } catch {
    // refused (battery saver, no permission, unsupported) — not our problem
    wakeLock = null;
  }
}

function initWakeLock(): void {
  if (typeof document === "undefined") return;
  void acquireWakeLock();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && (!wakeLock || wakeLock.released)) void acquireWakeLock();
  });
}

/* ---------------- chat ---------------- */

/**
 * Open the input field.
 *
 * Reading chat needs no button — the log lies on the world and is always
 * there. Only WRITING needs chrome, and only while it is happening, which is
 * why this is a verb rather than a panel.
 */
function openChat(prefill = ""): void {
  markAllRead();
  chatInput().open(prefill);
}

function closeChat(): void {
  chatInput().close();
}

/**
 * Send what was typed.
 *
 * There is exactly one channel to send to, so there is nothing to choose and
 * nothing to refuse except an empty line — which is silently dropped, because
 * "you typed nothing" is not news. The refusal branches this function used to
 * carry went with the channels they were apologising for.
 */
function sendChat(text: string): void {
  say(activeChannel(), text, SELF, CHAT_SPEAKER_ID);
  closeChat();
}

/**
 * The id the player speaks under.
 *
 * The player is not an entity in `world` — there is only ever one of them, so
 * they never needed an id. A bubble is addressed BY id though, so they are
 * given a reserved one here rather than a special case in the bubble code.
 * When other players arrive they will be real entities and this constant goes
 * away; until then it is the one seam that has to know the difference.
 */
const CHAT_SPEAKER_ID = -1;

initChatInput({ send: sendChat, cancel: closeChat });
initWakeLock();

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
  onChat: () => { if (chatInput().isOpen()) closeChat(); else openChat(); },
  onChase: () => {
    const on = toggleChase();
    flash(on ? "chase opponent" : "stand while fighting", on ? "#e1483b" : "#5aa1e8");
  },
  onAttackNearest: attackNearest,
  onEscape: () => {
    if (chatInput().isOpen()) { closeChat(); return; }
    /* The menu goes first. It is drawn on top of everything and opened by a
     * gesture, so it is what "the thing in my way" means while it is up. */
    if (ctxMenu) { closeContextMenu(); return; }
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
      /* Right-click opens the MENU — the same one a long press opens on a
       * phone. It used to be a bare "walk here, ignore whatever is standing
       * on the tile", which is a good verb and is now the menu's first entry
       * rather than the whole of the button.
       *
       * That costs a click on a move you used to make in one, and it buys the
       * only place a verb can go once an object has more than one of them:
       * another player is somebody you might look at, trade with or attack,
       * and no gesture picks between those on its own. It is also what Tibia
       * does with the same button. */
      if (P.dead || ui.dragging) return;
      // …except while aiming, where right-click still means "put the cursor
      // away" rather than opening a menu on top of your own fireball.
      if (aimPending) { aimPending = null; flash("cast cancelled", "#8ab6ff"); return; }
      if (ui.placing) return;
      // A second right-click moves the menu rather than stacking one.
      closeContextMenu();
      openContextMenu(sx, sy);
      return;
    }
    handleWorldTap(sx, sy);
  },
});
/**
 * How long the second tap has to arrive.
 *
 * 320ms. Longer and a slow double-use of a potion starts sending it away
 * instead of drinking it; shorter and the gesture stops working for anyone
 * who is not quick with their hands, which on a phone in a fight is most
 * people. The platform double-click default is around 500ms and is tuned for
 * a mouse, where nothing else is competing for the same finger.
 */
const DOUBLE_TAP_MS = 320;

let lastSlotTap: { ref: ContainerRef; index: number; t: number } | null = null;

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
    else if (!moved) {
      /* A second still tap on the SAME slot, soon enough, sends the stack
       * across instead of using it. Same slot rather than same place: the
       * window may have re-laid itself out between the two taps, and a
       * position check would then read as the gesture randomly not working. */
      const now = performance.now();
      const same = lastSlotTap
        && lastSlotTap.index === itemDrag.index
        && sameRef(lastSlotTap.ref, itemDrag.ref ?? { c: "bag" })
        && now - lastSlotTap.t < DOUBLE_TAP_MS;
      if (same) {
        lastSlotTap = null;
        sendStack(itemDrag.ref ?? { c: "bag" }, itemDrag.index);
      } else {
        lastSlotTap = { ref: itemDrag.ref ?? { c: "bag" }, index: itemDrag.index, t: now };
        handleWorldTap(itemDrag.sx, itemDrag.sy); // the plain tap: use / equip
      }
    }
    itemDrag = null;
  },
}, openContextMenu);

// Right-click: suppress the browser's context menu so it never interrupts play.
screen.addEventListener("contextmenu", (e) => e.preventDefault());

// Drag any open panel by grabbing its title bar (works with mouse, pen, touch).
let drag: { win: PanelWindow; gx: number; gy: number; ox: number; oy: number; baseX: number; baseY: number; w: number; h: number; oscroll: number } | null = null;
/**
 * Dragging a container window's FOOT, which changes how many rows it shows.
 *
 * `rowPx` is the height of one row as this window is currently drawn, so the
 * pointer maps onto a row count without the handler needing to know anything
 * about cell sizes, padding or which scale the window was drawn at.
 */
let sizing: { win: PanelWindow; kind: PanelKind; gy: number; rows: number; rowPx: number; total: number } | null = null;
/** Canvas-space coordinates of any pointer-ish event (pointer, mouse, wheel). */
const toScreen = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
  const r = screen.getBoundingClientRect();
  const kx = r.width ? screen.width / r.width : 1;
  const ky = r.height ? screen.height / r.height : 1;
  return { x: (e.clientX - r.left) * kx, y: (e.clientY - r.top) * ky };
};
screen.addEventListener("pointerdown", (e) => {
  const s = toScreen(e);
  /* While the menu is up, nothing behind it may claim the press — not a title
   * bar, not a resize foot, not an item. The press belongs to the menu, which
   * either runs an entry or dismisses itself; `contextMenuTap` decides which,
   * and it is reached through the ordinary click path below. */
  if (ctxMenu) return;
  /* The picker is modal, and while it is up a press inside its list is a
   * SCROLL until it proves otherwise. `moved` decides at pointerup: a press
   * that never travelled is a tap on a row and is handled by the ordinary
   * click path, which is why nothing is chosen here. */
  if (assignSlot !== null) {
    const b = assignBody;
    if (b && s.x >= b.x && s.x < b.x + b.w && s.y >= b.y && s.y < b.y + b.h && b.max > 0) {
      assignDrag = { grabY: s.y, from: assignScroll, moved: false };
      e.preventDefault();
    }
    return;
  }
  // mouse convenience: right-click an action slot to open the rebind picker
  if (e.button === 2) {
    for (const r of actionSlotRects) {
      if (s.x >= r.x && s.x < r.x + r.w && s.y >= r.y && s.y < r.y + r.h) {
        assignSlot = r.i;
        assignScroll = 0;
        e.preventDefault();
        return;
      }
    }
  }
  /* The foot is tested BEFORE the title bar and before item drags: it is a
   * thin strip at the very bottom of a window, and whatever sits under it
   * would otherwise win the press. */
  for (let i = ui.windows.length - 1; i >= 0; i--) {
    const win = ui.windows[i];
    const rb = win.resizeBar;
    if (!rb || !win.rect) continue;
    if (!(s.x >= rb.x && s.x < rb.x + rb.w && s.y >= rb.y && s.y < rb.y + rb.h)) continue;
    const total = rowsInWindow(win);
    if (total <= 1) continue; // a one-row container has nothing to give up
    bringToFront(win.kind);
    sizing = { win, kind: win.kind, gy: s.y, rows: visibleRows(win.kind, total), rowPx: rowPixels(win), total };
    ui.dragging = true;
    try { screen.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
    e.preventDefault();
    return;
  }
  // search top-most first so the visually-front window wins the grab
  for (let i = ui.windows.length - 1; i >= 0; i--) {
    const win = ui.windows[i];
    const tb = win.titleBar;
    const pr = win.rect;
    if (!tb || !pr) continue;
    if (s.x >= tb.x && s.x < tb.x + tb.w && s.y >= tb.y && s.y < tb.y + tb.h) {
      bringToFront(win.kind);
      /* Tear a docked window out of the column.
       *
       * Its floating anchor is the centre of the MAP, which is nowhere near
       * where the window is sitting right now, so the offset is back-computed
       * from its current rect. Without that the window teleports to centre
       * screen the moment the pointer goes down — which reads as a bug even
       * though the drag afterwards works perfectly. */
      /* Tear a container out of the phone's side strip. Same idea as the
       * desktop column below: a window that will not follow the finger reads as
       * broken, so the grab converts it into an ordinary sheet. */
      if (deck.on && STRIP_KINDS.has(win.kind) && !win.stripOut) {
        const st = activeStrip();
        if (st && pr.x >= st.x - 1) {
          win.stripOut = true;
          win.offset.x = 0;
          win.offset.y = 0;
        }
      }
      if (isDocked(win, lastDock)) {
        win.docked = false;
        const fx = (screen.width - lastDock.w - pr.w) / 2;
        const fy = (screen.height - pr.h) / 2;
        win.offset.x = pr.x - fx;
        win.offset.y = pr.y - fy;
      }
      drag = { win, gx: s.x, gy: s.y, ox: win.offset.x, oy: win.offset.y, baseX: pr.x - win.offset.x, baseY: pr.y - win.offset.y, w: pr.w, h: pr.h, oscroll: win.sheetScroll ?? 0 };
      ui.dragging = true;
      try { screen.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
      e.preventDefault();
      return;
    }
  }
  /* The sidebar's scroll track. Checked before the panels below it because it
   * is drawn over them: what you can see, you grab. */
  if (lastDock && lastDock.w > 0 && dockOverflow(lastDock) > 0) {
    for (const hsp of hotspots) {
      if (!hsp.dockTrack) continue;
      if (s.x >= hsp.x && s.x < hsp.x + hsp.w && s.y >= hsp.y && s.y < hsp.y + hsp.h) {
        dockDrag = { grabY: s.y, from: dockScroll() };
        suppressClick = true;
        try { screen.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
        e.preventDefault();
        return;
      }
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
/* The wheel scrolls the container window under the pointer.
 *
 * Topmost first, so the front window wins, and only windows that actually have
 * rows hidden take the event — otherwise the page under the canvas would stop
 * scrolling for no visible reason. */
screen.addEventListener("wheel", (e) => {
  if (assignSlot !== null) {
    // Modal: while the picker is up it takes the wheel, whatever is behind it.
    assignScroll = Math.max(0, assignScroll + (e.deltaY > 0 ? 1 : -1));
    e.preventDefault();
    return;
  }
  const s = toScreen(e);
  for (let i = ui.windows.length - 1; i >= 0; i--) {
    const win = ui.windows[i];
    const r = win.rect;
    if (!r) continue;
    if (!(s.x >= r.x && s.x < r.x + r.w && s.y >= r.y && s.y < r.y + r.h)) continue;
    /* One path for every kind of scrollable window. The panel that drew it
     * recorded how far it can go, so the wheel does not have to know whether
     * it is looking at a container grid or a sixty-line shop list. */
    const max = win.scrollMax ?? 0;
    if (max <= 0) return; // nothing hidden: let the page have the event
    const dir = e.deltaY > 0 ? 1 : -1;
    win.scroll = clamp((win.scroll ?? 0) + dir, 0, max);
    e.preventDefault();
    return;
  }
  /* Nothing under the pointer wanted it, so the COLUMN takes it — but only
   * when the pointer is actually over the column. Scrolling the sidebar from
   * the middle of the map would be a surprise, and the map has its own reason
   * to want the wheel one day. */
  if (lastDock && lastDock.w > 0 && s.x >= lastDock.x && dockOverflow(lastDock) > 0) {
    scrollDock(lastDock, (e.deltaY > 0 ? 1 : -1) * Math.round(40 * scale));
    e.preventDefault();
  }
}, { passive: false });

/** Dragging the sidebar's scroll track. */
let dockDrag: { grabY: number; from: number } | null = null;

screen.addEventListener("pointermove", (e) => {
  if (assignDrag && assignBody) {
    const s = toScreen(e);
    const dy = s.y - assignDrag.grabY;
    /* Content follows the finger: drag UP and the list moves up, which means
     * the offset goes DOWN the list. The row height is the ruler, so a finger
     * travelling one row's worth of pixels moves the list by one row. */
    const rows = -dy / assignBody.rowH;
    const want = clamp(Math.round(assignDrag.from + rows), 0, assignBody.max);
    if (want !== assignScroll) assignScroll = want;
    /* A few pixels of slop before it counts as a drag, so a tap with a shaky
     * thumb still binds the row it landed on. */
    if (Math.abs(dy) > 4 * scale) assignDrag.moved = true;
    e.preventDefault();
    return;
  }
  if (dockDrag && lastDock) {
    const s = toScreen(e);
    /* The thumb travels the band while the content travels the overflow, so
     * a pixel of thumb is worth (overflow / band) pixels of content. Without
     * that ratio a long stack crawls and a short one bolts. */
    const band = Math.max(1, lastDock.stackBottom - lastDock.stackTop);
    const ratio = dockOverflow(lastDock) / band;
    setDockScroll(lastDock, dockDrag.from + (s.y - dockDrag.grabY) * ratio);
    e.preventDefault();
    return;
  }
  if (sizing) {
    const s = toScreen(e);
    /* Rounded, not truncated, so the edge feels stuck to the cursor rather
     * than lagging half a row behind it. */
    const delta = Math.round((s.y - sizing.gy) / sizing.rowPx);
    const want = clamp(sizing.rows + delta, 1, sizing.total);
    /* Dragged all the way open, the preference is cleared rather than pinned
     * at today's row count — so the window keeps following the container if
     * the pack is later swapped for a bigger one. */
    setPanelRows(sizing.kind, want >= sizing.total ? 0 : want);
    e.preventDefault();
    return;
  }
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
  const dy = s.y - drag.gy;
  /* A window taller than its band is already filling it and clipped to it, so
   * there is no "somewhere else" to move it to — dragging it up and down IS
   * scrolling it, and that is what the gesture is wired to. Without this the
   * shop and the paperdoll were the two windows on the phone that ignored being
   * dragged, which is exactly what Radek noticed: some move, some do not. */
  const over = drag.win.sheetOver ?? 0;
  if (deck.on && over > 0) {
    drag.win.sheetScroll = clamp(drag.oscroll - dy, 0, over);
    drag.win.offset.x = drag.ox + (s.x - drag.gx);
    e.preventDefault();
    return;
  }
  let nx = drag.ox + (s.x - drag.gx);
  let ny = drag.oy + dy;
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
const endDrag = (): void => {
  if (sizing) { sizing = null; ui.dragging = false; return; }
  /* Dropped on the column: dock it. Only the title bar's own corner counts,
   * not the pointer — dragging by the right-hand end of a wide bar would
   * otherwise refuse to dock a window that is visibly over the column. */
  if (drag && DOCKABLE_PANELS.includes(drag.win.kind) && lastDock.w > 0) {
    const r = drag.win.rect;
    if (r && overDock(lastDock, r.x + r.w, r.y)) {
      drag.win.docked = true;
      drag.win.offset.x = 0;
      drag.win.offset.y = 0;
    }
  }
  drag = null;
  ui.dragging = false;
};
addEventListener("pointerup", (e) => {
  if (assignDrag) {
    /* Only a real drag suppresses the click. Suppressing every press would
     * make the list unscrollable AND unusable, which is worse than either. */
    if (assignDrag.moved) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
    }
    assignDrag = null;
    return;
  }
  if (dockDrag) { dockDrag = null; ui.dragging = false; }
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
addEventListener("pointercancel", () => { dockDrag = null; hudDrag = null; if (itemDrag && !itemDrag.touch) itemDrag = null; suppressClick = false; endDrag(); });

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
  // A finger is about a centimetre wide and a snake is eighteen pixels; the
  // exact hitboxes below are what a mouse deserves and what a thumb cannot
  // hit. See `forgivingTap`.
  if (touchUI && forgivingTap(world, w)) return;
  // monsters
  for (const m of world.monsters) {
    if (Math.abs(w.x - m.x) < m.spr.width / 2 && w.y > m.y - m.spr.height && w.y < m.y + 10) {
      // clicking the monster you're already attacking STOPS the attack (Tibia-style toggle)
      if (P.target?.kind === "mob" && P.target.id === m.id) {
        P.target = null;
        flash("attack stopped", "#8ab6ff");
        return;
      }
      P.target = { kind: "mob", id: m.id };
      P.dest = null; P.gather = null; moveMarker = null;
      return;
    }
  }
  // dropped ground items — walk over and pick up (Tibia-style, no telekinesis)
  for (const gi of world.ground) {
    if (Math.abs(w.x - gi.x) < 18 && w.y > gi.y - 28 && w.y < gi.y + 8) {
      P.target = { kind: "ground", id: gi.id };
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
        if (withinReach(c.x, c.y)) {
          ui.loot = c; openWindow("loot");
        } else {
          pendingLoot = c;
          P.dest = { x: c.x, y: c.y };
        }
        moveMarker = null;
        return;
      }
      P.target = { kind: "corpse", id: c.id };
      P.dest = null; P.gather = null; moveMarker = null;
      return;
    }
  }
  // NPCs
  for (const n of world.npcs) {
    const spr = npcSpr(n);
    if (Math.abs(w.x - n.x) < spr.width / 2 && w.y > n.y - spr.height && w.y < n.y + 10) {
      P.target = { kind: "npc", id: n.id };
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
        if (P.target?.kind === "dummy" && P.target.id === s.id) {
          P.target = null;
          flash("attack stopped", "#8ab6ff");
          return;
        }
        P.target = { kind: "dummy", id: s.id };
      }
      else P.target = { kind: "structure", id: s.id };
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

/* ---------------- resolving the target ----------------
 *
 * The five helpers below turn the held id back into the thing itself, in the
 * CURRENT world, or null when it is gone. Null is the useful half: a monster
 * that died, a corpse that decayed, a stack somebody else picked up — all of
 * them stop resolving on their own, so the "is this still real?" question
 * that used to be scattered through the update loop as `includes()` calls is
 * answered by the same call that fetches the thing.
 *
 * Each one refuses a target of the wrong kind, so a call site cannot resolve
 * a corpse id against the monster list and get a coincidental hit. */

function targetMob(t: Target | null = P.target): Monster | null {
  return t?.kind === "mob" ? monsterById(cw(), t.id) ?? null : null;
}
function targetCorpse(t: Target | null = P.target): Corpse | null {
  return t?.kind === "corpse" ? corpseById(cw(), t.id) ?? null : null;
}
function targetGround(t: Target | null = P.target): GroundItem | null {
  return t?.kind === "ground" ? groundById(cw(), t.id) ?? null : null;
}
function targetNpc(t: Target | null = P.target): Npc | null {
  return t?.kind === "npc" ? npcById(cw(), t.id) ?? null : null;
}
/** Dummies and plain structures share a list, so they share a resolver. */
function targetStruct(t: Target | null = P.target): Structure | null {
  return t?.kind === "dummy" || t?.kind === "structure"
    ? structureById(cw(), t.id, game.worlds.home) ?? null : null;
}

/**
 * Tap tolerance: on TOUCH, a tap that lands near something counts as a tap on it.
 *
 * The exact hitboxes in `worldClick` are sprite-shaped, which is correct for a
 * cursor and hopeless for a thumb — a snake is eighteen pixels wide and a
 * fingertip covers about forty. The fix is Tibia's: widen the question from
 * "what is under this pixel" to "what is on this tile or the eight around it",
 * and let creatures win ties.
 *
 * MOUSE IS DELIBERATELY EXCLUDED. Widening a click means a click on the empty
 * tile beside a skeleton starts a fight instead of taking a step, and with a
 * cursor that is not forgiveness, it is theft — the player aimed at the gap
 * and hit the gap. A finger never had that precision to begin with.
 *
 * Runs only AFTER the exact pass has missed, so it can never override a
 * deliberate hit, and it is ordered: creatures, then loot, then bodies, then
 * people, then buildings. That order is the order of urgency in a fight, and
 * a fight is the only time the extra reach matters.
 */
function forgivingTap(world: World, w: Vec): boolean {
  const tx = toTile(w.x);
  const ty = toTile(w.y);
  /** Within one tile of the tap, in tile space. */
  const near = (ex: number, ey: number): boolean =>
    Math.abs(toTile(ex) - tx) <= 1 && Math.abs(toTile(ey) - ty) <= 1;
  /** Of the candidates that qualify, the one nearest the finger. */
  const pick = <T extends { x: number; y: number }>(list: readonly T[]): T | null => {
    let best: T | null = null;
    let bestD = Infinity;
    for (const e of list) {
      if (!near(e.x, e.y)) continue;
      const d = dist(w.x, w.y, e.x, e.y);
      if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  };

  const m = pick(world.monsters.filter((x) => x.hp > 0));
  if (m) {
    if (P.target?.kind === "mob" && P.target.id === m.id) {
      P.target = null;
      flash("attack stopped", "#8ab6ff");
      return true;
    }
    P.target = { kind: "mob", id: m.id };
    P.dest = null; P.gather = null; moveMarker = null;
    return true;
  }
  const gi = pick(world.ground);
  if (gi) {
    P.target = { kind: "ground", id: gi.id };
    P.dest = null; P.gather = null; moveMarker = null;
    return true;
  }
  const c = pick(world.corpses);
  if (c) {
    // deliberately does NOT reproduce the loot-while-attacking dance from the
    // exact pass: that path needs a marked monster, and if there were one
    // nearby the creature branch above would already have taken this tap
    P.target = { kind: "corpse", id: c.id };
    P.dest = null; P.gather = null; moveMarker = null;
    return true;
  }
  const n = pick(world.npcs);
  if (n) {
    P.target = { kind: "npc", id: n.id };
    n.talk = NPC_TALK_HOLD_S;
    faceToward(n, P.x, P.y);
    P.dest = null; P.gather = null; moveMarker = null;
    return true;
  }
  return false;
}

function targetPoint(): Vec | null {
  const t = P.target;
  if (!t) return null;
  if (t.kind === "mob") { const m = targetMob(t); return m ? { x: m.x, y: m.y } : null; }
  if (t.kind === "corpse") { const c = targetCorpse(t); return c ? { x: c.x, y: c.y } : null; }
  if (t.kind === "ground") { const g = targetGround(t); return g ? { x: g.x, y: g.y } : null; }
  if (t.kind === "npc") { const n = targetNpc(t); return n ? { x: n.x, y: n.y } : null; }
  // structure: stand just below the sprite base (footprint-aware anchor)
  const st = targetStruct(t);
  if (!st) return null;
  const c = structCenter(st);
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
    const arrow = t?.kind === "dummy" && targetStruct(t)?.key === "range"
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
    // A target that died, decayed or was left on another island simply stops
    // resolving — no separate liveness check needed any more.
    const m = targetMob(t);
    if (!m || m.hp <= 0) { P.target = null; return; }
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
    const st = targetStruct(t);
    if (st && dist(P.x, P.y, tp.x, tp.y) <= mode.reach && P.atkCd <= 0) {
      P.atkCd = P.atkRate;
      shootDummy(cw(), P, st, mode.arrow);
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
  const m = targetMob(t);
  if (!m || m.hp <= 0) { P.target = null; return; }
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

/**
 * Within arm's reach of a loose thing in the world — a corpse, a container on
 * the floor. One square, counted on the grid, so a diagonal neighbour counts
 * and a tile two along never does.
 */
function withinReach(x: number, y: number): boolean {
  return chebToPoint(P.tx, P.ty, x, y) <= PANEL_REACH_TILES;
}

/** The same reach, against a placed structure's footprint. */
function structInReach(s: Structure): boolean {
  return structGap(s, P.tx, P.ty) <= PANEL_REACH_TILES;
}

/** Is the player near any owned Home-Isle structure of the given kinds? */
function nearStructure(...keys: string[]): boolean {
  if (cw() !== game.worlds.home) return false;
  for (const s of game.worlds.home.structures) {
    if (!keys.includes(s.key)) continue;
    if (structInReach(s)) return true;
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
  if (P.target?.kind === "npc") { const n = targetNpc(); if (n) hold(n); }
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
      return structInReach(st);
    }],
    ["shop", () => !!ui.npc && cw().npcs.includes(ui.npc) && nearNpc((n) => n === ui.npc)],
    ["tasks", () => nearNpc((n) => n.key === "taskmaster")],
    ["wardrobe", () => nearNpc((n) => n.key === "tailor")],
    ["loot", () => !!ui.loot && cw().corpses.includes(ui.loot)
      && withinReach(ui.loot.x, ui.loot.y)],
    ["floor", () => !!ui.floor && cw().ground.includes(ui.floor)
      && withinReach(ui.floor.x, ui.floor.y)],
  ];
  for (const [kind, inRange] of checks) {
    if (hasWindow(kind) && !inRange()) {
      closeWindow(kind);
      flash("too far away", "#e0a06a");
    }
  }
  sweepContainerWindows();
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

function update(dt: number): void {
  const world = cw();
  // level gates: seal/open against the current level (also right after level-ups)
  applyGates(world, P.level);
  waveT += dt;
  P.tpCd = Math.max(0, P.tpCd - dt);
  P.atkCd = Math.max(0, P.atkCd - dt);
  tickCrystalCooldown(dt);
  /* The clocks that must run WHATEVER the player is doing, ticked here at the
   * top where nothing can return past them.
   *
   * `tickChat` was called only inside the death branch below — twice, from a
   * bad merge — so on the living path speech never aged: a bubble Radek put
   * over his own head was still there a minute later, and the log on the world
   * never faded either, which is the same bug wearing a different hat. A clock
   * that only runs while you are dead is not a clock.
   *
   * The skull's timer goes with it and for the same reason: dying does not
   * launder a frag, and neither does standing still. */
  tickChat(dt);
  tickSkull(dt);
  // mid-fight loot walk: the corpse clicked during combat pops open the
  // moment we're in range (or is forgotten if it despawned / got looted away)
  if (pendingLoot) {
    if (!world.corpses.includes(pendingLoot)) pendingLoot = null;
    else if (withinReach(pendingLoot.x, pendingLoot.y)) {
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
    // melee / walk-up targets: approach along the grid, then act.
    //
    // STAND WHILE FIGHTING (chase off) applies to CREATURES only. Walking up
    // to a chest, a corpse or an NPC is not a chase — it is the only way to
    // reach them, and a player who turned off pursuit did not mean "never
    // walk to a body again". Tibia draws the line in the same place: the
    // toggle is labelled for opponents.
    const chaseBlocked = !chasing()
      && (P.target.kind === "mob" || P.target.kind === "dummy");
    const tp = targetPoint();
    if (tp) {
      // Anything that OPENS A PANEL is measured with the very rule the panel
      // closes on. Mixing the two — walk up to 48 px, then judge the open
      // window by squares — is how you get a chest that pops and shuts in the
      // same breath, because 48 px reaches a tile the square rule calls two
      // away. Fighting keeps its pixel reach: a blade is not a window.
      const t = P.target;
      const inReach = t.kind === "corpse" || t.kind === "ground" ? withinReach(tp.x, tp.y)
        : t.kind === "structure" ? (() => { const st = targetStruct(t); return !!st && structInReach(st); })()
        : dist(P.x, P.y, tp.x, tp.y) <= (t.kind === "dummy" || t.kind === "mob" ? mode.reach : MELEE_REACH_PX);
      if (inReach) resolveTarget();
      else if (chaseBlocked) {
        // standing our ground: keep the mark, take no step. tickMeleeFire
        // below still swings the moment the creature walks into reach.
      } else {
        const moved = walkGrid(world, toTile(tp.x), toTile(tp.y), budget);
        // the route ran out without arriving (walled-in chest, corpse across
        // water): let go rather than shuffle against the obstacle forever
        if (!moved && atCenter(P) && (t.kind === "corpse" || t.kind === "structure" || t.kind === "ground")) {
          P.target = null;
          flash("too far away", "#e0a06a");
        }
      }
    }
  } else if (kiting) {
    // idle bowman: close the gap when the target drifted out of range OR a
    // wall blocks the shot (walk around the corner instead of standing dumb)
    const tp = targetPoint();
    if (tp) {
      const d = dist(P.x, P.y, tp.x, tp.y);
      const blocked = P.target?.kind === "mob" && !lineOfSight(world, P.x, P.y, tp.x, tp.y);
      // Standing archer: hold the spot and let the shot lapse rather than
      // walking into the pack. This is the case the switch was asked for.
      if (chasing() && (d > mode.reach || blocked)) walkGrid(world, toTile(tp.x), toTile(tp.y), budget);
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

  /* Dropped items fade from the ground after their lifetime (1h) — except
   * CONTAINERS, which never do.
   *
   * A loot bag is a place you deliberately leave things. If it rotted on the
   * same hour timer as a stray log, the feature would be a trap: you set your
   * bag down by the corpses, clear a floor, come back and both the bag and
   * everything in it are gone. Tibia's ground never eats a backpack either.
   * The bag persists; the wood you dropped by accident still tidies itself. */
  for (let i = world.ground.length - 1; i >= 0; i--) {
    if (!groundDecays(world.ground[i])) continue;
    world.ground[i].t -= dt;
    if (world.ground[i].t > 0) continue;
    // a loot bag rotting out from under an open window has to take the window
    // with it, or the player is left dragging things into nowhere
    if (ui.floor === world.ground[i]) { ui.floor = null; closeWindow("floor"); }
    world.ground.splice(i, 1);
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

/**
 * Mark the nearest creature — or let the current mark go.
 *
 * Chase is half a feature without something to chase. Until now the only way
 * to pick a fight was to tap the creature itself, which is fine alone on a
 * beach and hopeless in a corridor with four skeletons and (soon) three other
 * players standing on each other. This is Tibia's crossed-swords button.
 *
 * Nearest by WALKING distance would be the honest measure, but a BFS per
 * keypress across a 105x100 floor to answer "which one is closest" is a lot
 * of work for a question the player is asking about what they can see. Line
 * of sight plus straight-line distance gets the same answer everywhere it
 * matters and cannot pick something through a wall.
 */
function attackNearest(): void {
  // pressing it again with a mark in hand releases it — one key, both ways
  if (P.target?.kind === "mob") {
    P.target = null;
    flash("target released", "#8ab6ff");
    return;
  }
  const world = cw();
  let best: Monster | null = null;
  let bestD = Infinity;
  for (const m of world.monsters) {
    if (m.hp <= 0) continue;
    const d = dist(P.x, P.y, m.x, m.y);
    if (d >= bestD || d > TARGET_SEEK_PX) continue;
    if (!lineOfSight(world, P.x, P.y, m.x, m.y)) continue;
    best = m;
    bestD = d;
  }
  if (!best) { flash("nothing in sight", "#e0a06a"); return; }
  P.target = { kind: "mob", id: best.id };
  P.dest = null;
  P.gather = null;
  pendingLoot = null;
}

function resolveTarget(): void {
  const t = P.target;
  if (!t) return;
  /* Every branch resolves its id first and lets go of a target that no longer
   * exists. That "if it is gone, drop it" line used to be three different
   * checks in three different shapes — `includes()`, `hp <= 0`, and nothing at
   * all for structures — and now it is one, because a stale id cannot resolve. */
  if (t.kind === "mob") {
    const m = targetMob(t);
    if (!m) { P.target = null; return; }
    if (P.atkCd <= 0) {
      P.atkCd = P.atkRate;
      const mode = attackMode();
      if (mode.ranged && mode.arrow) {
        if (playerShoot(cw(), P, m, mode.arrow)) P.target = null;
      } else {
        if (equippedBow(P.eq)) warnNoArrows();
        if (playerAttack(cw(), P, m)) P.target = null;
      }
    }
  } else if (t.kind === "dummy") {
    const st = targetStruct(t);
    if (!st) { P.target = null; return; }
    if (P.atkCd <= 0) {
      P.atkCd = P.atkRate;
      const mode = attackMode();
      if (mode.ranged && mode.arrow) shootDummy(cw(), P, st, mode.arrow);
      else if (st.key === "range") {
        // the straw butt only takes arrows — no bow (or an empty quiver)
        // means nothing to train with, so let go instead of punching it
        flash("you need a bow and arrows", "#e0a06a");
        P.target = null;
      }
      else { if (equippedBow(P.eq)) warnNoArrows(); hitDummy(cw(), P, st); }
    }
  } else if (t.kind === "corpse") {
    const c = targetCorpse(t);
    if (c) { ui.loot = c; openWindow("loot"); }
    P.target = null;
  } else if (t.kind === "ground") {
    /* A CONTAINER on the floor opens; anything else is picked up.
     *
     * Tibia's split, and the one Radek asked for: "use" on a backpack can only
     * sensibly mean "look inside", and a bag you cannot open is a bag you can
     * only ever swallow whole. Ordinary loot keeps the walk-over-and-take
     * behaviour, which is a kindness Tibia never offered and worth keeping.
     * To pick a container UP you drag it — into your bag, or onto the Bag
     * slot to wear it.
     *
     * The `includes()` guard this branch used to open with is gone: somebody
     * else having taken the stack in the meantime is now the same thing as the
     * id failing to resolve. */
    const gi = targetGround(t);
    if (gi) {
      if (isContainer(gi.kind)) { ui.floor = gi; openWindow("floor"); }
      else pickupGround(gi);
    }
    P.target = null;
  } else if (t.kind === "npc") {
    const n = targetNpc(t);
    if (!n) { P.target = null; return; }
    if (n.key === "taskmaster") { openWindow("tasks"); }
    else if (n.key === "tailor") { openWindow("wardrobe"); }
    // Someone with neither a shop nor a panel of their own has nothing to open
    // yet — say so rather than putting an empty window on screen.
    else if (!SHOPS[n.key]) { flash(`${n.name} has nothing to say… yet`, "#b9a6d8"); }
    else { ui.npc = n; ui.shopTab = "buy"; openWindow("shop"); }
    P.target = null;
  } else if (t.kind === "structure") {
    const st = targetStruct(t);
    if (!st) { P.target = null; return; }
    if (st.key === "forge") openWindow("forge");
    else if (st.key === "tower") openWindow("tower");
    else if (st.key === "chest") { ui.stash = st; openWindow("stash"); }
    else if (st.key === "treasure") openTreasure(st);
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

/**
 * The attack mark: four corner brackets around the creature's TILE.
 *
 * Tibia's own answer, and it is the right one for a touch screen. A full
 * outline reads as a selection box and hides the sprite's silhouette; corners
 * leave the body clear while still being unmistakable in a pack. Drawn on the
 * tile rather than the sprite so a dragon and a beggar are marked identically
 * — with a crowd of players on one screen, "which one am I hitting" has to be
 * answerable at a glance and at any body size.
 *
 * Two passes, black under red, so the mark survives on light sand and in a
 * dark cavern without a drop shadow.
 */
/**
 * A line of speech over someone's head.
 *
 * No frame and no background plate. Tibia draws speech as bare text and it is
 * the right call twice over: a plate the width of a sentence covers the tiles
 * either side of the speaker, and in a crowd four plates cover the fight. Two
 * passes of text, black under colour, reads on sand and in a cavern alike and
 * costs nothing but the letters themselves.
 */
function sayBubble(entity: number, x: number, y: number): void {
  const b = bubbleFor(entity);
  if (!b) return;
  // the last half-second fades, so speech leaves rather than vanishing
  vctx.globalAlpha = Math.min(1, b.t / 0.5);
  vctx.font = "bold 12px 'Courier New',monospace";
  vctx.textAlign = "center";
  const sx = Math.round(x - cam.x);
  const sy = Math.round(y - cam.y);
  vctx.fillStyle = "#000";
  vctx.fillText(b.text, sx + 1, sy + 1);
  vctx.fillStyle = b.color;
  vctx.fillText(b.text, sx, sy);
  vctx.globalAlpha = 1;
}

/**
 * A skull beside somebody's head — Tibia's PvP mark, in Tibia's place.
 *
 * BESIDE, not above. Above the head is where speech goes, and a bubble that
 * covers the one thing telling you this person kills people is a bubble that
 * gets somebody killed. Tibia puts it on the right of the name for the same
 * reason and it has never moved in twenty years.
 *
 * `x, y` is the head's top-right corner in WORLD coordinates, computed by the
 * caller the way `sayBubble` takes its anchor — a rat, a knight and a dragon
 * all have their head in a different place and the drawing code has no
 * business guessing which it is looking at.
 *
 * Drawn at 1x with nothing behind it. A dark plate went under it first and
 * came out looking like a sticker pinned to the shoulder — and it was never
 * needed: both skulls are drawn with a full black outline of their own, which
 * is the same job done by the art instead of by the renderer.
 */
function skullMark(kind: Skull, x: number, y: number): void {
  const icon = skullIcon(kind);
  if (!icon) return;
  drawControlIcon(vctx, icon, Math.round(x - cam.x), Math.round(y - cam.y), ICON_SRC, false);
}

function targetBox(x: number, y: number): void {
  const left = Math.round(x - cam.x - TILE / 2);
  const top = Math.round(y - cam.y - TILE / 2);
  const arm = Math.round(TILE * 0.3); // how far each bracket runs along the edge

  /** Eight rectangles: a horizontal and a vertical stub at each corner. */
  const brackets = (pad: number, t: number, color: string): void => {
    vctx.fillStyle = color;
    const l = left - pad;
    const tp = top - pad;
    const r = left + TILE + pad - t;
    const b = top + TILE + pad - t;
    const len = arm + pad;
    vctx.fillRect(l, tp, len, t); vctx.fillRect(l, tp, t, len); // top-left
    vctx.fillRect(r - len + t, tp, len, t); vctx.fillRect(r, tp, t, len); // top-right
    vctx.fillRect(l, b, len, t); vctx.fillRect(l, b - len + t, t, len); // bottom-left
    vctx.fillRect(r - len + t, b, len, t); vctx.fillRect(r, b - len + t, t, len); // bottom-right
  };

  brackets(1, 4, "#000");       // outline, so the mark reads on sand and in the dark
  brackets(0, 2, "#e1483b");    // the mark itself
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
  /* The strip covers the right edge, so the middle of what you can SEE is left
   * of the middle of the glass. Without this the character stands two tiles off
   * centre and anything walking in from the right is on him before it appears. */
  cam.x = clamp(P.x - VW * mapFocusFracX(deck, screen.width, stripWidth()), 0, Math.max(0, world.w * TILE - VW));
  /* The world is still rendered across the whole canvas and the two plates are
   * drawn over its ends, so every screen->world conversion in this file keeps
   * working untouched. What DOES change is where the player is parked: the
   * middle of the visible BAND, not the middle of the canvas. The strip and the
   * deck are not the same height, so centring on the canvas would leave the
   * character sitting low, half-buried behind the hotbar. */
  cam.y = clamp(P.y - VH * mapFocusFrac(deck, screen.height), 0, Math.max(0, world.h * TILE - VH));

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
      if (P.target?.kind === "mob" && P.target.id === m.id) targetBox(m.x, m.y);
      sayBubble(m.id, m.x, m.y - spr.height - 20);
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
    /* Measured off the sheet rather than guessed: an LPC cell is 64 tall and
     * drawn feet-down, and the first row with anything in it is row 15 — so
     * the head starts at y-49 and its right edge sits about ten pixels out
     * from centre. A skull hung off the cell's own corner would float a
     * tile and a half above an empty shoulder. */
    if (!P.dead) skullMark(skull(), P.x + 10, P.y - 49);
    sayBubble(CHAT_SPEAKER_ID, P.x, P.y - 46);
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
  sctx.drawImage(view, 0, 0, VW, VH, 0, 0, screen.width - sidebarW, screen.height);

  // HUD + panels (screen space). One UI everywhere (Etap 13): desktop uses the
  // same customizable HUD and panel sizing as mobile; each panel still
  // auto-shrinks per window if it would spill off-screen.
  const hud: HudCtx = {
    ctx: sctx, scale,
    screenW: screen.width, screenH: screen.height, touch: touchUI,
    touchInput: isTouchDevice(),
    sidebarW,
    // the phone's top strip draws vitals, purse, location and minimap itself
    fixedChrome: deck.on,
    contentTop: deck.mapTop,
  };
  const dock = dockLayout(screen.width, screen.height, dockUnit, sidebarW > 0);
  lastDock = dock;
  drawHud(hud, game, P);
  hotspots = [];
  itemSlots = [];
  drawChatLog();
  if (dock.w > 0) drawSidebar(hud, dock);
  for (const win of ui.windows) { win.rect = null; win.titleBar = null; win.resizeBar = null; }
  const sideStrip = activeStrip();
  const sheeted = ui.windows.length - (sideStrip ? 1 : 0);
  drawPanels({
    hud, ui, game, player: P, mouse, act, hotspots, itemSlots, dock, strip: sideStrip,
    sheets: deck.on ? sheetSlots(deck, sheeted, stripWidth()) : null,
    sheetBand: deck.on ? sheetBand(deck) : null,
  });
  drawContextMenu();
  updateCursor();
  // ghost of the item being dragged, following the cursor
  if (itemDrag && itemDrag.active) {
    const spr = itemSprite(itemDrag.kind);
    const gw = iconW(spr, 2 * scale);
    const gh = iconH(spr, 2 * scale);
    sctx.imageSmoothingEnabled = false;
    sctx.globalAlpha = 0.85;
    sctx.drawImage(spr, Math.round(mouse.sx - gw / 2), Math.round(mouse.sy - gh / 2), gw, gh);
    sctx.globalAlpha = 1;
    if (itemDrag.n > 1 && itemDrag.ref) {
      const dn = currentN(itemDrag.ref, itemDrag.index);
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
  buttonBox(ctx, x, y, s, s, scale, {
    on,
    face: on ? "rgba(202,162,58,.92)" : "rgba(16,26,24,.82)",
    accent: on ? CHROME.goldText : undefined,
  });
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
  if (hudEditing()) { assignSlot = i; assignScroll = 0; beep(360, 0.05, "sine", 0.04); }
  else useAction(i);
}

/** A flat rectangular HUD button with a single label. Registers a hotspot. */
function hudBtn(
  x: number, y: number, w: number, h: number, label: string, on: boolean, fn: () => void,
  /**
   * Drawn dim, still pressable, and its handler is expected to say WHY.
   *
   * A ± at its limit is not removed, because a button that vanishes at the
   * end of its range takes the range with it: the player cannot see that
   * twenty-four was the ceiling, only that the plus is gone and something is
   * broken. Dim says "this is as far as it goes", and pressing it says so out
   * loud.
   */
  dim = false,
): void {
  const ctx = sctx;
  buttonBox(ctx, x, y, w, h, scale, {
    on,
    face: on ? "rgba(202,162,58,.92)" : "rgba(16,26,24,.85)",
    accent: on ? CHROME.goldText : undefined,
  });
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = on ? "#201a10" : dim ? "rgba(233,226,200,.3)" : "#e9e2c8";
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
  /* An UNBOUND slot is drawn down to a shadow, not merely darker.
   *
   * Six equally solid cells along the bottom edge read as six things you own,
   * and four of them do nothing. The position has to stay — that is the whole
   * value of a fixed bar, that slot four is always slot four — but the weight
   * does not. So an empty slot keeps its outline and loses almost everything
   * else: the position survives, the clutter goes. Editing is the exception,
   * where empty slots are precisely what you are looking for and get lit up
   * instead. */
  const empty = !slot;
  const was = ctx.globalAlpha;
  if (empty && !hudEditing()) ctx.globalAlpha = was * 0.42;
  slotCell(ctx, x, y, w, h, scale, {
    face: usable ? "rgba(46,58,54,.92)" : empty ? "rgba(18,20,24,.55)" : "rgba(24,26,30,.8)",
    accent: hudEditing() ? "#8ab6ff" : usable ? "#caa15a" : undefined,
  });
  ctx.globalAlpha = was;
  /* The bound rune's own picture, above its name.
   *
   * A name plus a number tells you what a slot holds only if you stop and read
   * it. In a fight you glance. The icon is the thing you actually recognise,
   * and the crystals all share a name shape ("Frost Shard", "Frost Nova") that
   * makes reading them slower still — so the picture goes on top and the words
   * stay underneath for when there is time. */
  if (slot?.type === "crystal") {
    const spr = itemSprite(slot.item);
    if (spr) {
      const box = h * 0.40;
      const sc = Math.min(box / spr.width, box / spr.height);
      const iw = Math.round(spr.width * sc);
      const ih = Math.round(spr.height * sc);
      const was = ctx.globalAlpha;
      if (!usable) ctx.globalAlpha = 0.35; // out of charges: dimmed, not hidden
      ctx.drawImage(spr, Math.round(x + (w - iw) / 2), Math.round(y + h * 0.07), iw, ih);
      ctx.globalAlpha = was;
    }
  }
  const iconY = slot?.type === "crystal" ? h * 0.63 : h * 0.38;
  const subY = slot?.type === "crystal" ? h * 0.86 : h * 0.74;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (empty && !hudEditing()) ctx.globalAlpha = was * 0.42;
  ctx.fillStyle = usable ? "#e9e2c8" : hudEditing() ? "#8ab6ff" : "#7a808a";
  ctx.font = `bold ${Math.round(h * (slot?.type === "crystal" ? 0.2 : 0.26))}px 'Courier New',monospace`;
  ctx.fillText(label, x + w / 2, y + iconY);
  ctx.font = `${Math.round(h * 0.17)}px 'Courier New',monospace`;
  ctx.fillStyle = usable ? "#ffe9a8" : "#7a808a";
  ctx.fillText(sub, x + w / 2, y + subY);
  ctx.globalAlpha = was; // …but the HOTSPOT is full strength: an empty slot is
  const idx = i;         // still bindable, it just does not shout about it
  hotspots.push({ x, y, w, h, fn: () => slotTap(idx) });
  touchButtons.push({ x, y, w, h });
  actionSlotRects.push({ i: idx, x, y, w, h });
}

/**
 * The docked column.
 *
 * Tibia's fixed order, top to bottom: minimap, status bar, controls — then
 * open containers stack below, drawn by drawPanels off the same DockLayout.
 * Each fixed block has a header bar that collapses it, which is how room is
 * made for another container; that is Tibia's answer too (its inventory
 * minimises) and it beats shrinking everything permanently.
 */
function drawSidebar(h: HudCtx, d: DockLayout): void {
  const ctx = sctx;
  const S = d.s;
  const bar = Math.round(BLOCK_BAR * S);

  // The column's own back plate, so windows in it sit ON something.
  ctx.fillStyle = "rgba(10,8,5,.94)";
  ctx.fillRect(d.x, 0, d.w, h.screenH);
  ctx.fillStyle = CHROME.panelEdge;
  ctx.fillRect(d.x, 0, Math.max(1, Math.round(S)), h.screenH);

  const header = (b: DockBlock, label: string): void => {
    const r = d.blocks[b];
    raisedBox(ctx, d.innerX, r.y, d.innerW, bar,
      CHROME.barFace, CHROME.barLight, CHROME.barDark, S);
    hudText(h, label, d.innerX + 5 * S, r.y + bar / 2, 7 * S, CHROME.goldText, "left", true);
    hudText(h, r.collapsed ? "\u25B8" : "\u25BE", d.innerX + d.innerW - 5 * S, r.y + bar / 2,
      7 * S, CHROME.gold, "right", true);
    hotspots.push({ x: d.innerX, y: r.y, w: d.innerW, h: bar, fn: () => toggleBlock(b) });
    touchButtons.push({ x: d.innerX, y: r.y, w: d.innerW, h: bar });
  };

  header("minimap", "MAP");
  {
    const r = d.blocks.minimap;
    if (!r.collapsed) drawMinimapAt(h, game, P, d.innerX, r.bodyY, d.innerW, r.bodyH);
  }

  header("status", "STATUS");
  {
    const r = d.blocks.status;
    if (!r.collapsed) {
      const goldH = Math.round(GOLD_ROW_H * S);
      drawGoldTP(h, P, d.innerX, r.bodyY, d.innerW, goldH, totalGold(game, P));
      drawVitals(h, P, d.innerX, r.bodyY + goldH + Math.round(4 * S), S * VITALS_FIT);
    }
  }

  header("controls", "CONTROLS");
  // The block's CONTENTS are drawn later, from drawTouchControls: the action
  // slots register into lists that it clears, so drawing them here would have
  // them wiped in the same frame.
}

/**
 * The panel buttons, action slots and weapon swap, living in the column.
 *
 * These used to float over the map on the customisable HUD, which is why they
 * ended up sitting on top of the minimap the moment the map got narrower. In
 * Tibia their equivalents are sidebar widgets, so here they are too — and
 * being fixed, they carry no drag grip and are skipped by the HUD editor.
 */
function drawDockControls(d: DockLayout, top: number): void {
  const S = d.s;
  const gap = Math.round(4 * S);

  /* Row 1: the five panel buttons, as PICTURES.
   *
   * They carried their keyboard letter, which reads fine for B and Q and not
   * at all for K — and S, the letter Skills wants, is taken by walking. Tibia
   * uses pictures here for exactly that reason: a picture owes nothing to the
   * keybind. The letter stays on the key; the button shows what it opens. */
  const pbtns: [ControlIcon, PanelKind][] = [
    ["build", "build"], ["skills", "skills"], ["equip", "equip"], ["bag", "bag"], ["quest", "quest"],
  ];
  const bw = (d.innerW - gap * (pbtns.length - 1)) / pbtns.length;
  const bh = Math.round(BTN_ROW_H * S);
  pbtns.forEach(([glyph, panel], i) => {
    const bx = d.innerX + i * (bw + gap);
    const on = hasWindow(panel);
    buttonBox(sctx, bx, top, bw, bh, S, {
      on, face: on ? "rgba(202,162,58,.92)" : undefined, accent: on ? CHROME.goldText : undefined,
    });
    /* Snapped to a whole multiple of the 16px source grid — see
     * `drawSquareIcon`. Hand-drawn pixel art scaled by 1.37x is mush; at
     * exactly 1x, 2x or 3x it is crisp, and these glyphs are authored on the
     * same grid so they match. */
    drawSquareIcon(sctx, glyph, bx, top, bw, bh, on, undefined, 0.86);
    hotspots.push({ x: bx, y: top, w: bw, h: bh, fn: () => togglePanel(panel) });
    touchButtons.push({ x: bx, y: top, w: bw, h: bh });
  });

  /* The action slots used to be row 2 here and were unreadably small: six of
   * them across a 100-unit column is sixteen units each, and "Recall 3·12" does
   * not fit in sixteen units at any font. They live on a bar across the foot of
   * the map now, where there is room for them to be the size of an item. */

  /* Row 2: the three combat controls, side by side — quick weapon swap,
   * chase/stand, and whether other PLAYERS are fair game. Tibia keeps its
   * fight toggles together in the console for the same reason: they are
   * pressed mid-fight, so the hand should find them as one place rather than
   * hunt three.
   *
   * They SHARE a row rather than each taking one. Another full-width bar
   * would push the containers below it down by another 22 units, and the
   * column's whole argument is that it leaves the map alone. There is room
   * for the third only because chase stopped being a WORD: CHASE and STAND
   * needed half the row between them, and two square glyphs need a quarter. */
  const wy = top + bh + gap;
  const wh = Math.round(SWAP_H * S);
  /* Square, and sized off the row's own height so the pair cannot drift out
   * of proportion if SWAP_H ever moves. */
  const sq = wh;
  const swapW = Math.max(1, d.innerW - 2 * (sq + gap));
  const bowOn = P.eq.weapon ? !!ITEMS[P.eq.weapon].bow : false;
  sctx.textAlign = "center";
  sctx.textBaseline = "middle";
  sctx.font = `bold ${Math.round(wh * 0.42)}px 'Courier New',monospace`;

  buttonBox(sctx, d.innerX, wy, swapW, wh, S, {});
  sctx.fillStyle = "#e9e2c8";
  sctx.fillText(bowOn ? "\u2192MELEE" : "\u2192BOW", d.innerX + swapW / 2, wy + wh / 2);
  hotspots.push({ x: d.innerX, y: wy, w: swapW, h: wh, fn: () => swapWeapon() });
  touchButtons.push({ x: d.innerX, y: wy, w: swapW, h: wh });

  /* Chase is a STATE, not an action, so unlike the swap it stays lit while
   * on — the player has to be able to answer "am I following?" without
   * pressing anything. Red for chase, blue for stand, matching the stance
   * chip's language where red is committed and blue is careful; the glyph
   * takes the colour the word had, so nothing about the reading changed. */
  const cx = d.innerX + swapW + gap;
  const chase = chasing();
  buttonBox(sctx, cx, wy, sq, wh, S, {
    on: chase, face: chase ? "rgba(150,58,48,.92)" : undefined,
  });
  drawSquareIcon(sctx, chase ? "chase" : "stand", cx, wy, sq, wh, chase, chaseTint(chase));
  hotspots.push({ x: cx, y: wy, w: sq, h: wh, fn: () => toggleChase() });
  touchButtons.push({ x: cx, y: wy, w: sq, h: wh });

  /* …and the white skull: do I mean to fight other people?
   *
   * Lit on a RED face rather than the gold one every other pressed button
   * wears. Gold is this interface's word for "open" — a panel, an edit mode,
   * something you will close again in a moment. This one is not that, and the
   * cost of forgetting it is on. */
  const px = cx + sq + gap;
  const armed = pvpArmed();
  buttonBox(sctx, px, wy, sq, wh, S, {
    on: armed, face: armed ? "rgba(150,58,48,.92)" : undefined,
  });
  skullButtonIcon(sctx, px, wy, sq, wh, armed);
  hotspots.push({ x: px, y: wy, w: sq, h: wh, fn: () => togglePvpSwitch() });
  touchButtons.push({ x: px, y: wy, w: sq, h: wh });

  /* Row 3: mark, chat, edit — the three the phone deck grew and the column
   * did not. Thirds rather than halves because none of them needs a word
   * longer than four letters, and a fourth row would cost another container. */
  const ry = wy + wh + gap;
  const third = Math.round((d.innerW - gap * 2) / 3);
  const marked = P.target?.kind === "mob";
  buttonBox(sctx, d.innerX, ry, third, wh, S, {
    on: marked, face: marked ? "rgba(150,58,48,.92)" : undefined,
  });
  drawSquareIcon(sctx, "atk", d.innerX, ry, third, wh, marked, undefined, 0.7);
  hotspots.push({ x: d.innerX, y: ry, w: third, h: wh, fn: () => attackNearest() });
  touchButtons.push({ x: d.innerX, y: ry, w: third, h: wh });

  sctx.font = `bold ${Math.round(wh * 0.42)}px 'Courier New',monospace`;
  const chx = d.innerX + third + gap;
  const chatOn = chatInput().isOpen();
  buttonBox(sctx, chx, ry, third, wh, S, {
    on: chatOn, face: chatOn ? "rgba(202,162,58,.92)" : undefined,
    accent: chatOn ? CHROME.goldText : undefined,
  });
  sctx.fillStyle = chatOn ? "#201a10" : "#e9e2c8";
  sctx.fillText("CHAT", chx + third / 2, ry + wh / 2);
  /* Unread rides here on the desktop, where there is no reveal button to hang
   * it on — same pip, same rule: only a person speaking lights it. */
  unreadPip(sctx, chx + third, ry, wh);
  hotspots.push({ x: chx, y: ry, w: third, h: wh,
    fn: () => { if (chatInput().isOpen()) closeChat(); else openChat(); } });
  touchButtons.push({ x: chx, y: ry, w: third, h: wh });

  const ex = chx + third + gap;
  const editing = hudEditing();
  buttonBox(sctx, ex, ry, third, wh, S, {
    on: editing, face: editing ? "rgba(202,162,58,.92)" : undefined,
    accent: editing ? CHROME.goldText : undefined,
  });
  sctx.fillStyle = editing ? "#201a10" : "#e9e2c8";
  sctx.fillText(editing ? "DONE" : "EDIT", ex + third / 2, ry + wh / 2);
  hotspots.push({ x: ex, y: ry, w: third, h: wh, fn: () => {
    toggleHudLock();
    flash(hudLocked() ? "slots locked" : "click a slot to bind it", "#8ab6ff");
  } });
  touchButtons.push({ x: ex, y: ry, w: third, h: wh });
}

/**
 * Height of a hotbar slot, in HUD design units.
 *
 * One number sets the whole bar. Thirty is about an inch of screen on a laptop
 * and leaves the bound item's name and cooldown legible, which was the entire
 * complaint about the sixteen-unit version in the column.
 */
const HOTBAR_SLOT = 30;

/**
 * The action bar, across the foot of the MAP.
 *
 * Not across the whole canvas: it centres on the visible map so the sidebar
 * does not push it off-centre from everything the player is actually watching.
 */
/** Slots per row on a desktop hotbar. */
const HOTBAR_ROW_MAX = 12;

function drawHotbar(): void {
  const S = scale;
  const slot = HOTBAR_SLOT * S;
  const gap = 4 * S;
  const n = actionSlotCount();
  /* Split into EVEN rows rather than filling twelve and leaving a stub.
   * Eighteen slots is two rows of nine, not a twelve and a six — a ragged
   * bar reads as a bar that has broken, and the whole value of a hotbar is
   * that its shape is the thing you remember. */
  const rows = Math.max(1, Math.ceil(n / HOTBAR_ROW_MAX));
  const perRow = Math.ceil(n / rows);
  const mapW = screen.width - sidebarW;
  const bottom = Math.round(screen.height - slot - 8 * S);
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    /* How many are actually on THIS row — the last one may be short by one
     * when the count does not divide evenly — so each row centres on itself
     * instead of hanging off the left. */
    const inRow = Math.min(perRow, n - row * perRow);
    const total = inRow * slot + (inRow - 1) * gap;
    const x0 = Math.round((mapW - total) / 2);
    /* Rows stack UPWARD: the bottom row keeps the line the bar has always
     * been on, so adding a row moves nothing the hand already knows. */
    drawActionSlot(i, x0 + col * (slot + gap),
      bottom - (rows - 1 - row) * (slot + gap), slot, slot);
  }
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

/**
 * Lengthen or shorten the hotbar by one row.
 *
 * ONE function for both surfaces, and the reason is the bug it fixes. The
 * desktop toolbar and the phone's drop-down each had their own copy of
 * "call add/remove, flash, save" — and only the desktop one worked, because
 * only the desktop bar reads the length while it draws.
 *
 * The phone's slot RECTS are computed in `resize()`, which runs when the
 * window changes size and at nothing else. So the count went up, the label
 * said so, the log said so, and the deck kept the six boxes it had measured
 * at start-up. Re-measuring is the whole fix, and putting it here means the
 * next surface to grow a button cannot forget it.
 */
function stepHotkeyRows(delta: -1 | 1): void {
  if (!(delta < 0 ? removeActionSlots() : addActionSlots())) {
    flash(delta < 0 ? `${ACTION_SLOTS_MIN} is the fewest` : `${ACTION_SLOTS_MAX} is the most`,
      "#e0a06a");
    return;
  }
  resize();          // the deck measures its slots there, not per frame
  saveGame(game);
  flash(`${actionSlotCount()} hotkeys`, "#8ab6ff");
}

/** Action-slot rects this frame (mouse right-click = open the rebind picker). */
let actionSlotRects: { i: number; x: number; y: number; w: number; h: number }[] = [];

/** A thin bar for the phone's status strip: sunk frame, fill, gloss. */
function deckBar(x: number, y: number, w: number, h: number, frac: number, fg: string, bg: string): void {
  const ctx = sctx;
  sunkenBox(ctx, x, y, w, h, bg, "#05100e", "#40605a", scale);
  const fill = Math.round((w - 2) * clamp(frac, 0, 1));
  ctx.fillStyle = fg;
  ctx.fillRect(Math.round(x + 1), Math.round(y + 1), fill, Math.round(h - 2));
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.fillRect(Math.round(x + 1), Math.round(y + 1), fill, Math.ceil((h - 2) / 3));
}

/**
 * The portrait-phone deck. See ui/mobile.ts for why it is shaped like this.
 *
 * Text here is sized from the DECK's touch unit, not from the HUD's design
 * unit. On a 360-wide phone the design unit lands near 0.75 CSS px, so the
 * HUD's usual `8 * scale` label is six CSS pixels tall — legible in a
 * screenshot, not on a phone at arm's length.
 */
function drawDeck(): void {
  const ctx = sctx;
  const d = deck;
  const u = d.u;
  const world = cw();
  const h: HudCtx = {
    ctx, scale, screenW: screen.width, screenH: screen.height,
    touch: true, touchInput: isTouchDevice(),
  };
  const hair = Math.max(1, Math.round(u * 0.025));

  // --- plates. Opaque, because a translucent one still reads as world -------
  ctx.fillStyle = "rgba(10,8,5,.96)";
  ctx.fillRect(0, 0, screen.width, d.topH);
  const edge = "rgba(202,162,58,.32)";
  if (d.landscape) {
    /* Sideways the chrome runs down the sides, so the map keeps the full height
     * it has — the axis this orientation is short of. */
    ctx.fillRect(0, d.topH, d.mapLeft, screen.height - d.topH);
    ctx.fillRect(d.mapRight, d.topH, screen.width - d.mapRight, screen.height - d.topH);
    ctx.fillStyle = edge;
    ctx.fillRect(0, d.topH - hair, screen.width, hair);
    ctx.fillRect(d.mapLeft - hair, d.topH, hair, screen.height - d.topH);
    ctx.fillRect(d.mapRight, d.topH, hair, screen.height - d.topH);
  } else {
    ctx.fillRect(0, d.deckY, screen.width, screen.height - d.deckY);
    ctx.fillStyle = edge;
    ctx.fillRect(0, d.topH - hair, screen.width, hair);
    ctx.fillRect(0, d.deckY, screen.width, hair);
  }
  ctx.textBaseline = "middle";

  // --- info row: where you are, and how rich -------------------------------
  const zone = world.name + (isSafeTile(world, P.tx, P.ty) ? " \u00b7 safe" : " \u00b7 danger");
  hudText(h, zone, d.info.x, d.info.y + d.info.h / 2, u * 0.27, "#cfe8d2", "left", true,
    d.info.w - d.purse.w - u * 0.25);
  const tp = `TP ${P.taskPoints}`;
  hudText(h, tp, d.purse.x + d.purse.w, d.purse.y + d.purse.h / 2, u * 0.25, "#9ad0ff", "right", true);
  ctx.font = `bold ${Math.round(u * 0.25)}px 'Courier New',monospace`;
  const tpW = ctx.measureText(tp).width + u * 0.4;
  const coin = SPR.coin;
  const cs = Math.max(1, Math.round(u * 0.3));
  const cw2 = iconW(coin, cs / coin.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(coin, Math.round(d.purse.x), Math.round(d.purse.y + (d.purse.h - cs) / 2), cw2, cs);
  hudText(h, `${totalGold(game, P)}`, d.purse.x + cw2 + u * 0.12, d.purse.y + d.purse.h / 2,
    u * 0.27, "#f3eedd", "left", true, d.purse.w - cw2 - tpW - u * 0.2);

  // --- vitals: the two numbers you actually watch, HP and how full you are --
  const cap = carryCap(P);
  const used = Math.round(carriedWeight(P));
  /** One labelled bar. Both orientations want the same thing in a different box. */
  const vbar = (
    bx: number, by: number, bwid: number, bhi: number,
    frac: number, label: string, fg: string, bg: string, col: string, bold: boolean,
  ): number => {
    const labW = Math.round(u * 1.5);
    const inner = Math.max(1, bwid - labW);
    deckBar(bx, by, inner, bhi, frac, fg, bg);
    hudText(h, label, bx + bwid, by + bhi / 2, u * 0.24, col, "right", bold, labW - u * 0.1);
    return by + bhi / 2;
  };
  let hpMid: number;
  if (d.landscape) {
    /* Shoulder to shoulder. Sideways there is width for both on the one row,
     * and that row is the whole of the status chrome — three stacked rows would
     * spend the axis this orientation cannot spare. */
    const half = Math.floor((d.vitals.w - d.gap * 2) / 2);
    const bh = Math.round(d.vitals.h * 0.62);
    const by = d.vitals.y + Math.round((d.vitals.h - bh) / 2);
    hpMid = vbar(d.vitals.x, by, half, bh, P.hp / P.maxhp,
      `${Math.ceil(P.hp)}/${P.maxhp}`, "#e1483b", "#5d1a14", "#ffd9d4", true);
    vbar(d.vitals.x + half + d.gap * 2, by, d.vitals.w - half - d.gap * 2, bh, used / cap,
      `${used}/${cap}`, used >= cap ? "#e06a4a" : "#caa15a", "#3a3222",
      used >= cap ? "#ffb59a" : "#e8dcc0", false);
  } else {
    const barH = Math.round((d.vitals.h - Math.max(2, Math.round(u * 0.05))) / 2);
    hpMid = vbar(d.vitals.x, d.vitals.y, d.vitals.w, barH, P.hp / P.maxhp,
      `${Math.ceil(P.hp)}/${P.maxhp}`, "#e1483b", "#5d1a14", "#ffd9d4", true);
    vbar(d.vitals.x, d.vitals.y + d.vitals.h - barH, d.vitals.w, barH, used / cap,
      `${used}/${cap}`, used >= cap ? "#e06a4a" : "#caa15a", "#3a3222",
      used >= cap ? "#ffb59a" : "#e8dcc0", false);
  }
  /* Level rides inside the HP bar's own slack rather than taking a line of its
   * own: a status strip that grows a row per number ends up taller than the map
   * it is describing. */
  hudText(h, `Lv ${P.level}`, d.vitals.x + u * 0.15, hpMid, u * 0.2,
    "rgba(230,212,255,.9)", "left", true);

  /* --- utility row: reveal, edit, swap, minimap ---------------------------
   *
   * The five panel buttons used to sit here on permanent display and cost a
   * whole touch row of the strip. You open a panel about once a minute; you
   * look at the map and your health constantly. Folding them behind one button
   * bought this row for the controls that had nowhere else to go, and let the
   * deck below shrink to the six slots alone. */
  const editing = hudEditing();
  const anyOpen = DECK_TABS.some((k) => hasWindow(k as PanelKind));
  const mOn = deckMenu || anyOpen;
  buttonBox(ctx, d.menu.x, d.menu.y, d.menu.w, d.menu.h, scale, {
    on: mOn, face: mOn ? "rgba(202,162,58,.92)" : undefined, accent: mOn ? CHROME.goldText : undefined,
  });
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = mOn ? "#201a10" : "#e9e2c8";
  ctx.font = `bold ${Math.round(d.menu.h * 0.5)}px 'Courier New',monospace`;
  ctx.fillText(deckMenu ? "\u00d7" : "\u2261", d.menu.x + d.menu.w / 2, d.menu.y + d.menu.h / 2);
  /* Unread chat rides on the reveal button rather than on a chat button of its
   * own. There is no permanent chat button — the log is the way in — so this
   * is the only control that is always on screen and can carry the count. */
  unreadPip(ctx, d.menu.x + d.menu.w, d.menu.y, u);
  hotspots.push({ ...d.menu, fn: () => { deckMenu = !deckMenu; } });
  touchButtons.push({ x: d.menu.x, y: d.menu.y, w: d.menu.w, h: d.menu.h });

  /* Chase, drawn as a lit STATE rather than a press. Red for pursuit and blue
   * for holding ground, the same language the stance chip uses: red is
   * committed, blue is careful.
   *
   * A running figure and a standing one now, rather than the words CHASE and
   * STAND. The picture is not the improvement — the word was perfectly clear —
   * the WIDTH is: those were the two longest labels on the strip, they made
   * this the only oblong button in a row of squares, and the half unit they
   * cost is what the skull beside them is standing on. The colour carries over
   * unchanged, so the button still reads the same way at a glance. */
  const onChase = chasing();
  buttonBox(ctx, d.chase.x, d.chase.y, d.chase.w, d.chase.h, scale, {
    on: onChase, face: onChase ? "rgba(150,58,48,.92)" : undefined,
  });
  drawSquareIcon(ctx, onChase ? "chase" : "stand", d.chase.x, d.chase.y, d.chase.w, d.chase.h,
    onChase, chaseTint(onChase), 0.66);
  hotspots.push({ ...d.chase, fn: () => { if (!editing) toggleChase(); } });
  touchButtons.push({ ...d.chase });

  /* Mark the nearest creature. Crossed swords, drawn rather than lettered:
   * there is no three-letter word for "attack the nearest thing" that reads
   * at this size, and the glyph is the one every Tibia client already uses.
   * Lit while a mark is held, so the button also answers "am I fighting?". */
  const marked = P.target?.kind === "mob";
  buttonBox(ctx, d.atk.x, d.atk.y, d.atk.w, d.atk.h, scale, {
    on: marked, face: marked ? "rgba(150,58,48,.92)" : undefined,
  });
  drawSquareIcon(ctx, "atk", d.atk.x, d.atk.y, d.atk.w, d.atk.h, marked, undefined, 0.66);
  hotspots.push({ ...d.atk, fn: () => { if (!editing) attackNearest(); } });
  touchButtons.push({ ...d.atk });

  /* The white skull: do I mean to fight other PLAYERS?
   *
   * On the strip rather than behind the menu button, which is the one place
   * this differs from Tibia on purpose. Tibia buries the same switch two
   * menus deep, and the cost of that is paid by whoever discovers their
   * setting was wrong by killing a friend. It is a fight control, so it lives
   * with the fight controls. */
  const armed = pvpArmed();
  buttonBox(ctx, d.skull.x, d.skull.y, d.skull.w, d.skull.h, scale, {
    on: armed, face: armed ? "rgba(150,58,48,.92)" : undefined,
  });
  skullButtonIcon(ctx, d.skull.x, d.skull.y, d.skull.w, d.skull.h, armed);
  hotspots.push({ ...d.skull, fn: () => { if (!editing) togglePvpSwitch(); } });
  touchButtons.push({ ...d.skull });

  const bowOn = P.eq.weapon ? !!ITEMS[P.eq.weapon].bow : false;
  hudBtn(d.swap.x, d.swap.y, d.swap.w, d.swap.h, bowOn ? "\u2192MELEE" : "\u2192BOW", false, () => {
    if (!editing) swapWeapon();
  });
  drawMinimapAt(h, game, P, d.minimap.x, d.minimap.y, d.minimap.w);
  touchButtons.push({ ...d.minimap });

  /* --- the drop-down, over the world, only while it is open ---------------- */
  if (deckMenu) {
    const r0 = d.tabs[0];
    /* The plate now covers TWO rows — the grid's height, not one tab's. Taken
     * from the lowest cell rather than assumed, so the plate cannot drift out
     * of step with the layout the way a hard-coded `2 *` would. */
    const lowest = Math.max(d.edit.y + d.edit.h, d.chat.y + d.chat.h, r0.y + r0.h);
    ctx.fillStyle = "rgba(10,8,5,.92)";
    ctx.fillRect(d.mapLeft, d.topH, Math.max(1, d.mapRight - d.mapLeft), lowest - d.topH + d.gap);
    d.tabs.forEach((r, i) => {
      const kind = DECK_TABS[i] as PanelKind;
      const on = hasWindow(kind);
      buttonBox(ctx, r.x, r.y, r.w, r.h, scale, {
        on, face: on ? "rgba(202,162,58,.92)" : undefined, accent: on ? CHROME.goldText : undefined,
      });
      /* Nudged up by a hair: these are the only glyphs with a word underneath
       * them, so centring on the box would centre the PAIR too low. */
      drawSquareIcon(ctx, DECK_TABS[i] as ControlIcon, r.x, r.y, r.w, r.h, on,
        undefined, 0.7, -u * 0.09);
      hudText(h, DECK_TABS[i], r.x + r.w / 2, r.y + r.h - u * 0.13, u * 0.17,
        on ? "#201a10" : "rgba(233,226,200,.75)", "center", false, r.w - u * 0.08);
      hotspots.push({ x: r.x, y: r.y, w: r.w, h: r.h, fn: () => { togglePanel(kind); deckMenu = false; } });
      touchButtons.push({ ...r });
    });
    /* Chat on the second row. The log lying on the world is the usual way in —
     * you tap what you are already reading — so this covers the one case that
     * cannot: a quiet world with no log to tap. */
    const cr = d.chat;
    const chatOpen = chatInput().isOpen();
    buttonBox(ctx, cr.x, cr.y, cr.w, cr.h, scale, {
      on: chatOpen, face: chatOpen ? "rgba(202,162,58,.92)" : undefined,
      accent: chatOpen ? CHROME.goldText : undefined,
    });
    hudText(h, "CHAT", cr.x + cr.w / 2, cr.y + cr.h / 2, u * 0.24,
      chatOpen ? "#201a10" : "rgba(233,226,200,.85)", "center", true, cr.w - u * 0.08);
    hotspots.push({ x: cr.x, y: cr.y, w: cr.w, h: cr.h, fn: () => {
      deckMenu = false;
      if (chatInput().isOpen()) closeChat(); else openChat();
    } });
    touchButtons.push({ ...cr });

    /* …and the edit toggle beside it. It lost its seat on the utility row to
     * the combat controls: you bind a slot once, and you toggle pursuit
     * mid-fight, so the rare control is the one that moves. */
    const er = d.edit;
    buttonBox(ctx, er.x, er.y, er.w, er.h, scale, {
      on: editing, face: editing ? "rgba(202,162,58,.92)" : undefined,
      accent: editing ? CHROME.goldText : undefined,
    });
    hudText(h, editing ? "DONE" : "EDIT", er.x + er.w / 2, er.y + er.h / 2, u * 0.24,
      editing ? "#201a10" : "rgba(233,226,200,.85)", "center", true, er.w - u * 0.08);
    hotspots.push({ x: er.x, y: er.y, w: er.w, h: er.h, fn: () => {
      toggleHudLock();
      flash(hudLocked() ? "slots locked" : "tap a slot to bind it", "#8ab6ff");
    } });
    touchButtons.push({ ...er });

    /* …and LOOK, the third mode on this row.
     *
     * Blue, not gold. Gold in this interface means "something is open and you
     * will close it in a moment"; this is a mode you play in for as long as
     * you are curious, and it changes what every tap on the world DOES. It
     * gets the same blue the stance chip uses for careful, which is what
     * looking is.
     *
     * The menu closes behind it, unlike EDIT: edit mode is arranging the very
     * row the button sits in, so the row has to stay. Looking is done at the
     * world, and a drop-down covering half of it would be absurd. */
    const lr = d.look;
    const looking = ui.lookMode;
    buttonBox(ctx, lr.x, lr.y, lr.w, lr.h, scale, {
      on: looking, face: looking ? "rgba(90,161,232,.85)" : undefined,
      accent: looking ? "#cfe8ff" : undefined,
    });
    hudText(h, "LOOK", lr.x + lr.w / 2, lr.y + lr.h / 2, u * 0.24,
      looking ? "#0b2036" : "rgba(233,226,200,.85)", "center", true, lr.w - u * 0.08);
    hotspots.push({ x: lr.x, y: lr.y, w: lr.w, h: lr.h, fn: () => {
      deckMenu = false;
      ui.lookMode = !ui.lookMode;
      if (!ui.lookMode) ui.inspect = null;
      flash(ui.lookMode ? "look mode on — tap anything" : "look mode off", "#8ab6ff");
    } });
    touchButtons.push({ ...lr });

  }
  /* Empty slots are drawn on the deck even out of edit mode, unlike the old
   * floating HUD which hid them. A row with holes in it is a row you have to
   * look at to count; a full row of six is one your thumb learns the shape of. */
  d.slots.forEach((r, i) => drawActionSlot(i, r.x, r.y, r.w, r.h));

  /* --- how many slots there are, while EDIT is on -------------------------
   *
   * Riding on top of the deck, touching the thing it changes, so a press and
   * the row appearing are the same glance. Only while editing: the rest of
   * the time this band is map.
   *
   * On the desktop the identical control sits on the edit strip. That strip
   * does not exist here — `drawTouchControls` hands the screen to this
   * function and returns before reaching it — which is how the first attempt
   * shipped a button that only drew on the other device. */
  if (hudEditing()) {
    const kb = d.keysBar;
    const n = actionSlotCount();
    const third = Math.floor((kb.w - 2 * d.gap) / 3);
    const cells: { x: number; w: number }[] = [
      { x: kb.x, w: third },
      { x: kb.x + third + d.gap, w: kb.w - 2 * (third + d.gap) },
      { x: kb.x + kb.w - third, w: third },
    ];
    for (const [i, c] of cells.entries()) {
      const mid = i === 1;
      const can = i === 0 ? n > ACTION_SLOTS_MIN : n < ACTION_SLOTS_MAX;
      buttonBox(ctx, c.x, kb.y, c.w, kb.h, scale,
        mid ? { face: "rgba(16,26,24,.9)" } : {});
      hudText(h, mid ? `${n} HOTKEYS` : i === 0 ? `\u2212${ACTION_SLOT_STEP}` : `+${ACTION_SLOT_STEP}`,
        c.x + c.w / 2, kb.y + kb.h / 2, u * 0.26,
        mid ? "#e9e2c8" : can ? "#e9e2c8" : "rgba(233,226,200,.3)",
        "center", true, c.w - u * 0.1);
      if (!mid) {
        const delta = i === 0 ? -1 : 1;
        hotspots.push({ x: c.x, y: kb.y, w: c.w, h: kb.h, fn: () => stepHotkeyRows(delta) });
      }
      touchButtons.push({ x: c.x, y: kb.y, w: c.w, h: kb.h });
    }
  }

  /* --- the strip's tab, drawn last so it rides over the panel it controls --- */
  const side = activeStrip();
  if (side) {
    const gr = stripHandle(d, side);
    buttonBox(ctx, gr.x, gr.y, gr.w, gr.h, scale, { face: "rgba(28,22,12,.96)", accent: CHROME.gold });
    ctx.fillStyle = "#e8c06a";
    const dot = Math.max(1, Math.round(u * 0.045));
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(Math.round(gr.x + gr.w / 2 - dot / 2),
        Math.round(gr.y + gr.h / 2 + i * dot * 3), dot, dot);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffe9a8";
    ctx.font = `bold ${Math.round(u * 0.3)}px 'Courier New',monospace`;
    ctx.fillText(stripAway ? "\u25c0" : "\u25b6", gr.x + gr.w / 2, gr.y + gr.h * (stripAway ? 0.2 : 0.2));
    ctx.fillText(stripAway ? "\u25c0" : "\u25b6", gr.x + gr.w / 2, gr.y + gr.h * 0.8);
    hotspots.push({ ...gr, fn: () => { stripAway = !stripAway; } });
    touchButtons.push({ x: gr.x, y: gr.y, w: gr.w, h: gr.h });
  }

  if (editing) {
    hudText(h, "tap a slot to bind \u00b7 EDIT again when done",
      screen.width / 2, d.mapTop + u * 0.35, u * 0.21, "rgba(207,232,210,.92)", "center", false,
      screen.width - u * 0.5);
  }
}

/**
 * The message log, lying on the world.
 *
 * Bottom-left of the world band, no frame, oldest at the top. Three decisions
 * worth stating, because each of them was the alternative once:
 *
 *  - NO PLATE behind the text. A dark panel the width of the longest line
 *    would cover a quarter of the map permanently, to hold six lines that are
 *    perfectly readable with a black outline. The outline costs a second
 *    fillText and covers nothing.
 *
 *  - IT IS THE BUTTON. Tapping the block of text opens the input. There is no
 *    separate chat button anywhere, because a button over the world eats a tap
 *    aimed at a tile, and the log is already sitting there being looked at. No
 *    lines, no hotspot — the affordance appears exactly when there is
 *    something to tap.
 *
 *  - IT MOVES FOR THE KEYBOARD. With the field open, `chatInput().topCss()`
 *    reports where the field's top edge landed and the log stacks upward from
 *    there. Otherwise a phone keyboard would bury the last thing anybody said,
 *    which is the message you are most likely replying to.
 */
function drawChatLog(): void {
  const lines = overlayLines();
  if (!lines.length) return;

  const S = scale;
  const size = Math.max(9, Math.round((deck.on ? deck.u * 0.24 : 9 * S)));
  const lh = Math.round(size * 1.45);
  const pad = Math.round(size * 0.7);
  const left = (deck.on ? deck.mapLeft : 0) + pad;
  const maxW = (deck.on ? deck.mapRight : screen.width - dockWidth()) - left - pad;

  // Bottom edge: above the deck normally, above the keyboard while typing.
  const dpr = screen.height / Math.max(1, cssHeight());
  const typing = chatInput().isOpen();
  const bottom = typing
    ? Math.min(deck.on ? deck.deckY : screen.height, chatInput().topCss() * dpr) - pad
    : (deck.on ? deck.deckY : screen.height - Math.round(HOTBAR_SLOT * S * 1.6)) - pad;

  vctx.save();
  vctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.font = `bold ${size}px 'Courier New',monospace`;
  sctx.textAlign = "left";
  sctx.textBaseline = "alphabetic";

  let y = bottom - (lines.length - 1) * lh;
  const top = y - lh;
  for (const l of lines) {
    const a = lineAlpha(l);
    if (a > 0) {
      const text = fitLine(formatLine(l), maxW, size);
      sctx.globalAlpha = a * 0.85;
      sctx.fillStyle = "#000";
      sctx.fillText(text, left + 1, y + 1);
      sctx.globalAlpha = a;
      sctx.fillStyle = l.color;
      sctx.fillText(text, left, y);
    }
    y += lh;
  }
  sctx.globalAlpha = 1;
  vctx.restore();

  // The block itself is the affordance — see the comment above.
  if (!typing) {
    hotspots.push({
      x: left - pad, y: top, w: maxW + pad * 2, h: bottom - top + pad,
      fn: () => openChat(),
    });
  }
}

/** Trim a line to the width available, with an ellipsis when it will not fit. */
function fitLine(text: string, maxW: number, size: number): string {
  const perChar = size * 0.6; // monospace: one measure would do, but this is a hot path
  const fits = Math.max(4, Math.floor(maxW / perChar));
  return text.length <= fits ? text : text.slice(0, fits - 1) + "\u2026";
}

/** CSS height of the canvas, for turning device px back into layout px. */
function cssHeight(): number {
  const r = screen.getBoundingClientRect?.();
  return r && r.height ? r.height : screen.height;
}

/** How much width the desktop sidebar is taking, or zero. */
function dockWidth(): number {
  return lastDock?.w ?? 0;
}

/**
 * A 16x16 glyph, centred in a button and snapped to a whole multiple of its
 * source grid.
 *
 * The snapping is the point and it was being copied by hand at every button
 * that grew a picture — five sites, all spelling out the same `Math.max(...
 * Math.floor(... / ICON_SRC) * ICON_SRC)`. Pixel art scaled by 1.37x is mush;
 * at exactly 1x, 2x or 3x it is crisp. One copy of the arithmetic means a
 * button added next month cannot get it subtly wrong.
 *
 * `fill` fraction is per-caller because a glyph in a square button wants more
 * of the box than one in a wide short bar.
 */
function drawSquareIcon(
  ctx: CanvasRenderingContext2D, icon: ControlIcon,
  bx: number, by: number, bw: number, bh: number,
  on: boolean, tint?: string, fill = 0.72, dy = 0,
): void {
  const gs = Math.max(ICON_SRC, Math.floor((Math.min(bw, bh) * fill) / ICON_SRC) * ICON_SRC);
  drawControlIcon(ctx, icon, Math.round(bx + (bw - gs) / 2), Math.round(by + (bh - gs) / 2 + dy),
    gs, on, tint);
}

/**
 * What colour the chase figure is drawn in.
 *
 * Blue for standing your ground and warm-white for pursuit — the same red/blue
 * split the stance chip uses, where red is committed and blue is careful.
 *
 * The LIT one is not the colour the word had. CHASE was drawn in #ffb3a8, a
 * salmon that sat well against the red face because a five-letter word is a
 * lot of mass; a running figure is a few dozen pixels of stick, and at that
 * weight the same salmon nearly disappears into the red behind it. So it is
 * lifted to a near-white that keeps the warm cast — the chrome has no pure
 * whites anywhere else and one here would read as a different interface.
 */
function chaseTint(on: boolean): string {
  return on ? "#ffe9e4" : "#8ab6ff";
}

/**
 * The white-skull switch, drawn the same way on the column and on the deck.
 *
 * Armed, it is the art as drawn: bone white on a red face, which is as loud as
 * this interface gets and is meant to be. Disarmed, the SAME skull at a third
 * of its weight rather than a different picture or an empty box — the state
 * has to be readable without pressing anything, and a greyed version of the
 * thing you would get says that in a way an absence cannot.
 */
function skullButtonIcon(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number, bw: number, bh: number, armed: boolean,
): void {
  const was = ctx.globalAlpha;
  ctx.globalAlpha = was * (armed ? 1 : 0.34);
  drawSquareIcon(ctx, "skullWhite", bx, by, bw, bh, armed);
  ctx.globalAlpha = was;
}

/**
 * Flip the PvP switch, and say so out loud.
 *
 * The flash is not decoration here the way it is on the stance cycle. This is
 * the one toggle whose being wrong is discovered by killing somebody, so every
 * press states the new setting in plain words rather than trusting that the
 * player noticed a small picture change colour.
 */
function togglePvpSwitch(): void {
  const on = togglePvpArmed();
  flash(on ? "you will attack other players" : "you will not harm other players",
    on ? "#e1483b" : "#8ab6ff");
}

/**
 * The unread-message pip: a small dot on a control's top-right corner.
 *
 * A count rather than a plain dot once there is more than one, because "three
 * people said something" and "someone said something" are different enough to
 * be worth eight pixels. Capped at 9+ — past that the number is noise and the
 * useful information is "a lot".
 */
function unreadPip(ctx: CanvasRenderingContext2D, rx: number, ry: number, u: number): void {
  const n = unread();
  if (n <= 0) return;
  const r = Math.max(4, Math.round(u * 0.17));
  const cx = Math.round(rx - r * 0.6);
  const cy = Math.round(ry + r * 0.6);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#e1483b";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.round(r * 1.3)}px 'Courier New',monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(n > 9 ? "9+" : String(n), cx, cy + 1);
}

/**
 * Draw the long-press menu.
 *
 * Hangs off the finger, flipping to whichever side has room — a menu that
 * opens off the edge of the screen is a menu you cannot use, and on a phone
 * every press near the right edge would do exactly that. It is drawn LAST, on
 * top of the panels, because it was opened by a gesture on top of them and
 * anything else would put it behind the thing it was invoked from.
 */
function drawContextMenu(): void {
  const cm = ctxMenu;
  if (!cm) return;
  const S = scale;
  const rowH = Math.round((deck.on ? deck.u : 22 * S) * 0.9);
  const pad = Math.round(rowH * 0.34);
  const font = Math.round(rowH * 0.4);
  sctx.font = `bold ${font}px 'Courier New',monospace`;
  let wid = 0;
  for (const e of cm.entries) wid = Math.max(wid, sctx.measureText(e.label).width);
  const w = Math.round(wid + pad * 2);
  const h = rowH * cm.entries.length;

  // flip toward whichever side and edge has the room
  let x = cm.sx + Math.round(rowH * 0.3);
  let y = cm.sy - Math.round(rowH * 0.3);
  if (x + w > screen.width) x = Math.max(0, cm.sx - w - Math.round(rowH * 0.3));
  if (y + h > screen.height) y = Math.max(0, screen.height - h);
  if (y < 0) y = 0;

  /* `popupFrame`, not a hand-rolled outline. The menu is window chrome and has
   * to look like the rest of it — the inspect card and the quantity chooser
   * already use this exact frame, and a flat stroked box beside them would
   * read as a different application. */
  popupFrame(sctx, x, y, w, h, S);

  cm.rects = [];
  sctx.textAlign = "left";
  sctx.textBaseline = "middle";
  cm.entries.forEach((e, i) => {
    const ry = y + i * rowH;
    if (i > 0) {
      sctx.fillStyle = "rgba(202,162,58,.16)";
      sctx.fillRect(x + pad / 2, ry, w - pad, 1);
    }
    // A disabled entry is dim, not hidden: it teaches the shape of the menu
    // the player will eventually have, and says why when pressed.
    sctx.fillStyle = e.enabled ? "#e9e2c8" : "rgba(233,226,200,.32)";
    sctx.font = `bold ${font}px 'Courier New',monospace`;
    sctx.fillText(e.label, x + pad, ry + rowH / 2);
    cm.rects.push({ x, y: ry, w, h: rowH, i });
    touchButtons.push({ x, y: ry, w, h: rowH });
  });
}

function drawTouchControls(): void {
  touchButtons = [];
  hudGrips = [];
  actionSlotRects = [];

  if (deck.on) { drawDeck(); return; }

  const editing = hudEditing();
  const u = hudUserScale();
  const bs = clamp(Math.min(screen.width, screen.height) * 0.115, 54, 132) * u;
  const m = bs * 0.16;
  const gap = bs * 0.16;
  /* Movable HUD groups are placed against the MAP, not the canvas. Handing
   * placeHud the full width is what let the panel column drift under the
   * sidebar and sit on top of the minimap — the groups were never moved,
   * nobody had told them the map got narrower. */
  const sw = screen.width - sidebarW, sh = screen.height;

  /* With a column open, the panel buttons, action slots and weapon swap live
   * in it as fixed widgets (Tibia keeps their equivalents there). They are not
   * draggable in that mode, so they get no grip and the HUD editor skips them. */
  const docked = lastDock.w > 0;
  if (docked) {
    const r = lastDock.blocks.controls;
    if (!r.collapsed) drawDockControls(lastDock, r.bodyY);
    drawHotbar();
  }

  // --- panel-button column (group "panels"), collapsible behind a ≡ button ---
  const pbtns: [string, string, PanelKind][] = [
    ["Build", "B", "build"], ["Skills", "K", "skills"], ["Equip", "E", "equip"], ["Bag", "I", "bag"], ["Quest", "Q", "quest"],
  ];
  const menuOpen = !docked && (hudMenuOpen() || editing);
  const togH = bs * 0.5;
  const colH = togH + (menuOpen ? gap + pbtns.length * bs + (pbtns.length - 1) * gap : 0);
  if (!docked) {
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
  }

  // --- action slots: independently-placeable squares (group "slot0..N") ---
  const sw6 = bs * 0.92;
  if (!docked) {
    for (let i = 0; i < actionSlotCount(); i++) {
      if (!editing && !actionSlots[i]) continue; // keep the play HUD tidy — empty slots only show in edit mode
      const gid = `slot${i}` as HudGroup;
      const pos = placeHud(gid, sw6, bs, sw, sh);
      drawActionSlot(i, pos.x, pos.y, sw6, bs);
      if (editing) drawGroupGrip(gid, pos.x, pos.y, sw6, bs);
    }
  }

  // --- quick weapon-swap button (group "swap") ---
  if (!docked) {
    const swW = bs * 1.15, swH = bs * 0.62;
    const swapPos = placeHud("swap", swW, swH, sw, sh);
    const bowOn = P.eq.weapon ? !!ITEMS[P.eq.weapon].bow : false;
    hudBtn(swapPos.x, swapPos.y, swW, swH, bowOn ? "→MELEE" : "→BOW", false, () => { if (!editing) swapWeapon(); });
    if (editing) drawGroupGrip("swap", swapPos.x, swapPos.y, swW, swH);
  }

  // --- lock / edit toggle: sits just above the vitals (HP) frame ---
  const vw = 190 * scale * u, vh = 54 * scale * u;
  const vp = docked
    ? { x: m, y: sh - vh - m }   // no floating vitals with a column; anchor LOCK HUD bottom-left
    : placeHud("vitals", vw, vh, sw, sh);
  if (editing && !docked) drawGroupGrip("vitals", vp.x, vp.y, vw, vh);
  /* EDIT HUD only exists to rearrange movable groups. With a column open there
   * are none left — the buttons, slots, swap and vitals all live in it as fixed
   * widgets — so the button would open an editor with nothing to edit. */
  if (!docked) {
    const lockW = bs * 1.6, lockH = bs * 0.5;
    const gripClear = bs * 0.34 + 6 * scale; // leave room for the vitals drag grip in edit mode
    const lockX = clamp(vp.x, m, sw - lockW - m);
    const lockY = clamp(vp.y - lockH - gripClear, m, sh - lockH - m);
    hudBtn(lockX, lockY, lockW, lockH, editing ? "LOCK HUD" : "EDIT HUD", editing, () => {
      toggleHudLock();
      flash(hudLocked() ? "HUD locked" : "HUD unlocked — drag handles, tap slots", "#8ab6ff");
    });
  }

  /* --- edit strip, pinned top-centre while editing -------------------------
   *
   * WHAT IS AND IS NOT ON IT DEPENDS ON WHETHER THE COLUMN IS UP.
   *
   * The scale stepper and the three presets move and size the FLOATING HUD —
   * the draggable vitals, panel buttons and loose slot squares. Those only
   * exist when there is no docked column; with the column up the same widgets
   * live inside it at the column's own fixed unit, and neither control has
   * anything to act on. Radek called the whole strip redundant on a desktop,
   * and on a docked one that was not a preference, it was true: four buttons
   * and three presets that visibly did nothing when pressed.
   *
   * So they are drawn where they work and absent where they do not. The
   * hotkey count is the exception and is always here, because the bar exists
   * on both. */
  if (editing) {
    const btnH = bs * 0.5;
    const sq = bs * 0.55;
    let rowY = m + 2 * scale;

    if (!docked) {
      const pctW = bs * 1.1;
      const row1W = sq * 2 + pctW + bs * 1.3 + gap * 3;
      let ex = clamp((sw - row1W) / 2, m, sw - row1W - m);
      hudBtn(ex, rowY, sq, btnH, "\u2212", false, () => { stepHudUserScale(-1); saveHudLayout(); });
      ex += sq + gap;
      slotCell(sctx, ex, rowY, pctW, btnH, scale, { face: "rgba(16,26,24,.85)" });
      sctx.textAlign = "center";
      sctx.textBaseline = "middle";
      sctx.fillStyle = "#e9e2c8";
      sctx.font = `bold ${Math.round(btnH * 0.42)}px 'Courier New',monospace`;
      sctx.fillText(`${Math.round(u * 100)}%`, ex + pctW / 2, rowY + btnH / 2);
      ex += pctW + gap;
      hudBtn(ex, rowY, sq, btnH, "+", false, () => { stepHudUserScale(1); saveHudLayout(); });
      ex += sq + gap;
      hudBtn(ex, rowY, bs * 1.3, btnH, "RESET", false, () => {
        resetHudLayout();
        flash("HUD layout reset", "#8ab6ff");
      });
      rowY += btnH + gap;

      const pw3 = bs * 1.5;
      const row2W = pw3 * 3 + gap * 2;
      let px2 = clamp((sw - row2W) / 2, m, sw - row2W - m);
      for (const [label, name] of [["CLASSIC", "classic"], ["COMPACT", "compact"], ["LEFTY", "lefty"]] as const) {
        hudBtn(px2, rowY, pw3, btnH, label, false, () => {
          applyHudPreset(name);
          flash(`preset: ${label.toLowerCase()}`, "#8ab6ff");
        });
        px2 += pw3 + gap;
      }
      rowY += btnH + gap;
    }

    /* --- how many hotkeys --------------------------------------------------
     *
     * Here, in edit mode, because the length of the bar is a layout decision
     * and this is the screen for layout decisions. Putting it in a settings
     * panel would separate "how many buttons" from "where the buttons go",
     * which are the same question asked twice.
     *
     * A ROW at a time. Six is the phone deck's width, so every press adds or
     * removes exactly one line on both interfaces, and the bar never ends up
     * with a ragged tail. */
    const n = actionSlotCount();
    const countW = bs * 1.5;
    const row3W = sq * 2 + countW + gap * 2;
    let px3 = clamp((sw - row3W) / 2, m, sw - row3W - m);
    /* Refused rather than silently ignored, inside `stepHotkeyRows`: the floor
     * exists because a hotbar of zero is not a smaller hotbar, it is a missing
     * one, and a button that does nothing without saying why is a bug report. */
    hudBtn(px3, rowY, sq, btnH, "\u2212", false, () => stepHotkeyRows(-1), n <= ACTION_SLOTS_MIN);
    px3 += sq + gap;
    slotCell(sctx, px3, rowY, countW, btnH, scale, { face: "rgba(16,26,24,.85)" });
    sctx.textAlign = "center";
    sctx.textBaseline = "middle";
    sctx.fillStyle = "#e9e2c8";
    sctx.font = `bold ${Math.round(btnH * 0.42)}px 'Courier New',monospace`;
    sctx.fillText(`${n} KEYS`, px3 + countW / 2, rowY + btnH / 2);
    px3 += countW + gap;
    hudBtn(px3, rowY, sq, btnH, "+", false, () => stepHotkeyRows(1), n >= ACTION_SLOTS_MAX);

    /* The hint names only what is actually on screen. "Drag handles" with the
     * column up would be pointing at handles that are not there. */
    const hy = clamp(rowY + btnH + gap, m, sh - m);
    sctx.textAlign = "center";
    sctx.textBaseline = "middle";
    sctx.fillStyle = "rgba(207,232,210,.85)";
    sctx.font = `${Math.round(9 * scale)}px 'Courier New',monospace`;
    sctx.fillText(docked
      ? `click a slot to bind \u00b7 \u00b1${ACTION_SLOT_STEP} hotkeys`
      : `drag handles \u00b7 click a slot to bind \u00b7 \u00b1${ACTION_SLOT_STEP} hotkeys`,
      sw / 2, hy);
  }
}

/** How far the rebind picker's list is scrolled, in rows. */
let assignScroll = 0;

/**
 * Where the picker's scrollable body is, and how tall a row is, recorded as it
 * draws.
 *
 * The pointer handlers need both to turn a drag into rows, and they run long
 * before the draw does. Publishing the geometry is the same trick the docked
 * column uses for its own thumb.
 */
let assignBody: { x: number; y: number; w: number; h: number; rowH: number; max: number } | null = null;

/**
 * A finger dragging the picker's list.
 *
 * Necessary, not a nicety. The list is the only scrolling thing in the game a
 * phone could not scroll: the world has a joystick, panels have their own
 * scroll bars sized for a thumb, and this had a nine-pixel arrow. Radek could
 * see seventy crystals and reach the first fourteen.
 */
let assignDrag: { grabY: number; from: number; moved: boolean } | null = null;

/** The rebind picker overlay: choose what an action slot triggers. */
function drawAssignPicker(): void {
  if (assignSlot === null) { assignBody = null; return; }
  const slotIdx = assignSlot;
  const ctx = sctx;
  const S = scale;
  const sw = screen.width, sh = screen.height;
  /* The scrim covers the whole canvas, column included — it is a modal. The
   * DIALOG, though, centres on the map, because dead centre of the canvas is
   * off-centre to everything the player is looking at. */
  const mapW = sw - sidebarW;
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(0, 0, sw, sh);
  // full-screen scrim closes the picker (pushed first, so rows below take priority)
  hotspots.push({ x: 0, y: 0, w: sw, h: sh, fn: () => { assignSlot = null; } });

  /* THE ORDER IS THE FIX.
   *
   * Every crystal in the registry is bindable, and there are seventy-odd of
   * them. Listed by registry order, a player who owns four crystals scrolls
   * past sixty-eight rows reading "0 charges" to find them — which is exactly
   * what Radek's screenshot shows: seven rows visible, six of them useless.
   *
   * So: what you actually HAVE comes first, and the rest keep their registry
   * order below. Nothing is hidden — a crystal you have run dry is still
   * bindable, and binding one you intend to buy is a reasonable thing to do —
   * but the list now opens on the answer instead of on the alphabet.
   */
  type Row = {
    label: string; sub: string; icon?: ItemKind; have: number; fn: () => void;
  };
  const rows: Row[] = [];
  const owned: Row[] = [];
  const empty: Row[] = [];
  for (const k of BINDABLE_CRYSTALS) {
    const have = bagCount(P.bag, k);
    (have > 0 ? owned : empty).push({
      label: ITEMS[k].name,
      sub: have > 0 ? `${have} charges` : "none carried",
      icon: k, have,
      fn: () => { setSlot(slotIdx, { type: "crystal", item: k }); assignSlot = null; saveGame(game); },
    });
  }
  rows.push({ label: "Swap Weapon", sub: "toggle bow / melee", have: 1,
    fn: () => { setSlot(slotIdx, { type: "swap" }); assignSlot = null; saveGame(game); } });
  rows.push({ label: "Clear slot", sub: "leave empty", have: 1,
    fn: () => { setSlot(slotIdx, null); assignSlot = null; saveGame(game); } });
  rows.push(...owned, ...empty);

  const w = clamp(mapW * 0.66, 220 * S, 420 * S);
  /* Rows tall enough for a FINGER on the phone, where this dialog was a wall
   * of eight-pixel text. `scale` is the world's ruler and is small there;
   * TOUCH_MIN_CSS is the one number that means "a fingertip". */
  const rowH = deck.on
    ? Math.max(30 * S, Math.round(TOUCH_MIN_CSS * Math.min(devicePixelRatio || 1, 2) * 0.92))
    : 30 * S;
  /* Every bindable crystal is a row here, and there are dozens. Sized to the
   * list, the dialog ran off the top and bottom of the display; capped and
   * scrolled, the rows stay the size they were designed at. */
  const shown = Math.max(3, Math.min(rows.length, Math.floor((sh * 0.8 - 36 * S) / rowH)));
  assignScroll = clamp(assignScroll, 0, Math.max(0, rows.length - shown));
  const h = 26 * S + shown * rowH + 10 * S;
  const x = (mapW - w) / 2, y = (sh - h) / 2;
  popupFrame(ctx, x, y, w, h, S, "rgba(16,20,24,.97)");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffe9a8";
  ctx.font = `bold ${Math.round(11 * S)}px 'Courier New',monospace`;
  ctx.fillText(`Bind slot ${slotIdx + 1}`, x + w / 2, y + 14 * S);
  let ry = y + 26 * S;
  /* Published for the pointer handlers, which run long before this does. The
   * body is the row area only — the title is not draggable, so a press there
   * still falls through to the scrim and closes the dialog. */
  assignBody = {
    x: x + 6 * S, y: ry, w: w - 12 * S, h: shown * rowH,
    rowH, max: Math.max(0, rows.length - shown),
  };
  if (rows.length > shown) {
    /* Arrows sized for whatever is pointing at them. Nine pixels is a mouse
     * target; on a phone `S` is the world's small ruler and nine of them is a
     * speck, which is how this list ended up unscrollable on the one device
     * that has no wheel. */
    const sbw = deck.on
      ? Math.max(9 * S, Math.round(TOUCH_MIN_CSS * Math.min(devicePixelRatio || 1, 2) * 0.8))
      : 9 * S;
    const sx = x + w - sbw - 4 * S;
    const arrow = (dir: -1 | 1, ay: number, can: boolean): void => {
      buttonBox(ctx, sx, ay, sbw, sbw, S, { accent: can ? CHROME.gold : undefined });
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = can ? "#ffe9a8" : "rgba(255,233,168,.25)";
      ctx.font = `bold ${Math.round(6 * S)}px 'Courier New',monospace`;
      ctx.fillText(dir < 0 ? "\u25B2" : "\u25BC", sx + sbw / 2, ay + sbw / 2);
      if (can) hotspots.push({ x: sx, y: ay, w: sbw, h: sbw, fn: () => { assignScroll += dir; } });
    };
    const trackH = shown * rowH;
    arrow(-1, ry, assignScroll > 0);
    arrow(1, ry + trackH - sbw, assignScroll < rows.length - shown);
    const track = trackH - 2 * sbw;
    const th = Math.max(6 * S, (track * shown) / rows.length);
    const ty = ry + sbw + ((track - th) * assignScroll) / Math.max(1, rows.length - shown);
    raisedBox(ctx, sx + S, ty, sbw - 2 * S, th, "rgba(202,162,58,.55)", CHROME.gold, "#3a2c0e", S);
  }
  for (const r of rows.slice(assignScroll, assignScroll + shown)) {
    const rx = x + 6 * S;
    const rw = w - 12 * S;
    const rh = rowH - 4 * S;
    /* A crystal you are not carrying is dimmed, not hidden — binding one you
     * are about to buy is a reasonable thing to want. Dimmed is enough: it
     * answers "why is this here and greyed" the moment you read the charges
     * under it, and it stops sixty-eight dead entries reading as loudly as
     * the four live ones. */
    const live = r.have > 0;
    buttonBox(ctx, rx, ry + 2 * S, rw, rh, S,
      { face: live ? "rgba(40,52,60,.92)" : "rgba(28,34,40,.86)" });

    /* The ICON, which is most of the readability.
     *
     * These are seventy items whose names differ by one word — Bedrock Shard,
     * Bedrock Burst, Bedrock Nova — and whose ART differs by colour and shape
     * at a glance. Reading was the slow way to tell them apart and it was the
     * only way on offer. */
    let tx0 = rx + 10 * S;
    if (r.icon) {
      const spr = itemSprite(r.icon);
      const box = rh - 6 * S;
      const k = Math.max(1, Math.floor(box / Math.max(spr.width, spr.height)));
      const iw = spr.width * k, ih = spr.height * k;
      const was = ctx.globalAlpha;
      if (!live) ctx.globalAlpha = was * 0.4;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(spr, Math.round(rx + 6 * S + (box - iw) / 2),
        Math.round(ry + 2 * S + (rh - ih) / 2), iw, ih);
      ctx.globalAlpha = was;
      tx0 = rx + 6 * S + box + 8 * S;
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = live ? "#f3eedd" : "rgba(243,238,221,.45)";
    ctx.font = `bold ${Math.round(9 * S)}px 'Courier New',monospace`;
    ctx.fillText(r.label, tx0, ry + rowH * 0.4);
    /* Charges in green when there are some. The number is the whole reason
     * this line exists and it was the same grey as the word "none". */
    ctx.fillStyle = live ? "#9fe8a8" : "rgba(220,214,190,.35)";
    ctx.font = `${Math.round(7 * S)}px 'Courier New',monospace`;
    ctx.fillText(r.sub, tx0, ry + rowH * 0.72);
    const yy = ry, fn = r.fn;
    hotspots.push({ x: rx, y: yy + 2 * S, w: rw, h: rh, fn });
    ry += rowH;
  }
}

/** True if a screen point lies on any on-screen button (blocks the joystick). */
function overTouchButton(sx: number, sy: number): boolean {
  if (assignSlot !== null) return true; // rebind picker open — absorb all touches
  if (hudEditing()) return true;        // edit mode — no walking while arranging
  if (throwPending) return true;        // aiming a throw — the tap must land, not steer
  if (aimPending) return true;          // aiming a Burst — likewise
  // the two plates are not the world: a press on them must never walk or steer
  if (overDeck(deck, sx, sy)) return true;
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
