/** All toggleable UI panels. Each draws itself and pushes clickable hotspots. */
import { SPR, itemSprite } from "../gfx/sprites.ts";
import { skills, skillNeed, attackPower, defensePower, magicPower } from "../systems/skills.ts";
import { STRUCTS, STRUCT_KEYS, canAfford, costText } from "../systems/building.ts";
import { SPELLS, spellsUnlocked } from "../systems/magic.ts";
import { ITEMS, EQ_SLOT_KEYS, RECIPES, canCraft, recipeCostText, bagCount } from "../items.ts";
import { quests } from "../systems/quests.ts";
import { SHOPS } from "../entities/npcs.ts";
import { hudText, type HudCtx } from "./hud.ts";
import type { Player } from "../entities/player.ts";
import type { StructKey } from "../systems/building.ts";
import type { EqSlot, ItemKind, Recipe } from "../items.ts";
import type { Corpse, Npc } from "../world/types.ts";
import type { Game } from "../game.ts";

export type PanelKind =
  | "build" | "skills" | "equip" | "bag" | "quest"
  | "forge" | "spell" | "loot" | "shop" | "stash";

export interface Hotspot {
  x: number;
  y: number;
  w: number;
  h: number;
  fn: () => void;
}

/** One open, draggable window. Multiple can be open at once (z-order = array order). */
export interface PanelWindow {
  kind: PanelKind;
  /** User drag offset from the panel's default anchor. */
  offset: { x: number; y: number };
  /** Panel body rect this frame (screen px); set during draw. */
  rect: { x: number; y: number; w: number; h: number } | null;
  /** Draggable title-bar hitbox this frame (screen px); set during draw. */
  titleBar: { x: number; y: number; w: number; h: number } | null;
}

export interface UiState {
  /** Open windows, back-to-front. The last one is drawn on top and grabs input first. */
  windows: PanelWindow[];
  placing: StructKey | null;
  selSlot: EqSlot | null;
  loot: Corpse | null;
  npc: Npc | null;
  shopTab: "buy" | "sell";
  dragging: boolean;
}

export interface PanelActions {
  startPlacing: (key: StructKey) => void;
  useItem: (kind: ItemKind, slotIndex: number) => void;
  equipItem: (kind: ItemKind, slotIndex: number) => void;
  unequip: (slot: EqSlot) => void;
  craft: (r: Recipe) => void;
  castSpell: (index: number) => void;
  takeLoot: (c: Corpse, index: number) => void;
  takeAllLoot: (c: Corpse) => void;
  buy: (kind: ItemKind) => void;
  sell: (kind: ItemKind) => void;
  claim: (id: string) => void;
  deposit: (index: number) => void;
  withdraw: (index: number) => void;
  close: (kind: PanelKind) => void;
}

export interface PanelInput {
  hud: HudCtx;
  ui: UiState;
  game: Game;
  player: Player;
  mouse: { sx: number; sy: number };
  act: PanelActions;
  hotspots: Hotspot[];
  /** The window currently being drawn (position, drag offset, hitboxes). */
  win: PanelWindow;
}

function goldPanel(p: PanelInput, x: number, y: number, w: number, h: number, title: string): void {
  const { ctx, scale: S } = p.hud;
  ctx.fillStyle = "rgba(16,12,8,.94)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#caa23a";
  ctx.lineWidth = S;
  ctx.strokeRect(x + S / 2, y + S / 2, w - S, h - S);
  ctx.strokeStyle = "#6e571f";
  ctx.strokeRect(x + 2.5 * S, y + 2.5 * S, w - 5 * S, h - 5 * S);
  ctx.fillStyle = "#caa23a";
  ctx.fillRect(x, y + 13 * S, w, S);
  hudText(p.hud, title, x + w / 2, y + 7 * S, 9 * S, "#ffe9a8", "center", true);
  // grip dots hinting the title bar is draggable
  ctx.fillStyle = "rgba(255,233,168,.5)";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + 6 * S + i * 3 * S, y + 4 * S, S, S);
    ctx.fillRect(x + 6 * S + i * 3 * S, y + 8 * S, S, S);
  }
  p.win.rect = { x, y, w, h };
  // close (X) button in the top-right of the title bar
  const bs = 13 * S;
  const bx = x + w - bs - 2 * S;
  const by = y + (14 * S - bs) / 2;
  // draggable region is the title bar minus the close button
  p.win.titleBar = { x, y, w: w - bs - 6 * S, h: 14 * S };
  ctx.fillStyle = "rgba(160,40,30,.9)";
  ctx.fillRect(bx, by, bs, bs);
  ctx.strokeStyle = "#ffcabf";
  ctx.lineWidth = S;
  ctx.strokeRect(bx + S / 2, by + S / 2, bs - S, bs - S);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(1, 1.4 * S);
  ctx.beginPath();
  ctx.moveTo(bx + 3.5 * S, by + 3.5 * S);
  ctx.lineTo(bx + bs - 3.5 * S, by + bs - 3.5 * S);
  ctx.moveTo(bx + bs - 3.5 * S, by + 3.5 * S);
  ctx.lineTo(bx + 3.5 * S, by + bs - 3.5 * S);
  ctx.stroke();
  const kind = p.win.kind;
  p.hotspots.push({ x: bx - 2 * S, y: by - 2 * S, w: bs + 4 * S, h: bs + 4 * S, fn: () => p.act.close(kind) });
}

function hovering(p: PanelInput, x: number, y: number, w: number, h: number): boolean {
  return p.mouse.sx >= x && p.mouse.sx < x + w && p.mouse.sy >= y && p.mouse.sy < y + h;
}

function icon(p: PanelInput, spr: HTMLCanvasElement, x: number, y: number, sc: number): void {
  p.hud.ctx.imageSmoothingEnabled = false;
  p.hud.ctx.drawImage(spr, x, y, spr.width * sc, spr.height * sc);
}

export function drawPanels(base: Omit<PanelInput, "win">): void {
  for (const win of base.ui.windows) {
    const p: PanelInput = { ...base, win };
    switch (win.kind) {
      case "build": drawBuild(p); break;
      case "skills": drawSkills(p); break;
      case "equip": drawEquip(p); break;
      case "bag": drawBag(p); break;
      case "forge": drawForge(p); break;
      case "spell": drawSpellbook(p); break;
      case "loot": drawLoot(p); break;
      case "shop": drawShop(p); break;
      case "quest": drawQuests(p); break;
      case "stash": drawStash(p); break;
      default: break;
    }
  }
  if (base.ui.placing) drawPlacingHint(base);
}

/* ---------------- Build ---------------- */

function drawBuild(p: PanelInput): void {
  const { hud, player } = p;
  const { scale: S, screenW, screenH } = hud;
  const w = 246 * S;
  const rowH = 36 * S;
  const h = 20 * S + STRUCT_KEYS.length * rowH + 22 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "BUILD — choose a structure");
  let ry = y + 18 * S;
  for (const key of STRUCT_KEYS) {
    const def = STRUCTS[key];
    const afford = canAfford(player.bag, def.cost, p.game.stash);
    if (hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S) && afford) {
      hud.ctx.fillStyle = "rgba(202,162,58,.15)";
      hud.ctx.fillRect(x + 4 * S, ry, w - 8 * S, rowH - 2 * S);
    }
    const spr = def.spr;
    const isc = Math.max(1, Math.floor((rowH - 10 * S) / spr.height));
    icon(p, spr, x + 10 * S, ry + (rowH - spr.height * isc) / 2, isc);
    hudText(hud, def.name, x + 48 * S, ry + 9 * S, 10 * S, afford ? "#f3eedd" : "#8a8070", "left", true);
    hudText(hud, costText(def.cost), x + 48 * S, ry + 20 * S, 8 * S, afford ? "#b9e07f" : "#d96a5a");
    hudText(hud, def.desc, x + 48 * S, ry + 29 * S, 7 * S, "rgba(220,214,190,.6)");
    if (afford) {
      const ryy = ry;
      p.hotspots.push({ x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S, fn: () => p.act.startPlacing(key) });
    }
    ry += rowH;
  }
  hudText(hud, "Costs draw from backpack + Storage Chest · [Esc] cancel", x + w / 2, y + h - 10 * S, 7 * S, "rgba(220,214,190,.6)", "center");
}

function drawPlacingHint(p: { hud: HudCtx; ui: UiState }): void {
  const { hud, ui } = p;
  const key = ui.placing;
  if (!key) return;
  hudText(hud, `Placing: ${STRUCTS[key].name} — click a glowing pad ([Esc] to cancel)`, hud.screenW / 2, 18 * hud.scale, 9 * hud.scale, "#9fe8a8", "center", true);
}

/* ---------------- Skills ---------------- */

function drawSkills(p: PanelInput): void {
  const { hud } = p;
  const { scale: S, screenW, screenH } = hud;
  const w = 216 * S;
  const rows = Object.keys(skills) as (keyof typeof skills)[];
  const h = 20 * S + rows.length * 26 * S + 10 * S;
  const x = screenW - w - 8 * S + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "SKILLS");
  let ry = y + 20 * S;
  for (const key of rows) {
    const s = skills[key];
    const need = skillNeed(s);
    const pct = s.active ? Math.floor((s.pts / need) * 100) : 0;
    hudText(hud, s.name, x + 10 * S, ry + 5 * S, 8 * S, "#f3eedd", "left", true);
    hudText(hud, `Lv ${s.lv}`, x + w - 46 * S, ry + 5 * S, 8 * S, "#ffe9a8", "right");
    hudText(hud, `${pct}%`, x + w - 12 * S, ry + 5 * S, 8 * S, s.active ? "#cfe8d2" : "#8a8070", "right");
    skillBar(p, x + 10 * S, ry + 11 * S, w - 22 * S, 6 * S, s.active ? s.pts / need : 0, s.color);
    if (!s.active) hudText(hud, "(coming soon)", x + 12 * S, ry + 14 * S, 6 * S, "rgba(220,214,190,.45)");
    ry += 26 * S;
  }
}

function skillBar(p: PanelInput, x: number, y: number, w: number, h: number, frac: number, fg: string): void {
  const { ctx } = p.hud;
  ctx.fillStyle = "#000";
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = "#241c12";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fg;
  ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h);
}

/* ---------------- Equipment ---------------- */

const SLOT_ICONS: Readonly<Record<EqSlot, HTMLCanvasElement>> = {
  amulet: SPR.eqAmulet, head: SPR.eqHead, ring: SPR.eqRing,
  weapon: SPR.sword, body: SPR.eqBody, shield: SPR.eqShield,
  legs: SPR.eqLegs, boots: SPR.eqBoots,
};
const SLOT_LABEL: Readonly<Record<EqSlot, string>> = {
  amulet: "Amulet", head: "Head", ring: "Ring", weapon: "Weapon",
  body: "Body", shield: "Shield", legs: "Legs", boots: "Boots",
};

function drawEquip(p: PanelInput): void {
  const { hud, player } = p;
  const { ctx, scale: S, screenW, screenH } = hud;
  const slot = 30 * S;
  const gap = 6 * S;
  const gridW = slot * 3 + gap * 2;
  const w = gridW + 28 * S;
  const h = 20 * S + slot * 3 + gap * 2 + 92 * S;
  const x = screenW - w - 8 * S + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "EQUIPMENT");
  const gx = x + (w - gridW) / 2;
  const gy = y + 20 * S;
  EQ_SLOT_KEYS.forEach((key, i) => {
    const cx = gx + (i % 3) * (slot + gap);
    const cy = gy + Math.floor(i / 3) * (slot + gap);
    const equipped = player.eq[key];
    ctx.fillStyle = "rgba(40,32,20,.9)";
    ctx.fillRect(cx, cy, slot, slot);
    ctx.strokeStyle = equipped ? "#ffe9a8" : "#6e571f";
    ctx.lineWidth = S;
    ctx.strokeRect(cx + S / 2, cy + S / 2, slot - S, slot - S);
    if (equipped) {
      const spr = itemSprite(equipped);
      const dw = spr.width * 2 * S;
      const dh = spr.height * 2 * S;
      icon(p, spr, cx + (slot - dw) / 2, cy + (slot - dh) / 2 - 3 * S, 2 * S);
      p.hotspots.push({ x: cx, y: cy, w: slot, h: slot, fn: () => p.act.unequip(key) });
    } else {
      const spr = SLOT_ICONS[key];
      ctx.globalAlpha = 0.4;
      const dw = spr.width * 2 * S;
      const dh = spr.height * 2 * S;
      icon(p, spr, cx + (slot - dw) / 2, cy + (slot - dh) / 2 - 3 * S, 2 * S);
      ctx.globalAlpha = 1;
    }
    hudText(hud, SLOT_LABEL[key], cx + slot / 2, cy + slot - 5 * S, 6 * S, "rgba(220,214,190,.7)", "center");
  });
  let sy = gy + slot * 3 + gap * 2 + 8 * S;
  hudText(hud, "Click an item to unequip · open Bag to equip", x + w / 2, sy, 7 * S, "#cfa86a", "center");
  sy += 12 * S;
  ctx.fillStyle = "#6e571f";
  ctx.fillRect(x + 8 * S, sy, w - 16 * S, S);
  sy += 8 * S;
  const stats: ReadonlyArray<readonly [string, string | number]> = [
    ["HP", `${Math.ceil(player.hp)} / ${player.maxhp}`],
    ["Mana", `${Math.ceil(player.mana)} / ${player.maxmana}`],
    ["Attack", `~${attackPower(player.level, player.eq)}`],
    ["Defense", defensePower(player.eq)],
    ["Magic Pwr", magicPower()],
  ];
  for (const [k, v] of stats) {
    hudText(hud, k, x + 12 * S, sy, 8 * S, "#cfe8d2");
    hudText(hud, String(v), x + w - 12 * S, sy, 8 * S, "#ffe9a8", "right");
    sy += 11 * S;
  }
}

/* ---------------- Bag ---------------- */

function drawBag(p: PanelInput): void {
  const { hud, player } = p;
  const { ctx, scale: S, screenW, screenH } = hud;
  const cols = 4;
  const rows = 4;
  const cell = 32 * S;
  const gap = 4 * S;
  const gridW = cols * cell + (cols - 1) * gap;
  const w = gridW + 24 * S;
  const h = 20 * S + rows * cell + (rows - 1) * gap + 20 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "BACKPACK");
  const gx = x + (w - gridW) / 2;
  const gy = y + 20 * S;
  player.bag.forEach((stackSlot, i) => {
    const cx = gx + (i % cols) * (cell + gap);
    const cy = gy + Math.floor(i / cols) * (cell + gap);
    const hov = hovering(p, cx, cy, cell, cell);
    ctx.fillStyle = hov ? "rgba(202,162,58,.18)" : "rgba(40,32,20,.9)";
    ctx.fillRect(cx, cy, cell, cell);
    ctx.strokeStyle = "#6e571f";
    ctx.lineWidth = S;
    ctx.strokeRect(cx + S / 2, cy + S / 2, cell - S, cell - S);
    if (stackSlot) {
      const spr = itemSprite(stackSlot.kind);
      const dw = spr.width * 2 * S;
      const dh = spr.height * 2 * S;
      icon(p, spr, cx + (cell - dw) / 2, cy + (cell - dh) / 2 - 2 * S, 2 * S);
      if (stackSlot.n > 1) hudText(hud, `${stackSlot.n}`, cx + cell - 3 * S, cy + cell - 4 * S, 7 * S, "#ffe9a8", "right");
      const def = ITEMS[stackSlot.kind];
      const idx = i;
      const k = stackSlot.kind;
      if (def.slot) {
        p.hotspots.push({ x: cx, y: cy, w: cell, h: cell, fn: () => p.act.equipItem(k, idx) });
      } else if (def.heal || def.mana) {
        p.hotspots.push({ x: cx, y: cy, w: cell, h: cell, fn: () => p.act.useItem(k, idx) });
      }
    }
  });
  hudText(hud, "Click gear to equip · click a potion/food to use", x + w / 2, y + h - 9 * S, 7 * S, "rgba(220,214,190,.6)", "center");
}

/* ---------------- Forge (crafting) ---------------- */

function drawForge(p: PanelInput): void {
  const { hud, player } = p;
  const { ctx, scale: S, screenW, screenH } = hud;
  const w = 280 * S;
  const rowH = 26 * S;
  const h = 20 * S + RECIPES.length * rowH + 20 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "FORGE — craft gear");
  let ry = y + 18 * S;
  for (const r of RECIPES) {
    const ok = canCraft(player.bag, r);
    if (hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S) && ok) {
      ctx.fillStyle = "rgba(202,162,58,.15)";
      ctx.fillRect(x + 4 * S, ry, w - 8 * S, rowH - 2 * S);
    }
    const spr = itemSprite(r.out);
    icon(p, spr, x + 10 * S, ry + (rowH - spr.height * 2 * S) / 2, 2 * S);
    hudText(hud, ITEMS[r.out].name, x + 34 * S, ry + 8 * S, 9 * S, ok ? "#f3eedd" : "#8a8070", "left", true);
    hudText(hud, recipeCostText(r), x + 34 * S, ry + 18 * S, 7 * S, ok ? "#b9e07f" : "#d96a5a");
    if (ok) {
      const rr = r;
      const ryy = ry;
      p.hotspots.push({ x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S, fn: () => p.act.craft(rr) });
    }
    ry += rowH;
  }
  hudText(hud, "Click a recipe to craft (needs materials in your bag)", x + w / 2, y + h - 9 * S, 7 * S, "rgba(220,214,190,.6)", "center");
}

/* ---------------- Spellbook ---------------- */

function drawSpellbook(p: PanelInput): void {
  const { hud, player, game } = p;
  const { ctx, scale: S, screenW, screenH } = hud;
  const w = 240 * S;
  const unlocked = spellsUnlocked(game.worlds.home);
  const rowH = 30 * S;
  const h = 20 * S + SPELLS.length * rowH + 22 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "SPELLBOOK");
  if (!unlocked) {
    hudText(hud, "Build a Library on Home Isle", x + w / 2, y + h / 2 - 6 * S, 9 * S, "#d96a5a", "center", true);
    hudText(hud, "to learn spells.", x + w / 2, y + h / 2 + 6 * S, 8 * S, "rgba(220,214,190,.7)", "center");
    return;
  }
  let ry = y + 18 * S;
  SPELLS.forEach((sp, i) => {
    const enough = player.mana >= sp.cost;
    if (hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S) && enough) {
      ctx.fillStyle = "rgba(79,143,240,.15)";
      ctx.fillRect(x + 4 * S, ry, w - 8 * S, rowH - 2 * S);
    }
    hudText(hud, `[${i + 1}] ${sp.name}`, x + 12 * S, ry + 8 * S, 9 * S, enough ? "#dfe8ff" : "#8a8070", "left", true);
    hudText(hud, `${sp.cost} mana`, x + w - 12 * S, ry + 8 * S, 8 * S, enough ? "#8ab6ff" : "#d96a5a", "right");
    hudText(hud, sp.desc, x + 12 * S, ry + 19 * S, 7 * S, "rgba(220,214,190,.6)");
    if (enough) {
      const idx = i;
      const ryy = ry;
      p.hotspots.push({ x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S, fn: () => p.act.castSpell(idx) });
    }
    ry += rowH;
  });
  hudText(hud, "Cast with [1]/[2] or click · from the spell bar too", x + w / 2, y + h - 9 * S, 7 * S, "rgba(220,214,190,.6)", "center");
}

/* ---------------- Corpse loot ---------------- */

function drawLoot(p: PanelInput): void {
  const { hud, ui } = p;
  const c = ui.loot;
  if (!c) return;
  const { ctx, scale: S, screenW, screenH } = hud;
  const w = 220 * S;
  const rowH = 22 * S;
  const nRows = c.items.length + (c.gold > 0 ? 1 : 0);
  const h = 20 * S + Math.max(1, nRows) * rowH + 26 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "CORPSE — loot");
  let ry = y + 18 * S;
  if (nRows === 0) {
    hudText(hud, "(empty)", x + w / 2, ry + 8 * S, 8 * S, "rgba(220,214,190,.5)", "center");
    ry += rowH;
  }
  if (c.gold > 0) {
    icon(p, SPR.coin, x + 10 * S, ry + 2 * S, 2 * S);
    hudText(hud, `${c.gold} gold`, x + 34 * S, ry + 8 * S, 9 * S, "#ffe9a8", "left", true);
    ry += rowH;
  }
  c.items.forEach((it, i) => {
    if (hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S)) {
      ctx.fillStyle = "rgba(202,162,58,.15)";
      ctx.fillRect(x + 4 * S, ry, w - 8 * S, rowH - 2 * S);
    }
    const spr = itemSprite(it.kind);
    icon(p, spr, x + 10 * S, ry + 2 * S, 2 * S);
    hudText(hud, `${ITEMS[it.kind].name} x${it.n}`, x + 34 * S, ry + 8 * S, 8 * S, "#f3eedd", "left");
    const idx = i;
    const ryy = ry;
    p.hotspots.push({ x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S, fn: () => p.act.takeLoot(c, idx) });
    ry += rowH;
  });
  const bw = w - 24 * S;
  const by = y + h - 20 * S;
  ctx.fillStyle = "rgba(202,162,58,.25)";
  ctx.fillRect(x + 12 * S, by, bw, 14 * S);
  ctx.strokeStyle = "#caa23a";
  ctx.lineWidth = S;
  ctx.strokeRect(x + 12 * S + S / 2, by + S / 2, bw - S, 14 * S - S);
  hudText(hud, "Take all", x + w / 2, by + 7 * S, 8 * S, "#ffe9a8", "center", true);
  p.hotspots.push({ x: x + 12 * S, y: by, w: bw, h: 14 * S, fn: () => p.act.takeAllLoot(c) });
}

/* ---------------- NPC shop ---------------- */

function drawShop(p: PanelInput): void {
  const { hud, ui, player } = p;
  const npc = ui.npc;
  if (!npc) return;
  const shop = SHOPS[npc.key];
  const { ctx, scale: S, screenW, screenH } = hud;
  const w = 300 * S;
  const rowH = 24 * S;
  const rows = shop.entries.filter((e) => (ui.shopTab === "buy" ? e.buy > 0 : e.sell > 0));
  const h = 34 * S + Math.max(1, rows.length) * rowH + 24 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, npc.name);
  const tabW = 60 * S;
  (["buy", "sell"] as const).forEach((tab, i) => {
    const tx = x + 12 * S + i * (tabW + 6 * S);
    const ty = y + 16 * S;
    const on = ui.shopTab === tab;
    ctx.fillStyle = on ? "rgba(202,162,58,.3)" : "rgba(40,32,20,.8)";
    ctx.fillRect(tx, ty, tabW, 12 * S);
    ctx.strokeStyle = on ? "#ffe9a8" : "#6e571f";
    ctx.lineWidth = S;
    ctx.strokeRect(tx + S / 2, ty + S / 2, tabW - S, 12 * S - S);
    hudText(hud, tab === "buy" ? "Buy" : "Sell", tx + tabW / 2, ty + 6 * S, 8 * S, on ? "#ffe9a8" : "#cfa86a", "center", true);
    p.hotspots.push({ x: tx, y: ty, w: tabW, h: 12 * S, fn: () => { ui.shopTab = tab; } });
  });
  hudText(hud, `Your gold: ${player.gold}`, x + w - 12 * S, y + 22 * S, 8 * S, "#ffe9a8", "right");
  let ry = y + 32 * S;
  if (rows.length === 0) {
    hudText(hud, ui.shopTab === "buy" ? "Nothing for sale." : "You have nothing to sell here.", x + w / 2, ry + 8 * S, 8 * S, "rgba(220,214,190,.5)", "center");
  }
  for (const e of rows) {
    const price = ui.shopTab === "buy" ? e.buy : e.sell;
    const have = bagCount(player.bag, e.kind);
    const canDo = ui.shopTab === "buy" ? player.gold >= price : have > 0;
    if (hovering(p, x + 4 * S, ry, w - 8 * S, rowH - 2 * S) && canDo) {
      ctx.fillStyle = "rgba(202,162,58,.15)";
      ctx.fillRect(x + 4 * S, ry, w - 8 * S, rowH - 2 * S);
    }
    const spr = itemSprite(e.kind);
    icon(p, spr, x + 10 * S, ry + (rowH - spr.height * 2 * S) / 2, 2 * S);
    hudText(hud, ITEMS[e.kind].name, x + 34 * S, ry + 8 * S, 8 * S, canDo ? "#f3eedd" : "#8a8070", "left", true);
    if (ui.shopTab === "sell") hudText(hud, `you have ${have}`, x + 34 * S, ry + 18 * S, 7 * S, "rgba(220,214,190,.55)");
    hudText(hud, `${price}g`, x + w - 14 * S, ry + rowH / 2, 9 * S, canDo ? "#ffe9a8" : "#d96a5a", "right");
    if (canDo) {
      const kind = e.kind;
      const ryy = ry;
      p.hotspots.push({
        x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S,
        fn: () => (ui.shopTab === "buy" ? p.act.buy(kind) : p.act.sell(kind)),
      });
    }
    ry += rowH;
  }
  hudText(hud, "Click a row to trade one · [Esc] to leave", x + w / 2, y + h - 9 * S, 7 * S, "rgba(220,214,190,.6)", "center");
}

/* ---------------- Quests ---------------- */

function drawQuests(p: PanelInput): void {
  const { hud } = p;
  const { ctx, scale: S, screenW, screenH } = hud;
  const w = 320 * S;
  const rowH = 40 * S;
  const h = 20 * S + quests.length * rowH + 16 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "QUEST LOG");
  let ry = y + 18 * S;
  for (const q of quests) {
    const need = q.goal.kind === "build" ? 1 : q.goal.need;
    const prog = Math.min(q.progress, need);
    const color = q.claimed ? "#7a8a7c" : q.done ? "#9fe8a8" : "#f3eedd";
    hudText(hud, q.title, x + 12 * S, ry + 7 * S, 9 * S, color, "left", true);
    const status = q.claimed ? "claimed" : q.done ? `${prog}/${need} — click to claim!` : `${prog}/${need}`;
    hudText(hud, status, x + w - 12 * S, ry + 7 * S, 8 * S, q.done && !q.claimed ? "#ffe9a8" : "rgba(220,214,190,.7)", "right");
    hudText(hud, q.desc, x + 12 * S, ry + 19 * S, 7 * S, "rgba(220,214,190,.6)");
    const r = q.reward;
    const parts: string[] = [];
    if (r.exp) parts.push(`${r.exp} xp`);
    if (r.gold) parts.push(`${r.gold} gold`);
    if (r.item) parts.push(`${r.itemN ?? 1}x ${ITEMS[r.item].name}`);
    hudText(hud, "Reward: " + parts.join(", "), x + 12 * S, ry + 29 * S, 7 * S, "rgba(202,162,58,.85)");
    ctx.fillStyle = "#3a3222";
    ctx.fillRect(x + 12 * S, ry + rowH - 6 * S, w - 24 * S, 2 * S);
    ctx.fillStyle = q.claimed ? "#5a6a5c" : "#9fe8a8";
    ctx.fillRect(x + 12 * S, ry + rowH - 6 * S, (w - 24 * S) * (prog / need), 2 * S);
    if (q.done && !q.claimed) {
      const id = q.id;
      const ryy = ry;
      p.hotspots.push({ x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S, fn: () => p.act.claim(id) });
    }
    ry += rowH;
  }
}

/* ---------------- Storage chest (stash) ---------------- */

function drawGrid(
  p: PanelInput,
  slots: ReadonlyArray<{ kind: ItemKind; n: number } | null>,
  gx: number,
  gy: number,
  cols: number,
  cell: number,
  gap: number,
  onClick: (index: number) => void,
): void {
  const { hud } = p;
  const { ctx, scale: S } = hud;
  slots.forEach((slot, i) => {
    const cx = gx + (i % cols) * (cell + gap);
    const cy = gy + Math.floor(i / cols) * (cell + gap);
    const hov = hovering(p, cx, cy, cell, cell);
    ctx.fillStyle = hov ? "rgba(202,162,58,.18)" : "rgba(40,32,20,.9)";
    ctx.fillRect(cx, cy, cell, cell);
    ctx.strokeStyle = "#6e571f";
    ctx.lineWidth = S;
    ctx.strokeRect(cx + S / 2, cy + S / 2, cell - S, cell - S);
    if (slot) {
      const spr = itemSprite(slot.kind);
      const dw = spr.width * 2 * S;
      const dh = spr.height * 2 * S;
      icon(p, spr, cx + (cell - dw) / 2, cy + (cell - dh) / 2 - 2 * S, 2 * S);
      if (slot.n > 1) hudText(hud, `${slot.n}`, cx + cell - 3 * S, cy + cell - 4 * S, 7 * S, "#ffe9a8", "right");
      const idx = i;
      p.hotspots.push({ x: cx, y: cy, w: cell, h: cell, fn: () => onClick(idx) });
    }
  });
}

function drawStash(p: PanelInput): void {
  const { hud, player, game } = p;
  const { ctx, scale: S, screenW, screenH } = hud;
  const cols = 5;
  const cell = 30 * S;
  const gap = 4 * S;
  const gridW = cols * cell + (cols - 1) * gap;
  const stashRows = Math.ceil(game.stash.length / cols);
  const bagRows = Math.ceil(player.bag.length / cols);
  const w = gridW + 24 * S;
  const headH = 12 * S;
  const h = 20 * S + headH + stashRows * (cell + gap) + 14 * S + headH + bagRows * (cell + gap) + 10 * S;
  const x = (screenW - w) / 2 + p.win.offset.x;
  const y = (screenH - h) / 2 + p.win.offset.y;
  goldPanel(p, x, y, w, h, "STORAGE CHEST");
  const gx = x + (w - gridW) / 2;
  let gy = y + 18 * S;

  hudText(hud, "Chest — click to take", x + 12 * S, gy + 5 * S, 8 * S, "#cfe8d2", "left", true);
  gy += headH;
  drawGrid(p, game.stash, gx, gy, cols, cell, gap, (i) => p.act.withdraw(i));
  gy += stashRows * (cell + gap) + 8 * S;

  ctx.fillStyle = "#6e571f";
  ctx.fillRect(x + 8 * S, gy, w - 16 * S, S);
  gy += 8 * S;

  hudText(hud, "Backpack — click to store", x + 12 * S, gy + 5 * S, 8 * S, "#cfe8d2", "left", true);
  gy += headH;
  drawGrid(p, player.bag, gx, gy, cols, cell, gap, (i) => p.act.deposit(i));
}
