/**
 * Customizable mobile HUD layout — v2 (Etap 12).
 *
 * When unlocked, the player drags HUD groups (vitals bar, the 6 action slots,
 * the panel-button column, the weapon-swap button) around the screen.
 *
 * New in v2:
 *  - SEPARATE layouts per orientation (portrait / landscape). A layout tuned
 *    for a tall phone no longer breaks when the phone rotates.
 *  - A user HUD scale (70–160%) applied to the touch buttons and vitals.
 *  - Snap-to-grid + magnetic screen edges when a drag ends, so hand-arranged
 *    layouts still look tidy.
 *  - The panel-button column can collapse behind a single ≡ menu button.
 *  - Named presets (classic / compact / lefty) as starting points.
 *
 * Positions are stored as normalized fractions so they survive different
 * screen sizes. Persisted separately from the game save (it's a device-local
 * UI preference, shared across characters). v1 layouts migrate automatically
 * into both orientations.
 */
import { clamp } from "../util.ts";

export type HudGroup =
  | "vitals" | "panels" | "swap"
  | "slot0" | "slot1" | "slot2" | "slot3" | "slot4" | "slot5";
export const HUD_GROUPS: readonly HudGroup[] = [
  "vitals", "panels", "swap", "slot0", "slot1", "slot2", "slot3", "slot4", "slot5",
];

export type HudOrient = "portrait" | "landscape";
export type HudPreset = "classic" | "compact" | "lefty";
export const HUD_PRESETS: readonly HudPreset[] = ["classic", "compact", "lefty"];

type PosMap = Record<HudGroup, { x: number; y: number }>;

interface HudLayoutState {
  locked: boolean;
  /** User HUD scale factor for the touch buttons + vitals (0.7 .. 1.6). */
  scale: number;
  /** Panel-button column expanded (true) or collapsed to a ≡ button (false). */
  menuOpen: boolean;
  pos: Record<HudOrient, PosMap>;
}

export const HUD_SCALE_MIN = 0.7;
export const HUD_SCALE_MAX = 1.6;
export const HUD_SCALE_STEP = 0.1;

/** Which orientation a (sw,sh) screen is in. Ties count as landscape. */
export function hudOrient(sw: number, sh: number): HudOrient {
  return sw >= sh ? "landscape" : "portrait";
}

/* ---------------- presets ---------------- */

/** The original fixed layout (identical in both orientations). */
function classicPos(): PosMap {
  const pos = {
    vitals: { x: 0.012, y: 0.83 },
    panels: { x: 0.86, y: 0.48 },
    swap: { x: 0.78, y: 0.72 },
  } as PosMap;
  for (let i = 0; i < 6; i++) pos[`slot${i}` as HudGroup] = { x: 0.15 + i * 0.125, y: 0.88 };
  return pos;
}

/** Everything gathered near the right thumb; menu collapsed. */
function compactPos(o: HudOrient): PosMap {
  if (o === "portrait") {
    const pos = {
      vitals: { x: 0.02, y: 0.1 },
      panels: { x: 0.86, y: 0.28 },
      swap: { x: 0.64, y: 0.87 },
    } as PosMap;
    // 2 columns x 3 rows above the swap button
    const xs = [0.62, 0.81];
    const ys = [0.52, 0.63, 0.74];
    for (let i = 0; i < 6; i++) {
      pos[`slot${i}` as HudGroup] = { x: xs[i % 2], y: ys[Math.floor(i / 2)] };
    }
    return pos;
  }
  const pos = {
    vitals: { x: 0.015, y: 0.06 },
    panels: { x: 0.93, y: 0.16 },
    swap: { x: 0.52, y: 0.78 },
  } as PosMap;
  // 3 columns x 2 rows in the bottom-right corner
  const xs = [0.64, 0.75, 0.86];
  const ys = [0.56, 0.76];
  for (let i = 0; i < 6; i++) {
    pos[`slot${i}` as HudGroup] = { x: xs[i % 3], y: ys[Math.floor(i / 3)] };
  }
  return pos;
}

/** Mirror of compact for left-thumb players. */
function leftyPos(o: HudOrient): PosMap {
  const c = compactPos(o);
  const out = {} as PosMap;
  const slotW = 0.115; // rough normalized slot width used only for mirroring
  for (const g of HUD_GROUPS) {
    const p = c[g];
    out[g] = { x: clamp(1 - p.x - slotW, 0, 1), y: p.y };
  }
  // vitals reads left-to-right — keep it on the left in both variants
  out.vitals = { ...c.vitals };
  return out;
}

function presetPos(name: HudPreset, o: HudOrient): PosMap {
  if (name === "compact") return compactPos(o);
  if (name === "lefty") return leftyPos(o);
  return classicPos();
}

function defaults(): HudLayoutState {
  return {
    locked: true,
    scale: 1,
    menuOpen: true,
    pos: { portrait: classicPos(), landscape: classicPos() },
  };
}

/* ---------------- persistence ---------------- */

const KEY = "bone-isle-hud-v2";
const KEY_V1 = "bone-isle-hud-v1";
const state: HudLayoutState = defaults();

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — ignore */
  }
}

function readPosMap(into: PosMap, data: unknown): void {
  if (!data || typeof data !== "object") return;
  const src = data as Record<string, { x?: unknown; y?: unknown }>;
  for (const g of HUD_GROUPS) {
    const p = src[g];
    if (p && typeof p.x === "number" && typeof p.y === "number") {
      into[g] = { x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) };
    }
  }
  // migrate a pre-per-slot layout: spread the six slots from the old bar anchor
  const legacy = src.actions;
  if (legacy && typeof legacy.x === "number" && typeof legacy.y === "number" && !src.slot0) {
    for (let i = 0; i < 6; i++) {
      into[`slot${i}` as HudGroup] = { x: clamp(legacy.x + i * 0.125, 0, 1), y: clamp(legacy.y, 0, 1) };
    }
  }
}

/** Load saved layout (called once at boot). Missing/corrupt data keeps defaults. */
export function loadHudLayout(): void {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return;
  }
  if (raw) {
    try {
      const data = JSON.parse(raw) as Partial<HudLayoutState>;
      if (typeof data.locked === "boolean") state.locked = data.locked;
      if (typeof data.scale === "number") state.scale = clamp(data.scale, HUD_SCALE_MIN, HUD_SCALE_MAX);
      if (typeof data.menuOpen === "boolean") state.menuOpen = data.menuOpen;
      if (data.pos) {
        readPosMap(state.pos.portrait, (data.pos as Record<string, unknown>).portrait);
        readPosMap(state.pos.landscape, (data.pos as Record<string, unknown>).landscape);
      }
    } catch {
      /* keep defaults */
    }
    return;
  }
  // no v2 data — migrate a v1 layout (single orientation) into both
  let rawV1: string | null = null;
  try {
    rawV1 = localStorage.getItem(KEY_V1);
  } catch {
    return;
  }
  if (!rawV1) return;
  try {
    const data = JSON.parse(rawV1) as { locked?: unknown; pos?: unknown };
    if (typeof data.locked === "boolean") state.locked = data.locked;
    if (data.pos) {
      readPosMap(state.pos.portrait, data.pos);
      readPosMap(state.pos.landscape, data.pos);
    }
    persist(); // write the migrated layout under the v2 key
  } catch {
    /* keep defaults */
  }
}

/* ---------------- lock / scale / menu ---------------- */

export function hudLocked(): boolean {
  return state.locked;
}
export function setHudLocked(v: boolean): void {
  state.locked = v;
  persist();
}
export function toggleHudLock(): void {
  state.locked = !state.locked;
  persist();
}

/** The user's HUD scale factor (applied to touch buttons + vitals). */
export function hudUserScale(): number {
  return state.scale;
}
export function setHudUserScale(v: number): void {
  state.scale = clamp(Math.round(v * 100) / 100, HUD_SCALE_MIN, HUD_SCALE_MAX);
  persist();
}
export function stepHudUserScale(dir: 1 | -1): void {
  setHudUserScale(state.scale + dir * HUD_SCALE_STEP);
}

export function hudMenuOpen(): boolean {
  return state.menuOpen;
}
export function toggleHudMenu(): void {
  state.menuOpen = !state.menuOpen;
  persist();
}

/* ---------------- placement ---------------- */

/** Clamped pixel top-left for a group of size (w,h) on a (sw,sh) screen. */
export function placeHud(id: HudGroup, w: number, h: number, sw: number, sh: number): { x: number; y: number } {
  const p = state.pos[hudOrient(sw, sh)][id];
  const x = clamp(p.x * sw, 0, Math.max(0, sw - w));
  const y = clamp(p.y * sh, 0, Math.max(0, sh - h));
  return { x, y };
}

/** Move a group to a pixel top-left (stored as a fraction). In-memory only. */
export function moveHudGroup(id: HudGroup, xpx: number, ypx: number, sw: number, sh: number): void {
  state.pos[hudOrient(sw, sh)][id] = { x: clamp(xpx / sw, 0, 1), y: clamp(ypx / sh, 0, 1) };
}

/**
 * Tidy a group's position when a drag ends: snap to a pixel grid, and if the
 * group sits near a screen edge, pull it flush against a small margin.
 * `grid`, `edge` and `margin` are device pixels (the caller knows the scale).
 */
export function snapHudGroup(
  id: HudGroup, w: number, h: number, sw: number, sh: number,
  grid: number, edge: number, margin: number,
): void {
  const o = hudOrient(sw, sh);
  const p = state.pos[o][id];
  let x = p.x * sw;
  let y = p.y * sh;
  if (grid > 0) {
    x = Math.round(x / grid) * grid;
    y = Math.round(y / grid) * grid;
  }
  if (x < edge) x = margin;
  else if (x + w > sw - edge) x = sw - w - margin;
  if (y < edge) y = margin;
  else if (y + h > sh - edge) y = sh - h - margin;
  x = clamp(x, 0, Math.max(0, sw - w));
  y = clamp(y, 0, Math.max(0, sh - h));
  state.pos[o][id] = { x: clamp(x / sw, 0, 1), y: clamp(y / sh, 0, 1) };
}

/** Persist the current positions (call once when a drag ends). */
export function saveHudLayout(): void {
  persist();
}

/** Apply a named preset to BOTH orientations (each gets its own variant). */
export function applyHudPreset(name: HudPreset): void {
  state.pos.portrait = presetPos(name, "portrait");
  state.pos.landscape = presetPos(name, "landscape");
  state.menuOpen = name === "classic";
  persist();
}

/** Reset everything back to defaults (keeps the current lock state). */
export function resetHudLayout(): void {
  const d = defaults();
  d.locked = state.locked;
  state.pos = d.pos;
  state.scale = d.scale;
  state.menuOpen = d.menuOpen;
  persist();
}
