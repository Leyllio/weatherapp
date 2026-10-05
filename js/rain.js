/**
 * Pluie sur le mot-symbole du bandeau.
 *
 * Les gouttes sont des noeuds generes une fois, animes uniquement en CSS. La
 * couche reste transparente et en pause tant que le mot-symbole n'est pas
 * survole : au repos elle ne coute rien, et le decoupage de `.rain-layer`
 * l'empeche de peindre hors du bandeau.
 */

const SELECTOR = ".rain-layer";

/** Nombre de gouttes et densite : une goutte tous les quelques pixels. */
const MIN_DROPS = 12;
const MAX_DROPS = 45;
const DROPS_PER_PIXEL = 0.25;

/** Duree et decalage, en millisecondes, tires au sort pour desynchroniser. */
const MIN_DURATION = 320;
const MAX_DURATION = 700;
const MAX_DELAY = 2000;

/** Anti-rebond, pour ne pas regenerer les gouttes a chaque redimensionnement. */
const RESIZE_DEBOUNCE = 200;

/** Entier aleatoire dans un intervalle inclusif. */
function randRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Remplit la couche de gouttes a la taille du mot-symbole.
 *
 * Les gouttes sont reparties regulierement avec un pixel de bruit plutot que
 * purely au hasard, ce qui couvre le mot-symbole sans laisser de trou.
 */
function fill(layer) {
  const { width, height } = layer.getBoundingClientRect();
  if (width === 0) return;

  const count = Math.min(MAX_DROPS, Math.max(MIN_DROPS, Math.round(width * DROPS_PER_PIXEL)));

  const drops = Array.from({ length: count }, (_, index) => {
    const drop = document.createElement("div");
    drop.className = "drop";
    Object.assign(drop.style, {
      left: `${Math.round((index * width) / count + randRange(-1, 1))}px`,
      top: `${-randRange(4, Math.round(height))}px`,
      animationDuration: `${randRange(MIN_DURATION, MAX_DURATION) / 1000}s`,
      animationDelay: `${randRange(0, MAX_DELAY) / 1000}s`,
    });
    return drop;
  });

  layer.replaceChildren(...drops);
}

/** Genere la pluie et la garde a la bonne taille lors des changements de mise en page. */
export function createRain() {
  const layer = document.querySelector(SELECTOR);
  if (!layer) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  fill(layer);

  let timer;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => fill(layer), RESIZE_DEBOUNCE);
  });
}