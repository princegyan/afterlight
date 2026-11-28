# Verification — November 20, 2026

## Automated checks

Initial Codex build: `npm test`: **13 passed, 0 failed**.

Covered request boundaries, image signature/size validation, missing and uncertain counts, malformed model output, explicit map coordinates, the priority rubric, all status/priority combinations, source preservation, repeated-review audit provenance, duplicate decisions, empty summaries, persistent API flow, concurrent writes, access tokens, cross-origin writes, static allowlisting, Leaflet asset serving, and model connection fallback. The provider tests use a local fake service.

`npm run check`: passed JavaScript syntax checks for the server, domain, AI adapter, store, and browser app.

## Browser checks

Verified in the Codex in-app browser using the app's actual controls:

- Overview loads the seed reports and shows explicit demo extraction labels.
- New report → prepared synthetic sample → submit creates a saved report.
- Human title/summary corrections save and survive extraction retry.
- Duplicate comparison records a related decision without removing reports.
- Situation draft shows report counts, timestamp, needs, and coverage caveat.
- Export Markdown produces a downloaded file; a sample is in `examples/situation-report.md`.
- Activity log shows the human decision and before/after field values.
- Real OpenStreetMap tiles load over Seattle's waterfront; attribution is visible.
- Markers can be selected by Enter, and selected report detail updates.
- Search filters both the queue and map markers; empty results are handled.
- Desktop 1440×1050 and mobile 390×844 layouts have no horizontal page overflow.
- The mobile report dialog opens and settings navigation remains accessible.

API tests verify that confirmed reset restores 10 seeded reports and clears drafts. The final preview was returned to this initial state.

The initial standalone headless browser launch was unavailable in this environment, so interaction and layout verification used the connected in-app browser. The Kiro workflow, a live AI provider, Docker runtime, public deployment, and public submission links have not been validated. These checks are not a full accessibility audit or a production reliability assessment.

Screenshots show the real-map prototype in desktop/mobile views and a generated situation draft.

## Independent review after Kiro development — November 21, 2026

Kiro's original contribution passed 49 tests and the syntax checks. Codex's subsequent corrections and six regression tests passed the final 55-test suite and all syntax checks. An isolated headless Edge session exercised actual UI controls for a known count prefill and untouched save, zero/unknown counts, empty needs, retry preservation, summaries, before/after audit values, and persisted JSON. Desktop and mobile form layouts passed the browser checks with no script errors or horizontal overflow; the mobile Save button was reachable. The user's current data was not modified. After granting network permission, all visible real Seattle basemap tiles loaded successfully. See `CODEX_REVIEW.md` for full evidence and remaining limits.
