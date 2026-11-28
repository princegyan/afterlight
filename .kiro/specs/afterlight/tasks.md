# Tasks and provenance

The following existing work was performed in Codex, not Kiro:

- [x] Implement validated intake, labeled demo fallback, and optional server-side model adapter.
- [x] Implement persistent scenario data and serialized mutations.
- [x] Implement queue, real Seattle basemap with simulated markers, human reviews, duplicate comparisons, situation drafts, audit, and reset.
- [x] Prepare tests, documentation, MIT license, and hosting configuration.

Actual Kiro work, completed November 21, 2026:

- [x] Review and refine these requirements/design with Kiro.
- [x] Implement reviewer corrections for affectedPeople and needs; preserve original suggestions and unknown values.
- [x] Use corrected fields in situation drafts; avoid unique-person totals from duplicate records.
- [x] Add meaningful validation, retry preservation, and before/after audit tests.
- [ ] Optionally validate a configured live AI model with missing/conflicting details and synthetic images.
- [x] Record dated prompts, code contributions, test results, and human corrections in the evidence log.
- [ ] Publish and validate app/repository/video links, then complete the Devpost submission.

Subsequent Codex review:

- [x] Correct count prefill, validation, provenance labels, and the generated contribution date; add six regression tests and independently check the browser workflow. See `docs/CODEX_REVIEW.md`.
