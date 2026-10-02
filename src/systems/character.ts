/**
 * The character being played (etap 1.9).
 *
 * Picked from the list on the way into /play (boot.ts) before anything of the
 * world loads, and the same for the whole visit. Its name goes over the head
 * and into the chat; its sex decides the body and the Time Sage's grammar
 * (systems/sex.ts).
 *
 * main.ts and chat.ts read the name once, when they load, which is after the
 * pick. Where nobody picked (`npm run dev`, the smoke suite) there is no
 * character and the old stand-ins stay: "Player" over the head, "You" in the
 * chat, and the male body.
 */
import { setPlayerSex, type Sex } from "./sex.ts";

let name: string | null = null;
let id: string | null = null;

/** Enter as this character: its name and its sex, together. */
export function enterAs(c: { readonly id: string; readonly name: string; readonly sex: Sex }): void {
  id = c.id;
  name = c.name;
  setPlayerSex(c.sex);
}

/** The played character's name, or null where nobody logged in. */
export function characterName(): string | null {
  return name;
}

/** Its id in the database, or null where nobody logged in. */
export function characterId(): string | null {
  return id;
}
