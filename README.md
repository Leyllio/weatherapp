# WeatherApp

A single-page weather application built with vanilla HTML, CSS and JavaScript modules. No framework, no build step, no dependencies.

Search any of the 45,174 indexed cities, then read current conditions, a five-day overview and an hourly strip.

## Features

- **City search** over a local index, with diacritic-insensitive matching and keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`).
- **Current conditions**: temperature, apparent temperature, condition, wind, humidity, pressure, sunrise and sunset, coordinates and elevation.
- **Five-day overview** spread evenly across the full width, no horizontal scrolling.
- **Hourly strip** for the next 24 hours: reflowing cells on desktop, a vertical scrollable list on a phone.
- **Local weather pictograms**, drawn as CSS masks so the theme colours them and nothing is fetched from a CDN.
- **Light and dark themes**, following the OS preference on first visit and persisted afterwards.
- **Rain animation** on the wordmark, on hover only, and disabled under `prefers-reduced-motion`.

## Running

The app uses ES modules, so it must be served over HTTP rather than opened from the filesystem.

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Data

Weather data comes from [Open-Meteo](https://open-meteo.com), under the terms of their [licence](https://open-meteo.com/en/terms): free for non-commercial use, no API key, and CORS enabled. Please keep the attribution link when reusing this project.

Two requests are made per city: a geocoding lookup for its coordinates, then a forecast for those coordinates. Both answer in a few hundred milliseconds.

`data/cities.txt` is a tab-separated index of 45,174 cities used to power the search suggestions offline. It was generated once from an upstream city list and committed so a fresh clone runs without extra setup; the coordinates shown in the current conditions card are re-resolved through Open-Meteo geocoding.

## Layout

| Path | Role |
| --- | --- |
| `index.html` | Page shell: banner, search combobox, mount point |
| `css/style.css` | Design tokens, theming, layout, components, responsive rules |
| `js/text.js` | Diacritic stripping and slug generation |
| `js/dom.js` | `el()` element builder, icon and pictogram helpers |
| `js/cities.js` | City index loading, ranking and lookup |
| `js/weather.js` | Geocoding and forecast access, cache, WMO code mapping, payload shaping |
| `js/render.js` | View functions, one per section |
| `js/theme.js` | Theme resolution and persistence |
| `js/rain.js` | Rain particle generation for the wordmark |
| `js/main.js` | Controller: events, request lifecycle, rendering |

## Notes on performance

Latency is managed in `js/weather.js` with an in-memory cache mirrored into `sessionStorage`, request de-duplication, prefetching on suggestion hover, cancellation of abandoned requests, and a two-phase paint that shows cached data immediately. A 15 second ceiling on each request keeps a dead connection from leaving the interface waiting.
