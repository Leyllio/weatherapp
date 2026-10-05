/**
 * Carte Leaflet, affichee au-dessus de la meteo.
 *
 * Le clic sur la carte renvoie les coordonnees du point choisi ; le controleur
 * s'en sert pour demander la meteo de ce point et pour nommer le lieu.
 */

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Point et zoom demandes pour une ville trouvee par son nom. */
const CITY_VIEW = 11;
const PICK_VIEW = 12;

/**
 * Cree la carte, branche son clic et expose deux methodes.
 *
 * @param {(position: {lat: number, lng: number}) => void} onPick
 *   Appele avec les coordonnees du point clique.
 * @returns {{showCity: (city: object) => void, showPoint: (position: object) => void}}
 */
export function createMap(onPick) {
  const map = L.map("map", { scrollWheelZoom: false }).setView([46.8, 7.1], 7);

  L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
  map.on("click", ({ latlng }) => onPick({ lat: latlng.lat, lng: latlng.lng }));

  let marker = null;

  /** Deplace le marqueur et recadre la carte. */
  const moveTo = (lat, lng, zoom) => {
    marker = marker ?? L.marker([lat, lng]).addTo(map);
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], zoom);
  };

  return {
    /** Cadrage sur une ville nommee. */
    showCity: ({ latitude, longitude }) => moveTo(latitude, longitude, CITY_VIEW),

    /** Cadrage serré sur un point choisi a la souris. */
    showPoint: ({ lat, lng }) => moveTo(lat, lng, PICK_VIEW),
  };
}