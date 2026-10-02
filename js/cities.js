/**
 * City lookup against the local `data/cities.txt` index.
 *
 * The upstream `list-cities` endpoint is fetched once instead of on every
 * keystroke and its CORS headers are unreliable. Each line is tab separated:
 * `key`, `name`, `country code`, `postal code`, `slug`.
 */

import { toSlug } from "./text.js";

const FILE_URL = new URL("../data/cities.txt", import.meta.url);

const COUNTRIES = {
  CHE: "Suisse",
  FRA: "France",
  BEL: "Belgique",
  ITA: "Italie",
  ESP: "Espagne",
  DEU: "Allemagne",
  MCO: "Monaco",
};

/** Ranking tiers, lowest first: exact name, postal code, prefix, substring. */
const RANKS = { EXACT: 0, POSTAL: 1, PREFIX: 2, PARTIAL: 3 };

let rowsPromise = null;

/** Loads and caches the index; concurrent callers share the same request. */
function loadRows() {
  rowsPromise ??= fetch(FILE_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Liste des villes indisponible (${response.status})`);
      return response.text();
    })
    .then((text) =>
      text
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [key, name, country, npa, url] = line.split("\t");
          return { key, name, country: COUNTRIES[country] ?? country, npa, url };
        }),
    );

  return rowsPromise;
}

/** Returns a comparable rank for a row, or `null` when it does not match. */
function rank(row, needle) {
  if (row.key === needle) return [RANKS.EXACT, 0];
  if (row.npa === needle) return [RANKS.POSTAL, 0];
  if (row.key.startsWith(needle)) return [RANKS.PREFIX, 0];
  const index = row.key.indexOf(needle);
  return index > 0 ? [RANKS.PARTIAL, index] : null;
}

/**
 * Finds cities matching a query, best match first.
 * @param {string} query Free-text input; at least two characters are required.
 * @param {number} [limit] Maximum number of results.
 */
export async function searchCities(query, limit = 8) {
  const needle = toSlug(query);
  if (needle.length < 2) return [];

  const matches = [];
  for (const row of await loadRows()) {
    const value = rank(row, needle);
    if (value !== null) matches.push({ row, value });
  }

  matches.sort(
    (a, b) => a.value[0] - b.value[0] || a.value[1] - b.value[1] || a.row.key.localeCompare(b.row.key),
  );
  return matches.slice(0, limit).map(({ row }) => row);
}

/** Resolves a query to a single city, or `null` when nothing matches. */
export async function findCity(name) {
  return (await searchCities(name, 1))[0] ?? null;
}

/**
 * Downloads the index during browser idle time.
 *
 * The file is 2.1 MB. Loading it on the first keystroke makes that first search
 * feel broken; warming it up front overlaps the transfer with reading the page
 * and with any weather request already in flight.
 */
export function prefetchCities() {
  const start = () => loadRows().catch(() => {});
  if (typeof requestIdleCallback === "function") requestIdleCallback(start);
  else setTimeout(start, 0);
}
