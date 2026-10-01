/**
 * The character's sex.
 *
 * Picked once, when the character is created on the website (the `sex` column
 * of `characters`, etap 1.7), and never changed afterwards. Two things read it:
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
 * It sits here as module state for the same reason the name over the head does
 * (TEMP-ETAP70-NAME in main.ts): both come from the account, and both move to
 * the session together when the server starts handing characters out.
 */

export type Sex = "male" | "female";

/** Exactly the two values the website stores. */
export function isSex(v: unknown): v is Sex {
  return v === "male" || v === "female";
}

let current: Sex = "male";

/** The sex of the character being played. Male until told otherwise, which is
 *  what every character created before etap 1.8 was. */
export function playerSex(): Sex {
  return current;
}

export function setPlayerSex(s: Sex): void {
  current = s;
}

/**
 * TEMP-ETAP78-SEX — `/play?sex=female`, until etap 1.9.
 *
 * The game does not know yet which character is being played; telling it is
 * what etap 1.9 is for. Until then this is the only way to reach the second
 * body. Anything but exactly `female` means male, so a mistyped link still
 * shows the character everyone has had so far.
 *
 * Grep TEMP-ETAP78-SEX to pull the whole thing: this function, its call in
 * main.ts and its checks in smoke/run.ts.
 */
export function sexFromQuery(search: string): Sex {
  return new URLSearchParams(search).get("sex") === "female" ? "female" : "male";
}
