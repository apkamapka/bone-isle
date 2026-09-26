/**
 * When creatures and townsfolk speak (Etap 73). The words are in
 * text/voices.ts; this is only the clock.
 *
 * Each creature talks every 20-40 seconds, calmly while idle and angrily once
 * it is fighting, and only when it is near enough to be seen. A crowd does
 * not talk over itself: after one creature speaks the rest wait three seconds.
 * A coward that breaks cries out once, as it breaks. Townsfolk call out every
 * 30-60 seconds, but not while you are talking to them.
 */
import type { World } from "../world/types.ts";
import { TILE } from "../config.ts";
import { rnd } from "../util.ts";
import { bubble } from "./chat.ts";
import { fleeLine, npcLine, voiceLine, VOICE_COLOR } from "../text/voices.ts";
import { isFleeing } from "./mobTactics.ts";

export const VOICE_MIN_S = 20;
export const VOICE_MAX_S = 40;
export const NPC_VOICE_MIN_S = 30;
export const NPC_VOICE_MAX_S = 60;
export const VOICE_RANGE_TILES = 8;
export const NPC_VOICE_RANGE_TILES = 10;
export const VOICE_GAP_S = 3;

let gap = 0;

export function tickVoices(w: World, dt: number, px: number, py: number): void {
  gap = Math.max(0, gap - dt);
  const ptx = Math.floor(px / TILE);
  const pty = Math.floor(py / TILE);
  for (const m of w.monsters) {
    const near = Math.max(Math.abs(m.tx - ptx), Math.abs(m.ty - pty)) <= VOICE_RANGE_TILES;
    if (isFleeing(m)) {
      if (!m.fleeSaid) {
        m.fleeSaid = true;
        const line = near ? fleeLine(m.kind) : null;
        if (line) bubble(m.id, line, VOICE_COLOR);
      }
      continue;
    }
    if (m.voiceT === undefined) m.voiceT = rnd(4, VOICE_MAX_S);
    m.voiceT -= dt;
    if (m.voiceT > 0) continue;
    m.voiceT = rnd(VOICE_MIN_S, VOICE_MAX_S);
    if (!near || gap > 0) continue;
    const line = voiceLine(m.kind, !!m.engaged);
    if (!line) continue;
    bubble(m.id, line, VOICE_COLOR);
    gap = VOICE_GAP_S;
  }
  for (const n of w.npcs) {
    if (n.voiceT === undefined) n.voiceT = rnd(5, NPC_VOICE_MAX_S / 2);
    n.voiceT -= dt;
    if (n.voiceT > 0) continue;
    n.voiceT = rnd(NPC_VOICE_MIN_S, NPC_VOICE_MAX_S);
    if (n.talk > 0) continue;
    if (Math.max(Math.abs(n.tx - ptx), Math.abs(n.ty - pty)) > NPC_VOICE_RANGE_TILES) continue;
    const line = npcLine(n.key);
    if (line) bubble(n.id, line, VOICE_COLOR);
  }
}
