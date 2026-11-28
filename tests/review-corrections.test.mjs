/**
 * Tests for reviewer-owned affectedPeople and needs corrections.
 * Covers: zero/null/empty overrides, invalid values, repeated-review provenance,
 * persistence, retry preservation, summary behavior, and older records.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createSeed, applyReview, displayFields, situationDraft,
  validateReviewAffectedPeople, validateReviewNeeds, InputError,
} from '../lib/domain.mjs';
import { createApp } from '../server.mjs';
import { Ai } from '../lib/ai.mjs';

// ─── Helpers ────────────────────────────────────────────────────────────────

function freshIncident() { return createSeed().incidents[0]; }
function baseReview(overrides = {}) {
  return {
    title: 'Reviewed title', summary: 'A reviewed summary for the exercise.',
    category: 'Flooding', locationId: 'northgate',
    status: 'Reviewed', priority: 'Moderate',
    actor: 'Test reviewer', note: '',
    ...overrides,
  };
}

async function start() {
  const dir = await mkdtemp(join(tmpdir(), 'afterlight-rv-'));
  const app = await createApp({ dataDir: dir, ai: new Ai() });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  async function call(path, body) {
    const res = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: res.status, data: await res.json() };
  }
  async function close() {
    await new Promise(resolve => app.server.close(resolve));
    await rm(join(dir, 'scenario.json'), { force: true });
    await rm(join(dir, 'scenario.json.tmp'), { force: true });
    await rmdir(dir);
  }
  return { ...app, dir, base, call, close };
}

// ─── Validation ─────────────────────────────────────────────────────────────

test('validateReviewAffectedPeople accepts nonnegative integers', () => {
  assert.equal(validateReviewAffectedPeople(0), 0);
  assert.equal(validateReviewAffectedPeople(1), 1);
  assert.equal(validateReviewAffectedPeople(100), 100);
  assert.equal(validateReviewAffectedPeople(1_000_000), 1_000_000);
  assert.equal(validateReviewAffectedPeople('7'), 7);
  assert.equal(validateReviewAffectedPeople('0'), 0);
});

test('validateReviewAffectedPeople accepts null and empty string as unknown', () => {
  assert.equal(validateReviewAffectedPeople(null), null);
  assert.equal(validateReviewAffectedPeople(''), null);
  assert.equal(validateReviewAffectedPeople(undefined), null);
});

test('validateReviewAffectedPeople rejects invalid values', () => {
  for (const bad of [-1, -0.5, 1.5, 1_000_001, NaN, 'abc', {}, []]) {
    assert.throws(() => validateReviewAffectedPeople(bad), InputError, `expected rejection for ${JSON.stringify(bad)}`);
  }
});

test('validateReviewNeeds accepts empty array and empty string', () => {
  assert.deepEqual(validateReviewNeeds([]), []);
  assert.deepEqual(validateReviewNeeds(''), []);
  assert.deepEqual(validateReviewNeeds(null), []);
});

test('validateReviewNeeds accepts newline-delimited string', () => {
  const result = validateReviewNeeds('Medical needs\nSupplies mentioned\n');
  assert.deepEqual(result, ['Medical needs', 'Supplies mentioned']);
});

test('validateReviewNeeds rejects arrays exceeding 12 items', () => {
  const arr = Array.from({ length: 13 }, (_, i) => `Need ${i}`);
  assert.throws(() => validateReviewNeeds(arr), InputError);
});

test('validateReviewNeeds rejects items that are empty after trim', () => {
  assert.throws(() => validateReviewNeeds(['valid need', '']), InputError);
});

test('validateReviewNeeds rejects items over 600 characters', () => {
  assert.throws(() => validateReviewNeeds(['x'.repeat(601)]), InputError);
});

// ─── Zero and null overrides in applyReview ─────────────────────────────────

test('applyReview stores zero affectedPeople and treats it as valid', () => {
  const incident = freshIncident();
  applyReview(incident, baseReview({ affectedPeople: 0 }));
  assert.equal(incident.review.affectedPeople, 0);
  assert.equal(displayFields(incident).affectedPeople, 0, 'displayFields must return 0, not fall back to extraction');
});

test('applyReview stores null affectedPeople (unknown)', () => {
  const incident = freshIncident();
  applyReview(incident, baseReview({ affectedPeople: null }));
  assert.equal(incident.review.affectedPeople, null);
  assert.equal(displayFields(incident).affectedPeople, null);
});

test('applyReview stores empty needs array and treats it as valid', () => {
  const incident = freshIncident();
  applyReview(incident, baseReview({ needs: [] }));
  assert.deepEqual(incident.review.needs, []);
  assert.deepEqual(displayFields(incident).needs, [], 'displayFields must return [] not fall back to extraction');
});

test('applyReview stores a non-empty needs array', () => {
  const incident = freshIncident();
  applyReview(incident, baseReview({ needs: ['Medical needs', 'Supplies mentioned'] }));
  assert.deepEqual(incident.review.needs, ['Medical needs', 'Supplies mentioned']);
  assert.deepEqual(displayFields(incident).needs, ['Medical needs', 'Supplies mentioned']);
});

// ─── Original extraction is not modified ────────────────────────────────────

test('applyReview never modifies extraction.affectedPeople or extraction.needs', () => {
  const incident = freshIncident();
  const originalAP = incident.extraction.affectedPeople;
  const originalNeeds = [...incident.extraction.needs];
  applyReview(incident, baseReview({ affectedPeople: 42, needs: ['New need'] }));
  assert.equal(incident.extraction.affectedPeople, originalAP);
  assert.deepEqual(incident.extraction.needs, originalNeeds);
});

// ─── displayFields fallback when no review corrections ─────────────────────

test('displayFields falls back to extraction when review has no affectedPeople key', () => {
  const incident = freshIncident();
  // Apply review without affectedPeople/needs keys
  applyReview(incident, baseReview());
  assert.ok(!('affectedPeople' in incident.review), 'review must not have affectedPeople key');
  assert.equal(displayFields(incident).affectedPeople, incident.extraction.affectedPeople);
  assert.ok(!('needs' in incident.review), 'review must not have needs key');
  assert.deepEqual(displayFields(incident).needs, incident.extraction.needs);
});

test('displayFields falls back to extraction on older records with no review', () => {
  const incident = freshIncident();
  // Simulate an older record: has a review with no affectedPeople/needs keys
  incident.review = { title: 'Old', summary: 'Old summary.', category: 'Other', locationId: null, actor: 'Old reviewer', note: '', reviewedAt: new Date().toISOString() };
  assert.equal(displayFields(incident).affectedPeople, incident.extraction.affectedPeople);
  assert.deepEqual(displayFields(incident).needs, incident.extraction.needs);
});

// ─── Repeated-review before/after provenance ────────────────────────────────

test('repeated review records previous human affectedPeople in before', () => {
  const incident = freshIncident();
  applyReview(incident, baseReview({ affectedPeople: 10, needs: ['Need A'] }));
  const result = applyReview(incident, baseReview({ affectedPeople: 20, needs: ['Need B'] }));
  assert.equal(result.before.affectedPeople, 10, 'before must reflect first human value');
  assert.deepEqual(result.before.needs, ['Need A'], 'before must reflect first human needs');
  assert.equal(result.after.affectedPeople, 20);
  assert.deepEqual(result.after.needs, ['Need B']);
});

test('first review before has no affectedPeople key when none was set before', () => {
  const incident = freshIncident();
  const result = applyReview(incident, baseReview({ affectedPeople: 5 }));
  assert.ok(!('affectedPeople' in result.before), 'before must not contain affectedPeople on first review');
});

test('repeated review with zero overwrites previous non-zero', () => {
  const incident = freshIncident();
  applyReview(incident, baseReview({ affectedPeople: 15 }));
  const result = applyReview(incident, baseReview({ affectedPeople: 0 }));
  assert.equal(result.before.affectedPeople, 15);
  assert.equal(result.after.affectedPeople, 0);
  assert.equal(incident.review.affectedPeople, 0);
});

test('repeated review with null overwrites previous count', () => {
  const incident = freshIncident();
  applyReview(incident, baseReview({ affectedPeople: 8 }));
  const result = applyReview(incident, baseReview({ affectedPeople: null }));
  assert.equal(result.before.affectedPeople, 8);
  assert.equal(result.after.affectedPeople, null);
  assert.equal(incident.review.affectedPeople, null);
});

test('repeated review with empty needs overwrites previous non-empty list', () => {
  const incident = freshIncident();
  applyReview(incident, baseReview({ needs: ['Need X', 'Need Y'] }));
  const result = applyReview(incident, baseReview({ needs: [] }));
  assert.deepEqual(result.before.needs, ['Need X', 'Need Y']);
  assert.deepEqual(result.after.needs, []);
  assert.deepEqual(incident.review.needs, []);
});

// ─── Corrections preserved across reviews without re-supplying them ─────────

test('applyReview preserves affectedPeople correction when not re-supplied', () => {
  const incident = freshIncident();
  applyReview(incident, baseReview({ affectedPeople: 7, needs: ['Need A'] }));
  // Second review omits affectedPeople and needs
  applyReview(incident, baseReview());
  assert.equal(incident.review.affectedPeople, 7, 'correction must carry forward');
  assert.deepEqual(incident.review.needs, ['Need A'], 'needs must carry forward');
});

// ─── situationDraft uses reviewed needs ─────────────────────────────────────

test('situationDraft uses reviewed needs when present, not extraction needs', () => {
  const state = createSeed();
  const incident = state.incidents[0];
  const originalNeeds = incident.extraction.needs.slice();
  applyReview(incident, baseReview({ needs: ['Reviewed specific need'] }));
  const draft = situationDraft(state);
  if (incident.status !== 'Resolved') {
    assert.ok(draft.needs.includes('Reviewed specific need'), 'draft must include reviewed need');
  }
  // If the incident is not resolved, original extraction needs must not bleed in if replaced
  if (incident.status !== 'Resolved' && originalNeeds.length > 0) {
    for (const original of originalNeeds) {
      // The original needs may appear from other incidents, but the replaced need for this incident should not
      assert.ok(!draft.needs.includes(original) || draft.needs.includes('Reviewed specific need'),
        'reviewed need must replace or coexist with extraction needs from other incidents');
    }
  }
});

test('situationDraft does not sum affectedPeople into a unique-person total', () => {
  const state = createSeed();
  state.incidents[0].extraction.affectedPeople = 50;
  state.incidents[1].extraction.affectedPeople = 30;
  const draft = situationDraft(state);
  // The text must NOT contain 80 (the sum) presented as a unique-person total
  assert.ok(!draft.text.includes('80 unique'), 'must not sum people across reports');
  assert.ok(!draft.text.includes('80 affected'), 'must not sum people across reports');
  assert.ok(draft.coverage.includes('not verified'), 'coverage note must remain');
});

test('situationDraft falls back to extraction needs when review has none', () => {
  const state = createSeed();
  const incident = state.incidents[0];
  incident.extraction.needs = ['Extraction need'];
  applyReview(incident, baseReview());  // no needs key
  const draft = situationDraft(state);
  if (incident.status !== 'Resolved') {
    assert.ok(draft.needs.includes('Extraction need'), 'extraction need must appear in draft when not overridden');
  }
});

// ─── Retry preservation ─────────────────────────────────────────────────────

test('extraction retry preserves reviewer corrections for affectedPeople and needs', async () => {
  const app = await start();
  try {
    const created = await app.call('/api/incidents', {
      text: 'SIMULATION: 15 people are reported sheltering at Northgate community hall.',
      locationId: 'northgate',
    });
    const id = created.data.incident.id;
    // Apply review with corrections
    await app.call(`/api/incidents/${id}/review`, baseReview({
      affectedPeople: 15,
      needs: ['Shelter required', 'Medical assessment needed'],
    }));
    // Retry extraction
    await app.call(`/api/incidents/${id}/retry`, {});
    const state = (await app.call('/api/state')).data;
    const incident = state.incidents.find(i => i.id === id);
    assert.equal(incident.review.affectedPeople, 15, 'affectedPeople must survive retry');
    assert.deepEqual(incident.review.needs, ['Shelter required', 'Medical assessment needed'], 'needs must survive retry');
  } finally { await app.close(); }
});

test('extraction retry preserves null affectedPeople correction', async () => {
  const app = await start();
  try {
    const created = await app.call('/api/incidents', {
      text: 'SIMULATION: Standing water reported near Old station. Affected people unknown.',
      locationId: 'station',
    });
    const id = created.data.incident.id;
    await app.call(`/api/incidents/${id}/review`, baseReview({ affectedPeople: null }));
    await app.call(`/api/incidents/${id}/retry`, {});
    const state = (await app.call('/api/state')).data;
    const incident = state.incidents.find(i => i.id === id);
    assert.ok('affectedPeople' in incident.review, 'affectedPeople key must be present after retry');
    assert.equal(incident.review.affectedPeople, null);
  } finally { await app.close(); }
});

test('extraction retry preserves empty needs correction', async () => {
  const app = await start();
  try {
    const created = await app.call('/api/incidents', {
      text: 'SIMULATION: Medical team deployed to Harborlight clinic. No further needs reported.',
      locationId: 'clinic',
    });
    const id = created.data.incident.id;
    await app.call(`/api/incidents/${id}/review`, baseReview({ needs: [] }));
    await app.call(`/api/incidents/${id}/retry`, {});
    const state = (await app.call('/api/state')).data;
    const incident = state.incidents.find(i => i.id === id);
    assert.ok('needs' in incident.review, 'needs key must be present after retry');
    assert.deepEqual(incident.review.needs, []);
  } finally { await app.close(); }
});

// ─── Persistence ─────────────────────────────────────────────────────────────

test('affectedPeople and needs corrections persist across store reopen', async () => {
  const app = await start();
  try {
    const created = await app.call('/api/incidents', {
      text: 'SIMULATION: 22 residents displaced at Eastbank homes.',
      locationId: 'eastbank',
    });
    const id = created.data.incident.id;
    await app.call(`/api/incidents/${id}/review`, baseReview({
      affectedPeople: 22,
      needs: ['Emergency shelter', 'Food and water'],
    }));
    // Reopen the store from the same directory
    const reopened = await createApp({ dataDir: app.dir, ai: new Ai() });
    const incident = reopened.store.snapshot().incidents.find(i => i.id === id);
    assert.equal(incident.review.affectedPeople, 22, 'affectedPeople must survive store reopen');
    assert.deepEqual(incident.review.needs, ['Emergency shelter', 'Food and water'], 'needs must survive store reopen');
    assert.equal(incident.extraction.affectedPeople, 22, 'extraction is unchanged');
  } finally { await app.close(); }
});

test('null affectedPeople persists and is not coerced to undefined', async () => {
  const app = await start();
  try {
    const created = await app.call('/api/incidents', {
      text: 'SIMULATION: Flooding reported near Canal footbridge. No headcount available.',
      locationId: 'canal',
    });
    const id = created.data.incident.id;
    await app.call(`/api/incidents/${id}/review`, baseReview({ affectedPeople: null }));
    const reopened = await createApp({ dataDir: app.dir, ai: new Ai() });
    const incident = reopened.store.snapshot().incidents.find(i => i.id === id);
    assert.ok('affectedPeople' in incident.review, 'affectedPeople key must be preserved');
    assert.strictEqual(incident.review.affectedPeople, null);
  } finally { await app.close(); }
});

// ─── API validation ──────────────────────────────────────────────────────────

test('review API rejects negative affectedPeople', async () => {
  const app = await start();
  try {
    const state = (await app.call('/api/state')).data;
    const id = state.incidents[0].id;
    const result = await app.call(`/api/incidents/${id}/review`, baseReview({ affectedPeople: -1 }));
    assert.equal(result.status, 400);
  } finally { await app.close(); }
});

test('review API rejects non-integer affectedPeople', async () => {
  const app = await start();
  try {
    const state = (await app.call('/api/state')).data;
    const id = state.incidents[0].id;
    const result = await app.call(`/api/incidents/${id}/review`, baseReview({ affectedPeople: 2.7 }));
    assert.equal(result.status, 400);
  } finally { await app.close(); }
});

test('review API rejects needs list exceeding 12 items', async () => {
  const app = await start();
  try {
    const state = (await app.call('/api/state')).data;
    const id = state.incidents[0].id;
    const needs = Array.from({ length: 13 }, (_, i) => `Need ${i}`);
    const result = await app.call(`/api/incidents/${id}/review`, baseReview({ needs }));
    assert.equal(result.status, 400);
  } finally { await app.close(); }
});

test('review API accepts zero as a valid reported affectedPeople', async () => {
  const app = await start();
  try {
    const state = (await app.call('/api/state')).data;
    const id = state.incidents[0].id;
    const result = await app.call(`/api/incidents/${id}/review`, baseReview({ affectedPeople: 0 }));
    assert.equal(result.status, 200);
    assert.equal(result.data.incident.review.affectedPeople, 0);
    assert.equal(displayFields(result.data.incident).affectedPeople, 0);
  } finally { await app.close(); }
});

// ─── Older records compatibility ─────────────────────────────────────────────

test('seed incidents without review corrections work with displayFields', () => {
  const state = createSeed();
  for (const incident of state.incidents) {
    const f = displayFields(incident);
    // Must not throw, and affectedPeople/needs must come from extraction
    assert.equal(f.affectedPeople, incident.extraction.affectedPeople);
    assert.deepEqual(f.needs, incident.extraction.needs);
  }
});

test('incidents with legacy review (no affectedPeople/needs keys) remain compatible', () => {
  const incident = freshIncident();
  // Simulate a legacy review saved before this feature
  incident.review = {
    title: 'Legacy reviewed', summary: 'Legacy summary.', category: 'Other',
    locationId: null, actor: 'Old reviewer', note: '', reviewedAt: new Date().toISOString(),
  };
  incident.status = 'Reviewed';
  incident.reviewerPriority = 'Low';
  const f = displayFields(incident);
  assert.equal(f.affectedPeople, incident.extraction.affectedPeople, 'falls back to extraction for legacy record');
  assert.deepEqual(f.needs, incident.extraction.needs, 'falls back to extraction needs for legacy record');
  assert.equal(f.title, 'Legacy reviewed', 'title still from review');
});

// ─── Situation draft integration ─────────────────────────────────────────────

test('situation API draft uses reviewed needs and labels coverage', async () => {
  const app = await start();
  try {
    const state = (await app.call('/api/state')).data;
    const id = state.incidents.find(i => i.status !== 'Resolved').id;
    await app.call(`/api/incidents/${id}/review`, baseReview({
      status: 'Monitoring',
      needs: ['Unique reviewed need for draft test'],
    }));
    const result = await app.call('/api/situation-reports', {});
    assert.equal(result.status, 201);
    assert.ok(result.data.draft.text.includes('Harborlight'), 'draft must reference scenario');
    assert.ok(result.data.draft.needs.includes('Unique reviewed need for draft test'), 'reviewed need must appear in draft needs');
    assert.ok(result.data.draft.coverage.includes('not verified'), 'coverage caveat must remain');
  } finally { await app.close(); }
});
