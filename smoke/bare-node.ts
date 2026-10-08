/**
 * Etap 3.1e — the game's logic, run by bare Node.
 *
 * run.ts loads the game under stub.ts, which fakes a browser (a document, a
 * canvas, storage), because it tests the screen as well as the rules. The
 * server will have none of that. So this file loads EVERY logic module with
 * no stub at all, with each browser-only global replaced by a trap that
 * notes who reached for it, and then plays a long, busy session on the fixed
 * tick a server runs: walking, fighting with a sword and with a bow, crystals,
 * food, looting bodies and the floor, shops and the task board, the sage and
 * his errand, pads between maps, and a death with the wake-up at home.
 * Anything in the logic that still reaches for a screen, a key or the
 * browser's storage is found here, not on the day the server first boots.
 *
 * Deterministic: the dice are seeded and the clock is the game's own, so the
 * same seed plays the same session to the same final hash. run.ts runs it in
 * fresh processes and compares (the Etap 3.1e block).
 *
 *   npx tsx smoke/bare-node.ts [seed] [game minutes]
 *
 * Prints one JSON report as its last line, and exits 1 if anything is wrong.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SEED = (Number(process.argv[2] ?? 1) >>> 0) || 1;
const MINUTES = Number(process.argv[3] ?? 8);
/** A server's tick: twenty a second, fixed. The browser's is one a frame. */
const DT = 0.05;

/* ---- 1. traps where the browser would be ------------------------------------
 * Each is undefined, as on a server, but reading it is written down with the
 * first place in the game that did. `typeof window` counts as reaching for it:
 * code the server runs should not need to ask. Network globals are trapped
 * too — the logic does no I/O of its own; the server and the client do. */
const BROWSER = [
  "window", "document", "navigator", "location", "history", "localStorage", "sessionStorage", "indexedDB",
  "Image", "HTMLCanvasElement", "OffscreenCanvas", "CanvasRenderingContext2D", "AudioContext", "Audio",
  "requestAnimationFrame", "cancelAnimationFrame", "matchMedia", "devicePixelRatio", "innerWidth",
  "innerHeight", "screen", "visualViewport", "addEventListener", "removeEventListener", "alert", "confirm",
  "prompt", "fetch", "WebSocket", "XMLHttpRequest",
] as const;
const touched = new Map<string, string>();
/** Globals this Node would not let us replace — a newer Node may own one. */
const untrapped: string[] = [];
for (const name of BROWSER) {
  try {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get() {
        const stack = (new Error().stack ?? "").split("\n").slice(2);
        const ours = stack.find((l) => l.includes("/src/"));
        if (ours && !touched.has(name)) touched.set(name, ours.trim());
        return undefined;
      },
      set() { /* nothing to set on a server */ },
    });
  } catch {
    untrapped.push(name);
  }
}

/* ---- 2. the dice and the clock ------------------------------------------------
 * The combat rolls use Math.random, so it is seeded BEFORE anything is loaded
 * (util.ts keeps a reference to it). Three clocks in the logic read
 * `performance.now()` — the battle mark, the shield's block window, the
 * blood-hit window — and here that is the game's own time, advanced by the
 * tick, which is also what keeps two runs identical. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = mulberry32(SEED);
let clockMs = 0;
performance.now = (): number => clockMs;

/* ---- 3. what the logic is, read off the import graph ---------------------------- */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const LOGIC = /^(systems|entities|world|text|intents|tick)\/|^(game|config|util|items)\.ts$/;
const rel = (abs: string): string => path.relative(SRC, abs).split(path.sep).join("/");
const strip = (t: string): string => t
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:"'`\\])\/\/.*$/, "$1")).join("\n");

const allTs: string[] = [];
(function walk(d: string): void {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".ts")) allTs.push(p);
  }
})(SRC);
const code = new Map(allTs.map((f) => [f, strip(fs.readFileSync(f, "utf8"))]));
const logicFiles = allTs.filter((f) => LOGIC.test(rel(f))).sort();
const imports = (f: string): string[] => {
  const out: string[] = [];
  const t = code.get(f) ?? "";
  for (const m of t.matchAll(/\b(?:import|export)\s+(type\s+)?(?:[\s\S]*?\bfrom\s+)?["']([^"']+)["']/g)) {
    if (!m[1]) out.push(m[2]); // `import type` is erased, so it is no edge
  }
  for (const m of t.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) out.push(m[1]);
  return out;
};
const reached = new Set(logicFiles);
const queue = [...logicFiles];
/** Logic importing anything that is not logic: a picture, a window, a sound. */
const outside: string[] = [];
/** Logic importing a package — the game ships with none. */
const bare: string[] = [];
while (queue.length) {
  const f = queue.shift()!;
  for (const spec of imports(f)) {
    if (!spec.startsWith(".")) { bare.push(`${rel(f)} -> ${spec}`); continue; }
    const t = path.resolve(path.dirname(f), spec);
    if (reached.has(t)) continue;
    reached.add(t);
    if (!LOGIC.test(rel(t))) outside.push(`${rel(f)} -> ${rel(t)}`);
    else queue.push(t);
  }
}
// Vite answers `import.meta.env` and `import.meta.glob`; Node does not
const viteOnly = logicFiles.filter((f) => /\bimport\.meta\.(env|glob|hot)\b/.test(code.get(f) ?? "")).map(rel);
// Time in the game moves on the tick and nowhere else: a timer of its own
// would run on the machine's clock, between ticks, out of the server's hands
const timers = logicFiles.filter((f) => /\b(setTimeout|setInterval|requestIdleCallback)\s*\(/.test(code.get(f) ?? "")).map(rel);

/* ---- what the run found ------------------------------------------------------------ */
const loadErrors: string[] = [];
const errors: string[] = [];
const violations: string[] = [];
const note = (list: string[], s: string): void => { if (list.length < 40 && !list.includes(s)) list.push(s); };
const events: Record<string, number> = {};
const sounds: Record<string, number> = {};
const arrived: Record<string, number> = {};
const notices: Record<string, number> = {};
const visited: string[] = [];
const levels: number[] = [];
let ticks = 0;
let kills = 0;
let deaths = 0;
let woke = false;
let errand = "";
let hash = "";
const started = Date.now();

/* ---- 4. load every logic module, with nothing to lean on ----------------------- */
async function loadAll(): Promise<void> {
  for (const f of logicFiles) {
    try { await import(pathToFileURL(f).href); }
    catch (e) { loadErrors.push(`${rel(f)}: ${(e as Error).message}`); }
  }
}

/* ---- 5. a session --------------------------------------------------------------- */
async function play(): Promise<void> {
  const S = (p: string): string => pathToFileURL(path.join(SRC, p)).href;
  const GM = await import(S("game.ts"));
  const TK = await import(S("tick/tick.ts"));
  const FX = await import(S("systems/fxEvents.ts"));
  const TG = await import(S("intents/target.ts"));
  const CAST = await import(S("intents/cast.ts"));
  const USE = await import(S("intents/use.ts"));
  const CT = await import(S("intents/containers.ts"));
  const GRD = await import(S("intents/ground.ts"));
  const TR = await import(S("intents/trade.ts"));
  const NP = await import(S("intents/npcs.ts"));
  const MI = await import(S("intents/missions.ts"));
  const PSt = await import(S("systems/playerState.ts"));
  const STN = await import(S("systems/stance.ts"));
  const CR = await import(S("systems/crystals.ts"));
  const CB = await import(S("systems/combat.ts"));
  const TW = await import(S("systems/tower.ts"));
  const TSK = await import(S("systems/tasks.ts"));
  const MS = await import(S("systems/missions.ts"));
  const IT = await import(S("items.ts"));
  const PL = await import(S("entities/player.ts"));
  const NPCS = await import(S("entities/npcs.ts"));
  const ENT = await import(S("world/entities.ts"));
  const GRID = await import(S("world/grid.ts"));
  const CFG = await import(S("config.ts"));
  type Game = import("../src/game.ts").Game;
  type World = import("../src/world/types.ts").World;
  type Target = import("../src/entities/player.ts").Target;
  type Ev = import("../src/systems/fxEvents.ts").FxEvent;
  type Kind = import("../src/items.ts").ItemKind;
  type Controls = import("../src/tick/controls.ts").TickControls;

  const T: number = CFG.TILE;
  const g: Game = GM.createGame();
  const p = g.player;
  const worlds = new Set<World>(Object.values(g.worlds));

  // A sturdy hunter with a sword and a shield on, a bow in the pack, and the
  // things a session spends: food, crystals, arrows and coin.
  p.level = 45;
  p.exp = 0;
  p.expNext = CFG.expNeeded(p.level);
  p.eq.weapon = "fireSword";
  p.eq.shield = "dragonShield";
  p.eq.body = "leatherBody";
  p.eq.legs = "leatherLegs";
  p.pack = IT.newContainer("backpack");
  for (const [k, n] of [["meat", 40], ["healCrystal", 60], ["fireEmberShard", 25], ["fireEmberBurst", 10],
    ["longbow", 1], ["arrow", 400]] as const) IT.addItem(p.bag, k as Kind, n);
  IT.giveGold(p.bag, 3000);
  TW.markAttuned("fire");
  PL.refreshDerived(p);
  p.hp = p.maxhp;
  p.fedS = 600;
  levels.push(p.level);

  /* What a player would see, counted and checked: every number finite, every
   * world a real one. */
  FX.onFx((e: Ev) => {
    events[e.fx] = (events[e.fx] ?? 0) + 1;
    if (e.fx === "sound") sounds[e.id] = (sounds[e.id] ?? 0) + 1;
    if (e.fx === "sound" && e.id === "kill") kills++;
    const at = e as unknown as { world?: World; x?: number; y?: number };
    if (at.world !== undefined && !worlds.has(at.world)) note(violations, `${e.fx} event names a world that is not one`);
    if (at.x !== undefined && (!Number.isFinite(at.x) || !Number.isFinite(at.y))) note(violations, `${e.fx} event at a non-number`);
  });

  /* The person at the controls: a steering hand, a box that is read for two
   * seconds, and what to do with whatever is walked up to. */
  let axis = { dx: 0, dy: 0 };
  let steerT = 0;
  let readT = 0;
  const near = <E extends { x: number; y: number }>(list: readonly E[], tiles: number): E[] =>
    list.filter((e) => Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) <= tiles * T);
  const pick = <E>(list: readonly E[]): E | undefined => list.length ? list[Math.floor(Math.random() * list.length)] : undefined;
  const steer = (secs: number): void => {
    axis = pick([{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: -1 }])!;
    steerT = secs;
  };

  const talkTo = (n: { key: string; name: string }): void => {
    const shop = NPCS.SHOPS[n.key as never] as { entries: { kind: Kind; buy: number; sell: number }[] } | undefined;
    if (shop) {
      const s = pick(shop.entries.filter((e) => e.sell > 0 && IT.bagCount(p.bag, e.kind) > 0));
      if (s) TR.sell(g, n as never, s.kind);
      const b = pick(shop.entries.filter((e) => e.buy > 0));
      if (b && Math.random() < 0.5) TR.buy(g, n as never, b.kind);
    } else if (n.key === "taskmaster") {
      const d = pick(TSK.TASKS.filter((x: { reqLevel: number }) => x.reqLevel <= p.level)) as { id: string } | undefined;
      if (d) { NP.turnInTask(g, d.id); if (!TSK.isActive(d.id)) NP.takeTask(g, d.id); }
    } else if (n.key === "timesage" && g.current.key === "cellar") {
      MI.talkToSage(g);
      const offer = MS.offeredMission(p.level);
      if (offer) MI.acceptMission(g, offer.id);
    }
  };

  const controls: Controls = {
    axis: () => axis,
    reading: () => readT > 0,
    arrive: (t: Target) => {
      arrived[t.kind] = (arrived[t.kind] ?? 0) + 1;
      if (t.kind === "corpse") CT.takeAllFrom(g, { c: "corpse", id: t.id });
      else if (t.kind === "ground") {
        const gi = ENT.groundById(g.current, t.id);
        if (gi && !IT.isContainer(gi.kind)) GRD.pickupGround(g, gi);
        else if (gi) CT.takeAllFrom(g, { c: "ground", id: t.id });
      } else if (t.kind === "npc") {
        const n = ENT.npcById(g.current, t.id);
        if (n) talkTo(n);
      } else if (t.kind === "structure") {
        const st = ENT.structureById(g.current, t.id, g.worlds.home);
        if (st?.key === "treasure") MI.openTreasure(g, st);
      }
    },
    notice: (n) => { notices[n.kind] = (notices[n.kind] ?? 0) + 1; readT = 2; },
  };

  /* One decision every half second, the way a player clicks: mostly hunting,
   * and in between everything else a player does. */
  const think = (): void => {
    if (p.dead) return;
    const w = g.current;
    if (p.hp < p.maxhp * 0.45 && IT.bagCount(p.bag, "healCrystal") > 0 && CR.crystalCooldownLeft("healCrystal") <= 0) {
      CAST.castCrystal(g, "healCrystal");
      return;
    }
    if (p.fedS < 60 && IT.bagCount(p.bag, "meat") > 0) USE.useItem(g, "meat");
    if (steerT > 0) return;
    const r = Math.random();
    const foe = p.target?.kind === "mob" ? ENT.monsterById(w, p.target.id) : undefined;
    if (foe && foe.hp > 0) {
      // in a fight: now and then a crystal, a change of weapon, a step aside
      if (r < 0.08 && IT.bagCount(p.bag, "fireEmberShard") > 0) CAST.castCrystal(g, "fireEmberShard", { x: foe.x, y: foe.y });
      else if (r < 0.10 && IT.bagCount(p.bag, "fireEmberBurst") > 0) CAST.castCrystal(g, "fireEmberBurst", { x: foe.x, y: foe.y });
      else if (r < 0.12) USE.swapWeapon(g);
      else if (r < 0.14) steer(0.4);
      return;
    }
    if (w.key === "cellar" && r < 0.25) {
      // the sage's room: take one of his pads — the lit ones lead to the errands
      const pad = pick(w.portals.filter((pt) => !pt.inactive));
      if (pad) { p.dest = { x: pad.x, y: pad.y }; p.target = null; }
      return;
    }
    const corpse = near(w.corpses, 6)[0];
    const loose = near(w.ground, 6)[0];
    if (r < 0.30 && corpse) TG.setTarget(g, { kind: "corpse", id: corpse.id }, false);
    else if (r < 0.40 && loose) TG.setTarget(g, { kind: "ground", id: loose.id }, false);
    else if (r < 0.48) {
      const n = pick(near(w.npcs, 16));
      if (n) TG.setTarget(g, { kind: "npc", id: n.id }, false);
    } else if (r < 0.52) {
      const tx = p.tx + Math.floor(Math.random() * 17) - 8;
      const ty = p.ty + Math.floor(Math.random() * 17) - 8;
      if (GRID.walkable(w, tx, ty)) { p.dest = { x: tx * T + T / 2, y: ty * T + T / 2 }; p.target = null; }
    } else if (r < 0.54) {
      const pad = pick(w.portals.filter((pt) => !pt.inactive));
      if (pad) { p.dest = { x: pad.x, y: pad.y }; p.target = null; }
    } else if (r < 0.57) steer(0.6 + Math.random());
    else if (r < 0.58) PSt.toggleChase();
    else if (r < 0.59) STN.cycleStance();
    else if (r < 0.61) USE.swapWeapon(g);
    else if (r < 0.62) {
      // lighten the pack: put one loose stack down where we stand
      const keep = ["healCrystal", "meat", "arrow", "longbow", "fireSword", "goldCoin", "platinumCoin",
        "fireEmberShard", "fireEmberBurst"];
      const s = pick(p.bag.map((st, i) => ({ st, i })).filter((x) => x.st && !IT.isContainer(x.st.kind) && !keep.includes(x.st.kind)));
      if (s) CT.dropFromContainer(g, { c: "bag" }, s.i, s.st!.n);
    } else if (TG.targetNearest(g) !== "marked") {
      // nothing in sight: go where the nearest living creature is
      let best: { x: number; y: number } | null = null;
      let bd = Infinity;
      for (const m of w.monsters) {
        if (m.hp <= 0) continue;
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        if (d < bd) { bd = d; best = m; }
      }
      if (best) { p.target = null; p.dest = { x: best.x, y: best.y }; }
    }
  };

  /* After every tick nothing in the world may stop being a number, leave its
   * map, or walk into a wall; and the pack holds only real things in real
   * amounts. */
  const check = (): void => {
    const w = g.current;
    if (!worlds.has(w)) note(violations, "the current world is not one of the game's");
    if (![p.x, p.y, p.hp, p.maxhp].every(Number.isFinite)) note(violations, `the player stopped being a number in ${w.key}`);
    if (p.hp > p.maxhp + 1e-6) note(violations, "the player's life is above its maximum");
    if (p.tx < 0 || p.ty < 0 || p.tx >= w.w || p.ty >= w.h) note(violations, `the player left the map of ${w.key}`);
    else if (!p.dead && w.solid[p.ty][p.tx]) note(violations, `the player stands inside a wall in ${w.key} at ${p.tx},${p.ty}`);
    for (const m of w.monsters) {
      if (![m.x, m.y, m.hp].every(Number.isFinite)) note(violations, `a ${m.kind} stopped being a number in ${w.key}`);
      if (m.hp > m.maxhp + 1e-6) note(violations, `a ${m.kind} has more life than its maximum`);
      if (m.tx < 0 || m.ty < 0 || m.tx >= w.w || m.ty >= w.h) note(violations, `a ${m.kind} left the map of ${w.key}`);
    }
  };
  const checkPack = (): void => {
    const walk = (bag: readonly ({ kind: Kind; n: number; items?: unknown } | null)[]): void => {
      for (const st of bag) {
        if (!st) continue;
        const def = IT.ITEMS[st.kind];
        if (!def) { note(violations, `an item that does not exist: ${st.kind}`); continue; }
        if (!(st.n >= 1) || st.n > def.stack) note(violations, `a stack of ${st.kind} counts ${st.n}`);
        if (Array.isArray(st.items)) walk(st.items as never);
      }
    };
    walk(p.bag);
  };

  /** One tick of the game, as the server will run it, and the checks after it. */
  let wasDead = false;
  const step = (brain: boolean): void => {
    if (brain && ticks % 10 === 0) think();
    if (steerT > 0) { steerT -= DT; if (steerT <= 0) axis = { dx: 0, dy: 0 }; }
    if (readT > 0) readT -= DT;
    clockMs += DT * 1000;
    TK.tickGame(g, DT, controls);
    ticks++;
    if (p.dead && !wasDead) deaths++;
    wasDead = p.dead;
    check();
    if (ticks % 20 === 0) checkPack();
  };

  /* The route. First the sage's errand: take it in the cellar, walk onto the
   * pad it lights, read its chronicle, go down. Then a minute at a time on a
   * map drawn from the hunting grounds, the town and the safe rooms, reached
   * the way a pad reaches them. Last, a death and the wake-up at home. */
  GM.travelTo(g, "cellar");
  visited.push(g.current.key);
  const sage = g.current.npcs.find((n) => n.key === "timesage");
  if (sage) TG.setTarget(g, { kind: "npc", id: sage.id }, false);
  while (ticks < 400 && !arrived.npc) step(false);
  const taken = MS.currentMission(p.level);
  errand = taken ? `${taken.id}:${MS.stageOf(taken.id, p.level)}` : "";
  const lit = taken && g.current.portals.find((pt) => pt.dest === taken.ground && !pt.inactive);
  if (lit) {
    p.dest = { x: lit.x, y: lit.y };
    const until = ticks + 600;
    while (ticks < until && g.current.key === "cellar") step(false);
    visited.push(g.current.key);
  }
  const ROUTE = ["reach", "town", "bandit", "orcdeep1", "minodeep1", "goblindeep1", "deaddeep1",
    "banditdeep1", "cellar", "home", "liddesdale", "orcIsle"].filter((k) => k in g.worlds);
  const total = Math.round((MINUTES * 60) / DT);
  const stay = Math.round(60 / DT);
  let stayed = 0;
  while (ticks < total) {
    if (++stayed > stay) {
      stayed = 1;
      const dest = pick(ROUTE)!;
      if (!p.dead && g.current.key !== dest) GM.travelTo(g, dest);
      visited.push(g.current.key);
    }
    step(true);
  }
  if (!p.dead) CB.hurtPlayer(g.current, p, p.hp + 1000, true);
  const wake = ticks + Math.round(5 / DT);
  while (ticks < wake) step(false);
  woke = !p.dead && g.current === g.worlds.home && p.hp === p.maxhp;
  levels.push(p.level);

  /* Where the session ended, boiled down to eight hex digits. */
  const snapshot = JSON.stringify({
    at: g.current.key, x: Math.round(p.x * 1000), y: Math.round(p.y * 1000), hp: Math.round(p.hp * 1000),
    level: p.level, exp: p.exp, eq: p.eq, bag: p.bag,
    worlds: [...worlds].map((w) => [w.key, w.monsters.map((m) => [m.kind, m.tx, m.ty, Math.round(m.hp)]),
      w.corpses.length, w.ground.length]),
    events, kills, deaths, arrived, notices, errand,
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < snapshot.length; i++) { h ^= snapshot.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  hash = (h >>> 0).toString(16).padStart(8, "0");
}

/* ---- 6. the report ---------------------------------------------------------------- */
try {
  await loadAll();
  await play();
} catch (e) {
  errors.push(`${(e as Error).stack ?? e}`.split("\n").slice(0, 6).join(" | "));
}
const report = {
  seed: SEED, minutes: MINUTES, dt: DT, ticks, ms: Date.now() - started,
  logicModules: logicFiles.length, loaded: logicFiles.length - loadErrors.length,
  outside, bare, viteOnly, timers, untrapped, touched: Object.fromEntries(touched), loadErrors, errors, violations,
  events, sounds, arrived, notices, kills, deaths, woke, levels, errand, visited, hash,
};
const bad = outside.length + bare.length + viteOnly.length + timers.length + untrapped.length + touched.size
  + loadErrors.length + errors.length + violations.length;
console.log(JSON.stringify(report));
process.exit(bad ? 1 : 0);
