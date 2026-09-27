import { TURNSTILE_SITE_KEY } from "../site.ts";

/**
 * Cloudflare Turnstile on the account forms. With CAPTCHA protection switched
 * on in Supabase, every sign-up, log-in, reset and resend must carry a token.
 * A token is good for one request, so each one taken starts the next.
 *
 * The widget shows itself only when Cloudflare wants a person to tick a box;
 * the rest of the time it works unseen. With no site key the check is off.
 */

interface TurnstileApi {
  render(host: HTMLElement, options: Record<string, unknown>): string | undefined;
  reset(widgetId?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const WAIT_MS = 20_000;

export interface Captcha {
  /** A fresh token, or undefined when the check is off or could not run. */
  token(): Promise<string | undefined>;
}

let loading: Promise<TurnstileApi> | null = null;

function load(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("no turnstile")));
    s.onerror = () => reject(new Error("turnstile blocked"));
    document.head.append(s);
  });
  return loading;
}

export function mountCaptcha(host: HTMLElement): Captcha {
  if (!TURNSTILE_SITE_KEY) return { token: async () => undefined };

  let unused: string | undefined;
  let broken = false;
  let waiting: ((t: string | undefined) => void)[] = [];
  let api: TurnstileApi | undefined;
  let widget: string | undefined;

  const handOut = (t: string | undefined): void => {
    const w = waiting;
    waiting = [];
    w.forEach((give) => give(t));
  };
  const next = (): void => {
    setTimeout(() => api?.reset(widget), 0);
  };

  load()
    .then((ts) => {
      api = ts;
      widget = ts.render(host, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "dark",
        size: "flexible",
        appearance: "interaction-only",
        callback: (t: string) => {
          broken = false;
          if (waiting.length > 0) {
            handOut(t);
            next();
          } else {
            unused = t;
          }
        },
        "expired-callback": () => {
          unused = undefined;
        },
        "error-callback": () => {
          broken = true;
          handOut(undefined);
        },
      });
    })
    .catch(() => {
      broken = true;
      handOut(undefined);
    });

  return {
    token() {
      if (unused) {
        const t = unused;
        unused = undefined;
        next();
        return Promise.resolve(t);
      }
      if (broken) return Promise.resolve(undefined);
      return new Promise((resolve) => {
        waiting.push(resolve);
        setTimeout(() => {
          if (!waiting.includes(resolve)) return;
          waiting = waiting.filter((w) => w !== resolve);
          resolve(undefined);
        }, WAIT_MS);
      });
    },
  };
}
