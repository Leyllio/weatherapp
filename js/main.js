/**
 * Application controller: wires the city combobox to the weather views and
 * remembers the last selected city between visits.
 *
 * The view is painted twice per selection: once immediately from cache when
 * possible, then again with the network result. A generation counter makes sure
 * a slow or aborted request can never overwrite a newer selection.
 */

import { el } from "./dom.js";
import { capitalize } from "./text.js";
import { initTheme } from "./theme.js";
import { createRain } from "./rain.js";
import { searchCities, findCity, prefetchCities } from "./cities.js";
import {
  fetchWeather,
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
  errorCard,
  placeholderCard,
} from "./render.js";

const LAST_CITY_KEY = "last-city";

const input = document.getElementById("city-input");
const app = document.getElementById("app");
const suggestions = document.getElementById("suggestions");

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
 * Loads a city.
 *
 * Paints from cache straight away when the entry is still fresh, so revisiting
 * a city is instant instead of costing another round trip.
 */
async function show(city) {
  if (shownSlug !== null && shownSlug !== city.url) cancelWeather(shownSlug);
  shownSlug = city.url;

  const run = ++generation;
  const cached = getCachedWeather(city.url);

  if (cached) renderWeather(app, cached);
  else setLoading(true);

  try {
    const data = await fetchWeather(city.url, city.name, city.countryCode);
    if (run !== generation) return;

    localStorage.setItem(LAST_CITY_KEY, JSON.stringify({ url: city.url, name: city.name }));
    renderWeather(app, data);
  } catch (error) {
    if (run !== generation || error.name === "AbortError") return;
    app.replaceChildren(errorCard(error.message ?? "Impossible de recuperer la meteo."));
  } finally {
    if (run === generation) setLoading(false);
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

/**
 * Last selected city, so a reload restores the name as it was displayed.
 * Falls back to treating an older bare slug as both name and key.
 */
function readLastCity() {
  const raw = localStorage.getItem(LAST_CITY_KEY);
  if (!raw) return null;

  try {
    const saved = JSON.parse(raw);
    if (saved?.url) return { url: saved.url, name: capitalize(saved.name ?? saved.url) };
  } catch {
    /* Written before the name was stored: a bare slug. */
  }

  return { url: raw, name: capitalize(raw) };
}

initTheme();
createRain();
prefetchCities();
app.replaceChildren(placeholderCard());

const lastCity = readLastCity();
if (lastCity) show(lastCity);
