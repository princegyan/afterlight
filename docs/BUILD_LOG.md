# Build provenance

Initial build date: November 20, 2026. Follow-up entry: November 21, 2026.

The user supplied the Kiroween link and Afterlight playbook, then selected **All** for rules summary, project fit review, and help building the project. Kiro had not been set up during the initial Codex build.

## Work in this session

- Codex inspected the official page, rules, schedule, and 15-page playbook.
- Codex authored the Node server, domain model, persistent store, optional AI adapter, initial SVG map (subsequently replaced), illustration, browser UI, tests, documentation, and `.kiro` preparation files.
- The chosen stack simplifies the recommended Next.js/Supabase architecture to remove external setup from the working local demo.
- All seed reports, participants, and map coordinates are synthetic.
- At the user’s request, Codex replaced the SVG map with Leaflet 1.9.4 and real OpenStreetMap tiles centered on Seattle’s waterfront. The standard Leaflet library is vendored with its license; fictional incident points remain labeled as simulated. No pre-existing application code was copied. Node/browser APIs and the local test runtime were used.
- During this initial build, no Kiro tool, custom Kiro agent, Kiro Crew workflow, Kiro hook, or Kiro power had run.
- No actual live AI provider call, remote database deployment, public repository, public video, or Devpost submission has been completed.

## Verification

The original verification below refers to the initial build. On November 21, the user completed the reviewer-corrections task in Kiro. Kiro refined three spec files, implemented affected-people/needs review and provenance, and added 36 tests. Codex independently reran all 49 tests, reproduced count-prefill and coercion issues, corrected them, and added six regression tests. The final 55-test suite and syntax checks pass. Browser review covered the actual correction/retry/summary/audit/persistence flow. Attribution and limitations are recorded in `KIRO_CONTRIBUTION.md` and `CODEX_REVIEW.md`.

Automated checks and browser verification are recorded in `VERIFICATION.md` after execution. The fake model service used in tests verifies schema rejection, model provenance labels, and connection fallback; it is not evidence of live provider quality.
