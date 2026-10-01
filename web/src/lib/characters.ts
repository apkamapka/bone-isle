import { isNetworkError, SUPPORT_EMAIL } from "./auth-errors.ts";

/**
 * The account panel's rules and words. Pure functions, no DOM and no network,
 * so the smoke suite can test them. The name rules mirror create_character in
 * supabase/001-characters.sql, so most mistakes show before the server is
 * asked; the server still has the last word (taken and blocked names live
 * only there).
 */

export const MAX_CHARACTERS = 5;

export interface CharacterRow {
  id: string;
  name: string;
  sex: "male" | "female";
  created_at: string;
  delete_at: string | null;
}

export type NameCheck = { ok: true; name: string } | { ok: false; message: string };

/* Keyed by the exception names the database functions raise. */
const MESSAGES: Record<string, string> = {
  NAME_LENGTH: "A name is 3 to 20 characters long, spaces included.",
  NAME_CHARS: "Use only the letters A to Z, with spaces between words.",
  NAME_WORDS: "Use one to three words, each at least two letters long.",
  NAME_BLOCKED: "This name cannot be used. Choose another.",
  NAME_TAKEN: "Someone already has this name. Choose another.",
  CHAR_LIMIT: `An account holds ${MAX_CHARACTERS} characters. Delete one to make room.`,
  BAD_SEX: "Choose male or female.",
  NOT_AUTHENTICATED: "Your session has ended. Log in again.",
  NOT_FOUND: "That is no longer there. Reload the page.",
};

/** Tidies a name the way the server will, or says what is wrong with it. */
export function checkName(raw: string): NameCheck {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 20) return { ok: false, message: MESSAGES.NAME_LENGTH };
  if (!/^[A-Za-z ]+$/.test(name)) return { ok: false, message: MESSAGES.NAME_CHARS };
  const fixed = name
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  if (!/^[A-Z][a-z]+( [A-Z][a-z]+){0,2}$/.test(fixed)) return { ok: false, message: MESSAGES.NAME_WORDS };
  return { ok: true, name: fixed };
}

/** What a failed database call means to the player. */
export function rpcErrorMessage(err: { message?: string; code?: string; name?: string; status?: number } | null | undefined): string {
  const message = err?.message ?? "";
  const known = MESSAGES[message];
  if (known) return known;
  if (/failed to fetch|networkerror|load failed/i.test(message) || isNetworkError(err)) {
    return "Could not reach the server. Check your connection and try again.";
  }
  const ref = err?.code || message.slice(0, 40);
  return `Something went wrong${ref ? ` (${ref})` : ""}. Try again, and if it keeps happening, write to ${SUPPORT_EMAIL}.`;
}

export function sexLabel(sex: string): string {
  return sex === "female" ? "Female" : "Male";
}

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

export function formatDay(when: string | Date): string {
  return DAY.format(typeof when === "string" ? new Date(when) : when);
}

interface UserLike {
  app_metadata?: { providers?: unknown };
  user_metadata?: Record<string, unknown>;
}

function providers(u: UserLike): unknown[] {
  return Array.isArray(u.app_metadata?.providers) ? u.app_metadata.providers : [];
}

/**
 * Whether the account can log in with a password: made by email, or a Google
 * account whose player set one in the panel (Supabase lists no provider for
 * that, so the panel notes it in the account's metadata).
 */
export function hasPassword(u: UserLike): boolean {
  return providers(u).includes("email") || u.user_metadata?.password_set === true;
}

export function signInMethod(u: UserLike): string {
  const google = providers(u).includes("google");
  const password = hasPassword(u);
  if (google && password) return "You log in with Google, or with your email and password.";
  if (google) return "You log in with Google.";
  return "You log in with your email and password.";
}
