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
