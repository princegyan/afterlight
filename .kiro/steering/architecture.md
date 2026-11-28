---
inclusion: always
---
# Architecture

Node.js 22+ ESM with built-in HTTP API and no server runtime package dependencies. Leaflet browser assets are locally vendored and OpenStreetMap tiles load externally. Domain validation and rubric live in `lib/domain.mjs`; model requests stay server-side in `lib/ai.mjs`; serialized persistent mutations in `lib/store.mjs`; routing in `server.mjs`; browser UI in `public/app.js` and `public/styles.css`.

Preserve the API contract. Validate requests and model output. No client API keys. Preserve reviewer edits on retries. A JSON store supports only one process; database migration must be explicit. Static files are allowlisted. Map attribution must stay visible; preserve Leaflet license notices and normal tile caching. Do not add tile prefetching or offline downloads. Use `npm test` and `npm run check` before finishing changes.
