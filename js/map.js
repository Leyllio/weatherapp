/**
 * Floating map panel.
 *
 * The map stays out of the page flow: a hover button in the bottom right corner
 * opens it as a small square. An expand button grows it to the whole viewport so
 * a point can be picked precisely, and picking one shrinks it back to the square,
 * which is what makes the panel usable next to the weather it just changed.
 */

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Zoom for a city located by name, and for a point picked by hand. */
const CITY_ZOOM = 10;
const PICK_ZOOM = 12;

/** Where the panel opens: Switzerland, framed rather than zoomed to a city. */
const HOME = { lat: 46.8, lng: 7.1, zoom: 7 };

/** Longest a size transition may run before Leaflet is told to measure. */
const TRANSITION_MS = 400;

/**
 * Creates the panel and wires its buttons.
 *
 * @param {(point: {lat: number, lng: number}) => void} onPick
 *   Called with the coordinates of the point the user clicked.
 * @returns {{locate: (place: object) => void, shrink: (point: object) => void}}
 */
export function createMapPanel(onPick) {
  const panel = document.getElementById("map-panel");
  const toggle = document.getElementById("map-toggle");
  const expand = document.getElementById("map-expand");

  const map = L.map("map", { scrollWheelZoom: false }).setView([HOME.lat, HOME.lng], HOME.zoom);

  L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
  map.on("click", ({ latlng }) => onPick({ lat: latlng.lat, lng: latlng.lng }));

  let marker = null;

  /** Moves the marker and frames the map on a point. */
  const frame = (lat, lng, zoom) => {
    marker = marker ?? L.marker([lat, lng]).addTo(map);
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], zoom);
  };

  /**
   * Tells Leaflet the container changed size.
   *
   * Leaflet caches its container size, so without this the tiles stay laid out
   * for the previous box and the map looks empty. It is deferred until the CSS
   * transition ends, with a timeout in case that event never arrives.
   */
  const resize = () => {
    const settle = () => map.invalidateSize({ animate: false });

    panel.addEventListener("transitionend", settle, { once: true });
    setTimeout(settle, TRANSITION_MS);
  };

  /** Applies a size and refreshes the button that switches to the other one. */
  const resizeTo = (size) => {
    const isFull = size === "full";

    panel.dataset.size = size;
    expand.textContent = isFull ? "reduire" : "agrandir";
    expand.setAttribute("aria-label", isFull ? "Reduire la carte" : "Agrandir la carte");
    resize();
  };

  toggle.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) resize();
  });

  expand.addEventListener("click", () => resizeTo(panel.dataset.size === "full" ? "mini" : "full"));

  return {
    /** Centres the map on a city the weather view is already showing. */
    locate: ({ latitude, longitude }) => frame(latitude, longitude, CITY_ZOOM),

    /** Frames a point just picked, then returns the panel to its square. */
    shrink: ({ lat, lng }) => {
      frame(lat, lng, PICK_ZOOM);
      resizeTo("mini");
    },
  };
}