/**
 * Outfits (Etap 10): the player's look, Tibia-style split into an OUTFIT (the
 * pixel map — which character shape you wear) and its COLORS (three dye zones
 * re-tinted at bake time). Colors are freely changeable at the Wardrobe in
 * Bonetown from day one; additional outfit maps arrive later as loot-box
 * unlocks, which is why `owned`/`current` are already saved — when new
 * outfits ship, the save format doesn't move.
 *
 * Module state (like skills/tasks): serialize/load/reset from save.ts/game.ts.
 */
import { PLAYER_MAP, bake } from "../gfx/sprites.ts";
import { ADV_DOWN, ADV_SIDE, ADV_UP } from "../gfx/adventurer.ts";
import { setHeroDyes, type HeroZone } from "../gfx/heroSheet.ts";
import type { Player } from "../entities/player.ts";

/** The four render facings. `left` is `side` mirrored at draw time, so only
 *  three maps are stored. */
export type Facing = "down" | "up" | "side";
export type DirSprites = Readonly<Record<Facing, HTMLCanvasElement>>;

/** The four dye zones. The internal keys stay hair/primary/secondary (+shoes)
 *  so older saves load untouched; they now paint the LPC hero's hair, shirt,
 *  pants and shoes. The `primary`/`secondary` names are historical. */
export type OutfitZone = "hair" | "primary" | "secondary" | "shoes";
const LEGACY_LABELS: Readonly<Record<OutfitZone, string>> = {
  hair: "Hair", primary: "Tunic", secondary: "Legs", shoes: "Shoes",
};
const ADV_LABELS: Readonly<Record<OutfitZone, string>> = {
  hair: "Hood", primary: "Tunic", secondary: "Legs", shoes: "Boots",
};
/** The Wardrobe dyes the LPC hero, so its rows read Hair / Shirt / Pants /
 *  Shoes regardless of the fallback outfit worn headless. */
const HERO_LABELS: Readonly<Record<OutfitZone, string>> = {
  hair: "Hair", primary: "Shirt", secondary: "Pants", shoes: "Shoes",
};

/** Captions for the Wardrobe swatch rows. */
export function zoneLabels(): Readonly<Record<OutfitZone, string>> {
  return HERO_LABELS;
}

/**
 * The dye rack (Etap 14): Tibia's own 133-color outfit palette, generated
 * rather than hand-listed. It is a 19 x 7 grid — 19 hue steps across, and 7
 * rows pairing a saturation with a value. Where hue index 0 lands the
 * saturation falls to zero, which is why the first column comes out as a
 * grayscale ramp from white down to near-black.
 *
 * Reproduced from the formula in OTClient, the open-source client — CipSoft
 * never published theirs, but the output matches the original pixel for pixel.
 * The consequence worth knowing: with saturation locked to a handful of
 * values, the palette has no muted or olive tones. Every hue is either pastel,
 * fully saturated, or dark.
 */
export const HUE_STEPS = 19;
export const SAT_ROWS = 7;

/** [saturation, value] for each of the seven rows. */
const SI_ROWS: ReadonlyArray<readonly [number, number]> = [
  [0.25, 1.0], [0.25, 0.75], [0.5, 0.75], [0.667, 0.75],
  [1.0, 1.0], [1.0, 0.75], [1.0, 0.5],
];

function dyeAt(i: number): string {
  const idx = i >= HUE_STEPS * SAT_ROWS ? 0 : i;
  let hue = 0, sat = 0, val = 0;
  if (idx % HUE_STEPS !== 0) {
    hue = (idx % HUE_STEPS) / 18;
    [sat, val] = SI_ROWS[Math.floor(idx / HUE_STEPS)];
  } else {
    val = 1 - idx / HUE_STEPS / SAT_ROWS; // the grayscale column
  }
  let r = 0, g = 0, b = 0;
  if (val === 0) { r = g = b = 0; }
  else if (sat === 0) { r = g = b = val; }
  else {
    const lo = val * (1 - sat);
    const f = hue * 6;
    if (f < 1) { r = val; b = lo; g = lo + (val - lo) * f; }
    else if (f < 2) { g = val; b = lo; r = g - (val - lo) * (f - 1); }
    else if (f < 3) { g = val; r = lo; b = r + (val - r) * (f - 2); }
    else if (f < 4) { b = val; r = lo; g = b - (val - r) * (f - 3); }
    else if (f < 5) { b = val; g = lo; r = g + (val - g) * (f - 4); }
    else { r = val; g = lo; b = r - (r - g) * (f - 5); }
  }
  const c = (v: number) => Math.floor(v * 255);
  return `#${((c(r) << 16) | (c(g) << 8) | c(b)).toString(16).padStart(6, "0")}`;
}

export const OUTFIT_COLORS: readonly string[] =
  Array.from({ length: HUE_STEPS * SAT_ROWS }, (_, i) => dyeAt(i));

/** Nearest match in the new palette for each entry of the old 19-dye rack,
 *  so pre-Etap-14 saves keep (as close as the palette allows) their look.
 *  The old forest green has no equivalent — the palette holds no muted
 *  greens — so it lands on the nearest gray. */
const LEGACY_REMAP: readonly number[] = [
  116, 75, 95, 114, 19, 41, 60, 58, 115, 55, 71, 51, 69, 48, 65, 62, 95, 57, 19,
];

/** Default look — the silver/gray teen as first shipped. Grayscale-column
 *  palette indices: hair mid gray (#929292), shirt & pants charcoal (#494949),
 *  shoes near-black (#242424). "Classic look" returns here. */
const DEFAULT_DYES = { hair: 57, primary: 95, secondary: 95, shoes: 114 } as const;

/**
 * An outfit is three pixel maps — one per facing. Single-view outfits (the
 * original Classic map) just repeat the same map, so every outfit reads the
 * same way at bake time.
 */
interface OutfitDef {
  name: string;
  frames: Readonly<Record<Facing, readonly string[]>>;
  labels: Readonly<Record<OutfitZone, string>>;
}

function oneView(map: readonly string[]): Readonly<Record<Facing, readonly string[]>> {
  return { down: map, side: map, up: map };
}

export const OUTFITS: Readonly<Record<string, OutfitDef>> = {
  adventurer: {
    name: "Adventurer",
    frames: { down: ADV_DOWN, side: ADV_SIDE, up: ADV_UP },
    labels: ADV_LABELS,
  },
  classic: { name: "Classic", frames: oneView(PLAYER_MAP), labels: LEGACY_LABELS },
};
const DEFAULT_OUTFIT = "adventurer";

/** Persisted shape (a plain snapshot of the module state below). */
export interface OutfitSave {
  /** Palette generation. Absent/older means the pre-Etap-14 19-dye rack, whose
   *  indices are remapped on load. */
  pal?: number;
  hair: number;
  primary: number;
  secondary: number;
  /** Shoe dye (Etap: layered LPC hero). Absent in older saves → default. */
  shoes: number;
  current: string;
  owned: string[];
}

const PALETTE_GEN = 133;

const state: OutfitSave = defaults();

function defaults(): OutfitSave {
  return { ...DEFAULT_DYES, current: DEFAULT_OUTFIT, owned: [DEFAULT_OUTFIT] };
}

/** Read-only view for the Wardrobe panel. */
export function outfitState(): Readonly<OutfitSave> {
  return state;
}

/** Darken a #rrggbb color — the shade glyphs (H, R, P) derive from the base
 *  dye so every color choice keeps the sprite's original shading. */
function darken(hex: string, f = 0.68): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Bake the current outfit + dyes into a fresh set of directional sprites. */
export function bakeOutfitSprites(): DirSprites {
  const o = OUTFITS[state.current] ?? OUTFITS[DEFAULT_OUTFIT];
  const hair = OUTFIT_COLORS[state.hair] ?? OUTFIT_COLORS[0];
  const prim = OUTFIT_COLORS[state.primary] ?? OUTFIT_COLORS[1];
  const sec = OUTFIT_COLORS[state.secondary] ?? OUTFIT_COLORS[2];
  const over = {
    h: hair, H: darken(hair),
    r: prim, R: darken(prim),
    p: sec, P: darken(sec),
  };
  return {
    down: bake(o.frames.down, over),
    side: bake(o.frames.side, over),
    up: bake(o.frames.up, over),
  };
}

/** Legacy single-sprite entry point — the front view. */
export function bakeOutfitSprite(): HTMLCanvasElement {
  return bakeOutfitSprites().down;
}

/** The four Wardrobe dyes as hex, mapped to the LPC hero's layer zones. */
function heroDyeColors(): Record<HeroZone, string> {
  const at = (i: number, fb: string) => OUTFIT_COLORS[i] ?? fb;
  return {
    hair: at(state.hair, "#929292"),
    shirt: at(state.primary, "#494949"),
    pants: at(state.secondary, "#494949"),
    shoes: at(state.shoes, "#242424"),
  };
}

/** Re-bake and hand the player their current look. Call after any change.
 *  Drives both the LPC hero (the tinted layers) and the baked Adventurer
 *  fallback, so a dye change shows up whichever one is on screen. */
export function applyOutfit(p: Player): void {
  const set = bakeOutfitSprites();
  p.sprDir = set;
  p.spr = set.down; // keep the generic walker field in sync (shadows, corpses)
  setHeroDyes(heroDyeColors());
}

/** Pick a dye for one zone (Wardrobe swatch click). */
export function setOutfitColor(p: Player, zone: OutfitZone, idx: number): void {
  if (idx < 0 || idx >= OUTFIT_COLORS.length) return;
  state[zone] = idx;
  applyOutfit(p);
}

/** Back to the classic look (colors only — owned outfits are never lost). */
export function resetOutfitColors(p: Player): void {
  state.hair = DEFAULT_DYES.hair;
  state.primary = DEFAULT_DYES.primary;
  state.secondary = DEFAULT_DYES.secondary;
  state.shoes = DEFAULT_DYES.shoes;
  applyOutfit(p);
}

/** New game: module state must not leak a previous character's wardrobe. */
export function resetOutfit(): void {
  Object.assign(state, defaults());
}

/** Snapshot for the save file. */
export function outfitSave(): OutfitSave {
  return { ...state, pal: PALETTE_GEN, owned: [...state.owned] };
}

/** Restore from a save — every field validated, absent/corrupt → defaults,
 *  so pre-wardrobe saves load with the classic look untouched. */
export function loadOutfitSave(data: unknown): void {
  Object.assign(state, defaults());
  if (!data || typeof data !== "object") return;
  const d = data as Partial<OutfitSave>;
  // Pre-Etap-14 saves indexed the old 19-dye rack; translate before validating.
  const legacy = d.pal !== PALETTE_GEN;
  const idx = (v: unknown, fb: number): number => {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0) return fb;
    const n = legacy ? LEGACY_REMAP[v] : v;
    return n !== undefined && n < OUTFIT_COLORS.length ? n : fb;
  };
  state.pal = PALETTE_GEN;
  state.hair = idx(d.hair, DEFAULT_DYES.hair);
  state.primary = idx(d.primary, DEFAULT_DYES.primary);
  state.secondary = idx(d.secondary, DEFAULT_DYES.secondary);
  state.shoes = idx(d.shoes, DEFAULT_DYES.shoes);
  if (Array.isArray(d.owned)) {
    const owned = d.owned.filter((o): o is string => typeof o === "string" && o in OUTFITS);
    if (!owned.includes(DEFAULT_OUTFIT)) owned.unshift(DEFAULT_OUTFIT);
    state.owned = owned;
  }
  state.current = typeof d.current === "string" && d.current in OUTFITS && state.owned.includes(d.current)
    ? d.current
    : DEFAULT_OUTFIT;
}
