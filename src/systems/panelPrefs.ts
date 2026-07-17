/**
 * Per-window UI preferences (Etap 12b): every panel (Equipment, Skills, Bag,
 * Forge, ...) remembers its own user zoom (50–150%) and whether it's rolled
 * up to just its title bar (Tibia-style collapse).
 *
 * Device-local, persisted separately from the game save — the same key space
 * as the HUD layout, shared across characters.
 */
import { clamp } from "../util.ts";

export const PANEL_ZOOM_MIN = 0.5;
export const PANEL_ZOOM_MAX = 1.5;
export const PANEL_ZOOM_STEP = 0.1;

interface PanelPref {
  zoom: number;
  collapsed: boolean;
}

const KEY = "bone-isle-panels-v1";
const prefs = new Map<string, PanelPref>();

function persist(): void {
  try {
    const obj: Record<string, PanelPref> = {};
    for (const [k, v] of prefs) obj[k] = v;
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Load saved panel prefs (called once at boot). Corrupt data keeps defaults. */
export function loadPanelPrefs(): void {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const data = JSON.parse(raw) as Record<string, Partial<PanelPref>>;
    if (!data || typeof data !== "object") return;
    for (const [k, v] of Object.entries(data)) {
      if (!v || typeof v !== "object") continue;
      prefs.set(k, {
        zoom: typeof v.zoom === "number" ? clamp(v.zoom, PANEL_ZOOM_MIN, PANEL_ZOOM_MAX) : 1,
        collapsed: v.collapsed === true,
      });
    }
  } catch {
    /* keep defaults */
  }
}

function pref(kind: string): PanelPref {
  let p = prefs.get(kind);
  if (!p) {
    p = { zoom: 1, collapsed: false };
    prefs.set(kind, p);
  }
  return p;
}

/** The user zoom factor for one panel kind (1 = default size). */
export function panelZoom(kind: string): number {
  return pref(kind).zoom;
}

export function stepPanelZoom(kind: string, dir: 1 | -1): void {
  const p = pref(kind);
  p.zoom = clamp(Math.round((p.zoom + dir * PANEL_ZOOM_STEP) * 100) / 100, PANEL_ZOOM_MIN, PANEL_ZOOM_MAX);
  persist();
}

/** True when the panel is rolled up to just its title bar. */
export function panelCollapsed(kind: string): boolean {
  return pref(kind).collapsed;
}

export function togglePanelCollapsed(kind: string): void {
  const p = pref(kind);
  p.collapsed = !p.collapsed;
  persist();
}

/** Forget every stored zoom / collapse preference. */
export function resetPanelPrefs(): void {
  prefs.clear();
  persist();
}
