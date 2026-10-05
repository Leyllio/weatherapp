/**
 * Point d'entree de la SPA.
 *
 * Une seule action utilisateur : nommer une ville, ou cliquer la carte. Les deux
 * finissent dans `show`, qui charge les donnees puis peint le resultat. Un
 * compteur de generation empeche une reponse tardive d'effacer une selection
 * plus recente.
 */

import { initTheme } from "./theme.js";
import { createRain } from "./rain.js";
import { capitalize } from "./text.js";
import { fetchWeather } from "./weather.js";
import { createMap } from "./map.js";
import { renderWeather, renderError, renderPlaceholder } from "./view.js";

/** Geocodage inverse, pour nommer un point clique. */
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

const input = document.getElementById("city-input");
const button = document.getElementById("show-button");

/** Incremente a chaque chargement : seules les reponses du dernier comptent. */
let generation = 0;

/**
 * Charge et affiche une ville (par son nom) ou un point (par ses coordonnees).
 *
 * @param {string|{lat: number, lng: number}} target
 */
async function show(target) {
  const run = ++generation;
  const isCity = typeof target === "string";
  button.disabled = true;

  try {
    const weather = await fetchWeather(target);
    if (run !== generation) return;

    const label = isCity ? capitalize(target) : ((await nameOf(target)) ?? weather.name);
    if (run !== generation) return;

    input.value = label;
    renderWeather({ ...weather, name: label });

    if (isCity) map.showCity(weather);
    else map.showPoint(target);
  } catch (error) {
    if (run !== generation) return;
    renderError(error.message ?? "Impossible de recuperer la meteo.");
  } finally {
    if (run === generation) button.disabled = false;
  }
}

/**
 * Nom lisible d'un point clique, ou `null`.
 *
 * Le flux JSON ne nomme pas un point arbitraire : nominatim comble ce manque.
 * Son echec n'est pas grave, les coordonnees servent alors d'etiquette.
 */
async function nameOf({ lat, lng }) {
  const params = new URLSearchParams({ format: "jsonv2", zoom: "10", lat: String(lat), lng: String(lng) });

  try {
    const response = await fetch(`${NOMINATIM_URL}?${params}`);
    return response.ok ? capitalize((await response.json()).name) : null;
  } catch {
    return null;
  }
}

const map = createMap(show);

button.addEventListener("click", () => {
  const query = input.value.trim();
  if (query.length > 0) show(query);
});

input.addEventListener("keydown", ({ key }) => {
  if (key === "Enter") button.click();
});

initTheme();
createRain();
renderPlaceholder();