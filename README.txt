WORLD DOMINION - Border hierarchy and zoom visibility (V2)

This patch changes only the map rendering code and the app.js cache version.
It does not replace or modify map-data.js or admin-data.js.

Changes:
- Country borders remain visible at every zoom level and are thicker (2.9px; selected country 3.6px).
- Province/administrative borders are thinner (0.62px; selected region 1.15px).
- Province boundaries are hidden on the full Gulf overview (view width > 205 map units).
- They fade in as the camera zooms closer and are fully visible at 170 map units or closer.
- The app.js URL version is increased to avoid the browser reusing a cached older script.

Install:
1. Extract this ZIP.
2. Replace index.html in the project root.
3. Replace js/app.js in the project's js folder.
4. Keep js/map-data.js and js/admin-data.js exactly as they are.
5. Upload both replaced files to hosting and reload the page.
