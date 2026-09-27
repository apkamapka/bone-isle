import { AUTH_STORAGE_KEY } from "../site.ts";

/**
 * The top bar's corner for a logged-in player: their email (on wide screens)
 * and Log out. A visitor with no session in storage has never logged in on
 * this browser, so the Supabase client is not even downloaded for them.
 */

let wired = false;

function paint(email: string | null): void {
  const box = document.querySelector<HTMLElement>("[data-account]");
  const label = document.querySelector<HTMLElement>("[data-account-email]");
  if (!box || !label) return;
  box.hidden = email === null;
  label.textContent = email ?? "";
  label.title = email ?? "";
  document.querySelectorAll<HTMLElement>("[data-login]").forEach((a) => {
    a.hidden = email !== null;
  });
  document.documentElement.classList.toggle("is-signed-in", email !== null);
}

/** Logs out of this browser only; other devices stay logged in. */
export async function logOut(): Promise<void> {
  const { supabase } = await import("./supabase.ts");
  const { error } = await supabase.auth.signOut({ scope: "local" });
  // Offline, Supabase keeps the session to retry; leaving this browser must still work.
  if (error) {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      /* storage blocked: there was nothing kept to remove */
    }
  }
  location.reload();
}

export async function refreshAccountBar(): Promise<void> {
  const { supabase } = await import("./supabase.ts");
  const { data } = await supabase.auth.getSession();
  paint(data.session?.user.email ?? null);
  if (wired) return;
  wired = true;
  supabase.auth.onAuthStateChange((_event, session) => paint(session?.user.email ?? null));
  document.querySelectorAll<HTMLButtonElement>("[data-logout]").forEach((b) =>
    b.addEventListener("click", () => {
      b.disabled = true;
      void logOut();
    }),
  );
}

export function initAccountBar(): void {
  let stored = false;
  try {
    stored = localStorage.getItem(AUTH_STORAGE_KEY) !== null;
  } catch {
    /* storage blocked: nobody can be logged in */
  }
  if (stored) void refreshAccountBar();
}
