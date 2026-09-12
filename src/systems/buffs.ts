/**
 * Timed effects on the character: Swiftness, Aegis, Fury and Fury's debt.
 *
 * WHY THESE LIVE ON `Player` AND ARE SAVED, when cooldowns deliberately are
 * not. A cooldown is a fact about the last few seconds and closing the tab may
 * as well clear it — nobody reloads to dodge a three-second wait. Fury's debt
 * is the opposite: five minutes of losing 30% of the bar every five seconds is
 * the entire price of the buff, and a debt that a reload cancels is not a price
 * at all. The half-hour lock is the same story one step out — if it died with
 * the session, "once every thirty minutes" would read "once per reload".
 *
 * So the whole record persists, and it persists as ONE object rather than as
 * six loose fields next to `fedS`. Six fields is six lines in the save writer,
 * six in the reader, and six chances to add the seventh and forget one of the
 * two. Older saves have no `buffs` key and load clean through `newBuffs()`,
 * exactly the way `fedS ?? 0` already works.
 *
 * NO IMPORTS FROM combat.ts, ON PURPOSE. `hurtPlayer` needs to ask this module
 * for the Aegis cut and the Fury multiplier, so this module must not call back
 * into it. `tickBuffs` therefore does not deal the debt's damage — it counts
 * how many ticks came due and hands the number back, and the main loop (which
 * already owns the `fedS` tick) turns that into damage. The cycle is broken at
 * the only place it can be broken without a third module nobody would look in.
 */
import {
  AEGIS_LOCK_S, AEGIS_RUNE_CUT, FURY_DEBT_FRAC, FURY_DEBT_TICK_S, FURY_LOCK_S,
  FURY_RUNE_MULT, HASTE_RUNE_MULT,
} from "../config.ts";

/**
 * Seconds left on each effect. Zero means off; nothing here is ever negative.
 *
 * `debtTick` is a countdown to the NEXT drain rather than an elapsed total,
 * which is what makes the tick survive a save in the middle of a debt: the
 * player reloads owing the same four seconds they owed when they closed it.
 */
export interface Buffs {
  /** Swiftness — movement multiplier while above zero. */
  haste: number;
  /** Aegis — cuts incoming damage while above zero. */
  aegis: number;
  /** Fury — triple weapon damage while above zero. */
  fury: number;
  /** Fury's aftermath. Drains while above zero, whatever else is happening. */
  debt: number;
  /** Seconds until the next drain lands. Only meaningful while `debt` > 0. */
  debtTick: number;
  /** Seconds until another Fury may be used. Outlives death deliberately. */
  furyLock: number;
  /** Seconds until another Aegis may be used. Outlives death for the same
   *  reason Fury's does — see clearBuffsOnDeath(). */
  aegisLock: number;
}

export function newBuffs(): Buffs {
  return { haste: 0, aegis: 0, fury: 0, debt: 0, debtTick: 0, furyLock: 0, aegisLock: 0 };
}

/** Rebuild from a save. Missing or malformed input loads as "no effects". */
export function loadBuffs(saved: Partial<Buffs> | undefined): Buffs {
  const b = newBuffs();
  if (!saved) return b;
  for (const k of Object.keys(b) as (keyof Buffs)[]) {
    const v = saved[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) b[k] = v;
  }
  return b;
}

/**
 * Run every clock down by `dt` and report how many debt ticks came due.
 *
 * The return value is a COUNT rather than a boolean because a long frame — a
 * backgrounded tab, a slow first render after a reload — can legitimately owe
 * more than one tick, and swallowing the extras would make the debt cheaper
 * the worse the framerate got.
 */
export function tickBuffs(b: Buffs, dt: number): number {
  b.haste = Math.max(0, b.haste - dt);
  b.aegis = Math.max(0, b.aegis - dt);
  b.fury = Math.max(0, b.fury - dt);
  b.furyLock = Math.max(0, b.furyLock - dt);
  b.aegisLock = Math.max(0, b.aegisLock - dt);
  if (b.debt <= 0) return 0;

  // ONLY THE TIME ACTUALLY INSIDE THE DEBT COUNTS. Subtracting the raw `dt`
  // let a coarse frame straddling the end of the debt bill for its whole
  // length — eleven seconds of bites for the one second of debt that was left
  // — so a backgrounded tab came back owing more than sixty ticks. Capping
  // the step at the remaining debt makes the total exactly
  // FURY_DEBT_S / FURY_DEBT_TICK_S at every framerate, which is the only
  // promise this function makes.
  const spent = Math.min(dt, b.debt);
  b.debt -= spent;
  b.debtTick -= spent;
  let due = 0;
  while (b.debtTick <= 0) {
    due++;
    b.debtTick += FURY_DEBT_TICK_S;
  }
  // The debt ending mid-frame stops owing anything further: the last tick of
  // a five-minute burn should not land a beat after the burn is over.
  if (b.debt <= 0) {
    b.debt = 0;
    b.debtTick = 0;
  }
  return due;
}

/** How much of the FULL bar one debt tick takes. */
export function debtBite(maxhp: number): number {
  return Math.max(1, Math.round(maxhp * FURY_DEBT_FRAC));
}

export function hasteMult(b: Buffs): number {
  return b.haste > 0 ? HASTE_RUNE_MULT : 1;
}

export function furyMult(b: Buffs): number {
  return b.fury > 0 ? FURY_RUNE_MULT : 1;
}

/** Fraction of an incoming hit that Aegis eats. 0 when it is not up. */
export function aegisCut(b: Buffs): number {
  return b.aegis > 0 ? AEGIS_RUNE_CUT : 0;
}

export function furyReady(b: Buffs): boolean {
  return b.furyLock <= 0 && b.fury <= 0 && b.debt <= 0;
}

export function aegisReady(b: Buffs): boolean {
  return b.aegisLock <= 0 && b.aegis <= 0;
}

/** Raise an Aegis and start the five minutes before the next one. */
export function startAegis(b: Buffs, secs: number): void {
  b.aegis = secs;
  b.aegisLock = AEGIS_LOCK_S;
}

/** Start a Fury: the burst, the debt that follows it, and the lock. */
export function startFury(b: Buffs, burstS: number, debtS: number): void {
  b.fury = burstS;
  // The debt covers the burst as well as the five minutes after it, so that
  // `debt` is simply "how long until this is over". The first BITE still lands
  // one interval after the burst ends — twenty seconds of triple damage should
  // be twenty clean seconds.
  b.debt = burstS + debtS;
  b.debtTick = burstS + FURY_DEBT_TICK_S;
  b.furyLock = FURY_LOCK_S;
}

/**
 * Death clears the effects but NOT the locks.
 *
 * Dying to your own debt has to stay a loss. If death wiped `furyLock` then
 * the cheapest way out of a bad Fury would be to let it kill you, and the
 * half-hour rule would only ever bind on players who survived — which is
 * precisely backwards. `aegisLock` follows the same rule for the same reason:
 * a death that refreshed your defensive cooldown would reward dying.
 */
export function clearBuffsOnDeath(b: Buffs): void {
  b.haste = 0;
  b.aegis = 0;
  b.fury = 0;
  b.debt = 0;
  b.debtTick = 0;
}

/** Everything off, lock included. New game and character switch only. */
export function resetBuffs(b: Buffs): void {
  clearBuffsOnDeath(b);
  b.furyLock = 0;
  b.aegisLock = 0;
}
