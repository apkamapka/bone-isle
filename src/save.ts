/** localStorage persistence: full game snapshot keyed by a single slot. */
import { buildWorlds, populateAll, type Game } from "./game.ts";
import { WORLD_SEED, GROUND_DESPAWN_S } from "./config.ts";
import { expNeeded } from "./config.ts";
import { createPlayer, refreshDerived } from "./entities/player.ts";
import { portalSpawn, feetBlocked } from "./world/collision.ts";
import { applyStructureSolidity, structureBonuses, canPlaceAt, STRUCTS } from "./systems/building.ts";
import type { StructKey } from "./systems/building.ts";
import { researchState, loadResearchState } from "./systems/tower.ts";
import { taskState, loadTaskState, type TaskSave } from "./systems/tasks.ts";
import { serializeSlots, loadSlots, type SlotAction } from "./systems/actions.ts";
import { setActiveBonus } from "./systems/derived.ts";
import { skills, type SkillKey } from "./systems/skills.ts";
import { quests } from "./systems/quests.ts";
import { emptyBag, emptyStash, emptyEquipment, ITEMS } from "./items.ts";
import type { Bag, Equipment, ItemKind } from "./items.ts";
import type { WorldKey, Structure, GroundItem, Corpse } from "./world/types.ts";

const KEY = "bone-isle-save-v2";

interface SaveData {
  v: 2;
  seed: number;
  current: WorldKey;
  player: {
    x: number; y: number;
    hp: number; maxhp: number;
    gold: number; taskPoints?: number; level: number; exp: number; expNext: number;
    bag: Bag; eq: Equipment;
  };
  skills: Record<SkillKey, { lv: number; pts: number }>;
  quests: { id: string; progress: number; done: boolean; claimed: boolean }[];
  structures: Record<WorldKey, Structure[]>;
  /** Items lying on the ground, per world (incl. a death-dropped backpack). */
  ground?: Partial<Record<WorldKey, GroundItem[]>>;
  /** Lootable corpses per world — notably the player's own body after death. */
  corpses?: Partial<Record<WorldKey, Corpse[]>>;
  stash?: Bag;
  research?: string[];
  tasks?: TaskSave;
  slots?: (SlotAction | null)[];
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
    v: 2,
    seed: g.seed,
    current: g.current.key,
    player: {
      x: p.x, y: p.y,
      hp: p.hp, maxhp: p.maxhp,
      gold: p.gold, taskPoints: p.taskPoints, level: p.level, exp: p.exp, expNext: p.expNext,
      bag: p.bag, eq: p.eq,
    },
    skills: skillDump,
    quests: quests.map((q) => ({ id: q.id, progress: q.progress, done: q.done, claimed: q.claimed })),
    structures: structDump,
    ground: groundDump,
    corpses: corpseDump,
    stash: g.stash,
    research: researchState(),
    tasks: taskState(),
    slots: serializeSlots(),
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
    if (data.v !== 2) return null;
  } catch {
    return null;
  }

  // rebuild the deterministic world. We force the canonical WORLD_SEED (rather
  // than the seed stored in the save) so every device shows the same islands —
  // older saves were rolled with a random per-device seed before this change.
  const worlds = buildWorlds(WORLD_SEED);
  populateAll(worlds);

  (Object.keys(worlds) as WorldKey[]).forEach((k) => {
    const saved = data.structures[k];
    if (saved && saved.length) {
      // Drop structures whose kind no longer exists (e.g. the old Library).
      worlds[k].structures = saved
        .filter((s) => s.key !== "library")
        .map((s) => ({ ...s }));
    }
    // Restore ground items + corpses (defensively — items validated by kind).
    const gr = data.ground?.[k];
    if (Array.isArray(gr)) {
      worlds[k].ground = gr
        .filter((gi) => validItem(gi) && typeof gi.x === "number" && typeof gi.y === "number")
        .map((gi) => ({ kind: gi.kind, n: gi.n, x: gi.x, y: gi.y, t: typeof gi.t === "number" ? gi.t : GROUND_DESPAWN_S }));
    }
    const cs = data.corpses?.[k];
    if (Array.isArray(cs)) {
      worlds[k].corpses = cs
        .filter((c) => c && typeof c.x === "number" && typeof c.y === "number" && Array.isArray(c.items))
        .map((c) => ({
          name: typeof c.name === "string" ? c.name : "corpse",
          x: c.x, y: c.y,
          items: c.items.map(validItem).filter((it): it is NonNullable<ReturnType<typeof validItem>> => it !== null),
          gold: typeof c.gold === "number" ? Math.max(0, c.gold) : 0,
          t: typeof c.t === "number" ? c.t : 60,
        }));
    }
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

  const player = createPlayer(portalSpawn(worlds.home));
  const sp = data.player;
  player.x = sp.x; player.y = sp.y;
  player.gold = sp.gold; player.taskPoints = sp.taskPoints ?? 0; player.level = sp.level;
  // Recompute expNext from level so older saves adopt the current XP curve.
  player.exp = sp.exp; player.expNext = expNeeded(player.level);
  // rebuild bag/eq defensively (older/partial saves)
  player.bag = normalizeBag(sp.bag);
  player.eq = normalizeEquipment(sp.eq);

  (Object.keys(skills) as SkillKey[]).forEach((k) => {
    const s = data.skills?.[k];
    if (s) { skills[k].lv = s.lv; skills[k].pts = s.pts; }
  });

  for (const qs of data.quests ?? []) {
    const q = quests.find((x) => x.id === qs.id);
    if (q) { q.progress = qs.progress; q.done = qs.done; q.claimed = qs.claimed; }
  }

  loadResearchState(data.research);
  loadTaskState(data.tasks);
  loadSlots(data.slots);

  setActiveBonus(structureBonuses(worlds.home));
  refreshDerived(player, structureBonuses(worlds.home));
  player.hp = Math.min(sp.hp, player.maxhp);

  const current = worlds[data.current] ?? worlds.home;
  // the saved position was on the old per-device island; if it now lands on
  // water/solid on the canonical map, drop the player at a safe portal spawn
  if (feetBlocked(current, player.x, player.y)) {
    const safe = portalSpawn(current);
    player.x = safe.x;
    player.y = safe.y;
  }
  return {
    seed: WORLD_SEED,
    worlds,
    current,
    player,
    stash: normalizeStash(data.stash),
    zoneFlash: { text: current.name + (current.safe ? "  (safe)" : "  (dangerous)"), t: 2 },
    tpFlash: 0,
  };
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

function validItem(s: unknown): { kind: ItemKind; n: number } | null {
  if (s && typeof s === "object" && "kind" in s && "n" in s) {
    const kind = (s as { kind: string }).kind;
    if (kind in ITEMS) return { kind: kind as ItemKind, n: (s as { n: number }).n };
  }
  return null;
}

function normalizeBag(bag: unknown): Bag {
  const out = emptyBag();
  if (Array.isArray(bag)) {
    for (let i = 0; i < out.length && i < bag.length; i++) {
      out[i] = validItem(bag[i]);
    }
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

function normalizeStash(stash: unknown): Bag {
  const out = emptyStash();
  if (Array.isArray(stash)) {
    for (let i = 0; i < out.length && i < stash.length; i++) {
      out[i] = validItem(stash[i]);
    }
  }
  return out;
}
