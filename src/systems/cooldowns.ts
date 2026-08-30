/**
 * Which crystal is ready, and when.
 *
 * ONE TIMER USED TO COVER EVERYTHING. Attack and heal alike sat on a single
 * three-second clock, so the bar was really one button drawn twenty-four
 * times: whatever you pressed, everything went grey together. Carrying a
 * varied set bought you nothing, and a heal cost a whole attack turn.
 *
 * The Tibia shape, which is what this is: a spell has its OWN cooldown, and it
 * shares a shorter one with its GROUP. You cannot cast Exori twice in a row,
 * but you can cast Exori, then Exori Gran a moment later, then Exori again
 * once its own clock has run out. Chaining is the skill; repetition is not.
 *
 * WHY IT MATTERS MORE THAN THE DAMAGE NUMBERS. At level 36 a t3 Shard averages
 * 149 against a sword's 315, which reads as "spells are weak" — but the sword
 * swings every 2s and the crystal every 3s, so the real gap was 158 dps to 50.
 * Under this model four distinct crystals reach ~149 dps single-target and
 * roughly double a sword against a pack, with NOT ONE damage constant touched.
 * The answer to "my spells are weak" becomes "carry a set", which is the
 * answer worth having: it is a decision, not a bigger number.
 *
 * Nothing here persists. A cooldown is a fact about the last few seconds and
 * has no business surviving a reload — which is also why the old single timer
 * needed no save migration and neither does this.
 */
import { CRYSTAL_CD_TIER, CRYSTAL_GCD_S, HEAL_CRYSTAL_CD_S } from "../config.ts";
import type { ItemKind } from "../items.ts";
import { CRYSTAL_SPECS } from "./crystals.ts";

/**
 * Cooldowns are grouped, and the groups do not talk to each other.
 *
 * Healing left the attack group on purpose. It used to cost a full attack turn
 * because with no mana in the game the turn was the only price a heal could
 * pay — but that also meant the fight stopped every time you topped up, which
 * is not how Tibia reads. Exura Vita runs on a one-second clock of its own;
 * two seconds here is the same idea with a wider margin.
 */
export type CdGroup = "attack" | "heal";

/** Seconds left, per crystal kind and per group. Transient. */
interface CdState {
  each: Map<string, number>;
  group: Map<CdGroup, number>;
}

const st: CdState = { each: new Map(), group: new Map() };

/** Which group a crystal belongs to. Anything that is not a heal is an attack. */
export function groupOf(kind: ItemKind): CdGroup {
  return kind === "healCrystal" ? "heal" : "attack";
}

/**
 * How long this crystal locks ITSELF out for.
 *
 * Scaled by tier, the way Tibia charges more for a bigger spell (Exori 4s,
 * Exori Gran 6s). Without it the whole bar converges on four t3 Shards and
 * every other crystal in the game becomes something you sell — the tier ladder
 * would buy raw damage and cost nothing, which is not a ladder.
 */
export function ownCooldown(kind: ItemKind): number {
  if (groupOf(kind) === "heal") return HEAL_CRYSTAL_CD_S;
  const spec = CRYSTAL_SPECS[kind];
  return CRYSTAL_CD_TIER[spec ? spec.tier : 0];
}

/** How long a cast locks out the REST of its group. */
export function groupCooldown(kind: ItemKind): number {
  // A heal's own two seconds is already the brake; a second clock on top would
  // only ever be the smaller of the two and would never be the thing you wait
  // for. One number the player can learn is better than two they cannot see.
  return groupOf(kind) === "heal" ? 0 : CRYSTAL_GCD_S;
}

/** Seconds until `kind` can be cast: the longer of its own clock and its group's. */
export function cooldownLeft(kind: ItemKind): number {
  return Math.max(st.each.get(kind) ?? 0, st.group.get(groupOf(kind)) ?? 0);
}

export function isReady(kind: ItemKind): boolean {
  return cooldownLeft(kind) <= 0;
}

/**
 * Why a crystal is not ready — its own clock, or the one it shares.
 *
 * The refusal used to be a flat "not ready" because there was only one thing
 * it could mean. There are two now, and they call for opposite responses: your
 * own clock says press something else, the group clock says wait a moment. A
 * message that cannot tell them apart teaches the player nothing.
 */
export function blockedBy(kind: ItemKind): "own" | "group" | null {
  const own = st.each.get(kind) ?? 0;
  const grp = st.group.get(groupOf(kind)) ?? 0;
  if (own <= 0 && grp <= 0) return null;
  return own >= grp ? "own" : "group";
}

/** Start both clocks for a cast that has just happened. */
export function startCooldown(kind: ItemKind): void {
  st.each.set(kind, ownCooldown(kind));
  const g = groupCooldown(kind);
  if (g > 0) st.group.set(groupOf(kind), Math.max(st.group.get(groupOf(kind)) ?? 0, g));
}

export function tickCooldowns(dt: number): void {
  for (const [k, v] of st.each) {
    const n = v - dt;
    if (n <= 0) st.each.delete(k); else st.each.set(k, n);
  }
  for (const [k, v] of st.group) {
    const n = v - dt;
    if (n <= 0) st.group.delete(k); else st.group.set(k, n);
  }
}

/** Clear everything (new game, character switch, test isolation). */
export function resetCooldowns(): void {
  st.each.clear();
  st.group.clear();
}

/** 0..1, for drawing a sweep on a hotbar slot. 0 means ready. */
export function cooldownFrac(kind: ItemKind): number {
  const left = cooldownLeft(kind);
  if (left <= 0) return 0;
  const own = st.each.get(kind) ?? 0;
  const full = own >= (st.group.get(groupOf(kind)) ?? 0) ? ownCooldown(kind) : groupCooldown(kind);
  return full > 0 ? Math.min(1, left / full) : 0;
}
