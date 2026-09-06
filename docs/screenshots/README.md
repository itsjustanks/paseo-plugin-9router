# Fictional-data screenshots

Every image is captured from the real plugin components through `apps/paseo/tests/ui`.
RPC calls are replaced with schema-validated fictional fixtures. No live daemon, accounts,
provider credentials, project details, or conversations are loaded.

Run `npm run preview:ui` from `apps/paseo`, then open `http://127.0.0.1:43198` in an isolated browser.
Use a 1280 × 1060 viewport and capture Overview, Accounts & quotas, the catalog filtered to `cx/`,
and Routing & Access → Token settings. Inspect every image before publishing it.

The existing filenames are retained: `setup.png` now shows Overview; `accounts.png`, `models.png`,
and `tuning.png` show the corresponding current views. `guide-mobile.png` shows the light theme
at 390 × 844. Do not use authenticated live screenshots in this public directory.
