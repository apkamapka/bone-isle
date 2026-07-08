import "./style.css";
import { VIEW_W, VIEW_H, TILE, GARDEN_RADIUS, GARDEN_HEAL_PER_S, MANA_REGEN_PER_S } from "./config.ts";
import { moveEntity } from "./world/collision.ts";
import { SPR } from "./gfx/sprites.ts";
import { clamp, dist, rndi } from "./util.ts";
import { playerSpeed, refreshDerived } from "./entities/player.ts";
import { updateMonsters, MONSTER_DEFS, spawnMonster } from "./entities/monsters.ts";
import { playerAttack, hitDummy, hurtPlayer, grantExp } from "./systems/combat.ts";
import { gatherTick, tickRegrowth } from "./systems/gather.ts";
import { tryPlace, structSprite, STRUCTS } from "./systems/building.ts";
import { castSpell } from "./systems/magic.ts";
import { quests, claimQuest, syncCollectQuests } from "./systems/quests.ts";
import { addItem, removeItem, ITEMS } from "./items.ts";
import { addFloat, updateFloats, drawFloats } from "./fx.ts";
import { unlockAudio, beep } from "./audio.ts";
import { initInput, moveAxis } from "./input.ts";
import { initTouch, drawJoystick, isTouchDevice } from "./ui/touch.ts";
import { createGame, travelTo, respawnAtHome, type Game } from "./game.ts";
import { saveGame, loadGame } from "./save.ts";
import { drawHud, type HudCtx } from "./ui/hud.ts";
import { drawPanels, type UiState, type Hotspot, type PanelActions, type PanelKind } from "./ui/panels.ts";
import type { Vec, World, Corpse } from "./world/types.ts";
import type { EqSlot, ItemKind, Recipe } from "./items.ts";
import type { StructKey } from "./systems/building.ts";

/* ------------------------------------------------------------------
   The full modular prototype: three islands, combat, corpses & loot,
   NPC shops, crafting, spells, quests, mobile controls, and saves.
   ------------------------------------------------------------------ */

const screen = document.createElement("canvas");
screen.style.imageRendering = "pixelated";
document.body.appendChild(screen);
const sctx = screen.getContext("2d")!;

const view = document.createElement("canvas");
view.width = VIEW_W;
view.height = VIEW_H;
const vctx = view.getContext("2d")!;

let scale = 2;
function resize(): void {
  scale = Math.max(1, Math.floor(Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H)));
  screen.width = VIEW_W * scale;
  screen.height = VIEW_H * scale;
  sctx.imageSmoothingEnabled = false;
}
addEventListener("resize", resize);
resize();

const game: Game = loadGame() ?? createGame();
refreshDerived(game.player);
const P = game.player;
const cam = { x: 0, y: 0 };
let moveMarker: { x: number; y: number; t: number } | null = null;
let waveT = 0;
let saveTimer = 0;
let last = performance.now();

const ui: UiState = { panel: null, placing: null, selSlot: null, loot: null, npc: null, shopTab: "buy", panelRect: null };
const mouse = { sx: 0, sy: 0 };
let hotspots: Hotspot[] = [];

const cw = (): World => game.current;
const flash = (t: string, c = "#ffe9a8"): void => addFloat(cw(), P.x, P.y - 30, t, c);

function togglePanel(which: PanelKind): void {
  ui.placing = null;
  ui.loot = null;
  ui.npc = null;
  ui.panel = ui.panel === which ? null : which;
}

/* ---------------- panel actions ---------------- */

const act: PanelActions = {
  startPlacing: (key: StructKey) => { ui.placing = key; ui.panel = null; },
  useItem: (kind: ItemKind) => {
    const def = ITEMS[kind];
    if (!removeItem(P.bag, kind, 1)) return;
    if (def.heal) { P.hp = Math.min(P.maxhp, P.hp + def.heal); flash(`+${def.heal} hp`, "#7dff9e"); }
    if (def.mana) { P.mana = Math.min(P.maxmana, P.mana + def.mana); flash(`+${def.mana} mp`, "#8ab6ff"); }
    beep(500, 0.12, "sine", 0.05, 180);
  },
  equipItem: (kind: ItemKind) => {
    const slot = ITEMS[kind].slot;
    if (!slot) return;
    if (!removeItem(P.bag, kind, 1)) return;
    const prev = P.eq[slot];
    P.eq[slot] = kind;
    if (prev) addItem(P.bag, prev, 1);
    refreshDerived(P);
    beep(420, 0.1, "triangle", 0.05);
  },
  unequip: (slot: EqSlot) => {
    const cur = P.eq[slot];
    if (!cur) return;
    if (addItem(P.bag, cur, 1) > 0) { flash("bag full"); return; }
    P.eq[slot] = null;
    refreshDerived(P);
    beep(300, 0.08, "triangle", 0.05);
  },
  craft: (r: Recipe) => {
    // craft requires standing at a Forge; enforced by only opening forge there
    if (craftAt(r)) beep(360, 0.14, "square", 0.05);
  },
  castSpell: (i: number) => { doSpell(i); },
  takeLoot: (c: Corpse, index: number) => { takeOne(c, index); },
  takeAllLoot: (c: Corpse) => { takeAll(c); },
  buy: (kind: ItemKind) => { doBuy(kind); },
  sell: (kind: ItemKind) => { doSell(kind); },
  claim: (id: string) => {
    const q = quests.find((x) => x.id === id);
    if (q && claimQuest(P, q, (t) => flash(t, "#ffe9a8"))) beep(560, 0.16, "square", 0.06);
  },
};

import { craft as craftRecipe } from "./items.ts";
function craftAt(r: Recipe): boolean {
  if (craftRecipe(P.bag, r)) {
    flash(`crafted ${ITEMS[r.out].name}`, "#b9e07f");
    return true;
  }
  return false;
}

function doSpell(index: number): void {
  const spellKeys = ["heal", "firebolt"] as const;
  const key = spellKeys[index];
  if (!key) return;
  castSpell(cw(), P, key);
}

function takeOne(c: Corpse, index: number): void {
  const it = c.items[index];
  if (!it) return;
  const left = addItem(P.bag, it.kind, it.n);
  const took = it.n - left;
  if (took > 0) {
    syncCollectQuests(P, (t) => flash(t, "#ffe9a8"));
    if (left > 0) it.n = left;
    else c.items.splice(index, 1);
  } else {
    flash("bag full");
  }
  closeCorpseIfEmpty(c);
}

function takeAll(c: Corpse): void {
  if (c.gold > 0) { P.gold += c.gold; c.gold = 0; }
  for (let i = c.items.length - 1; i >= 0; i--) {
    const it = c.items[i];
    const left = addItem(P.bag, it.kind, it.n);
    if (left > 0) { it.n = left; break; }
    c.items.splice(i, 1);
  }
  syncCollectQuests(P, (t) => flash(t, "#ffe9a8"));
  closeCorpseIfEmpty(c);
}

function closeCorpseIfEmpty(c: Corpse): void {
  if (c.items.length === 0 && c.gold === 0) {
    const w = cw();
    const idx = w.corpses.indexOf(c);
    if (idx >= 0) w.corpses.splice(idx, 1);
    ui.loot = null;
    if (ui.panel === "loot") ui.panel = null;
  }
}

import { SHOPS } from "./entities/npcs.ts";
function doBuy(kind: ItemKind): void {
  if (!ui.npc) return;
  const entry = SHOPS[ui.npc.key].entries.find((e) => e.kind === kind);
  if (!entry || entry.buy <= 0 || P.gold < entry.buy) return;
  if (addItem(P.bag, kind, 1) > 0) { flash("bag full"); return; }
  P.gold -= entry.buy;
  beep(440, 0.1, "sine", 0.05);
}
function doSell(kind: ItemKind): void {
  if (!ui.npc) return;
  const entry = SHOPS[ui.npc.key].entries.find((e) => e.kind === kind);
  if (!entry || entry.sell <= 0) return;
  if (!removeItem(P.bag, kind, 1)) return;
  P.gold += entry.sell;
  beep(360, 0.1, "sine", 0.05);
}

/* ---------------- input wiring ---------------- */

function handleWorldTap(sx: number, sy: number): void {
  unlockAudio();
  for (const hsp of hotspots) {
    if (sx >= hsp.x && sx < hsp.x + hsp.w && sy >= hsp.y && sy < hsp.y + hsp.h) {
      hsp.fn();
      return;
    }
  }
  const pr = ui.panelRect;
  if (ui.panel && pr && sx >= pr.x && sx < pr.x + pr.w && sy >= pr.y && sy < pr.y + pr.h) return;
  // tapping outside an open panel closes it
  if (ui.panel && ui.panel !== "loot" && ui.panel !== "shop") { ui.panel = null; return; }
  const w: Vec = { x: sx / scale + cam.x, y: sy / scale + cam.y };
  if (ui.placing) {
    if (cw() === game.worlds.home) tryPlace(game.worlds.home, P, ui.placing, w.x, w.y);
    ui.placing = null;
    return;
  }
  worldClick(w);
}

initInput(screen, {
  toWorld: (sx, sy): Vec => ({ x: sx / scale + cam.x, y: sy / scale + cam.y }),
  onMove: (sx, sy) => { mouse.sx = sx; mouse.sy = sy; },
  onPanel: togglePanel,
  onSpell: (i) => doSpell(i),
  onEscape: () => { ui.panel = null; ui.placing = null; ui.loot = null; ui.npc = null; },
  onClick: ({ sx, sy }) => handleWorldTap(sx, sy),
});
if (isTouchDevice()) initTouch(screen, handleWorldTap);

function worldClick(w: Vec): void {
  if (P.dead) return;
  const world = cw();
  // monsters
  for (const m of world.monsters) {
    if (Math.abs(w.x - m.x) < 9 && w.y > m.y - 16 && w.y < m.y + 5) {
      P.target = { kind: "mob", m };
      P.dest = null; P.gather = null; moveMarker = null;
      return;
    }
  }
  // corpses
  for (const c of world.corpses) {
    if (Math.abs(w.x - c.x) < 10 && Math.abs(w.y - c.y) < 8) {
      P.target = { kind: "corpse", c };
      P.dest = null; P.gather = null; moveMarker = null;
      return;
    }
  }
  // NPCs
  for (const n of world.npcs) {
    if (Math.abs(w.x - n.x) < 9 && w.y > n.y - 16 && w.y < n.y + 5) {
      P.target = { kind: "npc", n };
      P.dest = null; P.gather = null; moveMarker = null;
      return;
    }
  }
  // structures (dummy to hit, forge/library to use)
  for (const s of world.structures) {
    const cx = s.tx * TILE + TILE / 2;
    const cy = s.ty * TILE + TILE;
    if (Math.abs(w.x - cx) < 12 && w.y > cy - 24 && w.y < cy + 4) {
      if (s.key === "dummy") P.target = { kind: "dummy", s };
      else P.target = { kind: "structure", s };
      P.dest = null; P.gather = null; moveMarker = null;
      return;
    }
  }
  // trees
  for (const tr of world.trees) {
    if (tr.stump) continue;
    const cx = tr.tx * TILE + TILE / 2;
    if (Math.abs(w.x - cx) < 8 && w.y > tr.ty * TILE + TILE - 27 && w.y < tr.ty * TILE + TILE + 2) {
      P.gather = { kind: "tree", obj: tr };
      P.target = null; P.dest = null; moveMarker = null;
      return;
    }
  }
  // rocks
  for (const rk of world.rocks) {
    if (rk.depleted) continue;
    const cx = rk.tx * TILE + TILE / 2;
    const cy = rk.ty * TILE + TILE / 2;
    if (Math.abs(w.x - cx) < 8 && Math.abs(w.y - cy) < 8) {
      P.gather = { kind: "rock", obj: rk };
      P.target = null; P.dest = null; moveMarker = null;
      return;
    }
  }
  // herbs
  for (const hb of world.herbs) {
    if (hb.picked) continue;
    const cx = hb.tx * TILE + TILE / 2;
    const cy = hb.ty * TILE + TILE / 2;
    if (Math.abs(w.x - cx) < 8 && Math.abs(w.y - cy) < 8) {
      P.gather = { kind: "herb", obj: hb };
      P.target = null; P.dest = null; moveMarker = null;
      return;
    }
  }
  // otherwise: walk there
  P.dest = { x: w.x, y: w.y };
  P.target = null; P.gather = null;
  moveMarker = { x: w.x, y: w.y, t: 0.5 };
}

/* ---------------- interaction ranges ---------------- */

function targetPoint(): Vec | null {
  const t = P.target;
  if (!t) return null;
  if (t.kind === "mob") return { x: t.m.x, y: t.m.y };
  if (t.kind === "corpse") return { x: t.c.x, y: t.c.y };
  if (t.kind === "npc") return { x: t.n.x, y: t.n.y };
  return { x: t.s.tx * TILE + TILE / 2, y: t.s.ty * TILE + TILE / 2 };
}

function gatherPoint(): Vec | null {
  const g = P.gather;
  if (!g) return null;
  const o = g.obj;
  return { x: o.tx * TILE + TILE / 2, y: o.ty * TILE + TILE / 2 };
}

/* ---------------- update ---------------- */

function checkPortals(): void {
  if (P.tpCd > 0) return;
  for (const pt of cw().portals) {
    if (dist(P.x, P.y, pt.x, pt.y) < 11) {
      travelTo(game, pt.dest);
      return;
    }
  }
}

function update(dt: number): void {
  const world = cw();
  waveT += dt;
  P.tpCd = Math.max(0, P.tpCd - dt);
  P.atkCd = Math.max(0, P.atkCd - dt);
  P.bob += dt;
  P.mana = Math.min(P.maxmana, P.mana + MANA_REGEN_PER_S * dt);

  // death → respawn countdown
  if (P.dead) {
    P.deadT -= dt;
    if (P.deadT <= 0) respawnAtHome(game);
    updateFloats(dt);
    return;
  }

  // movement: WASD/joystick overrides auto-actions
  const ax = moveAxis();
  if (ax.dx || ax.dy) {
    P.dest = null; P.target = null; P.gather = null;
    const len = Math.hypot(ax.dx, ax.dy) || 1;
    const sp = playerSpeed(P);
    moveEntity(world, P, (ax.dx / len) * sp * dt, (ax.dy / len) * sp * dt);
    if (ax.dx) P.face = ax.dx < 0 ? -1 : 1;
  } else if (P.dest) {
    const d = dist(P.x, P.y, P.dest.x, P.dest.y);
    if (d < 3) P.dest = null;
    else {
      const sp = playerSpeed(P);
      moveEntity(world, P, ((P.dest.x - P.x) / d) * sp * dt, ((P.dest.y - P.y) / d) * sp * dt);
      if (P.dest.x < P.x) P.face = -1; else P.face = 1;
    }
  } else if (P.target) {
    const tp = targetPoint();
    if (tp) {
      const d = dist(P.x, P.y, tp.x, tp.y);
      const reach = P.target.kind === "mob" || P.target.kind === "dummy" ? 15 : 18;
      if (d > reach) {
        const sp = playerSpeed(P);
        moveEntity(world, P, ((tp.x - P.x) / d) * sp * dt, ((tp.y - P.y) / d) * sp * dt);
        if (tp.x < P.x) P.face = -1; else P.face = 1;
      } else {
        resolveTarget();
      }
    }
  } else if (P.gather) {
    const gp = gatherPoint();
    if (gp) {
      const d = dist(P.x, P.y, gp.x, gp.y);
      if (d > 17) {
        const sp = playerSpeed(P);
        moveEntity(world, P, ((gp.x - P.x) / d) * sp * dt, ((gp.y - P.y) / d) * sp * dt);
        if (gp.x < P.x) P.face = -1; else P.face = 1;
      } else if (P.atkCd <= 0 && P.gather) {
        gatherTick(world, P, P.gather, (t) => flash(t, "#ffe9a8"));
      }
    }
  }

  // monsters attack the player (only on dangerous islands)
  if (!world.safe) {
    updateMonsters(world, dt, { x: P.x, y: P.y, dead: P.dead }, (m) => {
      const d = MONSTER_DEFS[m.kind];
      hurtPlayer(world, P, rndi(d.dmg[0], d.dmg[1]));
    });
    // respawns
    for (let i = world.respawns.length - 1; i >= 0; i--) {
      const r = world.respawns[i];
      r.t -= dt;
      if (r.t <= 0) { spawnMonster(world, r.kind); world.respawns.splice(i, 1); }
    }
  }

  // corpse decay
  for (let i = world.corpses.length - 1; i >= 0; i--) {
    world.corpses[i].t -= dt;
    if (world.corpses[i].t <= 0) {
      if (ui.loot === world.corpses[i]) { ui.loot = null; if (ui.panel === "loot") ui.panel = null; }
      world.corpses.splice(i, 1);
    }
  }

  // garden aura heal on home
  for (const s of game.worlds.home.structures) {
    if (s.key === "garden" && cw() === game.worlds.home) {
      const gx = s.tx * TILE + TILE;
      const gy = s.ty * TILE + TILE;
      if (dist(P.x, P.y, gx, gy) < GARDEN_RADIUS && P.hp < P.maxhp) {
        P.hp = Math.min(P.maxhp, P.hp + GARDEN_HEAL_PER_S * dt);
      }
    }
  }
  // structure anim
  for (const s of world.structures) { s.anim = (s.anim ?? 0) + dt; if (s.hurtT) s.hurtT = Math.max(0, s.hurtT - dt); }

  tickRegrowth(world, dt, P.x, P.y, true);
  checkPortals();
  updateFloats(dt);
  if (moveMarker) { moveMarker.t -= dt; if (moveMarker.t <= 0) moveMarker = null; }

  // autosave every 5s
  saveTimer += dt;
  if (saveTimer > 5) { saveTimer = 0; saveGame(game); }
}

function resolveTarget(): void {
  const t = P.target;
  if (!t) return;
  if (t.kind === "mob") {
    if (P.atkCd <= 0) { P.atkCd = P.atkRate; if (playerAttack(cw(), P, t.m)) P.target = null; }
  } else if (t.kind === "dummy") {
    if (P.atkCd <= 0) { P.atkCd = P.atkRate; hitDummy(cw(), P, t.s); }
  } else if (t.kind === "corpse") {
    ui.loot = t.c; ui.panel = "loot"; P.target = null;
  } else if (t.kind === "npc") {
    ui.npc = t.n; ui.shopTab = "buy"; ui.panel = "shop"; P.target = null;
  } else if (t.kind === "structure") {
    if (t.s.key === "forge") { ui.panel = "forge"; }
    else if (t.s.key === "library") { ui.panel = "spell"; }
    P.target = null;
  }
}

/* ---------------- render ---------------- */

function drawShadow(x: number, y: number, w = 8): void {
  vctx.fillStyle = "rgba(0,0,0,.22)";
  vctx.beginPath();
  vctx.ellipse(x - cam.x, y - cam.y + 1, w, w * 0.4, 0, 0, 6.2832);
  vctx.fill();
}

function drawSprite(spr: HTMLCanvasElement, x: number, y: number, face = 1, bobY = 0): void {
  const dx = Math.round(x - cam.x - spr.width / 2);
  const dy = Math.round(y - cam.y - spr.height + bobY);
  vctx.save();
  if (face < 0) {
    vctx.translate(dx + spr.width, dy);
    vctx.scale(-1, 1);
    vctx.drawImage(spr, 0, 0);
  } else {
    vctx.drawImage(spr, dx, dy);
  }
  vctx.restore();
}

function hpBar(x: number, y: number, frac: number, w = 14): void {
  vctx.fillStyle = "#000";
  vctx.fillRect(Math.round(x - cam.x - w / 2) - 1, Math.round(y - cam.y) - 1, w + 2, 4);
  vctx.fillStyle = "#5d1a14";
  vctx.fillRect(Math.round(x - cam.x - w / 2), Math.round(y - cam.y), w, 2);
  vctx.fillStyle = "#e1483b";
  vctx.fillRect(Math.round(x - cam.x - w / 2), Math.round(y - cam.y), Math.round(w * clamp(frac, 0, 1)), 2);
}

function render(): void {
  const world = cw();
  // camera follows player, clamped to island
  cam.x = clamp(P.x - VIEW_W / 2, 0, Math.max(0, world.w * TILE - VIEW_W));
  cam.y = clamp(P.y - VIEW_H / 2, 0, Math.max(0, world.h * TILE - VIEW_H));

  vctx.fillStyle = "#1c6060";
  vctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // baked terrain
  vctx.drawImage(world.mapCanvas, -Math.round(cam.x), -Math.round(cam.y));

  // animated coastal foam
  vctx.fillStyle = "rgba(200,240,235,.5)";
  for (const cwv of world.coastWater) {
    const sx = cwv.x - cam.x;
    const sy = cwv.y - cam.y;
    if (sx < -TILE || sy < -TILE || sx > VIEW_W || sy > VIEW_H) continue;
    const a = 0.5 + 0.5 * Math.sin(waveT * 2 + cwv.ph);
    if (a > 0.6) vctx.fillRect(Math.round(sx + 2), Math.round(sy + 6), 6, 1);
  }

  // build pads (home) glow
  if (world === game.worlds.home) {
    for (const b of world.buildSpots) {
      if (b.built) continue;
      const gx = b.tx * TILE - cam.x;
      const gy = b.ty * TILE - cam.y;
      const a = 0.35 + 0.2 * Math.sin(waveT * 3);
      vctx.fillStyle = `rgba(255,220,120,${a})`;
      vctx.fillRect(gx, gy, TILE * 2, TILE * 2);
      vctx.strokeStyle = "rgba(255,235,160,.8)";
      vctx.strokeRect(gx + 0.5, gy + 0.5, TILE * 2 - 1, TILE * 2 - 1);
    }
  }

  // portals (glowing swirl)
  for (const pt of world.portals) {
    const sx = pt.x - cam.x;
    const sy = pt.y - cam.y;
    for (let r = 8; r > 0; r -= 2) {
      const a = 0.15 + 0.12 * Math.sin(waveT * 4 + r);
      vctx.fillStyle = `rgba(150,110,230,${a})`;
      vctx.beginPath();
      vctx.ellipse(sx, sy, r, r * 0.6, 0, 0, 6.2832);
      vctx.fill();
    }
    vctx.fillStyle = "#c9a6ff";
    vctx.fillRect(Math.round(sx) - 1, Math.round(sy - 4 + Math.sin(waveT * 5) * 2), 2, 8);
  }

  // gather nodes: trees, rocks, herbs (sorted by y with actors below)
  type Drawable = { y: number; fn: () => void };
  const drawList: Drawable[] = [];

  for (const tr of world.trees) {
    const bx = tr.tx * TILE + TILE / 2;
    const by = tr.ty * TILE + TILE;
    if (tr.stump) {
      drawList.push({ y: by, fn: () => { drawShadow(bx, by); drawSprite(SPR.stump, bx, by); } });
    } else {
      drawList.push({ y: by, fn: () => {
        drawShadow(bx, by, 6);
        const shake = tr.hurtT > 0 ? Math.round(Math.sin(tr.hurtT * 40) * 1.5) : 0;
        drawSprite(tr.spr, bx + shake, by);
        if (tr.hp < tr.maxhp) hpBar(bx, tr.ty * TILE - 4, tr.hp / tr.maxhp);
      } });
    }
  }
  for (const rk of world.rocks) {
    const bx = rk.tx * TILE + TILE / 2;
    const by = rk.ty * TILE + TILE;
    if (rk.depleted) {
      drawList.push({ y: by, fn: () => { drawShadow(bx, by); drawSprite(SPR.rubble, bx, by); } });
    } else {
      drawList.push({ y: by, fn: () => {
        drawShadow(bx, by);
        const shake = rk.hurtT > 0 ? Math.round(Math.sin(rk.hurtT * 40) * 1.5) : 0;
        drawSprite(SPR.rock, bx + shake, by);
        if (rk.hp < rk.maxhp) hpBar(bx, rk.ty * TILE - 2, rk.hp / rk.maxhp);
      } });
    }
  }
  for (const hb of world.herbs) {
    if (hb.picked) continue;
    const bx = hb.tx * TILE + TILE / 2;
    const by = hb.ty * TILE + TILE;
    drawList.push({ y: by, fn: () => drawSprite(SPR.herb, bx, by) });
  }
  // structures
  for (const s of world.structures) {
    const spr = structSprite(s.key);
    const bx = s.tx * TILE + TILE;
    const by = s.ty * TILE + TILE * 2;
    drawList.push({ y: by, fn: () => {
      drawShadow(bx, by, spr.width / 2);
      const shake = s.hurtT ? Math.round(Math.sin(s.hurtT * 40) * 1.5) : 0;
      drawSprite(spr, bx + shake, by);
      if (s.key === "forge") {
        vctx.fillStyle = `rgba(255,${140 + Math.round(Math.sin(waveT * 8) * 40)},60,.8)`;
        vctx.fillRect(Math.round(bx - cam.x - 2), Math.round(by - cam.y - 6 + Math.sin(waveT * 6)), 2, 2);
      }
    } });
  }
  // corpses
  for (const c of world.corpses) {
    const blink = c.t < 10 ? (Math.sin(waveT * 8) > 0 ? 1 : 0.4) : 1;
    drawList.push({ y: c.y, fn: () => {
      vctx.globalAlpha = blink;
      drawShadow(c.x, c.y);
      drawSprite(SPR.corpse, c.x, c.y + 4);
      vctx.globalAlpha = 1;
    } });
  }
  // NPCs
  for (const n of world.npcs) {
    const bob = Math.sin(waveT * 2 + n.bob) * 1.2;
    drawList.push({ y: n.y, fn: () => {
      drawShadow(n.x, n.y);
      drawSprite(n.spr, n.x, n.y, 1, bob);
      // name tag
      vctx.font = "bold 6px monospace";
      vctx.textAlign = "center";
      vctx.fillStyle = "#000";
      vctx.fillText("!", Math.round(n.x - cam.x) + 1, Math.round(n.y - cam.y - n.spr.height - 3) + 1);
      vctx.fillStyle = "#ffe9a8";
      vctx.fillText("!", Math.round(n.x - cam.x), Math.round(n.y - cam.y - n.spr.height - 3));
    } });
  }
  // monsters
  for (const m of world.monsters) {
    const bob = Math.sin(m.bob) * 1.5;
    drawList.push({ y: m.y, fn: () => {
      drawShadow(m.x, m.y);
      vctx.globalAlpha = m.hurtT > 0 && Math.sin(m.hurtT * 60) > 0 ? 0.5 : 1;
      drawSprite(m.spr, m.x, m.y, 1, bob);
      vctx.globalAlpha = 1;
      hpBar(m.x, m.y - m.spr.height - 4, m.hp / m.maxhp);
    } });
  }
  // player
  const pbob = (P.dest || P.target || P.gather || moveAxisNonZero()) ? Math.sin(P.bob * 10) * 1.2 : 0;
  drawList.push({ y: P.y, fn: () => {
    drawShadow(P.x, P.y);
    vctx.globalAlpha = P.dead ? 0.4 : 1;
    drawSprite(P.spr, P.x, P.y, P.face, pbob);
    vctx.globalAlpha = 1;
  } });

  drawList.sort((a, b) => a.y - b.y);
  for (const d of drawList) d.fn();

  // target reticle
  if (P.target && (P.target.kind === "mob" || P.target.kind === "dummy")) {
    const tp = targetPoint();
    if (tp) {
      const sx = Math.round(tp.x - cam.x);
      const sy = Math.round(tp.y - cam.y);
      vctx.strokeStyle = "#ff5a4a";
      vctx.lineWidth = 1;
      const s = 9;
      for (const [ox, oy, dx, dy] of [[-s, -s, 3, 0], [-s, -s, 0, 3], [s, -s, -3, 0], [s, -s, 0, 3], [-s, s, 3, 0], [-s, s, 0, -3], [s, s, -3, 0], [s, s, 0, -3]] as const) {
        vctx.beginPath();
        vctx.moveTo(sx + ox, sy + oy);
        vctx.lineTo(sx + ox + dx, sy + oy + dy);
        vctx.stroke();
      }
    }
  }
  // gather marker
  if (P.gather) {
    const gp = gatherPoint();
    if (gp) {
      vctx.strokeStyle = "#8ce06a";
      vctx.strokeRect(Math.round(gp.x - cam.x) - 8, Math.round(gp.y - cam.y) - 8, 16, 16);
    }
  }
  // move marker
  if (moveMarker) {
    const a = moveMarker.t / 0.5;
    vctx.strokeStyle = `rgba(255,255,255,${a})`;
    const r = (1 - a) * 6 + 2;
    vctx.beginPath();
    vctx.arc(moveMarker.x - cam.x, moveMarker.y - cam.y, r, 0, 6.2832);
    vctx.stroke();
  }

  // floating text
  drawFloats(vctx, world, cam.x, cam.y);

  // teleport flash
  if (game.tpFlash > 0) {
    vctx.fillStyle = `rgba(255,255,255,${game.tpFlash})`;
    vctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // scale up to screen
  sctx.drawImage(view, 0, 0, VIEW_W, VIEW_H, 0, 0, screen.width, screen.height);

  // HUD + panels (screen space)
  const hud: HudCtx = { ctx: sctx, scale, screenW: screen.width, screenH: screen.height };
  drawHud(hud, game, P);
  hotspots = [];
  ui.panelRect = null;
  drawPanels({ hud, ui, game, player: P, mouse, act, hotspots });
  drawJoystick(sctx);
}

function moveAxisNonZero(): boolean {
  const a = moveAxis();
  return a.dx !== 0 || a.dy !== 0;
}

/* ---------------- main loop ---------------- */

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  if (game.tpFlash > 0) game.tpFlash = Math.max(0, game.tpFlash - dt * 2.2);
  if (game.zoneFlash.t > 0) game.zoneFlash.t -= dt;
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

addEventListener("beforeunload", () => saveGame(game));

// silence unused-import complaints for values referenced only in types/paths
void STRUCTS;
void grantExp;
