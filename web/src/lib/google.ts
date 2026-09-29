import { safeNext } from "./auth-errors.ts";
import { say } from "./forms.ts";

/**
 * Continue with Google, with nothing from Google on our pages until a player
 * asks for it. The button sends the player to Google's own sign-in page, and
 * Google sends them back to /auth/google/ with an ID token: a note, signed by
 * Google, saying which Google account this is. That page hands the note to
 * Supabase, which checks Google's signature and logs the player in.
 *
 * Two random values guard the round trip. The state proves that whoever
 * comes back is who left from here, so a link someone else made is refused.
 * The nonce ties the token to this one attempt: Google gets its SHA-256,
 * Supabase gets the value itself and checks that the two match, so a token
 * caught on its way cannot be used again.
 */

/* Public by design: it names our site to Google. The secret stays in Supabase. */
export const GOOGLE_CLIENT_ID = "928956419315-s7q3tf5nk1pnemg1a3ulhrl3iakou92k.apps.googleusercontent.com";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
/* Registered in Google Cloud as the client's only redirect URI. */
export const GOOGLE_RETURN_PATH = "/auth/google/";
/** A trip to Google that takes longer than this is started again. */
export const PENDING_MAX_MS = 15 * 60 * 1000;

const STORE = "xebeka-google-signin";

export interface PendingSignIn {
  state: string;
  nonce: string;
  next: string;
  at: number;
}

export interface GoogleReturn {
  idToken: string | null;
  state: string | null;
  error: string | null;
}

function randomValue(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** SHA-256 in lowercase hex, the form Supabase compares the nonce in. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Google's sign-in page for one attempt. Only the email address is asked for. */
export function googleAuthUrl(o: { redirectUri: string; state: string; hashedNonce: string }): string {
  const q = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: o.redirectUri,
    response_type: "id_token",
    scope: "openid email",
    nonce: o.hashedNonce,
    state: o.state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${q.toString()}`;
}

/** What Google put after the # when it sent the player back. */
export function parseGoogleReturn(hash: string): GoogleReturn {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  return { idToken: p.get("id_token"), state: p.get("state"), error: p.get("error") };
}

/** The attempt a return belongs to, when it started here, recently. */
export function matchPending(raw: string | null, state: string | null, now: number): PendingSignIn | null {
  if (!raw || !state) return null;
  let p: Partial<PendingSignIn>;
  try {
    p = JSON.parse(raw) as Partial<PendingSignIn>;
  } catch {
    return null;
  }
  if (typeof p.state !== "string" || typeof p.nonce !== "string" || typeof p.at !== "number") return null;
  if (p.state !== state || now < p.at || now - p.at > PENDING_MAX_MS) return null;
  return { state: p.state, nonce: p.nonce, next: safeNext(p.next), at: p.at };
}

/** Reads the attempt and forgets it at once, so a return works only once. */
export function takePendingRaw(): string | null {
  try {
    const raw = sessionStorage.getItem(STORE);
    sessionStorage.removeItem(STORE);
    return raw;
  } catch {
    return null;
  }
}

/** Leaves for Google. `next` is where the player lands once logged in. */
export async function startGoogleSignIn(next: string): Promise<void> {
  const pending: PendingSignIn = { state: randomValue(), nonce: randomValue(), next: safeNext(next), at: Date.now() };
  sessionStorage.setItem(STORE, JSON.stringify(pending));
  const hashedNonce = await sha256Hex(pending.nonce);
  location.assign(googleAuthUrl({ redirectUri: location.origin + GOOGLE_RETURN_PATH, state: pending.state, hashedNonce }));
}

/**
 * Shows the Google option once Google's button picture has loaded
 * (web/public/art/google-signin.png); without that file it stays hidden.
 */
export function wireGoogleButton(next: string): void {
  const box = document.querySelector<HTMLElement>("[data-google]");
  const button = box?.querySelector<HTMLButtonElement>("button");
  const picture = box?.querySelector<HTMLImageElement>("img");
  const error = box?.querySelector<HTMLElement>("[data-google-error]");
  if (!box || !button || !picture || !error) return;
  const reveal = (): void => {
    if (picture.naturalWidth > 0) box.hidden = false;
  };
  if (picture.complete) reveal();
  else picture.addEventListener("load", reveal, { once: true });
  button.addEventListener("click", () => {
    button.disabled = true;
    say(error, null);
    startGoogleSignIn(next).catch(() => {
      button.disabled = false;
      say(error, "This browser blocks the storage that logging in with Google needs. Allow it, or log in with your email.");
    });
  });
  // Back from Google's page, the browser may restore this page as it was left.
  window.addEventListener("pageshow", () => {
    button.disabled = false;
  });
}
