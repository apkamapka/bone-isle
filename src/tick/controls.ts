/**
 * What the game's tick needs from whoever is playing (Etap 3.1d).
 *
 * The tick is the game moving on by one frame — the creatures, the hazards,
 * the clocks, the walk and the blows — and it runs without a screen. Four
 * things in it belong to the person at the controls, so it asks for them
 * instead of reaching into the keyboard or the windows:
 *
 *   - which way they are steering, when they are;
 *   - whether a box is up on their screen, because a player who is reading
 *     neither walks nor is carried off by a pad mid-sentence;
 *   - what to do on reaching something that is USED rather than fought — a
 *     body, a stack on the floor, a townsperson, a building — because what
 *     happens then is a window, a conversation or a pickup, and opening
 *     windows is the client's;
 *   - a box to show them: a chronicle read on a pad, or the sage's word when
 *     a rune circle answers.
 *
 * In the browser today main.ts answers all four. On the server the answers
 * will come from the player's last message and go back out as messages.
 */
import type { Target } from "../entities/player.ts";

/** A box to open for the player. */
export type TickNotice =
  /** A chronicle or a descent speech: a titled page from speech.ts. */
  | { kind: "lore"; titleKey: string; bodyKey: string }
  /** Chronos speaking, in his box with his portrait. */
  | { kind: "sage"; key: string };

export interface TickControls {
  /** Which way the keys or the stick point: each of dx, dy in -1..1. Asked
   *  only while no box is up. */
  axis(): { dx: number; dy: number };
  /** Is a box up on this player's screen? While it is, the feet stop and a
   *  pad under them waits until it is closed. */
  reading(): boolean;
  /** The player has walked up to `t`, which is used rather than fought. The
   *  tick lets go of the mark right after. */
  arrive(t: Target): void;
  /** Open a box for this player. */
  notice(n: TickNotice): void;
}

/** What one tick did that the client has to follow. */
export interface TickReport {
  /** The player was face down: the world held still around them and only
   *  the clocks, the burning ground and the spells in flight moved on. */
  dead: boolean;
  /** The player stepped by hand this tick, which cancels any errand the
   *  client was walking them to. */
  steered: boolean;
}
