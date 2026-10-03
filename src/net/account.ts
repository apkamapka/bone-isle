/**
 * The game's side of the account (etap 1.9): the login the website left in
 * this browser, refreshed when it has run out, and the account's characters
 * with the name of each one's world (etap 1.10). The save itself lives in
 * net/cloudSave.ts.
 *
 * Plain `fetch` against Supabase's REST endpoints rather than supabase-js: the
 * game ships no production dependencies, and two calls do not justify the
 * first. The login is the one supabase-js keeps for the website under
 * AUTH_STORAGE_KEY (same origin, so the same storage). When the game refreshes
 * it, the new one is written back in the same shape and the website stays
 * logged in with it.
 *
 * The three values below are the ones in web/src/site.ts, and the smoke suite
 * keeps them equal. All three are public by design: what they can reach is
 * decided by the database's own rules (etap 1.3).
 */
import { isSex, type Sex } from "../systems/sex.ts";

export const SUPABASE_URL = "https://yjtojtvakkcokomrzcyh.supabase.co";
export const SUPABASE_KEY = "sb_publishable_MJn1iEgInCW3zhRHxCip7w_4AhEygnn";
export const AUTH_STORAGE_KEY = "sb-yjtojtvakkcokomrzcyh-auth-token";

/** Where a player with no login goes; the Log in page sends them straight back. */
export const LOGIN_URL = "/login/?next=/play/";
/** Where characters are created and deleted. */
export const ACCOUNT_URL = "/account/";
/** The character entered last time on this browser, selected first next time. */
export const LAST_CHARACTER_KEY = "xebeka.lastCharacter";

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
}

export interface CharacterRow {
  id: string;
  name: string;
  sex: Sex;
  /** When a scheduled deletion takes effect, or null. The character plays until then. */
  deleteAt: string | null;
  /** The name of the character's world (Pandora), or null if the database gave none. */
  world: string | null;
}

/** The login supabase-js keeps, read without supabase-js. Anything else is no login. */
export function parseSession(text: string | null): Session | null {
  if (!text) return null;
  let o: unknown;
  try {
    o = JSON.parse(text);
  } catch {
    return null;
  }
  // supabase-js 1 wrapped the session in { currentSession }; 2 stores it bare.
  const s = o && typeof o === "object" && "currentSession" in o ? (o as { currentSession: unknown }).currentSession : o;
  if (!s || typeof s !== "object") return null;
  const { access_token, refresh_token, expires_at } = s as Record<string, unknown>;
  if (typeof access_token !== "string" || !access_token || typeof refresh_token !== "string" || !refresh_token) return null;
  return { accessToken: access_token, refreshToken: refresh_token, expiresAt: typeof expires_at === "number" ? expires_at : 0 };
}

/** A token with under a minute left (or `marginMs`) is refreshed before it is used. */
export function isFresh(s: Session, nowMs: number = Date.now(), marginMs = 60_000): boolean {
  return s.expiresAt * 1000 - nowMs > marginMs;
}

/** The database's answer, kept to what the list needs; whatever is not a character is dropped. */
export function cleanRows(raw: unknown): CharacterRow[] {
  if (!Array.isArray(raw)) return [];
  const out: CharacterRow[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const { id, name, sex, delete_at, worlds } = r as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string" || !isSex(sex)) continue;
    // The world comes embedded as { name } (the characters_world_fkey join, 003).
    const world = worlds && typeof worlds === "object" ? (worlds as Record<string, unknown>).name : null;
    out.push({ id, name, sex, deleteAt: typeof delete_at === "string" ? delete_at : null, world: typeof world === "string" ? world : null });
  }
  return out;
}

/** Which row starts selected: the character entered last on this browser, else the first. */
export function preselect(rows: readonly CharacterRow[], lastId: string | null): number {
  const i = rows.findIndex((r) => r.id === lastId);
  return i >= 0 ? i : 0;
}

/** The note under a character waiting for deletion; null for every other. */
export function deletionNote(deleteAt: string | null, nowMs: number = Date.now()): string | null {
  if (!deleteAt) return null;
  const at = Date.parse(deleteAt);
  if (Number.isNaN(at)) return null;
  const days = Math.ceil((at - nowMs) / 86_400_000);
  return days <= 1 ? "deleted within a day" : `deleted in ${days} days`;
}

function stored(): string | null {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null; // storage blocked: nobody can be logged in
  }
}

/**
 * Trade the refresh token for a new login, kept where the website keeps it.
 * Null when the server refuses it (spent, revoked, logged out): log in again.
 * Throws when the server cannot be reached, which is not the login's fault.
 */
export async function refresh(s: Session): Promise<Session | null> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: s.refreshToken }),
  });
  if (r.status >= 500) throw new Error(`auth ${r.status}`);
  if (!r.ok) return null;
  const body = (await r.json()) as Record<string, unknown>;
  if (typeof body.expires_at !== "number" && typeof body.expires_in === "number") {
    body.expires_at = Math.floor(Date.now() / 1000) + body.expires_in;
  }
  const next = parseSession(JSON.stringify(body));
  if (next) {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(body));
    } catch {
      /* storage blocked: this visit still has it */
    }
  }
  return next;
}

/**
 * A login good for at least a minute (or `marginMs`), refreshed if it had to
 * be; null means log in again. It reads the stored login every time, so a
 * refresh the website did in another tab is picked up rather than repeated.
 */
export async function freshSession(marginMs = 60_000): Promise<Session | null> {
  const s = parseSession(stored());
  if (!s) return null;
  return isFresh(s, Date.now(), marginMs) ? s : refresh(s);
}

/** The account's characters, oldest first like the account page; "login" when the token is refused. */
export async function fetchCharacters(s: Session): Promise<CharacterRow[] | "login"> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/characters?select=id,name,sex,delete_at,worlds(name)&order=created_at.asc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.accessToken}` },
  });
  if (r.status === 401 || r.status === 403) return "login";
  if (!r.ok) throw new Error(`characters ${r.status}`);
  return cleanRows(await r.json());
}
