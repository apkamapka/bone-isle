/**
 * Adventurer outfit (Etap 8) — indexed pixel maps derived from the hand-drawn
 * sheet. One char per pixel, each char an entry in ADV_PALETTE. Dye zones are
 * declared per palette entry so bakeOutfitSprite() can re-tint while keeping
 * every shade's relative lightness (flat replacement would kill the shading).
 *
 * Generated data — regenerate rather than hand-editing.
 */
import type { OutfitZone } from "../systems/outfit.ts";

export const ADV_PALETTE: readonly string[] = [
  "#e09956", // a
  "#000000", // b
  "#7d4618", // c
  "#2e421e", // d
  "#9d7047", // e
  "#2b1708", // f
  "#555d20", // g
  "#56300e", // h
  "#bf8448", // i
  "#855b34", // j
  "#0f161c", // k
  "#727122", // l
  "#4a402f", // m
  "#6b4b2e", // n
  "#262423", // o
  "#83674d", // p
  "#3b2c11", // q
  "#4a4717", // r
  "#3b2c11", // s
  "#56300e", // t
];

/** Palette index -> dye zone (null = fixed color: skin, outline).
 *  primary = Cloak · secondary = Tunic · hair = Boots. */
export const ADV_ZONES: ReadonlyArray<OutfitZone | null> = [
  null, // a
  null, // b
  "primary", // c
  "secondary", // d
  null, // e
  null, // f
  "secondary", // g
  "primary", // h
  null, // i
  "primary", // j
  null, // k
  "secondary", // l
  "primary", // m
  "primary", // n
  null, // o
  "primary", // p
  "primary", // q
  "secondary", // r
  "hair", // s
  "hair", // t
];

export const ADV_CHARS = "abcdefghijklmnopqrst";

export const ADV_DOWN: readonly string[] = [
  ".....qqf......",
  "....khchh.....",
  "...fhhchhq....",
  "...fhccchhk...",
  "..bfhqffhhf...",
  "..khfqfqfqf...",
  "..fqkkhqkff...",
  "..qqemjhpnqb..",
  "..qfjaeiaqhb..",
  "..fqfieijfff..",
  ".rgffhnnffolf.",
  "krgfqqqfqqqgqf",
  "fqffhhrrcqkqq.",
  "nehfhqdrhqkceo",
  "rjnkqhhhqfbjlo",
  "rdk.fqfqqkbfgd",
  "fqkkffmqff.kdo",
  "fjffqfqffhbqcf",
  "qjqfhfffqhfhjq",
  ".qbqqqbkfqfbf.",
  "...fqdbkqfb...",
  "...fsfbbfso...",
  "...ftf.bstb...",
  "...bffbkffb...",
  "..fttf..ftt...",
  "..bffk..kffb..",
];

export const ADV_SIDE: readonly string[] = [
  "...fqqk.....",
  "..hchhhf....",
  ".hcchhhhf...",
  "fqhhhhhqh...",
  "bkqchhhqf...",
  ".qfqhhqfb...",
  ".jmehhhfb...",
  "oeaihhfqfb..",
  ".maiqhqqbom.",
  ".fjhqqfokohq",
  "..bfqfrlqqhf",
  "..qqhqqrdocq",
  "..hrcqfqqkhf",
  "..frhqkneqh.",
  "..khhfknldqq",
  "..bfqfkdgkq.",
  "..koqfkrgkh.",
  "..kfffnrkfhk",
  "..kfffjef...",
  "..kqkhqqk...",
  "..bffqqb....",
  "...ffksb....",
  "..kffksb....",
  ".kffbksf....",
  "..bbbtsfb...",
  "....ksfk....",
];

export const ADV_UP: readonly string[] = [
  ".....fqof....",
  "....qcchhf...",
  "...qcchhhhf..",
  "...qhchhhhf..",
  "..kqhhhhhqf..",
  "..kfhhhhhqk..",
  "..kffhqhffk..",
  ".bkqfffffqk..",
  "bo.qhqhhhhf..",
  "nnofhcchqfk..",
  "qhhcfhhqkdrb.",
  ".hccfffkfggk.",
  ".fqhckqhfqqf.",
  "kmfhchfhffqh.",
  "keqqhhffffeik",
  "orbbhhhkfbngo",
  "kqkbfhhfkbfgo",
  "bfbkkffkqfbqk",
  ".fbqhqdrhfbfk",
  "..kqhggrqfkfq",
  "..kforrdqfb..",
  "...kfkkkff...",
  "...fsk.bsf...",
  "..kffb.ksfb..",
  "..bbfb.kffk..",
  "...bbb.......",
];
