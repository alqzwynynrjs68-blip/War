WORLD DOMINION - GLOBAL WORLD MAP EXPANSION

Modified and added files:
- index.html
- css/styles.css
- js/app.js
- js/country-list.js (new)
- js/map-data.js (new global country outlines)
- js/admin-data.js (global ADM1 divisions)
- js/capital-data.js (capital locations)
- DATA-SOURCES.txt

Changes:
- Expanded the playable country list to the countries represented in the supplied global ADM1 dataset.
- Added 196 global country outlines and 3,201 first-level administrative divisions from the uploaded geoBoundaries file, while retaining the original Iraq and seven existing regional-country geometries unchanged.
- Kept administrative borders zoom-dependent using the existing Iraq map behavior.
- Added one capital city location for every mapped country, while preserving the existing seven Iraqi city locations.
- Reused the existing black-line city urban-plan artwork inside capital regions; no other cities were added outside Iraq.
- Preserved existing economy, diplomacy, trade, research, city-selection, and map interaction systems. Existing Iraq province shapes and the original eight country outlines/divisions were retained from the supplied game ZIP.
- Large world geometry files are loaded only after a country is selected, keeping the initial menu lightweight.
- Retained small islands and multipart geometries present in the supplied ADM1 source; no external island geometry was invented.

Install:
1. Keep the existing project folder and all existing assets.
2. Replace the files in this update ZIP at their matching paths.
3. Add the new js/country-list.js and js/capital-data.js files.
4. Upload the project and hard-refresh the browser.


المرحلة: تبسيط الحدود الساحلية والبرية (إصدار محافظ)
- تبسيط هندسي بمقدار 0.015 درجة مع الحفاظ على طوبولوجيا كل مضلع.
- لم يُقبل أي تبسيط يتجاوز تغير مساحة المكوّن الواحد 1.0%.
- تم تبسيط طبقتي حدود الدول والمقاطعات، مع الحفاظ على الخصائص والمعرفات وعدد المعالم.
- تم تبسيط أجزاء المضلع كلٌّ على حدة لمنع اختفاء الجزر أو المكونات المنفصلة.
- لم يتم حذف جزر أو مقاطعات إضافية في هذه المرحلة.
