/**
 * View layer: every exported function returns a detached DOM node.
 *
 * Sections are grouped as current conditions, five-day overview, hourly strip,
 * and the two status cards (empty state and error).
 */

import { el, icon, weatherIcon } from "./dom.js";
import { getDays, getHourly, currentHourly } from "./weather.js";

/* ------------------------------------------------------------------ stats */

/** Formats a value with its unit, falling back to a dash when missing. */
function format(value, unit) {
  if (value === null || value === undefined || value === "") return "-";
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
export function currentCard(data, hourly) {
  const current = data.current_condition ?? {};
  const city = data.city_info ?? {};

  return el(
    "section",
    { class: "card current" },
    el(
      "div",
      { class: "current-place" },
      el("h2", {}, city.name ?? "-"),
      el("p", { class: "muted" }, `${city.country ?? ""} - ${current.date ?? ""} ${current.hour ?? ""}`),
    ),
    el(
      "div",
      { class: "current-main" },
      weatherIcon(current.icon, current.condition, "80"),
      el(
        "div",
        {},
        el("p", { class: "current-temp" }, icon("temp"), `${current.tmp ?? "-"}°`),
        el("p", { class: "muted" }, current.condition ?? ""),
      ),
    ),
    el(
      "dl",
      { class: "stats" },
      stat("Vent", hourly?.WNDSPD10m ?? current.wnd_spd, "km/h"),
      stat("Direction", hourly?.WNDDIRCARD10 ?? current.wnd_dir),
      stat("Humidite", hourly?.RH2m ?? current.humidity, "%", "humidity"),
      stat("Pression", hourly?.PRMSL ?? current.pressure, "hPa"),
      stat("Precipitations", hourly?.APCPsfc, "mm"),
      stat("Nuages", hourly?.LCDC, "%"),
    ),
    el(
      "dl",
      { class: "stats" },
      statGroup("Soleil", "sun-horizon", [stat("Lever", city.sunrise), stat("Coucher", city.sunset)]),
      statGroup("Coordonnees", "globe", [
        stat("Latitude", Number(city.latitude).toFixed(2)),
        stat("Longitude", Number(city.longitude).toFixed(2)),
        stat("Altitude", city.elevation, "m"),
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
      getDays(data).map((day, index) =>
        el(
          "li",
          { class: index === 0 ? "week-day is-today" : "week-day" },
          el(
            "header",
            { class: "week-head" },
            el("h3", {}, day.day_long ?? day.day_short ?? ""),
            el("p", { class: "muted" }, day.date ?? ""),
            weatherIcon(day.icon, day.condition, "44"),
            el("p", { class: "week-temps" }, icon("temp"), `${day.tmin ?? "--"} / ${day.tmax ?? "--"}`),
            el("p", { class: "week-condition muted" }, day.condition ?? ""),
          ),
        ),
      ),
    ),
  );
}

/** Today's 24 hourly steps; cells reflow and wrap instead of scrolling. */
export function hourlyBoard(data) {
  const day = data.fcst_day_0 ?? data.fcst_day_1;
  const hours = getHourly(day);
  if (hours.length === 0) return null;

  return el(
    "section",
    { class: "card hours" },
    el("h2", {}, `Aujourd'hui - ${day.date ?? ""}`),
    el(
      "ul",
      { class: "hours-list" },
      hours.map((entry) =>
        el(
          "li",
          { class: "hours-cell" },
          el("span", { class: "hours-time" }, `${String(entry.hour).padStart(2, "0")}h`),
          weatherIcon(entry.ICON, entry.CONDITION, "28"),
          el(
            "span",
            { class: "hours-detail hours-temp" },
            icon("temp"),
            `${Math.round(entry.TMP2m ?? 0)}°`,
          ),
          el("span", { class: "hours-detail muted" }, `${entry.WNDDIRCARD10 ?? ""} ${entry.WNDSPD10m ?? 0}`),
          el(
            "span",
            { class: "hours-detail muted" },
            icon("humidity"),
            `${entry.RH2m ?? 0}%`,
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
  app.replaceChildren(currentCard(data, currentHourly(data)), forecastBoard(data));
  if (hourly) app.append(hourly);
}

/** Marks the view busy without moving anything on screen. */
export function setLoading(isLoading) {
  document.getElementById("app").classList.toggle("is-loading", isLoading);
}

/** Failure card shown when the API or the city lookup rejects. */
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
