/**
 * The picture a townsperson is drawn with when his walk sheet has no frame to
 * show (Etap 3.1b). The roster names it (world/generate.ts `NPC_DATA`); this is
 * where the name becomes a canvas, so no townsperson carries one.
 */
import { SPR } from "./sprites.ts";
import { NPC_DATA, type NpcArt } from "../world/generate.ts";
import type { NpcKey } from "../world/types.ts";

const ART = new Map<NpcKey, NpcArt>(NPC_DATA.map(([key, , art]) => [key, art]));

/** The baked stand-in for a townsperson of this key. */
export function npcSprite(key: NpcKey): HTMLCanvasElement {
  const art = ART.get(key);
  return art ? SPR[art] : SPR.npcSmith;
}
