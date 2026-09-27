import { refreshAccountBar } from "../lib/account-bar.ts";
import { authErrorMessage, isExpiredLink, PASSWORD_MIN } from "../lib/auth-errors.ts";
import { busy, el, field, flag, say, showView, wireReveal } from "../lib/forms.ts";
import { supabase } from "../lib/supabase.ts";

/*
 * Both email links land here: ?token_hash=...&type=email confirms a new
 * account, &type=recovery sets a new password. Nothing is spent on page load.
 * Mail scanners (Outlook's Safe Links and the like) open links on their own,
 * and a link that verified itself on load would be used up before the player
 * ever clicked it. The token is traded for a session only on a click.
 */

const params = new URLSearchParams(location.search);
const tokenHash = params.get("token_hash") ?? "";
const type = params.get("type");
let recoveryVerified = false;

/** Drops the used token from the address bar and the history. */
function forgetToken(): void {
  history.replaceState(null, "", location.pathname);
}

el<HTMLButtonElement>("confirm").addEventListener("click", async (ev) => {
  const button = ev.currentTarget as HTMLButtonElement;
  const error = el("confirm-error");
  say(error, null);
  busy(button, true, "Confirming…");
  const { error: err } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  busy(button, false);
  if (err) {
    if (isExpiredLink(err)) return showView("expired-email");
    return say(error, authErrorMessage(err));
  }
  forgetToken();
  showView("confirmed");
  void refreshAccountBar();
});

const form = el<HTMLFormElement>("password-form");
form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const error = el("password-error");
  const submit = el<HTMLButtonElement>("password-submit");
  const passIn = field(form, "password");
  const password = passIn.value;
  if (password.length < PASSWORD_MIN) {
    say(error, `Use a password of at least ${PASSWORD_MIN} characters.`);
    return flag(passIn);
  }
  say(error, null);
  flag(null);

  busy(submit, true, "Saving…");
  if (!recoveryVerified) {
    const { error: err } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (err) {
      busy(submit, false);
      if (isExpiredLink(err)) return showView("expired-recovery");
      return say(error, authErrorMessage(err));
    }
    // The link is spent now; a failed save below is retried with the session it gave.
    recoveryVerified = true;
  }
  const { error: err } = await supabase.auth.updateUser({ password });
  busy(submit, false);
  if (err) {
    say(error, authErrorMessage(err));
    return flag(passIn);
  }
  forgetToken();
  showView("saved");
  void refreshAccountBar();
});

wireReveal();
if (!tokenHash) showView("missing");
else if (type === "recovery") showView("password");
else if (type === "email" || type === "signup") showView("confirm");
else showView("missing");
