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
 * The rectangle itself differs per creature and is read off the file, not
 * hard-coded: a bandit is 32x55 but the minotaur guard's shield and the mage's
 * staff push those two out to 50x56 and 60x64. The crop is kept symmetric about
 * the source cell's centre line so a wide prop on one side does not shove the
 * body off the tile it stands on.
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

/**
 * How long ONE FULL walk cycle takes, in seconds.
 *
 * The cadence is stated as a cycle length rather than a frame rate on purpose.
 * It used to be a flat `WALK_FPS = 8`, which quietly coupled how fast a
 * creature's legs move to how many frames its artist happened to draw: a
 * nine-column LPC sheet has eight stride frames and cycled in a second, while
 * the dragon's six-column sheet has five and cycled in 0.62 s. The frame count
 * is a DRAWING decision — how finely the cycle was subdivided — and it has no
 * business setting the animal's gait.
 *
 * One second per cycle reproduces the LPC humans exactly, since eight frames
 * over one second is the eight fps they always ran at.
 */
const WALK_CYCLE_S = 1.0;

/**
 * Creatures whose stride is not the standard second.
 *
 * The number that reads right is roughly the time the animal takes to cover
 * its own body length, because that is about how often a real leg plants. The
 * dragon is 90 px long; at 51 px/s that is 1.75 s. At the old flat cadence it
 * completed a whole gallop every 1.17 tiles — a stride and a half per body
 * length — which is why it looked like it was running on the spot.
 *
 * This number is DOWNSTREAM of the creature's speed and has to move with it:
 * Etap 30 took 15% off every entry in MONSTER_DEFS, and the dragon's cycle
 * went from 1.5 to 1.75 for exactly that reason. Change a speed, recheck the
 * override — the smoke test does this arithmetic and will catch it.
 */
const WALK_CYCLE_OVERRIDE: Readonly<Record<string, number>> = {
  dragon: 1.75,
};

/**
 * Sheets that are not nine frames across. The LPC exports all are; artwork from
 * elsewhere is whatever its author drew, and the snake pack ships seven.
 */
const SHEET_COLS: Record<string, number> = {
  snake: 7,
  dragon: 6,
};

const colsOf = (id: string): number => SHEET_COLS[id] ?? COLS;

/**
 * Creatures whose artwork has only a side view.
 *
 * The snake was drawn facing one way and nothing else — no front, no back. The
 * honest answer is to never show a pose that was never drawn: a step with any
 * horizontal component turns the creature, and a straight up-or-down step
 * leaves it facing where it already was. It slithers across the screen rather
 * than pretending to look at the camera. Both vertical rows of its sheet still
 * carry the side view, because a monster spawns facing "down" before it has
 * taken a single step.
 *
 * The dragon arrived the same way: a pack of side-view frames and nothing
 * else. A quadruped reads better for it than it did for the snake — a big
 * animal crossing the screen in profile is what a dragon looks like in every
 * game that has one — but the rule is identical and so is the reason.
 */
const SIDE_ONLY = new Set<string>(["snake", "dragon"]);

/**
 * Sheets to load, keyed by creature. Townsfolk live in the same registry under
 * an `npc:` prefix — a walking smith is the same problem as a walking bandit,
 * and one loader means one place where the LPC layout is spelled out.
 */
const SHEET_SRC: Record<string, string> = {
  beggar: "./mob-beggar-walk.png",
  vagrant: "./mob-vagrant-walk.png",
  thief: "./mob-thief-walk.png",
  poacher: "./mob-poacher-walk.png",
  bandit: "./mob-bandit-walk.png",
  smuggler: "./mob-smuggler-walk.png",
  cutthroat: "./mob-cutthroat-walk.png",
  deserter: "./mob-deserter-walk.png",
  brigand: "./mob-brigand-walk.png",
  highwayman: "./mob-highwayman-walk.png",
  redcap: "./mob-redcap-walk.png",
  mercenary: "./mob-mercenary-walk.png",
  corsair: "./mob-corsair-walk.png",
  amazon: "./mob-amazon-walk.png",
  wildWarrior: "./mob-wildWarrior-walk.png",
  hunter: "./mob-hunter-walk.png",
  gladiator: "./mob-gladiator-walk.png",
  barbarian: "./mob-barbarian-walk.png",
  raider: "./mob-raider-walk.png",
  warlord: "./mob-warlord-walk.png",
  chieftain: "./mob-chieftain-walk.png",
  snake: "./mob-snake-walk.png",
  skeleton: "./mob-skeleton-walk.png",
  goblin: "./mob-goblin-walk.png",
  ghoul: "./mob-ghoul-walk.png",
  orc: "./mob-orc-walk.png",
  orcWarrior: "./mob-orc-warrior-walk.png",
  orcBerserker: "./mob-orc-berserker-walk.png",
  orcArcher: "./mob-orc-archer-walk.png",
  orcShaman: "./mob-orc-shaman-walk.png",
  minotaur: "./mob-minotaur-walk.png",
  minotaurArcher: "./mob-minotaur-archer-walk.png",
  minotaurGuard: "./mob-minotaur-guard-walk.png",
  minotaurMage: "./mob-minotaur-mage-walk.png",
  goblinLegionary: "./mob-goblin-legionary-walk.png",
  skeletonWarrior: "./mob-skeleton-warrior-walk.png",
  demonSkeleton: "./mob-demon-skeleton-walk.png",
  dragon: "./mob-dragon-walk.png",
  blackKnight: "./mob-black-knight-walk.png",
  "npc:smith": "./npc-smith.png",
  "npc:herbalist": "./npc-herbalist.png",
  "npc:elder": "./npc-elder.png",
  "npc:taskmaster": "./npc-taskmaster.png",
  "npc:tailor": "./npc-tailor.png",
  "npc:timesage": "./npc-timesage.png",
};

type Cut = HTMLCanvasElement[][]; // [row][col]
const sheets: Record<string, Cut | undefined> = {};

/**
 * Bodies left on the ground, keyed by the corpse's `name` — which is the
 * monster kind that dropped it. Anything absent here keeps the generic bone
 * pile, so this is a per-creature opt-in, not a format every monster owes.
 *
 * All four minotaur ranks share ONE body: the plain minotaur. The generator's
 * death frames leave the crossbow, shield and staff lying beside the corpse,
 * which reads as loot you cannot pick up — a promise the loot table does not
 * keep. Stripped of gear the ranks are the same animal anyway.
 *
 * The five orc ranks share the plain orc's body for the same reason, and the
 * saving is larger there: the archer's dropped crossbow alone stretches his
 * death frame to 60px, half again the width of the bare corpse.
 *
 * The three skeletons go further and share the ORIGINAL skeleton's body. That
 * one is not a saving, it is the fiction: strip a skeleton warrior of its
 * helmet and dagger, or a demon skeleton of its wings, and what is left on the
 * ground is the same heap of bones the plain skeleton leaves. Drawing three
 * near-identical piles would have been three downloads to say one thing.
 *
 * The human ladder goes the other way: each rank keeps its own body, because
 * what distinguishes one man of the road from the next IS his clothing. Strip
 * an orc rank of its gear and you still have an orc; strip a beggar of his
 * rags and a cutthroat of his red vest and the two corpses become one anonymous
 * heap, which would make the ladder unreadable on the ground.
 */
const CORPSE_SRC: Record<string, string> = {
  beggar: "./mob-beggar-dead.png",
  vagrant: "./mob-vagrant-dead.png",
  thief: "./mob-thief-dead.png",
  poacher: "./mob-poacher-dead.png",
  bandit: "./mob-bandit-dead.png",
  smuggler: "./mob-smuggler-dead.png",
  cutthroat: "./mob-cutthroat-dead.png",
  deserter: "./mob-deserter-dead.png",
  brigand: "./mob-brigand-dead.png",
  highwayman: "./mob-highwayman-dead.png",
  redcap: "./mob-redcap-dead.png",
  mercenary: "./mob-mercenary-dead.png",
  corsair: "./mob-corsair-dead.png",
  amazon: "./mob-amazon-dead.png",
  wildWarrior: "./mob-wildWarrior-dead.png",
  hunter: "./mob-hunter-dead.png",
  gladiator: "./mob-gladiator-dead.png",
  barbarian: "./mob-barbarian-dead.png",
  raider: "./mob-raider-dead.png",
  warlord: "./mob-warlord-dead.png",
  chieftain: "./mob-chieftain-dead.png",
  snake: "./mob-snake-dead.png",
  skeleton: "./mob-skeleton-dead.png",
  skeletonWarrior: "./mob-skeleton-dead.png",
  demonSkeleton: "./mob-skeleton-dead.png",
  goblin: "./mob-goblin-dead.png",
  goblinLegionary: "./mob-goblin-dead.png",
  ghoul: "./mob-ghoul-dead.png",
  orc: "./mob-orc-dead.png",
  orcWarrior: "./mob-orc-dead.png",
  orcBerserker: "./mob-orc-dead.png",
  orcArcher: "./mob-orc-dead.png",
  orcShaman: "./mob-orc-dead.png",
  minotaur: "./mob-minotaur-dead.png",
  minotaurArcher: "./mob-minotaur-dead.png",
  minotaurGuard: "./mob-minotaur-dead.png",
  minotaurMage: "./mob-minotaur-dead.png",
  dragon: "./mob-dragon-dead.png",
  blackKnight: "./mob-black-knight-dead.png",
};

/** Loaded bodies, keyed by URL — four kinds share one file, one fetch. */
const bodies: Record<string, HTMLCanvasElement | undefined> = {};

/** Slice a loaded sheet into its 4 x 9 grid of frames. */
function slice(img: HTMLImageElement, cols: number): Cut {
  const fw = Math.floor(img.naturalWidth / cols);
  const fh = Math.floor(img.naturalHeight / 4);
  const rows: Cut = [];
  for (let r = 0; r < 4; r++) {
    const row: HTMLCanvasElement[] = [];
    for (let c = 0; c < cols; c++) {
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
    img.onload = () => { sheets[id] = slice(img, colsOf(id)); };
    img.onerror = () => {
      console.warn(`walk sheet for '${id}' failed to load, it will slide instead`);
    };
    img.src = SHEET_SRC[id];
  }
  for (const url of new Set(Object.values(CORPSE_SRC))) {
    if (bodies[url]) continue;
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      const x = cv.getContext("2d")!;
      x.imageSmoothingEnabled = false;
      x.drawImage(img, 0, 0);
      bodies[url] = adoptSprite(cv);
    };
    img.onerror = () => {
      console.warn(`corpse art '${url}' failed to load, the bone pile stands in`);
    };
    img.src = url;
  }
}

/**
 * The body to draw for a corpse, or null when this creature has no art and the
 * caller should fall back to the generic bone pile.
 *
 * `name` is the corpse's own name field — the monster kind for a kill, and
 * "your body" for the player, who is handled by heroSheet instead.
 */
export function corpseSprite(name: string): HTMLCanvasElement | null {
  const url = CORPSE_SRC[name];
  return url ? bodies[url] ?? null : null;
}

/**
 * How long one full walk cycle takes for this creature, in seconds.
 *
 * Exported for the tests, which cannot reach this through `mobFrame`: headless
 * there is no artwork, every sheet is missing and the frame lookup returns
 * null before it ever gets to the timing. The cadence was wrong once and
 * silently — nothing failed, the dragon just looked ridiculous — so it is
 * worth a seam that can actually be asserted on.
 */
export function walkCycleSeconds(kind: string): number {
  return WALK_CYCLE_OVERRIDE[kind] ?? WALK_CYCLE_S;
}

/** True once this creature can be drawn directionally. */
export function hasWalkSheet(kind: MonsterKind): boolean {
  return sheets[kind] !== undefined;
}

/**
 * The frame to draw, or null when there is no sheet for this creature.
 * `moving` picks stride over stance; `phase` is any freely running seconds
 * value — pass a per-creature offset so a pack does not march in lockstep.
 * How much of the cycle a second of `phase` buys is set by WALK_CYCLE_S and
 * its per-creature overrides, not by the sheet's width.
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
  const strides = row.length - 1;
  const fps = strides / (WALK_CYCLE_OVERRIDE[id] ?? WALK_CYCLE_S);
  const step = 1 + (Math.floor(phase * fps) % strides);
  return row[step];
}

/** Facing implied by a grid step. Ties break to the vertical, matching the
 *  player: diagonals read as up/down with a sideways drift. */
export function dirOfStep(sx: number, sy: number): MobDir | null {
  if (sx === 0 && sy === 0) return null;
  if (Math.abs(sy) >= Math.abs(sx)) return sy < 0 ? "up" : "down";
  return sx < 0 ? "left" : "right";
}

/**
 * The facing a creature ends a step in, given where it was already looking.
 *
 * Everything with a full four-view sheet just turns. A side-only creature
 * (see SIDE_ONLY) turns on the horizontal and keeps its facing through a purely
 * vertical step, so it never has to show a view nobody drew.
 */
export function stepFacing(
  kind: MonsterKind, sx: number, sy: number, current: MobDir,
): MobDir {
  if (!SIDE_ONLY.has(kind)) return dirOfStep(sx, sy) ?? current;
  if (sx === 0) return current;
  return sx < 0 ? "left" : "right";
}
