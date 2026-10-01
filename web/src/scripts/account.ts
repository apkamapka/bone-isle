import type { User } from "@supabase/supabase-js";
import { logOut } from "../lib/account-bar.ts";
import { authErrorMessage, PASSWORD_MIN } from "../lib/auth-errors.ts";
import { mountCaptcha } from "../lib/captcha.ts";
import {
  type CharacterRow,
  checkName,
  formatDay,
  hasPassword,
  MAX_CHARACTERS,
  rpcErrorMessage,
  sexLabel,
  signInMethod,
} from "../lib/characters.ts";
import { busy, el, field, flag, say, wireReveal } from "../lib/forms.ts";
import { supabase } from "../lib/supabase.ts";

/* Manage account: characters, password, deleting the account. */

const captcha = mountCaptcha(el("captcha"));
let user: User;
let characters: CharacterRow[] = [];

function button(label: string, className: string, onClick: (b: HTMLButtonElement) => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = label;
  b.addEventListener("click", () => onClick(b));
  return b;
}

function text(tag: string, className: string, content: string): HTMLElement {
  const n = document.createElement(tag);
  n.className = className;
  n.textContent = content;
  return n;
}

// ---- characters

async function loadCharacters(): Promise<void> {
  const { data, error } = await supabase
    .from("characters")
    .select("id, name, sex, created_at, delete_at")
    .order("created_at");
  if (error) return say(el("chars-error"), rpcErrorMessage(error));
  say(el("chars-error"), null);
  characters = (data ?? []) as CharacterRow[];
  renderCharacters();
}

/** Schedules or cancels a deletion, then shows the list as it now is. */
async function changeCharacter(fn: "schedule_character_deletion" | "cancel_character_deletion", c: CharacterRow, b: HTMLButtonElement, error: HTMLElement): Promise<void> {
  busy(b, true, "Saving…");
  const { error: err } = await supabase.rpc(fn, { p_id: c.id });
  busy(b, false);
  if (err) return say(error, rpcErrorMessage(err));
  await loadCharacters();
}

function characterItem(c: CharacterRow): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "char";
  const info = document.createElement("div");
  info.className = "char__info";
  const meta = text("span", "char__meta", "");
  info.append(text("span", "char__name", c.name), meta);
  const actions = document.createElement("div");
  actions.className = "char__actions";
  const error = text("p", "form__error char__error", "");
  error.setAttribute("role", "alert");
  error.hidden = true;

  if (c.delete_at) {
    meta.classList.add("char__meta--deleting");
    meta.textContent = `${sexLabel(c.sex)}, deleted on ${formatDay(c.delete_at)}`;
    actions.append(button("Cancel deletion", "char__btn", (b) => void changeCharacter("cancel_character_deletion", c, b, error)));
    li.append(info, actions, error);
    return li;
  }

  meta.textContent = `${sexLabel(c.sex)}, created ${formatDay(c.created_at)}`;
  const confirm = document.createElement("div");
  confirm.className = "char__confirm";
  confirm.hidden = true;
  const ask = button("Delete", "char__btn", () => {
    confirm.hidden = false;
    ask.hidden = true;
  });
  const yesNo = document.createElement("div");
  yesNo.className = "auth__actions";
  yesNo.append(
    button("Delete", "btn btn--danger notch", (b) => void changeCharacter("schedule_character_deletion", c, b, error)),
    button("Keep", "btn btn--quiet notch", () => {
      confirm.hidden = true;
      ask.hidden = false;
    }),
  );
  confirm.append(text("p", "", `Delete ${c.name}? The character goes in 7 days, and until then you can cancel.`), yesNo);
  actions.append(ask);
  li.append(info, actions, confirm, error);
  return li;
}

function renderCharacters(): void {
  el("chars").replaceChildren(...characters.map(characterItem));
  el("chars-empty").hidden = characters.length > 0;
  el("count").textContent = `${characters.length} of ${MAX_CHARACTERS}`;
  const full = characters.length >= MAX_CHARACTERS;
  el("create").hidden = full;
  el("full").hidden = !full;
}

const create = el<HTMLFormElement>("create");
create.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const error = el("create-error");
  const status = el("create-status");
  const nameIn = field(create, "name");
  say(status, null);
  const check = checkName(nameIn.value);
  if (!check.ok) {
    say(error, check.message);
    return flag(nameIn);
  }
  const sex = create.querySelector<HTMLInputElement>('input[name="sex"]:checked')?.value;
  if (!sex) {
    say(error, "Choose male or female.");
    return flag(create.querySelector<HTMLInputElement>('input[name="sex"]'));
  }
  say(error, null);
  flag(null);

  const submit = el<HTMLButtonElement>("create-submit");
  busy(submit, true, "Creating…");
  const { error: err } = await supabase.rpc("create_character", { p_name: check.name, p_sex: sex });
  busy(submit, false);
  if (err) {
    say(error, rpcErrorMessage(err));
    if (err.message.startsWith("NAME_")) flag(nameIn);
    return;
  }
  create.reset();
  say(status, `${check.name} is ready.`);
  await loadCharacters();
});

// ---- password

function paintPassword(): void {
  const has = hasPassword(user);
  el("pass-title").textContent = has ? "Change password" : "Set a password";
  const lead = el("pass-lead");
  lead.textContent = "You log in with Google. Set a password to log in with your email address too.";
  lead.hidden = has;
  el("current-wrap").hidden = !has;
  el("pass-submit").textContent = has ? "Change password" : "Set password";
  el("method").textContent = signInMethod(user);
}

/** Empties the form and covers any revealed password again. */
function clearPasswordForm(form: HTMLFormElement): void {
  form.reset();
  form.querySelectorAll<HTMLButtonElement>("[data-reveal]").forEach((b) => {
    const input = document.getElementById(b.getAttribute("aria-controls") ?? "") as HTMLInputElement | null;
    if (input) input.type = "password";
    b.textContent = "Show";
    b.setAttribute("aria-pressed", "false");
  });
}

const passForm = el<HTMLFormElement>("pass-form");
passForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const error = el("pass-error");
  const status = el("pass-status");
  const submit = el<HTMLButtonElement>("pass-submit");
  const currentIn = field(passForm, "current");
  const newIn = field(passForm, "password");
  const has = hasPassword(user);
  say(status, null);
  if (has && currentIn.value.length === 0) {
    say(error, "Enter your current password.");
    return flag(currentIn);
  }
  if (newIn.value.length < PASSWORD_MIN) {
    say(error, `Use a password of at least ${PASSWORD_MIN} characters.`);
    return flag(newIn);
  }
  say(error, null);
  flag(null);

  busy(submit, true, "Saving…");
  // Someone at a browser left logged in must not take the account over:
  // changing a password asks for the current one first.
  if (has) {
    const captchaToken = await captcha.token();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: user.email ?? "",
      password: currentIn.value,
      options: { captchaToken },
    });
    if (err) {
      busy(submit, false);
      say(error, err.code === "invalid_credentials" ? "Your current password is wrong." : authErrorMessage(err));
      return flag(currentIn);
    }
  }
  const { data, error: err } = await supabase.auth.updateUser(
    has ? { password: newIn.value } : { password: newIn.value, data: { password_set: true } },
  );
  busy(submit, false);
  if (err) {
    say(error, authErrorMessage(err));
    return flag(newIn);
  }
  if (data.user) user = data.user;
  clearPasswordForm(passForm);
  say(status, has ? "Password changed." : "Password set. You can now also log in with your email address and this password.");
  paintPassword();
});

// ---- deleting the account

function paintAccountDeletion(at: string | null): void {
  el("deleting").hidden = at === null;
  el("deleting-date").textContent = at ? formatDay(at) : "";
  el("delete-section").hidden = at !== null;
  el("delete-confirm").hidden = true;
  el("delete-start").hidden = false;
}

async function loadAccountDeletion(): Promise<void> {
  const { data, error } = await supabase.rpc("account_deletion_at");
  if (error) return say(el("delete-error"), rpcErrorMessage(error));
  paintAccountDeletion(typeof data === "string" ? data : null);
}

el("delete-account").addEventListener("click", () => {
  el("delete-date").textContent = formatDay(new Date(Date.now() + 7 * 24 * 3600 * 1000));
  el("delete-start").hidden = true;
  el("delete-confirm").hidden = false;
});
el("delete-no").addEventListener("click", () => paintAccountDeletion(null));
el<HTMLButtonElement>("delete-yes").addEventListener("click", async (ev) => {
  const b = ev.currentTarget as HTMLButtonElement;
  busy(b, true, "Saving…");
  const { data, error } = await supabase.rpc("schedule_account_deletion");
  busy(b, false);
  if (error) return say(el("delete-error"), rpcErrorMessage(error));
  say(el("delete-error"), null);
  paintAccountDeletion(typeof data === "string" ? data : null);
  el("deleting").scrollIntoView({ block: "nearest" });
});
el<HTMLButtonElement>("cancel-account").addEventListener("click", async (ev) => {
  const b = ev.currentTarget as HTMLButtonElement;
  busy(b, true, "Saving…");
  const { error } = await supabase.rpc("cancel_account_deletion");
  busy(b, false);
  if (error) return say(el("deleting-error"), rpcErrorMessage(error));
  say(el("deleting-error"), null);
  paintAccountDeletion(null);
});

// ---- start

async function main(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    location.replace("/login/?next=/account/");
    return;
  }
  user = data.session.user;
  // Accounts whose 7 days are over go now, not only when the scheduled job runs.
  // (A query runs only once it is awaited or then-ed.)
  supabase.rpc("purge_deleted_accounts").then(
    () => undefined,
    () => undefined,
  );
  el("email").textContent = user.email ?? "";
  wireReveal();
  el("page-logout").addEventListener("click", () => void logOut());
  paintPassword();
  el("panel").hidden = false;
  await Promise.all([loadCharacters(), loadAccountDeletion()]);
}

void main();
