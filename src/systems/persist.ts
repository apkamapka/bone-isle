/**
 * "Write this character down now" (Etap 3.1c).
 *
 * Most of the game is saved by the five-second autosave, and that is enough.
 * A few moments are not allowed to wait for it: a one-time treasure chest
 * just opened, an errand just taken, handed in or reset. Closing the tab in
 * the next breath must not undo them — a chest that reopens after a reload
 * is a mint.
 *
 * Those moments used to call `saveGame` straight from main.ts. The requests
 * that cause them now live in intents/, where a server can run them, and a
 * server saves a character differently from a browser. So a request only says
 * that the character should be written now, and whoever runs the game decides
 * how: today main.ts hands `saveGame` in at boot; on the server (Etap 3.11)
 * it will be the server's own write. With nobody listening — in a test — the
 * call simply goes nowhere.
 */
import type { Game } from "../game.ts";

type Saver = (g: Game) => void;

let saver: Saver | null = null;

/** Decide how "save now" is done. Returns the function that undoes it. */
export function onSaveNow(fn: Saver): () => void {
  saver = fn;
  return () => {
    if (saver === fn) saver = null;
  };
}

/** Write this game's character down now, however this process writes. */
export function saveNow(g: Game): void {
  saver?.(g);
}
