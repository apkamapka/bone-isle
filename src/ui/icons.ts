/**
 * Tiny pixel glyphs for the sidebar's control buttons.
 *
 * The buttons carried their keyboard letter, which works for B (Build) and Q
 * (Quest) and does not work at all for K (Skills) — and S, the obvious letter,
 * is taken by walking. Tibia's sidebar buttons are pictures for the same
 * reason: a picture does not have to agree with a keybind.
 *
 * Drawn with fillRect only, like the window chrome, so they need no art file,
 * carry no licence, scale to any size, and can be tested by recording the
 * rectangles rather than by looking at them.
 *
 * Every glyph is authored on a 12x12 grid and scaled to the box it is given.
 */

export type ControlIcon = "build" | "skills" | "equip" | "bag" | "quest";

/** [x, y, w, h] on a 12x12 grid, plus a colour index into the palette below. */
type Cell = readonly [number, number, number, number, number];

/** 0 = outline/dark, 1 = body, 2 = highlight. */
const PALETTE_ON = ["#2a2008", "#5d4a14", "#8a6c1c"] as const;
const PALETTE_OFF = ["#0e0b06", "#c9b483", "#efe4c4"] as const;

const GLYPHS: Record<ControlIcon, readonly Cell[]> = {
  /* An anvil, not a hammer. A 12-px hammer is a thin bar on a thin stick and
   * reads as the letter T; an anvil's wide-waist-wide silhouette survives the
   * size, which is the only thing that matters at this scale. */
  build: [
    // Asymmetric on purpose: the horn on the left is what separates an anvil
    // from the scroll below, which is otherwise the same wide-narrow-wide.
    [0, 4, 2, 1, 1],
    [2, 3, 8, 2, 1], [2, 3, 8, 1, 2], [2, 5, 8, 1, 0],
    [4, 5, 3, 4, 1], [4, 5, 1, 4, 2],
    [3, 9, 6, 2, 1], [3, 9, 6, 1, 2], [3, 11, 6, 1, 0],
  ],
  // A sword, point up: long blade, wide crossguard, and a pommel so the grip
  // end is unmistakable rather than reading as a plain cross.
  skills: [
    [5, 0, 2, 7, 1], [5, 0, 1, 7, 2],
    [2, 6, 8, 2, 1], [2, 6, 8, 1, 2], [2, 8, 8, 1, 0],
    [5, 8, 2, 2, 1],
    [4, 10, 4, 2, 1], [4, 10, 4, 1, 2],
  ],
  // A helmet. The breastplate it replaced came out as a bucket; a dome with a
  // visor slit is the one armour shape that still reads at twelve pixels.
  equip: [
    [2, 2, 8, 5, 1], [2, 2, 8, 1, 2], [3, 1, 6, 1, 1],
    [2, 7, 8, 1, 0],
    [2, 8, 8, 2, 1], [3, 8, 6, 1, 0],
    [2, 10, 8, 1, 0],
  ],
  // A pack: body, flap, strap.
  bag: [
    [2, 3, 8, 8, 1], [2, 3, 8, 1, 2],
    [4, 1, 4, 2, 1], [2, 5, 8, 1, 0],
    [5, 6, 2, 2, 0],
  ],
  /* A scroll. The curls have to overhang the sheet by a clear pixel each side
   * or the whole thing reads as a spool of thread. */
  quest: [
    [1, 1, 10, 2, 1], [1, 1, 10, 1, 2],
    [3, 3, 6, 6, 1],
    [4, 4, 4, 1, 0], [4, 6, 4, 1, 0],
    [1, 9, 10, 2, 1], [1, 9, 10, 1, 2],
  ],
};

/**
 * Draw a control glyph filling `size` at `x,y`.
 *
 * `on` picks the dark-on-gold palette used when the button is pressed, so the
 * glyph stays legible against the lit face instead of vanishing into it.
 */
export function drawControlIcon(
  ctx: CanvasRenderingContext2D,
  icon: ControlIcon,
  x: number, y: number, size: number, on: boolean,
): void {
  const u = size / 12;
  const pal = on ? PALETTE_ON : PALETTE_OFF;
  // Snap to whole pixels: a 12-unit glyph at a fractional unit is mush.
  const px = (v: number): number => Math.round(v);
  for (const [gx, gy, gw, gh, c] of GLYPHS[icon]) {
    ctx.fillStyle = pal[c];
    ctx.fillRect(px(x + gx * u), px(y + gy * u), Math.max(1, px(gw * u)), Math.max(1, px(gh * u)));
  }
}

/**
 * The up/down arrows on a resizable window's foot.
 *
 * Five dots sat there before and promised nothing — a row of dots is a grip in
 * some interfaces and pure decoration in others, so it read as decoration.
 *
 * SIDE BY SIDE, not stacked. Stacking is the natural way to draw an up/down
 * pair and it does not survive here: the strip is about twelve pixels tall in
 * the sidebar, so two stacked arrowheads come out four pixels each and merge
 * into one hexagonal blob. Vertical room is the scarce thing and horizontal
 * room is not, so the pair is laid out across instead — full-height arrows,
 * each with a stem, which read as arrows at the size they actually get.
 *
 * Drawn as rows rather than as a font glyph: the arrow characters are missing
 * from plenty of monospace faces, and a missing glyph is a hollow box.
 */
export function drawResizeArrows(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, barH: number, color: string,
): void {
  const u = Math.max(1, Math.floor(barH / 10));
  ctx.fillStyle = color;
  /** One row of an arrow: `w` units wide, `i` rows down from the top. */
  const row = (ox: number, w: number, i: number): void => {
    ctx.fillRect(Math.round(cx + ox * u - (w * u) / 2), Math.round(cy - 4 * u + i * u), w * u, u);
  };
  // Up: head widening downward, then a stem.
  const upX = -7;
  row(upX, 1, 0); row(upX, 3, 1); row(upX, 5, 2); row(upX, 7, 3); row(upX, 9, 4);
  row(upX, 3, 5); row(upX, 3, 6); row(upX, 3, 7);
  // Down: stem first, then the head narrowing to a point.
  const dnX = 7;
  row(dnX, 3, 0); row(dnX, 3, 1); row(dnX, 3, 2);
  row(dnX, 9, 3); row(dnX, 7, 4); row(dnX, 5, 5); row(dnX, 3, 6); row(dnX, 1, 7);
}
