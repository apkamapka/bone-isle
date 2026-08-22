/**
 * The chat input field.
 *
 * A real DOM `<input>` laid over the canvas, not something drawn on it — and
 * that is the whole design, not an implementation shortcut.
 *
 * A canvas cannot receive typing. The usual dodge is an off-screen input that
 * the canvas mirrors, which works on a desktop and falls apart on a phone: the
 * soft keyboard takes about two fifths of the screen, the browser scrolls the
 * page to keep the focused element visible, and a field drawn at a fixed
 * canvas coordinate ends up underneath the keyboard, on top of it, or halfway
 * off the screen depending on the device. There is no canvas coordinate that
 * is reliably "just above the keyboard", because the canvas does not know the
 * keyboard is there.
 *
 * `visualViewport` does. It reports the part of the page actually visible with
 * the keyboard up, so anchoring the field to `visualViewport.height` puts it
 * exactly where a chat field belongs on every device, and it moves with the
 * keyboard rather than fighting it. Everything else here — styling it to match
 * the game's chrome, echoing the channel it will send to — is decoration on
 * top of that one fact.
 */

export interface ChatInputHooks {
  /** The player pressed Enter with something typed. */
  send(text: string): void;
  /** Escape, or a tap outside. */
  cancel(): void;
}

interface ChatInputHandle {
  open(prefill?: string): void;
  close(): void;
  isOpen(): boolean;
  /** Where the field currently sits, in CSS px from the top of the layout
   *  viewport — so the game can lift the log above it. Zero when closed. */
  topCss(): number;
}

/** The no-op handle used headlessly and before `initChatInput` runs. */
const NULL_HANDLE: ChatInputHandle = {
  open: () => undefined,
  close: () => undefined,
  isOpen: () => false,
  topCss: () => 0,
};

let handle: ChatInputHandle = NULL_HANDLE;

/** Monotonic ms, falling back to the wall clock where `performance` is absent. */
function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** The live handle. Safe to call before init — it simply does nothing. */
export function chatInput(): ChatInputHandle {
  return handle;
}

/**
 * Build the field and attach it to the document.
 *
 * Called once at start-up. Does nothing (and stays the null handle) when there
 * is no DOM, which is how the smoke suite loads this module without a browser.
 */
export function initChatInput(hooks: ChatInputHooks): void {
  if (typeof document === "undefined" || !document.body || !document.createElement) return;

  const wrap = document.createElement("div");
  const label = document.createElement("span");
  const field = document.createElement("input") as HTMLInputElement;

  wrap.style.cssText = [
    "position:fixed", "left:0", "right:0", "display:none",
    "box-sizing:border-box", "padding:6px 8px",
    "background:rgba(10,8,5,.96)",
    "border-top:1px solid rgba(202,162,58,.32)",
    "align-items:center", "gap:8px", "z-index:50",
  ].join(";");

  /* A plain label, not a button. With one channel there is nothing to switch
   * to, and a chip that looks pressable and does nothing is worse than no chip
   * at all — so it loses its pointer cursor and its click handler and just
   * says what the field is for. */
  label.style.cssText = [
    "font:bold 12px 'Courier New',monospace", "color:#caa15a",
    "flex:0 0 auto", "user-select:none",
    "padding:4px 6px", "border:1px solid rgba(202,162,58,.4)",
    "border-radius:2px", "white-space:nowrap",
  ].join(";");
  label.textContent = "SAY";

  field.type = "text";
  field.maxLength = 200;
  // A phone keyboard that autocapitalises and autocorrects a game chat is a
  // phone keyboard that turns "ty" into "Try" mid-trade.
  field.autocapitalize = "off";
  field.autocomplete = "off";
  field.spellcheck = false;
  field.setAttribute("enterkeyhint", "send");
  field.style.cssText = [
    "flex:1 1 auto", "min-width:0",
    "font:14px 'Courier New',monospace", "color:#f3eedd",
    "background:rgba(28,22,12,.96)",
    "border:1px solid rgba(202,162,58,.4)", "border-radius:2px",
    "padding:8px", "outline:none",
  ].join(";");

  wrap.appendChild(label);
  wrap.appendChild(field);
  document.body.appendChild(wrap);

  let open = false;
  let topCss = 0;
  /**
   * When the field was opened, in ms. See the blur handler below.
   */
  let openedAt = -Infinity;
  /**
   * How long after opening a blur is treated as the browser's doing rather
   * than the player's.
   *
   * A quarter of a second. Long enough to cover the frame or two between our
   * `focus()` and the default action that undoes it; far too short to swallow
   * a real tap somewhere else, which cannot physically arrive that fast after
   * the tap that opened the field.
   */
  const OPEN_GRACE_MS = 250;

  /**
   * Sit the field on the bottom edge of the VISUAL viewport.
   *
   * With the keyboard up, `visualViewport.height` shrinks and `offsetTop`
   * reports how far the browser scrolled the page — both are needed, or the
   * field lands correctly on Android and a keyboard's height too low on iOS.
   */
  const place = (): void => {
    if (!open) return;
    const vv = (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
    const h = vv ? vv.height : window.innerHeight;
    const off = vv ? vv.offsetTop : 0;
    const bottom = Math.max(0, window.innerHeight - (h + off));
    wrap.style.bottom = `${bottom}px`;
    topCss = h + off - wrap.offsetHeight;
  };

  const vv = (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
  vv?.addEventListener("resize", place);
  vv?.addEventListener("scroll", place);
  addEventListener("resize", place);

  field.addEventListener("keydown", (e: KeyboardEvent) => {
    // The game's own hotkeys must not fire while typing: `w` is walk north and
    // also the first letter of half the words in the language.
    e.stopPropagation();
    if (e.key === "Enter") {
      const text = field.value;
      field.value = "";
      hooks.send(text);
    } else if (e.key === "Escape") {
      field.value = "";
      hooks.cancel();
    }
  });
  field.addEventListener("keyup", (e: KeyboardEvent) => e.stopPropagation());
  field.addEventListener("keypress", (e: KeyboardEvent) => e.stopPropagation());
  /**
   * Losing focus closes it. On a phone that is the "hide keyboard" gesture,
   * and a field left behind after its keyboard is gone is a field that has
   * eaten the bottom of the screen for nothing.
   *
   * EXCEPT FOR THE CLICK THAT OPENED IT — which is why the CHAT button did
   * nothing at all on a desktop.
   *
   * The game resolves a mouse click on `mousedown`. That handler runs, finds
   * the button, and calls `focus()` on this field. Then the handler returns
   * and the browser performs mousedown's DEFAULT action, which is to move
   * focus to what was clicked — the canvas. So the field was focused and
   * immediately blurred, the blur called `cancel()`, and the field closed in
   * the same frame it opened. Nothing was visibly wrong; nothing happened.
   *
   * A phone never hit it: touch.ts calls `preventDefault` on `touchstart`, so
   * no synthetic mouse event is ever generated and nothing steals the focus.
   * That is the entire difference between the two platforms.
   *
   * The fix is here rather than a `preventDefault` on the canvas because the
   * canvas swallowing focus changes is exactly what makes the "tap the world
   * to dismiss the keyboard" gesture work. So the blur is kept and the one
   * blur that is not the player's doing is put back.
   */
  field.addEventListener("blur", () => {
    if (!open) return;
    if (now() - openedAt < OPEN_GRACE_MS) {
      // Next task, not this one: refocusing inside a blur handler is refused
      // outright by some browsers and silently ignored by others.
      setTimeout(() => { if (open) field.focus(); }, 0);
      return;
    }
    hooks.cancel();
  });

  handle = {
    open(prefill = "") {
      open = true;
      openedAt = now();
      wrap.style.display = "flex";
      field.value = prefill;
      place();
      field.focus();
      // Some mobile browsers only raise the keyboard on a focus that happens
      // inside the gesture; a second focus on the next frame catches the rest.
      requestAnimationFrame(() => { if (open) { field.focus(); place(); } });
    },
    close() {
      open = false;
      topCss = 0;
      wrap.style.display = "none";
      field.blur();
    },
    isOpen: () => open,
    topCss: () => topCss,
  };
}
