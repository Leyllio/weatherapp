/**
 * Access to the prevision-meteo.ch JSON service.
 *
 * Every response follows the same shape: `city_info`, `current_condition`,
 * then `fcst_day_0` ... `fcst_day_4`. Each day carries a `hourly_data` map
 * keyed by `0H00`, `1H00`, ... `23H00`.
 *
 * The upstream service answers in roughly 20 seconds for a 52 KB payload and
 * sends `cache-control: no-store`, so there is no HTTP layer to lean on. All
 * perceived speed therefore comes from this module:
 *
 * - an in-memory cache with a freshness window, mirrored into sessionStorage so
 *   a page reload does not refetch either;
 * - request de-duplication, so repeated calls for one city share a single call;
 * - `prefetchWeather`, which starts a request before the user commits;
 * - `cancelWeather`, which aborts a request nobody is waiting for any more.
 */

const API_URL = "https://www.prevision-meteo.ch/services/json/";
const DAY_COUNT = 5;

/** The API only refreshes its observation hourly, so this is generous. */
const TTL = 10 * 60 * 1000;

/** Upper bound on cached cities, evicted least-recently-used first. */
const MAX_ENTRIES = 12;

/**
 * Ceiling for a single request.
 *
 * Measured latencies on the upstream service range from 15 s to 30 s, so this
 * sits comfortably above the worst observed response and only trips on a
 * genuinely dead connection.
 */
const TIMEOUT = 45_000;

const STORAGE_KEY = "weather-cache";

/** slug -> `{ data, expires }` */
const cache = new Map();

/** slug -> `Promise<data>` for the request currently on the wire. */
const inFlight = new Map();

/** slug -> `AbortController` */
const controllers = new Map();

/* ----------------------------------------------------------------- storage */

/** Reads the session mirror, tolerating private mode and quota errors. */
function readStorage() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** Writes the session mirror, tolerating quota errors. */
function writeStorage() {
  try {
    const payload = {};
    for (const [slug, entry] of cache) payload[slug] = entry;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* Storage unavailable or full: the in-memory cache still applies. */
  }
}

/** Seeds the cache from the session mirror, dropping expired entries. */
function hydrate() {
  const now = Date.now();
  for (const [slug, entry] of Object.entries(readStorage())) {
    if (entry?.expires > now) cache.set(slug, entry);
  }
}

hydrate();

/* ----------------------------------------------------------------- network */

/** Downloads a URL and parses it as JSON, with a readable HTTP error. */
async function getJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Reponse ${response.status}`);
  return response.json();
}

/* ------------------------------------------------------------------- cache */

/** Returns a fresh payload from cache, or `null`. */
export function getCachedWeather(citySlug) {
  const entry = cache.get(citySlug);
  if (!entry) return null;

  if (entry.expires <= Date.now()) {
    cache.delete(citySlug);
    return null;
  }

  return entry.data;
}

/** Stores a payload, evicting the least recently used city past the bound. */
function remember(citySlug, data) {
  cache.delete(citySlug);
  cache.set(citySlug, { data, expires: Date.now() + TTL });

  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
  writeStorage();
}

/**
 * Fetches the full forecast for a city slug such as `seyssinet-pariset`.
 *
 * Resolves from cache when the entry is still fresh. Concurrent calls for the
 * same city share a single network request.
 *
 * @throws {Error} When the API answers with a transport or payload error.
 */
export function fetchWeather(citySlug) {
  const cached = getCachedWeather(citySlug);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(citySlug);
  if (pending) return pending;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);
  controllers.set(citySlug, controller);

  const request = getJson(API_URL + encodeURIComponent(citySlug), controller.signal)
    .then((data) => {
      if (data.errors) throw new Error(data.errors[0]?.text ?? "Ville inconnue");
      remember(citySlug, data);
      return data;
    })
    .finally(() => {
      clearTimeout(timeout);
      inFlight.delete(citySlug);
      controllers.delete(citySlug);
    });

  inFlight.set(citySlug, request);
  return request;
}

/**
 * Warms the cache for a city without waiting for the result.
 *
 * Called when the user points at a suggestion, so the request is already in
 * flight by the time they click. Failures are swallowed on purpose: the real
 * call will surface them.
 */
export function prefetchWeather(citySlug) {
  if (cache.has(citySlug) || inFlight.has(citySlug)) return;
  fetchWeather(citySlug).catch(() => {});
}

/**
 * Aborts the request for a city, if any.
 *
 * Called when the selection moves on, so an abandoned 20 second request stops
 * consuming a connection instead of holding the UI hostage. The rejection it
 * produces belongs to whoever awaited `fetchWeather`.
 */
export function cancelWeather(citySlug) {
  controllers.get(citySlug)?.abort();
}

/* ------------------------------------------------------------------- shape */

/** Returns the five daily forecasts, skipping any missing day. */
export function getDays(data) {
  return Array.from({ length: DAY_COUNT }, (_, index) => data[`fcst_day_${index}`]).filter(Boolean);
}

/** Flattens a day's `hourly_data` into an array sorted by hour. */
export function getHourly(day) {
  if (!day?.hourly_data) return [];
  return Object.entries(day.hourly_data)
    .map(([key, value]) => ({ hour: Number.parseInt(key, 10), ...value }))
    .sort((a, b) => a.hour - b.hour);
}

/**
 * Picks the hourly entry matching the API's reported observation time, so the
 * current card can show measured values rather than daily averages.
 */
export function currentHourly(data) {
  const hourly = getHourly(data.fcst_day_0 ?? data.fcst_day_1);
  const observed = Number.parseInt(data.current_condition?.hour ?? "", 10);
  const fallback = Number.isNaN(observed) ? new Date().getHours() : observed;
  return hourly.find((entry) => entry.hour === fallback) ?? hourly[0];
}
