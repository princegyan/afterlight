# Kiro implementation task

Open the extracted `afterlight` project folder in Kiro. This task was completed in Kiro on November 21, 2026; the prompt below is retained as task evidence.

## Prompt

Read `.kiro/steering/` and `.kiro/specs/afterlight/`, then inspect the current app. The existing prototype was built with Codex. Keep that attribution accurate and document only work you actually perform in Kiro.

Implement reviewer-owned corrections for **affectedPeople** and **needs**:

1. Update the feature requirements, design, and tasks before implementation.
2. Add an editable affected-people field, accepting a nonnegative integer or unknown/null. Zero is a valid reported value. Add editable reported needs as a bounded list.
3. Store human corrections separately from original reports and extraction suggestions. Preserve explicit nulls and empty lists. Existing records and older review requests must remain compatible.
4. Show reviewed values in report details. Situation reports must use reviewed needs when present, otherwise extracted needs. Do not infer a unique-person total by adding potentially duplicate reports.
5. Record accurate before/after counts and needs in review audit entries. Repeated reviews must record the previous human values. Extraction retry must preserve the human corrections.
6. Add meaningful tests for zero/null/empty overrides, invalid values, repeated-review provenance, persistence, retry preservation, summary behavior, and older records. Run `npm test` and `npm run check`.
7. Update the task list and write `docs/KIRO_CONTRIBUTION.md` describing your actual spec decisions, files changed, tests, and any unresolved limitations. Do not claim hooks, Crew, custom agents, or powers unless used.

Preserve the restored sage/navy UI, real Seattle basemap, and all existing workflows. Extend the review form using its existing controls and styling; do not redesign the interface. Do not read secrets, change `.env`, reset current `data/`, edit vendored Leaflet assets, publish anything, or install unrelated dependencies.

Work only in this project. Synthetic fixtures can be used for tests. Finish with a concise implementation summary and actual verification results.
