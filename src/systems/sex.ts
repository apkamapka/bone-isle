/**
 * The character's sex.
 *
 * Picked once, when the character is created on the website (the `sex` column
 * of `characters`, etap 1.7), and never changed afterwards. The game learns it
 * from the character entered on the way in (systems/character.ts, etap 1.9).
 * Two things read it:
 *
 *   gfx/heroSheet.ts   which body the hero is drawn with
 *   text/speech.ts     the Time Sage's grammar: Polish puts the player's sex
 *                      into every past tense said to them ("Wróciłeś" /
 *                      "Wróciłaś"), Spanish and Portuguese into a few
 *                      adjectives ("solo" / "sola"), English into nothing
 *
 * It is NOT progress, so it is neither in PlayerState nor in the save: a new
 * game, `/forget` or a save carried over from another browser must not be able
 * to change it, and the account's character row is the one place it is true.
 * Like the name in character.ts it is module state: both come from the account
 * and stay the same for the whole visit.
 */

export type Sex = "male" | "female";

/** Exactly the two values the website stores. */
export function isSex(v: unknown): v is Sex {
  return v === "male" || v === "female";
}

let current: Sex = "male";

/** The sex of the character being played. Male where nobody logged in. */
export function playerSex(): Sex {
  return current;
}

export function setPlayerSex(s: Sex): void {
  current = s;
}
