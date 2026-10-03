/*
 * What the home page and the post pages share about news (etap 1.11). Kept
 * free of astro:content so the smoke suite can check it under plain Node.
 */

/** How many of the newest posts the home page lists. */
export const HOME_NEWS = 5;

/** "3 October 2026", the way the site writes every date, whatever the visitor's time zone. */
export function newsDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

/** For the datetime attribute: "2026-10-03". */
export function newsIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Newest first; two posts from the same day keep a fixed order. */
export function byNewest<T extends { id: string; data: { date: Date } }>(posts: readonly T[]): T[] {
  return [...posts].sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id));
}
