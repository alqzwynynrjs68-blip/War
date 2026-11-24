WORLD DOMINION - DIPLOMACY & RESEARCH UPDATE

Modified files only:
- js/app.js
- css/styles.css

Install:
1. Extract this ZIP.
2. Replace js/app.js and css/styles.css in your existing GitHub repository.
3. Keep index.html, js/map-data.js, js/admin-data.js, and assets unchanged.
4. Commit/push the changes, then refresh the deployed game (hard refresh if needed).

Changes:
- Research infantry card redesigned with a visual banner, unit symbol, title, and short description.
- Country list now displays each country's current relationship.
- Relationship choices are vertical, with white symbols for peace, war, trade, and military passage.
- Country location button zooms to the country and briefly flashes its outline on the map.
- Diplomacy conversation button navigates to the Conversations tab and opens the selected country's chat inside the main panel, not a popup.
- Sent messages remain visible while switching between the chat and the conversation list during the current game session.

WORLD DOMINION - GEOGRAPHIC URBAN PLAN UPDATE

Modified files:
- js/app.js
- assets/city-urban-plan.png
- README-UPDATE.txt

Changes:
- Added the supplied urban-plan reference as a transparent black-line PNG (white paper removed; original proportions and linework retained).
- The same plan is rendered as an SVG image inside the main geographic map for each currently defined city marker whose coordinates fall inside an ADM1 province.
- Plans are positioned at the city coordinates, scaled proportionally to their province bounds, and clipped to the province geometry so no drawing extends beyond its boundary.
- Plans are hidden until the map reaches the existing 2.2x city-detail zoom threshold; they then scale naturally with the map during pan and zoom.
- Plan graphics ignore pointer input, leaving province and city selection interactions intact.
- Existing city markers, camera movement, zoom controls, province boundaries, and other game systems are retained.

Install:
- For a full replacement, use WORLD_DOMINION_update3_full.zip.
- For a targeted update, replace js/app.js and add assets/city-urban-plan.png at the same paths.

WORLD DOMINION - PROVINCE CITY SELECTION UPDATE

Modified files:
- js/app.js

Changes:
- City location dots appear from 1.50x zoom and disappear at 2.40x zoom.
- Removed clickable city miniature/model markers from the map overlay.
- City dots are decorative and do not intercept pointer input.
- Clicking a province now checks whether one of the configured city coordinates lies inside that province. If so, the city selection panel opens with the city name, happiness, Build, and Recruit Army actions.
- Provinces without a configured city continue to show the province panel with its Build action.
- Province geometry remains the interactive map target; no province boundaries, city coordinates, or camera controls were changed.

WORLD DOMINION - MIDDLE EAST GEOGRAPHIC EXPANSION & HYDROGRAPHY

Modified / added files:
- index.html
- js/app.js
- js/region-data.js (new geographic vector data)
- README-UPDATE.txt
- DATA-SOURCES.txt (new attribution and data-source notes)

Changes:
- Expanded the geographic map extent to approximately 23°E–68°E and 12°N–44.5°N, showing the wider Middle East around the existing Gulf-region map.
- Added real coastline and land geometry, inland lake polygons, country boundary linework, and river paths to the same SVG map layer system.
- Added Arabic labels for the surrounding countries, major seas/gulfs, and selected rivers/lakes.
- Water and land geometry are part of the map SVG, so they follow the existing pan, zoom, and camera behavior. They do not intercept map clicks.
- Existing playable-country list, country selection, province data, city markers, urban plans, diplomacy, research, and other gameplay systems remain unchanged.
- The additional surrounding countries are geographic map coverage only in this update; they are not added as playable countries or new diplomacy entries.

Install:
- For a full replacement, use WORLD_DOMINION_update5_full.zip.
- For a targeted update, replace/add the files listed above at the same paths.
