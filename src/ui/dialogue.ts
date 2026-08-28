/**
 * The dialogue box: one modal panel that speech and chronicle both run through.
 *
 * ---------------------------------------------------------------------------
 * WHY IT EXISTS
 *
 * Chronos used to talk through `flash`, which is a LINE — the log cuts it to
 * the width available and ellipsises the rest, so every sentence he had was
 * written to a hard ceiling of about fifty characters and measured against a
 * phone in portrait. That ceiling is the reason his first mission handover was
 * three clipped fragments instead of a paragraph, and it is not a ceiling any
 * folk history can be told under.
 *
 * So the long text moved here and the log keeps the record: one short line
 * saying a conversation happened, plus the mission's objective. The box owns
 * the prose; the log owns the history of the session.
 *
 * ---------------------------------------------------------------------------
 * PAGINATION IS DONE AT DRAW TIME, NEVER BY HAND
 *
 * The text arrives as paragraphs and is wrapped and cut into pages against the
 * width the box actually has on THIS screen, in the language currently
 * selected. Hand-cut pages would fit exactly one of those three variables.
 * Polish runs about 15% longer than English and Spanish about 25%, so a page
 * that sits neatly inside the frame in English overflows it in Spanish, and a
 * page cut for a desktop window is three pages on a phone.
 *
 * A blank line in the source is a FORCED page break — the one piece of layout
 * the writer keeps, because it is a pause in the speech rather than a fact
 * about the screen.
 *
 * ---------------------------------------------------------------------------
 * MODAL, AND ORDERED BY HAND
 *
 * While a box is up the world takes no input: no walking, no portal, no deck
 * button. That is enforced at the call sites in main.ts rather than by drawing
 * a backdrop hotspot, because the thumb deck is drawn AFTER the panels and its
 * hotspots would therefore be tested first. `dialogueTap` is called ahead of
 * the whole hotspot sweep, exactly the way the context menu is, and it eats
 * every press it is given.
 */
import { CHROME, popupFrame, buttonBox, sunkenBox, bevelPx } from "./chrome.ts";
import { hudText, type HudCtx } from "./hud.ts";
import { npcFrame } from "../gfx/mobSheet.ts";
import { SPR } from "../gfx/sprites.ts";
import { LANGS, t, type Lang } from "../text/speech.ts";
import { lang, setLang } from "../systems/panelPrefs.ts";

/** One answer the player can pick. Shown only on the last page. */
export interface DialogueChoice {
  /** Text key, resolved in the current language when drawn. */
  key: string;
  run: () => void;
}

export interface DialogueSpec {
  /** Who is talking. A name, not a key — "Chronos" is Chronos in every language. */
  speaker?: string;
  /** Text key for a chronicle's heading, drawn in the title bar instead of a speaker. */
  titleKey?: string;
  /** Text key for the body. */
  bodyKey: string;
  vars?: Readonly<Record<string, string | number>>;
  /** Draw the sage's head beside the text. */
  portrait?: boolean;
  choices?: DialogueChoice[];
  /** Ran when the box closes by any route. */
  onClose?: () => void;
}

interface Open extends DialogueSpec {
  page: number;
  /** Characters revealed on the current page. Fractional between frames. */
  reveal: number;
  cache: { lang: Lang; w: number; rows: number; pages: string[][] } | null;
}

let box: Open | null = null;
/** Free-running seconds, for the blinking "there is more" marker. */
let clock = 0;

interface Hit { x: number; y: number; w: number; h: number; run: () => void }
let hits: Hit[] = [];

/**
 * Characters per second.
 *
 * Fast enough that a patient reader never waits for the machine and slow
 * enough that the reveal reads as speech rather than as a paint glitch. One
 * press fills the page instantly, so this number costs nobody anything.
 */
const CPS = 90;

/**
 * Most text rows a page may hold.
 *
 * Six, and the actual number is derived per frame from the height the box has:
 * a phone held sideways has a map band a couple of hundred pixels tall and
 * cannot give six rows without covering the whole of it. Six is the ceiling
 * because it is where the chronicle stops being a stack of taps — the redcap's
 * history is five pages at six rows and seven pages at four.
 */
const ROWS_MAX = 6;
/** Never fewer than this, however short the band: one line at a time is a ticker. */
const ROWS_MIN = 2;

export function openDialogue(spec: DialogueSpec): void {
  // Closing the old one properly matters: its `onClose` may be the thing that
  // moves the mission on, and a box replaced mid-sentence must not swallow it.
  if (box) closeDialogue();
  box = { ...spec, page: 0, reveal: 0, cache: null };
}

export function dialogueOpen(): boolean {
  return box !== null;
}

/** The body key of the box on screen, or null. Test and debug handle. */
export function dialogueKey(): string | null {
  return box?.bodyKey ?? null;
}

export function closeDialogue(): void {
  const b = box;
  box = null;
  hits = [];
  b?.onClose?.();
}

export function tickDialogue(dt: number): void {
  clock += dt;
  if (box) box.reveal += CPS * dt;
}

/** Wrap one paragraph to `maxW`, measuring with the caller's ruler. */
function wrap(str: string, maxW: number, measure: (s: string) => number): string[] {
  if (maxW <= 0) return [str];
  const out: string[] = [];
  let line = "";
  for (const word of str.split(/\s+/)) {
    if (!word) continue;
    const probe = line ? `${line} ${word}` : word;
    if (measure(probe) <= maxW || !line) { line = probe; continue; }
    out.push(line);
    line = word;
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

/**
 * Cut a body of text into pages of at most `rows` lines.
 *
 * Exported for the smoke suite, which runs it against a monospace ruler at the
 * narrowest width the game supports and asserts that no page overflows and no
 * page comes out empty. The headless canvas stub reports every string as ten
 * pixels wide, so the measure has to be injectable or the test measures
 * nothing.
 */
export function paginate(
  text: string, maxW: number, rows: number, measure: (s: string) => number,
): string[][] {
  const pages: string[][] = [];
  for (const para of text.split(/\n\s*\n/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const lines = wrap(trimmed, maxW, measure);
    for (let i = 0; i < lines.length; i += rows) pages.push(lines.slice(i, i + rows));
  }
  return pages.length ? pages : [[""]];
}

function pagesOf(b: Open, hud: HudCtx, textW: number, fs: number, rows: number): string[][] {
  const lg = lang();
  if (b.cache && b.cache.lang === lg && b.cache.w === textW && b.cache.rows === rows) {
    return b.cache.pages;
  }
  const { ctx } = hud;
  const measure = (s: string): number => {
    ctx.font = `${Math.round(fs)}px 'Courier New',monospace`;
    return ctx.measureText(s).width;
  };
  const pages = paginate(t(b.bodyKey, lg, b.vars), textW, rows, measure);
  b.cache = { lang: lg, w: textW, rows, pages };
  // A language switch mid-speech re-cuts the pages under the reader; land them
  // on the same page number rather than throwing them back to the beginning.
  if (b.page >= pages.length) b.page = pages.length - 1;
  return pages;
}

/** Characters on the current page, for the typewriter. */
function pageChars(pages: string[][], page: number): number {
  return pages[page].reduce((n, l) => n + l.length, 0);
}

/**
 * A press, a click, or the space bar.
 *
 * Fills the page if it is still being typed, turns it if there is another, and
 * otherwise closes — unless there are choices waiting, in which case one of
 * them has to be picked and a stray press does nothing.
 */
export function advanceDialogue(): void {
  const b = box;
  if (!b || !b.cache) return;
  const total = pageChars(b.cache.pages, b.page);
  if (b.reveal < total) { b.reveal = total; return; }
  if (b.page < b.cache.pages.length - 1) { b.page++; b.reveal = 0; return; }
  if (b.choices && b.choices.length) return;
  closeDialogue();
}

/**
 * Every press while a box is open, consumed here.
 *
 * Returns true always — that IS the modality. Called before the hotspot sweep
 * in main.ts so nothing drawn later (the thumb deck, the action bar) can claim
 * the press first.
 */
export function dialogueTap(sx: number, sy: number): boolean {
  if (!box) return false;
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    if (sx >= h.x && sx < h.x + h.w && sy >= h.y && sy < h.y + h.h) { h.run(); return true; }
  }
  advanceDialogue();
  return true;
}

/** The sage's head, or his baked stand-in when the sheet has not loaded. */
function portraitFrame(): HTMLCanvasElement {
  return npcFrame("timesage", "down", false, 0) ?? SPR.npcTimesage;
}

export function drawDialogue(
  hud: HudCtx, band: { top: number; bottom: number } | null,
  mouse: { sx: number; sy: number },
): void {
  const b = box;
  hits = [];
  if (!b) return;
  const { ctx, screenW, screenH } = hud;
  const S = hud.panelScale ?? hud.scale;
  const lg = lang();

  /* A scrim over everything, including the deck and the action bar. They are
   * drawn before this and they are dead while this is up; dimming them is how
   * the player is told so without a line of text saying it. */
  ctx.fillStyle = "rgba(0,0,0,.42)";
  ctx.fillRect(0, 0, screenW, screenH);

  /* Centred on the VISIBLE map, not on the canvas: with the desktop sidebar
   * open, half the canvas is furniture and a box centred on it sits off to
   * the left of everything the player is looking at. */
  const x0 = hud.sidebarW ?? 0;
  const availW = Math.max(80 * S, screenW - x0);
  const w = Math.min(availW - 16 * S, 470 * S);
  const x = x0 + (availW - w) / 2;

  const pad = 10 * S;
  const bar = 14 * S;
  const fs = 9 * S;
  const lineH = 12.5 * S;
  const hint = 11 * S;
  const portrait = b.portrait === true;
  const pw = portrait ? 44 * S : 0;
  const textX = x + pad + (portrait ? pw + 9 * S : 0);
  const textW = x + w - pad - textX;

  const choices = b.choices ?? [];
  /* Space for the answers is reserved from the first page, not claimed on the
   * last one. A box that grows a row taller the moment the speech ends jumps
   * out from under the finger that was tapping to advance it. */
  const choiceH = choices.length ? choices.length * (17 * S) + 5 * S : 0;

  /* Rows are derived from the room there is, not fixed.
   *
   * A phone held sideways has a map band a few hundred pixels tall; six rows
   * of text plus a title bar plus three answers would cover the whole of it
   * and put the box's own head off the top of the world. */
  const bottom = band ? band.bottom : screenH;
  const top = band ? band.top : 0;
  const roomH = (bottom - top) - (bar + pad + choiceH + hint + 24 * S);
  const rows = Math.max(ROWS_MIN, Math.min(ROWS_MAX, Math.floor(roomH / lineH)));

  const pages = pagesOf(b, hud, textW, fs, rows);
  const last = b.page >= pages.length - 1;
  const total = pageChars(pages, b.page);
  const done = b.reveal >= total;
  const bodyH = Math.max(rows * lineH, portrait ? pw : 0);
  const h = bar + pad + bodyH + choiceH + hint + 8 * S;
  let y = bottom - h - 8 * S;
  if (y < top + 4 * S) y = Math.max(4 * S, top + 4 * S);

  popupFrame(ctx, x, y, w, h, S, "rgba(26,20,13,.97)");

  /* ---- title bar: who is speaking, and the three languages ---------------- */
  const heading = b.titleKey ? t(b.titleKey, lg) : (b.speaker ?? "");
  hudText(hud, heading, x + pad, y + bar / 2 + 1 * S, 9 * S, CHROME.goldText, "left", true);

  /* EN · PL · ES, as words rather than flags.
   *
   * A flag is a country and a language is not: Spanish is not Spain, and at
   * this size a Union Jack is a smear of three colours. Two letters read at
   * any size and mean exactly one thing. */
  let lx = x + w - pad;
  for (let i = LANGS.length - 1; i >= 0; i--) {
    const code = LANGS[i];
    const label = code.toUpperCase();
    ctx.font = `bold ${Math.round(8 * S)}px 'Courier New',monospace`;
    const lw = ctx.measureText(label).width + 8 * S;
    const lyTop = y + 2 * S;
    const lh = bar - 4 * S;
    const on = code === lg;
    const hover = mouse.sx >= lx - lw && mouse.sx < lx && mouse.sy >= lyTop && mouse.sy < lyTop + lh;
    if (on) sunkenBox(ctx, lx - lw, lyTop, lw, lh, "rgba(70,56,28,.95)", CHROME.btnDark, CHROME.btnLight, S);
    else if (hover) buttonBox(ctx, lx - lw, lyTop, lw, lh, S, { hover: true });
    hudText(hud, label, lx - lw / 2, lyTop + lh / 2, 8 * S,
      on ? CHROME.goldText : "rgba(207,168,106,.75)", "center", on);
    hits.push({ x: lx - lw, y: lyTop, w: lw, h: lh, run: () => {
      setLang(code);
      // Re-cut against the new language; the reader stays on this page and the
      // typewriter finishes it rather than replaying it.
      if (box) { box.cache = null; box.reveal = 1e9; }
    } });
    lx -= lw + 3 * S;
  }
  /* A plain rule under the bar rather than a `keyline`: that helper draws a
   * RING inset by a bevel, and a ring one bevel tall has negative interior. */
  ctx.fillStyle = "rgba(122,99,48,.7)";
  ctx.fillRect(Math.round(x + bevelPx(S)), Math.round(y + bar), Math.round(w - 2 * bevelPx(S)), bevelPx(S));

  /* ---- portrait ---------------------------------------------------------- */
  const bodyY = y + bar + pad * 0.6;
  if (portrait) {
    const px0 = x + pad;
    sunkenBox(ctx, px0, bodyY, pw, pw, "rgba(12,9,6,.95)", CHROME.slotDark, CHROME.slotLight, S);
    const f = portraitFrame();
    const sw = f.width;
    const sh = Math.min(f.height, f.width);
    if (sw > 0 && sh > 0) {
      const in2 = 3 * S;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(f, 0, 0, sw, sh, Math.round(px0 + in2), Math.round(bodyY + in2),
        Math.round(pw - in2 * 2), Math.round(pw - in2 * 2));
    }
  }

  /* ---- the text, revealed a character at a time --------------------------- */
  let budget = done ? Infinity : Math.max(0, Math.floor(b.reveal));
  let ty = bodyY + 4 * S;
  for (const line of pages[b.page]) {
    const shown = budget >= line.length ? line : line.slice(0, Math.max(0, budget));
    budget -= line.length;
    if (shown) hudText(hud, shown, textX, ty + fs * 0.5, fs, "#e8dcc0", "left");
    ty += lineH;
    if (budget <= 0 && !done) break;
  }

  /* ---- answers, or the marker that says there is more --------------------- */
  const cy0 = y + bar + pad * 0.6 + bodyH + 3 * S;
  if (choices.length && last && done) {
    let cy = cy0;
    for (const c of choices) {
      const ch = 15 * S;
      const hover = mouse.sx >= textX && mouse.sx < x + w - pad && mouse.sy >= cy && mouse.sy < cy + ch;
      buttonBox(ctx, textX, cy, x + w - pad - textX, ch, S, { hover });
      hudText(hud, `> ${t(c.key, lg)}`, textX + 7 * S, cy + ch / 2, 8 * S, "#ffe9a8", "left", true);
      const run = c.run;
      hits.push({ x: textX, y: cy, w: x + w - pad - textX, h: ch, run: () => {
        // The answer closes the box FIRST, so anything it opens in turn (the
        // sage's reply) is not immediately closed again by this one unwinding.
        closeDialogue();
        run();
      } });
      cy += 17 * S;
    }
  }

  const hy = y + h - hint / 2 - 5 * S;
  if (!(choices.length && last && done)) {
    const blink = Math.sin(clock * 4) > -0.3;
    const label = !done ? "" : last ? t("ui.close", lg) : t("ui.continue", lg);
    if (label && blink) {
      hudText(hud, `${label} \u25be`, x + w - pad, hy, 7 * S, "rgba(220,214,190,.6)", "right");
    }
  }
}
