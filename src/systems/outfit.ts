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
import { ADV_PALETTE, ADV_ZONES, ADV_CHARS, ADV_DOWN, ADV_SIDE, ADV_UP } from "../gfx/adventurer.ts";
import type { Player } from "../entities/player.ts";

/** The four render facings. `left` is `side` mirrored at draw time, so only
 *  three maps are stored. */
export type Facing = "down" | "up" | "side";
export type DirSprites = Readonly<Record<Facing, HTMLCanvasElement>>;

/** The three dye zones and the player-map glyphs each one re-tints. */
export type OutfitZone = "hair" | "primary" | "secondary";
/** Zone captions are per-outfit: the classic map dyes hair/tunic/legs, while
 *  the Adventurer's hood hides the hair entirely, so its third zone paints the
 *  boots instead. The save format is untouched — only the captions differ. */
const LEGACY_LABELS: Readonly<Record<OutfitZone, string>> = {
  hair: "Hair", primary: "Tunic", secondary: "Legs",
};
const ADV_LABELS: Readonly<Record<OutfitZone, string>> = {
  hair: "Boots", primary: "Cloak", secondary: "Tunic",
};

/** Captions for the Wardrobe swatch rows, for whichever outfit is worn. */
export function zoneLabels(): Readonly<Record<OutfitZone, string>> {
  return OUTFITS[state.current]?.labels ?? LEGACY_LABELS;
}

/**
 * The dye rack: a curated 19-color palette (one Tibia outfit-picker row's
 * worth). The first three entries are the classic default look — brown hair,
 * red tunic, forest legs — so index 0/1/2 reproduce the original sprite.
 */
export const OUTFIT_COLORS: readonly string[] = [
  "#6e4a2a", // 0 brown (default hair)
  "#a8432f", // 1 rust red (default tunic)
  "#46604a", // 2 forest (default legs)
  "#2b2017", // 3 near-black
  "#efe9d6", // 4 bone white
  "#d8b75a", // 5 straw
  "#e3b341", // 6 gold
  "#c96a1e", // 7 orange
  "#7d2f20", // 8 dried blood
  "#e06a8a", // 9 rose
  "#8a4a9e", // 10 plum
  "#8a6cff", // 11 violet
  "#3a4fae", // 12 deep blue
  "#5aa1e8", // 13 sky
  "#3d8a86", // 14 teal
  "#6f9c3f", // 15 leaf
  "#33483a", // 16 pine
  "#8a989e", // 17 steel
  "#cfd8da", // 18 silver
];

/** Outfit maps by id. Only the starter for now; loot-box outfits append here
 *  and old saves keep working (unknown ids fall back to the starter). */
/**
 * An outfit is either `glyph` (the original hand-written maps, whose glyphs
 * carry their own meaning) or `indexed` (generated from artwork: one char per
 * pixel into a palette, with a dye zone declared per palette entry).
 */
interface GlyphOutfit {
  kind: "glyph";
  name: string;
  map: readonly string[];
  labels: Readonly<Record<OutfitZone, string>>;
}
interface IndexedOutfit {
  kind: "indexed";
  name: string;
  chars: string;
  palette: readonly string[];
  zones: ReadonlyArray<OutfitZone | null>;
  frames: Readonly<Record<Facing, readonly string[]>>;
  labels: Readonly<Record<OutfitZone, string>>;
}
type OutfitDef = GlyphOutfit | IndexedOutfit;

export const OUTFITS: Readonly<Record<string, OutfitDef>> = {
  adventurer: {
    kind: "indexed",
    name: "Adventurer",
    chars: ADV_CHARS,
    palette: ADV_PALETTE,
    zones: ADV_ZONES,
    frames: { down: ADV_DOWN, side: ADV_SIDE, up: ADV_UP },
    labels: ADV_LABELS,
  },
  classic: { kind: "glyph", name: "Classic", map: PLAYER_MAP, labels: LEGACY_LABELS },
};
const DEFAULT_OUTFIT = "adventurer";

/** Persisted shape (a plain snapshot of the module state below). */
export interface OutfitSave {
  hair: number;
  primary: number;
  secondary: number;
  current: string;
  owned: string[];
}

const state: OutfitSave = defaults();

function defaults(): OutfitSave {
  return { hair: 0, primary: 1, secondary: 2, current: DEFAULT_OUTFIT, owned: [DEFAULT_OUTFIT] };
}

/** Read-only view for the Wardrobe panel. */
export function outfitState(): Readonly<OutfitSave> {
  return state;
}

/** #rrggbb -> [r,g,b] 0..1 */
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return `#${((c(r) << 16) | (c(g) << 8) | c(b)).toString(16).padStart(6, "0")}`;
}

function toHsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [(h / 6 + 1) % 1, mx === 0 ? 0 : d / mx, mx];
}

function fromHsv(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

/**
 * Re-tint one artwork color to a dye. Flat replacement would flatten the
 * sprite, so the source pixel's own value/saturation is folded into the
 * result: light shades stay light, shadows stay shadows, only the hue moves.
 */
function tint(base: string, dye: string): string {
  const [, bs, bv] = toHsv(...rgb(base));
  const [dh, ds, dv] = toHsv(...rgb(dye));
  const v = Math.min(1, bv * (0.45 + dv * 0.75));
  const sat = Math.min(1, ds * (0.55 + bs * 0.7));
  return toHex(...fromHsv(dh, sat, v));
}

/** Darken a #rrggbb color — the glyph outfits' shaded glyphs (R, P) derive
 *  from the base dye so every choice keeps the sprite's original shading. */
function darkenHex(hex: string, f = 0.68): string {
  const [r, g, b] = rgb(hex);
  return toHex(r * f, g * f, b * f);
}

/** Build the char -> color override for an indexed outfit at the current dyes. */
function indexedOverride(o: Extract<OutfitDef, { kind: "indexed" }>): Record<string, string> {
  const dye: Record<OutfitZone, string> = {
    hair: OUTFIT_COLORS[state.hair] ?? OUTFIT_COLORS[0],
    primary: OUTFIT_COLORS[state.primary] ?? OUTFIT_COLORS[1],
    secondary: OUTFIT_COLORS[state.secondary] ?? OUTFIT_COLORS[2],
  };
  const over: Record<string, string> = {};
  for (let i = 0; i < o.palette.length; i++) {
    const zone = o.zones[i];
    const base = o.palette[i];
    over[o.chars[i]] = zone ? tint(base, dye[zone]) : base;
  }
  return over;
}

/** Bake the current outfit + dyes into a fresh set of directional sprites. */
export function bakeOutfitSprites(): DirSprites {
  const o = OUTFITS[state.current] ?? OUTFITS[DEFAULT_OUTFIT];
  if (o.kind === "indexed") {
    const over = indexedOverride(o);
    return {
      down: bake(o.frames.down, over),
      side: bake(o.frames.side, over),
      up: bake(o.frames.up, over),
    };
  }
  const prim = OUTFIT_COLORS[state.primary] ?? OUTFIT_COLORS[1];
  const sec = OUTFIT_COLORS[state.secondary] ?? OUTFIT_COLORS[2];
  const one = bake(o.map, {
    h: OUTFIT_COLORS[state.hair] ?? OUTFIT_COLORS[0],
    r: prim, R: darkenHex(prim), p: sec, P: darkenHex(sec),
  });
  // Glyph outfits are single-view: every facing draws the same map.
  return { down: one, side: one, up: one };
}

/** Legacy single-sprite entry point — the front view. */
export function bakeOutfitSprite(): HTMLCanvasElement {
  return bakeOutfitSprites().down;
}

/** Re-bake and hand the player their current look. Call after any change. */
export function applyOutfit(p: Player): void {
  const set = bakeOutfitSprites();
  p.sprDir = set;
  p.spr = set.down; // keep the generic walker field in sync (shadows, corpses)
}

/** Pick a dye for one zone (Wardrobe swatch click). */
export function setOutfitColor(p: Player, zone: OutfitZone, idx: number): void {
  if (idx < 0 || idx >= OUTFIT_COLORS.length) return;
  state[zone] = idx;
  applyOutfit(p);
}

/** Back to the classic look (colors only — owned outfits are never lost). */
export function resetOutfitColors(p: Player): void {
  state.hair = 0;
  state.primary = 1;
  state.secondary = 2;
  applyOutfit(p);
}

/** New game: module state must not leak a previous character's wardrobe. */
export function resetOutfit(): void {
  Object.assign(state, defaults());
}

/** Snapshot for the save file. */
export function outfitSave(): OutfitSave {
  return { ...state, owned: [...state.owned] };
}

/** Restore from a save — every field validated, absent/corrupt → defaults,
 *  so pre-wardrobe saves load with the classic look untouched. */
export function loadOutfitSave(data: unknown): void {
  Object.assign(state, defaults());
  if (!data || typeof data !== "object") return;
  const d = data as Partial<OutfitSave>;
  const idx = (v: unknown, fb: number): number =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v < OUTFIT_COLORS.length ? v : fb;
  state.hair = idx(d.hair, 0);
  state.primary = idx(d.primary, 1);
  state.secondary = idx(d.secondary, 2);
  if (Array.isArray(d.owned)) {
    const owned = d.owned.filter((o): o is string => typeof o === "string" && o in OUTFITS);
    if (!owned.includes(DEFAULT_OUTFIT)) owned.unshift(DEFAULT_OUTFIT);
    state.owned = owned;
  }
  state.current = typeof d.current === "string" && d.current in OUTFITS && state.owned.includes(d.current)
    ? d.current
    : DEFAULT_OUTFIT;
}
