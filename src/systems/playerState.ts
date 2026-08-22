/**
 * Everything a CHARACTER owns that is not their body.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Until now each of these lived as module state: `let current: Stance` in
 * stance.ts, `const skills = {...}` in skills.ts, `const rt` in tasks.ts, and
 * so on. That is correct and cheap for a game with exactly one character in
 * the process — and it is the single thing that makes a server impossible,
 * because a server process holds hundreds of characters at once and every one
 * of them would be reading the same `let`.
 *
 * So the state moves HERE, into one object per character, and the feature
 * modules keep their public API unchanged — `stance()`, `skills`, `taskState()`
 * all still exist and still mean the same thing. They simply read out of
 * `active()` instead of out of a `let` above them. Call sites did not change;
 * `main.ts` does not know this happened. That is the whole design: one seam,
 * added while there is still only one character to break.
 *
 * When the server arrives, serving a request becomes:
 *
 *     setActive(session.state);
 *     …run the existing game code verbatim…
 *
 * and every module follows without further edits.
 *
 * WHAT DOES *NOT* BELONG HERE
 * ---------------------------
 * Anything about the character's body (position, hp, backpack, equipment)
 * lives on `Player` and always did. Anything about the WORLD (monsters,
 * corpses, ground items) belongs to `World` and is shared between characters.
 * This object is the third thing: progress, choices and clocks.
 *
 * UI PREFERENCES ARE NOT HERE EITHER. `panelPrefs` and `hudLayout` are
 * per-DEVICE, not per-character — the same character on a phone and a desktop
 * wants different window sizes — so they stay where they are, in localStorage,
 * and never travel to a server.
 */
import type { Skill, SkillKey } from "./skills.ts";
import type { Stance } from "./stance.ts";
import type { Quest } from "./quests.ts";
import type { TaskSave } from "./tasks.ts";
import type { OutfitSave } from "./outfit.ts";
import type { Element } from "./elements.ts";
import type { PvpState } from "./pvp.ts";

/**
 * The three combat toggles. Tibia 8.6 has exactly these, as three independent
 * switches rather than one mode: how hard you swing, whether you follow, and
 * whether you may hit a player at all.
 */
export interface CombatModes {
  stance: Stance;
  /**
   * Chase opponent (true) vs stand while fighting (false).
   *
   * Defaults to TRUE, which is what the game did before this switch existed —
   * a marked creature was always walked up to. Turning it off makes the
   * character swing only at whatever is already in reach and never take a
   * step on its own, which is how you hold a choke point or shoot without
   * drifting into the pack.
   */
  chase: boolean;
  /**
   * Secure mode: never resolve an attack against another PLAYER.
   *
   * Enforced by `mayAttackPlayer()` below and by `mayHit()` in pvp.ts, which
   * currently have nothing to refuse — there are no other players yet.
   *
   * DEFAULTS TO TRUE, and that is a correction. It shipped defaulting to
   * false, which was written as "secure mode off" and read as the harmless
   * side of a flag nobody could see. It is not: false is the side on which
   * you hurt people. The flag had no UI at all until the skull button
   * arrived, so every character alive today is carrying a default rather than
   * a decision — which is exactly the accidental first frag the original note
   * was worried about, sitting in the code the whole time.
   *
   * The skull button reads this inverted (`pvpArmed()` in pvp.ts) because
   * "do I mean to fight people?" is the question a player actually asks. A
   * fresh character answers no.
   */
  safeMode: boolean;
}

/** One character's progress, choices and clocks. */
export interface PlayerState {
  skills: Record<SkillKey, Skill>;
  modes: CombatModes;
  quests: Quest[];
  tasks: TaskSave;
  outfit: OutfitSave;
  /**
   * Standing among other players: which skull is worn, how long it has left,
   * and how many people this character has killed. See systems/pvp.ts for why
   * it is here before there is anybody to kill.
   */
  pvp: PvpState;
  /** Completed Alchemy Tower research project ids. */
  research: Set<string>;
  /** Elemental lanes this character has paid to open. */
  attuned: Set<Element>;
  /** Seconds left on the shared crystal cooldown. */
  crystalCd: number;
  /**
   * Timestamps (seconds) of the hits the shield has engaged recently — the
   * rolling window behind Tibia's "a shield blocks two creatures" rule.
   */
  shieldBlockTimes: number[];
  /** When this character last DEALT damage; gates Shielding advancement. */
  lastBloodHitAt: number;
}

/** A pristine skill table. Cloned per character rather than shared. */
function defaultSkills(): Record<SkillKey, Skill> {
  return {
    sword: { name: "Sword Fighting", lv: 10, pts: 0, color: "#e1483b", active: true, offset: 10, factor: 1.1, base: 50 },
    shield: { name: "Shielding", lv: 10, pts: 0, color: "#5aa1e8", active: true, offset: 10, factor: 1.1, base: 100 },
    dist: { name: "Distance Fighting", lv: 10, pts: 0, color: "#6fc06a", active: true, offset: 10, factor: 1.1, base: 50 },
  };
}

/**
 * The quest chain, fresh. Defined here rather than imported from quests.ts so
 * that this module has no VALUE import from any feature module — every import
 * above is `import type`, which erases at compile time. That keeps the module
 * graph acyclic even though quests.ts imports `active()` from here.
 */
function defaultQuests(): Quest[] {
  return [
    {
      id: "q1", title: "Pest Control",
      desc: "The road to the Wildlands crawls with snakes. Cull 5 of them.",
      goal: { kind: "kill", monster: "snake", need: 5 },
      reward: { gold: 20, exp: 30 },
      progress: 0, done: false, claimed: false,
    },
    {
      id: "q2", title: "Rattle the Bones",
      desc: "Skeletons haunt the ruins. Bring peace to 6 of them.",
      goal: { kind: "kill", monster: "skeleton", need: 6 },
      reward: { item: "shortSword", itemN: 1, exp: 50 },
      progress: 0, done: false, claimed: false,
    },
    {
      id: "q3", title: "Stock the Forge",
      desc: "The smith needs raw stone. Gather 20 stone.",
      goal: { kind: "collect", item: "stone", need: 20 },
      reward: { gold: 30, exp: 40 },
      progress: 0, done: false, claimed: false,
    },
    {
      id: "q4", title: "A Roof of Your Own",
      desc: "Build a Forge on your Home Isle to craft real gear.",
      goal: { kind: "build", struct: "forge" },
      reward: { item: "hpPotion", itemN: 3, exp: 60 },
      progress: 0, done: false, claimed: false,
    },
    {
      id: "q5", title: "Horns of the Deep",
      desc: "Minotaurs hold the deep caverns. Slay 3 to prove your strength.",
      goal: { kind: "kill", monster: "minotaur", need: 3 },
      reward: { item: "amulet", itemN: 1, gold: 100, exp: 200 },
      progress: 0, done: false, claimed: false,
    },
  ];
}

/** The wardrobe a brand-new character starts in. */
function defaultOutfit(): OutfitSave {
  return {
    pal: 133,
    hair: 0, primary: 0, secondary: 0, shoes: 0,
    current: "adventurer", owned: ["adventurer"],
  };
}

/**
 * A clean sheet: no skull, no frags.
 *
 * Defined here rather than in pvp.ts for the same reason `defaultQuests` is —
 * pvp.ts reads `active()` out of this module, so the default has to live on
 * this side of the arrow or the two files import each other.
 */
function defaultPvp(): PvpState {
  return { skull: "none", t: 0, frags: 0 };
}

/** A brand-new character: nothing trained, nothing done, nothing on cooldown. */
export function newPlayerState(): PlayerState {
  return {
    skills: defaultSkills(),
    modes: { stance: "balanced", chase: true, safeMode: true },
    quests: defaultQuests(),
    tasks: { activeId: null, kills: 0, earned: 0 },
    outfit: defaultOutfit(),
    pvp: defaultPvp(),
    research: new Set<string>(),
    attuned: new Set<Element>(),
    crystalCd: 0,
    shieldBlockTimes: [],
    lastBloodHitAt: -Infinity,
  };
}

/**
 * Lazily created, so that module evaluation order cannot matter. quests.ts
 * imports `active()` from here and this module imports nothing but types from
 * quests.ts — but even if a value import crept in one day, nothing runs until
 * the first `active()` call, which is long after every module has loaded.
 */
let current: PlayerState | null = null;

/** The character this process is currently acting for. */
export function active(): PlayerState {
  return (current ??= newPlayerState());
}

/**
 * Point every feature module at a different character.
 *
 * The whole reason this file exists. On the server this is called once per
 * inbound command, before any game code runs. In the browser it is called
 * exactly twice: on new game and on load.
 */
export function setActive(s: PlayerState): void {
  current = s;
}

/** Start over with a pristine character (new game / test isolation). */
export function resetPlayerState(): PlayerState {
  current = newPlayerState();
  return current;
}

/* ---------------- combat modes ---------------- */

export function modes(): CombatModes {
  return active().modes;
}

/** Chase opponent, or stand and swing at whatever is already in reach? */
export function chasing(): boolean {
  return active().modes.chase;
}

export function setChase(on: boolean): void {
  active().modes.chase = on;
}

/** Flip chase and return the new setting — what the button calls. */
export function toggleChase(): boolean {
  const m = active().modes;
  m.chase = !m.chase;
  return m.chase;
}

export function safeMode(): boolean {
  return active().modes.safeMode;
}

export function setSafeMode(on: boolean): void {
  active().modes.safeMode = on;
}

/**
 * May this character resolve an attack against another PLAYER right now?
 *
 * The one place secure mode is enforced, so that when PvP lands there is a
 * single line to extend with the level threshold and the protection-zone
 * check rather than a rule scattered through every attack path. Monsters are
 * not routed through here — secure mode has never gated them.
 */
export function mayAttackPlayer(): boolean {
  return !active().modes.safeMode;
}
