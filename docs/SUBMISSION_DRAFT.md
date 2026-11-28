# Afterlight — A clearer picture from scattered reports

**Category:** Frankenstein

## Inspiration

During preparedness exercises, reports arrive as fragments: water near a building, a possible access interruption, a missing headcount, or overlapping descriptions. A shared map alone does not show what remains unknown or which conclusions a person has reviewed.

Afterlight is designed for exercise coordinators who need organized information without mistaking an AI suggestion for a verified fact.

## What it does

Afterlight turns fictional incident reports into structured, reviewable cards. Reports appear in a queue and real Seattle waterfront basemap with simulated markers. It exposes missing fields and uncertainty, suggests review priorities with an explicit rubric, and surfaces potentially related reports for side-by-side comparison.

Human reviewers can edit the structured record, decide status and priority, and inspect original source claims. Situation drafts summarize reported needs and review coverage. An activity log records submissions and decisions. The scenario can reset for repeatable demonstrations.

## How we built it

The current implementation uses browser JavaScript/CSS, a Node.js API, an atomically persisted JSON store, and a server-side OpenAI-compatible model adapter. Model outputs are schema-validated. A labeled deterministic parser keeps the synthetic demo usable if no AI connection is configured or the connection fails. Images can be attached; pixel analysis requires a connected vision model.

The real basemap uses OpenStreetMap tiles and Leaflet, with attribution and preserved library license notices. Exercise points, report data, and identities remain fictional. The exercise illustration is an original SVG asset.

## Why Frankenstein

The useful result comes from connecting intake, structured extraction, uncertainty, spatial context, duplicate comparison, human decisions, and reporting in a single workflow. Review decisions flow into the shared picture and remain inspectable in the activity trail.

## How Kiro was used

The initial prototype and prepared `.kiro` steering/spec documents were built using Codex. On November 21, 2026, Kiro IDE reviewed those specs and implemented reviewer-owned affected-people and needs corrections. It updated requirements/design/tasks, kept human corrections separate from source claims and extraction suggestions, used reviewed needs in situation drafts, and added 36 validation, persistence, retry, compatibility, and audit tests. Its original 49-test suite passed independent verification.

Codex subsequently found and corrected a count prefill bug, boolean/whitespace coercion, and provenance/readability issues; it corrected Kiro's generated year and added six regression tests. The final suite has 55 passing tests. Browser verification exercised actual review, retry, summary, and audit controls. The project retains the original sage/navy interface. See `docs/KIRO_CONTRIBUTION.md` and `docs/CODEX_REVIEW.md`. No hooks, Crew, custom agents, or Powers were used. Add public evidence links with the repository before submitting.

## Challenges and lessons

The key design challenge is making unknown facts visible instead of filling them with plausible guesses. Another is allowing human corrections while retaining original reports and model suggestions. Duplicate similarity is useful for review, but unsafe as an automatic merge decision.

## Limitations and next steps

Afterlight is a fictional preparedness prototype. It does not dispatch emergency services, verify images or incidents, or provide operational response advice. Its priorities are review suggestions. The activity log is not tamper-proof. A production version would need a transactional database, access controls, deeper validation, and user research.

Before submitting: deploy a persistent service, publish the licensed source with Kiro evidence, and publish the public demo. If demonstrating a live model, validate that provider separately.

## URLs still required

- Public application: **not deployed**
- Public GitHub repository: **not published**
- Public YouTube demonstration: **local 2:06 video completed; not published**
- Judge access instructions/token: **set when hosting**

This draft is not ready to submit until the required public links, judge access, and final participant checks are complete.
