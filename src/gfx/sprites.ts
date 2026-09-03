/**
 * Sprite atlas: palette, the pixel-map baker and every sprite in the game.
 * All graphics are tiny string maps rendered once onto offscreen canvases.
 */
import { rndi } from "../util.ts";
import { SPRITE_SCALE, ACTOR_SCALE } from "../config.ts";

/** Single-character color palette used by pixel maps. */
export const PAL: Readonly<Record<string, string>> = {
  k: "#2b2017", e: "#1c1410",
  s: "#eab984", h: "#6e4a2a", H: "#4a3320",
  r: "#a8432f", R: "#7d2f20",
  p: "#46604a", P: "#33483a",
  m: "#cfd8da", M: "#8a989e",
  w: "#efe9d6", W: "#bdb59c",
  g: "#6f9c3f", G: "#4c702a",
  c: "#e3b341", C: "#9a7424",
  b: "#5b3b22", t: "#7a4a28",
  y: "#d8b75a",
  u: "#8a6cff", U: "#5a3fd0", x: "#4a4a52",
};

/**
 * The 1x source every upscaled sprite came from. The static terrain canvas is
 * painted at MAP_TILE (legacy) resolution, so the decor it bakes in needs the
 * ORIGINAL artwork — looking it up here beats downsampling the chunky copy,
 * which would lean on the browser's nearest-neighbour downscale being exact.
 */
const nativeSrc = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

/** The unscaled art a sprite was baked from (itself, if it was never scaled). */
export function spriteSource(spr: HTMLCanvasElement): HTMLCanvasElement {
  return nativeSrc.get(spr) ?? spr;
}

/** What each baked sprite was magnified by. Props sit at SPRITE_SCALE, actors
 *  at ACTOR_SCALE, future native art at 1 — so anything reasoning about "art
 *  pixels" has to ask rather than assume. */
const bakedAt = new WeakMap<HTMLCanvasElement, number>();

/** The magnification a sprite was baked at (1 for native artwork). */
export function spriteZoom(spr: HTMLCanvasElement): number {
  return bakedAt.get(spr) ?? 1;
}

/**
 * Adopt artwork that came from a PNG rather than from `bake()`.
 *
 * Everything reasoning about "art pixels" — icon sizing above all — asks
 * `spriteZoom()`, which answers 1 for anything it has never seen. External
 * sheets are authored at world scale (2x the legacy 16-px art), so they must
 * be registered or every icon drawn from them comes out half size.
 */
export function adoptSprite(c: HTMLCanvasElement, zoom = SPRITE_SCALE): HTMLCanvasElement {
  bakedAt.set(c, zoom);
  nativeSrc.set(c, c);
  return c;
}

/** Artwork replacing the procedural tree, once a PNG has been loaded. */
let treeArt: HTMLCanvasElement | null = null;

/** Swap in (or clear, with null) the tree artwork used by every new tree. */
export function setTreeArt(c: HTMLCanvasElement | null): void {
  treeArt = c;
}

/** True once external prop artwork is in use — the renderer then skips its own
 *  drop shadows, because the artwork already has them painted in. */
export function hasPropArt(): boolean {
  return treeArt !== null;
}

/** Nearest-neighbour blow-up of a freshly painted canvas. Registered against
 *  its source so spriteSource() can find the original later. */
function upscale(src: HTMLCanvasElement, s: number): HTMLCanvasElement {
  if (s === 1) return src;
  const c = document.createElement("canvas");
  c.width = src.width * s;
  c.height = src.height * s;
  const x = c.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0, c.width, c.height);
  nativeSrc.set(c, src);
  bakedAt.set(c, s);
  return c;
}

/**
 * Paint `w` x `h` pixels of LEGACY (16-px-era) artwork and hand back a
 * SPRITE_SCALE nearest-neighbour blow-up. Every existing baker draws through
 * this with its coordinates untouched: one old pixel becomes one solid block,
 * so the result is the old sprite exactly, four times the pixels.
 */
export function legacyBake(
  w: number,
  h: number,
  draw: (x: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const src = document.createElement("canvas");
  src.width = w;
  src.height = h;
  draw(src.getContext("2d")!);
  return upscale(src, SPRITE_SCALE);
}

/**
 * Bake a string pixel-map into an offscreen canvas ('.' = transparent).
 * `over` remaps selected palette glyphs to custom colors — the outfit system
 * uses it to re-tint the player sprite without a second pixel map.
 *
 * `scale` defaults to SPRITE_SCALE, i.e. every map in this file is treated as
 * LEGACY 16-px-era art and doubled. Maps drawn natively for a 32-px tile pass
 * 1 (or call bakeNative) and are used at their own resolution.
 */
export function bake(
  map: readonly string[],
  over?: Readonly<Record<string, string>>,
  scale: number = SPRITE_SCALE,
): HTMLCanvasElement {
  const h = map.length;
  const w = map[0].length;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const ch = map[j][i];
      if (ch === ".") continue;
      x.fillStyle = over?.[ch] ?? PAL[ch] ?? ch;
      x.fillRect(i, j, 1, 1);
    }
  }
  return upscale(c, scale);
}

/** Bake a pixel map drawn natively for a 32-px tile — no upscaling. */
export function bakeNative(
  map: readonly string[],
  over?: Readonly<Record<string, string>>,
): HTMLCanvasElement {
  return bake(map, over, 1);
}

/**
 * On-screen size of a baked sprite drawn at `zoom` px per LEGACY art pixel.
 * The HUD authored all its icon sizes against 16-px-era art, so it divides the
 * bake scale straight back out and every icon keeps the footprint it had.
 */
export function iconW(spr: HTMLCanvasElement, zoom: number): number {
  return (spr.width * zoom) / spriteZoom(spr);
}
export function iconH(spr: HTMLCanvasElement, zoom: number): number {
  return (spr.height * zoom) / spriteZoom(spr);
}

/**
 * The player's pixel map, exported so the outfit system can re-bake it with
 * custom colors. Glyph roles the Wardrobe re-tints:
 *   h = hair · r/R = tunic (primary, R = shaded) · p/P = legs (secondary).
 */
export const PLAYER_MAP: readonly string[] = [
  "..hhhhhh..",
  ".hhhhhhhh.",
  ".hssssssh.",
  ".hsessesh.",
  "..ssssss..",
  ".rrrrrrrr.",
  "srrrrrrrrs",
  ".rRrrrrRr.",
  ".rrrrrrrr.",
  "..kkkkkk..",
  ".pppppppp.",
  "..pP..Pp..",
  "..kk..kk..",
];

export const SPR = {
  player: bake(PLAYER_MAP),
  /* ---- Etap 22 equipment stubs -------------------------------------- *
   * Five shapes, one per slot, shared by all sixty pieces of the new gear
   * catalog and every weapon in it. They exist so the catalog can go into
   * the game before the pixel art does; each item peels off onto its own
   * bake as the art arrives. Slot-distinct on purpose (a helm reads as a
   * helm) but flat and ugly, so nothing here can quietly ship as final.
   * ------------------------------------------------------------------ */
  gearStubHead: bake([
    "..llll..",
    ".lllll l",
    "l ll ll ",
    "l lllll ",
    ".l llll.",
    "..l ll..",
  ]),
  gearStubBody: bake([
    ".l llll.",
    "llllllll",
    "llll lll",
    "llllllll",
    "llll lll",
    "llllllll",
    ".llllll.",
  ]),
  gearStubLegs: bake([
    "llllllll",
    "llll lll",
    "lll  lll",
    "ll.  .ll",
    "ll.  .ll",
    "ll.  .ll",
  ]),
  gearStubBoots: bake([
    "........",
    "ll....ll",
    "ll....ll",
    "lll..lll",
    "llll llll",
  ]),
  gearStubShield: bake([
    ".llllll.",
    "llllllll",
    "lll  lll",
    "llll lll",
    ".llllll.",
    "..llll..",
    "...ll...",
  ]),
  gearStubWeapon: bake([
    "....ll..",
    "...lll..",
    "..lll...",
    ".lll....",
    "lll.....",
    "ll......",
    "l.......",
  ]),
  /**
   * PLACEHOLDER, shared by every creature of the human ladder that has no art
   * of its own yet (nineteen of them as of Etap 20). Deliberately ugly and
   * deliberately identical: a slate-grey figure with a violet sash, so a
   * screenshot instantly says "this one is not drawn yet" instead of quietly
   * passing for finished work. Each creature gets its own sheet later and
   * drops off this bake one at a time — see the mobArt registry, which already
   * overrides this the moment a PNG lands.
   */
  humanFoe: bake([
    "...ssss...",
    "..ssssss..",
    "..sessse..",
    "..ssssss..",
    "...ssss...",
    "..xxxxxx..",
    ".xxxxxxxx.",
    ".xuuuuuux.",
    "..xxxxxx..",
    "..xxxxxx..",
    "...x..x...",
    "...x..x...",
    "..kk..kk..",
  ]),
  sword: bake(["..m", ".mm", ".m.", "mm.", "kk.", ".b."]),
  skeleton: bake([
    "...wwww...",
    "..wwwwww..",
    "..wewwew..",
    "..wwwwww..",
    "...w..w...",
    "..wwwwww..",
    ".w.wwww.w.",
    "..w.WW.w..",
    "..wwwwww..",
    "...wWWw...",
    "...w..w...",
    "..ww..ww..",
    "..W....W..",
  ]),
  goblin: bake([
    "g..gggg..g",
    "gGgggggGgg",
    ".gggggggg.",
    ".geggggeg.",
    ".ggGGGGgg.",
    "..gggggg..",
    "g.bbbbbb.g",
    ".gbbbbbbg.",
    "..bbbbbb..",
    "..gg..gg..",
    "..GG..GG..",
  ]),
  bones: bake([
    "w......w",
    ".w.ww.w.",
    "..wWWw..",
    ".w.ww.w.",
    "w......w",
  ]),
  coin: bake([
    ".ccccc.",
    "ccccCcc",
    "ccCcccc",
    "cccccCc",
    ".cCccc.",
  ]),
  /** Platinum: the same die struck in white metal, so a purse reads at a
   *  glance — one pale coin is a hundred yellow ones. */
  platinumCoin: bake([
    ".mmmmm.",
    "mmmmMmm",
    "mmMmmmm",
    "mmmmmMm",
    ".mMmmm.",
  ]),
  pack: bake([
    ".hhhh.",
    "hccchh",
    "hhhhhh",
    "hhcchh",
    "hhhhhh",
    "hhhhhh",
    ".hhhh.",
  ]),
  wood: bake([
    "..tttttt",
    ".tbbbbbt",
    "tWtbbbbt",
    ".tbbbbbt",
    "..tttttt",
  ]),
  stoneIcon: bake([".MMMm.", "Mmmmmm", "Mmmmmm", ".MMMM."]),
  mushroom: bake([
    ".rrrrr.",
    "rrwrrwr",
    "rRrrrrR",
    "..www..",
    "..wWw..",
  ]),
  rock: bake([
    "...MMMm...",
    "..MmmmmM..",
    ".Mmmmmmmm.",
    "MmmmmmmmmM",
    "MMmmmmmMM.",
    ".MMMMMMM..",
  ]),
  /** Level-gate portcullis: iron bars sealing a Sanctum doorway. */
  gate: bake([
    "dddddddddddddddd",
    ".I..I..I..I..I..",
    ".I..I..I..I..I..",
    "dddddddddddddddd",
    ".I..I..I..I..I..",
    ".I..I..I..I..I..",
    ".I..I..I..I..I..",
    "dddddddddddddddd",
    ".I..I..I..I..I..",
    ".I..I..I..I..I..",
    ".v..v..v..v..v..",
  ], { d: "#2f3436", I: "#6b7276", v: "#1f2325" }),
  stump: bake([".tttttt.", "tWWwWWtt", "ttttttt.", ".tt..tt."]),
  rubble: bake(["..M..m..", ".mm.MM.m", "M.mm..m."]),
  // equipment slot glyphs
  eqHead: bake(["..mmmm..", ".mmmmmm.", ".mMmmMm.", ".mmmmmm.", "..m..m.."]),
  eqAmulet: bake([".c....c.", "c......c", "c......c", ".c....c.", "..cCCc..", "...cc..."]),
  eqAol: bake([".c....c.", "c......c", "c......c", ".c....c.", "..uuuu..", "..uUUu..", "...uu..."]),
  eqArrow: bake(["......mm", ".....mmm", "....mm..", "b..mm...", ".bmm....", "..b....."]),
  eqBody: bake(["m.mmmm.m", "mmmmmmmm", ".mMmmMm.", ".mmmmmm.", ".mmmmmm."]),
  eqShield: bake([".mmmmmm.", ".mMmmMm.", ".mmmmmm.", "..mmmm..", "...mm..."]),
  eqRing: bake(["..cccc..", ".c....c.", ".c....c.", "..cccc.."]),
  eqLegs: bake([".pppppp.", ".pp..pp.", ".pp..pp.", ".pp..pp."]),
  eqBoots: bake(["..b.....", "..b.....", "..bbb...", "..bbbb.."]),
  orc: bake([
    "..GGGGGG..",
    ".GGGGGGGG.",
    ".GeGGGGeG.",
    ".GGwGGwGG.",
    "..GGGGGG..",
    "b.tttttt.b",
    ".bttttttb.",
    "b.tttttt.b",
    "..tttttt..",
    "..GG..GG..",
    "..bb..bb..",
    ".bb....bb.",
  ]),
  rat: bake([
    "..MMMM..",
    ".MmmmmM.",
    "MmkmmkmM",
    "MmmmmmmM",
    "MmmwwmmM",
    ".MmmmmMh",
    "..M..Mhh",
  ]),
  minotaur: bake([
    "w..h..h..w..",
    ".ww.hh.ww...",
    "..httttth...",
    "..htkttkth..",
    "..httttth...",
    "..hhwwwwhh..",
    "...tttttt...",
    "..tttttttt..",
    ".bttttttttb.",
    ".bttttttttb.",
    "..tt....tt..",
    "..bb....bb..",
  ]),
  // ---- Etap 8 bestiary ----
  snake: bake([
    "........",
    ".ggg....",
    "gGrgg...",
    "gg.ggg..",
    "....ggg.",
    "..ggggG.",
    ".gGgg...",
    ".gg.....",
  ]),
  ghoul: bake([
    "..pppppp..",
    ".pppppppp.",
    ".prpppprp.",
    ".pppwwppp.",
    "..pppppp..",
    "p.PPPPPP.p",
    ".pPPPPPPp.",
    "..PPPPPP..",
    "..pp..pp..",
    "..P....P..",
  ]),
  orcArcher: bake([
    "..GGGGGG..",
    "..GGGGGGG.",
    ".GeGGGGeG.",
    ".GGwGGwGG.",
    "m.GGGGGG..",
    "mbtttttt.b",
    "mbttttttb.",
    "m.tttttt.b",
    "..tttttt..",
    "..GG..GG..",
    "..bb..bb..",
  ]),
  orcWarrior: bake([
    "..MMMMMM..",
    ".MMMMMMMM.",
    ".GeGGGGeG.",
    ".GGwGGwGG.",
    "..GGGGGG..",
    "m.MMMMMM.m",
    ".mMMMMMMm.",
    "b.MMMMMM.b",
    "..MMMMMM..",
    "..GG..GG..",
    "..bb..bb..",
    ".bb....bb.",
  ]),
  minotaurArcher: bake([
    "w..h..h..w..",
    ".ww.hh.ww..b",
    "..httttth.b.",
    "..htkttkthb.",
    "..httttthb..",
    "..hhwwwwhb..",
    "...ttttttb..",
    "..ttttttthb.",
    ".bttttttttb.",
    ".bttttttttb.",
    "..tt....tt..",
    "..bb....bb..",
  ]),
  orcShaman: bake([
    "..GGGGGG..",
    ".GGGGGGGG.",
    ".GeGGGGeG.",
    ".GGwGGwGG.",
    "..GGGGGG..",
    "c.uuuuuu.c",
    ".cuuUUuuc.",
    "..uuuuuu..",
    "..uUuuUu..",
    "..uuuuuu..",
    "..uu..uu..",
  ]),
  orcBerserker: bake([
    "..GGGGGG..",
    ".GGrGGrGG.",
    ".GeGGGGeG.",
    ".GrwGGwrG.",
    "..GGGGGG..",
    "m.rttttr.m",
    "mmttttttmm",
    "m.tttttt.m",
    "..tttttt..",
    "..GG..GG..",
    "..bb..bb..",
    ".bb....bb.",
  ]),
  minotaurGuard: bake([
    "w..h..h..w..",
    ".ww.hh.ww...",
    "..hMMMMMh...",
    "..hMkMMkMh..",
    "..hMMMMMh...",
    "..hhwwwwhh..",
    "...MMMMMM...",
    "..MMMMMMMM..",
    ".bMMMMMMMMb.",
    ".bMMMMMMMMb.",
    "..MM....MM..",
    "..bb....bb..",
  ]),
  minotaurMage: bake([
    "w..h..h..w..",
    ".ww.hh.ww...",
    "..httttth...",
    "..htuttuth..",
    "..httttth...",
    "..hhwwwwhh..",
    "...uuuuuu...",
    "..uuuUUuuu..",
    ".cuuuuuuuuc.",
    ".cuuuUUuuuc.",
    "..uu....uu..",
    "..UU....UU..",
  ]),
  dragon: bake([
    "g...........g...",
    "gg....ggg...gg..",
    "ggg..ggggg.ggg..",
    ".gggggrgggggg...",
    ".ggggggggGggg...",
    "..gGgggggggggg..",
    "..ggggggggggggg.",
    ".ggGGGGGGGGgggg.",
    "gggGcccccGGgggg.",
    "gggGGGGGGGGggg..",
    ".ggggggggggggG..",
    ".gg.gggggggg.G..",
    ".G..gG..Gg......",
    ".G..G....G......",
  ]),
  caveMouth: bake([
    "......xxxxxxxxxx......",
    "....xxMMMMMMMMMMxx....",
    "...xMMMMMMMMMMMMMMx...",
    "..xMMMkkkkkkkkkkMMMx..",
    "..xMMkkkkkkkkkkkkMMx..",
    ".xMMkkkkeeeeeekkkkMMx.",
    ".xMkkkeeeeeeeeeekkkMx.",
    ".xMkkkeeeeeeeeeekkkMx.",
    ".xMMkkkeeeeeeeekkkMMx.",
    ".xMMkkkkkkkkkkkkkMMxx.",
    "..xMMkkkkkkkkkkkMMx...",
    "..xMMMMkkkkkkMMMMx....",
    "...xMMMMMMMMMMMMx.....",
    "....xMMMMMMMMMMx......",
    ".....xxMMMMMMxx.......",
    ".......xxxxxx.........",
  ]),
  ladder: bake([
    "t......t",
    "tttttttt",
    "t......t",
    "t......t",
    "tttttttt",
    "t......t",
    "t......t",
    "tttttttt",
    "t......t",
    "t......t",
    "tttttttt",
    "t......t",
  ]),
  // --- NPCs ---
  npcSmith: bake([
    "..hhhhhh..",
    ".hhhhhhhh.",
    ".hssssssh.",
    ".hsessesh.",
    "..sshhss..",
    ".MMMMMMMM.",
    "sMMMMMMMMs",
    ".MbbbbbbM.",
    ".Mbbbbbbm.",
    "..kkkkkk..",
    ".bbbbbbbb.",
    "..bb..bb..",
    "..kk..kk..",
  ]),
  npcHerbalist: bake([
    "..gggggg..",
    ".gggggggg.",
    ".gssssssg.",
    ".gsessesg.",
    "..ssssss..",
    ".GGGGGGGG.",
    "sGGGGGGGGs",
    ".GgGGGGgG.",
    ".GGGGGGGG.",
    "..GGGGGG..",
    ".GGGGGGGG.",
    "..GG..GG..",
    "..kk..kk..",
  ]),
  npcElder: bake([
    "..wwwwww..",
    ".wwwwwwww.",
    ".wssssssw.",
    ".wsessesw.",
    "..ssWWss..",
    ".WWWWWWWW.",
    "sWWWWWWWWs",
    ".WcWWWWcW.",
    ".WWWWWWWW.",
    "..WWWWWW..",
    ".WWWWWWWW.",
    "..WW..WW..",
    "..kk..kk..",
  ]),
  // Vesper the Tailor — Bonetown's outfitter. Violet robe (the u/U dyes she
  // sells), a measuring band across the chest, pins in her dark hair.
  npcTailor: bake([
    "..kkkkkk..",
    ".kkkkkkkk.",
    ".kssssssk.",
    ".ksessesk.",
    "..ssssss..",
    ".uuuuuuuu.",
    "suuywyuuus",
    ".uUuuuuUu.",
    ".uuuuuuuu.",
    "..UUUUUU..",
    ".uuuuuuuu.",
    "..uU..Uu..",
    "..kk..kk..",
  ]),
  // TEST item: the Dopalacz — a fizzing violet-gold brew, unmistakable in the bag
  boosterPotion: bake([
    "..y..",
    ".kyk.",
    ".uuu.",
    "uUuuu",
    "uuyuu",
    ".uuu.",
  ]),
  // Chronos the Time Sage — the wizard under Bonetown. Slate star-hat, white
  // beard down the chest, ice-pale robe. Only a stand-in: the LPC walk sheet
  // (public/npc-timesage.png) replaces him the moment it loads.
  npcTimesage: bake([
    "...kkkk...",
    "..kkyykk..",
    ".kkkkkkkk.",
    ".kssssssk.",
    ".ksessesk.",
    "..wwwwww..",
    ".WWwwwwWW.",
    "sWWWWWWWWs",
    ".WWyyyyWW.",
    ".WWWWWWWW.",
    "..WWWWWW..",
    ".WWWWWWWW.",
    "..WW..WW..",
    "..kk..kk..",
  ]),
  npcTaskmaster: bake([
    "..tttttt..",
    ".tttttttt.",
    ".tsssssst.",
    ".tsessest.",
    "..sshhss..",
    ".gGgGgGgG.",
    "gGGGGGGGGg",
    ".GGgGGgGG.",
    ".GGGGGGGG.",
    "..GGGGGG..",
    ".GGGGGGGG.",
    "..GG..GG..",
    "..kk..kk..",
  ]),
  // --- corpse + ground items ---
  corpse: bake([
    "...ww.....",
    ".wWwwwW.w.",
    "wwwwwwwwww",
    ".WwwWWwwW.",
    "..w....w..",
  ]),
  meatIcon: bake([
    ".rrrr..",
    "rrrRrr.",
    "rRrrrrw",
    ".rrrr.w",
  ]),
  potionRed: bake([
    "..ww..",
    "..ww..",
    ".rrrr.",
    "rrRrrr",
    "rrrrrr",
    ".rrrr.",
  ]),
  potionBlue: bake([
    "..ww..",
    "..ww..",
    ".MMMM.",
    "MmMMMM",
    "MMMMMM",
    ".MMMM.",
  ]),
  crystalHeal: bake([
    "..ww..",
    ".wggw.",
    "wggggw",
    "gggggg",
    ".gGGg.",
    "..GG..",
  ]),
  crystalRecall: bake([
    "..ww..",
    ".wmmw.",
    "wmmmmw",
    "mmmmmm",
    ".mMMm.",
    "..MM..",
  ]),
  /* The Essence of Magic: no element of its own, so it borrows all of them —
   * a pale core with the five tints caught in its facets. It is the one thing
   * in the bag that should look like it does not belong to any single lane. */
  magicEssence: bake([
    "..W..",
    ".WfW.",
    "WiWeW",
    ".WsW.",
    "..h..",
  ], { W: "#efe6ff", f: "#ff8a3a", i: "#7cd4ff", e: "#8ab661", s: "#ffce4a", h: "#b58aff" }),
  /* ---- Etap 24: forge materials and creature trophies ----------------
   * Ingots read by silhouette first (a trapezoid bar) and by tint second,
   * because iron and steel sit next to each other in every bag and the
   * difference between them has to survive a 16-px icon. */
  ironIngot: bake([
    ".....",
    ".mmm.",
    "mMMMm",
    "mMMMm",
    ".ddd.",
  ], { m: "#9aa0a8", M: "#7b828b", d: "#4a5058" }),
  steelIngot: bake([
    ".....",
    ".sss.",
    "sSHSs",
    "sSSSs",
    ".ddd.",
  ], { s: "#cfe3f2", S: "#9fc0d8", H: "#eaf6ff", d: "#5a6f80" }),
  essentialGem: bake([
    "..g..",
    ".gGg.",
    "gGHGg",
    ".gGg.",
    "..g..",
  ], { g: "#7a4fc0", G: "#b58aff", H: "#f0e4ff" }),
  coalLump: bake([
    ".kk..",
    "kKKk.",
    "kKKKk",
    ".kkk.",
  ], { k: "#2b2b30", K: "#4a4a52" }),
  minotaurHorn: bake([
    "...hH",
    "..hh.",
    ".hh..",
    "bhh..",
    "bb...",
  ], { h: "#d8cdb0", H: "#f2ecd8", b: "#8a7a58" }),
  orcEar: bake([
    "..e..",
    ".eEe.",
    "eEEe.",
    ".eEe.",
    "..e..",
  ], { e: "#4e7a3c", E: "#7aa85c" }),
  goblinFang: bake([
    ".ff..",
    ".fFf.",
    "..ff.",
    "..f..",
  ], { f: "#d8d2c0", F: "#f4f0e2" }),
  cursedRib: bake([
    "..rr.",
    ".rRr.",
    ".rR..",
    "rRr..",
    "rr...",
  ], { r: "#a8a290", R: "#ded8c4" }),
  // ---- Deep Wildlands camp decorations ----
  hut: bake([
    "......cc......",
    "....cccccc....",
    "..cCccccccCc..",
    ".cccCccccCccc.",
    "cCccccccccccCc",
    ".tttttttttttt.",
    ".ttbttttttbtt.",
    ".ttbttkkttbtt.",
    ".ttbttkkttbtt.",
    ".ttttttttttt..",
  ]),
  tent: bake([
    ".....mm.....",
    "....mMMm....",
    "...mMmmMm...",
    "..mMmmmmMm..",
    ".mMmmkkmmMm.",
    "mMmmmkkmmmMm",
  ]),
  gravestone: bake([
    ".MMMM.",
    "MmmmmM",
    "MmMMmM",
    "MmmmmM",
    "MmMMmM",
    "MmmmmM",
    "xMMMMx",
  ]),
  skullPole: bake([
    ".www.",
    "wwkww",
    "wwwww",
    ".w.w.",
    "..b..",
    "..b..",
    "..b..",
    "..b..",
    "..b..",
    "..b..",
  ]),
  campfire: bake([
    "...rr...",
    "..rccr..",
    ".rccccr.",
    ".rcRRcr.",
    "b.rrrr.b",
    ".bbkkbb.",
    "b..bb..b",
  ]),
  web: bake([
    "w...w...w",
    ".w..w..w.",
    "..w.w.w..",
    "www.w.www",
    "..w.w.w..",
    ".w..w..w.",
    "w...w...w",
  ]),
  scorch: bake([
    "..ee.e.ee...",
    ".eekeeekee..",
    "eekkeeekkee.",
    ".eekeekeee..",
    "..ee..ee....",
  ]),
  // ---- Etap 8 item icons ----
  venomGland: bake([
    ".ggg.",
    "gGggg",
    "ggGgg",
    ".ggg.",
  ]),
  ghoulClaw: bake([
    "w..w.",
    ".ww.w",
    ".pww.",
    "..pw.",
    "..pp.",
  ]),
  dragonScaleIcon: bake([
    ".ggg.",
    "gGgGg",
    "ggggg",
    ".gGg.",
    "..g..",
  ]),
  dragonHam: bake([
    ".rrrr.w",
    "rrRrrww",
    "rRrrrw.",
    ".rrrr..",
  ]),
  bow: bake([
    ".hh.",
    "h..M",
    "h..M",
    "h..M",
    "h..M",
    ".hh.",
  ]),
  longbow: bake([
    ".hh..",
    "h..M.",
    "h..M.",
    "h.cM.",
    "h..M.",
    "h..M.",
    ".hh..",
  ]),
  arrow: bake([
    ".M.",
    "MMM",
    ".b.",
    ".b.",
    "cbc",
  ]),
  boneArrow: bake([
    ".w.",
    "www",
    ".W.",
    ".W.",
    "cWc",
  ]),
  // Training arrow: a blunt wooden practice shaft — no steel head, straw
  // fletching. Only the Archery Range's straw butt can catch it.
  trainingArrow: bake([
    ".t.",
    ".b.",
    ".b.",
    ".b.",
    "yby",
  ]),
} as const;

export type SpriteName = keyof typeof SPR;

/** Props whose baked art a PNG may replace at runtime. */
export type PropName = "rock" | "stump" | "rubble";

/** SPR is frozen (`as const`) and `SpriteName` is derived from it, so loaded
 *  artwork lives in this side table instead of being written back into it. */
const propOverride: Partial<Record<PropName, HTMLCanvasElement>> = {};

/** Install artwork for a prop; pass nothing to fall back to the baked sprite. */
export function setPropArt(k: PropName, c: HTMLCanvasElement | null): void {
  if (c) propOverride[k] = c;
  else delete propOverride[k];
}

/** The sprite to draw for a prop: loaded artwork if there is any, else baked. */
export function propSprite(k: PropName): HTMLCanvasElement {
  return propOverride[k] ?? SPR[k];
}

/** Tall sketchy conifer — every call produces a slightly different tree. */
export function bakeTree(): HTMLCanvasElement {
  if (treeArt) return treeArt;
  return legacyBake(16, 28, (x) => {
    const greens = ["#2f5226", "#3f6d33", "#5d8f3f"] as const;
    x.fillStyle = PAL.t;
    x.fillRect(7, 22, 2, 6);
    x.fillStyle = "#4a2c16";
    x.fillRect(7, 27, 2, 1);
    x.fillRect(6, 26, 1, 2);
    const layers: ReadonlyArray<readonly [number, number]> = [[22, 7], [16, 6], [10, 4]];
    let tip = 4;
    for (const [bottom, halfw] of layers) {
      const top = bottom - 8;
      for (let row = top; row < bottom; row++) {
        const t = (row - top) / (bottom - top);
        const half = Math.max(1, Math.round(halfw * t) + rndi(-1, 0));
        x.fillStyle = greens[1];
        x.fillRect(8 - half, row, half * 2, 1);
        x.fillStyle = greens[2];
        x.fillRect(8 - half, row, 1 + (row % 2), 1);
        x.fillStyle = greens[0];
        x.fillRect(8 + half - 1 - (row % 2), row, 1 + (row % 2), 1);
        if (Math.random() < 0.7) {
          x.fillStyle = "#1e3a19";
          x.fillRect(8 - half, row, 1, 1);
          x.fillRect(8 + half - 1, row, 1, 1);
        }
      }
      tip = top;
    }
    x.fillStyle = "#1e3a19";
    x.fillRect(7, tip, 2, 2);
    x.fillStyle = "#5d8f3f";
    x.fillRect(7, tip + 1, 1, 1);
  });
}

export function bakeForge(): HTMLCanvasElement {
  return legacyBake(28, 26, (x) => {
    x.fillStyle = "#4f5557"; x.fillRect(18, 2, 7, 10);
    x.fillStyle = "#7d8487"; x.fillRect(19, 3, 5, 8);
    x.fillStyle = "#2f3436"; x.fillRect(18, 2, 7, 1);
    x.fillStyle = "#5f6669"; x.fillRect(2, 10, 24, 15);
    x.fillStyle = "#7d8487"; x.fillRect(3, 11, 22, 13);
    x.fillStyle = "#999fa2";
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 4; i++)
        x.fillRect(4 + i * 5 + (j % 2) * 2, 12 + j * 4, 4, 3);
    x.fillStyle = "#1c1410"; x.fillRect(9, 15, 9, 9);
    x.fillStyle = "#e8772e"; x.fillRect(11, 21, 5, 2);
    x.fillStyle = "#ffc23e"; x.fillRect(12, 20, 3, 2);
    x.fillStyle = "#2f3436"; x.fillRect(21, 21, 4, 2); x.fillRect(22, 23, 2, 1);
    x.fillRect(2, 24, 24, 1);
  });
}

export function bakeLibrary(): HTMLCanvasElement {
  return legacyBake(28, 27, (x) => {
    x.fillStyle = "#5b3b22"; x.fillRect(3, 12, 22, 13);
    x.fillStyle = "#7a5a32"; x.fillRect(4, 13, 20, 11);
    x.fillStyle = "#4a2c16";
    for (let j = 0; j < 3; j++) x.fillRect(4, 15 + j * 3, 20, 1);
    // roof (wide at the walls, narrowing to the ridge)
    x.fillStyle = "#2e6e6a";
    for (let r = 0; r < 8; r++) x.fillRect(2 + r, 12 - r, 24 - r * 2, 1);
    x.fillStyle = "#3f8d87";
    for (let r = 1; r < 8; r += 2) x.fillRect(2 + r, 12 - r, 24 - r * 2, 1);
    x.fillStyle = "#1d4b48"; x.fillRect(9, 4, 10, 1);
    x.fillStyle = "#2b2017"; x.fillRect(12, 18, 5, 7);
    x.fillStyle = "#e3b341"; x.fillRect(6, 16, 3, 3);
    x.fillStyle = "#efe9d6"; x.fillRect(19, 15, 5, 4);
    x.fillStyle = "#a8432f"; x.fillRect(21, 15, 1, 4);
    x.fillStyle = "#2f3436"; x.fillRect(3, 24, 22, 1);
  });
}

export function bakeGarden(): HTMLCanvasElement {
  return legacyBake(32, 18, (x) => {
    x.fillStyle = "#4a3320"; x.fillRect(1, 3, 30, 14);
    x.fillStyle = "#5d4128";
    for (let j = 0; j < 4; j++) x.fillRect(2, 4 + j * 3.5, 28, 2);
    x.fillStyle = "#9a7a4a";
    for (let i = 0; i < 32; i += 3) { x.fillRect(i, 2, 2, 2); x.fillRect(i, 16, 2, 2); }
    x.fillRect(0, 3, 1, 14); x.fillRect(31, 3, 1, 14);
    for (let i = 0; i < 10; i++) {
      const px = 3 + rndi(0, 26);
      const py = 5 + rndi(0, 9);
      x.fillStyle = "#5d8f3f"; x.fillRect(px, py, 1, 2);
      x.fillStyle = "#7fb24f"; x.fillRect(px, py - 1, 1, 1);
    }
    x.fillStyle = "#d8536a"; x.fillRect(6, 6, 2, 2);
    x.fillStyle = "#e3b341"; x.fillRect(24, 11, 2, 2);
  });
}

/** Archery Range: a round straw butt with painted rings on a wooden post.
 *  Same 1-tile footprint family as the training dummies. */
export function bakeRange(): HTMLCanvasElement {
  return legacyBake(15, 21, (x) => {
    // post + foot
    x.fillStyle = PAL.t; x.fillRect(7, 12, 2, 8);
    x.fillStyle = "#4a2c16"; x.fillRect(4, 19, 8, 1);
    // straw butt (round-ish disc)
    x.fillStyle = PAL.y;
    x.fillRect(4, 2, 8, 12); x.fillRect(3, 4, 10, 8); x.fillRect(2, 6, 12, 4);
    // straw shading (bottom-left)
    x.fillStyle = "#b8964a";
    x.fillRect(3, 10, 4, 2); x.fillRect(4, 12, 4, 1);
    // painted rings: white ring, red bull
    x.fillStyle = PAL.w;
    x.fillRect(6, 4, 4, 1); x.fillRect(5, 5, 1, 6); x.fillRect(10, 5, 1, 6); x.fillRect(6, 11, 4, 1);
    x.fillStyle = PAL.r;
    x.fillRect(7, 7, 2, 2);
  });
}

export function bakeDummy(): HTMLCanvasElement {
  return legacyBake(14, 21, (x) => {
    x.fillStyle = PAL.t; x.fillRect(6, 6, 2, 14);
    x.fillStyle = "#4a2c16"; x.fillRect(2, 9, 10, 1);
    x.fillStyle = PAL.y; x.fillRect(4, 7, 6, 8);
    x.fillStyle = "#b8964a"; x.fillRect(4, 11, 6, 1); x.fillRect(4, 7, 1, 8);
    x.fillStyle = PAL.y; x.fillRect(5, 2, 4, 4);
    x.fillStyle = "#b8964a"; x.fillRect(5, 4, 4, 1);
    x.fillStyle = PAL.b; x.fillRect(4, 14, 6, 1);
    x.fillStyle = "#2b2017"; x.fillRect(6, 3, 1, 1); x.fillRect(8, 3, 1, 1);
  });
}

export function bakeChest(): HTMLCanvasElement {
  return legacyBake(18, 14, (x) => {
    // body
    x.fillStyle = "#5b3b22"; x.fillRect(1, 5, 16, 8);
    x.fillStyle = "#7a4a28"; x.fillRect(2, 6, 14, 6);
    // lid
    x.fillStyle = "#6e4a2a"; x.fillRect(1, 2, 16, 4);
    x.fillStyle = "#8a5a32"; x.fillRect(2, 2, 14, 2);
    // iron bands
    x.fillStyle = "#3a2a1a";
    x.fillRect(1, 5, 16, 1);
    x.fillRect(4, 2, 1, 11); x.fillRect(13, 2, 1, 11);
    // corners
    x.fillStyle = "#c9c2a8";
    x.fillRect(1, 12, 1, 1); x.fillRect(16, 12, 1, 1);
    x.fillRect(1, 2, 1, 1); x.fillRect(16, 2, 1, 1);
    // lock
    x.fillStyle = "#e3b341"; x.fillRect(8, 6, 2, 3);
    x.fillStyle = "#9a7424"; x.fillRect(8, 7, 2, 1);
  });
}

/** The cave-treasure chest: the storage chest's silhouette with a golden lid,
 *  so it reads instantly as "loot", not "stash". */
/**
 * A one-time hoard, drawn to FIT ITS OWN SQUARE.
 *
 * It used to be 18 x 14 legacy pixels, which is 36 x 28 at world scale in a
 * 32-pixel tile: two pixels of chest hanging over the square on each side, and
 * the whole of it shoved against the bottom edge because `structCenter` anchors
 * a structure's sprite on the foot of its tile. That anchoring is right for
 * buildings — a house is taller than its plot and you walk behind its gable —
 * and wrong for furniture, which is the same lesson the campfire taught in
 * Etap 40. On a cave floor with a visible tile pattern the result reads as a
 * chest standing between two squares rather than on one, which is exactly what
 * Radek reported and exactly what moving it to a different TILE could not fix.
 *
 * Fifteen by ten, so it comes out 30 x 20 and clears both side edges, and
 * `CHEST_LIFT` splits the six pixels of slack evenly above and below it. The
 * drawing is the same drawing, one pixel tighter in every direction.
 */
export function bakeTreasureChest(): HTMLCanvasElement {
  return legacyBake(15, 10, (x) => {
    // body
    x.fillStyle = "#5b3b22"; x.fillRect(0, 3, 15, 7);
    x.fillStyle = "#7a4a28"; x.fillRect(1, 4, 13, 5);
    // golden lid
    x.fillStyle = "#c9a23a"; x.fillRect(0, 0, 15, 4);
    x.fillStyle = "#e3b341"; x.fillRect(1, 0, 13, 2);
    // iron bands
    x.fillStyle = "#3a2a1a";
    x.fillRect(0, 3, 15, 1);
    x.fillRect(3, 0, 1, 10); x.fillRect(11, 0, 1, 10);
    // corners
    x.fillStyle = "#c9c2a8";
    x.fillRect(0, 9, 1, 1); x.fillRect(14, 9, 1, 1);
    x.fillRect(0, 0, 1, 1); x.fillRect(14, 0, 1, 1);
    // lock
    x.fillStyle = "#efe9d6"; x.fillRect(7, 4, 2, 3);
    x.fillStyle = "#9a7424"; x.fillRect(7, 5, 2, 1);
  });
}

/**
 * How far above the foot of its tile a treasure chest is drawn.
 *
 * The campfire's `FIRE_LIFT`, applied to the one other object in the game that
 * is furniture rather than architecture: the sprite is 20 world pixels tall in
 * a 32-pixel square, so lifting it six centres it and leaves six pixels of
 * floor showing above and below. Its shadow rides up with it — see the
 * `treasure` row in `buildingArt.ts` — or the chest would float over a mark on
 * the ground half a tile behind its own feet.
 */
export const CHEST_LIFT = 6;

/** Icon lookup for item kinds (bag, corpse loot, shops). */
import type { ItemKind } from "../items.ts";
/* ------------------------------------------------------------------ *
 *  ELEMENTAL CRYSTALS — 30 icons from three shapes and five tints
 *
 *  Hand-drawing thirty near-identical gems would produce thirty things the
 *  player cannot tell apart in a full backpack. Instead the SHAPE carries the
 *  role (a Shard is a pointed sliver, a Burst is a round bomb), the SIZE
 *  carries the tier, and only the colour carries the element. That way the
 *  two facts you need mid-fight — what does it do, how strong is it — read at
 *  a glance, and the element reads from the tint you already associate with it.
 * ------------------------------------------------------------------ */
const SHARD_BY_TIER: readonly string[][] = [
  ["..a...", ".aba..", ".abb..", "..bc..", "...c.."],
  [".aa...", "abba..", "abbb..", ".bbc..", "..cc.."],
  [".aaa..", "abbba.", "abbbb.", "abbbc.", ".bccc."],
];
const BURST_BY_TIER: readonly string[][] = [
  ["..aa..", ".abba.", ".abbc.", "..cc.."],
  [".aaaa.", "abbbba", "abbbbc", ".accc."],
  ["a.aa.a", ".abba.", "abbbbc", "abbbbc", ".accc.", "c....c"],
];

/** Light / body / shadow for each element, on the game's existing ramp. */
const ELEMENT_RAMP: Readonly<Record<string, readonly [string, string, string]>> = {
  fire: ["#ffd48a", "#ff8a3a", "#a3401a"],
  ice: ["#d8f4ff", "#7cd4ff", "#2f6f96"],
  earth: ["#cfe0a8", "#8ab661", "#42602c"],
  storm: ["#fff0b0", "#ffce4a", "#8a6410"],
  shadow: ["#ded0ff", "#b58aff", "#4c2f7a"],
};

/**
 * An attunement stone in one element's colours. Same cut as every other
 * stone, so the shape says "lane key" and only the tint says which lane.
 */
function attuneIcon(element: string): HTMLCanvasElement {
  const [a, b, c] = ELEMENT_RAMP[element];
  return bake([
    ".rr..",
    "rRRr.",
    "rRcRr",
    "rRRr.",
    ".rr..",
  ], { r: c, R: b, c: a });
}

function elementalIcon(element: string, tier: number, role: "Shard" | "Burst" | "Nova" | "Wave"): HTMLCanvasElement {
  const [a, b, c] = ELEMENT_RAMP[element];
  const map = role === "Shard" ? SHARD_BY_TIER[tier] : BURST_BY_TIER[tier];
  return bake(map, { a, b, c });
}

/**
 * The procedurally drawn icon for every item.
 *
 * Exported for `itemArt.ts`, which loads drawn PNGs over the top and falls
 * back here for anything that has no artwork yet. Draw code should call
 * `itemSprite()` from that module, not read this table directly.
 */
export const BAKED_ITEM_SPR: Readonly<Record<ItemKind, HTMLCanvasElement>> = {
  wood: SPR.wood, stone: SPR.stoneIcon, bones: SPR.bones,
  venomGland: SPR.venomGland,
  ghoulClaw: SPR.ghoulClaw, dragonScale: SPR.dragonScaleIcon,
  minotaurHorn: SPR.minotaurHorn, orcEar: SPR.orcEar, goblinFang: SPR.goblinFang, cursedRib: SPR.cursedRib,
  // The cap ships with its own PNG and never shows this bake.
  bloodCap: SPR.cursedRib,
  // …and so does the helm.
  graveHelm: SPR.cursedRib,
  // …and so does the effigy, which is drawn rather than sourced — see
  // `tools/gen_hair_effigy.py`, which regenerates the PNG byte for byte.
  hairEffigy: SPR.cursedRib,
  iron: SPR.ironIngot, steel: SPR.steelIngot, essentialGem: SPR.essentialGem, coal: SPR.coalLump,
  mushroom: SPR.mushroom, meat: SPR.meatIcon, hpPotion: SPR.potionRed, dragonHam: SPR.dragonHam,
  // Etap 22: every piece of the new catalog draws with ONE shared stub until
  // its own art lands. Slot-coloured so an outfit is still readable at a
  // glance, but deliberately crude — a placeholder that looks finished is a
  // placeholder that never gets replaced.
  ring: SPR.eqRing, amulet: SPR.eqAmulet, aolAmulet: SPR.eqAol,
  leatherHelm: SPR.gearStubHead, snakeskinHelm: SPR.gearStubHead, leatherBody: SPR.gearStubBody, snakeskinBody: SPR.gearStubBody,
  leatherLegs: SPR.gearStubLegs, snakeskinLegs: SPR.gearStubLegs, leatherBoots: SPR.gearStubBoots, snakeskinBoots: SPR.gearStubBoots,
  leatherShield: SPR.gearStubShield, snakeskinShield: SPR.gearStubShield, studdedHelm: SPR.gearStubHead, goblinHelm: SPR.gearStubHead,
  studdedBody: SPR.gearStubBody, goblinBody: SPR.gearStubBody, studdedLegs: SPR.gearStubLegs, goblinLegs: SPR.gearStubLegs,
  studdedBoots: SPR.gearStubBoots, goblinBoots: SPR.gearStubBoots, studdedShield: SPR.gearStubShield, goblinShield: SPR.gearStubShield,
  chainHelm: SPR.gearStubHead, orcishHelm: SPR.gearStubHead, chainBody: SPR.gearStubBody, orcishBody: SPR.gearStubBody,
  chainLegs: SPR.gearStubLegs, orcishLegs: SPR.gearStubLegs, chainBoots: SPR.gearStubBoots, orcishBoots: SPR.gearStubBoots,
  chainShield: SPR.gearStubShield, orcishShield: SPR.gearStubShield, plateHelm: SPR.gearStubHead, minotaurHelm: SPR.gearStubHead,
  plateBody: SPR.gearStubBody, minotaurBody: SPR.gearStubBody, plateLegs: SPR.gearStubLegs, minotaurLegs: SPR.gearStubLegs,
  plateBoots: SPR.gearStubBoots, minotaurBoots: SPR.gearStubBoots, plateShield: SPR.gearStubShield, minotaurShield: SPR.gearStubShield,
  steelHelm: SPR.gearStubHead, marrowHelm: SPR.gearStubHead, steelBody: SPR.gearStubBody, marrowBody: SPR.gearStubBody,
  steelLegs: SPR.gearStubLegs, marrowLegs: SPR.gearStubLegs, steelBoots: SPR.gearStubBoots, marrowBoots: SPR.gearStubBoots,
  steelShield: SPR.gearStubShield, marrowShield: SPR.gearStubShield, knightHelm: SPR.gearStubHead, dragonHelm: SPR.gearStubHead,
  knightBody: SPR.gearStubBody, dragonBody: SPR.gearStubBody, knightLegs: SPR.gearStubLegs, dragonLegs: SPR.gearStubLegs,
  knightBoots: SPR.gearStubBoots, dragonBoots: SPR.gearStubBoots, knightShield: SPR.gearStubShield, dragonShield: SPR.gearStubShield,
  shortSword: SPR.gearStubWeapon, fangDagger: SPR.gearStubWeapon, ironSword: SPR.gearStubWeapon, goblinHatchet: SPR.gearStubWeapon,
  mercBlade: SPR.gearStubWeapon, warHammer: SPR.gearStubWeapon, orcishAxe: SPR.gearStubWeapon, gladius: SPR.gearStubWeapon,
  boneSword: SPR.gearStubWeapon, minotaurAxe: SPR.gearStubWeapon, warlordBlade: SPR.gearStubWeapon, steelMaul: SPR.gearStubWeapon,
  demonCleaver: SPR.gearStubWeapon, knightSword: SPR.gearStubWeapon, fireSword: SPR.gearStubWeapon, marrowBlade: SPR.gearStubWeapon,
  healCrystal: SPR.crystalHeal, recallCrystal: SPR.crystalRecall,
  fireCrystal: attuneIcon("fire"), waterCrystal: attuneIcon("ice"), earthCrystal: attuneIcon("earth"),
  windCrystal: attuneIcon("shadow"), lightningCrystal: attuneIcon("storm"),
  magicEssence: SPR.magicEssence,
  fireEmberShard: elementalIcon("fire", 0, "Shard"),
  fireEmberBurst: elementalIcon("fire", 0, "Burst"),
  fireEmberNova: elementalIcon("fire", 0, "Nova"),
  fireEmberWave: elementalIcon("fire", 0, "Wave"),
  fireEmberArrow: elementalArrow("fire", 0),
  fireFlameShard: elementalIcon("fire", 1, "Shard"),
  fireFlameBurst: elementalIcon("fire", 1, "Burst"),
  fireFlameNova: elementalIcon("fire", 1, "Nova"),
  fireFlameWave: elementalIcon("fire", 1, "Wave"),
  fireFlameArrow: elementalArrow("fire", 1),
  firePyreShard: elementalIcon("fire", 2, "Shard"),
  firePyreBurst: elementalIcon("fire", 2, "Burst"),
  firePyreNova: elementalIcon("fire", 2, "Nova"),
  firePyreWave: elementalIcon("fire", 2, "Wave"),
  firePyreArrow: elementalArrow("fire", 2),
  iceFrostShard: elementalIcon("ice", 0, "Shard"),
  iceFrostBurst: elementalIcon("ice", 0, "Burst"),
  iceFrostNova: elementalIcon("ice", 0, "Nova"),
  iceFrostWave: elementalIcon("ice", 0, "Wave"),
  iceFrostArrow: elementalArrow("ice", 0),
  iceRimeShard: elementalIcon("ice", 1, "Shard"),
  iceRimeBurst: elementalIcon("ice", 1, "Burst"),
  iceRimeNova: elementalIcon("ice", 1, "Nova"),
  iceRimeWave: elementalIcon("ice", 1, "Wave"),
  iceRimeArrow: elementalArrow("ice", 1),
  iceGlacierShard: elementalIcon("ice", 2, "Shard"),
  iceGlacierBurst: elementalIcon("ice", 2, "Burst"),
  iceGlacierNova: elementalIcon("ice", 2, "Nova"),
  iceGlacierWave: elementalIcon("ice", 2, "Wave"),
  iceGlacierArrow: elementalArrow("ice", 2),
  earthLoamShard: elementalIcon("earth", 0, "Shard"),
  earthLoamBurst: elementalIcon("earth", 0, "Burst"),
  earthLoamNova: elementalIcon("earth", 0, "Nova"),
  earthLoamWave: elementalIcon("earth", 0, "Wave"),
  earthLoamArrow: elementalArrow("earth", 0),
  earthStoneShard: elementalIcon("earth", 1, "Shard"),
  earthStoneBurst: elementalIcon("earth", 1, "Burst"),
  earthStoneNova: elementalIcon("earth", 1, "Nova"),
  earthStoneWave: elementalIcon("earth", 1, "Wave"),
  earthStoneArrow: elementalArrow("earth", 1),
  earthBedrockShard: elementalIcon("earth", 2, "Shard"),
  earthBedrockBurst: elementalIcon("earth", 2, "Burst"),
  earthBedrockNova: elementalIcon("earth", 2, "Nova"),
  earthBedrockWave: elementalIcon("earth", 2, "Wave"),
  earthBedrockArrow: elementalArrow("earth", 2),
  stormSparkShard: elementalIcon("storm", 0, "Shard"),
  stormSparkBurst: elementalIcon("storm", 0, "Burst"),
  stormSparkNova: elementalIcon("storm", 0, "Nova"),
  stormSparkWave: elementalIcon("storm", 0, "Wave"),
  stormSparkArrow: elementalArrow("storm", 0),
  stormBoltShard: elementalIcon("storm", 1, "Shard"),
  stormBoltBurst: elementalIcon("storm", 1, "Burst"),
  stormBoltNova: elementalIcon("storm", 1, "Nova"),
  stormBoltWave: elementalIcon("storm", 1, "Wave"),
  stormBoltArrow: elementalArrow("storm", 1),
  stormTempestShard: elementalIcon("storm", 2, "Shard"),
  stormTempestBurst: elementalIcon("storm", 2, "Burst"),
  stormTempestNova: elementalIcon("storm", 2, "Nova"),
  stormTempestWave: elementalIcon("storm", 2, "Wave"),
  stormTempestArrow: elementalArrow("storm", 2),
  shadowGloomShard: elementalIcon("shadow", 0, "Shard"),
  shadowGloomBurst: elementalIcon("shadow", 0, "Burst"),
  shadowGloomNova: elementalIcon("shadow", 0, "Nova"),
  shadowGloomWave: elementalIcon("shadow", 0, "Wave"),
  shadowGloomArrow: elementalArrow("shadow", 0),
  shadowUmbraShard: elementalIcon("shadow", 1, "Shard"),
  shadowUmbraBurst: elementalIcon("shadow", 1, "Burst"),
  shadowUmbraNova: elementalIcon("shadow", 1, "Nova"),
  shadowUmbraWave: elementalIcon("shadow", 1, "Wave"),
  shadowUmbraArrow: elementalArrow("shadow", 1),
  shadowEclipseShard: elementalIcon("shadow", 2, "Shard"),
  shadowEclipseBurst: elementalIcon("shadow", 2, "Burst"),
  shadowEclipseNova: elementalIcon("shadow", 2, "Nova"),
  shadowEclipseWave: elementalIcon("shadow", 2, "Wave"),
  shadowEclipseArrow: elementalArrow("shadow", 2),
  bow: SPR.bow, longbow: SPR.longbow, arrow: SPR.arrow, boneArrow: SPR.boneArrow,
  trainingArrow: SPR.trainingArrow,
  backpack: SPR.pack, booster: SPR.boosterPotion,
  goldCoin: SPR.coin, platinumCoin: SPR.platinumCoin,
};

/**
 * Living things are baked chunkier than props — see ACTOR_SCALE. Re-upscaling
 * from the 1x source rather than the already-doubled copy keeps every pixel
 * exact instead of resampling a resample. Decor is untouched: it is painted
 * into the terrain canvas from spriteSource() anyway.
 */
const ACTORS = [
  "skeleton", "goblin", "orc", "rat", "minotaur", "snake", "ghoul", "humanFoe",
  "orcArcher", "orcWarrior", "minotaurArcher", "orcShaman",
  "orcBerserker", "minotaurGuard", "minotaurMage", "dragon",
  "corpse", "npcSmith", "npcHerbalist", "npcElder",
  "npcTailor", "npcTaskmaster", "npcTimesage",
] as const;

{
  const spr = SPR as unknown as Record<string, HTMLCanvasElement>;
  for (const k of ACTORS) spr[k] = upscale(spriteSource(spr[k]), ACTOR_SCALE);
}
/** Elemental arrows: a plain shaft with the element burning on the head. */
function elementalArrow(element: string, tier = 0): HTMLCanvasElement {
  void tier; // all three tiers share one baked arrow until the art lands
  const [a, b] = ELEMENT_RAMP[element];
  return bake(["....ab", "...abW", "..aWW.", ".WW...", "WW...."], { a, b, W: "#bdb59c" });
}

/* `itemSprite()` used to live here. It moved to `itemArt.ts` when drawn PNGs
 * arrived, so that one function answers "what do I draw for this item" whether
 * the answer is artwork or the baked stand-in. Same shape as scenerySprite(). */
