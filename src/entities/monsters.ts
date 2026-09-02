/** Monster definitions, post spawning and the wander/chase/attack AI. */
import { rnd, rndi, wrnd, dist } from "../util.ts";
import { SPAWN_AVOID_PLAYER_PX, MONSTER_AGGRO_RANGE, MONSTER_AGGRO_HOLD_RANGE, POST_LEASH_PX, SHOT_SPEED, TILE } from "../config.ts";
import { SPR } from "../gfx/sprites.ts";
import { lineOfSight } from "../world/collision.ts";
import { nextEntityId } from "../world/entities.ts";
import { toTile, tileCenter, glideWalker, tryStep, chebTiles, octile, STEPS8, walkable } from "../world/grid.ts";
import { inHaven } from "../world/collision.ts";
import { stepFacing } from "../gfx/mobSheet.ts";
import { addBlast, addBolt } from "../gfx/spellFx.ts";
import { beginCast, isCasting, type MonsterSpell } from "../systems/monsterSpells.ts";
import type { Occupied } from "../world/grid.ts";
import type { World, Monster, MonsterKind } from "../world/types.ts";
import type { ItemKind } from "../items.ts";
import type { Resistances, Element, Tier } from "../systems/elements.ts";

/** A weighted loot entry: item, drop chance, and min/max quantity. */
export interface LootEntry {
  kind: ItemKind;
  chance: number;
  n: readonly [number, number];
}

/** A monster's ranged attack (archers, shamans, dragon fire). */
export interface RangedDef {
  /** Firing reach in WORLD px (doubled with TILE in Etap 17). Must stay under
   *  MONSTER_AGGRO_RANGE so a shooter never plinks from beyond its awareness. */
  range: number;
  /** Ranged damage roll — separate from `dmg`, which stays the melee roll. */
  dmg: readonly [number, number];
  /** Projectile tint; omit for the classic steel-gray arrow. */
  color?: string;
  /** Thicker projectile stroke (fireballs). */
  wide?: boolean;
  /**
   * Draw this attack as a real spell bolt instead of a coloured stroke.
   *
   * Purely cosmetic — the hit is rolled and applied identically either way,
   * exactly as an arrow's is. It exists because half the bestiary's "ranged
   * attack" is explicitly magic in its own comment (a shaman's crackling
   * bolt, a mage's fire bolt, dragon fire) and was being drawn as a two-pixel
   * line, while a full elemental FX pipeline sat one import away serving only
   * the player. `tier` picks the ARTWORK, nothing else; a creature's damage
   * has never had anything to do with a crystal's tier.
   */
  fx?: { el: Element; tier: Tier };
  /** Brute shooter (the dragon): does NOT kite. It keeps advancing like a
   *  melee monster, breathes at range, then switches to its paw (the melee
   *  `dmg` roll) once it reaches you — so it both closes in AND blasts fire,
   *  instead of backing away and only spitting. */
  brute?: boolean;
}

/**
 * The name to print. The def's own if it has one, else the kind title-cased.
 *
 * Corpses store the kind as their `name`, so this is also what the remains of
 * a named boss read as.
 */
export function mobName(kind: string): string {
  const named = (MONSTER_DEFS as Record<string, { name?: string } | undefined>)[kind]?.name;
  return named ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

export interface MonsterDef {
  spr: HTMLCanvasElement;
  /**
   * What the player is told this thing is called.
   *
   * Absent for almost everything, because "orcWarrior" title-cased is already
   * the answer. It exists for the named ones — the bosses the folklore gives a
   * NAME rather than a species, where "Redcap" is a kind of creature and
   * "Robin Redcap" is a person who did specific things to specific people.
   *
   * Deliberately separate from the KIND, which stays as it is: the kind keys
   * the sprite sheets in `mobSheet.ts`, the corpse lookup, the world specs and
   * the mission's `boss` field, and renaming it would mean renaming PNGs in
   * `public/` for a string nobody but the engine reads.
   */
  name?: string;
  hp: number;
  /** MELEE damage roll (shooters stab weakly when cornered). */
  dmg: readonly [number, number];
  speed: number;
  atkRate: number;
  exp: number;
  gold: readonly [number, number];
  loot: readonly LootEntry[];
  /** Danger band: how far from the world's entrance it spawns (0..1). */
  danger: number;
  /**
   * Flat armor rating, mirroring the player's: every incoming hit is reduced
   * by a roll from half this value to all of it. Absent means bare flesh.
   *
   * Because the reduction is flat it costs a hail of weak blows far more than
   * one heavy one, which is what makes a hulking armored creature a genuine
   * wall to a low-skill character and merely an inconvenience to a trained
   * one. It is also the reason elemental damage will matter: crystals are
   * meant to bypass this entirely, so armor is what they are the answer to.
   */
  armor?: number;
  /**
   * Elemental resistances, as multipliers on incoming crystal damage. Absent
   * means ordinary flesh (1.0 to everything). Kept sparse on purpose: if every
   * creature had a full table the player would carry five pouches and consult
   * a chart before each fight, which is bookkeeping, not a decision.
   */
  resist?: Resistances;
  /** Present on distance fighters: they hold ground and shoot (Tibia-style),
   *  back away when the player closes in, and fall back to `dmg` in melee. */
  ranged?: RangedDef;
  /** Respawn override in seconds (the dragon's lair refills slowly). */
  respawnS?: number;
  /**
   * Big, telegraphed attacks on their own cooldowns — see `monsterSpells.ts`.
   *
   * Separate from `ranged` on purpose. `ranged` is the jab: it fires on the
   * ordinary attack cadence, aims at a body, and governs whether the creature
   * kites or charges. These are the haymakers: they aim at GROUND, they draw
   * a warning first, and the creature stands still while they wind up. A
   * caster wants both, and collapsing them into one field would mean choosing
   * between "attacks every two seconds" and "has a shape you can dodge".
   *
   * Listed strongest first. The AI casts the first one that is off cooldown
   * and in range, so ordering IS priority.
   */
  spells?: readonly MonsterSpell[];
}

/**
 * The bestiary, ordered from the entrance outward. `danger` is the spawn band:
 * (Etap 40: the danger band this once described is gone; kept only as the
 * note that hp is what a tier is derived from.) Once: distance from the
 * entrance (0 = the arrival coast, 1 = the farthest
 * reaches). The six original creatures keep their stats — only their bands were
 * re-tuned to the new distance-from-entrance gradient; the other seven fill and
 * extend the difficulty curve so tougher foes are discovered further in.
 */
/**
 * The bestiary. All creatures attack on the same 2.0 s cadence as the player
 * (Tibia 8.6's standard weapon speed — duels are blow-for-blow); their damage
 * ranges were scaled up from the old faster cadence so DPS stayed the same:
 * rarer, heavier hits, exactly the old-Tibia feel. A monster's actual hit is
 * rolled uniformly inside `dmg` and then reduced by the player's defense.
 */
/**
 * Creature artwork loaded from PNGs, keyed by kind.
 *
 * `MONSTER_DEFS` is readonly and its baked sprite is the guaranteed fallback,
 * so drawn artwork lives beside it: `mobSprite()` prefers the loaded canvas
 * and drops back to the bake when there is none. Instances copy the sprite at
 * spawn, so anything alive when a PNG lands is swept by the loader.
 */
const mobArt: Partial<Record<MonsterKind, HTMLCanvasElement>> = {};

/** Install artwork for a creature; pass null to fall back to the baked sprite. */
export function setMobArt(k: MonsterKind, c: HTMLCanvasElement | null): void {
  if (c) mobArt[k] = c;
  else delete mobArt[k];
}

/** The sprite a creature of this kind should draw with. */
export function mobSprite(k: MonsterKind): HTMLCanvasElement {
  return mobArt[k] ?? MONSTER_DEFS[k].spr;
}

/* ------------------------------------------------------------------ *
 *  MONSTER BUDGET — what a creature meant for a given level should cost
 *
 *  The bestiary was built by hand, one creature at a time, and it shows: exp
 *  per unit of threat runs from 0.33 on a bandit down to 0.022 on a dragon.
 *  Part of that slope is intentional — deeper creatures SHOULD pay less per
 *  point of danger, or levelling accelerates instead of decelerating — but
 *  nothing was governing it, so every new creature was a freehand guess
 *  against its neighbours.
 *
 *  These functions make the intent explicit: place a creature by naming the
 *  level it is FOR, and read off what it should carry. The smoke tests hold
 *  the shipped bestiary to them within a deliberately wide band, because a
 *  creature that is pointedly glassy or pointedly spongy is good design and
 *  should still be allowed to exist.
 * ------------------------------------------------------------------ */

/** HP a creature built for `level` should carry — six to eight swings from a
 *  properly geared character of that level. */
export function monsterHpBudget(level: number): number {
  return Math.round(14 + 7.5 * level + 0.16 * level * level);
}

/** Damage per second it should deal, BEFORE the player's armor. */
export function monsterDpsBudget(level: number): number {
  return 1.6 + 0.72 * level;
}

/** Experience it should award. Threat is hp × dps, and the sub-unit exponent
 *  is what makes deeper creatures pay less per point of danger — without it,
 *  levelling would accelerate instead of decelerating.
 *
 *  The coefficients are a least-squares fit to the bestiary as shipped, not an
 *  invention: whoever placed those 33 creatures by hand was following a curve
 *  without writing it down, and this is that curve recovered. Median error
 *  0.95×, which is why the tests band at ±40% rather than pretending to more
 *  precision than hand-placed data can support. */
export function monsterExpBudget(level: number): number {
  const threat = monsterHpBudget(level) * monsterDpsBudget(level);
  return Math.round(0.879 * Math.pow(threat, 0.663));
}

/** Armor rating for that level. Zero is always legitimate — ghosts and vermin
 *  are supposed to be soft. */
export function monsterArmorBudget(level: number): number {
  return Math.round(0.42 * level);
}

/** The level a creature's stats actually correspond to, read back from its HP. */
export function monsterTierOf(hp: number): number {
  for (let l = 1; l <= 100; l++) if (monsterHpBudget(l) >= hp) return l;
  return 100;
}

export const MONSTER_DEFS: Readonly<Record<MonsterKind, MonsterDef>> = {
  /* ================================================================== *
   *  THE HUMAN LADDER — levels 1-14: vermin of the road
   *
   *  Everything here is a person, and every rank now has its own LPC walk
   *  sheet and its own body — the `humanFoe` bake in each `spr` field is only
   *  the fallback for the moment before the sheet lands. Stats are read
   *  straight off the budget curves above at the level named in each comment,
   *  then bent by archetype: a shooter trades HP and melee for reach, a
   *  cutthroat trades HP for damage, an armoured rank trades speed for armor.
   *
   *  Where a rank carries a visible weapon, the loot table names that weapon:
   *  the cutthroat swings a hammer and drops one, the deserter wears a blade
   *  and drops an iron sword. A drop the player never saw the corpse holding
   *  reads as a slot-machine payout; a drop he watched swing at him reads as
   *  spoils. Two ranks are exceptions the item list forces — the brigand and
   *  the mercenary fight with spears, and there is no spear to drop.
   * ================================================================== */
  // lvl 1. The floor of the game: it must not be able to kill a fresh
  // character even if the player walks away from the keyboard mid-fight.
  beggar: {
    spr: SPR.humanFoe, hp: 15, dmg: [3, 7], speed: 49, atkRate: 2.0, exp: 10, gold: [1, 2], danger: 0.02,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "leatherHelm", chance: 0.03, n: [1, 1] },
      { kind: "leatherBody", chance: 0.03, n: [1, 1] },
      { kind: "leatherLegs", chance: 0.03, n: [1, 1] },
      { kind: "leatherBoots", chance: 0.03, n: [1, 1] },
      { kind: "leatherShield", chance: 0.03, n: [1, 1] },
    ],
  },
  // lvl 2
  vagrant: {
    spr: SPR.humanFoe, hp: 25, dmg: [3, 9], speed: 51, atkRate: 2.0, exp: 15, gold: [1, 4], danger: 0.04, armor: 1,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "leatherHelm", chance: 0.03, n: [1, 1] },
      { kind: "leatherBody", chance: 0.03, n: [1, 1] },
      { kind: "leatherLegs", chance: 0.03, n: [1, 1] },
      { kind: "leatherBoots", chance: 0.03, n: [1, 1] },
      { kind: "leatherShield", chance: 0.03, n: [1, 1] },
      { kind: "shortSword", chance: 0.02, n: [1, 1] },
    ],
  },
  // lvl 3. Quick and light — the first creature that can actually run the
  // player down, which is what teaches that speed is a stat.
  thief: {
    spr: SPR.humanFoe, hp: 30, dmg: [4, 11], speed: 66, atkRate: 2.0, exp: 25, gold: [2, 5], danger: 0.05, armor: 1,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "leatherHelm", chance: 0.04, n: [1, 1] },
      { kind: "leatherBody", chance: 0.04, n: [1, 1] },
      { kind: "leatherLegs", chance: 0.04, n: [1, 1] },
      { kind: "leatherBoots", chance: 0.04, n: [1, 1] },
      { kind: "leatherShield", chance: 0.04, n: [1, 1] },
      { kind: "shortSword", chance: 0.04, n: [1, 1] },
    ],
  },
  // lvl 5. THE first shooter in the game, and the reason it exists: with the
  // spiders gone nothing taught kiting before the orc archer on cave1, which
  // is twenty levels too late. A sling: short reach, weak in melee.
  poacher: {
    spr: SPR.humanFoe, hp: 45, dmg: [3, 8], speed: 56, atkRate: 2.0, exp: 40, gold: [3, 9], danger: 0.08, armor: 1,
    ranged: { range: 160, dmg: [6, 17], color: "#a89a72" }, // slung stones
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "leatherHelm", chance: 0.04, n: [1, 1] },
      { kind: "leatherBody", chance: 0.04, n: [1, 1] },
      { kind: "leatherLegs", chance: 0.04, n: [1, 1] },
      { kind: "leatherBoots", chance: 0.04, n: [1, 1] },
      { kind: "leatherShield", chance: 0.04, n: [1, 1] },
      { kind: "bow", chance: 0.05, n: [1, 1] },
      { kind: "arrow", chance: 0.3, n: [1, 3] },
    ],
  },
  // lvl 6. Promoted out of the level-1 slot it used to hold: the bandit is
  // now the "you can fight" checkpoint rather than the tutorial dummy.
  bandit: {
    spr: SPR.rat, hp: 65, dmg: [7, 17], speed: 53, atkRate: 2.0, exp: 45, gold: [4, 11], danger: 0.06, armor: 3,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "hpPotion", chance: 0.08, n: [1, 1] },
      { kind: "leatherHelm", chance: 0.06, n: [1, 1] },
      { kind: "leatherBody", chance: 0.06, n: [1, 1] },
      { kind: "leatherLegs", chance: 0.06, n: [1, 1] },
      { kind: "leatherBoots", chance: 0.06, n: [1, 1] },
      { kind: "leatherShield", chance: 0.06, n: [1, 1] },
      { kind: "shortSword", chance: 0.04, n: [1, 1] },
    ],
  },
  // lvl 8
  smuggler: {
    spr: SPR.humanFoe, hp: 85, dmg: [8, 21], speed: 54, atkRate: 2.0, exp: 60, gold: [5, 14], danger: 0.12, armor: 3,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "studdedHelm", chance: 0.04, n: [1, 1] },
      { kind: "studdedBody", chance: 0.04, n: [1, 1] },
      { kind: "studdedLegs", chance: 0.04, n: [1, 1] },
      { kind: "studdedBoots", chance: 0.04, n: [1, 1] },
      { kind: "studdedShield", chance: 0.04, n: [1, 1] },
      { kind: "shortSword", chance: 0.05, n: [1, 1] },
    ],
  },
  // lvl 9. Glass cannon: hits a rank above its HP and moves faster than
  // anything else at this depth, so it must be answered rather than tanked.
  cutthroat: {
    spr: SPR.humanFoe, hp: 80, dmg: [9, 23], speed: 68, atkRate: 2.0, exp: 80, gold: [5, 16], danger: 0.15, armor: 4,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "studdedHelm", chance: 0.05, n: [1, 1] },
      { kind: "studdedBody", chance: 0.05, n: [1, 1] },
      { kind: "studdedLegs", chance: 0.05, n: [1, 1] },
      { kind: "studdedBoots", chance: 0.05, n: [1, 1] },
      { kind: "studdedShield", chance: 0.05, n: [1, 1] },
      // The hammer in his hands, not a sword he was never drawn holding. It
      // hits harder than anything else available at this depth (atk 15 against
      // the iron sword's 10) and pays for it in defence — a real trade, and
      // the first time the ladder offers one.
      { kind: "warHammer", chance: 0.03, n: [1, 1] },
    ],
  },
  // lvl 11. The first creature in real armour — flat reduction bites hardest
  // against a hail of weak blows, so this is where a low-skill character
  // learns its weapon matters.
  deserter: {
    spr: SPR.humanFoe, hp: 125, dmg: [10, 28], speed: 49, atkRate: 2.0, exp: 90, gold: [7, 19], danger: 0.18, armor: 7,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "studdedHelm", chance: 0.08, n: [1, 1] },
      { kind: "studdedBody", chance: 0.08, n: [1, 1] },
      { kind: "studdedLegs", chance: 0.08, n: [1, 1] },
      { kind: "studdedBoots", chance: 0.08, n: [1, 1] },
      { kind: "studdedShield", chance: 0.08, n: [1, 1] },
      // He is the sword drop of the human ladder. At 6% it was a rounding
      // error nobody would notice; at 12% killing deserters is a way to arm a
      // second character, which is what an army's runaway should be worth.
      { kind: "ironSword", chance: 0.08, n: [1, 1] },
    ],
  },
  // lvl 12
  brigand: {
    spr: SPR.humanFoe, hp: 125, dmg: [11, 30], speed: 56, atkRate: 2.0, exp: 100, gold: [7, 21], danger: 0.2, armor: 6,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "studdedHelm", chance: 0.08, n: [1, 1] },
      { kind: "studdedBody", chance: 0.08, n: [1, 1] },
      { kind: "studdedLegs", chance: 0.08, n: [1, 1] },
      { kind: "studdedBoots", chance: 0.08, n: [1, 1] },
      { kind: "studdedShield", chance: 0.08, n: [1, 1] },
      { kind: "ironSword", chance: 0.05, n: [1, 1] },
    ],
  },
  // lvl 14. The bridge into the fantastic bestiary: beat this and the
  // skeletons and goblins at 15-16 are the next honest step.
  highwayman: {
    spr: SPR.humanFoe, hp: 160, dmg: [13, 34], speed: 60, atkRate: 2.0, exp: 130, gold: [11, 32], danger: 0.25, armor: 7,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "studdedHelm", chance: 0.08, n: [1, 1] },
      { kind: "studdedBody", chance: 0.08, n: [1, 1] },
      { kind: "studdedLegs", chance: 0.08, n: [1, 1] },
      { kind: "studdedBoots", chance: 0.08, n: [1, 1] },
      { kind: "studdedShield", chance: 0.08, n: [1, 1] },
      { kind: "ironSword", chance: 0.06, n: [1, 1] },
      { kind: "mercBlade", chance: 0.03, n: [1, 1] },
    ],
  },

  /* ================================================================== *
   *  THE REDCAP — the Time Sage's first boss, for a character of ten
   *
   *  Everything about him comes out of the Border sources rather than out of
   *  a stat block, and every line below is a sentence from one of them:
   *
   *  "impossible to outrun, despite the iron boots"  → speed 79, the fastest
   *      thing in the bestiary, four clear of the orc berserker's 75 and a
   *      fifth quicker than the cutthroat. He still does not literally outrun
   *      a level-10 character, and he is not meant to: what he does is close
   *      every gap you open, so backing off to drink costs ground every time.
   *  "flings huge stones at those who take refuge"   → a ranged attack that
   *      does NOT kite. `brute` is what makes him throw AND keep closing,
   *      exactly like the dragon, because a creature famous for running you
   *      down must never back away to plink.
   *  "iron boots, unhurt by human strength"          → armor 9. Enough to
   *      make a level-10 character feel the wall without being the wall.
   *
   *  The numbers themselves are read off the budget curves at tier 25, which
   *  is ten tiers over the top of the ground he is meant to be reached from
   *  (the human ladder, 8-14): the hunting ground is the training, the echo
   *  is the exam. Melee sits deliberately low in the band because the stones
   *  are not counted in `dmg` and land on top of it.
   *
   *  WHERE HE LIVES: the lair under Liddesdale, on his own square at the far
   *  end of it, and nowhere else in the game.
   * ================================================================== */
  redcap: {
    // Named, because the folklore names him: Robin Redcap, familiar to William
    // de Soulis of Hermitage. Henderson has him as Redcap Sly.
    spr: SPR.humanFoe,
    name: "Robin Redcap",
    /* HP DOUBLED, 300 -> 600, on Radek's call after walking the fight twice.
     * Nothing else moves with it: his damage, his speed and his stones are all
     * still on the level-10 budget, so the fight gets LONGER rather than
     * sharper — more windows to misplay, more potions spent, and the ranged
     * stones matter because there is now time to be caught by them. */
    hp: 600, dmg: [17, 44], speed: 79, atkRate: 2.0, exp: 300,
    // The purse stays on the curve — what he took off the road, no more than
    // an orc warrior of the same exp carries. The thirty platinum is NOT on
    // him at all: it is a one-time chest in `CHEST_PRIZES.hermitage`, three
    // squares behind where he stands. He respawns and the chest does not, so
    // the payday is paid once and the fight can be had again.
    gold: [25, 55], danger: 0.5, armor: 9,
    // Iron, and old. Fire barely notices him; the shadow he came out of does
    // not touch him at all; the storm that split the tower he lives in does.
    resist: { fire: 0.8, shadow: 0.5, storm: 1.4 },
    // The stones. Six tiles — inside aggro, so he never plinks from beyond
    // his own awareness — and a stone is drawn as a plain thrown mass, not
    // as a spell, because nothing about a redcap is magic.
    ranged: { range: 6 * TILE, dmg: [15, 38], color: "#9aa0a8", wide: true, brute: true },
    loot: [
      // The relic. Flat 100%: the mission cannot be gated behind a dice roll,
      // and `wantsRelic` in missions.ts is what stops a second one existing.
      { kind: "bloodCap", chance: 1.0, n: [1, 1] },
    ],
  },

  /* ================================================================== *
   *  KÁRR THE OLD — the Time Sage's SECOND boss, level 15
   *
   *  A draugr: not a ghost and not a skeleton, but the corpse itself, up
   *  and walking and still holding what it was buried with. The sagas are
   *  consistent about three things and all three are stats here, which is
   *  the point — the chronicle the player reads on the way in promises
   *  exactly what this table delivers, and the smoke suite pins each one:
   *
   *    THE WEIGHT   `speed: 40`, the slowest creature in the game, under
   *                 the skeleton's 41. Þórólfr swelled to the size of an ox
   *                 and could not be lifted without levers. You CAN walk
   *                 away from him — that is the fact, and it is the exact
   *                 inverse of the redcap, whom nothing outruns.
   *    THE ARMOUR   `armor: 26`. Flat reduction is rolled per hit, so a
   *                 hail of weak blows is worth almost nothing against him
   *                 and heavy ones are the whole answer. Grave-iron and
   *                 dead meat swollen tight.
   *    THE FIRE     `resist.fire: 1.5`. Iron wounds a draugr and does not
   *                 finish it; burning is what the sagas do about one. The
   *                 multiplier is PASSIVE — there is no pyre to light and
   *                 no second phase. You kill him the ordinary way; fire
   *                 simply gets there sooner.
   *
   *  He is slow and enormously hard, which is a deliberate shape: the fight
   *  is a standing exchange you choose to have, in a room with eight of his
   *  victims already in it. Eighteen hundred hit points is twice the dragon's
   *  and three times the redcap's, and it is the longest fight in the game by
   *  a distance — which is the point of a boss you cannot be caught by.
   *
   *  The purse stays on the bestiary's own gold curve. The payday — a Power
   *  Ring and twenty platinum — is a one-time chest in `CHEST_PRIZES.haugr`,
   *  because he respawns and the chest does not.
   *
   *  WHERE HE LIVES: the howe under Haramsey, and nowhere else in the game.
   * ================================================================== */
  draugr: {
    // Named, because Grettis saga names him: Kárr inn gamli, buried on
    // Haramsey, who drove every farmer off the island except the one he liked.
    spr: SPR.humanFoe,
    name: "Kárr the Old",
    /* HP DOUBLED, 900 -> 1800, on Radek's call after walking the fight — the
     * same correction the redcap got in Etap 42 and for the same reason.
     * Nothing else moves with it: damage, armour and speed all stay on the
     * level-15 budget, so the fight gets LONGER rather than sharper. That is
     * the right shape for this one in particular, because he is the slowest
     * thing in the game and the room is full of his victims: length is what
     * turns "stand and trade" into "manage the room". */
    hp: 1800, dmg: [34, 90], speed: 40, atkRate: 2.0, exp: 750,
    gold: [30, 60], danger: 0.5, armor: 26,
    // Fire is the saga's answer to him and the only thing here that is.
    // Shadow is what he is made of; ice is weather, and he has been dead
    // through eight hundred winters of it.
    resist: { fire: 1.5, shadow: 0.5, ice: 0.6 },
    loot: [
      // The relic. Flat 100%, same reason as the cap: a mission cannot be
      // gated behind a dice roll, and `wantsRelic` is what stops a second one.
      { kind: "graveHelm", chance: 1.0, n: [1, 1] },
    ],
  },

  /* ================================================================== *
   *  THE FANTASTIC BESTIARY, lower rungs — levels 15-22
   *
   *  Re-tiered wholesale (Etap 20). In Tibia these are level-8 fodder; here
   *  a goblin is a level-16 monster and a skeleton a level-15 one, because
   *  a creature out of myth losing to a man with a knife reads wrong.
   * ================================================================== */
  // lvl 3. The one animal left, and the only creature that never wore armour:
  // it stays down in the opening band beside the vagrants.
  snake: {
    spr: SPR.snake, hp: 30, dmg: [4, 11], speed: 58, atkRate: 2.0, exp: 20, gold: [1, 4], danger: 0.1, resist: { earth: 0.6, ice: 1.5 },
    loot: [
      { kind: "venomGland", chance: 0.25, n: [1, 1] },
      { kind: "snakeskinHelm", chance: 0.05, n: [1, 1] },
      { kind: "snakeskinBody", chance: 0.05, n: [1, 1] },
      { kind: "snakeskinLegs", chance: 0.05, n: [1, 1] },
      { kind: "snakeskinBoots", chance: 0.05, n: [1, 1] },
      { kind: "snakeskinShield", chance: 0.05, n: [1, 1] },
      { kind: "fangDagger", chance: 0.04, n: [1, 1] },
    ],
  },
  // lvl 15. Slowest thing in the game — it is meant to be outwalked, which is
  // what makes fighting one a choice rather than an ambush.
  skeleton: {
    spr: SPR.skeleton, hp: 160, dmg: [14, 36], speed: 41, atkRate: 2.0, exp: 135, gold: [7, 20], danger: 0.3, armor: 7, resist: { shadow: 0.6, fire: 1.3 },
    loot: [{ kind: "bones", chance: 0.9, n: [1, 3] }],
  },
  // lvl 16
  goblin: {
    spr: SPR.goblin, hp: 175, dmg: [14, 38], speed: 60, atkRate: 2.0, exp: 150, gold: [7, 21], danger: 0.4, armor: 7,
    loot: [
      { kind: "cursedRib", chance: 0.15, n: [1, 1] },
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "goblinFang", chance: 0.15, n: [1, 1] },
      { kind: "meat", chance: 0.4, n: [1, 1] }, { kind: "hpPotion", chance: 0.12, n: [1, 1] },
      { kind: "goblinHelm", chance: 0.05, n: [1, 1] },
      { kind: "goblinBody", chance: 0.05, n: [1, 1] },
      { kind: "goblinLegs", chance: 0.05, n: [1, 1] },
      { kind: "goblinBoots", chance: 0.05, n: [1, 1] },
      { kind: "goblinShield", chance: 0.05, n: [1, 1] },
      { kind: "goblinHatchet", chance: 0.05, n: [1, 1] },
    ],
  },
  // lvl 16. The human ladder's answer to the goblin, stat for stat — the two
  // families are meant to be interchangeable at equal level.
  mercenary: {
    spr: SPR.humanFoe, hp: 175, dmg: [14, 38], speed: 53, atkRate: 2.0, exp: 150, gold: [10, 28], danger: 0.3, armor: 9,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "chainHelm", chance: 0.08, n: [1, 1] },
      { kind: "chainBody", chance: 0.08, n: [1, 1] },
      { kind: "chainLegs", chance: 0.08, n: [1, 1] },
      { kind: "chainBoots", chance: 0.08, n: [1, 1] },
      { kind: "chainShield", chance: 0.08, n: [1, 1] },
      { kind: "mercBlade", chance: 0.08, n: [1, 1] },
    ],
  },
  // lvl 18
  corsair: {
    spr: SPR.humanFoe, hp: 190, dmg: [16, 42], speed: 61, atkRate: 2.0, exp: 185, gold: [11, 32], danger: 0.35, armor: 9,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "chainHelm", chance: 0.08, n: [1, 1] },
      { kind: "chainBody", chance: 0.08, n: [1, 1] },
      { kind: "chainLegs", chance: 0.08, n: [1, 1] },
      { kind: "chainBoots", chance: 0.08, n: [1, 1] },
      { kind: "chainShield", chance: 0.08, n: [1, 1] },
      { kind: "mercBlade", chance: 0.06, n: [1, 1] },
    ],
  },
  // lvl 20. No armour at all in the numbers, and more HP than anything near
  // it: the mirror image of the deserter, and a fight your weapon choice
  // barely changes. Note the artwork disagrees — he was generated in full
  // legion steel, the same suit the brigand wears eight levels below him. If
  // that reads wrong at the tile, it is the sheet to change, not this line.
  wildWarrior: {
    spr: SPR.humanFoe, hp: 250, dmg: [18, 46], speed: 56, atkRate: 2.0, exp: 200, gold: [12, 35], danger: 0.4,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "chainHelm", chance: 0.06, n: [1, 1] },
      { kind: "chainBody", chance: 0.06, n: [1, 1] },
      { kind: "chainLegs", chance: 0.06, n: [1, 1] },
      { kind: "chainBoots", chance: 0.06, n: [1, 1] },
      { kind: "chainShield", chance: 0.06, n: [1, 1] },
      // The arming sword in his hands. He used to drop a war hammer, which
      // now falls off a cutthroat eleven levels earlier — a level-20 kill
      // handing out a level-9 weapon is a rung that leads nowhere. The
      // gladius is the first blade past the mercenary blade and had no
      // source below the gladiator at 29.
      { kind: "gladius", chance: 0.05, n: [1, 1] },
    ],
  },
  /* ================================================================== *
   *  VIKING — lvl 15-18, and the top of Haramsey's moor
   *
   *  The first rank in the game added because a MAP wanted one rather than
   *  because the ladder had a hole in it. Haramsey was fielding mercenaries,
   *  corsairs and wild warriors, which is a perfectly good gradient and
   *  reads as nobody in particular; the island is a Norse burial coast and
   *  the living on it should look it.
   *
   *  He is the WALL of that island, not its spike. Mail, a round shield and
   *  an axe put him at armour 16 — half again the wild warrior's nothing and
   *  the reason he is worth stopping for — but his hit points and damage
   *  stay inside the same band, because everything on a level-15 hunting
   *  ground has to be killable by a character with about three hundred hit
   *  points. Two hundred and fifteen experience is a shade over the ghouls
   *  waiting in the howe below him, which is deliberate: the island and the
   *  room under it are one weight class and Kárr is the only step up.
   *
   *  He drops what he is visibly wearing, and NOTHING a forge should have
   *  made. That is the rule the whole ladder follows and it matters most on a
   *  creature the player will kill thirty-two times over: chain, the shield on
   *  his arm, the axe in his hand, and the coal off his fire.
   * ================================================================== */
  viking: {
    spr: SPR.humanFoe,
    hp: 265, dmg: [19, 50], speed: 54, atkRate: 2.0, exp: 215, gold: [14, 34],
    danger: 0.6, armor: 16,
    /* NO IRON AND NO STEEL. The forge materials are SMELTED from looted gear
     * and from nothing else — that is what `smelt.ts` is for and it is the
     * only reason anyone builds a forge. A creature that hands out bar stock
     * directly is a creature that makes the forge optional, so the ingots came
     * back off this table the day they went on. Coal is different and stays:
     * it is fuel, and it drops off anything that makes camp. */
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "chainHelm", chance: 0.06, n: [1, 1] },
      { kind: "chainBody", chance: 0.06, n: [1, 1] },
      { kind: "chainLegs", chance: 0.06, n: [1, 1] },
      { kind: "chainBoots", chance: 0.06, n: [1, 1] },
      // The round shield on his arm, and the axe in his hand. Both are the
      // pieces his sprite actually carries, which is the only rule this
      // table has ever followed.
      { kind: "chainShield", chance: 0.08, n: [1, 1] },
      { kind: "orcishAxe", chance: 0.04, n: [1, 1] },
    ],
  },
  // lvl 20
  ghoul: {
    spr: SPR.ghoul, hp: 240, dmg: [18, 46], speed: 51, atkRate: 2.0, exp: 200, gold: [9, 26], danger: 0.5, armor: 9, resist: { shadow: 0.5, fire: 1.4 },
    loot: [{ kind: "bones", chance: 0.8, n: [1, 3] }, { kind: "ghoulClaw", chance: 0.2, n: [1, 1] }],
  },
  // lvl 21
  orc: {
    spr: SPR.orc, hp: 240, dmg: [18, 48], speed: 49, atkRate: 2.0, exp: 215, gold: [9, 27], danger: 0.62, armor: 11,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "orcEar", chance: 0.15, n: [1, 1] },
      { kind: "meat", chance: 0.5, n: [1, 2] },
      { kind: "orcishHelm", chance: 0.05, n: [1, 1] },
      { kind: "orcishBody", chance: 0.05, n: [1, 1] },
      { kind: "orcishLegs", chance: 0.05, n: [1, 1] },
      { kind: "orcishBoots", chance: 0.05, n: [1, 1] },
      { kind: "orcishShield", chance: 0.05, n: [1, 1] },
      { kind: "orcishAxe", chance: 0.05, n: [1, 1] },
    ],
  },
  // lvl 22. Same fight as an orc warrior, wearing the same iron and swinging
  // on the same two-second beat — the armour is what the rank is, not the
  // goblin under it.
  goblinLegionary: {
    spr: SPR.goblin, hp: 270, dmg: [19, 51], speed: 54, atkRate: 2.0, exp: 230, gold: [13, 37], danger: 0.6, armor: 14,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "goblinFang", chance: 0.15, n: [1, 1] },
      { kind: "goblinHelm", chance: 0.08, n: [1, 1] },
      { kind: "goblinBody", chance: 0.08, n: [1, 1] },
      { kind: "goblinLegs", chance: 0.08, n: [1, 1] },
      { kind: "goblinBoots", chance: 0.08, n: [1, 1] },
      { kind: "goblinShield", chance: 0.08, n: [1, 1] },
      { kind: "goblinHatchet", chance: 0.08, n: [1, 1] },
    ],
  },
  // lvl 22. A sling, like the poacher's, but thrown from twice the muscle:
  // real reach, and still the shortest of any shooter, so she has to be
  // chased rather than merely walked away from. The bow in her loot is the
  // poacher's compromise repeated — there is no sling to drop.
  amazon: {
    spr: SPR.humanFoe, hp: 220, dmg: [10, 26], speed: 63, atkRate: 2.0, exp: 245, gold: [13, 39], danger: 0.45, armor: 9,
    ranged: { range: 190, dmg: [22, 57], color: "#a89a72" }, // slung stones
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "chainHelm", chance: 0.05, n: [1, 1] },
      { kind: "chainBody", chance: 0.05, n: [1, 1] },
      { kind: "chainLegs", chance: 0.05, n: [1, 1] },
      { kind: "chainBoots", chance: 0.05, n: [1, 1] },
      { kind: "chainShield", chance: 0.05, n: [1, 1] },
      { kind: "bow", chance: 0.08, n: [1, 1] },
      { kind: "arrow", chance: 0.4, n: [1, 3] },
    ],
  },

  /* ================================================================== *
   *  MID LADDER — levels 25-32
   * ================================================================== */
  // lvl 25
  orcArcher: {
    spr: SPR.orcArcher, hp: 240, dmg: [12, 29], speed: 54, atkRate: 2.0, exp: 280, gold: [11, 32], danger: 0.55, armor: 10,
    ranged: { range: 220, dmg: [24, 64], color: "#b98a4e" }, // crossbow bolts
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "orcEar", chance: 0.15, n: [1, 1] },
      { kind: "boneArrow", chance: 0.4, n: [2, 6] }, { kind: "meat", chance: 0.3, n: [1, 1] },
      { kind: "orcishHelm", chance: 0.04, n: [1, 1] },
      { kind: "orcishBody", chance: 0.04, n: [1, 1] },
      { kind: "orcishLegs", chance: 0.04, n: [1, 1] },
      { kind: "orcishBoots", chance: 0.04, n: [1, 1] },
      { kind: "orcishShield", chance: 0.04, n: [1, 1] },
    ],
  },
  // lvl 25. The longest human reach in the game, and it out-ranges its own
  // awareness by a wide margin — provoke one and retreat and it punishes you.
  hunter: {
    spr: SPR.humanFoe, hp: 240, dmg: [12, 29], speed: 58, atkRate: 2.0, exp: 305, gold: [15, 44], danger: 0.5, armor: 9,
    ranged: { range: 280, dmg: [24, 64] },
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "chainHelm", chance: 0.05, n: [1, 1] },
      { kind: "chainBody", chance: 0.05, n: [1, 1] },
      { kind: "chainLegs", chance: 0.05, n: [1, 1] },
      { kind: "chainBoots", chance: 0.05, n: [1, 1] },
      { kind: "chainShield", chance: 0.05, n: [1, 1] },
      { kind: "longbow", chance: 0.08, n: [1, 1] },
      { kind: "boneArrow", chance: 0.45, n: [1, 3] },
    ],
  },
  // lvl 26
  orcWarrior: {
    spr: SPR.orcWarrior, hp: 335, dmg: [22, 59], speed: 51, atkRate: 2.0, exp: 295, gold: [15, 44], danger: 0.6, armor: 16,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "orcEar", chance: 0.15, n: [1, 1] },
      { kind: "meat", chance: 0.4, n: [1, 1] },
      { kind: "orcishHelm", chance: 0.08, n: [1, 1] },
      { kind: "orcishBody", chance: 0.08, n: [1, 1] },
      { kind: "orcishLegs", chance: 0.08, n: [1, 1] },
      { kind: "orcishBoots", chance: 0.08, n: [1, 1] },
      { kind: "orcishShield", chance: 0.08, n: [1, 1] },
      { kind: "orcishAxe", chance: 0.08, n: [1, 1] },
    ],
  },
  // lvl 27
  minotaur: {
    spr: SPR.minotaur, hp: 365, dmg: [23, 61], speed: 51, atkRate: 2.0, exp: 310, gold: [12, 35], danger: 0.8, armor: 14,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "minotaurHorn", chance: 0.15, n: [1, 1] },
      { kind: "bones", chance: 0.6, n: [1, 3] }, { kind: "meat", chance: 0.4, n: [1, 2] },
      { kind: "minotaurHelm", chance: 0.05, n: [1, 1] },
      { kind: "minotaurBody", chance: 0.05, n: [1, 1] },
      { kind: "minotaurLegs", chance: 0.05, n: [1, 1] },
      { kind: "minotaurBoots", chance: 0.05, n: [1, 1] },
      { kind: "minotaurShield", chance: 0.05, n: [1, 1] },
      { kind: "minotaurAxe", chance: 0.05, n: [1, 1] },
    ],
  },
  // lvl 28. No longer the minotaur guard's twin (it was, before the re-tier):
  // the guard climbed to 36 and this one holds 28 as the heavy of its own
  // band — same silhouette, eight levels apart.
  skeletonWarrior: {
    spr: SPR.skeleton, hp: 365, dmg: [24, 63], speed: 49, atkRate: 2.0, exp: 345, gold: [16, 47], danger: 0.85, armor: 18, resist: { shadow: 0.6, fire: 1.3 },
    loot: [
      { kind: "cursedRib", chance: 0.15, n: [1, 1] },
      { kind: "marrowHelm", chance: 0.05, n: [1, 1] },
      { kind: "marrowBody", chance: 0.05, n: [1, 1] },
      { kind: "marrowLegs", chance: 0.05, n: [1, 1] },
      { kind: "marrowBoots", chance: 0.05, n: [1, 1] },
      { kind: "marrowShield", chance: 0.05, n: [1, 1] },
    ],
  },
  // lvl 28. Shield and plate: the human wall, and the armour rating is the
  // whole fight — a trained character walks through it, an untrained one does not.
  gladiator: {
    spr: SPR.humanFoe, hp: 365, dmg: [24, 63], speed: 54, atkRate: 2.0, exp: 345, gold: [22, 64], danger: 0.6, armor: 15,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "plateHelm", chance: 0.08, n: [1, 1] },
      { kind: "plateBody", chance: 0.08, n: [1, 1] },
      { kind: "plateLegs", chance: 0.08, n: [1, 1] },
      { kind: "plateBoots", chance: 0.08, n: [1, 1] },
      { kind: "plateShield", chance: 0.08, n: [1, 1] },
      { kind: "gladius", chance: 0.08, n: [1, 1] },
    ],
  },
  // lvl 30
  minotaurArcher: {
    spr: SPR.minotaurArcher, hp: 325, dmg: [14, 35], speed: 51, atkRate: 2.0, exp: 385, gold: [14, 39], danger: 0.68, armor: 14,
    ranged: { range: 300, dmg: [29, 75], color: "#efe9d6" }, // bone-tipped bolts
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "minotaurHorn", chance: 0.15, n: [1, 1] },
      { kind: "boneArrow", chance: 0.6, n: [3, 10] }, { kind: "longbow", chance: 0.03, n: [1, 1] },
      { kind: "minotaurHelm", chance: 0.05, n: [1, 1] },
      { kind: "minotaurBody", chance: 0.05, n: [1, 1] },
      { kind: "minotaurLegs", chance: 0.05, n: [1, 1] },
      { kind: "minotaurBoots", chance: 0.05, n: [1, 1] },
      { kind: "minotaurShield", chance: 0.05, n: [1, 1] },
    ],
  },
  // lvl 30. The most HP of any human, the least armour of its tier: it dies
  // to a good weapon and grinds down a bad one.
  barbarian: {
    spr: SPR.humanFoe, hp: 440, dmg: [26, 67], speed: 60, atkRate: 2.0, exp: 365, gold: [18, 53], danger: 0.65, armor: 14,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "plateHelm", chance: 0.08, n: [1, 1] },
      { kind: "plateBody", chance: 0.08, n: [1, 1] },
      { kind: "plateLegs", chance: 0.08, n: [1, 1] },
      { kind: "plateBoots", chance: 0.08, n: [1, 1] },
      { kind: "plateShield", chance: 0.08, n: [1, 1] },
      { kind: "warHammer", chance: 0.06, n: [1, 1] },
    ],
  },
  // lvl 31
  orcShaman: {
    spr: SPR.orcShaman, hp: 300, dmg: [14, 36], speed: 44, atkRate: 2.0, exp: 440, gold: [14, 40], danger: 0.72, armor: 12, resist: { fire: 0.6, ice: 1.4 },
    ranged: { range: 260, dmg: [30, 78], color: "#8a6cff", fx: { el: "shadow", tier: 0 } }, // crackling magic bolt
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "orcEar", chance: 0.15, n: [1, 1] },
      { kind: "healCrystal", chance: 0.2, n: [1, 2] },
      { kind: "orcishHelm", chance: 0.04, n: [1, 1] },
      { kind: "orcishBody", chance: 0.04, n: [1, 1] },
      { kind: "orcishLegs", chance: 0.04, n: [1, 1] },
      { kind: "orcishBoots", chance: 0.04, n: [1, 1] },
      { kind: "orcishShield", chance: 0.04, n: [1, 1] },
    ],
  },
  // lvl 32
  raider: {
    spr: SPR.humanFoe, hp: 440, dmg: [27, 71], speed: 58, atkRate: 2.0, exp: 420, gold: [25, 73], danger: 0.7, armor: 15,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "plateHelm", chance: 0.08, n: [1, 1] },
      { kind: "plateBody", chance: 0.08, n: [1, 1] },
      { kind: "plateLegs", chance: 0.08, n: [1, 1] },
      { kind: "plateBoots", chance: 0.08, n: [1, 1] },
      { kind: "plateShield", chance: 0.08, n: [1, 1] },
      { kind: "gladius", chance: 0.06, n: [1, 1] },
    ],
  },

  /* ================================================================== *
   *  TOP OF THE LADDER — levels 35-50
   * ================================================================== */
  // lvl 35. Fastest creature in the game at 88 — still under the player's
  // base 116, because nothing should be able to outrun a retreat outright.
  orcBerserker: {
    spr: SPR.orcBerserker, hp: 495, dmg: [29, 78], speed: 75, atkRate: 2.0, exp: 460, gold: [20, 59], danger: 0.8, armor: 18,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "orcEar", chance: 0.15, n: [1, 1] },
      { kind: "meat", chance: 0.5, n: [1, 2] },
      { kind: "orcishHelm", chance: 0.08, n: [1, 1] },
      { kind: "orcishBody", chance: 0.08, n: [1, 1] },
      { kind: "orcishLegs", chance: 0.08, n: [1, 1] },
      { kind: "orcishBoots", chance: 0.08, n: [1, 1] },
      { kind: "orcishShield", chance: 0.08, n: [1, 1] },
      { kind: "orcishAxe", chance: 0.08, n: [1, 1] },
    ],
  },
  // lvl 36
  minotaurGuard: {
    spr: SPR.minotaurGuard, hp: 565, dmg: [30, 80], speed: 48, atkRate: 2.0, exp: 480, gold: [21, 61], danger: 0.85, armor: 22,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "minotaurHorn", chance: 0.15, n: [1, 1] },
      { kind: "bones", chance: 0.6, n: [2, 4] },
      { kind: "minotaurHelm", chance: 0.08, n: [1, 1] },
      { kind: "minotaurBody", chance: 0.08, n: [1, 1] },
      { kind: "minotaurLegs", chance: 0.08, n: [1, 1] },
      { kind: "minotaurBoots", chance: 0.08, n: [1, 1] },
      { kind: "minotaurShield", chance: 0.08, n: [1, 1] },
      { kind: "minotaurAxe", chance: 0.08, n: [1, 1] },
    ],
  },
  // lvl 36. The human mini-boss: the heaviest armour on a person, meant to
  // stand at the middle of a camp with a pack of raiders around him.
  warlord: {
    spr: SPR.humanFoe, hp: 540, dmg: [30, 80], speed: 51, atkRate: 2.0, exp: 555, gold: [28, 82], danger: 0.8, armor: 20,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "steelHelm", chance: 0.08, n: [1, 1] },
      { kind: "steelBody", chance: 0.08, n: [1, 1] },
      { kind: "steelLegs", chance: 0.08, n: [1, 1] },
      { kind: "steelBoots", chance: 0.08, n: [1, 1] },
      { kind: "steelShield", chance: 0.08, n: [1, 1] },
      { kind: "warlordBlade", chance: 0.08, n: [1, 1] },
    ],
  },
  // lvl 37
  minotaurMage: {
    spr: SPR.minotaurMage, hp: 410, dmg: [17, 42], speed: 44, atkRate: 2.0, exp: 605, gold: [22, 63], danger: 0.9, armor: 16, resist: { storm: 0.5, earth: 1.4 },
    ranged: { range: 280, dmg: [35, 91], color: "#ff8a3a", wide: true, fx: { el: "fire", tier: 0 } }, // fire bolt
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "minotaurHorn", chance: 0.15, n: [1, 1] },
      { kind: "minotaurHelm", chance: 0.08, n: [1, 1] },
      { kind: "minotaurBody", chance: 0.08, n: [1, 1] },
      { kind: "minotaurLegs", chance: 0.08, n: [1, 1] },
      { kind: "minotaurBoots", chance: 0.08, n: [1, 1] },
      { kind: "minotaurShield", chance: 0.08, n: [1, 1] },
    ],
  },
  // lvl 40. The top of the human ladder, and deliberately the demon
  // skeleton's equal in weight class: the two families meet at the end.
  chieftain: {
    spr: SPR.humanFoe, hp: 685, dmg: [33, 88], speed: 54, atkRate: 2.0, exp: 680, gold: [32, 91], danger: 0.9, armor: 21,
    loot: [
      { kind: "coal", chance: 0.4, n: [1, 3] },
      { kind: "steelHelm", chance: 0.08, n: [1, 1] },
      { kind: "steelBody", chance: 0.08, n: [1, 1] },
      { kind: "steelLegs", chance: 0.08, n: [1, 1] },
      { kind: "steelBoots", chance: 0.08, n: [1, 1] },
      { kind: "steelShield", chance: 0.08, n: [1, 1] },
      // He is drawn with a longsword, and the item that matches it is the
      // Knight's Longsword — which he still must not drop, even though the
      // black knight now does at 5%. Knight gear belongs to the two level-50
      // fights and the four chests; handing it out at 40 would collapse the
      // last ten levels of the ladder into one. The maul stays.
      { kind: "steelMaul", chance: 0.08, n: [1, 1] },
    ],
  },
  // lvl 40. Second-hardest thing in the game and shaped as the dragon's
  // shadow: about seven tenths of its HP, three quarters of its experience.
  // The difference that matters is reach — the dragon breathes, this one has
  // only claws, so it can be fought at a bow's length in a way the dragon
  // never allows. It sits at 40 rather than 35 because nothing else would
  // occupy the stretch between the minotaur mage and the boss.
  demonSkeleton: {
    spr: SPR.skeleton, hp: 710, dmg: [33, 88], speed: 53, atkRate: 2.0, exp: 655, gold: [23, 68], danger: 0.97, armor: 24, resist: { fire: 0.5, shadow: 0.3, storm: 1.5 },
    loot: [
      { kind: "cursedRib", chance: 0.15, n: [1, 1] },
      { kind: "marrowHelm", chance: 0.08, n: [1, 1] },
      { kind: "marrowBody", chance: 0.08, n: [1, 1] },
      { kind: "marrowLegs", chance: 0.08, n: [1, 1] },
      { kind: "marrowBoots", chance: 0.08, n: [1, 1] },
      { kind: "marrowShield", chance: 0.08, n: [1, 1] },
      { kind: "demonCleaver", chance: 0.08, n: [1, 1] },
    ],
  },
  // lvl 50. A brute that charges in, mauls with its paw for heavy hits, AND
  // throws fire at range — no backing away and plinking. Its lair refills on a
  // long clock instead of the standard trickle.
  //
  // The first creature in the game with real SPELLS. Its jab is a fireball
  // that now flies as an actual bolt; on top of that sit three shapes, and
  // between them they change what fighting it is like. It is a brute, so it
  // is always closing — the point of the kit is that there is no comfortable
  // distance to settle at. Roar punishes hugging it, Breath punishes standing
  // in front of it, and the Field punishes standing anywhere for long.
  //
  // Ordering IS priority: the first spell off cooldown and in range wins the
  // beat. Roar is first so that being adjacent is answered immediately;
  // Breath second because it reaches past the ring; Field last, since it is
  // the one that works at any distance and should not crowd out the others.
  //
  // Playtest pass: the first cut ran 9 s and 15 s cooldowns behind a painted
  // warning, and the whole thing read as harmless. Both were roughly halved,
  // the windups cut to a beat, and the floor overlay dropped.
  dragon: {
    spr: SPR.dragon, hp: 1000, dmg: [41, 109], speed: 51, atkRate: 2.0, exp: 900, gold: [90, 210], danger: 0.99, armor: 28, resist: { fire: 0.25, ice: 1.6 },
    ranged: { range: 320, dmg: [47, 122], color: "#ff5a2a", wide: true, brute: true, fx: { el: "fire", tier: 0 } }, // dragon fire
    spells: [
      // The eight tiles touching it. `range` on a caster-anchored shape is not
      // reach — the footprint is fixed — it is "how close before this is worth
      // spending". Just under two tiles means it fires when you are actually
      // in the ring and never at a shooter across the room.
      { name: "Searing Roar", element: "fire", tier: 0, shape: "nova", dmg: [30, 78], range: 1.9 * TILE, cooldownS: 7, windupS: 0.25 },
      // Nine tiles, four deep, out of the mouth. Under the jab's damage: it
      // catches through a wall of bodies and reaches well past melee, so it
      // should not also hit hardest.
      { name: "Fire Breath", element: "fire", tier: 0, shape: "cone", dmg: [36, 94], range: 5 * TILE, cooldownS: 4.5, windupS: 0.25, depth: 4 },
      // A plus of burning ground under your feet. No impact damage of its own —
      // the fire IS the attack, and it bills you every second you stand in it.
      { name: "Fire Field", element: "fire", tier: 0, shape: "field", dmg: [0, 0], range: 8 * TILE, cooldownS: 7, windupS: 0.25, fieldS: 8 },
    ],
    respawnS: 600,
    loot: [
      { kind: "dragonHam", chance: 0.9, n: [2, 5] },
      { kind: "dragonScale", chance: 0.6, n: [1, 3] },
      // the ONLY source of the Essence: the strongest crystal of every
      // element is bought from the tower with something the dragon owns
      { kind: "magicEssence", chance: 0.2, n: [1, 1] },
      { kind: "dragonHelm", chance: 0.05, n: [1, 1] },
      { kind: "dragonBody", chance: 0.05, n: [1, 1] },
      { kind: "dragonLegs", chance: 0.05, n: [1, 1] },
      { kind: "dragonBoots", chance: 0.05, n: [1, 1] },
      { kind: "dragonShield", chance: 0.05, n: [1, 1] },
      { kind: "fireSword", chance: 0.05, n: [1, 1] },
    ],
  },

  // lvl 50, the dragon's opposite number. Same weight class, different fight.
  //
  // Where the dragon is a slow wall that fills space with fire, the knight is
  // a man who CLOSES. He is quicker on his feet, hits marginally harder in the
  // exchange, and carries the heaviest armor in the bestiary — but his shapes
  // are narrow. The lightning line is one tile wide and blocked by walls,
  // where the breath is three wide and pours around them, so terrain that is
  // useless against the dragon is genuine cover against him, and standing in
  // the open is the mistake he punishes.
  //
  // Storm-resistant, obviously, and grounded through plate: earth goes through
  // him. Both are the levers a player has once he works out what he is facing.
  //
  // Armor is 28, TIED with the dragon rather than above it. 32 was the first
  // number and the balance-budget test rejected it; the band exists so this
  // stops being decided by feel, and his identity does not need to rest on
  // the one stat the curve caps hardest.
  blackKnight: {
    spr: SPR.humanFoe, hp: 950, dmg: [44, 112], speed: 58, atkRate: 2.0, exp: 880, gold: [80, 190], danger: 0.98, armor: 28, resist: { storm: 0.3, shadow: 0.6, earth: 1.35 },
    ranged: { range: 300, dmg: [42, 106], color: "#7dd8ff", fx: { el: "storm", tier: 0 }, brute: true }, // arcing bolt
    spells: [
      // The ring, for when he is being hugged — same role as the dragon's
      // Roar and a beat quicker, because he does not have to draw breath.
      { name: "Thunderclap", element: "storm", tier: 0, shape: "nova", dmg: [32, 84], range: 1.9 * TILE, cooldownS: 6, windupS: 0.22 },
      // Six tiles in a straight line and the hardest single hit either caster
      // owns. It can afford to be: one tile wide, and a wall stops it dead.
      { name: "Chain Lightning", element: "storm", tier: 0, shape: "line", dmg: [40, 100], range: 7 * TILE, cooldownS: 4, windupS: 0.22, depth: 6 },
    ],
    respawnS: 600,
    loot: [
      { kind: "steel", chance: 0.5, n: [1, 3] },
      { kind: "coal", chance: 0.4, n: [1, 3] },
      // The knight SET, entire, at one flat 5% a piece — sword and shield with
      // it. The chests on cave3/bastion2/orcdeep1/minodeep1 still hold one of
      // each and are still the first way anyone sees the armour; this is the
      // repeatable way, gated behind the hardest fight in the game rather than
      // behind a floor you clear once. A whole suit off one corpse is a 1-in-3.2
      // million run, which is the point: the set is farmable, not handed out.
      { kind: "knightHelm", chance: 0.05, n: [1, 1] },
      { kind: "knightBody", chance: 0.05, n: [1, 1] },
      { kind: "knightLegs", chance: 0.05, n: [1, 1] },
      { kind: "knightBoots", chance: 0.05, n: [1, 1] },
      { kind: "knightShield", chance: 0.05, n: [1, 1] },
      { kind: "knightSword", chance: 0.05, n: [1, 1] },
    ],
  },
};

export const MONSTER_KINDS = Object.keys(MONSTER_DEFS) as MonsterKind[];

/**
 * Shared constructor for a freshly spawned creature.
 *
 * Etap 40 dropped the `home` parameter along with the camp system: the only
 * caller left is `spawnAtPost`, which sets the leash itself from the tile the
 * map's author drew the creature on.
 */
function pushMonster(
  w: World,
  kind: MonsterKind,
  p: { x: number; y: number },
): boolean {
  const d = MONSTER_DEFS[kind];
  // grid rule: every creature claims exactly one tile — never spawn onto a
  // square already claimed by another creature
  const tx = toTile(p.x);
  const ty = toTile(p.y);
  if (w.monsters.some((o) => o.tx === tx && o.ty === ty)) return false;
  // never materialise ON a portal either — a creature spawned on the ladder
  // would block the floor's entrance from the very first frame. Covers both
  // spawn paths at once (authored post and respawn).
  if (w.portals.some((pt) => toTile(pt.x) === tx && toTile(pt.y) === ty)) return false;
  // A haven inside a hostile map is off limits to every spawn path at once.
  if (inHaven(w, tx, ty)) return false;
  w.monsters.push({
    id: nextEntityId(),
    kind,
    x: tileCenter(tx),
    y: tileCenter(ty),
    tx,
    ty,
    spr: mobSprite(kind),
    hp: d.hp,
    maxhp: d.hp,
    speed: d.speed,
    atkRate: d.atkRate,
    atkCd: wrnd(0, 1),
    wanderT: wrnd(0, 2),
    dir: "down",
    bob: wrnd(0, 3),
    hurtT: 0,
    aggroT: 0,
    orbit: wrnd(0, 1) < 0.5 ? 1 : -1,
  });
  return true;
}

/**
 * Plant a creature right beside a fixed tile — used for the treasure-chest
 * guards (Etap 13): every one-time chest is now watched by a dragon coiled on
 * top of its hoard, so the prize has to be fought for rather than walked to.
 * Rings outward from the chest until a free walkable tile turns up, so it
 * always lands as close to the chest as the cavern allows.
 */
/**
 * Put a creature on the exact tile a map author marked, falling back to the
 * nearest free ring if that square is taken (a corpse-blocked respawn, say).
 * The post is recorded so the creature returns here when it is killed.
 */
export function spawnAtPost(
  w: World, kind: MonsterKind, tx: number, ty: number, avoid?: { x: number; y: number },
): boolean {
  const free =
    w.solid[ty]?.[tx] === false && (w.tile[ty]?.[tx] ?? 0) > 0 &&
    !w.monsters.some((m) => m.tx === tx && m.ty === ty);
  if (free) {
    const cx = tileCenter(tx);
    const cy = tileCenter(ty);
    const clear = !avoid || dist(cx, cy, avoid.x, avoid.y) >= SPAWN_AVOID_PLAYER_PX;
    if (clear && pushMonster(w, kind, { x: cx, y: cy })) {
      const m = w.monsters[w.monsters.length - 1];
      m.guard = { tx, ty };
      // Leash it to its post. `guard` alone only decides where it comes back
      // after dying; without this the creature wanders off its zone entirely.
      m.hx = cx;
      m.hy = cy;
      m.hr = POST_LEASH_PX;
      return true;
    }
  }
  return spawnGuard(w, kind, tx, ty, avoid);
}

export function spawnGuard(
  w: World, kind: MonsterKind, tx: number, ty: number, avoid?: { x: number; y: number },
): boolean {
  for (let r = 1; r <= 6; r++) {
    const ring: Array<[number, number]> = [];
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue; // ring edge only
        ring.push([tx + ox, ty + oy]);
      }
    }
    for (const [nx, ny] of ring) {
      if (nx < 1 || ny < 1 || nx >= w.w - 1 || ny >= w.h - 1) continue;
      if (w.solid[ny]?.[nx] !== false || !(w.tile[ny]?.[nx] > 0)) continue;
      if (w.monsters.some((m) => m.tx === nx && m.ty === ny)) continue;
      const cx = tileCenter(nx);
      const cy = tileCenter(ny);
      // never materialise on top of the player
      if (avoid && dist(cx, cy, avoid.x, avoid.y) < SPAWN_AVOID_PLAYER_PX) continue;
      if (pushMonster(w, kind, { x: cx, y: cy })) {
        // tag it so a slain guard respawns back onto its hoard, and leash it
        // to the post so it keeps to its own ground while idle
        const g = w.monsters[w.monsters.length - 1];
        g.guard = { tx, ty };
        g.hx = tileCenter(tx);
        g.hy = tileCenter(ty);
        g.hr = POST_LEASH_PX;
        return true;
      }
    }
  }
  return false;
}

/* `spawnMonster` (the danger-band / uniform-scatter placer), `spawnWilderness`
 * (free roamers between settlements) and `spawnMonsterInCamp` (village
 * garrisons) all lived here and all three went in Etap 40 with the procedural
 * maps that used them. Every creature in the game is now placed by
 * `spawnAtPost` onto a square its author chose, and respawns onto that same
 * square — so a floor cannot slowly re-clump into one corner, which is the
 * bug the uniform scatter existed to work around in the first place. */

/** Roll a monster's loot into concrete stacks + gold. Runtime randomness —
 *  deliberately NOT the deterministic world RNG, so kills never perturb the
 *  world-generation stream and drop chances/amounts share one RNG source. */
export function rollLoot(kind: MonsterKind): { items: { kind: ItemKind; n: number }[]; gold: number } {
  const d = MONSTER_DEFS[kind];
  const items: { kind: ItemKind; n: number }[] = [];
  for (const e of d.loot) {
    if (Math.random() < e.chance) {
      const n = rndi(e.n[0], e.n[1]);
      if (n > 0) items.push({ kind: e.kind, n });
    }
  }
  const gold = rndi(d.gold[0], d.gold[1]);
  return { items, gold };
}

/** A target the monster AI can chase and hit. */
export interface AttackTarget {
  x: number;
  y: number;
  /** Logical tile the target CLAIMS (may differ from x,y mid-glide). When
   *  given, occupancy and ring checks use it — the claimed square stays
   *  blocked for the whole step, exactly like every other creature's. */
  tx?: number;
  ty?: number;
  dead: boolean;
}

/**
 * Advance every monster in `w` on the tile grid. When a monster lands a hit it
 * calls `onHit(monster, ranged)` so the caller (combat system) applies damage
 * to the player — `ranged` picks between the melee and the ranged damage roll.
 *
 * Movement is fully Tibia-style: a creature logically stands on ONE tile,
 * glides toward its centre, and only from the centre may claim an adjacent
 * tile (8 directions). The player's tile and every other creature's tile are
 * hard-blocked, so at most 8 bodies can ring the player and a free square is
 * always a genuine escape route.
 */
export function updateMonsters(
  w: World,
  dt: number,
  target: AttackTarget,
  onHit: (m: Monster, ranged: boolean) => void,
): void {
  const ptx = target.tx ?? toTile(target.x);
  const pty = target.ty ?? toTile(target.y);
  // Portal tiles are off-limits to creatures (Etap 13). A monster parked on a
  // ladder/cave mouth while it trades blows with you physically blocks the
  // only way out of the floor, which reads as the game cheating. Treating the
  // pad as permanently "occupied" means the whole existing steering stack —
  // chase, arc-around, retreat, wander — routes around it for free, and the
  // creature still happily stands on any adjacent tile to keep fighting.
  const portalTiles = new Set(w.portals.map((pt) => toTile(pt.y) * w.w + toTile(pt.x)));
  const onPortal = (tx: number, ty: number): boolean => portalTiles.has(ty * w.w + tx);

  /** A step that also records which way the creature ended up facing. */
  const step = (m: Monster, sx: number, sy: number, occ: Occupied): boolean => {
    if (!tryStep(w, m, sx, sy, occ)) return false;
    m.dir = stepFacing(m.kind, sx, sy, m.dir);
    return true;
  };

  const occOf = (self: Monster): Occupied => (tx, ty) =>
    (tx === ptx && ty === pty) || onPortal(tx, ty) || inHaven(w, tx, ty) ||
    w.monsters.some((o) => o !== self && o.tx === tx && o.ty === ty);

  /**
   * One chase step toward (gx,gy), Tibia-style. First choice: any free square
   * that REDUCES the Chebyshev distance (fastest octile route as tiebreak).
   * When every closer square is claimed, walk the ARC — a free square at the
   * SAME Chebyshev distance, rotating in the creature's own preferred
   * direction (`orbit`). Half the pack circles left, half right, so they flow
   * around each other and surround the target instead of queueing single-file.
   * In a walled corridor the arc is solid rock and they correctly queue.
   */
  const chaseStep = (m: Monster, occ: Occupied, gx: number, gy: number): boolean => {
    const curC = chebTiles(m.tx, m.ty, gx, gy);
    let best: readonly [number, number] | null = null;
    let bestO = Infinity;
    let arc: readonly [number, number] | null = null;
    for (const [sx, sy] of STEPS8) {
      const nx = m.tx + sx;
      const ny = m.ty + sy;
      if (!walkable(w, nx, ny) || occ(nx, ny)) continue;
      const c = chebTiles(nx, ny, gx, gy);
      const o = octile(nx, ny, gx, gy);
      if (c < curC) {
        if (o < bestO) { bestO = o; best = [sx, sy]; }
      } else if (c === curC && !arc) {
        // rotation side split by `orbit` keeps the arc walk consistent
        const cross = sx * (gy - m.ty) - sy * (gx - m.tx);
        if (Math.sign(cross) === m.orbit) arc = [sx, sy];
      }
    }
    const pick = best ?? arc;
    if (!pick) return false;
    return step(m, pick[0], pick[1], occ);
  };

  /** One retreat step: the free square that maximises walking distance from
   *  the player. With the path of retreat blocked the shooter holds ground. */
  const retreatStep = (m: Monster, occ: Occupied): boolean => {
    const cur = octile(m.tx, m.ty, ptx, pty);
    let best: readonly [number, number] | null = null;
    let bestO = cur;
    for (const [sx, sy] of STEPS8) {
      const nx = m.tx + sx;
      const ny = m.ty + sy;
      if (!walkable(w, nx, ny) || occ(nx, ny)) continue;
      const o = octile(nx, ny, ptx, pty);
      if (o > bestO) { bestO = o; best = [sx, sy]; }
    }
    if (!best) return false;
    return step(m, best[0], best[1], occ);
  };

  for (const m of w.monsters) {
    m.hurtT = Math.max(0, m.hurtT - dt);
    m.aggroT = Math.max(0, m.aggroT - dt);
    m.atkCd -= dt;
    if (m.spellCd) for (let i = 0; i < m.spellCd.length; i++) m.spellCd[i] -= dt;
    const occ = occOf(m);
    // A creature winding up a spell is rooted. That is not a limitation, it
    // is the tell: the moment it plants its feet is the moment you know a
    // footprint is coming, and a caster that kept walking would make the
    // warning on the ground the only cue in a fight full of moving bodies.
    if (isCasting(m)) continue;
    // Evict anything already standing on a portal — from an older save, or
    // shoved there before this rule existed. `occ` only stops a creature
    // ENTERING a pad, so without this a squatter would never leave. Step it
    // onto the nearest free neighbour; it keeps fighting from right beside
    // the pad, the exit is simply usable again.
    if (onPortal(m.tx, m.ty)) {
      for (const [sx, sy] of STEPS8) {
        if (step(m, sx, sy, occ)) break;
      }
    }
    const d = dist(m.x, m.y, target.x, target.y);
    const cheb = chebTiles(m.tx, m.ty, ptx, pty);
    // Six tiles to notice you, eight to lose you. The wider figure applies
    // only to a creature already committed, so the two thresholds are never
    // the same line and a player walking the edge of the radius no longer
    // makes the floor flicker in and out of pursuit.
    const sight = m.engaged ? MONSTER_AGGRO_HOLD_RANGE : MONSTER_AGGRO_RANGE;
    const provoked = d < sight || m.aggroT > 0;
    m.engaged = provoked;
    const rd = MONSTER_DEFS[m.kind].ranged;

    // ---- the big attacks, ahead of everything else ----
    // This block MUST stay above the melee branch below it, which ends in an
    // unconditional `continue`: with the order reversed a creature standing
    // next to you never reaches this code at all, and the dragon answers a
    // player in its face with nothing but paw swings while every spell it
    // owns sits ready. Being hugged is exactly when the ring-shaped one is
    // supposed to go off. Nothing is spent unless the footprint lands.
    const spells = MONSTER_DEFS[m.kind].spells;
    if (spells && !target.dead && provoked
      && lineOfSight(w, m.x, m.y, target.x, target.y)) {
      if (!m.spellCd) m.spellCd = spells.map(() => 0);
      for (let i = 0; i < spells.length; i++) {
        const sp = spells[i];
        if (m.spellCd[i] > 0) continue;
        if (sp.range > 0 && d > sp.range) continue;
        if (!beginCast(w, m, sp, ptx, pty)) continue;
        m.spellCd[i] = sp.cooldownS;
        // The jab shares the cast: a creature does not breathe fire AND stab
        // you in the same beat, and without this the windup would be free.
        m.atkCd = Math.max(m.atkCd, sp.windupS + 0.3);
        break;
      }
      if (isCasting(m)) continue;
    }
    // ---- attacks (cadence-gated, independent of the glide phase) ----
    if (!target.dead && provoked && cheb <= 1) {
      // adjacent: the ordinary melee exchange — shooters stab with their
      // (weaker) melee roll when cornered, exactly the old behaviour
      if (m.atkCd <= 0) {
        m.atkCd = m.atkRate;
        onHit(m, false);
      }
      // an adjacent creature holds its square (no movement) — but still
      // finish any glide already in flight so it settles on its centre
      glideWalker(m, m.speed * dt);
      continue;
    }
    if (rd && !target.dead && provoked && cheb > 1 && d <= rd.range
      && lineOfSight(w, m.x, m.y, target.x, target.y)) {
      if (m.atkCd <= 0) {
        m.atkCd = m.atkRate;
        // cosmetic projectile, instant hit — same contract as the player's bow
        if (rd.fx) {
          // A magic jab flies as a real bolt and blooms where it lands. The
          // bloom is timed off the bolt's own flight so the two never separate.
          const tt = addBolt(w, m.x, m.y - 16, target.x, target.y - 12, rd.fx.el, rd.fx.tier);
          addBlast(w, ptx, pty, rd.fx.el, rd.fx.tier, "hit", tt);
        } else {
          w.shots.push({
            fromX: m.x, fromY: m.y - 16,
            toX: target.x, toY: target.y - 12,
            p: 0, dur: Math.max(0.06, d / SHOT_SPEED),
            bone: false, color: rd.color ?? "#cfd8da", wide: rd.wide,
          });
        }
        onHit(m, true);
      }
      if (!rd.brute) {
        // distance fighter (Tibia-style): hold ground in range; back away
        // tile by tile when the player closes in. With the retreat blocked
        // (walls, pack mates) it simply stands and keeps firing.
        const keepTiles = Math.max(2, Math.round(Math.min(rd.range * 0.5, 128) / TILE));
        let budget = m.speed * dt;
        for (;;) {
          budget = glideWalker(m, budget);
          if (budget <= 0) break;
          if (chebTiles(m.tx, m.ty, ptx, pty) >= keepTiles) break;
          if (!retreatStep(m, occ)) break;
          m.bob += 0.4;
        }
        continue;
      }
      // a brute shooter (the dragon) does NOT kite — fall through to chase
    }

    /* ---- tile-grid chase, and what happens when the player steps behind a
     * rock.
     *
     * Sight decides WHERE to walk, not WHETHER to. With the player in view the
     * creature walks at the player and remembers the square; with the view
     * broken but the aggro clock still running it walks at the square it last
     * saw them on. That is the whole of it, and it is what `aggroT` was
     * written for — before this, the clock ran while the only line of code
     * that could act on it sat behind the sight test, so a corner ended every
     * pursuit and a provoked creature wandered off mid-fight.
     *
     * The memory is dropped on arrival, so a creature that walks to an empty
     * square goes back to idling rather than standing on it. */
    const canSee = !target.dead && provoked
      && lineOfSight(w, m.x, m.y, target.x, target.y);
    if (canSee) m.seen = { tx: ptx, ty: pty };
    else if (!provoked) m.seen = undefined;

    const goal = canSee ? { tx: ptx, ty: pty } : (provoked ? m.seen : undefined);
    if (goal && cheb > 1) {
      const chasingSeen = !canSee;
      if (chasingSeen && m.tx === goal.tx && m.ty === goal.ty) {
        // arrived where they were last seen, and they are not here
        m.seen = undefined;
      } else {
        let budget = m.speed * dt;
        for (;;) {
          budget = glideWalker(m, budget);
          if (budget <= 0) break;
          if (chasingSeen) {
            if (m.tx === goal.tx && m.ty === goal.ty) { m.seen = undefined; break; }
          } else if (chebTiles(m.tx, m.ty, goal.tx, goal.ty) <= 1) {
            break; // arrived at the ring
          }
          if (!chaseStep(m, occ, goal.tx, goal.ty)) break;
        }
        m.bob += dt * 9;
        continue;
      }
    }

    // ---- idle: wander / home leash ----
    let budget = m.speed * 0.5 * dt;
    budget = glideWalker(m, budget);
    if (budget > 0) {
      const leashed = m.hr && m.hx !== undefined && m.hy !== undefined
        && dist(m.x, m.y, m.hx, m.hy) > m.hr;
      if (leashed && m.hx !== undefined && m.hy !== undefined) {
        // drifted beyond its camp: turn back toward home, square by square
        const hx = toTile(m.hx);
        const hy = toTile(m.hy);
        if (chaseStep(m, occ, hx, hy)) m.bob += dt * 6;
      } else {
        m.wanderT -= dt;
        if (m.wanderT <= 0) {
          m.wanderT = rnd(1, 3);
          if (Math.random() >= 0.4) {
            const [sx, sy] = STEPS8[rndi(0, 7)];
            if (step(m, sx, sy, occ)) m.bob += dt * 6;
          }
        }
      }
    } else {
      m.bob += dt * 6; // still gliding a wander step
    }
  }
}
