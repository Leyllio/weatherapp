/**
 * Application controller: wires the city combobox and the floating map to the
 * weather views, and remembers the last selected city between visits.
 *
 * The view is painted twice per selection: once immediately from cache when
 * possible, then again with the network result. A generation counter makes sure
 * a slow or aborted request can never overwrite a newer selection.
 */

import { el } from "./dom.js";
import { initTheme } from "./theme.js";
import { createRain } from "./rain.js";
import { createMapPanel } from "./map.js";
import { searchCities, findCity, prefetchCities } from "./cities.js";
import { readLastCity, writeLastCity } from "./storage.js";
import {
  fetchWeather,
  fetchWeatherAt,
  pointKey,
  getCachedWeather,
  prefetchWeather,
  cancelWeather,
} from "./weather.js";
import {
  currentCard,
  forecastBoard,
  hourlyBoard,
  renderWeather,
  setLoading,
  setPlaceName,
  errorCard,
  placeholderCard,
} from "./render.js";

const input = document.getElementById("city-input");
const app = document.getElementById("app");
const suggestions = document.getElementById("suggestions");

/** The floating map, created on boot with the point picker it reports to. */
const map = createMapPanel(showPoint);

let results = [];
let highlighted = -1;

/** Slug of the request currently displayed, used to cancel it if it changes. */
let shownSlug = null;

/** Incremented on every selection; a response from an older run is discarded. */
let generation = 0;

/* ------------------------------------------------------------ suggestions */

/** Clears the listbox and resets the keyboard cursor. */
function closeSuggestions() {
  suggestions.replaceChildren();
  suggestions.hidden = true;
  input.setAttribute("aria-expanded", "false");
  highlighted = -1;
}

/** Repaints the listbox from `results`, marking the highlighted option. */
function renderSuggestions() {
  suggestions.replaceChildren(
    ...results.map((city, index) =>
      el(
        "li",
        {
          id: `suggestion-${index}`,
          role: "option",
          "aria-selected": String(index === highlighted),
          onclick: () => selectCity(city),
          onpointerenter: () => prefetchWeather(city.url, city.name, city.countryCode),
          onfocus: () => prefetchWeather(city.url, city.name, city.countryCode),
        },
        el("span", {}, city.name),
        city.npa ? el("span", { class: "npa muted" }, city.npa) : null,
        el("span", { class: "country muted" }, city.country),
      ),
    ),
  );

  suggestions.hidden = results.length === 0;
  input.setAttribute("aria-expanded", String(!suggestions.hidden));
}

/** Moves the keyboard cursor, wrapping around both ends. */
function highlight(delta) {
  if (results.length === 0) return;
  highlighted = (highlighted + delta + results.length) % results.length;
  renderSuggestions();
  suggestions.children[highlighted]?.scrollIntoView({ block: "nearest" });
  prefetchWeather(results[highlighted].url, results[highlighted].name, results[highlighted].countryCode);
}

/** Applies a city: fills the input, closes the listbox, then loads weather. */
function selectCity(city) {
  input.value = city.name;
  closeSuggestions();
  show(city);
}

/** Runs a query and refreshes the listbox, ignoring failures. */
async function runSearch(query) {
  results = await searchCities(query);
  highlighted = -1;
  renderSuggestions();
}

/* ----------------------------------------------------------------- render */

/**
 * Paints a payload, aborting the request it replaces.
 *
 * A fresh cache entry is painted straight away, so going back to a city already
 * visited costs no round trip.
 *
 * @param {string} key Cache key of the place, used to abort its predecessor.
 * @param {() => Promise<object>} load The request for this place.
 * @returns {Promise<{data: object, isCurrent: () => boolean}|undefined>}
 *   `undefined` when the request was superseded or failed. `isCurrent` lets a
 *   follow-up step know whether its own result is still worth applying.
 */
async function paint(key, load) {
  if (shownSlug !== null && key !== shownSlug) cancelWeather(shownSlug);
  shownSlug = key;

  const run = ++generation;
  const isCurrent = () => run === generation;

  const cached = getCachedWeather(key);
  if (cached) renderWeather(app, cached);
  else setLoading(true);

  try {
    const data = await load();
    if (!isCurrent()) return;

    renderWeather(app, data);
    return { data, isCurrent };
  } catch (error) {
    if (!isCurrent() || error.name === "AbortError") return;
    app.replaceChildren(errorCard(error.message ?? "Impossible de recuperer la meteo."));
  } finally {
    if (isCurrent()) setLoading(false);
  }
}

/**
 * Loads a city from the search, then follows it on the map.
 *
 * @param {object} city A row of the city index.
 */
async function show(city) {
  const painted = await paint(city.url, () => fetchWeather(city.url, city.name, city.countryCode));
  if (!painted) return;

  writeLastCity(city);
  map.locate(painted.data);
}

/**
 * Loads the weather of a point picked on the map, and then names it.
 *
 * The forecast answers for any pair of coordinates, so nothing has to be looked
 * up first and the weather shows as soon as it arrives. Naming the point is a
 * second, independent request: it only replaces the place name, and the
 * coordinates stand in when it fails or when the user has already moved on.
 *
 * @param {{lat: number, lng: number}} point
 */
async function showPoint(point) {
  const { key } = pointKey(point.lat, point.lng);
  const painted = await paint(key, () => fetchWeatherAt(point.lat, point.lng));
  if (!painted) return;

  input.value = painted.data.name;
  map.shrink(point);

  const name = await nameOf(point);
  if (name === null || !painted.isCurrent()) return;

  input.value = name;
  setPlaceName(name);
}

/**
 * Names a point through reverse geocoding, or returns `null`.
 *
 * The forecast carries coordinates only, so the place name comes from here.
 * Nominatim expects an identifying user agent and throttles anonymous traffic, so
 * its failure is expected and must not affect the weather.
 */
async function nameOf({ lat, lng }) {
  const params = new URLSearchParams({ format: "jsonv2", zoom: "10", lat: String(lat), lng: String(lng) });

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
    return response.ok ? (await response.json()).name : null;
  } catch {
    return null;
  }
}

/** Resolves the typed query to the best city, reporting when nothing matches. */
async function submit() {
  const query = input.value.trim();
  if (query.length === 0) return;

  closeSuggestions();
  const city = await findCity(query);
  if (!city) {
    app.replaceChildren(errorCard(`Ville introuvable : ${query}`));
    return;
  }
  await show(city);
}

/* ----------------------------------------------------------------- events */

/** Selects the whole value so typing replaces it instead of appending. */
input.addEventListener("focus", () => input.select());

input.addEventListener("input", () => {
  runSearch(input.value).catch((error) => {
    console.error(error);
    closeSuggestions();
  });
});

input.addEventListener("keydown", (event) => {
  const actions = {
    ArrowDown: () => highlight(1),
    ArrowUp: () => highlight(-1),
    Enter: () => (highlighted >= 0 && results[highlighted] ? selectCity(results[highlighted]) : submit()),
    Escape: closeSuggestions,
  };

  const action = actions[event.key];
  if (!action) return;
  event.preventDefault();
  action();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("#menu")) closeSuggestions();
});

/* ------------------------------------------------------------------- boot */

initTheme();
createRain();
prefetchCities();
app.replaceChildren(placeholderCard());

const lastCity = readLastCity();
if (lastCity) show(lastCity);
