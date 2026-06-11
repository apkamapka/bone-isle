/** Toggleable Tibia-style panels: Build, Skills, Equipment. */
import { SPR } from "../gfx/sprites.ts";
import { skills, skillNeed, attackPower, defensePower } from "../systems/skills.ts";
import { STRUCTS, STRUCT_KEYS, canAfford, costText } from "../systems/building.ts";
import { hudText, type HudCtx } from "./hud.ts";
import type { Player } from "../entities/player.ts";
import type { StructKey } from "../systems/building.ts";

export type PanelKind = "build" | "skills" | "equip" | null;

/** A clickable screen-space region produced while drawing a panel. */
export interface Hotspot {
  x: number;
  y: number;
  w: number;
  h: number;
  fn: () => void;
}

/** Mutable UI state shared with main. */
export interface UiState {
  panel: PanelKind;
  placing: StructKey | null;
  selSlot: string | null;
  /** Bounds of the open panel, so background clicks are swallowed. */
  panelRect: { x: number; y: number; w: number; h: number } | null;
}

export interface PanelInput {
  hud: HudCtx;
  ui: UiState;
  player: Player;
  mouse: { sx: number; sy: number };
  /** Begin placement mode for a structure (closes the menu). */
  startPlacing: (key: StructKey) => void;
  /** Collected hotspots for this frame. */
  hotspots: Hotspot[];
}

function goldPanel(p: PanelInput, x: number, y: number, w: number, h: number, title: string): void {
  const { ctx, scale: S } = p.hud;
  ctx.fillStyle = "rgba(16,12,8,.92)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#caa23a";
  ctx.lineWidth = S;
  ctx.strokeRect(x + S / 2, y + S / 2, w - S, h - S);
  ctx.strokeStyle = "#6e571f";
  ctx.strokeRect(x + 2.5 * S, y + 2.5 * S, w - 5 * S, h - 5 * S);
  ctx.fillStyle = "#caa23a";
  ctx.fillRect(x, y + 13 * S, w, S);
  hudText(p.hud, title, x + w / 2, y + 7 * S, 9 * S, "#ffe9a8", "center", true);
  p.ui.panelRect = { x, y, w, h };
}

export function drawPanels(p: PanelInput): void {
  if (p.ui.panel === "build") drawBuild(p);
  else if (p.ui.panel === "skills") drawSkills(p);
  else if (p.ui.panel === "equip") drawEquip(p);
  if (p.ui.placing) drawPlacingHint(p);
}

function drawBuild(p: PanelInput): void {
  const { hud, player } = p;
  const { scale: S, screenW, screenH } = hud;
  const w = 246 * S;
  const rowH = 36 * S;
  const h = 20 * S + STRUCT_KEYS.length * rowH + 22 * S;
  const x = (screenW - w) / 2;
  const y = (screenH - h) / 2;
  goldPanel(p, x, y, w, h, "BUILD — choose a structure");
  let ry = y + 18 * S;
  for (const key of STRUCT_KEYS) {
    const def = STRUCTS[key];
    const afford = canAfford(player.inv, def.cost);
    const hov = p.mouse.sx >= x + 4 * S && p.mouse.sx < x + w - 4 * S && p.mouse.sy >= ry && p.mouse.sy < ry + rowH - 2 * S;
    if (hov && afford) {
      hud.ctx.fillStyle = "rgba(202,162,58,.15)";
      hud.ctx.fillRect(x + 4 * S, ry, w - 8 * S, rowH - 2 * S);
    }
    const spr = def.spr;
    const isc = Math.max(1, Math.floor((rowH - 10 * S) / spr.height));
    hud.ctx.imageSmoothingEnabled = false;
    hud.ctx.drawImage(spr, x + 10 * S, ry + (rowH - spr.height * isc) / 2, spr.width * isc, spr.height * isc);
    hudText(hud, def.name, x + 48 * S, ry + 9 * S, 10 * S, afford ? "#f3eedd" : "#8a8070", "left", true);
    hudText(hud, costText(def.cost), x + 48 * S, ry + 20 * S, 8 * S, afford ? "#b9e07f" : "#d96a5a");
    hudText(hud, def.desc, x + 48 * S, ry + 29 * S, 7 * S, "rgba(220,214,190,.6)");
    if (afford) {
      const ryy = ry;
      p.hotspots.push({ x: x + 4 * S, y: ryy, w: w - 8 * S, h: rowH - 2 * S, fn: () => p.startPlacing(key) });
    }
    ry += rowH;
  }
  hudText(hud, "Click a glowing pad on Home Isle to place · [Esc] cancel", x + w / 2, y + h - 10 * S, 7 * S, "rgba(220,214,190,.6)", "center");
}

function drawPlacingHint(p: PanelInput): void {
  const { hud, ui } = p;
  const key = ui.placing;
  if (!key) return;
  hudText(hud, `Placing: ${STRUCTS[key].name} — click a glowing pad ([Esc] to cancel)`, hud.screenW / 2, 18 * hud.scale, 9 * hud.scale, "#9fe8a8", "center", true);
}

function drawSkills(p: PanelInput): void {
  const { hud } = p;
  const { scale: S, screenW, screenH } = hud;
  const w = 216 * S;
  const rows = Object.keys(skills) as (keyof typeof skills)[];
  const h = 20 * S + rows.length * 26 * S + 10 * S;
  const x = screenW - w - 8 * S;
  const y = (screenH - h) / 2;
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

const EQ_SLOTS: ReadonlyArray<readonly [string, string, HTMLCanvasElement]> = [
  ["amulet", "Amulet", SPR.eqAmulet], ["head", "Head", SPR.eqHead], ["arrow", "Arrow", SPR.eqArrow],
  ["weapon", "Weapon", SPR.sword], ["body", "Body", SPR.eqBody], ["shield", "Shield", SPR.eqShield],
  ["ring", "Ring", SPR.eqRing], ["legs", "Legs", SPR.eqLegs], ["boots", "Boots", SPR.eqBoots],
];

function drawEquip(p: PanelInput): void {
  const { hud, player, ui } = p;
  const { ctx, scale: S, screenW, screenH } = hud;
  const slot = 30 * S;
  const gap = 6 * S;
  const gridW = slot * 3 + gap * 2;
  const w = gridW + 28 * S;
  const h = 20 * S + slot * 3 + gap * 2 + 86 * S;
  const x = screenW - w - 8 * S;
  const y = (screenH - h) / 2;
  goldPanel(p, x, y, w, h, "EQUIPMENT");
  const gx = x + (w - gridW) / 2;
  const gy = y + 20 * S;
  EQ_SLOTS.forEach(([key, label, spr], i) => {
    const cx = gx + (i % 3) * (slot + gap);
    const cy = gy + Math.floor(i / 3) * (slot + gap);
    const sel = ui.selSlot === key;
    ctx.fillStyle = sel ? "rgba(202,162,58,.25)" : "rgba(40,32,20,.9)";
    ctx.fillRect(cx, cy, slot, slot);
    ctx.strokeStyle = sel ? "#ffe9a8" : "#6e571f";
    ctx.lineWidth = S;
    ctx.strokeRect(cx + S / 2, cy + S / 2, slot - S, slot - S);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.45;
    const dw = spr.width * 2 * S;
    const dh = spr.height * 2 * S;
    ctx.drawImage(spr, cx + (slot - dw) / 2, cy + (slot - dh) / 2 - 3 * S, dw, dh);
    ctx.globalAlpha = 1;
    hudText(hud, label, cx + slot / 2, cy + slot - 5 * S, 6 * S, "rgba(220,214,190,.7)", "center");
    p.hotspots.push({ x: cx, y: cy, w: slot, h: slot, fn: () => { ui.selSlot = key; } });
  });
  let sy = gy + slot * 3 + gap * 2 + 8 * S;
  if (ui.selSlot) {
    const found = EQ_SLOTS.find((s) => s[0] === ui.selSlot);
    hudText(hud, `Empty ${found ? found[1] : ""} slot — find gear soon!`, x + w / 2, sy, 7 * S, "#cfa86a", "center");
  } else {
    hudText(hud, "Click a slot", x + w / 2, sy, 7 * S, "rgba(220,214,190,.5)", "center");
  }
  sy += 12 * S;
  ctx.fillStyle = "#6e571f";
  ctx.fillRect(x + 8 * S, sy, w - 16 * S, S);
  sy += 8 * S;
  const stats: ReadonlyArray<readonly [string, string | number]> = [
    ["Level", player.level],
    ["HP", `${Math.ceil(player.hp)} / ${player.maxhp}`],
    ["EXP to next", player.expNext - player.exp],
    ["Attack", `~${attackPower(player.level)}`],
    ["Defense", defensePower()],
  ];
  for (const [k, v] of stats) {
    hudText(hud, k, x + 12 * S, sy, 8 * S, "#cfe8d2");
    hudText(hud, String(v), x + w - 12 * S, sy, 8 * S, "#ffe9a8", "right");
    sy += 11 * S;
  }
}
