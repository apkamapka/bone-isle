/**
 * What the game wants SEEN and HEARD, said as data (Etap 3.1a).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Until now a sword hit played its own sound, painted its own number and
 * spilled its own blood: combat.ts reached straight into audio.ts, fx.ts and
 * gfx/blood.ts, and crystals.ts into the spell artwork. That works for one
 * process with one screen. A server has no screen and no speakers — and it
 * has to tell EVERY player standing near the hit, not just the one who swung.
 *
 * So the logic now says what happened and returns. Exactly one listener is
 * installed today, `fxClient.ts`, and it does what the logic used to do
 * inline, synchronously and in the same order: nothing on screen changed.
 * On the server the listener will collect a tick's events instead and send
 * each one to the players it concerns. The logic will not have to change.
 *
 * WHO AN EVENT IS FOR
 * -------------------
 * Written down now because this is the one moment every call site is being
 * touched; nothing reads it yet.
 *
 *   - An event with a PLACE (a world and a spot in it) is a fact about that
 *     place, for whoever can see it: a damage number, blood, a spell, the
 *     sound of a hit.
 *   - A float marked `self`, a sound with no `at`, a buzz and a log line are
 *     for the character the code is acting for: a refusal ("too far"), a
 *     skill advance, a reward, the phone shaking, a line in the Server Log.
 *
 * WHAT DOES NOT BELONG HERE
 * -------------------------
 * State. A burning tile hurts whoever stands on it, so it is world state and
 * lives in fields.ts; this file is only for things that happen once and are
 * then the client's to animate and forget.
 *
 * The names of every sound, aura and spell picture are defined HERE rather
 * than in the modules that play and draw them, so that the logic can name a
 * sound without loading the code that synthesises it.
 */
import type { Element, Tier } from "./elements.ts";
import type { MonsterKind, Shot, World } from "../world/types.ts";

/* ---- the vocabulary -------------------------------------------------- */

/** Every sound the game can ask for. The waveforms are in sound/synth.ts. */
export type SfxId =
  | "hit" | "whiff" | "bow" | "knock" | "hurt" | "block" | "death" | "kill"
  | "levelup" | "skillup" | "chop" | "mine" | "heal" | "buff" | "mire" | "fury"
  | "cast" | "rune" | "portal" | "eat" | "coins" | "reward" | "splash"
  | "build" | "forge" | "chime" | "mobheal";

/** Which aura art a flare uses. Matches `public/fx-aura-<name>.png`. */
export type AuraName = "guard" | "fury" | "mend" | "speed" | "slow" | "recall";

/** The pictures a spell can ask for. The artwork is in gfx/spellArt.ts. */
export type FxSlot = "bolt" | "burst" | "wave" | "nova" | "hit" | "rune" | "field";

/** What a body leaves on the ground. */
export type BloodKind = "red" | "green" | "bone";

const GREEN: ReadonlySet<MonsterKind> = new Set<MonsterKind>(["snake"]);
const BONE: ReadonlySet<MonsterKind> = new Set<MonsterKind>([
  "skeleton", "skeletonWarrior", "demonSkeleton", "ghoul", "draugr",
]);

/**
 * Who bleeds what. Red covers everything with a heart in it, the player
 * included; snakes bleed green; the dead leave grey bone dust. Here and not in
 * gfx/blood.ts because the logic decides it when it reports the hit.
 */
export function bloodOf(kind: MonsterKind): BloodKind {
  if (GREEN.has(kind)) return "green";
  if (BONE.has(kind)) return "bone";
  return "red";
}

/** How fast a spell's bolt crosses the map, px/s. Matches the arrow, so a
 *  fireball and an arrow fired at the same creature arrive together. */
export const BOLT_SPEED = 1040;

/**
 * How long a bolt is in the air. The logic times the bloom that follows a
 * bolt with this, and the client draws the flight with the same number, so
 * an explosion never beats its own fireball to the ground. A zero-length bolt
 * still gets a few frames on screen.
 */
export function boltFlight(fromX: number, fromY: number, toX: number, toY: number): number {
  return Math.max(0.06, Math.hypot(toX - fromX, toY - fromY) / BOLT_SPEED);
}

/** A spot in a world, in world pixels. */
export interface Spot {
  world: World;
  x: number;
  y: number;
}

export type FxEvent =
  /** A sound. With `at`, anyone who can see that spot hears it; without, only
   *  the acting character does. */
  | { fx: "sound"; id: SfxId; at?: Spot }
  /** Shake the acting character's phone. */
  | { fx: "buzz"; pattern: number | number[] }
  /** Words drifting up from a spot. `self`: for the acting character only. */
  | { fx: "float"; world: World; x: number; y: number; text: string; color: string; self: boolean }
  /** A line in the acting character's Server Log. */
  | { fx: "log"; text: string; color?: string }
  /** A creature or townsperson says something over its head. `who` is its id. */
  | { fx: "speech"; world: World; x: number; y: number; who: number; text: string; color: string }
  /** A splash under a hit, or a pool under a body. */
  | { fx: "blood"; world: World; x: number; y: number; blood: BloodKind; pool: boolean }
  /** An arrow or a creature's missile in flight. Cosmetic: the hit already landed. */
  | { fx: "shot"; world: World; shot: Shot }
  /** One pass of an aura flare centred on a spot. */
  | { fx: "flare"; world: World; x: number; y: number; name: AuraName; scale: number }
  /** A spell's bloom on one TILE, `delay` seconds from now. */
  | { fx: "blast"; world: World; tx: number; ty: number; el: Element; tier: Tier; slot: FxSlot; delay: number }
  /** A spell's projectile between two points. Cosmetic, like a shot. */
  | { fx: "bolt"; world: World; fromX: number; fromY: number; toX: number; toY: number; el: Element; tier: Tier };

/* ---- the plumbing ---------------------------------------------------- */

export type FxSink = (ev: FxEvent) => void;

const sinks: FxSink[] = [];

/**
 * Listen to every event from now on. Returns the function that stops it.
 * Listeners run synchronously, in the order they were added, at the moment
 * the event is emitted — which is what keeps the client's effects in exactly
 * the order the inline calls used to make them.
 */
export function onFx(sink: FxSink): () => void {
  sinks.push(sink);
  return () => {
    const i = sinks.indexOf(sink);
    if (i >= 0) sinks.splice(i, 1);
  };
}

/** Report one event. With nobody listening it simply goes nowhere. */
export function emit(ev: FxEvent): void {
  for (const s of sinks) s(ev);
}

/* ---- the words the logic actually writes ----------------------------- */

export function sound(id: SfxId, at?: Spot): void {
  emit(at ? { fx: "sound", id, at } : { fx: "sound", id });
}

export function buzz(pattern: number | number[]): void {
  emit({ fx: "buzz", pattern });
}

/** A fact about a spot: damage, a heal, a miss, a buff going on. */
export function floatAt(world: World, x: number, y: number, text: string, color: string): void {
  emit({ fx: "float", world, x, y, text, color, self: false });
}

/** Words for the acting character only: a refusal, an advance, a reward. */
export function floatSelf(world: World, x: number, y: number, text: string, color: string): void {
  emit({ fx: "float", world, x, y, text, color, self: true });
}

export function logLine(text: string, color?: string): void {
  emit(color === undefined ? { fx: "log", text } : { fx: "log", text, color });
}

export function speech(world: World, who: number, x: number, y: number, text: string, color: string): void {
  emit({ fx: "speech", world, x, y, who, text, color });
}

export function bleed(world: World, x: number, y: number, blood: BloodKind, pool = false): void {
  emit({ fx: "blood", world, x, y, blood, pool });
}

export function projectile(world: World, shot: Shot): void {
  emit({ fx: "shot", world, shot });
}

export function flare(world: World, x: number, y: number, name: AuraName, scale = 1): void {
  emit({ fx: "flare", world, x, y, name, scale });
}

/** Light a tile. Coordinates are TILE indices, as every caller thinks in tiles. */
export function blast(
  world: World, tx: number, ty: number, el: Element, tier: Tier, slot: FxSlot, delay = 0,
): void {
  emit({ fx: "blast", world, tx, ty, el, tier, slot, delay });
}

/** Throw a bolt. Returns its flight time so the caller can time the bloom after it. */
export function bolt(
  world: World, fromX: number, fromY: number, toX: number, toY: number, el: Element, tier: Tier,
): number {
  emit({ fx: "bolt", world, fromX, fromY, toX, toY, el, tier });
  return boltFlight(fromX, fromY, toX, toY);
}
