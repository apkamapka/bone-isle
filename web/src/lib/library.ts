/**
 * The library's rules (etap 2.3): how a page is addressed, how a drop chance
 * is said, how a number is written, how a creature's frame is cut from its
 * sheet. Pure functions with no imports, so the smoke suite can hold them to
 * their word without building the site. The tables themselves come from
 * game-data.ts, which only the build reads.
 */

/** A page's address, the way the game names its art: orcWarrior → orc-warrior. */
export function slugOf(key: string): string {
  return key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
}

export const creatureUrl = (kind: string): string => `/library/creatures/${slugOf(kind)}/`;

/**
 * The library's shelves, in menu order. A null href is a shelf that opens in
 * a later step of etap 2; it is drawn dimmed, the way the top bar draws the
 * pages that open with the game.
 */
export const SECTIONS: readonly { label: string; href: string | null; blurb: string }[] = [
  { label: "Creatures", href: "/library/creatures/", blurb: "What you will fight, what it carries and where it lives." },
  { label: "Items", href: null, blurb: "Weapons, armor, trophies and supplies, and how to get each one." },
  { label: "NPCs", href: null, blurb: "The people of Bonetown, and what they sell and buy." },
  { label: "Crystals", href: null, blurb: "The Alchemy Tower's shelf, element by element." },
  { label: "Places", href: null, blurb: "Maps of the islands and of the deeps below them." },
];

export type Rarity = "Always" | "Common" | "Uncommon" | "Semi-rare" | "Rare" | "Very rare";

/**
 * How a drop chance is shown. The site never prints the number (decided
 * Sept 2026): a player reads one of these words instead. Each band starts at
 * its floor, so 20% is Common and 19% is Uncommon.
 */
export const RARITY_BANDS: readonly (readonly [number, Rarity])[] = [
  [1, "Always"],
  [0.2, "Common"],
  [0.05, "Uncommon"],
  [0.01, "Semi-rare"],
  [0.005, "Rare"],
  [0, "Very rare"],
];

export function rarityLabel(chance: number): Rarity {
  for (const [floor, label] of RARITY_BANDS) if (chance >= floor) return label;
  return "Very rare";
}

/** "3", or "1–3" for a range. */
export function span(range: readonly [number, number]): string {
  return range[0] === range[1] ? num(range[0]) : `${num(range[0])}–${num(range[1])}`;
}

/** A count with thousands marked, the way the rest of the site writes them: 32000 → "32,000". */
export function num(n: number): string {
  return n.toLocaleString("en-US");
}

/** Damage taken from an element, from the game's multiplier: 0.5 → "50%". */
export function taken(mult: number): string {
  return `${Math.round(mult * 100)}%`;
}

/** Walking speed in tiles a second, from the game's world pixels a second. */
export function tilesPerSecond(pxPerS: number, tile = 32): string {
  return (pxPerS / tile).toFixed(1);
}

/** "A", "A and B", "A, B and C". */
export function listOf(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** A walk sheet as the exporter describes it: 4 rows (up, left, down, right). */
export interface SheetLike {
  file: string;
  w: number;
  h: number;
  frameW: number;
  frameH: number;
  cols: number;
  cycleS: number;
}

/** The row that faces the viewer. A side-only creature carries its side view there too. */
export const FACING_ROW = 2;

/**
 * Inline custom properties for `.sprite`: one frame of the sheet at a whole
 * number scale, never stretched. The walk runs over the stride frames, which
 * are every column but the first: column 0 is the creature standing still.
 */
export function spriteVars(s: SheetLike, scale: number): string {
  const w = s.frameW * scale;
  const h = s.frameH * scale;
  return [
    `--sprite: url(/play/${s.file})`,
    `--w: ${w}px`,
    `--h: ${h}px`,
    `--sheet: ${s.w * scale}px ${s.h * scale}px`,
    `--y: ${-FACING_ROW * h}px`,
    `--from: ${-w}px`,
    `--to: ${-s.cols * w}px`,
    `--steps: ${s.cols - 1}`,
    `--cycle: ${s.cycleS}s`,
  ].join("; ");
}

/** The biggest whole scale at which a frame stays within `max` px wide. */
export function fitScale(frameW: number, max: number, top = 3): number {
  for (let k = top; k > 1; k--) if (frameW * k <= max) return k;
  return 1;
}
