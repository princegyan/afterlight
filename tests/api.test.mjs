import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createApp } from '../server.mjs';
import { Ai } from '../lib/ai.mjs';
import { demoExtraction } from '../lib/domain.mjs';

async function start(options={}) {const dir=await mkdtemp(join(tmpdir(),'afterlight-test-'));const app=await createApp({dataDir:dir,ai:new Ai(),...options});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.server.address().port}`;return {...app,dir,base,async close(){await new Promise(resolve=>app.server.close(resolve));await rm(join(dir,'scenario.json'),{force:true});await rm(join(dir,'scenario.json.tmp'),{force:true});await rmdir(dir);}};}
async function call(base,path,body,extra={}) {const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json()};}
test('complete API flow persists review, duplicate decisions, summaries, and reset', async()=>{
  const app=await start();try {
    let state=(await call(app.base,'/api/state')).data;assert.equal(state.incidents.length,10);
    const created=await call(app.base,'/api/incidents',{text:'SIMULATION: Water is reported at Northgate community hall. People count is unknown.',locationId:'northgate'});
    assert.equal(created.status,201);const id=created.data.incident.id;assert.equal(created.data.incident.extraction.affectedPeople,null);
    const reviewed=await call(app.base,`/api/incidents/${id}/review`,{title:'Water reported at Northgate',summary:'Depth and people count remain unknown.',category:'Flooding',locationId:'northgate',status:'Reviewed',priority:'Moderate',actor:'Test reviewer',note:'Preserved uncertainty.'});
    assert.equal(reviewed.status,200);assert.equal(reviewed.data.incident.review.actor,'Test reviewer');
    await call(app.base,`/api/incidents/${id}/retry`,{});
    state=(await call(app.base,'/api/state')).data;assert.equal(state.incidents.find(i=>i.id===id).review.title,'Water reported at Northgate');assert.ok(state.audit.some(a=>a.action==='Human review saved'));
    const pair=state.duplicates[0];assert.ok(pair);
    assert.equal((await call(app.base,'/api/duplicates/decision',{pairId:pair.id,decision:'related'})).status,200);
    const summary=await call(app.base,'/api/situation-reports',{});assert.equal(summary.status,201);assert.equal(summary.data.draft.count,11);
    const reopened=await createApp({dataDir:app.dir,ai:new Ai()});assert.equal(reopened.store.snapshot().incidents.length,11);assert.equal(reopened.store.snapshot().situationReports.length,1);
    assert.equal((await call(app.base,'/api/reset',{})).status,400);
    await call(app.base,'/api/reset',{confirm:'RESET'});state=(await call(app.base,'/api/state')).data;assert.equal(state.incidents.length,10);assert.equal(state.situationReports.length,0);
  } finally {await app.close();}
});
test('concurrent writes retain every report and unique report numbers', async()=>{
  const app=await start();try {
    const responses=await Promise.all(Array.from({length:8},(_,i)=>call(app.base,'/api/incidents',{text:`SIMULATION: Fictional report number ${i}, with details still unknown.`})));
    assert.ok(responses.every(r=>r.status===201));const state=(await call(app.base,'/api/state')).data;assert.equal(state.incidents.length,18);assert.equal(new Set(state.incidents.map(i=>i.number)).size,18);
  }finally{await app.close();}
});
test('public demo token protects read and write APIs; cross-origin writes are rejected',async()=>{
  const app=await start({accessToken:'test-token'});try {
    assert.equal((await call(app.base,'/api/state')).status,401);
    assert.equal((await call(app.base,'/api/state',undefined,{Authorization:'Bearer test-token'})).status,200);
    assert.equal((await call(app.base,'/api/reset',{confirm:'RESET'},{Authorization:'Bearer test-token',Origin:'https://other.example'})).status,403);
    assert.equal((await fetch(app.base+'/.env')).status,404);assert.equal((await fetch(app.base+'/lib/ai.mjs')).status,404);
    const vendor=await fetch(app.base+'/vendor/leaflet/leaflet.js');assert.equal(vendor.status,200);assert.ok(vendor.headers.get('content-type').includes('javascript'));assert.ok(vendor.headers.get('content-security-policy').includes('https://tile.openstreetmap.org'));assert.equal(vendor.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
    assert.equal((await call(app.base,'/api/incidents',{text:'short'},{Authorization:'Bearer test-token'})).status,400);
  }finally{await app.close();}
});
test('invalid and unavailable model responses fall back; valid model extraction is labeled',async()=>{
  let mode='invalid';const report={text:'SIMULATION: Water is reported, with people count unknown.',locationId:null};
  const modelServer=createServer((req,res)=>{req.resume();res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:mode==='valid'?JSON.stringify(demoExtraction(report)):'{"confidence":2}'}}]}));});
  await new Promise(resolve=>modelServer.listen(0,'127.0.0.1',resolve));
  const ai=new Ai({key:'test-only',base:`http://127.0.0.1:${modelServer.address().port}/v1`,model:'test-model'});
  try {const bad=await ai.extract(report);assert.equal(bad.ai.mode,'fallback');assert.equal(bad.extraction.affectedPeople,null);mode='valid';assert.equal((await ai.extract(report)).ai.mode,'model');}
  finally{await new Promise(resolve=>modelServer.close(resolve));}
  assert.equal((await ai.extract(report)).ai.mode,'fallback');
});
