/**
 * The way into the world (etap 1.9).
 *
 * The game at /play/ is played by a character of an account, so before any of
 * the world loads, this:
 *   1. finds the login the website left in this browser; with none, the Log
 *      in page, which sends the player straight back here;
 *   2. asks the database for the account's characters;
 *   3. lists them, the way the Tibia client does right after logging in;
 *   4. enters as the one picked: its name over the head and in the chat, its
 *      body and the Time Sage's grammar (systems/character.ts).
 * Only then is main.ts imported, so nothing of the world runs (no monster
 * moves, no Time Sage speaks) before the player is someone.
 *
 * `npm run dev` serves the game alone, with no website beside it and so no
 * login: there the list is skipped and the world starts as it always has.
 */
import "./style.css";
import {
  LAST_CHARACTER_KEY, LOGIN_URL, fetchCharacters, freshSession, preselect, refresh, type CharacterRow,
} from "./net/account.ts";
import { enterAs } from "./systems/character.ts";
import { mountCharList, type CharList } from "./ui/charList.ts";

/** Off to the Log in page; `replace`, so Back does not return to an empty /play/. */
function toLogin(): null {
  location.replace(LOGIN_URL);
  return null;
}

function lastEntered(): string | null {
  try {
    return localStorage.getItem(LAST_CHARACTER_KEY);
  } catch {
    return null;
  }
}

function rememberEntered(id: string): void {
  try {
    localStorage.setItem(LAST_CHARACTER_KEY, id);
  } catch {
    /* storage blocked: the first character is selected next time */
  }
}

/** Until a character is entered; null when the player was sent to log in. */
async function pickCharacter(ui: CharList): Promise<CharacterRow | null> {
  for (;;) {
    ui.loading("Loading characters…");
    try {
      let s = await freshSession();
      if (!s) return toLogin();
      let rows = await fetchCharacters(s);
      if (rows === "login") {
        // Refused although it looked fresh (revoked, logged out elsewhere): one refresh, then log in again.
        s = await refresh(s);
        rows = s ? await fetchCharacters(s) : "login";
        if (rows === "login") return toLogin();
      }
      if (rows.length === 0) {
        ui.empty();
        return await new Promise<never>(() => {}); // only the way out to the account page ends this
      }
      const picked = await ui.list(rows, preselect(rows, lastEntered()));
      rememberEntered(picked.id);
      return picked;
    } catch {
      await ui.error("The server could not be reached.");
    }
  }
}

async function boot(): Promise<void> {
  let ui: CharList | null = null;
  if (!import.meta.env.DEV) {
    ui = mountCharList();
    const picked = await pickCharacter(ui);
    if (!picked) return;
    enterAs(picked);
    ui.loading("Entering the world…");
  }
  try {
    await import("./main.ts");
  } catch (err) {
    if (!ui) throw err;
    await ui.error("The game could not be loaded.");
    location.reload();
    return;
  }
  ui?.close();
}

void boot();
