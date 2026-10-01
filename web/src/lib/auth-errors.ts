/**
 * What Supabase Auth answers, turned into sentences a player can act on.
 * Pure functions, no DOM and no network, so the smoke suite can test them.
 */

export const SUPPORT_EMAIL = "kontakt@xebeka.com";
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

interface AuthLikeError {
  name?: string;
  code?: string;
  status?: number;
  message?: string;
}

function asAuthError(err: unknown): AuthLikeError {
  return err && typeof err === "object" ? (err as AuthLikeError) : { message: String(err) };
}

/** The wait Supabase asks for, from "...you can only request this after 42 seconds." */
export function waitSeconds(message: string | undefined): number | null {
  const m = /after (\d+) seconds?/i.exec(message ?? "");
  return m ? Number(m[1]) : null;
}

export function isNetworkError(err: unknown): boolean {
  const e = asAuthError(err);
  return e.name === "AuthRetryableFetchError" || e.status === 0;
}

/** A link that has run out or was already used: /confirm/ offers a new one. */
export function isExpiredLink(err: unknown): boolean {
  const e = asAuthError(err);
  return e.code === "otp_expired" || (e.status === 403 && !isNetworkError(e));
}

export function authErrorMessage(err: unknown): string {
  const e = asAuthError(err);
  const code = e.code ?? "";
  const message = e.message ?? "";
  if (isNetworkError(e)) return "Could not reach the server. Check your connection and try again.";
  if (code === "captcha_failed" || /captcha/i.test(message)) {
    return "The check that you are not a bot did not pass. Reload the page and try again. "
      + "If you use a script blocker, allow challenges.cloudflare.com.";
  }
  switch (code) {
    case "invalid_credentials":
      return "Wrong email or password.";
    case "email_not_confirmed":
      return "Confirm your email address first, with the link we sent when you created the account.";
    case "user_already_exists":
    case "email_exists":
      return "This email address already has an account. Log in, or reset the password if you forgot it.";
    case "weak_password":
      return `Use a password of at least ${PASSWORD_MIN} characters.`;
    case "reauthentication_needed":
      return "For your safety, log out and log in again first.";
    case "same_password":
      return "Choose a password different from your current one.";
    case "email_address_invalid":
      return "Enter a valid email address.";
    case "otp_expired":
      return "This link has expired or has already been used.";
    case "over_email_send_rate_limit": {
      const s = waitSeconds(message);
      return s !== null
        ? `Wait ${s} seconds before asking for another email.`
        : "Too many emails have gone out in the last hour. Try again later.";
    }
    case "over_request_rate_limit":
      return "Too many attempts from your connection. Wait a few minutes and try again.";
    case "signup_disabled":
      return "New accounts cannot be created right now.";
    case "user_banned":
      return `This account is blocked. Write to ${SUPPORT_EMAIL} to find out why.`;
    case "session_not_found":
    case "refresh_token_not_found":
      return "Your session has ended. Log in again.";
  }
  const ref = code || (e.status ? `error ${e.status}` : "");
  return `Something went wrong${ref ? ` (${ref})` : ""}. Try again, and if it keeps happening, write to ${SUPPORT_EMAIL}.`;
}

/** Where to go after logging in: a path on this site, never another site. */
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  return raw;
}

/** A light check before bothering the server; the server has the last word. */
export function emailLooksValid(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
