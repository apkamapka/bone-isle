import { logOut } from "../lib/account-bar.ts";
import { authErrorMessage, emailLooksValid, safeNext } from "../lib/auth-errors.ts";
import { mountCaptcha } from "../lib/captcha.ts";
import { busy, el, field, flag, say, showView, wireReveal } from "../lib/forms.ts";
import { wireGoogleButton } from "../lib/google.ts";
import { supabase } from "../lib/supabase.ts";

const form = el<HTMLFormElement>("form");
const error = el("error");
const submit = el<HTMLButtonElement>("submit");
const resendWrap = el("resend-wrap");
const resendStatus = el("resend-status");
const captcha = mountCaptcha(el("captcha"));
const next = safeNext(new URLSearchParams(location.search).get("next"));
let unconfirmed = "";

function fail(text: string, input: HTMLInputElement | null = null): void {
  say(error, text);
  flag(input);
}

async function main(): Promise<void> {
  wireReveal();
  wireGoogleButton(next);
  el("page-logout").addEventListener("click", () => void logOut());
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email;
  if (email) {
    el("signed-email").textContent = email;
    showView("signed-in");
  }
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const emailIn = field(form, "email");
  const passIn = field(form, "password");
  const email = emailIn.value.trim();
  const password = passIn.value;
  resendWrap.hidden = true;
  say(resendStatus, null);
  if (!emailLooksValid(email)) return fail("Enter a valid email address.", emailIn);
  if (password.length === 0) return fail("Enter your password.", passIn);
  say(error, null);
  flag(null);

  busy(submit, true, "Logging in…");
  const captchaToken = await captcha.token();
  const { error: err } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
  if (!err) return location.assign(next);
  busy(submit, false);
  fail(authErrorMessage(err));
  if (err.code === "email_not_confirmed") {
    unconfirmed = email;
    resendWrap.hidden = false;
  }
});

el<HTMLButtonElement>("resend").addEventListener("click", async (ev) => {
  const button = ev.currentTarget as HTMLButtonElement;
  busy(button, true, "Sending…");
  const captchaToken = await captcha.token();
  const { error: err } = await supabase.auth.resend({ type: "signup", email: unconfirmed, options: { captchaToken } });
  busy(button, false);
  say(resendStatus, err ? authErrorMessage(err) : `Sent to ${unconfirmed}. The link works for one hour.`);
});

void main();
