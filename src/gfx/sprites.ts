/**
 * Sprite atlas: palette, the pixel-map baker and every sprite in the game.
 * All graphics are tiny string maps rendered once onto offscreen canvases.
 */
import { rndi } from "../util.ts";

/** Single-character color palette used by pixel maps. */
export const PAL: Readonly<Record<string, string>> = {
  k: "#2b2017", e: "#1c1410",
  s: "#eab984", h: "#6e4a2a",
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

/** Bake a string pixel-map into an offscreen canvas ('.' = transparent).
 *  `over` remaps selected palette glyphs to custom colors — the outfit system
 *  uses it to re-tint the player sprite without a second pixel map. */
export function bake(map: readonly string[], over?: Readonly<Record<string, string>>): HTMLCanvasElement {
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
  return c;
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
  // --- new monsters ---
  spider: bake([
    "e..ee..e",
    ".e.ee.e.",
    "..eeee..",
    "ee.rr.ee",
    "..eeee..",
    ".e.ee.e.",
    "e..ee..e",
  ]),
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
  ghost: bake([
    "..mmmmmm..",
    ".mmmmmmmm.",
    ".memmmmem.",
    ".mmmmmmmm.",
    "mmmmmmmmmm",
    "mmmmmmmmmm",
    ".mmmmmmmm.",
    ".m.mm.mm..",
    "..m..m..m.",
  ]),
  troll: bake([
    "...pppppp...",
    "..pppppppp..",
    "..pePppPep..",
    "..pppppppp..",
    "..pwpppwpp..",
    "p..pppppp..p",
    "ppbbbbbbbbpp",
    "p.bbbbbbbb.p",
    "..bbbbbbbb..",
    "..bbbbbbbb..",
    "..pp....pp..",
    "..PP....PP..",
    ".PPP....PPP.",
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
  bat: bake([
    "e..eeee..e",
    "ee.eeee.ee",
    ".eeeeeeee.",
    ".ererreee.",
    ".eeeeeeee.",
    "..eeeeee..",
    "...e..e...",
  ]),
  wolf: bake([
    "M.......M.",
    "MM.....MMh",
    "MMMMMMMMhh",
    "MxMMMMMxM.",
    "MMMMMMMMM.",
    "MMMMMMMMM.",
    ".MMMMMMM..",
    ".M.MM.M...",
    ".M.MM.M...",
  ]),
  bear: bake([
    ".b......b..",
    ".bb....bb..",
    ".btttttttb.",
    ".tbttttbtt.",
    ".ttkttkttt.",
    ".tttttttt..",
    "tttttttttt.",
    "tttttttttt.",
    ".tttttttt..",
    ".tt....tt..",
    ".bb....bb..",
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
  cyclops: bake([
    "..GGGGGGGG...",
    ".GGGGGGGGGG..",
    ".GGGGGGGGGG..",
    ".GGGGwwGGGG..",
    ".GGGwkkwGGG..",
    ".GGGGwwGGGG..",
    ".GGGGGGGGGG..",
    "GGGGGGGGGGGG.",
    "GGGGGGGGGGGG.",
    ".GGGGGGGGGG..",
    ".GGGGGGGGGG..",
    ".GG......GG..",
    ".bb......bb..",
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
  crab: bake([
    "r..rrrr..r",
    "rr.rrrr.rr",
    "Rr.rrrr.rR",
    "..rrrrrr..",
    ".rrkrrkrr.",
    ".rrrrrrrr.",
    "..RrrrrR..",
    ".R.R..R.R.",
  ]),
  wasp: bake([
    "m..cc..m",
    ".mcccem.",
    "..ceec..",
    ".mccccm.",
    "m.ceec.m",
    "...cc...",
    "...ee...",
  ]),
  poisonSpider: bake([
    "g..gg..g",
    ".g.gg.g.",
    "..gggg..",
    "gg.rr.gg",
    "..gGGg..",
    ".g.GG.g.",
    "g..gg..g",
  ]),
  rotworm: bake([
    "........tt",
    "......tttt",
    "..ttttttbt",
    ".tbtttbtt.",
    "tttkttk...",
    "ttrrrr....",
    ".tttt.....",
  ]),
  amazon: bake([
    "..cccccc..",
    ".cccccccc.",
    ".csessesc.",
    "..ssssss..",
    ".rrrrrrrr.",
    "mrrrrrrrr.",
    ".mrRrrRr..",
    "..rrrrrr..",
    "..ssssss..",
    "..bb..bb..",
    "..kk..kk..",
  ]),
  warWolf: bake([
    "x.......x.",
    "xx.....xxk",
    "xxxxxxxxkk",
    "xrxxxxxrx.",
    "xxxxxxxxx.",
    "xxwxxwxxx.",
    ".xxxxxxx..",
    ".x.xx.x...",
    ".x.xx.x...",
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
  orcSpearman: bake([
    "m.GGGGGG..",
    "m.GGGGGGG.",
    "mGeGGGGeG.",
    "mGGwGGwGG.",
    "m.GGGGGG..",
    "m.tttttt.b",
    "mbttttttb.",
    "m.tttttt.b",
    "m.tttttt..",
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
  hunter: bake([
    "..hhhhhh..",
    ".hhhhhhhh.",
    ".hsessesh.",
    "..ssssss.b",
    ".pppppppb.",
    "sppppppb.s",
    ".pPppppb..",
    ".pppppppb.",
    "..kkkkkk.b",
    "..pp..pp..",
    "..kk..kk..",
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
  mummy: bake([
    "..wWwwWw..",
    ".wwwwwwww.",
    ".wrwwwwrw.",
    ".wWwwwwWw.",
    "..wwWWww..",
    "w.wWwwWw.w",
    ".wwwwwwww.",
    "w.wWwwWw.w",
    "..wwwwww..",
    "..Ww..wW..",
    "..ww..ww..",
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
  boneLord: bake([
    "...wwwwww....",
    "..wwwwwwww...",
    "..wwrwwrww...",
    "..wwwwwwww...",
    "...wWWWWw....",
    "..u.wwww.u...",
    ".uuwwwwwwuu..",
    "uu.wwwwww.uu.",
    ".u.wwwwww.u..",
    "...wwwwww....",
    "...w.ww.w....",
    "..u......u...",
    "..u......u...",
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
  herb: bake([
    ".g.g.",
    "gGgGg",
    ".ggg.",
    "..G..",
  ]),
  silkIcon: bake([
    ".mm..mm.",
    "m..mm..m",
    ".mm..mm.",
    "m..mm..m",
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
  swordIron: bake(["...m", "..mm", ".mm.", "mm..", "kk..", "b..."]),
  swordBone: bake(["...w", "..ww", ".ww.", "ww..", "kk..", "c..."]),
  // Marrow Blade — the unique cave-bottom treasure: pale bone blade with a
  // silver sheen, gold cross-guard, dark grip. A touch taller than the rest.
  swordMarrow: bake(["....w", "...wm", "..wm.", ".wm..", "cc...", "k....", "e...."]),
  crystalHeal: bake([
    "..ww..",
    ".wggw.",
    "wggggw",
    "gggggg",
    ".gGGg.",
    "..GG..",
  ]),
  crystalFire: bake([
    "..yy..",
    ".yrry.",
    "yrrrry",
    "rrrrrr",
    ".rRRr.",
    "..RR..",
  ]),
  crystalRecall: bake([
    "..ww..",
    ".wmmw.",
    "wmmmmw",
    "mmmmmm",
    ".mMMm.",
    "..MM..",
  ]),
  crystalSpear: bake([
    "..c...",
    ".ccy..",
    ".rcc..",
    "rrrc..",
    "Rrr...",
    "R.....",
  ]),
  fireRuby: bake([
    ".rr..",
    "rRRr.",
    "rRcRr",
    "rRRr.",
    ".rr..",
  ]),
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
  shellIcon: bake([
    ".mmmm.",
    "mMrrMm",
    "mrMMrm",
    "mMrrMm",
    ".mmmm.",
  ]),
  wolfFur: bake([
    "Mx.xMM",
    "xMMMxM",
    "MMxMMx",
    "xMMMMx",
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
  axe: bake([
    "mm..",
    "mmb.",
    "mmb.",
    ".b..",
    ".b..",
    ".b..",
  ]),
  swordFire: bake([
    "...r",
    "..rc",
    ".rc.",
    "rc..",
    "kk..",
    "R...",
  ]),
  eqBodyLeather: bake(["t.tttt.t", "tttttttt", ".tbttbt.", ".tttttt.", ".tttttt."]),
  eqBodyChain: bake(["M.MMMM.M", "MxMxMxMx", ".xMxMxM.", ".MxMxMx.", ".xMxMxM."]),
  eqBodyDragon: bake(["g.gggg.g", "gggggggg", ".gGggGg.", ".gggggg.", ".gGggGg."]),
  eqShieldSteel: bake([".MMMMMM.", ".MmmmmM.", ".MmMMmM.", "..MmmM..", "...MM..."]),
  eqShieldDragon: bake([".gggggg.", ".gGggGg.", ".gggggg.", "..gGGg..", "...gg..."]),
  // the Marrow set: bone-white plate, silver sheen, gold trim (see swordMarrow)
  eqShieldMarrow: bake([".wwwwww.", ".wmccmw.", ".wwmmww.", "..wwww..", "...ww..."]),
  eqBodyMarrow: bake(["w.wwww.w", "wwmwwmww", ".wcwwcw.", ".wwmmww.", ".wwwwww."]),
  eqHeadMarrow: bake(["..wwww..", ".wwmmww.", ".wcwwcw.", ".ww..ww."]),
  eqLegsMarrow: bake([".wwwwww.", ".wm..mw.", ".wc..cw.", ".ww..ww."]),
  eqBootsMarrow: bake(["ww..ww..", "wm..wm..", "wwc.wwc.", "wwwwwwww"]),
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

/** Tall sketchy conifer — every call produces a slightly different tree. */
export function bakeTree(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 28;
  const x = c.getContext("2d")!;
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
  return c;
}

export function bakeForge(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 28;
  c.height = 26;
  const x = c.getContext("2d")!;
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
  return c;
}

export function bakeLibrary(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 28;
  c.height = 27;
  const x = c.getContext("2d")!;
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
  return c;
}

export function bakeGarden(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 18;
  const x = c.getContext("2d")!;
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
  return c;
}

/** Archery Range: a round straw butt with painted rings on a wooden post.
 *  Same 1-tile footprint family as the training dummies. */
export function bakeRange(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 15;
  c.height = 21;
  const x = c.getContext("2d")!;
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
  return c;
}

export function bakeDummy(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 14;
  c.height = 21;
  const x = c.getContext("2d")!;
  x.fillStyle = PAL.t; x.fillRect(6, 6, 2, 14);
  x.fillStyle = "#4a2c16"; x.fillRect(2, 9, 10, 1);
  x.fillStyle = PAL.y; x.fillRect(4, 7, 6, 8);
  x.fillStyle = "#b8964a"; x.fillRect(4, 11, 6, 1); x.fillRect(4, 7, 1, 8);
  x.fillStyle = PAL.y; x.fillRect(5, 2, 4, 4);
  x.fillStyle = "#b8964a"; x.fillRect(5, 4, 4, 1);
  x.fillStyle = PAL.b; x.fillRect(4, 14, 6, 1);
  x.fillStyle = "#2b2017"; x.fillRect(6, 3, 1, 1); x.fillRect(8, 3, 1, 1);
  return c;
}

export function bakeChest(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 18;
  c.height = 14;
  const x = c.getContext("2d")!;
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
  return c;
}

/** The cave-treasure chest: the storage chest's silhouette with a golden lid,
 *  so it reads instantly as "loot", not "stash". */
export function bakeTreasureChest(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 18;
  c.height = 14;
  const x = c.getContext("2d")!;
  // body
  x.fillStyle = "#5b3b22"; x.fillRect(1, 5, 16, 8);
  x.fillStyle = "#7a4a28"; x.fillRect(2, 6, 14, 6);
  // golden lid
  x.fillStyle = "#c9a23a"; x.fillRect(1, 2, 16, 4);
  x.fillStyle = "#e3b341"; x.fillRect(2, 2, 14, 2);
  // iron bands
  x.fillStyle = "#3a2a1a";
  x.fillRect(1, 5, 16, 1);
  x.fillRect(4, 2, 1, 11); x.fillRect(13, 2, 1, 11);
  // corners
  x.fillStyle = "#c9c2a8";
  x.fillRect(1, 12, 1, 1); x.fillRect(16, 12, 1, 1);
  x.fillRect(1, 2, 1, 1); x.fillRect(16, 2, 1, 1);
  // lock
  x.fillStyle = "#efe9d6"; x.fillRect(8, 6, 2, 3);
  x.fillStyle = "#9a7424"; x.fillRect(8, 7, 2, 1);
  return c;
}

/** Icon lookup for item kinds (bag, corpse loot, shops). */
import type { ItemKind } from "../items.ts";
const ITEM_SPR: Readonly<Record<ItemKind, HTMLCanvasElement>> = {
  wood: SPR.wood, stone: SPR.stoneIcon, bones: SPR.bones, herb: SPR.herb, silk: SPR.silkIcon,
  venomGland: SPR.venomGland, shell: SPR.shellIcon, wolfFur: SPR.wolfFur,
  ghoulClaw: SPR.ghoulClaw, dragonScale: SPR.dragonScaleIcon,
  mushroom: SPR.mushroom, meat: SPR.meatIcon, hpPotion: SPR.potionRed, dragonHam: SPR.dragonHam,
  sword: SPR.sword, ironSword: SPR.swordIron, boneSword: SPR.swordBone, marrowBlade: SPR.swordMarrow,
  battleAxe: SPR.axe, fireSword: SPR.swordFire,
  helmet: SPR.eqHead, armor: SPR.eqBody, shieldItem: SPR.eqShield,
  leatherArmor: SPR.eqBodyLeather, chainArmor: SPR.eqBodyChain, dragonScaleArmor: SPR.eqBodyDragon,
  steelShield: SPR.eqShieldSteel, dragonShield: SPR.eqShieldDragon,
  marrowShield: SPR.eqShieldMarrow, marrowArmor: SPR.eqBodyMarrow, marrowHelmet: SPR.eqHeadMarrow,
  marrowLegs: SPR.eqLegsMarrow, marrowBoots: SPR.eqBootsMarrow,
  legs: SPR.eqLegs, boots: SPR.eqBoots, ring: SPR.eqRing, amulet: SPR.eqAmulet, aolAmulet: SPR.eqAol,
  healCrystal: SPR.crystalHeal, fireCrystal: SPR.crystalFire, recallCrystal: SPR.crystalRecall,
  spearCrystal: SPR.crystalSpear, fireRuby: SPR.fireRuby,
  bow: SPR.bow, longbow: SPR.longbow, arrow: SPR.arrow, boneArrow: SPR.boneArrow,
  trainingArrow: SPR.trainingArrow,
  backpack: SPR.pack, booster: SPR.boosterPotion,
};
export function itemSprite(kind: ItemKind): HTMLCanvasElement {
  return ITEM_SPR[kind];
}
