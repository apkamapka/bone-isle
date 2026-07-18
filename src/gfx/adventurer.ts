/**
 * The Adventurer outfit (Etap 13) — the player's hand-drawn pixel maps, one
 * per facing. `left` is `side` mirrored at draw time, so only three exist.
 *
 * Authored in the same idiom as the NPC sprites in sprites.ts: 10x13, glyphs
 * from PAL, hands as bare `s` at the arm row, boots as `..kk..kk..`. What sets
 * the hero apart from the townsfolk is the peaked hood and the quiver — gold
 * fletching (`c`) over the shoulder on the side and back views.
 *
 * Dye glyphs (re-tinted by the Wardrobe):
 *   h/H = hood (light / shade) · r/R = tunic · p/P = legs
 * Everything else is fixed: `s` skin, `k` boots and belt, `c`/`b` the quiver.
 */

export const ADV_DOWN: readonly string[] = [
  "...hhhh...",
  "..hhhhhh..",
  ".hhhhhhhh.",
  ".hhssssHh.",
  ".hsessesh.",
  "..Hssssh..",
  ".HrrrrrrH.",
  "srrrrrrrrs",
  ".rRrrrrRr.",
  "..kkkkkk..",
  ".pppppppp.",
  "..pP..Pp..",
  "..kk..kk..",
];

export const ADV_SIDE: readonly string[] = [
  "...hhhh...",
  "..hhhhhh..",
  ".hhhhhsss.",
  ".hhhhsess.",
  "..hhssss..",
  ".cHrrrrr..",
  "ccHrrrrrs.",
  ".cRrrrrR..",
  "..rrrrrr..",
  "..kkkkkk..",
  "..pppppp..",
  "...pP.pP..",
  "...kk.kk..",
];

export const ADV_UP: readonly string[] = [
  "...hhhh...",
  "..hhhhhh..",
  ".hhhhhhhh.",
  ".hhhhhhhh.",
  "..hhhhhh..",
  ".HrrrrccH.",
  "srrrrrcrrs",
  ".rRrrrbRr.",
  ".rrrrrbrr.",
  "..kkkkkk..",
  ".pppppppp.",
  "..pP..Pp..",
  "..kk..kk..",
];
