import { validateIntake, buildIncident, applyReview, auditEntry, duplicateCandidates, createSeed, newId, now, LOCATIONS, MAP_CONFIG, STATUSES, PRIORITIES, CATEGORIES, boundedText, InputError, prioritySuggestion } from './domain.mjs';

function notFound(message = 'Record not found.') { const error = new Error(message); error.status = 404; throw error; }
const reply = (status, data) => ({status, data});

export async function scenarioRequest({method, path, read, store, ai, mapConfig = MAP_CONFIG}) {
  if (method === 'GET' && path === '/api/state') {
    const state = await store.snapshot();
    return reply(200,{...state,duplicates:duplicateCandidates(state.incidents,state.decisions),locations:LOCATIONS,mapConfig,statuses:STATUSES,priorities:PRIORITIES,categories:CATEGORIES,aiConfigured:ai.configured});
  }
  if (method === 'POST' && path === '/api/incidents') {
    const report = validateIntake(await read());
    const {extraction,ai:provenance} = await ai.extract(report);
    const incident = buildIncident(report,extraction,provenance);
    await store.mutate(state => { incident.number = Math.max(0,...state.incidents.map(i=>i.number)) + 1; state.incidents.push(incident); state.audit.push(auditEntry('Report submitted',report.source,`Saved report #${incident.number} using ${provenance.label}.`,incident.id)); });
    return reply(201,{incident});
  }
  const reviewMatch = /^\/api\/incidents\/([^/]+)\/review$/.exec(path);
  if (method === 'POST' && reviewMatch) {
    const body = await read();
    const incident = await store.mutate(state => {
      const incident = state.incidents.find(i=>i.id===reviewMatch[1]); if (!incident) notFound();
      const result = applyReview(incident,body);
      state.audit.push(auditEntry('Human review saved',result.actor,result.details,incident.id,{before:result.before,after:result.after})); return incident;
    });
    return reply(200,{incident});
  }
  const retryMatch = /^\/api\/incidents\/([^/]+)\/retry$/.exec(path);
  if (method === 'POST' && retryMatch) {
    const original = (await store.snapshot()).incidents.find(i=>i.id===retryMatch[1]); if (!original) notFound();
    const result = await ai.extract(original.report);
    const incident = await store.mutate(state=>{
      const incident = state.incidents.find(i=>i.id===original.id); if (!incident) notFound();
      incident.extraction=result.extraction; incident.ai=result.ai; incident.priority=prioritySuggestion(result.extraction); incident.updatedAt=now();
      state.audit.push(auditEntry('Extraction retried','Demo reviewer',`Updated suggestions with ${result.ai.label}; human edits were retained.`,incident.id)); return incident;
    });
    return reply(200,{incident});
  }
  if (method === 'POST' && path === '/api/duplicates/decision') {
    const body = await read();
    if (!['related','distinct'].includes(body.decision)) throw new InputError('Choose related or distinct.');
    const actor = boundedText(body.actor || 'Demo reviewer','Reviewer',1,80);
    await store.mutate(state=>{
      const pair=duplicateCandidates(state.incidents,state.decisions).find(p=>p.id===body.pairId); if (!pair) notFound('Duplicate pair not found.');
      state.decisions=state.decisions.filter(d=>d.pairId!==pair.id);
      state.decisions.push({pairId:pair.id,decision:body.decision,actor,at:now()});
      state.audit.push(auditEntry('Duplicate pair reviewed',actor,`Reports marked ${body.decision}. Both reports remain visible.`));
    }); return reply(200,{ok:true});
  }
  if (method === 'POST' && path === '/api/situation-reports') {
    const snapshot = await store.snapshot();
    const draft={...await ai.summarize(snapshot),id:newId('sitrep')};
    await store.mutate(state=>{state.situationReports.push(draft);state.audit.push(auditEntry('Situation draft generated','Demo reviewer',`Draft summarizes ${draft.count} reports as of ${draft.generatedAt}.`));});
    return reply(201,{draft});
  }
  if (method === 'POST' && path === '/api/reset') {
    const body=await read(); if (body.confirm !== 'RESET') throw new InputError('Reset confirmation is required.');
    await store.mutate(state=>{const seed=createSeed();for (const key of Object.keys(state)) delete state[key];Object.assign(state,seed);state.audit.push(auditEntry('Scenario reset','Demo reviewer','Restored 10 synthetic reports. Previous exercise data was cleared.'));});
    return reply(200,{ok:true});
  }
  notFound('API endpoint not found.');
}
