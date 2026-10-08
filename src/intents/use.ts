/**
 * Using, wearing and taking off what the player carries (Etap 3.1c moved this
 * here from the panel actions in main.ts).
 *
 * Eating, drinking a potion, reading a blessing, the TEST stones, putting a
 * piece of gear on or taking it off, loading the next kind of arrow, and
 * changing gold for platinum at Morgan's counter.
 */
import type { Game } from "../game.ts";
import type { EqSlot, ItemKind } from "../items.ts";
import { ITEMS, addItem, removeItem, cycleArrow, exchangeCoins } from "../items.ts";
import { FED_MAX_S, totalExpFor } from "../config.ts";
import { rndi } from "../util.ts";
import { refreshDerived, freeCap } from "../entities/player.ts";
import { grantExp } from "../systems/combat.ts";
import { skills, type SkillKey } from "../systems/skills.ts";
import { isReady, startCooldown } from "../systems/cooldowns.ts";
import { freeSlots, planSwap, refused } from "../systems/loadout.ts";
import { rootOf, type ContainerRef } from "../systems/containers.ts";
import { sound, tone, floatAt, floatSelf } from "../systems/fxEvents.ts";
import { tell, nearNpc } from "./actor.ts";
import { refSlots, refUsable, closeIfEmpty } from "./containers.ts";
import { dropToGround } from "./ground.ts";

/**
 * What became of a request to use something.
 *
 *   - `handled`: it was used, or refused with a word said to the player.
 *   - `move`: it lies somewhere that is not the player's, and only food and
 *     drink are used where they lie — the client offers to move it instead.
 *   - `crystal`: a crystal is cast rather than consumed, by the crystal code.
 */
export type UseOutcome = "handled" | "move" | "crystal";

/**
 * Use one `kind` — out of the player's own pack, or, for food and drink, out
 * of the body, chest or floor bag `from` it is lying in.
 */
export function useItem(g: Game, kind: ItemKind, from?: ContainerRef): UseOutcome {
  const P = g.player;
  const def = ITEMS[kind];
  /* WHERE IT IS BEING EATEN FROM.
   *
   * This used to assume the pack, unconditionally — `removeItem(P.bag, …)` —
   * so clicking the meat inside a corpse found nothing to remove and
   * returned in silence. The click landed, the handler ran, and nothing
   * happened, which reads as a dead button rather than as a rule.
   *
   * Tibia's rule is the right one and it is the one Radek asked for: food
   * and drink are USED where they lie. You do not carry a ham home to eat
   * it, and in a fight against four things at once the two seconds spent
   * moving it into the pack are the two seconds you did not have.
   *
   * Only food and potions, though. A crystal is bound to a hotbar slot and
   * counted out of the pack, and a corpse is not a quiver — those still have
   * to be picked up, and fall through to the ordinary take below. */
  /* IN PLACE means "somewhere that is not already yours". The pack and any
   * pack inside it are yours, so eating out of those is the ordinary spend
   * — `removeItem` walks the tree and finds it wherever it is nested. A
   * body, a chest or a bag on the floor is not, and that is the case this
   * whole branch exists for. `rootOf` is what tells the two apart; asking
   * `from.c !== "bag"` got a pack inside the pack wrong. */
  const outside = !!from && rootOf(from) !== "player";
  const inPlace = outside && !!(def.food || def.heal);
  const spend = (): boolean => {
    if (!inPlace) return removeItem(P.bag, kind, 1);
    const slots = refSlots(g, from);
    if (!slots) return false;
    if (!removeItem(slots, kind, 1)) return false;
    closeIfEmpty(g, from);
    return true;
  };
  if (outside && !inPlace) return "move";
  /* Eaten where it lies, so it has to be within reach where it lies — the
   * same reach every move out of that body or bag is held to. */
  if (inPlace && from && !refUsable(g, from)) { tell(g, "too far away", "#d96a5a"); return "handled"; }

  if (def.crystal) return "crystal";
  if (def.blessing) {
    /* Huntress' Blessing (Etap 92). One at a time: a second scroll on a
     * blessed character is refused, and kept, which is also how a player
     * finds out that the first one still holds. */
    if (P.blessed) { tell(g, "you are already blessed", "#c9a6ff"); return "handled"; }
    if (!spend()) return "handled";
    P.blessed = true;
    floatSelf(g.current, P.x, P.y - 44, "blessed", "#c9a6ff");
    sound("reward");
    return "handled";
  }
  if (def.food) {
    // Tibia rule: you can bank at most 20 minutes of fed time — eating past
    // it is refused (and the food is NOT consumed)
    /* Naming the wait matters more than it looks. A click that is refused in
     * silence and a click that does nothing are the same event to the
     * player, and "can't eat any more" was being read as "eating is
     * broken". */
    if (P.fedS + def.food > FED_MAX_S) {
      tell(g, `too full — wait ${Math.ceil((P.fedS + def.food - FED_MAX_S) / 60)} min`, "#e0a06a");
      return "handled";
    }
    if (!spend()) return "handled";
    P.fedS += def.food;
    tell(g, ["Munch.", "Gulp.", "Mmmh."][rndi(0, 2)], "#e8dcc0");
    sound("eat");
    return "handled";
  }
  if (def.testLevel) {
    // TEST item (Level Stone): one level per stone, granted as the exact
    // experience still missing — so the level-up path, its effects and its
    // derived stats all run exactly as they do off a kill.
    if (!removeItem(P.bag, kind, 1)) return "handled";
    const targetLv = P.level + def.testLevel;
    const missing = totalExpFor(targetLv) - (totalExpFor(P.level) + P.exp);
    if (missing > 0) grantExp(g.current, P, missing);
    refreshDerived(P);
    P.hp = P.maxhp;
    tell(g, `TEST +${def.testLevel} level${def.testLevel > 1 ? "s" : ""}`, "#e3b341");
    tone(700, 0.2, "square", 0.06, 160);
    return "handled";
  }
  if (def.testSkill) {
    // TEST item (Skill Stone): three points on every skill already started.
    // A skill you have never used stays at zero — the stone is a shortcut
    // through the grind, not a way to own skills you never trained.
    if (!removeItem(P.bag, kind, 1)) return "handled";
    for (const k of Object.keys(skills) as SkillKey[]) {
      const sk = skills[k];
      if (!sk.active) continue;
      sk.lv += def.testSkill;
      sk.pts = 0;
    }
    refreshDerived(P);
    tell(g, `TEST +${def.testSkill} to every skill`, "#4fb6e0");
    tone(520, 0.2, "square", 0.06, 160);
    return "handled";
  }
  // don't waste a potion charge when already at full health
  if (def.heal && P.hp >= P.maxhp) { tell(g, "full hp", "#7dff9e"); return "handled"; }
  /* THE HEAL CLOCK (Etap 58). A potion used to skip it entirely — no
   * cooldown, forty-five points a click for as long as the gold lasted. It
   * now shares the Life Crystal's two seconds both ways: drinking starts the
   * clock the crystal reads, and a crystal just used refuses the potion.
   * Checked BEFORE `spend`, so a refused drink keeps the potion.
   *
   * Both lines speak the way the Life Crystal does (Etap 61): the refusal
   * floats where the crystal's does and in its colour, and the heal is the
   * crystal's green number. One heal clock should be one set of words. */
  if (def.heal && !isReady(kind)) { floatSelf(g.current, P.x, P.y - 44, "still cooling", "#8ab6ff"); return "handled"; }
  if (!spend()) return "handled";
  if (def.heal) {
    startCooldown(kind);
    P.hp = Math.min(P.maxhp, P.hp + def.heal);
    floatAt(g.current, P.x, P.y - 40, `+${def.heal}`, "#7dff9e");
  }
  tone(500, 0.12, "sine", 0.05, 180);
  return "handled";
}

/**
 * Put `kind` on, out of the pack. Whatever it displaces goes back into the
 * pack — a bow takes the shield off with it, a shield the bow — and the whole
 * thing is refused, with nothing moved, when there is no room for that.
 */
export function equipItem(g: Game, kind: ItemKind): void {
  const P = g.player;
  const def = ITEMS[kind];
  const slot = def.slot;
  if (!slot) return;
  /* WHAT COMES OFF, decided before anything moves.
   *
   * Equipping displaces up to two pieces: whatever is in the slot, and — for
   * a bow — the shield the second hand was holding. Both used to be handed
   * to a `stowOrDrop` that put them on the FLOOR when the bag was full, and
   * a bow swap in a full pack therefore left a shield lying in a dungeon
   * with nothing said about it. Gear does not fall out of a character.
   *
   * So the room is checked first and the whole equip is refused if it is not
   * there. The incoming item vacates its own slot on the way out, which is
   * why one displaced piece always fits and only the SECOND needs room. */
  const displaced: ItemKind[] = [];
  const prev = P.eq[slot];
  if (prev) displaced.push(prev);
  if (def.bow && P.eq.shield) displaced.push(P.eq.shield);
  if (slot === "shield" && P.eq.weapon && ITEMS[P.eq.weapon].bow) displaced.push(P.eq.weapon);
  if (displaced.length > 1 && freeSlots(P.bag) < displaced.length - 1) {
    tell(g, "no room to stow what comes off", "#d96a5a");
    return;
  }
  if (!removeItem(P.bag, kind, 1)) return;
  // stow a displaced piece into the bag; the room for it was checked above,
  // and the floor stays a last resort for the impossible case
  const stowOrDrop = (k: ItemKind): void => {
    if (addItem(P.bag, k, 1) > 0) dropToGround(g, k, 1);
  };
  P.eq[slot] = kind;
  if (prev) stowOrDrop(prev);
  // Two-handed rule: a bow occupies both hands, so it can't share with a shield.
  if (def.bow && P.eq.shield) { stowOrDrop(P.eq.shield); P.eq.shield = null; }
  if (slot === "shield" && P.eq.weapon && ITEMS[P.eq.weapon].bow) {
    stowOrDrop(P.eq.weapon); P.eq.weapon = null;
  }
  refreshDerived(P);
  tone(420, 0.1, "triangle", 0.05);
}

/** Take off whatever is worn in `slot`, into the pack. */
export function unequip(g: Game, slot: EqSlot): void {
  const P = g.player;
  const cur = P.eq[slot];
  if (!cur) return;
  // worn gear is carried weight already (Etap 3.1e), so moving it into the
  // pack changes nothing on the scales — only room can refuse it
  if (addItem(P.bag, cur, 1) > 0) { tell(g, "bag full"); return; }
  P.eq[slot] = null;
  refreshDerived(P);
  tone(300, 0.08, "triangle", 0.05);
}

/** Load the next kind of arrow the pack holds. */
export function cycleAmmo(g: Game): void {
  const P = g.player;
  const next = cycleArrow(P.bag, P.ammo);
  if (!next) { tell(g, "no ammo to load", "#cfa86a"); return; }
  P.ammo = next;
  tell(g, `ammo: ${ITEMS[next].name}`, "#ffe9a8");
  tone(520, 0.05, "sine", 0.04, 60);
}

/**
 * The one place gold and platinum actually change denomination: Morgan's
 * counter in Bonetown.
 *
 * It used to be a right-click on a coin slot and a button in the quantity
 * dialog. Both are gone — a wallet that folds itself up anywhere in the world
 * makes the weight of money meaningless, and Tibia always made you walk back
 * to a banker for it. `n` is how many platinum coins are being made or broken;
 * the amount buttons in the window work it out from what the bag can take.
 *
 * The weight check is only ever needed going DOWN: a hundred gold weigh ten
 * ounces against the platinum coin's tenth of one. `maxExchange` applies the
 * same limit when it sizes the Max button, so this is the backstop for x1 and
 * x10, not the usual path.
 */
export function changeCoins(g: Game, to: "goldCoin" | "platinumCoin", n: number): void {
  const P = g.player;
  // only over Morgan's counter, to whoever is standing at it
  if (!nearNpc(g, (q) => q.key === "morgan")) { tell(g, "too far away", "#d96a5a"); return; }
  if (to === "goldCoin") {
    const added = (ITEMS.goldCoin.weight * 100 - ITEMS.platinumCoin.weight) * n;
    if (added > freeCap(P)) { tell(g, "too heavy", "#d96a5a"); return; }
  }
  if (!exchangeCoins(P.bag, to, n)) { tell(g, "no room in bag", "#d96a5a"); return; }
  tell(g, to === "platinumCoin" ? `+${n} platinum` : `+${n * 100} gold`, "#ffe9a8");
  sound("coins");
}

/**
 * Quick weapon swap: toggles the equipped weapon between a bow and a melee
 * weapon, pulling the best matching spare from the pack. Reuses the normal
 * equip path so the two-handed bow↔shield rule and bag stow-away still apply.
 *
 * The CHOICE is made in `systems/loadout.ts` and only carried out here — see
 * that file for the two bugs that split it in half, both of which were about
 * what the search could see rather than about what the button does.
 */
export function swapWeapon(g: Game): void {
  const P = g.player;
  if (P.dead) return;
  const plan = planSwap(P.bag, P.eq.weapon, P.eq.shield);
  if (refused(plan)) {
    if (plan.no === "room") {
      tell(g, "no room to stow the shield", "#e0a06a");
    } else {
      tell(g, plan.toBow ? "no bow in your pack" : "no melee weapon in your pack", "#e0a06a");
    }
    return;
  }
  equipItem(g, plan.weapon); // removes from the tree, equips, stows the previous
  if (plan.shield) equipItem(g, plan.shield);
  tell(g, `equipped ${ITEMS[plan.weapon].name}`, "#b9e07f");
}
