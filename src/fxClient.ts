/**
 * The client half of systems/fxEvents.ts (Etap 3.1a): every event the logic
 * reports becomes the sound, number, stain or flame it names.
 *
 * Each case below is the exact call the logic used to make inline, with the
 * same arguments, so installing this listener puts on screen precisely what
 * was there before the split. main.ts installs it at boot; the smoke suite
 * installs it too, because half of what it checks is what reaches the screen.
 *
 * Today it plays every event it hears. Once a server is in between, this is
 * where the client will receive the server's events instead of the local
 * logic's — the cases themselves stay as they are.
 */
import { onFx, type FxEvent } from "./systems/fxEvents.ts";
import { sfx, buzz, beep } from "./audio.ts";
import { addFloat } from "./fx.ts";
import { splash, pool } from "./gfx/blood.ts";
import { addFlare } from "./gfx/auraFx.ts";
import { addBlast, addBolt } from "./gfx/spellFx.ts";
import { logServer, bubble } from "./systems/chat.ts";

/** Put one event on screen (or in the speakers, or in the log). */
export function playFx(ev: FxEvent): void {
  switch (ev.fx) {
    case "sound": sfx(ev.id); return;
    case "buzz": buzz(ev.pattern); return;
    case "float": addFloat(ev.world, ev.x, ev.y, ev.text, ev.color); return;
    case "log": logServer(ev.text, ev.color); return;
    case "tone": beep(ev.freq, ev.dur, ev.wave, ev.vol, ev.slide); return;
    case "speech": bubble(ev.who, ev.text, ev.color); return;
    case "blood":
      if (ev.pool) pool(ev.world, ev.x, ev.y, ev.blood);
      else splash(ev.world, ev.x, ev.y, ev.blood);
      return;
    case "shot": ev.world.shots.push(ev.shot); return;
    case "flare": addFlare(ev.world, ev.x, ev.y, ev.name, ev.scale); return;
    case "blast": addBlast(ev.world, ev.tx, ev.ty, ev.el, ev.tier, ev.slot, ev.delay); return;
    case "bolt": addBolt(ev.world, ev.fromX, ev.fromY, ev.toX, ev.toY, ev.el, ev.tier); return;
    default: {
      // A new kind of event that nobody draws is a type error here, not a
      // silent gap on screen.
      const unhandled: never = ev;
      void unhandled;
    }
  }
}

let installed: (() => void) | null = null;

/** Start playing the logic's events. Safe to call more than once. */
export function installFxClient(): void {
  if (!installed) installed = onFx(playFx);
}

/** Stop — for the tests that need to see the logic run with no screen. */
export function uninstallFxClient(): void {
  installed?.();
  installed = null;
}
