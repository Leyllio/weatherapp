/**
 * Rain effect layered behind the wordmark in the banner.
 *
 * Drops are plain nodes generated once and animated purely by CSS. The layer is
 * transparent and paused while the brand is not hovered, so it costs nothing at
 * rest and it can never paint outside `.banner-brand` thanks to the clipping of
 * `.rain-layer`.
 */

import { el } from "./dom.js";

const SELECTOR = ".rain-layer";

/** Drop count bounds and density, one drop every few pixels of brand width. */
const MIN_DROPS = 12;
const MAX_DROPS = 45;
const DROPS_PER_PIXEL = 0.25;

/** Duration and delay windows, in milliseconds, randomised to avoid sync. */
const MIN_DURATION = 320;
const MAX_DURATION = 700;
const MAX_DELAY = 2000;

/** Trailing debounce so a resize storm does not regenerate drops repeatedly. */
const RESIZE_DEBOUNCE = 200;

/** Random integer within an inclusive range. */
function randRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Populates the rain layer with drops scaled to the brand size.
 *
 * Drops are spread evenly with a one pixel jitter instead of purely at random,
 * which guarantees even coverage of the wordmark without leaving gaps.
 */
function fill(layer) {
  const width = layer.getBoundingClientRect().width;
  if (width === 0) return;

  const count = Math.min(MAX_DROPS, Math.max(MIN_DROPS, Math.round(width * DROPS_PER_PIXEL)));

  layer.replaceChildren(
    ...Array.from({ length: count }, (_, index) =>
      el("div", {
        class: "drop",
        style: {
          left: `${Math.round((index * width) / count + randRange(-1, 1))}px`,
          top: `${-randRange(4, Math.round(layer.getBoundingClientRect().height))}px`,
          animationDuration: `${randRange(MIN_DURATION, MAX_DURATION) / 1000}s`,
          animationDelay: `${randRange(0, MAX_DELAY) / 1000}s`,
        },
      }),
    ),
  );
}

/** Generates the rain and keeps it sized to the brand across layout changes. */
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
