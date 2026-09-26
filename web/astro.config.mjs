import { defineConfig } from "astro/config";

/*
 * xebeka.com — a static site. The game is not part of it: `npm run build:site`
 * in the repo root builds this first and then the game into dist/play, so one
 * deploy carries both and they share an origin (one login, from etap 1).
 */
export default defineConfig({
  site: "https://xebeka.com",
  output: "static",
  build: { format: "directory" },
});
