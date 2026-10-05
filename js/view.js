/**
 * Rendu de la meteo dans `#data`.
 *
 * Chaque fonction renvoie un bloc independant : le controleur assemble les blocs
 * dont il a besoin et remplace `#data` en un seul appel.
 */

import { toAscii } from "./text.js";

const data = document.getElementById("data");

/** Cree un element ; `class`, `style` et `on*` sont traites a part. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "style") Object.assign(node.style, value);
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(toAscii(child)));
  }
  return node;
}

/** Pictogramme meteo, en CSS pour qu'il herite de la couleur du texte. */
function weatherIcon(kind, label, size) {
  return el("span", {
    class: `icon icon-${kind}`,
    role: "img",
    "aria-label": label,
    style: { width: `${size}px`, height: `${size}px` },
  });
}

/** Paire libelle/valeur ; une valeur absente devient un tiret. */
function stat(label, value, unit = "") {
  return el("div", { class: "stat" }, el("dt", {}, label), el("dd", {}, `${value ?? "-"}${unit}`));
}

/* ------------------------------------------------------------- sections */

/** Conditions actuelles : ville, temperature, vent, humidite, soleil. */
function currentCard(weather) {
  const current = weather.current;

  return el(
    "section",
    { class: "card current" },
    el("h2", {}, weather.name),
    el(
      "div",
      { class: "current-main" },
      weatherIcon(current.icon, current.condition, "64"),
      el("div", {}, el("p", { class: "current-temp" }, `${current.temp}°`), el("p", { class: "muted" }, current.condition)),
    ),
    el(
      "dl",
      { class: "stats" },
      stat("Vent", current.wind, " km/h"),
      stat("Rafales", current.gust, " km/h"),
      stat("Direction", current.windDir),
      stat("Humidite", current.humidity, " %"),
      stat("Pression", current.pressure, " hPa"),
      stat("Lever", weather.sunrise),
      stat("Coucher", weather.sunset),
    ),
    el(
      "p",
      { class: "muted place-meta" },
      `${weather.latitude}, ${weather.longitude} - ${weather.elevation ?? "-"} m - ${current.time}`,
    ),
  );
}

/** Les cinq jours, un carreau par jour. */
function forecastCard(weather) {
  return el(
    "section",
    { class: "card forecast" },
    el("h2", {}, "Previsions"),
    el(
      "ul",
      { class: "week" },
      weather.days.map((day, index) =>
        el(
          "li",
          { class: index === 0 ? "week-day is-today" : "week-day" },
          el("h3", {}, day.label),
          el("p", { class: "muted" }, day.date),
          weatherIcon(day.icon, day.condition, "40"),
          el("p", { class: "week-temps" }, `${day.tmin} / ${day.tmax}`),
          el("p", { class: "week-condition muted" }, day.condition),
        ),
      ),
    ),
  );
}

/** Les 24 heures du jour. */
function hourlyCard(weather) {
  return el(
    "section",
    { class: "card hours" },
    el("h2", {}, "Prochaines 24 heures"),
    el(
      "ul",
      { class: "hours-list" },
      weather.hours.map((entry) =>
        el(
          "li",
          { class: "hours-cell" },
          el("span", { class: "hours-time" }, `${String(entry.hour).padStart(2, "0")}h`),
          weatherIcon(entry.icon, entry.condition, "26"),
          el("span", { class: "hours-temp" }, `${entry.temp}°`),
          el("span", { class: "muted" }, `${entry.windDir} ${entry.wind} km/h`),
          el("span", { class: "muted" }, `${entry.humidity} %`),
        ),
      ),
    ),
  );
}

/* --------------------------------------------------------------- etats */

/** Affiche les trois sections pour une ville ou un point. */
export function renderWeather(weather) {
  data.replaceChildren(currentCard(weather), forecastCard(weather), hourlyCard(weather));
}

/** Affiche un message d'erreur a la place des sections. */
export function renderError(message) {
  data.replaceChildren(el("section", { class: "card error" }, el("p", { class: "muted" }, message)));
}

/** Invite a saisir une ville, affichee au premier lancement. */
export function renderPlaceholder() {
  data.replaceChildren(
    el("section", { class: "card placeholder" }, el("h2", {}, "Aucune ville affichee"), el("p", { class: "muted" }, "Saisissez une ville puis appuyez sur afficher.")),
  );
}