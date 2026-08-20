/**
 * The portrait-phone layout.
 *
 * Desktop solved the overlapping-windows problem by taking the sidebar's width
 * OUT of the map instead of laying it over the world. A phone has the same
 * problem and the opposite budget: no spare width at all, and plenty of spare
 * height. So the column becomes two horizontal bands — a read-only strip at the
 * top and a thumb deck at the foot — and the world keeps the whole middle.
 *
 * WHY THE TABS ARE AT THE TOP AND THE HOTBAR AT THE BOTTOM. Frequency decides
 * who gets the reachable half of the screen. You hit a hotbar slot under
 * pressure, several times a fight; you open the backpack or the build panel
 * once a minute and almost never while something is chasing you. So the slots
 * own the thumb zone and the panel tabs live up top. Opening a panel costs a
 * reach; CLOSING one does not, because the sheet carries its own close button
 * down where your thumb already is — and closing is the urgent direction.
 *
 * WHY EVERY CONTROL IS CUT OUT OF THE SCREEN RATHER THAN DRAWN OVER IT. With
 * tap-to-walk the map is not scenery, it is a control surface: every pixel of
 * it is live. A button floating over the world does not merely hide a tile, it
 * eats the tap that was aimed at one — and a missed tap is not nothing, it is a
 * step in the wrong direction. The old mobile HUD put five buttons down the
 * left edge and four down the right, all of them over the world and all of them
 * at mid-height, which is both the least reachable band and the most valuable.
 *
 * Everything here is device pixels, driven by one touch unit, in the same
 * spirit as `dock.ts`: the phone's chrome does not scale with the HUD's design
 * unit (authored against a 480x320 reference), because that unit lands at about
 * 0.75 CSS px on a 360-wide phone and would put every button under 30 CSS px —
 * well below anything a finger can hit.
 */

/** A finger needs about this much, in CSS px. Everything is sized up from it. */
export const TOUCH_MIN_CSS = 44;

/** The tabs across the top strip, in order. */
export const DECK_TABS = ["build", "skills", "equip", "bag", "quest"] as const;
export type DeckTab = (typeof DECK_TABS)[number];

/** Action slots on the deck — the same six the desktop hotbar carries. */
export const DECK_SLOTS = 6;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MobileLayout {
  /** False when this screen gets the old floating HUD instead. */
  on: boolean;
  /** The touch unit every measurement below is derived from (device px). */
  u: number;
  gap: number;
  margin: number;

  /** Read-only strip at the top, plate included. */
  topH: number;
  /** Location name / task line. */
  info: Rect;
  /** HP + capacity bars. */
  vitals: Rect;
  /** Gold and task points, right-aligned on the info row. */
  purse: Rect;
  /** Panel tabs, one per DECK_TABS entry. */
  tabs: Rect[];
  /** Minimap, square, at the right end of the tab row. */
  minimap: Rect;

  /** Thumb deck at the foot, plate included. */
  deckY: number;
  deckH: number;
  /** HUD-edit toggle, left end of the deck's thin row. */
  edit: Rect;
  /** Weapon swap, right end of the same row. */
  swap: Rect;
  /** The six action slots. */
  slots: Rect[];

  /** The band of screen the world is visible through. */
  mapTop: number;
  mapBottom: number;
  /** Where an open panel sits: full width, pinned against the deck. */
  sheet: Rect;
}

/**
 * Does this screen get the deck?
 *
 * Portrait only. A phone held sideways has no spare height to give away — a
 * band across the foot would eat a third of an already short axis — so it keeps
 * today's floating HUD until landscape gets its own answer (which is the
 * desktop column with fatter targets, not this).
 *
 * The size test matches the existing `mobile` flag so nothing that behaves as a
 * desktop today starts behaving as a phone.
 */
export function deckEnabled(cssW: number, cssH: number, touch: boolean): boolean {
  return (touch || Math.min(cssW, cssH) < 620) && cssH > cssW;
}

/** Everything is off, but every field is present. The safe default. */
export function noDeck(screenH = 0): MobileLayout {
  const z: Rect = { x: 0, y: 0, w: 0, h: 0 };
  return {
    on: false, u: 0, gap: 0, margin: 0,
    topH: 0, info: z, vitals: z, purse: z, tabs: [], minimap: z,
    deckY: screenH, deckH: 0, edit: z, swap: z, slots: [],
    mapTop: 0, mapBottom: screenH, sheet: z,
  };
}

/**
 * Measure the layout.
 *
 * `safeTop` / `safeBottom` are the device-pixel insets a notch and a gesture
 * bar claim. They are added to the plates rather than to the map, because a
 * strip that runs under the notch still reads as a strip, whereas a hotbar slot
 * under the gesture bar is a slot you cannot press.
 */
export function mobileLayout(
  screenW: number,
  screenH: number,
  dpr: number,
  safeTop = 0,
  safeBottom = 0,
): MobileLayout {
  const u = Math.max(
    TOUCH_MIN_CSS * dpr,
    Math.min(Math.round(Math.min(screenW, screenH) * 0.125), 120 * dpr),
  );
  const gap = Math.max(2, Math.round(u * 0.06));
  const m = Math.max(2, Math.round(u * 0.08));
  const innerX = m;
  const innerW = Math.max(1, screenW - 2 * m);

  /* --- top strip: two thin read-only rows, then the tabs ------------------ */
  const infoH = Math.round(u * 0.5);
  const vitalsH = Math.round(u * 0.52);
  const tabH = u;

  let y = safeTop + m;
  const info: Rect = { x: innerX, y, w: innerW, h: infoH };
  /* The purse shares the info row rather than taking one of its own: the two
   * numbers are four glyphs wide between them and a row each would cost more
   * height than the whole capacity bar. */
  const purseW = Math.min(Math.round(innerW * 0.46), Math.round(u * 3.6));
  const purse: Rect = { x: innerX + innerW - purseW, y, w: purseW, h: infoH };
  y += infoH + gap;
  const vitals: Rect = { x: innerX, y, w: innerW, h: vitalsH };
  y += vitalsH + gap;

  const tabsW = Math.max(1, innerW - tabH - gap);
  const tabW = Math.floor((tabsW - (DECK_TABS.length - 1) * gap) / DECK_TABS.length);
  const tabs: Rect[] = DECK_TABS.map((_, i) => ({
    x: innerX + i * (tabW + gap), y, w: tabW, h: tabH,
  }));
  const minimap: Rect = { x: innerX + innerW - tabH, y, w: tabH, h: tabH };
  y += tabH + m;
  const topH = y;

  /* --- thumb deck: the utility row, then the six slots -------------------- */
  /* A FULL touch row, not a thin one. The weapon swap lives here and it is a
   * combat control — you press it while something is hitting you — so it gets
   * the same target as a hotbar slot. The first draft made this row half height
   * and put a 22 CSS px button on a 320-wide phone, which is a button you miss.
   * The eighteen pixels it costs are the cheapest correctness in the file. */
  const barH = u;
  const slotH = Math.round(u * 1.02);
  const deckH = m + barH + gap + slotH + m + safeBottom;
  const deckY = Math.max(topH, screenH - deckH);

  const barY = deckY + m;
  /* Swap takes everything the edit toggle does not, which is how the desktop
   * column draws it too: one wide bar under the buttons. Wide because you aim
   * at it in a hurry, and because the row would otherwise be mostly plate. */
  const editW = Math.round(u * 1.5);
  const swapX = innerX + editW + gap;
  const edit: Rect = { x: innerX, y: barY, w: editW, h: barH };
  const swap: Rect = { x: swapX, y: barY, w: Math.max(1, innerX + innerW - swapX), h: barH };

  const slotY = barY + barH + gap;
  const slotW = Math.floor((innerW - (DECK_SLOTS - 1) * gap) / DECK_SLOTS);
  const slots: Rect[] = [];
  for (let i = 0; i < DECK_SLOTS; i++) {
    slots.push({ x: innerX + i * (slotW + gap), y: slotY, w: slotW, h: slotH });
  }

  /* --- the map window, and the sheet an open panel drops into ------------- */
  const mapTop = topH;
  const mapBottom = deckY;
  const mapH = Math.max(1, mapBottom - mapTop);
  /* A panel takes about two thirds of the world band and no more. The third it
   * leaves is not decoration: it is how you notice that something walked up to
   * you while you were sorting loot, and how you get away without closing the
   * panel first. A full-screen panel on a game where you can be attacked is a
   * panel you die inside. */
  const sheetH = Math.min(mapH, Math.max(Math.round(u * 3), Math.round(mapH * 0.58)));
  const sheet: Rect = { x: innerX, y: mapBottom - sheetH, w: innerW, h: sheetH };

  return {
    on: true, u, gap, margin: m,
    topH, info, vitals, purse, tabs, minimap,
    deckY, deckH, edit, swap, slots,
    mapTop, mapBottom, sheet,
  };
}

/** Is this point on either plate (and therefore not on the world)? */
export function overDeck(d: MobileLayout, sy: number): boolean {
  return d.on && (sy < d.mapTop || sy >= d.deckY);
}

/**
 * Where the player should sit on screen, as a fraction of the canvas height.
 *
 * Centring on the canvas would push the character down behind the deck, since
 * the top strip and the deck are not the same height. Centring on the BAND is
 * what makes the view read as a window onto the world rather than as a world
 * with furniture on top of it.
 */
export function mapFocusFrac(d: MobileLayout, screenH: number): number {
  if (!d.on || screenH <= 0) return 0.5;
  return (d.mapTop + d.mapBottom) / 2 / screenH;
}
