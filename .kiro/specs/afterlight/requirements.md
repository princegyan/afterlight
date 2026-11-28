# Afterlight requirements

Prepared in Codex; reviewed and extended in Kiro on November 21, 2026. Subsequent Codex corrections are recorded in `docs/CODEX_REVIEW.md`.

1. WHEN a participant submits a synthetic report, THE SYSTEM SHALL validate text, supplied fictional location, and optional PNG/JPEG before storing it.
2. WHEN facts are absent or uncertain, THE SYSTEM SHALL preserve unknown values and uncertainty rather than inventing counts or coordinates.
3. WHEN a configured model fails or returns invalid output, THE SYSTEM SHALL retain the report using clearly labeled demo extraction and offer retry.
4. WHEN a reviewer edits title, summary, category, location, priority, or status, THE SYSTEM SHALL preserve source text and model suggestions and record before/after decisions.
5. WHEN extraction is retried, THE SYSTEM SHALL retain reviewer edits.
6. WHEN report similarities suggest a possible duplicate, THE SYSTEM SHALL explain the signal and require a reviewer decision without merging or suppressing records.
7. WHEN a situation draft is generated, THE SYSTEM SHALL snapshot current report counts, statuses, reported needs, gaps, timestamp, and coverage caveat.
8. WHEN the scenario is reset with confirmation, THE SYSTEM SHALL restore ten synthetic reports and clear exercise additions.
9. THE UI SHALL label simulation and assistance provenance and support narrow screens and keyboard interaction.
10. THE PROJECT SHALL disclose actual Kiro usage separately from prepared `.kiro` files.

## Kiro extension — implemented

11. WHEN a reviewer submits affectedPeople in a review, THE SYSTEM SHALL accept a nonnegative integer up to 1,000,000 or null (unknown). Decimal numeric form text must resolve to a permitted integer; blank text means unknown. Booleans and nonnumeric values SHALL be rejected. Zero is a valid reported value.
12. WHEN a reviewer submits needs in a review, THE SYSTEM SHALL accept an array of up to 12 strings (each 1–600 characters) and reject arrays that exceed those bounds. An empty array is valid.
13. THE SYSTEM SHALL store reviewer-supplied affectedPeople and needs inside the existing `review` object, separately from `extraction`. Explicit null and empty array are stored as-is and never coerced.
14. WHEN displaying a report, THE SYSTEM SHALL show the reviewed affectedPeople and needs if present; otherwise fall back to the extraction values.
15. WHEN generating a situation draft, THE SYSTEM SHALL use reviewed needs when present, otherwise extraction needs. It SHALL NOT sum affectedPeople values across reports to produce a unique-person total.
16. WHEN a reviewer saves a review and human corrections for affectedPeople or needs already exist, THE SYSTEM SHALL record the previous human values in the audit entry's `before` field and the new values in `after`.
17. WHEN extraction is retried, THE SYSTEM SHALL preserve any existing reviewer corrections for affectedPeople and needs.
18. Existing records that have no `review.affectedPeople` or `review.needs` MUST remain compatible; absence of those fields is treated as deferred to extraction.
19. WHEN opening the review form, THE UI SHALL prefill the currently displayed affectedPeople and needs, retaining explicit human zero/null/empty values. Saving an untouched form SHALL NOT clear a known count.
