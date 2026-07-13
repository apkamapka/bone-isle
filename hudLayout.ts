/**
 * Customizable mobile HUD layout. When unlocked, the player drags HUD groups
 * (vitals bar, the 6 action slots, the panel-button column, the weapon-swap
 * button) around the screen; positions are stored as normalized fractions so
 * they survive rotation and different screen sizes. Persisted separately from
 * the game save (it's a device-local UI preference, shared across characters).
 */
import { clamp } from "../util.ts";

export type HudGroup =
  | "vitals" | "panels" | "swap"
  | "slot0" | "slot1" | "slot2" | "slot3" | "slot4" | "slot5";
export const HUD_GROUPS: readonly HudGroup[] = [
  "vitals", "panels", "swap", "slot0", "slot1", "slot2", "slot3", "slot4", "slot5",
];

interface HudLayoutState {
  locked: boolean;
  pos: Record<HudGroup, { x: number; y: number }>; // normalized top-left (0..1)
}

/** Sensible defaults roughly matching the original fixed layout. */
function defaults(): HudLayoutState {
  const pos = {
    vitals: { x: 0.012, y: 0.83 },
    panels: { x: 0.85, y: 0.13 },
    swap: { x: 0.78, y: 0.72 },
  } as HudLayoutState["pos"];
  // the six action slots default to a bottom row (each is independently movable)
  for (let i = 0; i < 6; i++) pos[`slot${i}` as HudGroup] = { x: 0.15 + i * 0.125, y: 0.88 };
  return { locked: true, pos };
}

const KEY = "bone-isle-hud-v1";
const state: HudLayoutState = defaults();

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — ignore */
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
  if (!raw) return;
  try {
    const data = JSON.parse(raw) as Partial<HudLayoutState>;
    if (typeof data.locked === "boolean") state.locked = data.locked;
    if (data.pos) {
      for (const g of HUD_GROUPS) {
        const p = data.pos[g];
        if (p && typeof p.x === "number" && typeof p.y === "number") {
          state.pos[g] = { x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) };
        }
      }
      // migrate a pre-per-slot layout: spread the six slots from the old bar anchor
      const legacy = (data.pos as Record<string, { x: number; y: number }>).actions;
      const hasSlots = (data.pos as Record<string, unknown>).slot0;
      if (legacy && !hasSlots) {
        for (let i = 0; i < 6; i++) {
          state.pos[`slot${i}` as HudGroup] = { x: clamp(legacy.x + i * 0.125, 0, 1), y: clamp(legacy.y, 0, 1) };
        }
      }
    }
  } catch {
    /* keep defaults */
  }
}

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

/** Clamped pixel top-left for a group of size (w,h) on a (sw,sh) screen. */
export function placeHud(id: HudGroup, w: number, h: number, sw: number, sh: number): { x: number; y: number } {
  const p = state.pos[id];
  const x = clamp(p.x * sw, 0, Math.max(0, sw - w));
  const y = clamp(p.y * sh, 0, Math.max(0, sh - h));
  return { x, y };
}

/** Move a group to a pixel top-left (stored as a fraction). In-memory only. */
export function moveHudGroup(id: HudGroup, xpx: number, ypx: number, sw: number, sh: number): void {
  state.pos[id] = { x: clamp(xpx / sw, 0, 1), y: clamp(ypx / sh, 0, 1) };
}

/** Persist the current positions (call once when a drag ends). */
export function saveHudLayout(): void {
  persist();
}

/** Reset every group back to its default position. */
export function resetHudLayout(): void {
  const d = defaults();
  d.locked = state.locked; // keep the current lock state
  state.pos = d.pos;
  persist();
}
