/** Minimal DOM + canvas 2D stub so game modules load under Node (tsx). */
const ctxStub = () =>
  new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "measureText") return () => ({ width: 10 });
        if (prop === "createImageData") return (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
        if (prop === "getImageData") return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
        return () => undefined;
      },
      set() { return true; },
    },
  );

class FakeCanvas {
  width = 0;
  height = 0;
  style: Record<string, string> = {};
  getContext() { return ctxStub(); }
  addEventListener() { /* noop */ }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1, height: 1 }; }
}

(globalThis as Record<string, unknown>).document = {
  createElement: () => new FakeCanvas(),
  body: { appendChild: () => undefined },
};
(globalThis as Record<string, unknown>).addEventListener = () => undefined;
try {
  Object.defineProperty(globalThis, "navigator", { value: { maxTouchPoints: 0 }, configurable: true });
} catch { /* keep the built-in navigator */ }

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};
(globalThis as Record<string, unknown>).AudioContext = class { /* noop */ };

export {};
