/**
 * What is left of the world generator: the townsfolk roster.
 *
 * Etap 40 removed `makeWorld` and with it the last procedural map. Every world
 * is authored by hand in `handmade.ts` and painted in Tiled. The terrain baker
 * that used to live here — the fallback picture that shows for the frame or
 * two before a map's PNG arrives — is the client's since Etap 3.1b
 * (gfx/terrainArt.ts): a world no longer carries a canvas.
 */
import type { NpcKey } from "./types.ts";

/** The baked stand-in each townsperson is drawn as before his walk sheet
 *  loads: a key of the client's sprite table (gfx/sprites.ts `SPR`). */
export type NpcArt =
  | "npcSmith" | "npcHerbalist" | "npcElder" | "npcTaskmaster"
  | "npcTailor" | "npcMorgan" | "npcTimesage";

/**
 * Bonetown's people, by the names over their heads, with the name of the
 * picture each is drawn as (a name, not the picture, since Etap 3.1b).
 *
 * Named for somebody real since Etap 72, each for the trade he or she keeps:
 * Chester the smith (Winchester — was Borin), Hildegard the herbalist
 * (Hildegard of Bingen — was Mira), Kruk the jeweller (W.KRUK, Poznan, 1840 —
 * was Elder Oswin), Vito the tailor (Louis Vuitton — was Vesper) and Morgan
 * the changer (J.P. Morgan). Grizelda already was one: Grizzly Adams, whose
 * name Tibia's hunting-task master wears. Just the name — "NPC" under it says
 * the rest (gfx/lifeBar.ts). Chronos alone keeps his title: "the Time Sage"
 * is what the mission chain is called, not a job description.
 *
 * The KEYS do not move: sprites, shops, windows and spawn glyphs hang off
 * them, and none of them is ever shown.
 */
export const NPC_DATA: ReadonlyArray<readonly [NpcKey, string, NpcArt, number]> = [
  ["smith", "Chester", "npcSmith", 1],
  ["herbalist", "Hildegard", "npcHerbalist", 1],
  ["elder", "Kruk", "npcElder", 1],
  ["taskmaster", "Grizelda", "npcTaskmaster", 1],
  ["tailor", "Vito", "npcTailor", 1],
  // The money changer. He paces the same 3x3 box as the other stallholders —
  // and, like them, stands perfectly still for as long as his window is open,
  // because an open panel holds `talk` and a talking townsperson never steps.
  ["morgan", "Morgan", "npcMorgan", 1],
  // Rooted by default — the cellar copy never moves. The town copy overrides
  // the beat in its own spec (four tiles east and west, one row).
  ["timesage", "Chronos the Time Sage", "npcTimesage", 0],
];
