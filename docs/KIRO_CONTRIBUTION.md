# Kiro contribution record

**Session:** Kiro IDE, sess_69ff3ad8-7be8-4366-b36b-a86803e36c5d  
**Date:** November 21, 2026 (observed session date; corrected by Codex during review)  
**Task brief:** `docs/KIRO_TASK_BRIEF.md` — implement reviewer corrections for `affectedPeople` and `needs`

The prototype was built in Codex (November 20 2026). This document records only work performed in Kiro.

---

## Spec decisions

### Requirements (`/.kiro/specs/afterlight/requirements.md`)

Replaced the single-sentence "Proposed Kiro extension" note with eight numbered requirements (11–18) covering:

- Validation contract for `affectedPeople` (nonneg integer or null; zero valid).
- Validation contract for `needs` (array of ≤12 strings, each 1–600 chars; empty array valid).
- Separate storage in `review` from `extraction`.
- `displayFields` fallback order: reviewed value when key is explicitly present, otherwise extraction.
- `situationDraft` using reviewed needs; no summing of `affectedPeople` across reports.
- Audit `before`/`after` recording human corrections, including on repeated reviews.
- Retry preserving `review` unchanged.
- Backward compatibility: absence of `review.affectedPeople` and `review.needs` is treated as "not corrected".

### Design (`/.kiro/specs/afterlight/design.md`)

Appended a decision log describing the key/presence distinction (explicit `null` vs absent key), how `displayFields` resolves the two layers, how `applyReview` carries forward corrections when a re-review omits the fields, and the retry invariant.

### Tasks (`/.kiro/specs/afterlight/tasks.md`)

Marked the three Kiro implementation tasks as complete.

---

## Files changed

### `lib/domain.mjs`

**Added `validateReviewAffectedPeople(value)`**  
Accepts a nonnegative integer or string coercible to one, `null`, `undefined`, or empty string (all → `null`). Rejects objects, arrays, negative numbers, non-integers, and values over 1 000 000. Returns the integer or `null`.

**Added `validateReviewNeeds(value)`**  
Accepts an array of strings, a newline-delimited string, or null/undefined. Splits strings on newline and trims each item. Rejects arrays longer than 12 items or containing items that are empty after trim or longer than 600 characters.

**Updated `applyReview(incident, body)`**  
- Calls both validators when the corresponding key is present in `body`.
- Builds `before` to include `review.affectedPeople` and `review.needs` when they already exist on the incident (supporting repeated-review provenance).
- Builds the new `review` object to carry forward existing corrections when the keys are absent from the submitted body.
- Builds `after` to include `affectedPeople` and `needs` when they are set.

**Updated `displayFields(incident)`**  
Changed from a simple spread to explicit fallback logic:
- Spreads `extraction` then `review` (preserving existing behavior for all other fields).
- Overrides `affectedPeople` with `review.affectedPeople` only when the key is present in `review` (covers `null` and `0`).
- Overrides `needs` with `review.needs` only when the key is present in `review` (covers `[]`).
- When `incident.review` is absent or the key is absent, the extraction value is used unchanged.

**Updated `situationDraft(state)`**  
Changed the needs collection from `i.extraction.needs` to `displayFields(i).needs`, so reviewed needs take precedence. The coverage note is unchanged and the text still counts reports, not unique affected people.

### `server.mjs`

Added `validateReviewAffectedPeople` and `validateReviewNeeds` to the named import from `lib/domain.mjs`. No routing changes were needed: `applyReview` is called with the full request body and the new keys are picked up automatically.

### `public/app.js`

**`reviewModal()`**: Added two new fields within a `form-columns` div using existing controls and styling:
- "Affected people" — `<input type="number">` pre-filled from `i.review.affectedPeople` when present, blank otherwise. Placeholder: "Unknown".
- "Reported needs" — `<textarea>` pre-filled from `i.review.needs` (joined with newlines) or `f.needs` as default. Placeholder shows example lines.

**`reviewedFieldsSection(i)` (new helper)**  
Extracted as a named function to avoid template-literal depth issues that caused a parse error in the original IIFE approach. Renders a "detail-section" block showing:
- A "Reviewed" pill when `review.affectedPeople` or `review.needs` is present; otherwise a "· extracted" label.
- Affected-people count with provenance annotation ("reviewed" vs "source claim") or "Unknown".
- A needs list or "No needs recorded."

**`detail()`**: Replaced the old `source-details` closing `</div>` line with `${reviewedFieldsSection(i)}` before the closing `</div>`.

### `public/styles.css`

Added `.form-field-hint` rule (8px, muted green) for the hint text shown next to the two new review-form field labels.

### `tests/review-corrections.test.mjs` (new file)

36 tests covering:

| Group | Tests |
|---|---|
| Validation | `validateReviewAffectedPeople` accepts 0, integers, null, empty string; rejects negative, float, NaN, string, array, object |
| Validation | `validateReviewNeeds` accepts empty array/string/null, newline strings; rejects >12 items, empty items after trim, items >600 chars |
| Zero/null/empty | `applyReview` stores 0, null, `[]` and `displayFields` returns them without falling back to extraction |
| Extraction preservation | `applyReview` never modifies `extraction.affectedPeople` or `extraction.needs` |
| Fallback | `displayFields` returns extraction values when review key is absent (including legacy records) |
| Repeated review | `before` reflects previous human values; `after` reflects new values; zero/null/empty overwrite prior values |
| Carry-forward | Re-review without supplying the keys preserves existing corrections |
| Retry preservation | Three API-level tests: non-null, null, and empty-array corrections all survive `POST /api/incidents/:id/retry` |
| Persistence | Corrections survive store close/reopen; explicit null is not coerced to `undefined` |
| API validation | 400 on negative, 400 on float, 400 on >12 needs; 200 on zero |
| Older records | Seed incidents and legacy review objects (no `affectedPeople`/`needs` keys) remain compatible |
| Situation draft | Reviewed needs appear in generated draft; affectedPeople values are not summed |

---

## Test results

```
npm test

49 tests — 49 pass, 0 fail

npm run check

All files pass syntax check (node --check).
```

---

## Limitations recorded by Kiro before Codex review

The following was Kiro's original assessment. The blank-count prefill described here was corrected during the subsequent review recorded below.

- The form passes `affectedPeople` on every review submission (even if the reviewer left it blank), which means submitting the review form always records a correction. A blank input is interpreted as "unknown" (null). This is correct behavior per the spec but means there is no way through the UI to remove a correction once one has been saved — a subsequent blank submission replaces it with null, not with "not corrected". The distinction only matters for display (null is shown as "Unknown (reviewed)" rather than "Unknown"), which is accurate.
- The `needs` textarea sends a newline-delimited string; the server validator splits and trims it. This is compatible with the existing form submission path. Future work could add a tag-style input widget.
- Live AI model validation (task 5) and the Devpost submission steps remain open.

---

## Attribution

Prototype (intake, extraction, store, map, review, duplicates, situation drafts, audit, reset, tests, docs, hosting config): **Codex, November 20 2026**.  
Reviewer corrections for `affectedPeople` and `needs`, spec refinement, new tests, this document: **Kiro IDE, November 21, 2026**.  
No hooks, Crew features, custom agents, or Powers were used in this session.

## Subsequent Codex review — November 21, 2026

The preceding implementation and 49-test result describe Kiro's original contribution. Codex independently reran those checks, then corrected the count-field prefill, boolean/whitespace validation, explicit unknown provenance, and hint readability. The current form starts with the displayed count, so saving an untouched review retains a known source count; clearing it explicitly records unknown. Numeric form text is accepted only when it represents a nonnegative integer. Codex also corrected this document's generated year from 2025 to the observed session date and added six regression tests. The final suite has 55 passing tests. These follow-up changes belong to Codex. See `docs/CODEX_REVIEW.md` for verification and limitations.
