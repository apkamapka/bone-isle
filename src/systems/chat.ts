/**
 * Chat: channels, the message log, and the bubbles over people's heads.
 *
 * WHY THIS IS NOT A PANEL
 * -----------------------
 * The obvious build is a chat WINDOW — another entry in `PanelKind`, another
 * tab, another thing that docks. It is the wrong build, and the reason is the
 * phone: a portrait screen holds two panel sheets, and handing one of them
 * permanently to a log means that with your backpack open there is nowhere
 * left to put a corpse. Chat is the one surface you want visible at all times
 * and never want to spend a slot on.
 *
 * So the log is TEXT ON THE WORLD — no frame, no title bar, no slot — and the
 * only chrome it owns is the input field, which exists solely while you are
 * typing. That is also how Tibia does it, and how every mobile client that
 * copied Tibia does it, for the same reasons.
 *
 * THE KEYBOARD IS THE HIDDEN COST
 * -------------------------------
 * On Android the soft keyboard takes roughly two fifths of the screen height.
 * Whatever the input field is anchored to, it has to be anchored to something
 * that MOVES when the keyboard opens, or it is simply underneath it. That is
 * why the field is a real DOM input positioned against `visualViewport`
 * (see ui/chatInput.ts) rather than something drawn on the canvas: the canvas
 * has no idea the keyboard exists.
 *
 * MULTIPLAYER IS WHY THE SHAPE IS THIS SHAPE
 * ------------------------------------------
 * Nothing here needs channels yet — one player has nobody to talk to. They are
 * modelled now because the alternative is a flat message list that has to be
 * torn apart the day Trade and Party arrive, and because the throttle, the
 * unread count and the per-channel colour are all decisions that are cheap now
 * and invasive later. The channels that cannot work yet are marked `live:
 * false` and say so when opened, rather than being absent and appearing from
 * nowhere later.
 */
import { nextEntityId } from "../world/entities.ts";

export type ChannelId =
  | "local"   // spoken aloud; everyone who can see you hears it
  | "loot"    // what fell out of what
  | "server"  // the game talking to you: level-ups, warnings, refusals
  | "trade"   // the marketplace channel
  | "party"
  | "guild"
  | "pm";     // one-to-one

export interface ChannelDef {
  id: ChannelId;
  /** Full name, for the channel picker. */
  name: string;
  /** Two or three letters, for the tab. */
  short: string;
  color: string;
  /** Can you type into it, or is it a log the game writes? */
  writable: boolean;
  /** Working today, or waiting for a second player? */
  live: boolean;
  /**
   * Seconds between messages. Tibia puts two whole minutes on its advertising
   * channel, which sounds absurd until you have watched an unthrottled trade
   * channel — the delay IS the moderation, and it costs nothing to honest use.
   */
  delayS?: number;
}

export const CHANNELS: readonly ChannelDef[] = [
  { id: "local", name: "Local Chat", short: "SAY", color: "#f3eedd", writable: true, live: true, delayS: 0.6 },
  { id: "loot", name: "Loot", short: "LOOT", color: "#caa15a", writable: false, live: true },
  { id: "server", name: "Server Log", short: "LOG", color: "#8ab6ff", writable: false, live: true },
  { id: "trade", name: "Trade", short: "TRADE", color: "#6fc06a", writable: true, live: false, delayS: 120 },
  { id: "party", name: "Party", short: "PARTY", color: "#e8c06a", writable: true, live: false, delayS: 0.6 },
  { id: "guild", name: "Guild", short: "GUILD", color: "#b9a6d8", writable: true, live: false, delayS: 0.6 },
  { id: "pm", name: "Private", short: "PM", color: "#ffb3a8", writable: true, live: false, delayS: 0.6 },
];

export function channel(id: ChannelId): ChannelDef {
  return CHANNELS.find((c) => c.id === id) ?? CHANNELS[0];
}

/** Channels that work today. The rest are shown, but greyed and explained. */
export const LIVE_CHANNELS: readonly ChannelDef[] = CHANNELS.filter((c) => c.live);

export interface ChatLine {
  id: number;
  ch: ChannelId;
  /** Who said it. Absent on lines the game itself writes. */
  from?: string;
  text: string;
  color: string;
  /** Seconds since it arrived — the overlay fades old lines out. */
  age: number;
}

/**
 * How many lines are kept. Small on purpose: this is a log you glance at, not
 * a transcript you scroll, and an unbounded array in a game that writes a line
 * every time you pick up a coin is a slow leak.
 */
export const CHAT_HISTORY = 120;

/** How many lines the world overlay shows at once. */
export const OVERLAY_LINES = 6;

/** After this many seconds a line fades off the overlay. It stays in the log. */
export const OVERLAY_FADE_S = 12;

/** How long a bubble hangs over a speaker's head. */
export const BUBBLE_S = 4.5;

/** A line of speech floating over an entity, addressed BY ID. */
export interface Bubble {
  /** The entity saying it — a creature, an NPC, or another player. */
  entity: number;
  text: string;
  color: string;
  t: number;
}

interface ChatState {
  lines: ChatLine[];
  bubbles: Bubble[];
  /** Per channel: lines added since it was last read. */
  unread: Partial<Record<ChannelId, number>>;
  /** Per channel: seconds until the throttle lets another message through. */
  cooldown: Partial<Record<ChannelId, number>>;
  /** The channel the input field will send to. */
  active: ChannelId;
}

const state: ChatState = { lines: [], bubbles: [], unread: {}, cooldown: {}, active: "local" };

/** Wipe everything (new game / test isolation). */
export function resetChat(): void {
  state.lines.length = 0;
  state.bubbles.length = 0;
  state.unread = {};
  state.cooldown = {};
  state.active = "local";
}

export function activeChannel(): ChannelId {
  return state.active;
}

export function setActiveChannel(id: ChannelId): void {
  state.active = id;
  state.unread[id] = 0;
}

/** Every line, oldest first. */
export function chatLines(): readonly ChatLine[] {
  return state.lines;
}

/** The lines from one channel, oldest first. */
export function linesIn(id: ChannelId): ChatLine[] {
  return state.lines.filter((l) => l.ch === id);
}

/** Unread count for a channel, or across all of them. */
export function unread(id?: ChannelId): number {
  if (id) return state.unread[id] ?? 0;
  let n = 0;
  for (const c of CHANNELS) n += state.unread[c.id] ?? 0;
  return n;
}

export function markRead(id: ChannelId): void {
  state.unread[id] = 0;
}

export function markAllRead(): void {
  state.unread = {};
}

/**
 * Put a line in the log.
 *
 * Everything the game says to the player goes through here, which is the point
 * of building it now rather than later: `flash()` already existed and already
 * had a hundred and thirty call sites, and every one of them was a message
 * that vanished after a second with no way to look at it again. They keep
 * their float — a refusal you have to read in a log is a refusal you miss —
 * but they are also recorded.
 */
export function push(ch: ChannelId, text: string, from?: string, color?: string): ChatLine {
  const line: ChatLine = {
    id: nextEntityId(), ch, from, text,
    color: color ?? channel(ch).color, age: 0,
  };
  state.lines.push(line);
  if (state.lines.length > CHAT_HISTORY) state.lines.splice(0, state.lines.length - CHAT_HISTORY);
  if (ch !== state.active) state.unread[ch] = (state.unread[ch] ?? 0) + 1;
  return line;
}

/** The game talking: refusals, warnings, level-ups. */
export function logServer(text: string, color?: string): ChatLine {
  return push("server", text, undefined, color);
}

/** What fell out of what. */
export function logLoot(text: string): ChatLine {
  return push("loot", text);
}

export type SayResult =
  | { ok: true; line: ChatLine }
  | { ok: false; reason: "throttled"; waitS: number }
  | { ok: false; reason: "not-yet" }
  | { ok: false; reason: "read-only" }
  | { ok: false; reason: "empty" };

/**
 * Send a message to a channel as the player.
 *
 * Returns a refusal rather than throwing or silently dropping, because every
 * refusal here has to be explainable to the person typing: "that channel is
 * not open yet", "wait another ninety seconds". A message that just does not
 * appear reads as a bug.
 */
export function say(ch: ChannelId, text: string, speaker: string, speakerId?: number): SayResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  const def = channel(ch);
  if (!def.writable) return { ok: false, reason: "read-only" };
  if (!def.live) return { ok: false, reason: "not-yet" };
  const cd = state.cooldown[ch] ?? 0;
  if (cd > 0) return { ok: false, reason: "throttled", waitS: cd };

  state.cooldown[ch] = def.delayS ?? 0;
  const line = push(ch, trimmed, speaker);
  // Local speech also appears over the speaker's head, which is where it is
  // actually read — the log is the record, the bubble is the conversation.
  if (ch === "local" && speakerId !== undefined) bubble(speakerId, trimmed, def.color);
  return { ok: true, line };
}

/** Put a line of speech over an entity's head. */
export function bubble(entity: number, text: string, color = "#f3eedd"): void {
  // one bubble per speaker: a second line replaces the first rather than
  // stacking, so a chatterbox cannot build a tower over their own sprite
  const existing = state.bubbles.findIndex((b) => b.entity === entity);
  if (existing >= 0) state.bubbles.splice(existing, 1);
  state.bubbles.push({ entity, text, color, t: BUBBLE_S });
}

/** Bubbles still on screen. */
export function bubbles(): readonly Bubble[] {
  return state.bubbles;
}

/** The bubble over one entity, if any. */
export function bubbleFor(entity: number): Bubble | undefined {
  return state.bubbles.find((b) => b.entity === entity);
}

/** Age the log, the bubbles and the throttles. */
export function tickChat(dt: number): void {
  for (const l of state.lines) l.age += dt;
  for (let i = state.bubbles.length - 1; i >= 0; i--) {
    state.bubbles[i].t -= dt;
    if (state.bubbles[i].t <= 0) state.bubbles.splice(i, 1);
  }
  for (const c of CHANNELS) {
    const cd = state.cooldown[c.id];
    if (cd !== undefined && cd > 0) state.cooldown[c.id] = Math.max(0, cd - dt);
  }
}

/** Seconds before this channel will accept another message. */
export function cooldownLeft(ch: ChannelId): number {
  return state.cooldown[ch] ?? 0;
}

/**
 * The lines the world overlay should draw right now: the newest few, still
 * young enough to be worth the space, oldest first.
 *
 * Deliberately drawn from ALL channels rather than the active one. On a phone
 * there is room for six lines and no room for a tab bar above them, and a
 * player who has to switch channels to notice that somebody messaged them has
 * a chat that does not work. The channel colour is what tells them apart.
 */
export function overlayLines(n = OVERLAY_LINES): ChatLine[] {
  const out: ChatLine[] = [];
  for (let i = state.lines.length - 1; i >= 0 && out.length < n; i--) {
    if (state.lines[i].age < OVERLAY_FADE_S) out.push(state.lines[i]);
  }
  return out.reverse();
}

/** How solid a line should be drawn, 0..1. */
export function lineAlpha(l: ChatLine): number {
  const left = OVERLAY_FADE_S - l.age;
  return left <= 0 ? 0 : Math.min(1, left / 2);
}

/** "Guard: hello there" — how a line reads on one row. */
export function formatLine(l: ChatLine): string {
  return l.from ? `${l.from}: ${l.text}` : l.text;
}
