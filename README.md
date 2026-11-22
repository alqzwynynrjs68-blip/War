# WORLD DOMINION — Browser Prototype 0.1

A responsive, offline-data browser prototype for the strategy game.

## Run
Because browsers restrict `fetch()` from local files, serve this folder through any static web server (or upload it to a static hosting provider). Open `index.html` through that server.

## Included in this first build
- Global first-level administrative divisions (3,224 features from the supplied geoBoundaries CGAZ ADM1 file), simplified for browser rendering.
- Derived country outlines, visually heavier than internal administrative boundaries.
- Iraq view with its 18 ADM1 governorates.
- Seven Iraqi city markers: Baghdad (distinct capital monument) and Basra, Najaf, Ramadi, Mosul, Sulaymaniyah, and Kut (shared city-model family).
- Clickable regions and cities, drag-to-pan, wheel zoom and touch drag, zoom controls, Iraq/world view toggles, responsive mobile layout.
- No map tiles or runtime external map-data requests. Geographic data is bundled locally.

## Data notes
The global ADM1 file represents the dataset's available first-level administrative divisions; it is not a guarantee that every country's administrative system is equivalent. See `DATA-SOURCE.txt` for source attribution.

## Current prototype limits
This is the map and interaction foundation, not yet a full grand-strategy simulation. It does not yet include armies, economy, diplomacy, construction, save games, or animated vehicle/unit movement. City markers are original stylized 2.5D canvas models, not detailed 3D assets.
