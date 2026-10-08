/**
 * Which picture files the props and the one PNG-only creature are drawn from.
 *
 * Trees, rocks, stumps and rubble ship as procedurally baked pixel art so the
 * game runs with no assets at all; when the drawn artwork is available it
 * replaces those four sprites everywhere. This file only NAMES the files.
 * Since Etap 3.1b the loading is the client's job (gfx/propArt.ts), and no
 * world object holds a picture any more — so nothing has to be swept when the
 * images land: the next frame simply draws with them.
 *
 * Artwork is authored at WORLD scale — 2x the legacy 16-px art, i.e. TILE px
 * per tile — anchored bottom-centre to match `drawSprite()`, with its own drop
 * shadow already painted in.
 */
import type { MonsterKind } from "./types.ts";

export type PropKey = "tree" | "rock" | "stump" | "rubble";

export const PROP_SRC: Readonly<Record<PropKey, string>> = {
  tree: "./prop-tree.png",
  rock: "./prop-rock.png",
  stump: "./prop-stump.png",
  rubble: "./prop-rubble.png",
};

/** Creature artwork. Cut from an LPC sheet, so already at actor scale. */
export const MOB_SRC: Readonly<Partial<Record<MonsterKind, string>>> = {
  bandit: "./mob-bandit.png",
};
