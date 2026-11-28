import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { Store } from './lib/store.mjs';
import { Ai } from './lib/ai.mjs';
import { validateIntake, buildIncident, applyReview, auditEntry, duplicateCandidates, createSeed, newId, now, LOCATIONS, MAP_CONFIG, STATUSES, PRIORITIES, CATEGORIES, boundedText, InputError, prioritySuggestion, validateReviewAffectedPeople, validateReviewNeeds } from './lib/domain.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
async function readBody(request) {
  let size = 0; const chunks = [];
  for await (const chunk of request) { size += chunk.length; if (size > 1_500_000) throw new InputError('Request is too large.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new InputError('Send valid JSON.'); }
}
function send(response, status, value) { response.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); response.end(JSON.stringify(value)); }
function notFound(message = 'Record not found.') { const error = new Error(message); error.status = 404; throw error; }
function tokenMatches(provided, expected) { const a=Buffer.from(provided), b=Buffer.from(expected); return a.length === b.length && timingSafeEqual(a,b); }
export async function createApp({dataDir = resolve(ROOT,process.env.DATA_DIR || 'data'), ai = new Ai({key:process.env.AI_API_KEY,model:process.env.AI_MODEL,base:process.env.AI_BASE_URL}), accessToken = process.env.DEMO_ACCESS_TOKEN || ''} = {}) {
  const store = new Store(dataDir); await store.init();
  const mapConfig = {...MAP_CONFIG,tileUrl:process.env.MAP_TILE_URL || MAP_CONFIG.tileUrl};
  const tileOrigin = new URL(mapConfig.tileUrl.replace(/\{[xyzs]\}/g,'0')).origin;
  const server = createServer(async (request,response) => {
    response.setHeader('X-Content-Type-Options','nosniff');
    response.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    response.setHeader('X-Frame-Options','DENY');
    response.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: ${tileOrigin}; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`);
    try {
      const url = new URL(request.url,'http://localhost'); const path = url.pathname;
      if (path === '/api/health' && request.method === 'GET') return send(response,200,{ok:true});
      if (path.startsWith('/api/')) {
        if (accessToken && !tokenMatches((request.headers.authorization || '').replace(/^Bearer /,''),accessToken)) return send(response,401,{error:'Enter the demo access token to continue.'});
        if (!['GET','HEAD'].includes(request.method)) {
          if (!String(request.headers['content-type'] || '').startsWith('application/json')) throw new InputError('Content-Type must be application/json.');
          const origin = request.headers.origin;
          if (origin && new URL(origin).host !== request.headers.host) return send(response,403,{error:'Cross-origin requests are not accepted.'});
        }
        if (request.method === 'GET' && path === '/api/state') {
          const state = store.snapshot();
          return send(response,200,{...state,duplicates:duplicateCandidates(state.incidents,state.decisions),locations:LOCATIONS,mapConfig,statuses:STATUSES,priorities:PRIORITIES,categories:CATEGORIES,aiConfigured:ai.configured});
        }
        if (request.method === 'POST' && path === '/api/incidents') {
          const report = validateIntake(await readBody(request));
          const {extraction,ai:provenance} = await ai.extract(report);
          const incident = buildIncident(report,extraction,provenance);
          await store.mutate(state => { incident.number = Math.max(0,...state.incidents.map(i=>i.number)) + 1; state.incidents.push(incident); state.audit.push(auditEntry('Report submitted',report.source,`Saved report #${incident.number} using ${provenance.label}.`,incident.id)); });
          return send(response,201,{incident});
        }
        const reviewMatch = /^\/api\/incidents\/([^/]+)\/review$/.exec(path);
        if (request.method === 'POST' && reviewMatch) {
          const body = await readBody(request);
          const incident = await store.mutate(state => {
            const incident = state.incidents.find(i=>i.id===reviewMatch[1]); if (!incident) notFound();
            const result = applyReview(incident,body);
            state.audit.push(auditEntry('Human review saved',result.actor,result.details,incident.id,{before:result.before,after:result.after})); return incident;
          });
          return send(response,200,{incident});
        }
        const retryMatch = /^\/api\/incidents\/([^/]+)\/retry$/.exec(path);
        if (request.method === 'POST' && retryMatch) {
          const original = store.snapshot().incidents.find(i=>i.id===retryMatch[1]); if (!original) notFound();
          const result = await ai.extract(original.report);
          const incident = await store.mutate(state=>{
            const incident = state.incidents.find(i=>i.id===original.id); if (!incident) notFound();
            incident.extraction=result.extraction; incident.ai=result.ai; incident.priority=prioritySuggestion(result.extraction); incident.updatedAt=now();
            state.audit.push(auditEntry('Extraction retried','Demo reviewer',`Updated suggestions with ${result.ai.label}; human edits were retained.`,incident.id)); return incident;
          });
          return send(response,200,{incident});
        }
        if (request.method === 'POST' && path === '/api/duplicates/decision') {
          const body = await readBody(request);
          if (!['related','distinct'].includes(body.decision)) throw new InputError('Choose related or distinct.');
          const actor = boundedText(body.actor || 'Demo reviewer','Reviewer',1,80);
          await store.mutate(state=>{
            const pair=duplicateCandidates(state.incidents,state.decisions).find(p=>p.id===body.pairId); if (!pair) notFound('Duplicate pair not found.');
            state.decisions=state.decisions.filter(d=>d.pairId!==pair.id);
            state.decisions.push({pairId:pair.id,decision:body.decision,actor,at:now()});
            state.audit.push(auditEntry('Duplicate pair reviewed',actor,`Reports marked ${body.decision}. Both reports remain visible.`));
          }); return send(response,200,{ok:true});
        }
        if (request.method === 'POST' && path === '/api/situation-reports') {
          const snapshot = store.snapshot();
          const draft={...await ai.summarize(snapshot),id:newId('sitrep')};
          await store.mutate(state=>{state.situationReports.push(draft);state.audit.push(auditEntry('Situation draft generated','Demo reviewer',`Draft summarizes ${draft.count} reports as of ${draft.generatedAt}.`));});
          return send(response,201,{draft});
        }
        if (request.method === 'POST' && path === '/api/reset') {
          const body=await readBody(request); if (body.confirm !== 'RESET') throw new InputError('Reset confirmation is required.');
          await store.mutate(state=>{const seed=createSeed();for (const key of Object.keys(state)) delete state[key];Object.assign(state,seed);state.audit.push(auditEntry('Scenario reset','Demo reviewer','Restored 10 synthetic reports. Previous exercise data was cleared.'));});
          return send(response,200,{ok:true});
        }
        notFound('API endpoint not found.');
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return send(response,405,{error:'Method not allowed.'});
      const files = {'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css','/favicon.svg':'favicon.svg','/demo-scene.svg':'demo-scene.svg'};
      for (const vendorFile of ['leaflet.js','leaflet.css','images/marker-icon.png','images/marker-icon-2x.png','images/marker-shadow.png','images/layers.png','images/layers-2x.png']) files[`/vendor/leaflet/${vendorFile}`]=`vendor/leaflet/${vendorFile}`;
      if (!files[path]) notFound('Page not found.');
      const data=await readFile(resolve(ROOT,'public',files[path]));
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
      response.writeHead(200,{'Content-Type':types[extname(files[path])],'Cache-Control':'no-cache'});response.end(request.method==='HEAD' ? undefined : data);
    } catch (error) { if (!response.headersSent) send(response,error.status || 500,{error:error.status ? error.message : 'Something went wrong. Retry or reload the exercise.'}); else response.end(); }
  });
  return {server,store};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const {server}=await createApp();
  const port=Number(process.env.PORT || 4173), host=process.env.HOST || '127.0.0.1';
  server.listen(port,host,()=>console.log(`Afterlight is running at http://${host}:${port}`));
}
