/**
 * Outfits (Etap 10): the player's look, Tibia-style split into an OUTFIT (the
 * pixel map — which character shape you wear) and its COLORS (three dye zones
 * re-tinted at bake time). Colors are freely changeable at the Wardrobe in
 * Bonetown from day one. More outfits come from Grizelda's shelf (Etap 92:
 * the Ranger), and `owned`/`current` were saved from the start, so the save
 * format did not move when the first one shipped.
 *
 * Module state (like skills/tasks): serialize/load/reset from save.ts/game.ts.
 */
import { active as activeState } from "./playerState.ts";

/** The four render facings. `left` is `side` mirrored at draw time, so only
 *  three maps are stored. */
export type Facing = "down" | "up" | "side";

/** The LPC clothes an outfit is drawn in: the NAME of a layer set the client
 *  loads (gfx/heroSheet.ts). Defined here since Etap 3.1b, with the outfits. */
export type HeroLook = "adventurer" | "ranger";

/** The baked pixel maps an outfit falls back to when the LPC hero is not
 *  loaded: the NAME of a map set the client keeps (gfx/outfitArt.ts). */
export type OutfitFrames = "adventurer" | "classic";

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
/** The Ranger's rows (Etap 92): the hood carries the strands under it, and the
 *  last row dyes the shoes, the gloves and the sash together. */
const RANGER_LABELS: Readonly<Record<OutfitZone, string>> = {
  hair: "Hood", primary: "Cardigan", secondary: "Pants", shoes: "Details",
};

/** Captions for the Wardrobe swatch rows. */
export function zoneLabels(): Readonly<Record<OutfitZone, string>> {
  return OUTFITS[state.current]?.lpc?.labels ?? HERO_LABELS;
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
 * An outfit names its pictures and holds none (Etap 3.1b): `frames` is the set
 * of baked maps it falls back to — three for the Adventurer, one repeated for
 * the original Classic — and `lpc` the LPC clothes it is really drawn in. The
 * client turns both names into pictures (gfx/outfitArt.ts).
 */
interface OutfitDef {
  name: string;
  frames: OutfitFrames;
  labels: Readonly<Record<OutfitZone, string>>;
  /** LPC clothes of its own (Etap 92): the hero's layer set and the Wardrobe's
   *  captions for it. Absent means the Adventurer's clothes. */
  lpc?: { look: HeroLook; labels: Readonly<Record<OutfitZone, string>> };
}

export const OUTFITS: Readonly<Record<string, OutfitDef>> = {
  adventurer: {
    name: "Adventurer",
    frames: "adventurer",
    labels: ADV_LABELS,
  },
  classic: { name: "Classic", frames: "classic", labels: LEGACY_LABELS },
  /* The first outfit with LPC clothes of its own, bought at Grizelda's shelf
   * (Etap 92). Headless, or if its sheets fail, it falls back to the
   * Adventurer's baked maps like everything else. */
  ranger: {
    name: "Ranger",
    frames: "adventurer",
    labels: RANGER_LABELS,
    lpc: { look: "ranger", labels: RANGER_LABELS },
  },
};
export const DEFAULT_OUTFIT = "adventurer";

/** What the Wardrobe lets a character switch between, in order, of what he
 *  owns. "classic" is a fallback map with no LPC clothes of its own, so on
 *  screen it IS the Adventurer: it still loads, but it is not offered. */
export const WARDROBE_OUTFITS: readonly string[] = ["adventurer", "ranger"];

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

/** This character's wardrobe. A live view onto PlayerState — see
 *  playerState.ts for why none of this is a module `let` any more. */
const state: OutfitSave = Object.freeze({
  get pal() { return activeState().outfit.pal; },
  set pal(v: number | undefined) { activeState().outfit.pal = v; },
  get hair() { return activeState().outfit.hair; },
  set hair(v: number) { activeState().outfit.hair = v; },
  get primary() { return activeState().outfit.primary; },
  set primary(v: number) { activeState().outfit.primary = v; },
  get secondary() { return activeState().outfit.secondary; },
  set secondary(v: number) { activeState().outfit.secondary = v; },
  get shoes() { return activeState().outfit.shoes; },
  set shoes(v: number) { activeState().outfit.shoes = v; },
  get current() { return activeState().outfit.current; },
  set current(v: string) { activeState().outfit.current = v; },
  get owned() { return activeState().outfit.owned; },
  set owned(v: string[]) { activeState().outfit.owned = v; },
}) as OutfitSave;

function defaults(): OutfitSave {
  return { ...DEFAULT_DYES, current: DEFAULT_OUTFIT, owned: [DEFAULT_OUTFIT] };
}

/** Read-only view for the Wardrobe panel. */
export function outfitState(): Readonly<OutfitSave> {
  return state;
}

/* Changing the look changes STATE and nothing else. The character used to be
 * handed freshly baked sprites here (`applyOutfit`); since Etap 3.1b the client
 * notices the change and redraws (gfx/outfitArt.ts `syncOutfitArt`), so none of
 * these needs to know which character's picture is on screen. */

/** Pick a dye for one zone (Wardrobe swatch click). */
export function setOutfitColor(zone: OutfitZone, idx: number): void {
  if (idx < 0 || idx >= OUTFIT_COLORS.length) return;
  state[zone] = idx;
}

/** Back to the classic look (colors only — owned outfits are never lost). */
export function resetOutfitColors(): void {
  state.hair = DEFAULT_DYES.hair;
  state.primary = DEFAULT_DYES.primary;
  state.secondary = DEFAULT_DYES.secondary;
  state.shoes = DEFAULT_DYES.shoes;
}

/** New game: module state must not leak a previous character's wardrobe. */
export function resetOutfit(): void {
  Object.assign(state, defaults());
}

/** The LPC clothes an outfit is drawn in. */
export function heroLookOf(id: string): HeroLook {
  return OUTFITS[id]?.lpc?.look ?? "adventurer";
}

export function ownsOutfit(id: string): boolean {
  return state.owned.includes(id);
}

/** Add an outfit to the wardrobe (Grizelda's shelf). Owning is for good. */
export function grantOutfit(id: string): boolean {
  if (!(id in OUTFITS) || state.owned.includes(id)) return false;
  state.owned = [...state.owned, id];
  return true;
}

/** The outfits the Wardrobe lets this character switch between. */
export function wardrobeOutfits(): string[] {
  return WARDROBE_OUTFITS.filter((o) => state.owned.includes(o));
}

/** Put on another owned outfit. The dyes stay: they are the character's, not
 *  the outfit's, as in Tibia. */
export function wearOutfit(id: string): boolean {
  if (!(id in OUTFITS) || !state.owned.includes(id) || state.current === id) return false;
  state.current = id;
  return true;
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
