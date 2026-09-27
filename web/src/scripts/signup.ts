import { logOut } from "../lib/account-bar.ts";
import { authErrorMessage, emailLooksValid, PASSWORD_MIN } from "../lib/auth-errors.ts";
import { mountCaptcha } from "../lib/captcha.ts";
import { busy, el, field, flag, say, showView, wireReveal } from "../lib/forms.ts";
import { supabase } from "../lib/supabase.ts";
import { TERMS_VERSION } from "../site.ts";

const form = el<HTMLFormElement>("form");
const error = el("error");
const submit = el<HTMLButtonElement>("submit");
const captcha = mountCaptcha(el("captcha"));
let sentTo = "";

function fail(text: string, input: HTMLInputElement | null = null): void {
  say(error, text);
  flag(input);
}

async function main(): Promise<void> {
  wireReveal();
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
  const termsIn = field(form, "terms");
  const email = emailIn.value.trim();
  const password = passIn.value;
  if (!emailLooksValid(email)) return fail("Enter a valid email address.", emailIn);
  if (password.length < PASSWORD_MIN) return fail(`Use a password of at least ${PASSWORD_MIN} characters.`, passIn);
  if (!termsIn.checked) return fail("Tick the box to confirm you are 13 or older and accept the Terms of Service.", termsIn);
  say(error, null);
  flag(null);

  busy(submit, true, "Creating account…");
  const captchaToken = await captcha.token();
  const { data, error: err } = await supabase.auth.signUp({
    email,
    password,
    options: { captchaToken, data: { terms_accepted: TERMS_VERSION } },
  });
  busy(submit, false);
  if (err) return fail(authErrorMessage(err));
  // A confirmed address gets a stand-in user with no identities and no email.
  if (data.user && data.user.identities?.length === 0) {
    return fail("This email address already has an account. Log in, or reset the password if you forgot it.", emailIn);
  }
  // Only when email confirmation is switched off in Supabase.
  if (data.session) return location.assign("/");
  sentTo = email;
  el("sent-to").textContent = email;
  showView("sent");
});

el<HTMLButtonElement>("resend").addEventListener("click", async (ev) => {
  const button = ev.currentTarget as HTMLButtonElement;
  const status = el("resend-status");
  busy(button, true, "Sending…");
  const captchaToken = await captcha.token();
  const { error: err } = await supabase.auth.resend({ type: "signup", email: sentTo, options: { captchaToken } });
  busy(button, false);
  say(status, err ? authErrorMessage(err) : "Sent. The new link replaces the one before.");
});

void main();
