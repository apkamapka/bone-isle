/** localStorage persistence: full game snapshot keyed by a single slot. */
import { buildWorlds, populateAll, type Game } from "./game.ts";
import { WORLD_SEED, GROUND_DESPAWN_S, BAG_SIZE, SPRITE_SCALE } from "./config.ts";
import { expNeeded } from "./config.ts";
import { createPlayer, refreshDerived } from "./entities/player.ts";
import { portalSpawn, feetBlocked, worldSpawn } from "./world/collision.ts";
import { placeWalker } from "./world/grid.ts";
import { applyStructureSolidity, canPlaceAt, STRUCTS, CHEST_SLOTS } from "./systems/building.ts";
import type { StructKey } from "./systems/building.ts";
import { researchState, loadResearchState, attunedState, loadAttunedState } from "./systems/tower.ts";
import { taskState, loadTaskState, type TaskSave } from "./systems/tasks.ts";
import { serializeSlots, loadSlots, type SlotAction } from "./systems/actions.ts";
import { outfitSave, loadOutfitSave, applyOutfit, type OutfitSave } from "./systems/outfit.ts";
import { setActiveBonus } from "./systems/derived.ts";
import { skills, type SkillKey } from "./systems/skills.ts";
import { stance, setStance, STANCES, type Stance } from "./systems/stance.ts";
import { quests } from "./systems/quests.ts";
import { emptyStash, emptyCorpseBag, emptyEquipment, addItem, addStack, newContainer, giveGold, COIN_KINDS, ITEMS, AMMO_KINDS } from "./items.ts";
import type { Bag, Equipment, ItemKind, ItemStack } from "./items.ts";
import type { WorldKey, Structure, GroundItem, Corpse } from "./world/types.ts";

const KEY = "bone-isle-save-v2";

/**
 * Save format version.
 *
 * v3: TILE went 16 → 32 (Etap 17). Every stored WORLD-PIXEL coordinate (the
 * player, loose ground stacks, corpses) is twice what it used to be. Tile
 * coordinates — structures — are unaffected, and so is the storage key, so a
 * v2 save loads straight into the new world with its positions scaled on the
 * way in.
 *
 * v4: the id "fireCrystal" changed hands (Etap 25). It used to be the charge
 * crystal that throws fire; it is now the attunement stone that opens the
 * fire lane in the tower. Both are valid items, so nothing would LOOK broken
 * — a loaded v3 save would just quietly turn a starting stack of fifteen fire
 * charges into fifteen lane keys and hand the player the whole fire tree.
 * That is why this bump exists even though no field changed shape.
 *
 * v7: containers became a TREE (Etap 26). The player wears a backpack instead
 * of owning a flat, growing array; a stack can carry `items` of its own; and
 * a corpse holds fixed slots with holes rather than a compact list. Older
 * saves are migrated rather than dropped — see `migrateFlatBag`.
 *
 * v8: money became an ITEM (Etap 27). `player.gold` and `corpse.gold` are
 * gone; a pre-v8 balance is minted into coins in the backpack on load, and a
 * corpse's purse is minted into its slots by the same rule.
 */
const SAVE_V = 8;

interface SaveData {
  v: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  seed: number;
  current: WorldKey;
  player: {
    x: number; y: number;
    hp: number; maxhp: number;
    /** Pre-v8 only: money was a number before it became coins in the bag. */
    gold?: number;
    taskPoints?: number; level: number; exp: number; expNext: number;
    fedS?: number;
    /** Ammo slot pick. Absent in pre-Etap-26 saves — those load as "auto". */
    ammo?: string;
    pack: ItemStack | null; bag?: Bag; eq: Equipment;
  };
  skills: Record<SkillKey, { lv: number; pts: number }>;
  /** Attack stance. Absent in pre-Etap 19 saves — those load as balanced. */
  stance?: Stance;
  quests: { id: string; progress: number; done: boolean; claimed: boolean }[];
  structures: Record<WorldKey, Structure[]>;
  /** Items lying on the ground, per world (incl. a death-dropped backpack). */
  ground?: Partial<Record<WorldKey, GroundItem[]>>;
  /** Lootable corpses per world — notably the player's own body after death. */
  corpses?: Partial<Record<WorldKey, Corpse[]>>;
  /** LEGACY (pre-Etap 11): the old shared chest inventory. No longer written;
   *  read once on load and poured into the first Storage Chest. */
  stash?: Bag;
  research?: string[];
  /** Elements whose tower lane has been opened with an attunement stone.
   *  Absent in pre-Etap-25 saves — those load with every lane still sealed,
   *  which is correct: nobody had spent a stone yet. */
  attuned?: string[];
  tasks?: TaskSave;
  slots?: (SlotAction | null)[];
  /** Wardrobe: dye choices + owned/current outfit (Etap 10). */
  outfit?: OutfitSave;
  /** One-time treasure chests already opened. */
  opened?: string[];
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function saveGame(g: Game): void {
  const p = g.player;
  const skillDump = {} as SaveData["skills"];
  (Object.keys(skills) as SkillKey[]).forEach((k) => {
    skillDump[k] = { lv: skills[k].lv, pts: skills[k].pts };
  });
  const structDump = {} as SaveData["structures"];
  const groundDump: SaveData["ground"] = {};
  const corpseDump: SaveData["corpses"] = {};
  (Object.keys(g.worlds) as WorldKey[]).forEach((k) => {
    structDump[k] = g.worlds[k].structures;
    if (g.worlds[k].ground.length) groundDump[k] = g.worlds[k].ground;
    if (g.worlds[k].corpses.length) corpseDump[k] = g.worlds[k].corpses;
  });
  const data: SaveData = {
    v: SAVE_V,
    seed: g.seed,
    current: g.current.key,
    player: {
      x: p.x, y: p.y,
      hp: p.hp, maxhp: p.maxhp,
      taskPoints: p.taskPoints, level: p.level, exp: p.exp, expNext: p.expNext,
      fedS: p.fedS,
      ammo: p.ammo ?? undefined,
      pack: p.pack, eq: p.eq,
    },
    skills: skillDump,
    stance: stance(),
    quests: quests.map((q) => ({ id: q.id, progress: q.progress, done: q.done, claimed: q.claimed })),
    structures: structDump,
    ground: groundDump,
    corpses: corpseDump,
    research: researchState(),
    attuned: attunedState(),
    tasks: taskState(),
    slots: serializeSlots(),
    outfit: outfitSave(),
    opened: g.opened,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full or unavailable — ignore */
  }
}

/** Load a saved game, or return null if none/corrupt. */
export function loadGame(): Game | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let data: SaveData;
  try {
    data = JSON.parse(raw) as SaveData;
    if (data.v < 2 || data.v > SAVE_V) return null;
    if (data.v < 4) data = renameItems(data, { fireCrystal: "flameCrystal" });
    if (data.v < 5) data = renameItems(data, ARROW_TIER_I);
    if (data.v < 6) data = dropResearch(data, RETIRED_RESEARCH);
  } catch {
    return null;
  }

  /** v2 stored world pixels on a 16-px tile; TILE is 32 now, so they double. */
  const pos = data.v === 2 ? SPRITE_SCALE : 1;

  // rebuild the deterministic world. We force the canonical WORLD_SEED (rather
  // than the seed stored in the save) so every device shows the same islands —
  // older saves were rolled with a random per-device seed before this change.
  const worlds = buildWorlds(WORLD_SEED);
  populateAll(worlds);

  (Object.keys(worlds) as WorldKey[]).forEach((k) => {
    const saved = data.structures[k];
    if (saved && saved.length) {
      // Drop structures whose kind no longer exists (e.g. the old Library), AND
      // treasure chests — those are regenerated fresh so they always sit in the
      // open, carved alcove (a fix for old saves that stored a chest walled in
      // against the rock). The freshly-built world already placed the correct
      // treasure chest; the opened-state is migrated to its coords below.
      worlds[k].structures = saved
        // "library" is the pre-Etap-5 tower; "garden" was removed in Etap 24.
        .filter((s) => s.key !== "library" && s.key !== "garden" && s.key !== "treasure")
        .map(migrateStructure)
        .concat(worlds[k].structures.filter((s) => s.key === "treasure"));
    }
    // Restore ground items + corpses (defensively — items validated by kind).
    const gr = data.ground?.[k];
    if (Array.isArray(gr)) {
      worlds[k].ground = gr
        .filter((gi) => validItem(gi) && typeof gi.x === "number" && typeof gi.y === "number")
        .map((gi) => {
          const st = validItem(gi)!;
          return { kind: st.kind, n: st.n, x: gi.x * pos, y: gi.y * pos,
            t: typeof gi.t === "number" ? gi.t : GROUND_DESPAWN_S,
            ...(st.items ? { items: st.items } : {}) };
        });
    }
    const cs = data.corpses?.[k];
    if (Array.isArray(cs)) {
      worlds[k].corpses = cs
        .filter((c) => c && typeof c.x === "number" && typeof c.y === "number" && Array.isArray(c.items))
        .map((c) => ({
          name: typeof c.name === "string" ? c.name : "corpse",
          x: c.x * pos, y: c.y * pos,
          // pre-v7 corpses were a compact list; pour it into real slots
          // a pre-v8 corpse kept its purse in a `gold` field; mint it into slots
          items: normalizeCorpse(c.items, typeof (c as unknown as { gold?: unknown }).gold === "number" ? (c as unknown as { gold: number }).gold : 0),
          t: typeof c.t === "number" ? c.t : 60,
        }));
    }
  });

  // Migrate the one-time-chest "opened" flags to the regenerated chest coords.
  // Old saves stored `treasure:{world}:{oldTx},{oldTy}` from the pre-fix chest
  // position; now that each world's single treasure chest is regenerated (in
  // its carved alcove), re-point every opened id to the new coords so a chest
  // already looted stays looted — no duplicate Marrow-set pieces.
  const openedRaw = Array.isArray(data.opened) ? data.opened.filter((x): x is string => typeof x === "string") : [];
  const opened = openedRaw.map((id) => {
    const m = /^treasure:([^:]+):/.exec(id);
    if (!m) return id;
    const chest = worlds[m[1] as WorldKey]?.structures.find((s) => s.key === "treasure");
    return chest ? `treasure:${m[1]}:${chest.tx},${chest.ty}` : id;
  });

  // Migration: structures from very old saves (procedural Home Isle) may sit
  // on tiles that are no longer valid (water, trees, overlaps). Any structure
  // whose footprint is invalid on the current map slides to the nearest clear
  // spot (spiral search); valid placements are left exactly where they are.
  for (const s of worlds.home.structures) {
    const key = s.key as StructKey;
    if (!STRUCTS[key]) continue;
    if (canPlaceAt(worlds.home, key, s.tx, s.ty, s)) continue;
    outer: for (let r = 1; r < 24; r++) {
      for (let oy = -r; oy <= r; oy++) {
        for (let ox = -r; ox <= r; ox++) {
          if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue; // ring only
          if (canPlaceAt(worlds.home, key, s.tx + ox, s.ty + oy, s)) {
            s.tx += ox;
            s.ty += oy;
            break outer;
          }
        }
      }
    }
  }

  applyStructureSolidity(worlds.home);

  const player = createPlayer(worldSpawn(worlds.home));
  const sp = data.player;
  placeWalker(player, sp.x * pos, sp.y * pos); // scale a v2 position, then snap to its tile centre
  player.taskPoints = sp.taskPoints ?? 0; player.level = sp.level;
  player.fedS = sp.fedS ?? 0; // older saves start hungry
  // Recompute expNext from level so older saves adopt the current XP curve.
  player.exp = sp.exp; player.expNext = expNeeded(player.level);
  // rebuild pack/eq defensively (older/partial saves)
  const spill: ItemStack[] = [];
  if (data.v < 7) {
    const m = migrateFlatBag(sp.bag);
    player.pack = m.pack;
    spill.push(...m.spill);
  } else {
    const worn = validItem(sp.pack);
    player.pack = worn && ITEMS[worn.kind].pack ? worn : null;
    if (player.pack) player.pack.items = normalizeBag(player.pack.items, ITEMS[player.pack.kind].pack!.slots);
  }
  /* Pre-v8 saves stored gold as a NUMBER. It becomes coins in the backpack —
   * minted after the pack exists, since there is nowhere to put them before
   * that. A bagless or overfull load hands the remainder to `spill`, which
   * already knows how to reach a chest or the ground. */
  if (data.v < 8 && (sp.gold ?? 0) > 0) {
    const owed = Math.max(0, Math.floor(sp.gold ?? 0));
    const unpaid = player.pack ? giveGold(player.bag, owed) : owed;
    if (unpaid > 0) {
      for (const k of COIN_KINDS) {
        const worth = ITEMS[k].coin ?? 1;
        const n = Math.floor(unpaid / worth);
        if (n > 0) spill.push({ kind: k, n });
      }
    }
  }
  player.eq = normalizeEquipment(sp.eq);
  // A pick naming an arrow that no longer exists falls back to "auto" rather
  // than sticking the bow with a kind it can never fire.
  player.ammo = typeof sp.ammo === "string" && AMMO_KINDS.includes(sp.ammo as ItemKind)
    ? (sp.ammo as ItemKind)
    : null;

  (Object.keys(skills) as SkillKey[]).forEach((k) => {
    const s = data.skills?.[k];
    if (s) { skills[k].lv = s.lv; skills[k].pts = s.pts; }
  });
  // an unknown or missing stance falls back to the default rather than throwing
  if (data.stance && STANCES.includes(data.stance)) setStance(data.stance);

  for (const qs of data.quests ?? []) {
    const q = quests.find((x) => x.id === qs.id);
    if (q) { q.progress = qs.progress; q.done = qs.done; q.claimed = qs.claimed; }
  }

  loadResearchState(data.research);
  loadAttunedState(data.attuned);
  loadTaskState(data.tasks);
  loadSlots(data.slots);
  loadOutfitSave(data.outfit); // absent in older saves → classic look
  applyOutfit(player);

  setActiveBonus({ maxhp: 0 });
  refreshDerived(player, { maxhp: 0 });
  player.hp = Math.min(sp.hp, player.maxhp);

  const current = worlds[data.current] ?? worlds.home;
  // the saved position was on the old per-device island; if it now lands on
  // water/solid on the canonical map, drop the player at a safe portal spawn
  if (feetBlocked(current, player.x, player.y)) {
    const safe = worldSpawn(current);
    placeWalker(player, safe.x, safe.y);
  }
  // LEGACY stash migration (pre-Etap 11 shared chest): pour the old shared
  // inventory into the first Storage Chest — its 50 slots swallow the old 20
  // whole. In the (theoretically impossible) chestless case the items drop on
  // the ground at the home spawn rather than silently vanishing.
  const legacy = normalizeStash(data.stash);
  const firstChest = worlds.home.structures.find((s) => s.key === "chest");
  for (const st of legacy) {
    if (!st) continue;
    let left = st.n;
    if (firstChest) left = addItem((firstChest.inv ??= emptyStash(CHEST_SLOTS[1])), st.kind, st.n);
    if (left > 0) {
      const at = portalSpawn(worlds.home);
      worlds.home.ground.push({ kind: st.kind, n: left, x: at.x + (Math.random() - 0.5) * 24, y: at.y + 16, t: GROUND_DESPAWN_S });
    }
  }

  /* Whatever the v6→v7 bag migration could not fit takes the same road: into
   * the first chest, then onto the ground by the portal. It should almost
   * never fire — a pre-v7 bag held at most 32 cells and the new pack plus its
   * own sub-packs hold more — but "almost never" is not "never", and losing a
   * player's inventory to a version bump is the one outcome worth this code. */
  for (const st of spill) {
    let placed = false;
    if (firstChest) placed = addStack((firstChest.inv ??= emptyStash(CHEST_SLOTS[1])), st);
    if (!placed) {
      const at = portalSpawn(worlds.home);
      worlds.home.ground.push({ kind: st.kind, n: st.n, x: at.x + (Math.random() - 0.5) * 24, y: at.y + 16,
        t: GROUND_DESPAWN_S, ...(st.items ? { items: st.items } : {}) });
    }
  }

  return {
    seed: WORLD_SEED,
    worlds,
    current,
    player,
    zoneFlash: { text: current.name + (current.safe ? "  (safe)" : "  (dangerous)"), t: 2 },
    tpFlash: 0,
    opened,
  };
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Item ids that changed hands or gained a tier.
 *
 * v3 → v4: "fireCrystal" was the old charge crystal, now called
 * "flameCrystal" — the id went to the attunement stone.
 * v4 → v5: the five untiered elemental arrows became the tier-I arrows of
 * their line when every form gained three tiers.
 *
 * This walks the whole save rather than visiting bag, equipment, chests,
 * ground stacks, corpse loot and action slots one by one. That is on purpose:
 * an item id can be stored as a bare string (equipment, action slots) or as
 * `{ kind }` (everywhere else), and the list of places holding one has grown
 * every etap. A blanket rewrite of the exact string cannot miss a spot, and
 * cannot hit a false positive either — no research id, world key, structure
 * key or quest id is spelled "fireCrystal".
 */
const ARROW_TIER_I: Readonly<Record<string, string>> = {
  fireArrow: "fireEmberArrow", iceArrow: "iceFrostArrow", earthArrow: "earthLoamArrow",
  stormArrow: "stormSparkArrow", shadowArrow: "shadowGloomArrow",
};

/**
 * Research ids retired in Etap 26 along with their crystals. Left in a save
 * they would be harmless — nothing reads them — but they would also travel
 * forever, and a stale id is exactly the kind of thing that quietly comes
 * back to life when an id gets reused.
 *
 * The RETIRED ITEMS themselves need no list. Every reader of a saved stack
 * (`validItem`, `normalizeEquipment`, `loadSlots`) already checks the kind
 * against the live registry and drops what it does not recognise, so the six
 * ids that stopped existing evaporate on load wherever they were stored —
 * bag, equipment, chests, ground, corpses or action bindings.
 */
const RETIRED_RESEARCH: readonly string[] = ["fire", "spear"];

function dropResearch(data: SaveData, ids: readonly string[]): SaveData {
  if (!data.research) return data;
  return { ...data, research: data.research.filter((id) => !ids.includes(id)) };
}

function renameItems(data: SaveData, map: Readonly<Record<string, string>>): SaveData {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string" && v in map) return map[v];
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return walk(data) as SaveData;
}

function validItem(s: unknown): ItemStack | null {
  if (!(s && typeof s === "object" && "kind" in s && "n" in s)) return null;
  const kind = (s as { kind: string }).kind;
  if (!(kind in ITEMS)) return null;
  const st: ItemStack = { kind: kind as ItemKind, n: (s as { n: number }).n };
  // a container carries its own slots through the save, contents and all
  const slots = ITEMS[st.kind].pack?.slots;
  if (slots) {
    const raw = (s as { items?: unknown }).items;
    const inner = new Array<ItemStack | null>(slots).fill(null);
    if (Array.isArray(raw)) {
      for (let i = 0; i < slots && i < raw.length; i++) inner[i] = validItem(raw[i]);
    }
    st.items = inner;
  }
  return st;
}

function normalizeBag(bag: unknown, size = BAG_SIZE): Bag {
  const out = new Array<ItemStack | null>(size).fill(null);
  if (Array.isArray(bag)) {
    for (let i = 0; i < size && i < bag.length; i++) out[i] = validItem(bag[i]);
  }
  return out;
}

/**
 * Turn a pre-v7 flat bag into a worn backpack.
 *
 * Old saves stored one array of up to 16 + 8 + 8 cells, where a carried
 * Backpack was an ITEM that bolted eight more cells onto the end. The first
 * BAG_SIZE cells become the pack you are wearing; the overflow — which only
 * ever existed because of those Backpack items — is poured into the packs
 * themselves, which is where its owner always thought it was. Anything still
 * homeless is handed back for the caller to spill on the ground, because
 * silently deleting a player's steel is not a migration.
 */
function migrateFlatBag(raw: unknown): { pack: ItemStack; spill: ItemStack[] } {
  const pack = newContainer("backpack")!;
  const slots = pack.items!;
  const flat: ItemStack[] = Array.isArray(raw)
    ? raw.map(validItem).filter((s): s is ItemStack => s !== null)
    : [];
  const spill: ItemStack[] = [];
  // containers first, so the overflow has somewhere to land
  flat.sort((a, b) => (b.items ? 1 : 0) - (a.items ? 1 : 0));
  for (const st of flat) if (!addStack(slots, st)) spill.push(st);
  return { pack, spill };
}

/**
 * A corpse's slots. Handles both shapes: the pre-v7 compact list (no holes,
 * any length) and a v7 fixed grid. Anything past CORPSE_SLOTS is dropped —
 * only a save hand-edited to hold more could ever hit that.
 */
function normalizeCorpse(raw: unknown, legacyGold = 0): Bag {
  const out = emptyCorpseBag();
  if (legacyGold > 0) giveGold(out, legacyGold);
  if (!Array.isArray(raw)) return out;
  const stacks = raw.map(validItem);
  const dense = stacks.every((s, i) => s !== null || i >= stacks.length);
  if (dense && stacks.length + out.filter((q) => q).length <= out.length && !raw.includes(null)) {
    for (const st of stacks) if (st) addStack(out, st);
    return out;
  }
  for (let i = 0, j = 0; i < out.length && j < stacks.length; i++) {
    if (out[i]) continue; // minted coins keep their cell
    out[i] = stacks[j++];
  }
  return out;
}

function normalizeEquipment(eq: unknown): Equipment {
  const out = emptyEquipment();
  if (eq && typeof eq === "object") {
    for (const slot of Object.keys(out) as (keyof Equipment)[]) {
      const v = (eq as Record<string, unknown>)[slot];
      if (typeof v === "string" && v in ITEMS) out[slot] = v as ItemKind;
    }
  }
  return out;
}

/**
 * Fold a saved structure into the Etap 24 tier model.
 *
 * Two rewrites happen here. The old standalone War Dummy becomes a tier-II
 * Training Dummy, which is exactly what it was — the same post that also
 * trained Shielding. And every pre-tier Storage Chest becomes tier II rather
 * than tier I: chests used to hold 50 slots flat, and dropping them to the
 * new tier-I capacity of 10 would silently delete forty slots of somebody's
 * belongings. Players keep the room they already had.
 */
function migrateStructure(s: Structure): Structure {
  const key = s.key === "dummyII" ? "dummy" : s.key;
  let tier = typeof s.tier === "number" ? s.tier : s.key === "dummyII" ? 2 : s.key === "chest" ? 2 : 1;
  tier = Math.max(1, Math.min(3, Math.round(tier)));
  const out: Structure = { ...s, key, tier };
  if (key === "chest") out.inv = normalizeStash(s.inv, CHEST_SLOTS[tier - 1]);
  return out;
}

function normalizeStash(stash: unknown, size?: number): Bag {
  const out = emptyStash(size);
  if (Array.isArray(stash)) {
    for (let i = 0; i < out.length && i < stash.length; i++) {
      out[i] = validItem(stash[i]);
    }
  }
  return out;
}
