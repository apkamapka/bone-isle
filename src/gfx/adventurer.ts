/**
 * The Adventurer outfit (Etap 15) — the player's hand-drawn pixel maps, one
 * per facing. `left` is `side` mirrored at draw time, so only three exist.
 *
 * Deliberately NOT the NPC template. Townsfolk are 10x13 and unoutlined so
 * they sit back into the scenery; the hero is 12x16 and carries a dark `e`
 * outline all the way round, which is what stops him dissolving into grass at
 * a glance. The peaked hood breaks the boxy NPC silhouette, gold (`c`) picks
 * out the cloak clasp and belt buckle, and the quiver reads as fletching over
 * the shoulder on the side and back views. Bottom-anchored, so the extra three
 * rows of height simply stand him taller than everyone else.
 *
 * Dye glyphs (re-tinted by the Wardrobe):
 *   h/H = hood and cloak (light / shade) - r/R = tunic - p/P = legs
 * Fixed: `e` outline, `s` skin, `k` boots and belt, `c` gold, `b` quiver.
 */

export const ADV_DOWN: readonly string[] = [
  "....eeee....",
  "...ehhhhe...",
  "..ehhhhhhe..",
  ".ehhssssHhe.",
  ".ehsesseshe.",
  ".eHhssssHHe.",
  ".eHHHHHHHHe.",
  "esHrrrrrrHse",
  "esHrrccrrHse",
  ".eHrRrrRrHe.",
  ".eHrrrrrrHe.",
  ".ekkkcckkke.",
  ".eppppppppe.",
  ".epPe..ePpe.",
  ".ekke..ekke.",
  ".eeee..eeee.",
];

export const ADV_SIDE: readonly string[] = [
  "....eeee....",
  "...ehhhhhe..",
  "..ehhhhhsse.",
  "..ehhhhsess.",
  "..eHhhssss..",
  "..eHHHHHss..",
  ".ceHHHHHHe..",
  "cceHrrrrHse.",
  ".ceHrrrrHe..",
  "..eHrRrrHe..",
  "..eHrrrrHe..",
  "..ekkkkkke..",
  "..eppppppe..",
  "..epPe.ePpe.",
  "..ekke.ekke.",
  "..eeee.eeee.",
];

export const ADV_UP: readonly string[] = [
  "....eeee....",
  "...ehhhhe...",
  "..ehhhhhhe..",
  ".ehhhhhhhhe.",
  ".ehhhhhhhhe.",
  ".eHHhhhhHHe.",
  ".eHHHHHHHHe.",
  "esHrrccrrHse",
  "esHrrccrrHse",
  ".eHrRccRrHe.",
  ".eHrrbbrrHe.",
  ".ekkkkkkkke.",
  ".eppppppppe.",
  ".epPe..ePpe.",
  ".ekke..ekke.",
  ".eeee..eeee.",
];
