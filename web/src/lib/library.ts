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
export const itemUrl = (key: string): string => `/library/items/${slugOf(key)}/`;
export const npcUrl = (key: string): string => `/library/npcs/${slugOf(key)}/`;
export const crystalUrl = (key: string): string => `/library/crystals/${slugOf(key)}/`;

/** Any item's page: the Crystals shelf for a crystal, the Items shelf for everything else. */
export const itemHref = (i: { key: string; category: string }): string =>
  i.category === "crystal" ? crystalUrl(i.key) : itemUrl(i.key);

/**
 * Whether an item belongs on the Items shelf. Crystals have a shelf of their
 * own (etap 2.6), with the crystal rules the item tables do not carry; link
 * to any item through `itemHref`, which knows which shelf it is on.
 */
export const hasItemPage = (category: string): boolean => category !== "crystal";

/**
 * The library's shelves, in menu order. A null href is a shelf that opens in
 * a later step of etap 2; it is drawn dimmed, the way the top bar draws the
 * pages that open with the game.
 */
export const SECTIONS: readonly { label: string; href: string | null; blurb: string }[] = [
  { label: "Creatures", href: "/library/creatures/", blurb: "What you will fight, what it carries and where it lives." },
  { label: "Items", href: "/library/items/", blurb: "Weapons, armor, trophies and supplies, and how to get each one." },
  { label: "NPCs", href: "/library/npcs/", blurb: "The people of Bonetown, and what they sell and buy." },
  { label: "Crystals", href: "/library/crystals/", blurb: "The Alchemy Tower's shelf, element by element." },
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

/**
 * A drop's band as a number, 0 for Always: what lists sort by. Inside a band
 * they go by name, never by the exact chance, or the order itself would tell
 * a careful reader which of two "Semi-rare" drops comes more often.
 */
export function rarityRank(chance: number): number {
  const i = RARITY_BANDS.findIndex(([floor]) => chance >= floor);
  return i < 0 ? RARITY_BANDS.length - 1 : i;
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

/** I, II, III: how the game numbers building tiers. */
export function roman(n: number): string {
  return ["0", "I", "II", "III", "IV", "V"][n] ?? `${n}`;
}

/** Seconds as a player would say them: 180 → "3 min", 45 → "45 s". */
export function duration(s: number): string {
  return s >= 60 && s % 60 === 0 ? `${num(s / 60)} min` : `${num(s)} s`;
}

/** The item list's groups, in order. Crystals are left to their own shelf. */
export const ITEM_GROUPS: readonly { category: string; label: string; id: string }[] = [
  { category: "weapon", label: "Weapons", id: "weapons" },
  { category: "distance weapon", label: "Distance weapons", id: "distance-weapons" },
  { category: "shield", label: "Shields", id: "shields" },
  { category: "armor", label: "Armor", id: "armor" },
  { category: "jewellery", label: "Jewellery", id: "jewellery" },
  { category: "ammunition", label: "Ammunition", id: "ammunition" },
  { category: "potion", label: "Potions", id: "potions" },
  { category: "food", label: "Food", id: "food" },
  { category: "container", label: "Containers", id: "containers" },
  { category: "material", label: "Materials", id: "materials" },
  { category: "coin", label: "Coins", id: "coins" },
];

/** The worn slots in the order a body is dressed, for sorting armor. */
export const SLOT_ORDER: readonly string[] = ["head", "body", "legs", "boots"];

const SLOT_KIND: Record<string, string> = {
  head: "Helmet", body: "Body armor", legs: "Legs armor", boots: "Boots", ring: "Ring", amulet: "Amulet",
};
const CATEGORY_KIND: Record<string, string> = {
  weapon: "Weapon", "distance weapon": "Distance weapon", shield: "Shield", ammunition: "Ammunition",
  crystal: "Crystal", potion: "Potion", food: "Food", container: "Container", coin: "Coin", material: "Material",
};

/** What an item is, in a word or two: "Helmet", "Distance weapon", "Material". */
export function itemKind(i: { category: string; slot?: string }): string {
  return (i.slot && SLOT_KIND[i.slot]) || CATEGORY_KIND[i.category] || i.category;
}

/** The parts of an item the facts are read from, as the exporter writes them. */
export interface ItemLike {
  category: string;
  slot?: string;
  weight: number;
  stack: number;
  element?: string;
  gear?: { atk?: number; def?: number; defBonus?: number; speed?: number; maxhp?: number; dist?: number };
  bow?: { range: number; power: number };
  ammo?: { dmg: number };
  practice?: true;
  deathProtect?: true;
  pack?: { slots: number };
  coin?: number;
  heal?: number;
  food?: number;
}

export interface Fact { label: string; value: string }

/**
 * An item's numbers as a player reads them, in a fixed order: what it does
 * first, then weight and stack. A worn piece's guard is its armor; in the hand
 * the same number is defense, the way the game itself splits them.
 */
export function itemFacts(i: ItemLike, elementLabel: (id: string) => string = (id) => id, tile = 32): Fact[] {
  const out: Fact[] = [];
  const g = i.gear ?? {};
  const plus = (n: number): string => (n > 0 ? `+${num(n)}` : num(n));
  const worn = i.category === "armor" || i.category === "jewellery";
  if (g.atk !== undefined) out.push({ label: "Attack", value: num(g.atk) });
  if (g.def !== undefined) out.push({ label: worn ? "Armor" : "Defense", value: num(g.def) });
  if (g.defBonus !== undefined) out.push({ label: "Defense bonus", value: plus(g.defBonus) });
  if (i.bow) {
    out.push({ label: "Range", value: `${num(Math.round(i.bow.range / tile))} tiles` });
    out.push({ label: "Power", value: plus(i.bow.power) });
    out.push({ label: "Grip", value: "Two-handed" });
  }
  if (i.ammo) out.push({ label: "Damage", value: plus(i.ammo.dmg) });
  if (i.element) out.push({ label: "Element", value: elementLabel(i.element) });
  if (i.practice) out.push({ label: "Use", value: "Archery Range only" });
  if (g.speed !== undefined) out.push({ label: "Speed", value: plus(g.speed) });
  if (g.maxhp !== undefined) out.push({ label: "Hit points", value: plus(g.maxhp) });
  if (g.dist !== undefined) out.push({ label: "Distance fighting", value: plus(g.dist) });
  if (i.deathProtect) out.push({ label: "On death", value: "Keeps your items, then breaks" });
  if (i.heal !== undefined) out.push({ label: "Heals", value: `${num(i.heal)} HP` });
  if (i.food !== undefined) out.push({ label: "Regeneration", value: duration(i.food) });
  if (i.pack) out.push({ label: "Slots", value: num(i.pack.slots) });
  if (i.coin !== undefined) out.push({ label: "Worth", value: `${num(i.coin)} gold` });
  out.push({ label: "Weight", value: `${num(i.weight)} oz` });
  if (i.stack > 1) out.push({ label: "Stacks to", value: num(i.stack) });
  return out;
}

/** The facts for a list row: what the item does, without weight and stack. */
export function itemSummary(i: ItemLike, elementLabel?: (id: string) => string): string {
  return itemFacts(i, elementLabel)
    .filter((f) => f.label !== "Weight" && f.label !== "Stacks to")
    .map((f) => `${f.label} ${f.value}`)
    .join(", ");
}

/** The elemental forms, in the order the tower shelves them, with how each one picks what it hits. */
export const CRYSTAL_FORMS: readonly { form: string; label: string; target: string }[] = [
  { form: "shard", label: "Shard", target: "One creature" },
  { form: "burst", label: "Burst", target: "A square you pick" },
  { form: "nova", label: "Nova", target: "All around you" },
  { form: "wave", label: "Wave", target: "Ahead of you" },
  { form: "knell", label: "Knell", target: "One creature" },
];

/** What a crystal spec is made of, as the exporter writes it. */
export interface CrystalLike {
  form: string;
  element: string | null;
  tier: number | null;
  reachTiles: number | null;
  footprint: number | null;
  cooldownS: number | null;
  durationS: number | null;
  lockS: number | null;
  afterS: number | null;
}

/** A crystal's numbers for its page's header: what it is, what it reaches, how long it waits. */
export function crystalFacts(c: CrystalLike, elementLabel: (id: string) => string = (id) => id): Fact[] {
  const out: Fact[] = [];
  const form = CRYSTAL_FORMS.find((f) => f.form === c.form);
  if (c.element) out.push({ label: "Element", value: elementLabel(c.element) });
  if (c.tier !== null) out.push({ label: "Tier", value: roman(c.tier) });
  if (form) out.push({ label: "Hits", value: form.target });
  // main.ts's doRecall: a journey home, refused only where you already are.
  if (c.form === "recall") out.push({ label: "Works", value: "Anywhere but Home Isle" });
  if (c.reachTiles !== null) out.push({ label: c.form === "slowdown" ? "Radius" : "Reach", value: `${num(c.reachTiles)} tiles` });
  if (c.footprint !== null && c.footprint > 1) out.push({ label: "Tiles hit", value: num(c.footprint) });
  if (c.durationS !== null) out.push({ label: "Lasts", value: duration(c.durationS) });
  if (c.afterS !== null) out.push({ label: "Then burns", value: duration(c.afterS) });
  if (c.cooldownS !== null) out.push({ label: "Cooldown", value: duration(c.cooldownS) });
  if (c.lockS !== null) out.push({ label: "Once every", value: duration(c.lockS) });
  return out;
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
