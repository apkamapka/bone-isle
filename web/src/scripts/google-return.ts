import { authErrorMessage } from "../lib/auth-errors.ts";
import { el, showView } from "../lib/forms.ts";
import { matchPending, parseGoogleReturn, takePendingRaw } from "../lib/google.ts";
import { supabase } from "../lib/supabase.ts";
import { TERMS_VERSION } from "../site.ts";

/* Google sends the player back here, with the ID token after the #. */

function fail(text: string): void {
  el("error").textContent = text;
  showView("failed");
}

async function main(): Promise<void> {
  const back = parseGoogleReturn(location.hash);
  // The token leaves the address bar and the history before anything else.
  history.replaceState(null, "", location.pathname);
  const pending = matchPending(takePendingRaw(), back.state, Date.now());

  if (back.error === "access_denied") return showView("cancelled");
  if (back.error) return fail(`Google could not log you in (${back.error}). Try again.`);
  if (!back.idToken || !pending) {
    return fail("This Google sign-in has expired or was already used. Start it again from the log-in page.");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: back.idToken, nonce: pending.nonce });
  if (error) return fail(authErrorMessage(error));

  // The notice under the Google button is the acceptance; its date stays with
  // the account, as it does for an account made by email.
  if (!data.user?.user_metadata?.terms_accepted) {
    await supabase.auth.updateUser({ data: { terms_accepted: TERMS_VERSION } });
  }
  location.replace(pending.next);
}

void main();
