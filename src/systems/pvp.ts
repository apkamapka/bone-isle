/**
 * PvP: the two skulls, and the switch that decides whether you mean to fight
 * other people at all.
 *
 * WHY THIS EXISTS BEFORE THERE IS ANYBODY TO FIGHT
 * -----------------------------------------------
 * None of this can be played today — there is one character in the world and
 * he cannot hit himself. It is written now for the same reason the entity ids
 * and PlayerState were: the parts that are expensive to retro-fit are the
 * parts that have to be saved, defaulted and drawn correctly from the FIRST
 * character that ever logs in.
 *
 * A skull is a per-character clock that survives a reload. Adding one later
 * means writing a migration and deciding what skull a character who has been
 * offline for a month should wake up with. Adding it now means every save
 * ever written already has the field, set to "clean", which is the right
 * answer for all of them.
 *
 * WHAT THE TWO SKULLS MEAN (Tibia's rules, kept)
 * ----------------------------------------------
 * WHITE — you hit somebody who had not hit you. It is not a punishment, it is
 * a warning to everyone else: this one started it, and hitting him back costs
 * you nothing. It runs out.
 *
 * RED — you have killed people. It marks you for far longer, and in Tibia it
 * is the difference between a player who lost a fight and a player who goes
 * looking for them.
 *
 * Both hang beside the head rather than over it, because over the head is
 * where speech goes and a bubble must never be what hides a skull.
 *
 * THE SWITCH IS THE OLD `safeMode`, INVERTED
 * ------------------------------------------
 * `PlayerState.modes.safeMode` has been saved since Etap 31 and is already
 * the single gate every future attack on a player will pass through. The
 * button Radek asked for — a white skull you light when you MEAN to fight
 * people — is that same flag read the other way round, so it needs no new
 * field and no save bump: lit skull is `safeMode === false`.
 *
 * Phrasing it as "do I want to?" rather than "am I protected?" is also the
 * safer default. A fresh character starts with the skull UNLIT and therefore
 * cannot land a blow on another player by accident, which is exactly what
 * secure mode meant.
 */
import { active, safeMode, setSafeMode } from "./playerState.ts";

export type Skull = "none" | "white" | "red";

/**
 * How long an unprovoked attacker wears the white skull.
 *
 * Fifteen minutes, which is Tibia's own number. Long enough that the fight it
 * marks is still going on, short enough that it is not a punishment.
 */
export const WHITE_SKULL_S = 15 * 60;

/**
 * …and how long a killer wears the red one.
 *
 * Eight hours of PLAY, not of wall clock: the timer only runs while the
 * character is in the world, so logging out does not launder a frag. Tibia
 * counts this in days across a rolling window of kills; that rule needs a
 * server to be worth anything, and this is the placeholder until there is
 * one. Everything else here is final; this number is not.
 */
export const RED_SKULL_S = 8 * 60 * 60;

/**
 * The level below which nobody may be attacked and nobody may attack.
 *
 * Settled early and repeated here because it is the one PvP rule that must
 * hold on both ends of a blow: a level 9 is neither a target nor a threat.
 */
export const PVP_MIN_LEVEL = 10;

/** One character's standing. Lives on PlayerState; saved with the rest. */
export interface PvpState {
  skull: Skull;
  /** Seconds left on the current skull; 0 when there is none. */
  t: number;
  /** Players killed. Kept past the skull — a frag is a fact, not a timer. */
  frags: number;
}

/* No `newPvpState()` here on purpose. The pristine value lives in
 * playerState.ts beside the other defaults — same reason `defaultQuests` does:
 * this module imports `active()` from there, so a value import back the other
 * way would close the cycle, and two copies of one default is how they drift. */

function st(): PvpState {
  return active().pvp;
}

export function skull(): Skull {
  return st().skull;
}

/** Seconds before the current skull clears. Zero when there is none. */
export function skullLeft(): number {
  return st().t;
}

export function frags(): number {
  return st().frags;
}

/**
 * Is the white-skull button lit — does this character MEAN to fight people?
 *
 * The inverse of secure mode. See the header: one flag, two readings, and the
 * button says the one a player thinks in.
 */
export function pvpArmed(): boolean {
  return !safeMode();
}

export function setPvpArmed(on: boolean): void {
  setSafeMode(!on);
}

/** Flip the switch and report the new setting — what the button calls. */
export function togglePvpArmed(): boolean {
  const now = !pvpArmed();
  setPvpArmed(now);
  return now;
}

/**
 * May this character land a blow on that one, right now?
 *
 * THE one place the question is answered, so that the rules that are still
 * missing — party members, guild wars — are a list to extend here rather than
 * a condition to remember at every call site. Today it knows four: the switch,
 * the level floor on the attacker, the level floor on the victim, and the
 * protection zone.
 *
 * The zone arrives as a bare boolean because this module is rules and has no
 * business importing a World to look a tile up in — the same division the
 * context menu already draws, where the caller works out `mayAttack` and the
 * menu only draws it. Whoever throws the punch knows which square it is thrown
 * on; `isSafeTile` turns that into the answer.
 *
 * Monsters do not come through here and never did. Secure mode has never had
 * anything to say about a rat, and neither has a protection zone — a creature
 * that got into town would be a bug in the haven mask, not a licence.
 */
export function mayHit(
  attackerLevel: number, victimLevel: number, inSafeZone = false,
): boolean {
  if (!pvpArmed()) return false;
  if (inSafeZone) return false;
  if (attackerLevel < PVP_MIN_LEVEL || victimLevel < PVP_MIN_LEVEL) return false;
  return true;
}

/**
 * Take the white skull for starting a fight.
 *
 * Refreshes the clock if it is already white — hitting a second person does
 * not shorten your warning — and is ignored while red, because red already
 * says everything white would.
 */
export function markAggressor(): void {
  const s = st();
  if (s.skull === "red") return;
  s.skull = "white";
  s.t = WHITE_SKULL_S;
}

/** Take the red skull for a kill, and count the frag. */
export function markKiller(): void {
  const s = st();
  s.frags += 1;
  s.skull = "red";
  s.t = RED_SKULL_S;
}

/**
 * Resolve a blow against another player.
 *
 * The seam. When PvP ships, the damage path calls THIS rather than testing
 * the flag itself: it answers whether the blow lands and, if it does, marks
 * the attacker in the same breath — so there is no way to write a hit that
 * connects without earning its skull.
 *
 * `provoked` is the caller's answer to "had the victim already hit me?". An
 * answered attack earns nothing, which is the entire point of the white skull:
 * it names who started it.
 */
export function resolvePlayerHit(
  attackerLevel: number, victimLevel: number, provoked = false,
): boolean {
  if (!mayHit(attackerLevel, victimLevel)) return false;
  if (!provoked) markAggressor();
  return true;
}

/** …and the same seam for the killing blow. */
export function resolvePlayerKill(): void {
  markKiller();
}

/** Run the skull's clock down. Called once per frame with the rest of them. */
export function tickSkull(dt: number): void {
  const s = st();
  if (s.skull === "none") return;
  s.t -= dt;
  if (s.t <= 0) {
    s.skull = "none";
    s.t = 0;
  }
}

/** The icon a skull is drawn with, or null for a clean character. */
export function skullIcon(s: Skull): "skullWhite" | "skullRed" | null {
  if (s === "white") return "skullWhite";
  if (s === "red") return "skullRed";
  return null;
}
