/**
 * Persistence of the last displayed city.
 *
 * Kept apart from main.js so the boot sequence and the storage format can be
 * exercised on their own.
 */

import { capitalize } from "./text.js";

const LAST_CITY_KEY = "last-city";

/** Remembers the city so a reload restores the name exactly as displayed. */
export function writeLastCity({ url, name }) {
  localStorage.setItem(LAST_CITY_KEY, JSON.stringify({ url, name }));
}

/**
 * Reads the remembered city, or `null` when there is nothing to restore.
 *
 * Entries written before the display name was stored are bare slugs rather than
 * JSON, and those still load. An entry that is JSON but carries no usable url is
 * dropped instead of being fed back as a city, so a corrupted value cannot turn
 * into a request for a city called `{"url":`.
 */
export function readLastCity() {
  const raw = localStorage.getItem(LAST_CITY_KEY);
  if (!raw) return null;

  try {
    const saved = JSON.parse(raw);
    if (typeof saved?.url === "string" && saved.url) {
      return { url: saved.url, name: capitalize(saved.name ?? saved.url) };
    }
  } catch {
    /* A bare slug from before the name was stored, which is not JSON. */
    if (!raw.startsWith("{") && !raw.startsWith('"')) return { url: raw, name: capitalize(raw) };
  }

  localStorage.removeItem(LAST_CITY_KEY);
  return null;
}