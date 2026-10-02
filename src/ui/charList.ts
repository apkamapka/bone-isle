/**
 * The character list on the way into /play (etap 1.9), the way the Tibia
 * client shows one right after logging in: the account's characters, one of
 * them selected, Ok to enter.
 *
 * Plain DOM over the page, because none of the canvas UI exists yet: main.ts,
 * which draws everything else, loads only after a character is picked.
 *
 * Mouse, touch and keyboard: a click or tap selects a row, a second one on the
 * same row enters, and so do Ok and Enter; the arrow keys move the selection.
 */
import { ACCOUNT_URL, deletionNote, type CharacterRow } from "../net/account.ts";

export interface CharList {
  /** A line of text in the window while something loads. */
  loading(text: string): void;
  /** Something went wrong; resolves when "Try again" is pressed. */
  error(text: string): Promise<void>;
  /** The account has no character yet: the way to make one. */
  empty(): void;
  /** The characters; resolves with the one entered. */
  list(rows: readonly CharacterRow[], selected: number): Promise<CharacterRow>;
  /** Gone, and the world under it. */
  close(): void;
}

/** A second tap on the same row within this many ms enters. */
const DOUBLE_TAP_MS = 600;

const CSS = `
.cl{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;
  padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));
  background:radial-gradient(ellipse at center,#1d3a3d 0%,#142a2c 55%,#0b1718 100%);
  font:bold 15px/1.35 'Courier New',monospace;color:#e8dcc0}
.cl-win{width:min(360px,100%);background:#2a2218;border:2px solid #6e571f;box-shadow:0 0 0 1px #000,0 12px 40px rgba(0,0,0,.6)}
.cl-title{background:#1b150e;color:#ffe9a8;text-align:center;padding:8px 10px;border-bottom:1px solid #6e571f;letter-spacing:.04em}
.cl-body{padding:12px}
.cl-msg{margin:6px 2px;text-align:center}
.cl-msg--dim{color:#8a8070;font-weight:normal}
.cl-msg--err{color:#d96a5a}
.cl-list{list-style:none;margin:0;padding:2px;background:#1b150e;border:1px solid #000;max-height:min(50vh,260px);overflow-y:auto;outline:none}
.cl-list:focus-visible{box-shadow:0 0 0 1px #cfa86a}
.cl-row{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:9px 10px;cursor:pointer}
.cl-row:hover{background:#3a2f20}
.cl-row[aria-selected="true"]{background:#6e571f;color:#fff3c8}
.cl-note{margin:0;font-weight:normal;font-size:12px;color:#d96a5a;white-space:nowrap}
.cl-row[aria-selected="true"] .cl-note{color:#ffd2c8}
.cl-foot{display:flex;justify-content:space-between;gap:10px;padding:0 12px 12px}
.cl-foot:empty{display:none}
.cl-btn{font:inherit;color:#ffe9a8;background:#3a2f20;border:1px solid #6e571f;box-shadow:inset 0 1px 0 #5a4a30;
  padding:8px 18px;min-width:96px;cursor:pointer;text-decoration:none;text-align:center}
.cl-btn:hover{background:#4a3c28}
.cl-btn:focus-visible{outline:1px solid #ffe9a8;outline-offset:1px}
.cl-ok{margin-left:auto}
`;

export function mountCharList(): CharList {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);
  const root = document.createElement("div");
  root.className = "cl";
  root.innerHTML =
    '<div class="cl-win" role="dialog" aria-modal="true" aria-labelledby="cl-title">'
    + '<div class="cl-title" id="cl-title">Select Character</div>'
    + '<div class="cl-body"></div><div class="cl-foot"></div></div>';
  document.body.append(root);
  const body = root.querySelector<HTMLElement>(".cl-body")!;
  const foot = root.querySelector<HTMLElement>(".cl-foot")!;

  let keys: ((e: KeyboardEvent) => void) | null = null;
  const onKeys = (f: ((e: KeyboardEvent) => void) | null): void => {
    if (keys) removeEventListener("keydown", keys);
    keys = f;
    if (f) addEventListener("keydown", f);
  };
  const message = (text: string, cls = "cl-msg"): HTMLElement => {
    const p = document.createElement("p");
    p.className = cls;
    p.textContent = text;
    return p;
  };
  const button = (label: string): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cl-btn cl-ok";
    b.textContent = label;
    return b;
  };
  const toAccount = (label: string): HTMLAnchorElement => {
    const a = document.createElement("a");
    a.className = "cl-btn";
    a.href = ACCOUNT_URL;
    a.textContent = label;
    return a;
  };

  return {
    loading(text) {
      onKeys(null);
      body.replaceChildren(message(text));
      foot.replaceChildren();
    },

    error(text) {
      return new Promise((resolve) => {
        const again = button("Try again");
        const go = (): void => {
          onKeys(null);
          resolve();
        };
        body.replaceChildren(message(text, "cl-msg cl-msg--err"));
        foot.replaceChildren(again);
        again.addEventListener("click", go, { once: true });
        onKeys((e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            go();
          }
        });
        again.focus();
      });
    },

    empty() {
      onKeys(null);
      body.replaceChildren(
        message("You have no characters yet."),
        message("Create one on your account page, then come back to play.", "cl-msg cl-msg--dim"),
      );
      const make = toAccount("Create a character");
      make.classList.add("cl-ok");
      foot.replaceChildren(make);
      make.focus();
    },

    list(rows, selected) {
      return new Promise((resolve) => {
        let sel = Math.max(0, Math.min(selected, rows.length - 1));
        let lastTap = { row: -1, at: 0 };
        const ul = document.createElement("ul");
        ul.className = "cl-list";
        ul.tabIndex = 0;
        ul.setAttribute("role", "listbox");
        ul.setAttribute("aria-label", "Characters");
        const enter = (): void => {
          onKeys(null);
          resolve(rows[sel]);
        };
        const select = (i: number): void => {
          sel = i;
          items.forEach((li, k) => li.setAttribute("aria-selected", String(k === i)));
          ul.setAttribute("aria-activedescendant", items[i].id);
          items[i].scrollIntoView({ block: "nearest" });
        };
        const items = rows.map((r, i) => {
          const li = document.createElement("li");
          li.className = "cl-row";
          li.id = `cl-row-${i}`;
          li.setAttribute("role", "option");
          const n = document.createElement("span");
          n.textContent = r.name;
          li.append(n);
          const note = deletionNote(r.deleteAt);
          if (note) li.append(message(note, "cl-note"));
          li.addEventListener("click", () => {
            const now = performance.now();
            if (lastTap.row === i && now - lastTap.at < DOUBLE_TAP_MS) return enter();
            lastTap = { row: i, at: now };
            select(i);
          });
          ul.append(li);
          return li;
        });
        const ok = button("Ok");
        ok.addEventListener("click", enter);
        body.replaceChildren(ul);
        foot.replaceChildren(toAccount("Account"), ok);
        onKeys((e) => {
          if (e.key === "ArrowDown") select(Math.min(sel + 1, rows.length - 1));
          else if (e.key === "ArrowUp") select(Math.max(sel - 1, 0));
          else if (e.key === "Home") select(0);
          else if (e.key === "End") select(rows.length - 1);
          else if (e.key === "Enter") enter();
          else return;
          e.preventDefault();
        });
        select(sel);
        ul.focus();
      });
    },

    close() {
      onKeys(null);
      root.remove();
      style.remove();
    },
  };
}
