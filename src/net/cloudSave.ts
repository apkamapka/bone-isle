/**
 * The save in the database (etap 1.10): one per character.
 *
 *   enter   Once a character is picked, boot.ts calls enterWorld(). The
 *           database hands back its save (null for a new character) and a
 *           session: proof that this window is where the character is played
 *           from. Entering it from another window or device later hands out a
 *           new session, and this one stops counting. The newest entry wins.
 *   record  save.ts gives every save to record(); main.ts saves every 5
 *           seconds and after anything that matters. Until the database has
 *           it, the save is also kept in this browser, so a lost connection or
 *           a tab closed too fast loses nothing: the next entry here sends it
 *           along, unless the character was entered elsewhere in between.
 *   push    Once a minute, on Ctrl+L or Logout, and when the tab is hidden or
 *           closed, the newest save goes to the database. If the database
 *           says the character was entered elsewhere since, this window writes
 *           nothing more and goes back to the character list with a notice.
 *
 * The database side is supabase/003-saves.sql. Where nobody logged in
 * (`npm run dev`, the smoke suite) nothing here runs, and save.ts keeps its
 * single slot in localStorage, as before accounts.
 */
import { SUPABASE_KEY, SUPABASE_URL, freshSession, refresh, type Session } from "./account.ts";

/** The save from before accounts: one slot per browser, removed on the first entry. */
export const LEGACY_SAVE_KEY = "bone-isle-save-v2";
/** Prefix of a character's newest save while the database does not have it yet. */
export const PENDING_PREFIX = "xebeka.pending.";
/** A sentence for the character list, carried across the reload that leads there. */
export const NOTICE_KEY = "xebeka.notice";
/** What save.ts throws when a character's save exists but cannot be read. */
export const SAVE_UNREADABLE = "save-unreadable";

/** How often the newest save goes to the database, if anything changed. */
export const PUSH_EVERY_MS = 60_000;
/** The login is refreshed with this much left, so a closing tab always has a valid one. */
export const AUTH_MARGIN_MS = 5 * 60_000;
/** Browsers refuse bigger bodies from a closing tab (64 KB for all of its requests together). */
export const LEAVE_MAX_BYTES = 60_000;

export const NOTICE_ELSEWHERE = "This character has entered the world from another window or device.";
export const NOTICE_GONE = "This character can no longer be played.";
export const NOTICE_LOGIN = "Your login has expired. Please log in again.";

export type EnterResult = "ok" | "gone" | "login";
/**
 * "saved": the database has the newest save, or there was nothing new.
 * "failed": it could not be reached; the save stays kept here and goes later.
 * "ended": this window no longer holds the character and is on its way back
 * to the list.
 */
export type PushResult = "saved" | "failed" | "ended";

interface Held {
  readonly id: string;
  readonly session: string;
}

/** The character this window holds, with the session its entry was given. */
let held: Held | null = null;
/** The login, as fresh as the last check left it; a closing tab uses it as it is. */
let auth: Session | null = null;
/** The save handed over on entry, as JSON; null for a new character. */
let entered: string | null = null;
/** The newest save this window made, as JSON. */
let latest: string | null = null;
/** The save the database holds, as far as this window knows. */
let confirmed: string | null = null;
/** A save on its way, so a hidden-then-closed tab does not send it twice. */
let sending: string | null = null;
let ended = false;
let inflight: Promise<PushResult> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

const defaultSend: typeof fetch = (input, init) => fetch(input, init);
const defaultLeave = (): void => location.reload();
let send: typeof fetch = defaultSend;
let leave: () => void = defaultLeave;

/** Does this window hold a character? False where nobody logged in. */
export function online(): boolean {
  return held !== null;
}

/** The save the database handed over on entry, as JSON; null for a new character. */
export function enteredSave(): string | null {
  return entered;
}

const pendingKey = (id: string): string => PENDING_PREFIX + id;

/** The save an earlier visit kept in this browser, with the session it was made under. */
function readPending(id: string): { session: string; save: string } | null {
  let text: string | null;
  try {
    text = localStorage.getItem(pendingKey(id));
  } catch {
    return null;
  }
  if (!text) return null;
  try {
    const o = JSON.parse(text) as { s?: unknown; d?: unknown };
    if (typeof o.s !== "string" || !o.d || typeof o.d !== "object" || Array.isArray(o.d)) return null;
    return { session: o.s, save: JSON.stringify(o.d) };
  } catch {
    return null;
  }
}

function writePending(h: Held, save: string): void {
  try {
    localStorage.setItem(pendingKey(h.id), `{"s":${JSON.stringify(h.session)},"d":${save}}`);
  } catch {
    /* storage full or blocked: the database copy is the one that matters */
  }
}

/** Forget the kept save, but only this window's own: another tab may hold the character now. */
function dropPending(h: Held): void {
  const kept = readPending(h.id);
  if (kept && kept.session !== h.session) return;
  try {
    localStorage.removeItem(pendingKey(h.id));
  } catch {
    /* blocked */
  }
}

const rpc = (fn: string): string => `${SUPABASE_URL}/rest/v1/rpc/${fn}`;

const headers = (s: Session): Record<string, string> => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${s.accessToken}`,
  "Content-Type": "application/json",
});

/** save_character's arguments. Without a save it only asks whether this window still holds the character. */
function saveArgs(h: Held, save: string | null): string {
  const tail = save === null ? "" : `,"p_save":${save}`;
  return `{"p_id":${JSON.stringify(h.id)},"p_session":${JSON.stringify(h.session)}${tail}}`;
}

function byteLength(text: string): number {
  return typeof TextEncoder === "undefined" ? text.length * 3 : new TextEncoder().encode(text).length;
}

/**
 * Enter the world as this character. A save an earlier visit kept in this
 * browser goes along; the database keeps it only if nobody entered the
 * character since. Throws when the database cannot be reached.
 */
export async function enterWorld(s: Session, id: string): Promise<EnterResult> {
  const kept = readPending(id);
  const resume = kept ? `,"p_resume_session":${JSON.stringify(kept.session)},"p_resume_save":${kept.save}` : "";
  const r = await send(rpc("enter_character"), {
    method: "POST",
    headers: headers(s),
    body: `{"p_id":${JSON.stringify(id)}${resume}}`,
  });
  if (r.status === 401 || r.status === 403) return "login";
  if (!r.ok) throw new Error(`enter_character ${r.status}`);
  const o = (await r.json()) as { status?: unknown; session?: unknown; save?: unknown } | null;
  if (o?.status === "gone") return "gone";
  if (o?.status !== "ok" || typeof o.session !== "string") throw new Error("enter_character: no session");
  stopAutosave();
  held = { id, session: o.session };
  auth = s;
  // Anything but null goes to save.ts, which refuses to start over on top of
  // a save it cannot read rather than overwrite it with a new character.
  entered = o.save === null || o.save === undefined ? null : JSON.stringify(o.save);
  confirmed = entered;
  latest = null;
  sending = null;
  inflight = null;
  ended = false;
  try {
    // The database has decided about the kept save either way.
    localStorage.removeItem(pendingKey(id));
    // Before accounts everybody shared this one slot; every character now
    // starts from its own save, a new one from level 1 (decided for 1.10).
    localStorage.removeItem(LEGACY_SAVE_KEY);
  } catch {
    /* blocked */
  }
  return "ok";
}

/** The newest save of this window: save.ts calls this instead of writing localStorage. */
export function record(save: unknown): void {
  if (!held || ended) return;
  latest = JSON.stringify(save);
  if (latest === confirmed) dropPending(held);
  else writePending(held, latest);
}

/** Send the newest save now; resolves once the database has answered. */
export function push(): Promise<PushResult> {
  if (!held) return Promise.resolve("saved");
  if (ended) return Promise.resolve("ended");
  if (inflight) return inflight.then(() => push());
  const run = pushNow(held);
  inflight = run;
  void run.finally(() => {
    if (inflight === run) inflight = null;
  });
  return run;
}

async function pushNow(h: Held): Promise<PushResult> {
  const save = latest;
  if (save === null || save === confirmed) return "saved";
  let s: Session | null;
  try {
    s = await keepAuth();
  } catch {
    return "failed";
  }
  if (!s) return end(NOTICE_LOGIN, false);
  if (ended || held !== h) return "ended";
  sending = save;
  try {
    let r = await send(rpc("save_character"), { method: "POST", headers: headers(s), body: saveArgs(h, save) });
    if (r.status === 401 || r.status === 403) {
      // Refused although it looked fresh (revoked, logged out elsewhere): one refresh, then log in again.
      const again = await refresh(s);
      if (!again) return end(NOTICE_LOGIN, false);
      auth = again;
      r = await send(rpc("save_character"), { method: "POST", headers: headers(again), body: saveArgs(h, save) });
    }
    return await settle(h, save, r);
  } catch {
    return "failed";
  } finally {
    if (sending === save) sending = null;
  }
}

/** What the database said to a save (or, with `save` null, to the question whether this window still holds the character). */
async function settle(h: Held, save: string | null, r: Response): Promise<PushResult> {
  if (ended || held !== h) return "ended";
  if (r.status === 401 || r.status === 403) return end(NOTICE_LOGIN, false);
  if (!r.ok) return "failed";
  const answer = (await r.json()) as unknown;
  if (answer === "ok") {
    if (save !== null) {
      confirmed = save;
      if (latest === save) dropPending(h);
    }
    return "saved";
  }
  if (answer === "elsewhere") return end(NOTICE_ELSEWHERE, true);
  if (answer === "gone") return end(NOTICE_GONE, true);
  return "failed";
}

/**
 * This window is done with the character: nothing more is written, and the
 * page goes back to the character list, which shows the notice. A login that
 * ran out keeps the kept save, which goes with the next entry here; a
 * character entered elsewhere or deleted drops it.
 */
function end(notice: string, dropKept: boolean): "ended" {
  if (!ended) {
    ended = true;
    stopAutosave();
    if (dropKept && held) dropPending(held);
    try {
      sessionStorage.setItem(NOTICE_KEY, notice);
    } catch {
      /* the list shows without it */
    }
    leave();
  }
  return "ended";
}

/** The login, refreshed once under five minutes are left; null means log in again. Throws when offline. */
async function keepAuth(): Promise<Session | null> {
  const s = await freshSession(AUTH_MARGIN_MS);
  if (s) auth = s;
  return s;
}

/**
 * The tab is being hidden or closed: send the newest save without waiting.
 * The browser finishes the request even after the page is gone (keepalive).
 * Whatever does not make it is still kept here and goes with the next entry.
 */
export function sendOnLeave(nowMs: number = Date.now()): void {
  const h = held;
  const s = auth;
  const save = latest;
  if (!h || !s || ended || save === null || save === confirmed || save === sending) return;
  if (s.expiresAt * 1000 - nowMs < 10_000) return;
  const body = saveArgs(h, save);
  if (byteLength(body) > LEAVE_MAX_BYTES) return;
  sending = save;
  let req: Promise<Response>;
  try {
    req = send(rpc("save_character"), { method: "POST", headers: headers(s), body, keepalive: true });
  } catch {
    sending = null;
    return;
  }
  req
    .then((r) => settle(h, save, r))
    .catch(() => "failed" as const)
    .finally(() => {
      if (sending === save) sending = null;
    });
}

/** The tab is back in view: is the character still this window's? If not, back to the list. */
export function checkIn(): void {
  const h = held;
  if (!h || ended || inflight) return;
  void (async () => {
    try {
      const s = await keepAuth();
      if (!s) {
        end(NOTICE_LOGIN, false);
        return;
      }
      const r = await send(rpc("save_character"), { method: "POST", headers: headers(s), body: saveArgs(h, null) });
      await settle(h, null, r);
    } catch {
      /* offline: the next push asks again */
    }
  })();
}

/** Once a minute: the newest save to the database, and the login kept fresh. */
export function startAutosave(): void {
  if (!held || timer !== null) return;
  timer = setInterval(() => void autosaveTick(), PUSH_EVERY_MS);
}

function stopAutosave(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
}

/** One minute's work. */
export async function autosaveTick(): Promise<void> {
  if (!held || ended) return;
  if (latest !== null && latest !== confirmed) {
    await push();
    return;
  }
  try {
    if (!(await keepAuth())) end(NOTICE_LOGIN, false);
  } catch {
    /* offline: next minute */
  }
}

/** The notice left for the character list, handed out once. */
export function takeNotice(): string | null {
  try {
    const n = sessionStorage.getItem(NOTICE_KEY);
    if (n !== null) sessionStorage.removeItem(NOTICE_KEY);
    return n;
  } catch {
    return null;
  }
}

/** For the smoke suite: another way back to the list than a reload. */
export function setLeave(fn: () => void): void {
  leave = fn;
}

/** For the smoke suite: as if nobody had entered. */
export function resetCloudSave(): void {
  stopAutosave();
  held = null;
  auth = null;
  entered = null;
  latest = null;
  confirmed = null;
  sending = null;
  inflight = null;
  ended = false;
  send = defaultSend;
  leave = defaultLeave;
}
