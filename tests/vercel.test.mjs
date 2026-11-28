import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { RedisStore } from '../lib/redis-store.mjs';
import { createApp } from '../server.mjs';
import { Ai } from '../lib/ai.mjs';

async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return 'http://127.0.0.1:' + server.address().port;
}
const close = server => new Promise(resolve => server.close(resolve));

test('the Vercel function starts without a writable disk or external service', async t => {
  for (const name of ['KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','DEMO_ACCESS_TOKEN']) {
    const original = process.env[name];
    delete process.env[name];
    t.after(() => { if (original !== undefined) process.env[name] = original; });
  }
  const {default:handler} = await import('../api/index.mjs');
  const server = createServer(handler);
  const url = await listen(server);
  t.after(() => close(server));
  assert.deepEqual(await (await fetch(url + '/api/index?endpoint=health')).json(), {ok:true});
  const state = await (await fetch(url + '/api/state')).json();
  assert.equal(state.storageMode, 'browser');
  assert.equal(state.incidents.length, 10);
});

test('shared edits survive overlapping requests from separate Vercel instances', async t => {
  let saved = null;
  const redis = createServer(async (request, response) => {
    let body = '';
    for await (const part of request) body += part;
    const [op, ...args] = JSON.parse(body);
    let result;
    if (op === 'SET' && args[2] === 'NX') {
      if (saved === null) saved = args[1];
      result = 'OK';
    } else if (op === 'GET') {
      result = saved;
    } else if (op === 'EVAL') {
      result = Number(saved === args[3]);
      if (result) saved = args[4];
    } else throw Error('Unexpected store operation');
    response.end(JSON.stringify({result}));
  });
  const storageURL = await listen(redis);
  t.after(() => close(redis));
  const instances = await Promise.all([1,2].map(async () => {
    const {server} = await createApp({store:new RedisStore(storageURL,'test'), ai:new Ai(), accessToken:'test'});
    const url = await listen(server);
    t.after(() => close(server));
    return url;
  }));
  const responses = await Promise.all(instances.map((url,i) => fetch(url + '/api/incidents',{
    method:'POST',headers:{authorization:'Bearer test','content-type':'application/json'},
    body:JSON.stringify({text:'Fictional delivery report number ' + i})
  })));
  assert.deepEqual(responses.map(r => r.status), [201,201]);
  const reconnected = new RedisStore(storageURL,'test');
  await reconnected.init();
  const state = await reconnected.snapshot();
  assert.deepEqual(state.incidents.slice(-2).map(i=>i.number), [11,12]);
});
