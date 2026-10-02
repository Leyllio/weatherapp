# WeatherApp

A single-page weather application built with vanilla HTML, CSS and JavaScript modules. No framework, no build step, no dependencies.

Search any of the 45,174 indexed cities, then read current conditions, a five-day overview and an hourly strip.

## Features

- **City search** over a local index, with diacritic-insensitive matching and keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`).
- **Current conditions**: temperature, condition, wind, humidity, pressure, precipitation, cloud cover, sunrise and sunset, coordinates and elevation.
- **Five-day overview** spread evenly across the full width, no horizontal scrolling.
- **Hourly strip** for the current day, reflowing between a minimum and maximum cell size instead of scrolling.
- **Light and dark themes**, following the OS preference on first visit and persisted afterwards.
- **Rain animation** on the wordmark, on hover only, and disabled under `prefers-reduced-motion`.

## Running

The app uses ES modules, so it must be served over HTTP rather than opened from the filesystem.

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Data

Weather data comes from the [prevision-meteo.ch](https://www.prevision-meteo.ch) JSON service, under the terms of their [data retrieval documentation](https://www.prevision-meteo.ch/uploads/pdf/recuperation-donneo-meteo.pdf). Please keep the attribution link when reusing this project.

`data/cities.txt` is a tab-separated index of 45,174 cities, generated once from the upstream `list-cities` endpoint and committed so a fresh clone runs without extra setup. Its CORS headers are unreliable, which is why the file is fetched locally rather than proxied through the browser.

## Layout

| Path | Role |
| --- | --- |
| `index.html` | Page shell: banner, search combobox, mount point |
| `css/style.css` | Design tokens, theming, layout, components, responsive rules |
| `js/text.js` | Diacritic stripping and slug generation |
| `js/dom.js` | `el()` element builder, icon and pictogram helpers |
| `js/cities.js` | City index loading, ranking and lookup |
| `js/weather.js` | API access, response cache, payload shaping |
| `js/render.js` | View functions, one per section |
| `js/theme.js` | Theme resolution and persistence |
| `js/rain.js` | Rain particle generation for the wordmark |
| `js/main.js` | Controller: events, request lifecycle, rendering |

## Notes on performance

The upstream API answers in roughly 15 to 30 seconds and sends `cache-control: no-store`, so there is no HTTP layer to cache. Latency is therefore managed in `js/weather.js` with an in-memory cache mirrored into `sessionStorage`, request de-duplication, prefetching on suggestion hover, cancellation of abandoned requests, and a two-phase paint that shows cached data immediately.
