/**
 * Prop artwork loaded from PNGs.
 *
 * Trees, rocks, stumps and rubble ship as procedurally baked pixel art so the
 * game runs with no assets at all. When the drawn artwork is available it
 * replaces those four sprites everywhere — every island, not just the hub —
 * by writing into the shared `SPR` table and handing the tree canvas to
 * `bakeTree()`, so anything built afterwards picks it up for free.
 *
 * Worlds built BEFORE the images land already hold their own tree canvases,
 * so those get swept once the load completes.
 *
 * Loading is asynchronous and failure is harmless: the baked sprites stay put,
 * which is also what the headless smoke tests exercise (no `Image`, no
 * `document`, so this whole module no-ops).
 *
 * Artwork is authored at WORLD scale — 2x the legacy 16-px art, i.e. TILE px
 * per tile — anchored bottom-centre to match `drawSprite()`, with its own drop
 * shadow already painted in.
 */
import { adoptSprite, setTreeArt, setPropArt } from "../gfx/sprites.ts";
import { setMobArt, mobSprite } from "../entities/monsters.ts";
import type { MonsterKind } from "./types.ts";
import type { World, WorldKey } from "./types.ts";

type PropKey = "tree" | "rock" | "stump" | "rubble";

const PROP_SRC: Record<PropKey, string> = {
  tree: "./prop-tree.png",
  rock: "./prop-rock.png",
  stump: "./prop-stump.png",
  rubble: "./prop-rubble.png",
};

const PROP_KEYS = Object.keys(PROP_SRC) as PropKey[];

/** Creature artwork. Cut from an LPC sheet, so already at actor scale. */
const MOB_SRC: Partial<Record<MonsterKind, string>> = {
  bandit: "./mob-bandit.png",
};

let loaded = false;
let treeCanvas: HTMLCanvasElement | null = null;

/** Copy a loaded image into the canvas shape the renderer draws. */
function toCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  x.drawImage(img, 0, 0);
  return adoptSprite(c);
}

/** Repoint creatures already alive at the artwork their kind now uses. */
function sweepMobs(worlds: Record<WorldKey, World>): void {
  for (const key of Object.keys(worlds) as WorldKey[]) {
    for (const m of worlds[key].monsters) m.spr = mobSprite(m.kind);
  }
}

/** Load creature artwork; each kind lands independently of the others. */
function loadMobArt(worlds: Record<WorldKey, World>): void {
  for (const kind of Object.keys(MOB_SRC) as MonsterKind[]) {
    const img = new Image();
    img.onload = () => {
      setMobArt(kind, adoptSprite(toCanvas(img)));
      sweepMobs(worlds);
    };
    img.onerror = () => {
      console.warn(`creature '${kind}' failed to load, keeping the baked sprite`);
    };
    img.src = MOB_SRC[kind]!;
  }
}

/** Point every existing tree at the loaded artwork (worlds built earlier). */
function sweep(worlds: Record<WorldKey, World>, art: HTMLCanvasElement): void {
  for (const key of Object.keys(worlds) as WorldKey[]) {
    for (const t of worlds[key].trees) t.spr = art;
  }
}

/**
 * Kick off prop loading. Safe to call repeatedly — a second call after the
 * artwork has arrived just re-sweeps the freshly built worlds (which happens
 * on every save load), and it is a no-op headless.
 */
export function loadPropArt(worlds: Record<WorldKey, World>): void {
  if (typeof Image === "undefined" || typeof document === "undefined") return;
  loadMobArt(worlds);
  if (loaded && treeCanvas) {
    sweep(worlds, treeCanvas);
    return;
  }
  const got: Partial<Record<PropKey, HTMLCanvasElement>> = {};
  let left = PROP_KEYS.length;
  let failed = false;
  for (const k of PROP_KEYS) {
    const img = new Image();
    img.onload = () => {
      got[k] = toCanvas(img);
      if (--left > 0 || failed) return;
      // Publish the whole set at once: a half-swapped world would draw a new
      // rock beside an old stump for a frame or two.
      setPropArt("rock", got.rock!);
      setPropArt("stump", got.stump!);
      setPropArt("rubble", got.rubble!);
      treeCanvas = got.tree!;
      setTreeArt(treeCanvas);
      sweep(worlds, treeCanvas);
      loaded = true;
    };
    img.onerror = () => {
      if (!failed) {
        failed = true;
        console.warn(`prop '${k}' failed to load, keeping the baked sprites`);
      }
    };
    img.src = PROP_SRC[k];
  }
}
