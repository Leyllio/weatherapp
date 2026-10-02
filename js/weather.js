/**
 * Weather data from Open-Meteo, normalised into one predictable shape.
 *
 * Two calls per city: a geocoding lookup for its coordinates, then a forecast
 * for those coordinates. Both are keyless, CORS enabled and answer in a few
 * hundred milliseconds, so the module keeps a small cache plus prefetch and
 * cancellation for repeat visits but no longer has to work around a slow
 * upstream.
 *
 * The normalised payload, which `render.js` consumes and nothing else should:
 *
 *   { name, country, latitude, longitude, elevation, sunrise, sunset,
 *     current: { time, temp, feels, humidity, pressure, wind, windDir,
 *                condition, icon },
 *     days:  [ { date, label, tmin, tmax, condition, icon } x5 ],
 *     hours: [ { hour, temp, wind, windDir, humidity, condition, icon } x24 ] }
 */

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const CURRENT_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "surface_pressure",
  "wind_speed_10m",
  "wind_direction_10m",
  "weather_code",
  "is_day",
];

const HOURLY_FIELDS = ["temperature_2m", "wind_speed_10m", "wind_direction_10m", "relative_humidity_2m", "weather_code"];
const DAILY_FIELDS = ["weather_code", "temperature_2m_max", "temperature_2m_min", "sunrise", "sunset"];

const DAY_COUNT = 5;
const HOUR_COUNT = 24;

/** Open-Meteo updates roughly every 15 minutes, so this is comfortably long. */
const TTL = 10 * 60 * 1000;

/** Upper bound on cached cities, evicted least-recently-used first. */
const MAX_ENTRIES = 12;

/** A dead connection should fail fast enough to still show an error card. */
const TIMEOUT = 15_000;

const STORAGE_KEY = "weather-cache";

/**
 * WMO weather code to French label and icon name.
 *
 * Day and night share a row except for the clear and mostly-clear codes, which
 * fall back to their moon variant through `describe`.
 */
const WMO = {
  0: ["Ensoleille", "sun"],
  1: ["Plutot degage", "cloud-sun"],
  2: ["Partiellement nuageux", "cloud-sun"],
  3: ["Couvert", "cloud"],
  45: ["Brouillard", "fog"],
  48: ["Brouillard givrant", "fog"],
  51: ["Bruine legere", "rain"],
  53: ["Bruine", "rain"],
  55: ["Bruine dense", "rain"],
  56: ["Bruine verglaçante", "rain"],
  57: ["Bruine verglaçante", "rain"],
  61: ["Pluie legere", "rain"],
  63: ["Pluie", "rain"],
  65: ["Pluie forte", "rain"],
  66: ["Pluie verglaçante", "rain"],
  67: ["Pluie verglaçante", "rain"],
  71: ["Neige legere", "snow"],
  73: ["Neige", "snow"],
  75: ["Neige forte", "snow"],
  77: ["Grains de neige", "snow"],
  80: ["Averses", "rain"],
  81: ["Averses", "rain"],
  82: ["Averses violentes", "rain"],
  85: ["Averses de neige", "snow"],
  86: ["Averses de neige", "snow"],
  95: ["Orage", "thunder"],
  96: ["Orage et grele", "thunder"],
  99: ["Orage et grele", "thunder"],
};

const NIGHT_ICON = { sun: "moon", "cloud-sun": "cloud-moon" };

const DAY_LABELS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

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

/** Looks up the coordinates of a city, by name or by the index slug. */
async function geocode(query, signal) {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=1&language=fr&format=json`;
  const data = await getJson(url, signal);
  const place = data.results?.[0];

  if (!place) throw new Error(`Ville introuvable : ${query}`);

  return { latitude: place.latitude, longitude: place.longitude, elevation: place.elevation };
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
 * Fetches the full forecast for a city.
 *
 * `citySlug` is the index slug and doubles as the cache key; `cityName` is the
 * display name, which geocodes more reliably than a slug and is what the view
 * shows. Resolves from cache when the entry is still fresh, and concurrent
 * calls for the same city share a single pair of requests.
 *
 * @throws {Error} When the lookup or the forecast fails.
 */
export function fetchWeather(citySlug, cityName = citySlug) {
  const cached = getCachedWeather(citySlug);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(citySlug);
  if (pending) return pending;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);
  const { signal } = controller;
  controllers.set(citySlug, controller);

  const request = (async () => {
    const place = await geocode(cityName, signal);
    const params = new URLSearchParams({
      latitude: place.latitude,
      longitude: place.longitude,
      current: CURRENT_FIELDS.join(","),
      hourly: HOURLY_FIELDS.join(","),
      daily: DAILY_FIELDS.join(","),
      timezone: "auto",
      forecast_days: DAY_COUNT,
    });

    const raw = await getJson(`${FORECAST_URL}?${params}`, signal);
    const data = normalise(raw, cityName, place.elevation);
    remember(citySlug, data);
    return data;
  })().finally(() => {
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
export function prefetchWeather(citySlug, cityName) {
  if (cache.has(citySlug) || inFlight.has(citySlug)) return;
  fetchWeather(citySlug, cityName).catch(() => {});
}

/**
 * Aborts the request for a city, if any.
 *
 * Called when the selection moves on, so an abandoned request stops consuming a
 * connection. The rejection it produces belongs to whoever awaited `fetchWeather`.
 */
export function cancelWeather(citySlug) {
  controllers.get(citySlug)?.abort();
}

/* ------------------------------------------------------------------- shape */

/** Turns a WMO code into a French label and a day or night icon name. */
function describe(code, isDay) {
  const [label, icon] = WMO[code] ?? ["Inconnu", "cloud"];
  const resolved = isDay ? icon : (NIGHT_ICON[icon] ?? icon);
  return { condition: label, icon: resolved };
}

/** Rounds a coordinate or a measurement for display. */
function round(value, digits = 0) {
  return value === null || value === undefined ? null : Number(value.toFixed(digits));
}

/** `2026-10-02T07:35` becomes `07:35`. */
function clockOf(iso) {
  return typeof iso === "string" ? iso.slice(11, 16) : "-";
}

/** `2026-10-02` becomes a French weekday label. */
function labelOf(dateIso) {
  const weekday = new Date(`${dateIso}T00:00:00`).getDay();
  return DAY_LABELS[weekday] ?? "";
}

/** Reads a value from one of Open-Meteo's parallel hourly arrays. */
function at(arrays, index, field) {
  return arrays[field]?.[index] ?? null;
}

/**
 * Converts a raw Open-Meteo payload into the normalised shape.
 *
 * Exported for tests, which feed it a recorded fixture instead of the network.
 */
export function normalise(raw, cityName, elevation) {
  const current = raw.current ?? {};
  const daily = raw.daily ?? {};
  const hourly = raw.hourly ?? {};

  const currentCode = current.weather_code;
  const currentIsDay = (current.is_day ?? 1) === 1;

  const days = Array.from({ length: DAY_COUNT }, (_, index) => ({
    date: daily.time?.[index] ?? "",
    label: labelOf(daily.time?.[index] ?? ""),
    tmin: round(daily.temperature_2m_min?.[index]),
    tmax: round(daily.temperature_2m_max?.[index]),
    ...describe(daily.weather_code?.[index], true),
  }));

  // The hourly series starts at local midnight, so the current hour is the first
  // entry at or after the observation time.
  const start = Math.max(
    0,
    (hourly.time ?? []).findIndex((iso) => iso >= (current.time ?? "")),
  );

  const hours = Array.from({ length: HOUR_COUNT }, (_, offset) => {
    const index = start + offset;
    const iso = hourly.time?.[index];
    return {
      hour: iso ? new Date(iso).getHours() : 0,
      temp: round(at(hourly, index, "temperature_2m")),
      wind: round(at(hourly, index, "wind_speed_10m")),
      windDir: compass(at(hourly, index, "wind_direction_10m")),
      humidity: round(at(hourly, index, "relative_humidity_2m")),
      ...describe(at(hourly, index, "weather_code"), currentIsDay),
    };
  });

  return {
    name: cityName,
    country: "",
    latitude: round(raw.latitude, 4),
    longitude: round(raw.longitude, 4),
    elevation: round(elevation),
    sunrise: clockOf(daily.sunrise?.[0]),
    sunset: clockOf(daily.sunset?.[0]),
    current: {
      time: current.time ?? "",
      temp: round(current.temperature_2m),
      feels: round(current.apparent_temperature),
      humidity: round(current.relative_humidity_2m),
      pressure: round(current.surface_pressure),
      wind: round(current.wind_speed_10m),
      windDir: compass(current.wind_direction_10m),
      ...describe(currentCode, currentIsDay),
    },
    days,
    hours,
  };
}

/** Compass point for a bearing in degrees, or `-` when unknown. */
function compass(degrees) {
  if (degrees === null || degrees === undefined) return "-";
  const points = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return points[Math.round(((degrees % 360) / 45)) % 8];
}
