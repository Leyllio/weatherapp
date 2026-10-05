/**
 * Acces aux donnees de prevision-meteo.ch.
 *
 * Un seul point d'entree : `fetchWeather` demande une ville (par nom) ou un point
 * (par coordonnees) et renvoie toujours la meme forme de donnees, que la couche
 * de rendu consomme.
 *
 * La forme normalisee :
 *
 *   { name, latitude, longitude, elevation, sunrise, sunset,
 *     current: { time, temp, wind, gust, windDir, humidity, pressure, condition, icon },
 *     days:  [ { date, label, tmin, tmax, condition, icon } x5 ],
 *     hours: [ { hour, temp, wind, windDir, humidity, condition, icon } x24 ] }
 */

import { capitalize } from "./text.js";

const SERVICE_URL = "https://www.prevision-meteo.ch/services/json";

const DAY_COUNT = 5;
const HOUR_COUNT = 24;

/** Nom de ville attendu par le service : minuscules, sans accents, tirets. */
function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** URL du flux JSON, soit par ville, soit par coordonnees. */
function serviceUrl(target) {
  const path = typeof target === "string" ? slugify(target) : `lat=${target.lat.toFixed(3)}lng=${target.lng.toFixed(3)}`;
  return `${SERVICE_URL}/${path}`;
}

/**
 * Mots-cles du service vers une icone de `img/weather`, du plus specifique au
 * plus general. Une condition inconnue retombe sur un ciel couvert.
 */
const ICONS = [
  ["orage", "thunder"],
  ["neige", "snow"],
  ["pluie", "rain"],
  ["averse", "rain"],
  ["brouillard", "fog"],
  ["brume", "fog"],
  ["stratus", "fog"],
  ["eclaircie", "cloud-sun"],
  ["voile", "cloud-sun"],
  ["clair", "sun"],
  ["ciel", "sun"],
  ["passages-nuageux", "cloud-sun"],
  ["faiblement-nuageux", "cloud-sun"],
  ["nuageux", "cloud"],
  ["nuageuse", "cloud"],
  ["couvert", "cloud"],
  ["ensoleille", "sun"],
  ["degagee", "sun"],
  ["degage", "sun"],
];

/** Les memes icones, version nuit, pour les conditions codes `nuit-`. */
const NIGHT_ICONS = { sun: "moon", "cloud-sun": "cloud-moon" };

/** Libelle francais et icone d'une condition, a partir de sa cle `condition_key`. */
function describe(conditionKey) {
  const key = conditionKey ?? "";
  const icon = ICONS.find(([keyword]) => key.includes(keyword))?.[1] ?? "cloud";
  const isNight = key.startsWith("nuit-");
  return { icon: isNight ? (NIGHT_ICONS[icon] ?? icon) : icon };
}

/** Arrondi d'affichage, avec un tiret pour une valeur manquante. */
function round(value, digits = 0) {
  return typeof value === "number" ? Number(value.toFixed(digits)) : null;
}

/** `12H00` devient `12`, pour l'ordre chronologique des heures. */
function hourOf(key) {
  return Number.parseInt(key, 10);
}

/** Assemble les cinq jours de prevision. */
function readDays(raw) {
  return Array.from({ length: DAY_COUNT }, (_, index) => {
    const day = raw[`fcst_day_${index}`] ?? {};
    return {
      date: day.date ?? "",
      label: day.day_long ?? day.day_short ?? "",
      tmin: round(day.tmin),
      tmax: round(day.tmax),
      condition: day.condition ?? "",
      ...describe(day.condition_key),
    };
  });
}

/**
 * Assemble les 24 heures du jour courant.
 *
 * Le service indexe les heures de `0H00` a `23H00` dans cet ordre : la cle sert
 * donc directement a les trier.
 */
function readHours(raw) {
  const hourly = raw.fcst_day_0?.hourly_data ?? {};

  return Object.keys(hourly)
    .sort((a, b) => hourOf(a) - hourOf(b))
    .slice(0, HOUR_COUNT)
    .map((key) => {
      const entry = hourly[key];
      return {
        hour: hourOf(key),
        temp: round(entry.TMP2m),
        wind: round(entry.WNDSPD10m),
        windDir: entry.WNDDIRCARD10 ?? "-",
        humidity: round(entry.RH2m),
        condition: entry.CONDITION ?? "",
        ...describe(entry.CONDITION_KEY),
      };
    });
}

/** Convertit la reponse brute du service en donnees affichables. */
export function normalise(raw, fallbackName) {
  const city = raw.city_info ?? {};
  const current = raw.current_condition ?? {};

  return {
    name: capitalize(city.name && city.name !== "NA" ? city.name : fallbackName),
    latitude: round(Number(city.latitude), 4),
    longitude: round(Number(city.longitude), 4),
    elevation: round(Number(city.elevation)),
    sunrise: city.sunrise ?? "-",
    sunset: city.sunset ?? "-",
    current: {
      time: `${current.date ?? ""} ${current.hour ?? ""}`.trim(),
      temp: round(current.tmp),
      wind: round(current.wnd_spd),
      gust: round(current.wnd_gust),
      windDir: current.wnd_dir ?? "-",
      humidity: round(current.humidity),
      pressure: round(current.pressure),
      condition: current.condition ?? "",
      ...describe(current.condition_key),
    },
    days: readDays(raw),
    hours: readHours(raw),
  };
}

/**
 * Recupere les previsions d'une ville ou d'un point.
 *
 * @param {string|{lat: number, lng: number}} target
 * @returns {Promise<object>} Les donnees normalisees.
 * @throws {Error} Si la ville est inconnue ou si le service ne repond pas.
 */
export async function fetchWeather(target) {
  const response = await fetch(serviceUrl(target));

  const isCity = typeof target === "string";
  const label = isCity ? target : `${target.lat.toFixed(2)}, ${target.lng.toFixed(2)}`;

  /** Le service ignore la nature de la cible, l'erreur doit la nommer. */
  const unknown = () => new Error(isCity ? `Ville introuvable : ${label}` : `Aucune prevision pour ${label}`);

  if (!response.ok) throw response.status === 404 ? unknown() : new Error(`Reponse ${response.status}`);

  // Une ville inconnue ne donne pas un 404 mais un 200 accompagne d'un `errors`,
  // seul signe fiable que la demande a echoue.
  const raw = await response.json();
  if (raw.errors) throw unknown();

  const data = normalise(raw, label);
  if (!Number.isFinite(data.latitude)) throw unknown();

  return data;
}