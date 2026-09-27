/** Small DOM helpers shared by the account pages. */

export function el<T extends HTMLElement = HTMLElement>(name: string, root: ParentNode = document): T {
  const found = root.querySelector<T>(`[data-${name}]`);
  if (!found) throw new Error(`missing [data-${name}]`);
  return found;
}

export function field(form: HTMLFormElement, name: string): HTMLInputElement {
  return form.elements.namedItem(name) as HTMLInputElement;
}

/** Puts a message in its box, or hides the box when given null. */
export function say(box: HTMLElement, text: string | null): void {
  box.textContent = text ?? "";
  box.hidden = text === null;
}

/** A button says what it is doing while it waits, and cannot be pressed twice. */
export function busy(button: HTMLButtonElement, on: boolean, label?: string): void {
  if (on) {
    button.dataset.label ??= button.textContent ?? "";
    if (label) button.textContent = label;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  } else {
    if (button.dataset.label !== undefined) button.textContent = button.dataset.label;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

/** Marks the field the message is about, and takes the player to it. */
export function flag(input: HTMLInputElement | null): void {
  document.querySelectorAll("[aria-invalid]").forEach((n) => n.removeAttribute("aria-invalid"));
  if (!input) return;
  input.setAttribute("aria-invalid", "true");
  input.focus();
}

/** Every "Show" beside a password field reveals it, and "Hide" covers it again. */
export function wireReveal(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>("[data-reveal]").forEach((btn) => {
    const input = document.getElementById(btn.getAttribute("aria-controls") ?? "") as HTMLInputElement | null;
    if (!input) return;
    btn.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Hide" : "Show";
      btn.setAttribute("aria-pressed", String(show));
      input.focus();
    });
  });
}

/**
 * A page shows one of its [data-view] blocks at a time. The new view's heading
 * takes the focus, so a screen reader announces what changed.
 */
export function showView(name: string): void {
  document.querySelectorAll<HTMLElement>("[data-view]").forEach((v) => {
    v.hidden = v.dataset.view !== name;
  });
  document.querySelector<HTMLElement>(`[data-view="${name}"] h1`)?.focus();
}
