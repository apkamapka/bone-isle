/**
 * Per-window UI preferences (Etap 12b): every panel (Equipment, Skills, Bag,
 * Forge, ...) remembers its own user zoom (50–150%) and whether it's rolled
 * up to just its title bar (Tibia-style collapse).
 *
 * Device-local, persisted separately from the game save — the same key space
 * as the HUD layout, shared across characters.
 */
import { clamp } from "../util.ts";
import { DEFAULT_LANG, isLang, type Lang } from "../text/speech.ts";

export const PANEL_ZOOM_MIN = 0.5;
export const PANEL_ZOOM_MAX = 1.5;
export const PANEL_ZOOM_STEP = 0.1;

interface PanelPref {
  zoom: number;
  collapsed: boolean;
  /**
   * Visible rows in a container window, or 0 for "all of them".
   *
   * Tibia lets you drag a container's foot up so it shows fewer rows and
   * stacks more packs in the column. Remembered per panel kind, so the size
   * you chose for your backpack survives closing and reopening it.
   */
  rows: number;
}

const KEY = "bone-isle-panels-v1";
const prefs = new Map<string, PanelPref>();

/**
 * The narration language.
 *
 * It lives HERE, beside the panel zooms, rather than in the save — because it
 * is a property of the person at the keyboard, not of the character. It has to
 * work before a save exists, survive rolling a new character, and mean nothing
 * at all to a server once there is one. What a character has READ is save
 * state; which language they read it in is not.
 */
let chosenLang: Lang = DEFAULT_LANG;
/** Whether the player picked the language themselves (Etap 73). Until they
 * do, it follows the browser's own languages and nothing is written down. */
let langChosen = false;

/**
 * The stored blob is `{ panels, lang }` and USED to be a bare panel map. Both
 * shapes load: an object with no `panels` key is the old one and is read whole
 * as the panel table, so nobody loses their window sizes to this change.
 */
interface PrefFile {
  panels?: Record<string, Partial<PanelPref>>;
  lang?: string;
  langChosen?: boolean;
}

function persist(): void {
  try {
    const obj: Record<string, PanelPref> = {};
    for (const [k, v] of prefs) obj[k] = v;
    localStorage.setItem(KEY, JSON.stringify(langChosen ? { panels: obj, lang: chosenLang, langChosen: true } : { panels: obj }));
  } catch {
    /* storage unavailable — ignore */
  }
}

/** The language narration is read in. */
export function lang(): Lang {
  return chosenLang;
}

export function setLang(next: Lang): void {
  if (next === chosenLang && langChosen) return;
  chosenLang = next;
  langChosen = true;
  persist();
}

/** Load saved panel prefs (called once at boot). Corrupt data keeps defaults. */
/**
 * The first language of ours the browser asks for (Etap 73): any Portuguese
 * reads Brazilian, any Polish Polish, any Spanish Spanish; a browser that asks
 * for none of them gets English.
 */
export function detectLang(tags: readonly string[]): Lang {
  for (const raw of tags) {
    const t = String(raw).toLowerCase();
    if (t.startsWith("pt")) return "pt";
    if (t.startsWith("pl")) return "pl";
    if (t.startsWith("es")) return "es";
    if (t.startsWith("en")) return "en";
  }
  return DEFAULT_LANG;
}

function browserLangs(): readonly string[] {
  try {
    if (typeof navigator === "undefined") return [];
    if (navigator.languages && navigator.languages.length) return navigator.languages;
    return navigator.language ? [navigator.language] : [];
  } catch {
    return [];
  }
}

export function loadPanelPrefs(): void {
  chosenLang = detectLang(browserLangs());
  langChosen = false;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const file = JSON.parse(raw) as PrefFile;
    if (!file || typeof file !== "object") return;
    // A stored language counts as chosen. Blobs from before Etap 73 carry no
    // flag; for them a non-default language can only have been picked.
    if (isLang(file.lang) && (file.langChosen === true || file.lang !== DEFAULT_LANG)) {
      chosenLang = file.lang;
      langChosen = true;
    }
    const data: Record<string, Partial<PanelPref>> = file.panels
      ?? (file as unknown as Record<string, Partial<PanelPref>>);
    for (const [k, v] of Object.entries(data)) {
      if (k === "panels" || k === "lang" || k === "langChosen") continue;
      if (!v || typeof v !== "object") continue;
      prefs.set(k, {
        zoom: typeof v.zoom === "number" ? clamp(v.zoom, PANEL_ZOOM_MIN, PANEL_ZOOM_MAX) : 1,
        collapsed: v.collapsed === true,
        rows: typeof v.rows === "number" && v.rows > 0 ? Math.floor(v.rows) : 0,
      });
    }
  } catch {
    /* keep defaults */
  }
}

function pref(kind: string): PanelPref {
  let p = prefs.get(kind);
  if (!p) {
    p = { zoom: 1, collapsed: false, rows: 0 };
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

/** Visible rows chosen for a container window; 0 means "show them all". */
export function panelRows(kind: string): number {
  return pref(kind).rows;
}

/** Set the visible-row count. Pass 0 to go back to showing every row. */
export function setPanelRows(kind: string, rows: number): void {
  const p = pref(kind);
  const next = Math.max(0, Math.floor(rows));
  if (next === p.rows) return;
  p.rows = next;
  persist();
}

/** Forget every stored zoom / collapse preference. */
export function resetPanelPrefs(): void {
  prefs.clear();
  chosenLang = DEFAULT_LANG;
  langChosen = false;
  persist();
}
