import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

/*
 * xebeka.com — a static site. The game is not part of it: `npm run build:site`
 * in the repo root builds this first and then the game into dist/play, so one
 * deploy carries both and they share an origin (one login, from etap 1).
 */

/*
 * Pages that carry <meta name="robots" content="noindex">: the account forms
 * and the account panel (etap 1). A sitemap that lists a page the page itself
 * refuses would only earn a warning in Search Console, so they stay out of it.
 * Every other page goes in on its own, the library's included (etap 2.2): the
 * sitemap is written from the pages the build makes, never from a list.
 * The game at /play/ is built after this, by Vite, so it never enters it.
 */
const NOINDEX = ["/account/", "/auth/google/", "/confirm/", "/login/", "/reset-password/", "/signup/"];

export default defineConfig({
  site: "https://xebeka.com",
  output: "static",
  build: { format: "directory" },
  integrations: [sitemap({
    filter: (page) => !NOINDEX.includes(new URL(page).pathname),
  })],
});
