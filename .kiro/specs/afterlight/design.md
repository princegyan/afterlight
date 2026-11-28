# Design

Existing vertical slice: validated report → optional model extraction or labeled demo parser → output schema validation → persistent record → editable human review → map/queue → situation snapshot → recorded audit entry.

The original `report`, model `extraction`, and human `review` are distinct objects. `displayFields` overlays only human changes for presentation. Locations use a supplied exercise point ID with explicit seeded latitude/longitude on a Leaflet/OpenStreetMap basemap. Model outputs never supply coordinates. Queue priorities derive from an explicit report-claim rubric, with reviewer decisions overriding suggestions.

Persistence uses a single mutation queue and atomic file replacement. The app is served by one Node process. API credentials remain server-side. Public deployment uses a demo access token and persistent disk.

The extension adds validated affectedPeople/needs overrides to `review`, preserves null as unknown, updates displayed/summarized fields, and tests retry preservation and repeated-review audit provenance. A configured model can additionally be tested with representative uncertain reports.

## Kiro extension — implemented decisions

- `review.affectedPeople` stores a nonnegative integer or null (unknown), validated by `validateReviewAffectedPeople`. Absent key means "not corrected; use extraction".
- `review.needs` stores a string array (0–12 items, each 1–600 characters), validated by `validateReviewNeeds`. An absent key means "not corrected; use extraction".
- `displayFields` merges `review` over `extraction` for all existing fields. For `affectedPeople` and `needs`, it uses the review value only when the key is explicitly present in the review object (covering null and empty array).
- `applyReview` reads `review.affectedPeople` and `review.needs` for `before` values on a repeated review; first-review `before` has no `affectedPeople`/`needs` keys.
- `situationDraft` collects needs using `displayFields(i).needs` so reviewed needs take precedence.
- Extraction retry (server `POST /api/incidents/:id/retry`) replaces `extraction`, `ai`, and `priority` only; existing `review` (including corrected affectedPeople/needs) is untouched.

## Codex review decisions — November 21, 2026

The review form uses the same displayed count as the details panel. A blank submission remains an explicit unknown, while an untouched known count is retained. Count validation checks type and decimal form syntax before numeric conversion, preventing boolean or whitespace coercion to a headcount. Per-field provenance distinguishes extracted values from reviewed values, including explicit unknowns and empty needs lists. See `docs/CODEX_REVIEW.md`.
