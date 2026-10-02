/**
 * View layer: every exported function returns a detached DOM node.
 *
 * Sections are grouped as current conditions, five-day overview, hourly strip,
 * and the two status cards (empty state and error).
 *
 * All of them read the normalised payload produced by `weather.js`; no upstream
 * field name appears here.
 */

import { el, icon, weatherIcon } from "./dom.js";

/* ------------------------------------------------------------------ stats */

/** Formats a value with its unit, falling back to a dash when missing. */
function format(value, unit) {
  if (value === null || value === undefined) return "-";
  return `${value}${unit ? ` ${unit}` : ""}`;
}

/** Single label/value pair; `iconName` prefixes the label with a glyph. */
function stat(label, value, unit, iconName) {
  return el(
    "div",
    { class: "stat" },
    el("dt", {}, iconName ? icon(iconName) : null, label),
    el("dd", {}, format(value, unit)),
  );
}

/** Titled cluster of stats, used for sun times and coordinates. */
function statGroup(label, iconName, stats) {
  return el(
    "div",
    { class: "stat-group" },
    el("dt", { class: "stat-group-label" }, iconName ? icon(iconName) : null, label),
    el("dd", { class: "stat-group-body" }, stats),
  );
}

/* ------------------------------------------------------------ conditions */

/** Live conditions: location, temperature, and the two statistics blocks. */
export function currentCard(data) {
  const current = data.current;

  return el(
    "section",
    { class: "card current" },
    el(
      "div",
      { class: "current-place" },
      el("h2", {}, data.name),
      el("p", { class: "muted" }, current.time.replace("T", " ")),
    ),
    el(
      "div",
      { class: "current-main" },
      weatherIcon(current.icon, current.condition, "80"),
      el(
        "div",
        {},
        el("p", { class: "current-temp" }, icon("temp"), `${current.temp}°`),
        el("p", { class: "muted" }, `${current.condition} - ressentie ${current.feels}°`),
      ),
    ),
    el(
      "dl",
      { class: "stats" },
      stat("Vent", current.wind, "km/h"),
      stat("Direction", current.windDir),
      stat("Humidite", current.humidity, "%", "humidity"),
      stat("Pression", current.pressure, "hPa"),
    ),
    el(
      "dl",
      { class: "stats" },
      statGroup("Soleil", "sun-horizon", [stat("Lever", data.sunrise), stat("Coucher", data.sunset)]),
      statGroup("Coordonnees", "globe", [
        stat("Latitude", data.latitude),
        stat("Longitude", data.longitude),
        stat("Altitude", data.elevation, "m"),
      ]),
    ),
  );
}

/* -------------------------------------------------------------- forecasts */

/** Five-day overview, one tile per day, spread evenly across the card. */
export function forecastBoard(data) {
  return el(
    "section",
    { class: "card forecast" },
    el("h2", {}, "Previsions"),
    el(
      "ul",
      { class: "week" },
      data.days.map((day, index) =>
        el(
          "li",
          { class: index === 0 ? "week-day is-today" : "week-day" },
          el(
            "header",
            { class: "week-head" },
            el("h3", {}, day.label),
            el("p", { class: "muted" }, day.date),
            weatherIcon(day.icon, day.condition, "44"),
            el("p", { class: "week-temps" }, icon("temp"), `${day.tmin} / ${day.tmax}`),
            el("p", { class: "week-condition muted" }, day.condition),
          ),
        ),
      ),
    ),
  );
}

/** The next 24 hourly steps; cells reflow on desktop and scroll on a phone. */
export function hourlyBoard(data) {
  const hours = data.hours;
  if (hours.length === 0) return null;

  return el(
    "section",
    { class: "card hours" },
    el("h2", {}, `Prochaines 24 heures`),
    el(
      "ul",
      { class: "hours-list" },
      hours.map((entry) =>
        el(
          "li",
          { class: "hours-cell" },
          el("span", { class: "hours-time" }, `${String(entry.hour).padStart(2, "0")}h`),
          weatherIcon(entry.icon, entry.condition, "28"),
          el("span", { class: "hours-detail hours-temp" }, icon("temp"), `${entry.temp}°`),
          el("span", { class: "hours-detail muted" }, `${entry.windDir} ${entry.wind}`),
          el(
            "span",
            { class: "hours-detail muted" },
            icon("humidity"),
            `${entry.humidity}%`,
          ),
        ),
      ),
    ),
  );
}

/* ----------------------------------------------------------------- states */

/** Paints the three weather sections for a payload. */
export function renderWeather(app, data) {
  const hourly = hourlyBoard(data);
  app.replaceChildren(currentCard(data), forecastBoard(data));
  if (hourly) app.append(hourly);
}

/** Marks the view busy without moving anything on screen. */
export function setLoading(isLoading) {
  document.getElementById("app").classList.toggle("is-loading", isLoading);
}

/** Failure card shown when the lookup or the forecast rejects. */
export function errorCard(message) {
  return el("section", { class: "card error" }, el("p", { class: "muted" }, message));
}

/** Empty state shown before any city has been selected. */
export function placeholderCard() {
  return el(
    "section",
    { class: "card placeholder" },
    el("h2", {}, "Aucune ville affichee"),
    el("p", { class: "muted" }, "Saisissez une ville puis appuyez sur Entree."),
  );
}
