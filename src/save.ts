/** localStorage persistence: full game snapshot keyed by a single slot. */
import { buildWorlds, populateWild, type Game } from "./game.ts";
import { createPlayer, refreshDerived } from "./entities/player.ts";
import { portalSpawn } from "./world/collision.ts";
import { applyStructureSolidity } from "./systems/building.ts";
import { skills, type SkillKey } from "./systems/skills.ts";
import { quests } from "./systems/quests.ts";
import { emptyBag, emptyEquipment } from "./items.ts";
import type { Bag, Equipment, ItemKind } from "./items.ts";
import type { WorldKey, Structure } from "./world/types.ts";

const KEY = "bone-isle-save-v2";

interface SaveData {
  v: 2;
  seed: number;
  current: WorldKey;
  player: {
    x: number; y: number;
    hp: number; maxhp: number; mana: number; maxmana: number;
    gold: number; level: number; exp: number; expNext: number;
    bag: Bag; eq: Equipment;
  };
  skills: Record<SkillKey, { lv: number; pts: number }>;
  quests: { id: string; progress: number; done: boolean; claimed: boolean }[];
  structures: Record<WorldKey, Structure[]>;
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
  (Object.keys(g.worlds) as WorldKey[]).forEach((k) => {
    structDump[k] = g.worlds[k].structures;
  });
  const data: SaveData = {
    v: 2,
    seed: g.seed,
    current: g.current.key,
    player: {
      x: p.x, y: p.y,
      hp: p.hp, maxhp: p.maxhp, mana: p.mana, maxmana: p.maxmana,
      gold: p.gold, level: p.level, exp: p.exp, expNext: p.expNext,
      bag: p.bag, eq: p.eq,
    },
    skills: skillDump,
    quests: quests.map((q) => ({ id: q.id, progress: q.progress, done: q.done, claimed: q.claimed })),
    structures: structDump,
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

  // rebuild the deterministic world from the seed, then overlay saved state
  const worlds = buildWorlds(data.seed);
  populateWild(worlds.wild);

  (Object.keys(worlds) as WorldKey[]).forEach((k) => {
    const saved = data.structures[k];
    if (saved && saved.length) {
      worlds[k].structures = saved.map((s) => ({ ...s }));
    }
  });
  applyStructureSolidity(worlds.home);

  const player = createPlayer(portalSpawn(worlds.home));
  const sp = data.player;
  player.x = sp.x; player.y = sp.y;
  player.gold = sp.gold; player.level = sp.level;
  player.exp = sp.exp; player.expNext = sp.expNext;
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

  refreshDerived(player);
  player.hp = Math.min(sp.hp, player.maxhp);
  player.mana = Math.min(sp.mana, player.maxmana);

  const current = worlds[data.current] ?? worlds.home;
  return {
    seed: data.seed,
    worlds,
    current,
    player,
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

function normalizeBag(bag: unknown): Bag {
  const out = emptyBag();
  if (Array.isArray(bag)) {
    for (let i = 0; i < out.length && i < bag.length; i++) {
      const s = bag[i];
      if (s && typeof s === "object" && "kind" in s && "n" in s) {
        out[i] = { kind: (s as { kind: ItemKind }).kind, n: (s as { n: number }).n };
      }
    }
  }
  return out;
}

function normalizeEquipment(eq: unknown): Equipment {
  const out = emptyEquipment();
  if (eq && typeof eq === "object") {
    for (const slot of Object.keys(out) as (keyof Equipment)[]) {
      const v = (eq as Record<string, unknown>)[slot];
      if (typeof v === "string") out[slot] = v as ItemKind;
    }
  }
  return out;
}
