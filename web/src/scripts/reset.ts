import { authErrorMessage, emailLooksValid } from "../lib/auth-errors.ts";
import { mountCaptcha } from "../lib/captcha.ts";
import { busy, el, field, flag, say, showView } from "../lib/forms.ts";
import { supabase } from "../lib/supabase.ts";

const form = el<HTMLFormElement>("form");
const error = el("error");
const submit = el<HTMLButtonElement>("submit");
const captcha = mountCaptcha(el("captcha"));

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const emailIn = field(form, "email");
  const email = emailIn.value.trim();
  if (!emailLooksValid(email)) {
    say(error, "Enter a valid email address.");
    return flag(emailIn);
  }
  say(error, null);
  flag(null);

  busy(submit, true, "Sending…");
  const captchaToken = await captcha.token();
  // Supabase answers the same whether or not the address has an account.
  const { error: err } = await supabase.auth.resetPasswordForEmail(email, { captchaToken });
  busy(submit, false);
  if (err) return say(error, authErrorMessage(err));
  el("sent-to").textContent = email;
  showView("sent");
});
