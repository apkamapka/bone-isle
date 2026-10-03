import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/*
 * News (etap 1.11): one Markdown file per post in src/content/news/. The file
 * name is the post's address: welcome-to-xebeka.md is /news/welcome-to-xebeka/.
 *
 * Every post starts with this header, between two lines of three dashes:
 *   title    the headline
 *   date     the day it is posted, as 2026-10-03; the newest come first
 *   summary  one or two sentences, shown under the headline on the home page
 *
 * A post without one of them, or with a date that is not a date, stops the
 * build: Vercel keeps the site as it was until the file is fixed.
 */
const news = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/news" }),
  schema: z.object({
    title: z.string().min(1),
    date: z.coerce.date(),
    summary: z.string().min(1),
  }),
});

export const collections = { news };
