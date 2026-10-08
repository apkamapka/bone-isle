/**
 * Prop artwork loaded from PNGs (Etap 3.1b moved the loading here from
 * world/propArt.ts, which still names the files).
 *
 * When the drawn artwork arrives it replaces the baked tree, rock, stump and
 * rubble everywhere at once. Nothing on a world points at a picture, so there
 * is nothing to sweep: `treeSprite()` and `propSprite()` hand out whatever is
 * loaded at the moment they are asked.
 *
 * Loading is asynchronous and failure is harmless: the baked sprites stay put,
 * which is also what the headless smoke tests exercise (no `Image`, no
 * `document`, so this whole module no-ops).
 */
import { adoptSprite, setTreeArt, setPropArt } from "./sprites.ts";
import { setMobArt } from "./mobArt.ts";
import { PROP_SRC, MOB_SRC, type PropKey } from "../world/propArt.ts";
import type { MonsterKind } from "../world/types.ts";

const PROP_KEYS = Object.keys(PROP_SRC) as PropKey[];

let started = false;

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

/** Load creature artwork; each kind lands independently of the others. */
function loadMobArt(): void {
  for (const kind of Object.keys(MOB_SRC) as MonsterKind[]) {
    const img = new Image();
    img.onload = () => {
      setMobArt(kind, adoptSprite(toCanvas(img)));
    };
    img.onerror = () => {
      console.warn(`creature '${kind}' failed to load, keeping the baked sprite`);
    };
    img.src = MOB_SRC[kind]!;
  }
}

/** Kick off prop loading once. Safe to call again; a no-op headless. */
export function loadPropArt(): void {
  if (typeof Image === "undefined" || typeof document === "undefined") return;
  if (started) return;
  started = true;
  loadMobArt();
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
      setTreeArt(got.tree!);
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
