/**
 * Window chrome: the raised and sunken bevels every panel is built from.
 *
 * The old chrome drew ONE 1-px stroke around everything — the window frame and
 * the inventory cells shared a border, so nothing told you which rectangles
 * were surfaces and which were holes you could drop an item into. Here a frame
 * is RAISED (light top-left, dark bottom-right) and a slot is SUNKEN (the same
 * two colours swapped), which is the whole trick behind Tibia's UI reading
 * instantly at 32 px. No art, no 9-slice, no assets to license: four fillRects
 * per box.
 *
 * Everything rounds to whole device pixels. A bevel drawn at x.5 is a grey
 * smear, and at these sizes one smeared pixel is most of the effect.
 */

/** Bevel thickness in device px: one "UI pixel", never thinner than one real one. */
export function bevelPx(S: number): number {
  return Math.max(1, Math.round(S));
}

function px(v: number): number {
  return Math.round(v);
}

/** The one palette. Panels, popups, slots and HUD buttons all read from it. */
export const CHROME = {
  /** Panel body. Kept semi-transparent so the map still breathes behind it. */
  panelFace: "rgba(44,34,21,.95)",
  panelLight: "#7a6330",
  panelDark: "#0d0906",
  /** Hard outer ring, so a window separates from bright grass. */
  panelEdge: "#050403",
  /** Title bar sits a shade warmer than the body it caps. */
  barFace: "#40311a",
  barLight: "#6b5526",
  barDark: "#140f07",
  /** Inventory cell: darker than the panel, because it is a hole in it. The
   *  gap between these two values IS the depth — too close and the bevel is
   *  doing all the work on its own, which at 2 px it cannot. */
  slotFace: "rgba(16,12,8,.94)",
  slotHover: "rgba(202,162,58,.22)",
  slotDark: "#0a0704",
  slotLight: "#5a4718",
  /** Corner rivets. */
  stud: "#caa23a",
  gold: "#caa23a",
  /** "There is something in this cell." Deliberately dim: in the equipment
   *  window nearly every slot is filled, so a bright mark on each is a wall
   *  of light that marks nothing. Bright is reserved for what is rare. */
  slotFilled: "#8a6f28",
  goldText: "#ffe9a8",
  dimText: "#cfa86a",
  /** Buttons, which are small raised plates rather than outlined rectangles. */
  btnFace: "rgba(52,41,24,.95)",
  btnLight: "#6b5526",
  btnDark: "#140f07",
} as const;

/** A `t`-thick rectangular ring. The building block for edges and keylines. */
export function ring(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, t: number, colour: string,
): void {
  const X = px(x), Y = px(y), W = px(w), H = px(h);
  if (W <= 0 || H <= 0) return;
  ctx.fillStyle = colour;
  ctx.fillRect(X, Y, W, t);
  ctx.fillRect(X, Y + H - t, W, t);
  ctx.fillRect(X, Y + t, t, H - 2 * t);
  ctx.fillRect(X + W - t, Y + t, t, H - 2 * t);
}

/** A raised plate: light top-left, dark bottom-right. Reads as a surface. */
export function raisedBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  face: string, light: string, dark: string, S: number,
): void {
  const b = bevelPx(S);
  const X = px(x), Y = px(y), W = px(w), H = px(h);
  if (W <= 0 || H <= 0) return;
  ctx.fillStyle = face;
  ctx.fillRect(X, Y, W, H);
  ctx.fillStyle = light;
  ctx.fillRect(X, Y, W, b);
  ctx.fillRect(X, Y, b, H);
  ctx.fillStyle = dark;
  ctx.fillRect(X, Y + H - b, W, b);
  ctx.fillRect(X + W - b, Y, b, H);
}

/** A sunken well: dark top-left, light bottom-right. Reads as a hole. */
export function sunkenBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  face: string, dark: string, light: string, S: number,
): void {
  const b = bevelPx(S);
  const X = px(x), Y = px(y), W = px(w), H = px(h);
  if (W <= 0 || H <= 0) return;
  ctx.fillStyle = face;
  ctx.fillRect(X, Y, W, H);
  ctx.fillStyle = dark;
  ctx.fillRect(X, Y, W, b);
  ctx.fillRect(X, Y, b, H);
  ctx.fillStyle = light;
  ctx.fillRect(X, Y + H - b, W, b);
  ctx.fillRect(X + W - b, Y, b, H);
}

/** A coloured outline drawn just INSIDE a bevel — the "this slot is live" mark. */
export function keyline(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, colour: string, S: number,
): void {
  const b = bevelPx(S);
  ring(ctx, px(x) + b, px(y) + b, px(w) - 2 * b, px(h) - 2 * b, b, colour);
}

/** Four corner rivets. Only the outermost frame of a window gets these. */
export function studs(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, colour: string, S: number,
): void {
  const b = bevelPx(S);
  const X = px(x), Y = px(y), W = px(w), H = px(h);
  ctx.fillStyle = colour;
  ctx.fillRect(X, Y, b, b);
  ctx.fillRect(X + W - b, Y, b, b);
  ctx.fillRect(X, Y + H - b, b, b);
  ctx.fillRect(X + W - b, Y + H - b, b, b);
}

/** Total thickness of a window frame: the hard edge plus the bevel inside it. */
export function frameInset(S: number): number {
  return 2 * bevelPx(S);
}

/**
 * A window's outer frame: hard edge ring, raised bevel, corner rivets.
 * Everything is drawn INSIDE `x,y,w,h`, so the footprint a caller reserved is
 * exactly the footprint used and no layout offsets shift.
 */
export function panelFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, S: number,
): void {
  const b = bevelPx(S);
  ring(ctx, x, y, w, h, b, CHROME.panelEdge);
  raisedBox(ctx, px(x) + b, px(y) + b, px(w) - 2 * b, px(h) - 2 * b,
    CHROME.panelFace, CHROME.panelLight, CHROME.panelDark, S);
  studs(ctx, x, y, w, h, CHROME.stud, S);
}

/** A popup (tooltip, inspect card, quantity chooser) — a frame with no rivets. */
export function popupFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, S: number, face?: string,
): void {
  const b = bevelPx(S);
  ring(ctx, x, y, w, h, b, CHROME.panelEdge);
  raisedBox(ctx, px(x) + b, px(y) + b, px(w) - 2 * b, px(h) - 2 * b,
    face ?? CHROME.panelFace, CHROME.panelLight, CHROME.panelDark, S);
}

export interface SlotOpts {
  /** Cursor is over the cell: the well lights up. */
  hover?: boolean;
  /** Draw a coloured keyline — occupied, equipped, or a container. */
  accent?: string;
  /** Override the well colour (used by the mobile action bar). */
  face?: string;
}

/** An inventory cell. The single source of truth for what a slot looks like. */
export function slotCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, S: number, opts: SlotOpts = {},
): void {
  const face = opts.face ?? (opts.hover ? CHROME.slotHover : CHROME.slotFace);
  sunkenBox(ctx, x, y, w, h, face, CHROME.slotDark, CHROME.slotLight, S);
  if (opts.accent) keyline(ctx, x, y, w, h, opts.accent, S);
}

/**
 * A clickable plate. Raised when idle, and genuinely SUNKEN when it is on or
 * held — the same box, bevels flipped, which is how a physical button reads.
 */
export function buttonBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, S: number,
  opts: { on?: boolean; face?: string; accent?: string; hover?: boolean } = {},
): void {
  const face = opts.face ?? (opts.hover && !opts.on ? "rgba(78,62,34,.95)" : CHROME.btnFace);
  if (opts.on) sunkenBox(ctx, x, y, w, h, face, CHROME.btnDark, CHROME.btnLight, S);
  else raisedBox(ctx, x, y, w, h, face, CHROME.btnLight, CHROME.btnDark, S);
  if (opts.accent) keyline(ctx, x, y, w, h, opts.accent, S);
}
