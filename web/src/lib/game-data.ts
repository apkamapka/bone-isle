/**
 * The game's tables, for the site's build only: written by
 * tools/export-data.ts just before `astro build` runs (`npm run build:site`).
 * Only page frontmatter may import this. A <script> that did would ship the
 * exact drop chances to every visitor, which is the one thing the library
 * promises not to show.
 */
import raw from "../data/generated/game-data.json";
import type { GameData } from "../../../tools/export-data.ts";

export const DATA = raw as unknown as GameData;

export const ITEM = new Map(DATA.items.map((i) => [i.key as string, i]));
export const PLACE = new Map(DATA.worlds.map((w) => [w.key, w]));
export const ELEMENT = new Map(DATA.elements.map((e) => [e.id as string, e.label]));
