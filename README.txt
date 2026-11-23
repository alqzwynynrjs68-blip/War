WORLD DOMINION - Fix for always-visible administrative boundaries

This patch changes only js/app.js.
It increases the visibility of all administrative region outlines and fills,
including countries that are not currently selected. It does not alter or
replace map-data.js or admin-data.js.

Installation:
1. Extract this ZIP.
2. Copy the js/app.js file into your existing project's js folder.
3. Replace the old app.js.
4. Keep the existing js/map-data.js and js/admin-data.js files unchanged.
5. Hard-refresh the website / clear the browser cache after uploading.

Note: The existing project still uses the administrative features contained
in js/admin-data.js. This patch does not add invented boundaries.
