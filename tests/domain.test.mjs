import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIntake, validateExtraction, demoExtraction, prioritySuggestion, createSeed, applyReview, displayFields, duplicateCandidates, situationDraft, STATUSES, PRIORITIES, LOCATIONS, MAP_CONFIG } from '../lib/domain.mjs';

test('intake rejects invented locations, oversized inputs, and disguised images', () => {
  assert.throws(()=>validateIntake({text:'Too short'}));
  assert.throws(()=>validateIntake({text:'x'.repeat(5001)}));
  assert.throws(()=>validateIntake({text:'A fictional exercise report.',locationId:'real-world-place'}));
  assert.throws(()=>validateIntake({text:'A fictional exercise report.',image:'data:image/png;base64,PHNjcmlwdD4='}));
  assert.equal(validateIntake({text:'A fictional exercise report.'}).locationId,null);
});
test('extraction leaves absent and uncertain people counts unknown', () => {
  for (const text of ['Water depth and affected households are unknown.','There may be twelve residents.','12 residents, but this count is unconfirmed.']) {
    assert.equal(demoExtraction({text,locationId:null}).affectedPeople,null);
  }
  const extracted=demoExtraction({text:'12 residents report flooding at Eastbank homes.',locationId:'eastbank'});
  assert.equal(extracted.affectedPeople,12);
  assert.ok(extracted.uncertainty.length);
  assert.ok(!('latitude' in extracted));
});
test('model schema rejects invalid values instead of silently accepting them', () => {
  const valid=demoExtraction({text:'A fictional report of flooding.',locationId:null});
  for (const changes of [{confidence:NaN},{confidence:1.1},{affectedPeople:-1},{affectedPeople:2.5},{needs:'medicine'},{category:'Evacuate now'},{summary:''},{uncertainty:[{}]}]) assert.throws(()=>validateExtraction({...valid,...changes}));
});
test('priority rubric is explainable and avoids simple negated claims', () => {
  const base={summary:'Flooding leaves residents isolated with medical needs.',needs:[],affectedPeople:12};
  const high=prioritySuggestion(base);
  assert.equal(high.band,'Critical');assert.equal(high.score,9);assert.equal(high.factors.length,4);
  assert.equal(prioritySuggestion({...base,summary:'No injuries. Residents are not isolated.',affectedPeople:null}).band,'Low');
  assert.equal(prioritySuggestion({...base,summary:'Blankets available. No power issues.',affectedPeople:null}).band,'Low');
  assert.equal(prioritySuggestion({...base,summary:'Water reported nearby.',affectedPeople:null}).band,'Moderate');
});
test('reviews preserve raw source and record the actual previous human edit', () => {
  const incident=createSeed().incidents[0], source=incident.report.text, original=incident.extraction.title;
  const body={title:'Reviewed title one',summary:'First reviewed summary.',category:'Flooding',status:'Reviewed',priority:'Moderate',locationId:'northgate',actor:'Reviewer',note:'Count remains unknown.'};
  applyReview(incident,body);assert.equal(incident.report.text,source);assert.equal(incident.extraction.title,original);
  const result=applyReview(incident,{...body,title:'Reviewed title two',locationId:null});
  assert.equal(result.before.title,'Reviewed title one');assert.equal(displayFields(incident).locationId,null);
  assert.equal(incident.review.title,'Reviewed title two');assert.equal(incident.reviewerPriority,'Moderate');
});
test('all status and priority combinations are validated and never modify the source', () => {
  for (const status of STATUSES) for (const priority of PRIORITIES) {
    const incident=createSeed().incidents[0],original=incident.report.text;
    applyReview(incident,{title:'Human edited title',summary:'Human edited summary.',category:'Flooding',status,priority,locationId:null});
    assert.equal(incident.status,status);assert.equal(incident.reviewerPriority,priority);assert.equal(incident.report.text,original);
  }
});
test('duplicate decisions keep both source records and unknown locations do not match', () => {
  const state=createSeed();const pairs=duplicateCandidates(state.incidents);
  assert.ok(pairs.length>=2);const count=state.incidents.length;
  const decisions=[{pairId:pairs[0].id,decision:'related'}];
  assert.equal(duplicateCandidates(state.incidents,decisions).find(p=>p.id===pairs[0].id).decision,'related');
  assert.equal(state.incidents.length,count);
  const unknown=[state.incidents[0],state.incidents[4]].map(i=>({...i,report:{...i.report,locationId:null}}));
  assert.equal(duplicateCandidates(unknown).length,0);
});
test('situation summaries handle an empty scenario and label coverage', () => {
  const draft=situationDraft({incidents:[],decisions:[]});assert.equal(draft.count,0);assert.equal(draft.unreviewed,0);assert.ok(draft.text.includes('0 reports'));assert.ok(draft.coverage.includes('not verified'));
});
test('real basemap coordinates are explicit scenario data, not model-inferred locations',()=>{
  assert.equal(MAP_CONFIG.region,'Seattle waterfront');
  for(const l of LOCATIONS){assert.ok(Number.isFinite(l.lat)&&l.lat>=-90&&l.lat<=90);assert.ok(Number.isFinite(l.lng)&&l.lng>=-180&&l.lng<=180);}
  const report=validateIntake({text:'SIMULATION: A report at an unspecified location.'});assert.equal(report.locationId,null);
  assert.equal(demoExtraction(report).latitude,undefined);
});
