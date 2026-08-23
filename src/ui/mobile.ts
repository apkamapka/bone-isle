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

/** Panels a phone may hold open at once. See `sheetSlots` for why it is two. */
export const MAX_SHEETS = 2;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MobileLayout {
  /** False when this screen gets the old floating HUD instead. */
  on: boolean;
  /**
   * Phone held sideways.
   *
   * The two orientations are not variations on one layout, they are opposites,
   * and the reason is which axis has slack. Upright, height is plentiful and
   * width is not, so the chrome takes two bands across the top and foot.
   * Sideways it is the other way round: a band across the foot would eat a
   * third of an already short axis, so the chrome goes down the SIDES and the
   * map keeps the full height it has.
   */
  landscape: boolean;
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
  /**
   * The button that reveals the tabs. Collapsed by default: five tabs on
   * permanent display cost a whole touch row of the strip, and you open a panel
   * about once a minute. Trading that row away buys the utility controls a home
   * up here and lets the deck shrink to the six slots alone.
   */
  menu: Rect;
  /**
   * HUD-edit toggle. It USED to sit on the utility row and no longer does.
   *
   * You bind a slot once and then never again; you toggle pursuit in the
   * middle of a fight. When the combat controls arrived there was one row
   * between them, and the rare thing gives way to the mid-fight one — so edit
   * moved into the drop-down beside the panel tabs, which is where the other
   * once-a-session controls already live.
   */
  edit: Rect;
  /** Weapon swap — bindable to a slot as well, which is why it may sit here. */
  swap: Rect;
  /**
   * Chase opponent / stand while fighting. A STATE, so it stays lit while on:
   * "am I following?" has to be answerable without pressing anything.
   */
  chase: Rect;
  /** Mark the nearest creature — Tibia's crossed swords. */
  atk: Rect;
  /**
   * Do I mean to fight other PLAYERS? A white skull, lit when armed.
   *
   * It sits on this row and not in a menu because it is the one setting whose
   * being wrong is discovered by killing somebody. Tibia buries the same
   * switch two menus deep and every player who has ever lost a friend to it
   * knows why that was a mistake.
   *
   * It only fits here because chase stopped being a WORD: CHASE and STAND
   * were the widest labels on the strip, and a glyph needs half the room.
   */
  skull: Rect;
  /**
   * Open the chat input, from the drop-down.
   *
   * A fallback rather than the main route: the log lying on the world is
   * itself tappable, which is where chat is normally opened from. This exists
   * for the case the log cannot cover — a silent world with nothing to tap.
   */
  chat: Rect;
  /**
   * The LOOK toggle: tap a thing, read what it is.
   *
   * A MODE rather than a menu entry, and only on this interface. The long
   * press that opens the world menu ends with a fingertip resting on the very
   * thing being described and a menu unfolding over what is left of it — the
   * one verb whose entire job is "let me see that" is the one verb a finger
   * cannot afford. A toggle costs one tap up front and then leaves the screen
   * alone, so the answer arrives in the log with nothing on top of it.
   */
  look: Rect;
  /**
   * Shorten and lengthen the hotbar, a row at a time.
   *
   * These are the drop-down's last two cells, and they are here rather than on
   * the edit strip because the edit strip does not exist on this interface:
   * `drawTouchControls` hands the screen to the deck and returns before it.
   * A control that only draws on the other device is not a control.
   */
  keysLess: Rect;
  keysMore: Rect;
  /** Minimap, square, at the right end of the utility row. */
  minimap: Rect;
  /**
   * The panel tabs, positioned BELOW the strip as a drop-down. They are drawn
   * over the world and only while the menu is open, so they cost no permanent
   * height at all — a tap dismisses them along with whatever it landed on.
   */
  tabs: Rect[];

  /** Thumb deck at the foot, plate included. It is now the six slots and
   *  nothing else — every other control moved up into the strip. */
  deckY: number;
  deckH: number;
  /** The six action slots. */
  slots: Rect[];

  /** The band of screen the world is visible through. */
  mapTop: number;
  mapBottom: number;
  /** ...and its left and right edges, which only move in landscape. */
  mapLeft: number;
  mapRight: number;
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
  if (cssH > cssW) return (touch || Math.min(cssW, cssH) < 620) && true;
  /* Sideways, only on a real touch device.
   *
   * Portrait can afford the size test alone, because a tall narrow window is a
   * phone shape whatever is driving it. A SHORT WIDE window is not — that is
   * just a desktop browser someone dragged smaller, and it already has the
   * column. Requiring touch here is what keeps this change off the desktop. */
  return touch && Math.min(cssW, cssH) < 620;
}

/** Everything is off, but every field is present. The safe default. */
export function noDeck(screenH = 0): MobileLayout {
  const z: Rect = { x: 0, y: 0, w: 0, h: 0 };
  return {
    on: false, landscape: false, u: 0, gap: 0, margin: 0,
    topH: 0, info: z, vitals: z, purse: z,
    menu: z, edit: z, swap: z, chase: z, atk: z, skull: z, chat: z, look: z,
    keysLess: z, keysMore: z, minimap: z, tabs: [],
    deckY: screenH, deckH: 0, slots: [],
    mapTop: 0, mapBottom: screenH, mapLeft: 0, mapRight: 0, sheet: z,
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
  /**
   * How many action slots to lay out. Passed in rather than imported so this
   * module stays a pure function of its arguments — the tests set a hotbar
   * length by calling with a number, not by reaching into game state.
   */
  slotCount = DECK_SLOTS,
): MobileLayout {
  const u = Math.max(
    TOUCH_MIN_CSS * dpr,
    Math.min(Math.round(Math.min(screenW, screenH) * 0.125), 120 * dpr),
  );
  if (screenW > screenH) return landscapeLayout(screenW, screenH, u, safeTop, safeBottom, slotCount);
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

  /* Utility row: reveal, edit, swap, minimap. Swap takes whatever the other
   * three leave, which is most of it — you aim at it in a hurry, and the desktop
   * column draws it as one wide bar under its buttons for the same reason. */
  const menu: Rect = { x: innerX, y, w: tabH, h: tabH };
  /* Chase used to take one and a half units because it carried a WORD — CHASE
   * or STAND, the two widest labels on the strip — and a square would clip
   * them. Radek's running and standing figures say the same thing in a glyph,
   * so it is square now like the mark button beside it, and the half unit it
   * gave back is most of what the skull costs. */
  const chase: Rect = { x: menu.x + menu.w + gap, y, w: tabH, h: tabH };
  const atk: Rect = { x: chase.x + chase.w + gap, y, w: tabH, h: tabH };
  /* Next to chase and mark, not off in a menu: all three are answers to "how
   * am I fighting right now", and a player checks them as one glance. */
  const skull: Rect = { x: atk.x + atk.w + gap, y, w: tabH, h: tabH };
  const minimap: Rect = { x: innerX + innerW - tabH, y, w: tabH, h: tabH };
  const swapX = skull.x + skull.w + gap;
  const swap: Rect = { x: swapX, y, w: Math.max(1, minimap.x - gap - swapX), h: tabH };
  y += tabH + m;
  const topH = y;

  /* The drop-down: a 2x5 GRID, not a longer row.
   *
   * Five tabs fitted across a row. Seven does not — 360 CSS px over seven
   * cells is 47 px each before gaps, and by the time Friends and Party arrive
   * it is under forty, which is below what a fingertip can hit. The obvious
   * fix is a scrolling row, and it has a failure mode you can see on any
   * client that uses one: a tab cut off mid-word reads as a rendering bug
   * rather than as "there is more this way".
   *
   * A second row costs one row of world, only while the menu is open, and it
   * is drawn OVER the world so it costs no permanent height at all. Ten cells
   * at full size, nothing to scroll, nothing to guess at. */
  const DROP_COLS = 5;
  const tabW = Math.floor((innerW - (DROP_COLS - 1) * gap) / DROP_COLS);
  const tabY = topH + gap;
  const cell = (i: number): Rect => ({
    x: innerX + (i % DROP_COLS) * (tabW + gap),
    y: tabY + Math.floor(i / DROP_COLS) * (tabH + gap),
    w: tabW, h: tabH,
  });
  const tabs: Rect[] = DECK_TABS.map((_, i) => cell(i));
  const chat: Rect = cell(DECK_TABS.length);
  const edit: Rect = cell(DECK_TABS.length + 1);
  const look: Rect = cell(DECK_TABS.length + 2);
  const keysLess: Rect = cell(DECK_TABS.length + 3);
  const keysMore: Rect = cell(DECK_TABS.length + 4);

  /* --- thumb deck: the action slots, and nothing else ---------------------
   *
   * One row of six, or several. The deck grows UPWARD as rows are added, and
   * the first six keep the bottom line: that is the only part of the screen a
   * thumb reaches without moving the hand, so it belongs to the slots the
   * player set up first. Extra rows stack above, further away, which is the
   * right way round — they are the overflow, not the promotion.
   *
   * Numbering therefore runs bottom-up: slots 1–6 on the bottom row, 7–12 on
   * the one above it. Reading order would put 1–6 on top and hand the easiest
   * row to the least-used bindings. */
  const rows = Math.max(1, Math.ceil(slotCount / DECK_SLOTS));
  const slotH = Math.round(u * 1.02);
  const deckH = m + rows * slotH + (rows - 1) * gap + m + safeBottom;
  const deckY = Math.max(topH, screenH - deckH);

  const slotW = Math.floor((innerW - (DECK_SLOTS - 1) * gap) / DECK_SLOTS);
  const slots: Rect[] = [];
  for (let i = 0; i < slotCount; i++) {
    const row = Math.floor(i / DECK_SLOTS);
    const col = i % DECK_SLOTS;
    slots.push({
      x: innerX + col * (slotW + gap),
      y: deckY + m + (rows - 1 - row) * (slotH + gap),
      w: slotW, h: slotH,
    });
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
    on: true, landscape: false, u, gap, margin: m,
    topH, info, vitals, purse,
    menu, edit, swap, chase, atk, skull, chat, look, keysLess, keysMore, minimap, tabs,
    deckY, deckH, slots,
    mapTop, mapBottom, mapLeft: 0, mapRight: screenW, sheet,
  };
}

/**
 * The same deck, turned on its side.
 *
 * Every piece is the one the portrait layout uses — status, reveal, edit, swap,
 * minimap, six slots — and only the arrangement changes, because only the
 * budget changes. Held sideways a phone has width to burn and almost no height,
 * so:
 *
 *  - status and vitals become ONE row instead of three. There is finally enough
 *    width to put the zone, both bars and the purse on a single line, and that
 *    row costs about seven percent of the height instead of a quarter of it.
 *  - the six slots stand in a column down the LEFT edge, under the left thumb.
 *  - reveal, edit, swap and the minimap stack down the RIGHT edge, under the
 *    other one. This is the shape every landscape game on a phone converges on,
 *    and it is the same shape the desktop column has, for the same reason.
 *
 * A band across the foot — the thing that is right in portrait — would be the
 * single worst choice here: it would spend the scarce axis and leave the
 * plentiful one untouched.
 */
function landscapeLayout(
  screenW: number, screenH: number, u: number, safeTop: number, safeBottom: number,
  slotCount: number,
): MobileLayout {
  const gap = Math.max(2, Math.round(u * 0.06));
  const m = Math.max(2, Math.round(u * 0.08));

  /* --- one status row across the top -------------------------------------- */
  const rowH = Math.round(u * 0.62);
  const topH = safeTop + m + rowH + m;
  const rowY = safeTop + m;
  const infoW = Math.round(screenW * 0.26);
  const purseW = Math.round(Math.min(screenW * 0.24, u * 4.2));
  const info: Rect = { x: m, y: rowY, w: infoW, h: rowH };
  const purse: Rect = { x: screenW - m - purseW, y: rowY, w: purseW, h: rowH };
  const vitX = m + infoW + gap;
  const vitals: Rect = { x: vitX, y: rowY, w: Math.max(1, purse.x - gap - vitX), h: rowH };

  /* --- left column: the six slots, nothing else --------------------------- */
  const colY = topH + m;
  const colH = Math.max(1, screenH - safeBottom - m - colY);
  const slotW = Math.round(u * 1.15);
  /* Sideways the slots run down the LEFT edge as a column, so extra rows are
   * extra columns marching inward. Same rule as upright: the first six keep
   * the edge nearest the thumb and the overflow sits beside them. */
  const perCol = DECK_SLOTS;
  const cols = Math.max(1, Math.ceil(slotCount / perCol));
  const slotH = Math.min(Math.round(u * 1.02), Math.floor((colH - (perCol - 1) * gap) / perCol));
  const slotsH = perCol * slotH + (perCol - 1) * gap;
  const slotY0 = colY + Math.max(0, Math.round((colH - slotsH) / 2));
  const slots: Rect[] = [];
  for (let i = 0; i < slotCount; i++) {
    const col = Math.floor(i / perCol);
    slots.push({
      x: m + col * (slotW + gap),
      y: slotY0 + (i % perCol) * (slotH + gap),
      w: slotW, h: slotH,
    });
  }

  /* --- right column: map, then the controls ------------------------------- */
  const rightW = Math.round(u * 1.85);
  const rightX = screenW - m - rightW;
  /* All four full width, stacked. Splitting the reveal and the edit toggle onto
   * one shared row fitted, but on the smallest landscape phone it put them at
   * 41 CSS px across — under a fingertip, which the touch unit exists to
   * prevent. The column has height to spare and no reason to hoard it.
   *
   * Order is by reach, not by importance: the top of a side column is the
   * furthest thing from a thumb resting halfway down it. So the map, which is
   * only ever read, sits at the top, and the swap — which you hit mid-fight —
   * gets the easy middle. */
  let ry = colY;
  /* The map is a SQUARE and it is no longer the column's width.
   *
   * The skull needs a row, and there was nowhere to take one from: measured
   * across the three landscape phones the suite checks, the column already ran
   * within about ten pixels of its own floor. It came out of the minimap
   * instead, which is the only thing up here that is read rather than pressed
   * — so it is the only thing that can lose height without losing a fingertip.
   * Centred, because a square narrower than the column looks like a mistake
   * pinned to one edge and like a deliberate inset in the middle. */
  const mapSide = Math.round(u * 1.5);
  const minimap: Rect = {
    x: rightX + Math.round((rightW - mapSide) / 2), y: ry, w: mapSide, h: mapSide,
  };
  ry += mapSide + gap;
  /* The four mid-fight controls take the easy middle of the column, in the
   * order you reach for them: swap the weapon, mark something, decide whether
   * to follow it, decide whether you are fighting people. The reveal sits
   * below them because a panel is not a fight. */
  const swap: Rect = { x: rightX, y: ry, w: rightW, h: u };
  ry += u + gap;
  const atk: Rect = { x: rightX, y: ry, w: rightW, h: u };
  ry += u + gap;
  const chase: Rect = { x: rightX, y: ry, w: rightW, h: u };
  ry += u + gap;
  const skull: Rect = { x: rightX, y: ry, w: rightW, h: u };
  ry += u + gap;
  const menu: Rect = { x: rightX, y: ry, w: rightW, h: u };

  /* --- what is left is the world ------------------------------------------ */
  const mapTop = topH;
  const mapBottom = screenH;
  /* The map starts past ALL the slot columns, not past one. Reading `slotW`
   * alone was correct while there was exactly one column and would have put
   * the second one on top of the world. */
  const mapLeft = m + cols * slotW + (cols - 1) * gap + m;
  const mapRight = rightX - m;

  /* The drop-down still hangs horizontally under the status row: five tabs
   * stacked in the right column would be taller than the column is. */
  const tabsW = Math.max(1, mapRight - mapLeft);
  const DROP_COLS = 5; // the same 2x5 grid as portrait — see the note there
  const tabW = Math.floor((tabsW - (DROP_COLS - 1) * gap) / DROP_COLS);
  const tabY = topH + gap;
  const cell = (i: number): Rect => ({
    x: mapLeft + (i % DROP_COLS) * (tabW + gap),
    y: tabY + Math.floor(i / DROP_COLS) * (u + gap),
    w: tabW, h: u,
  });
  const tabs: Rect[] = DECK_TABS.map((_, i) => cell(i));
  const chat: Rect = cell(DECK_TABS.length);
  const edit: Rect = cell(DECK_TABS.length + 1);
  const look: Rect = cell(DECK_TABS.length + 2);
  const keysLess: Rect = cell(DECK_TABS.length + 3);
  const keysMore: Rect = cell(DECK_TABS.length + 4);

  /* A panel takes a LANE of the map rather than a band across it — width is
   * what this orientation has spare, so spending width is what costs least. */
  const sheet: Rect = { x: mapLeft, y: mapTop + gap, w: tabsW, h: Math.max(1, mapBottom - mapTop - 2 * gap) };

  return {
    on: true, landscape: true, u, gap, margin: m,
    topH, info, vitals, purse,
    menu, edit, swap, chase, atk, skull, chat, look, keysLess, keysMore, minimap, tabs,
    deckY: screenH, deckH: 0, slots,
    mapTop, mapBottom, mapLeft, mapRight, sheet,
  };
}

/**
 * Where the open panels go — one rect per panel, top to bottom.
 *
 * A phone can hold TWO. One was the first answer and it was wrong: every real
 * inventory job is a move between two places, and with a single sheet there is
 * no second place. Taking loot out of a corpse, putting a sword on the
 * paperdoll, moving a stack into a chest — all of them need both ends visible
 * at once, and none of them are optional.
 *
 * Two is also the ceiling. A third would give each about a hundred and thirty
 * pixels, which is one row of items and a title bar, and would leave no world
 * on screen at all.
 */
export function sheetSlots(d: MobileLayout, count: number, stripW = 0): Rect[] {
  if (!d.on || count <= 0) return [];
  /* A sheet never runs under the strip: two panels fighting for the same
   * pixels is how you end up unable to see which one you are dragging into. */
  const narrow = (r: Rect): Rect => (stripW > 0 ? { ...r, w: Math.max(1, r.w - stripW) } : r);
  if (count === 1) return [narrow(d.sheet)];
  if (d.landscape) {
    /* Side by side, because sideways it is WIDTH that is spare. Stacking two
     * panels here would give each about five tiles of height and leave half the
     * screen's width holding nothing. */
    const lane = narrow(d.sheet);
    const each = Math.floor((lane.w - d.gap * 2) / 2);
    return [
      { x: lane.x, y: lane.y, w: each, h: lane.h },
      { x: lane.x + each + d.gap * 2, y: lane.y, w: each, h: lane.h },
    ];
  }
  const mapH = Math.max(1, d.mapBottom - d.mapTop);
  /* The band grows when a second panel arrives. Splitting the one-panel band
   * would leave each half too short for a row of items plus its chrome, which
   * would make two panels useless exactly when you need them most. */
  const bandH = Math.min(mapH, Math.round(mapH * 0.76));
  const top = d.mapBottom - bandH;
  const gap = d.gap * 2;
  const each = Math.floor((bandH - gap) / 2);
  return [
    narrow({ x: d.sheet.x, y: top, w: d.sheet.w, h: each }),
    narrow({ x: d.sheet.x, y: top + each + gap, w: d.sheet.w, h: each }),
  ];
}

/**
 * The container strip: one column of slots down the right edge of the world.
 *
 * This is Radek's shape, and it beats a sheet on the only measurement that
 * matters — how much world you can still see while a bag is open. A sheet costs
 * about twelve tiles of HEIGHT out of twenty-two; the strip costs about two
 * tiles of WIDTH out of thirteen. Roughly twice the world, for the container
 * you keep open all the time.
 *
 * It is also not permanent: no container open, no strip, and the map is whole
 * again. That is what makes the trade cheap enough to take.
 */
export function stripRect(d: MobileLayout, hidden = 0): Rect {
  const w = Math.round(d.u * 1.6);
  /* Hard against the glass, not inset by the sheet's margin. The margin left a
   * finger-wide ribbon of world down the outside of the strip: too narrow to
   * see anything in, wide enough to make the strip look as though it had come
   * loose of the edge. */
  /* The map's right edge, which sideways is the inner edge of the control
   * column rather than the glass. */
  const right = d.landscape ? d.mapRight : d.sheet.x + d.sheet.w + d.margin;
  /* `hidden` slides it off to the right. Nothing about a pack you are carrying
   * says it has to be on screen while you fight, and shoving it away has to be
   * cheaper than closing it — closing loses your place in a sixteen-slot list. */
  const off = Math.round(w * Math.max(0, Math.min(1, hidden)));
  return { x: right - w + off, y: d.mapTop, w, h: d.mapBottom - d.mapTop };
}

/** The tab you grab to slide the strip away, and to bring it back. */
export function stripHandle(d: MobileLayout, s: Rect): Rect {
  const w = Math.max(2, Math.round(d.u * 0.4));
  const h = Math.round(d.u * 1.8);
  return { x: s.x - w, y: Math.round(s.y + (s.h - h) / 2), w, h };
}

/**
 * How much width the strip actually claims right now, tab included.
 *
 * The camera and the sheets both need this rather than the strip's own width:
 * once it is slid away there is nothing to steer around but the tab.
 */
export function stripClaim(d: MobileLayout, s: Rect, screenW: number): number {
  const right = d.on && d.landscape ? d.mapRight : screenW;
  return Math.max(0, right - stripHandle(d, s).x);
}

/**
 * Where the player sits ACROSS the screen, as a fraction of canvas width.
 *
 * The strip covers the right edge, so the middle of what you can actually see
 * is left of the middle of the glass. Without this the character stands two
 * tiles off-centre and everything that walks in from the right is already on
 * top of him before it appears.
 */
export function mapFocusFracX(d: MobileLayout, screenW: number, stripW: number): number {
  if (screenW <= 0) return 0.5;
  const left = d.on && d.landscape ? d.mapLeft : 0;
  const right = (d.on && d.landscape ? d.mapRight : screenW) - stripW;
  return (left + right) / 2 / screenW;
}

/** How far a sheet may be dragged: it must stay wholly inside the world band. */
export function sheetBand(d: MobileLayout): { top: number; bottom: number } {
  return { top: d.mapTop, bottom: d.mapBottom };
}

/** Is this point on either plate (and therefore not on the world)? */
export function overDeck(d: MobileLayout, sx: number, sy: number): boolean {
  if (!d.on) return false;
  if (sy < d.mapTop || sy >= d.deckY) return true;
  // sideways there are two more bands, down the sides
  return d.landscape && (sx < d.mapLeft || sx >= d.mapRight);
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
