/**
 * Switches and public keys that change the whole site at once.
 *
 * WORLD_OPEN stays false until etap 1.12. While it is false the home page says
 * "Not open yet", and so does the top bar to anyone not logged in; a logged-in
 * player gets Play there (etap 1.9: /play/ itself asks for a login and lists
 * the account's characters). Flip it to true on opening day and Play lights up
 * for everyone, on every page.
 */
export const WORLD_OPEN = false;

/*
 * Supabase: the project's address and its PUBLISHABLE key. Both are public by
 * design; what they can reach is decided by the database's own rules (etap
 * 1.3). The secret key never goes into this repo.
 */
export const SUPABASE_URL = "https://yjtojtvakkcokomrzcyh.supabase.co";
export const SUPABASE_KEY = "sb_publishable_MJn1iEgInCW3zhRHxCip7w_4AhEygnn";

/* Where the browser keeps the login session. The game at /play/ reads the same
 * key (src/net/account.ts), so the site and the game stay logged in together. */
export const AUTH_STORAGE_KEY = "sb-yjtojtvakkcokomrzcyh-auth-token";

/*
 * Cloudflare Turnstile, the bot check on the account forms. Paste the widget's
 * SITE key between the quotes (it is public; the secret key goes only into
 * Supabase). While this is empty the forms work without the check, so turn on
 * CAPTCHA protection in Supabase only once the site with the key is live,
 * or every sign-up and log-in will be refused.
 */
export const TURNSTILE_SITE_KEY = "0x4AAAAAAFFga6j554FH6gZD";

/* The date of the Terms of Service a new account accepts, kept with the
 * account. Change it together with "Last updated" in terms.astro. */
export const TERMS_VERSION = "2026-09-29";
