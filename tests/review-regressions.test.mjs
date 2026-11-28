// Codex review regressions, November 21, 2026. Kiro's original tests remain separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, applyReview, displayFields, situationDraft, validateReviewAffectedPeople, InputError } from '../lib/domain.mjs';

const review = overrides => ({ title: 'Reviewed exercise report', summary: 'Synthetic review for a fictional exercise.', category: 'Flooding', locationId: 'eastbank', status: 'Reviewed', priority: 'Moderate', ...overrides });

test('review counts reject booleans rather than converting them to people', () => {
  for (const value of [true, false]) assert.throws(() => validateReviewAffectedPeople(value), InputError);
});

test('review counts accept decimal integer text and reject other numeric encodings', () => {
  assert.equal(validateReviewAffectedPeople(' 12 '), 12);
  assert.equal(validateReviewAffectedPeople('000'), 0);
  assert.equal(validateReviewAffectedPeople('12.0'), 12);
  assert.equal(validateReviewAffectedPeople('1e2'), 100);
  for (const value of ['0x10', '1.5', Infinity]) assert.throws(() => validateReviewAffectedPeople(value), InputError);
});

test('whitespace in a count is unknown rather than zero', () => {
  assert.equal(validateReviewAffectedPeople('   '), null);
});

test('a rejected count leaves the previous human review untouched', () => {
  const incident = createSeed().incidents[1];
  applyReview(incident, review({ affectedPeople: 12, needs: ['Shelter'] }));
  const before = structuredClone(incident);
  assert.throws(() => applyReview(incident, review({ affectedPeople: true, needs: [] })), InputError);
  assert.deepEqual(incident, before);
});

test('summary replaces extracted needs even when an extracted list is nonempty', () => {
  const state = createSeed();
  state.incidents = [state.incidents[1]];
  state.incidents[0].extraction.needs = ['Obsolete extracted need'];
  applyReview(state.incidents[0], review({ needs: ['Corrected need'] }));
  assert.deepEqual(situationDraft(state).needs, ['Corrected need']);
});

test('an empty reviewed needs list suppresses nonempty extraction in summaries and after retry', () => {
  const state = createSeed();
  state.incidents = [state.incidents[1]];
  const incident = state.incidents[0];
  incident.extraction.needs = ['Extracted shelter need'];
  applyReview(incident, review({ affectedPeople: null, needs: [] }));
  incident.extraction = { ...incident.extraction, affectedPeople: 25, needs: ['Retried need'] };
  assert.deepEqual(displayFields(incident).needs, []);
  assert.equal(displayFields(incident).affectedPeople, null);
  assert.deepEqual(situationDraft(state).needs, []);
});
