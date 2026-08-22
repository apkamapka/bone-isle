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

/**
 * Source grid the glyphs are authored on, in pixels.
 *
 * Everything is drawn at a whole multiple of this, so replacing these shapes
 * with hand-drawn 16x16 pixel art needs no rescaling: it lands on exact 1x,
 * 2x or 3x and stays crisp. Scaled by anything in between, pixel art is mush.
 */
export const ICON_SRC = 16;

export type ControlIcon =
  | "build" | "skills" | "equip" | "bag" | "quest" | "atk"
  /* The two faces of one button: whether you follow what you are fighting.
   * A word fits in half the room a word needs — CHASE and STAND were the two
   * widest labels on the row — and freeing that half is what let the skull
   * sit next to them without taking a row off the map. */
  | "chase" | "stand"
  /* Tibia's PvP marks. Two jobs each: the button that says whether you MEAN
   * to hit another player, and the mark that hangs beside the head of someone
   * who already has. Same art, drawn twice at different sizes. */
  | "skullWhite" | "skullRed";

/** The hand-drawn 16x16 art, one file per button. */
const ICON_SRC_FILE: Record<ControlIcon, string> = {
  build: "/icon-build.png",
  skills: "/icon-skill.png",
  equip: "/icon-eq.png",
  bag: "/icon-backpack.png",
  quest: "/icon-quest.png",
  atk: "/icon-atk.png",
  chase: "/icon-chase.png",
  stand: "/icon-stand.png",
  skullWhite: "/icon-skull-white.png",
  skullRed: "/icon-skull-red.png",
};

const loaded: Partial<Record<ControlIcon, CanvasImageSource>> = {};

/**
 * Start loading the drawn icons. No-op headless, safe to call repeatedly.
 *
 * The procedural glyphs below stay in the file rather than being deleted: they
 * are what the buttons show during the first few frames and if a file ever
 * fails to load. A button with nothing in it is worse than a plain one.
 */
export function loadControlIcons(): void {
  if (typeof Image === "undefined" || typeof document === "undefined") return;
  for (const key of Object.keys(ICON_SRC_FILE) as ControlIcon[]) {
    if (loaded[key]) continue;
    const img = new Image();
    img.onload = () => { loaded[key] = img; };
    img.onerror = () => { console.warn(`control icon '${key}' failed to load, the drawn stand-in stays`); };
    img.src = ICON_SRC_FILE[key];
  }
}

/** [x, y, w, h] on a 12x12 grid, plus a colour index into the palette below. */
type Cell = readonly [number, number, number, number, number];

/** 0 = outline/dark, 1 = body, 2 = highlight. */
const PALETTE_ON = ["#2a2008", "#5d4a14", "#8a6c1c"] as const;
const PALETTE_OFF = ["#0e0b06", "#c9b483", "#efe4c4"] as const;

/**
 * Icons whose COLOUR is part of what they mean, and so cannot take the
 * button's palette.
 *
 * The gold-on-dark pair above says "pressed" and "not pressed". A skull says
 * "white" or "red", and those two words are the entire message — a red skull
 * drawn in gold because the button happens to be lit is a different fact.
 * Only ever seen if the PNG fails to load; the art is already these colours.
 */
const GLYPH_PALETTE: Partial<Record<ControlIcon, readonly [string, string, string]>> = {
  skullWhite: ["#15110c", "#e8e8e8", "#ffffff"],
  skullRed: ["#2a0508", "#ed1c24", "#ff344f"],
};

/**
 * Silhouettes of the drawn art, one per colour asked for, made once and kept.
 *
 * Radek's chase and stand figures are drawn in black and two greys, which is
 * right for the art and invisible on a dark button face. Rather than ask for
 * a second set of files in every colour a button can be, the alpha channel is
 * used as a stencil and filled with whatever the caller wants — so the shape
 * stays exactly as drawn and the colour follows the state, the way the WORD
 * it replaced already did (blue for stand, red for chase).
 *
 * Flat fill, not a tint: at sixteen pixels the three greys are one silhouette
 * anyway, and a flat fill is the only version that survives being drawn on
 * both the lit and the unlit face.
 */
const stencils = new Map<string, HTMLCanvasElement>();

function stencil(art: CanvasImageSource, icon: ControlIcon, color: string): CanvasImageSource {
  const key = `${icon}|${color}`;
  const hit = stencils.get(key);
  if (hit) return hit;
  if (typeof document === "undefined" || !document.createElement) return art;
  const c = document.createElement("canvas");
  c.width = ICON_SRC;
  c.height = ICON_SRC;
  const x = c.getContext("2d");
  if (!x) return art;
  x.imageSmoothingEnabled = false;
  x.drawImage(art, 0, 0, ICON_SRC, ICON_SRC);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = color;
  x.fillRect(0, 0, ICON_SRC, ICON_SRC);
  stencils.set(key, c);
  return c;
}

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
  /* Crossed swords. Two diagonals of stepped cells rather than a rotation:
   * fillRect cannot rotate, and a stair-stepped diagonal is what pixel art
   * does anyway. Only ever seen if the PNG fails to load. */
  atk: [
    [2, 2, 2, 2, 0], [3, 3, 2, 2, 1], [4, 4, 2, 2, 1], [5, 5, 2, 2, 2],
    [6, 6, 2, 2, 1], [7, 7, 2, 2, 1], [8, 8, 2, 2, 0],
    [8, 2, 2, 2, 0], [7, 3, 2, 2, 1], [6, 4, 2, 2, 1],
    [4, 6, 2, 2, 1], [3, 7, 2, 2, 1], [2, 8, 2, 2, 0],
  ],
  /* A figure standing square: head, a torso as wide as the shoulders, two
   * legs straight down. Read against `chase` below rather than on its own —
   * the pair only has to be told APART, and the thing that tells them apart
   * is the outline, not the detail. */
  stand: [
    [5, 0, 2, 2, 1],
    [4, 3, 4, 5, 1], [4, 3, 4, 1, 2],
    [4, 8, 1, 4, 1], [7, 8, 1, 4, 1],
  ],
  /* The same figure mid-stride: leaning, one arm forward, legs scissored.
   * Asymmetric on purpose — a symmetric running figure reads as a standing
   * one with its legs apart. */
  chase: [
    [5, 0, 2, 2, 1],
    [4, 3, 4, 4, 1], [4, 3, 4, 1, 2],
    [2, 5, 2, 1, 1], [8, 4, 2, 1, 1],
    [3, 7, 2, 3, 1], [2, 10, 2, 2, 1],
    [7, 7, 2, 3, 1], [8, 10, 2, 2, 1],
  ],
  /* A skull: cranium, two sockets, a nose notch and a jaw with a gap in it.
   * The jaw is what stops it reading as a bald head — a dome with two dark
   * squares in it is a face at this size. */
  skullWhite: [
    [3, 1, 6, 6, 1], [3, 1, 6, 1, 2],
    [4, 3, 2, 2, 0], [7, 3, 2, 2, 0],
    [5, 5, 2, 1, 0],
    [4, 7, 4, 3, 1], [5, 7, 1, 3, 0], [7, 7, 1, 3, 0],
  ],
  skullRed: [
    [3, 1, 6, 6, 1], [3, 1, 6, 1, 2],
    [4, 3, 2, 2, 0], [7, 3, 2, 2, 0],
    [5, 5, 2, 1, 0],
    [4, 7, 4, 3, 1], [5, 7, 1, 3, 0], [7, 7, 1, 3, 0],
  ],
};

/**
 * Draw a control glyph filling `size` at `x,y`.
 *
 * `on` picks the dark-on-gold palette used when the button is pressed, so the
 * glyph stays legible against the lit face instead of vanishing into it.
 *
 * `tint` overrides both: the art is drawn as a flat silhouette in that colour.
 * Used by the buttons whose glyph replaced a coloured WORD and has to carry
 * the same meaning the colour did.
 *
 * Not only for buttons any more, despite the name: the skulls are drawn over
 * a player's head in the world with the same call, because the alternative is
 * a second loader and a second fallback for the same two files.
 */
export function drawControlIcon(
  ctx: CanvasRenderingContext2D,
  icon: ControlIcon,
  x: number, y: number, size: number, on: boolean,
  tint?: string,
): void {
  const art = loaded[icon];
  if (art) {
    /* Nearest-neighbour, always. The caller snaps `size` to a whole multiple
     * of ICON_SRC, so this is an exact 1x/2x/3x blit and smoothing would only
     * blur art that is already the right size. */
    const was = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tint ? stencil(art, icon, tint) : art,
      Math.round(x), Math.round(y), Math.round(size), Math.round(size));
    ctx.imageSmoothingEnabled = was;
    return;
  }
  const u = size / 12; // 12 authored units mapped onto the requested box
  const pal = tint
    ? ([tint, tint, tint] as const)
    : GLYPH_PALETTE[icon] ?? (on ? PALETTE_ON : PALETTE_OFF);
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
