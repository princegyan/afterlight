import { createApp } from '../server.mjs';
import { createSeed } from '../lib/domain.mjs';
import { Ai } from '../lib/ai.mjs';
import { RedisStore } from '../lib/redis-store.mjs';

// With no shared database attached, judges each keep a durable exercise in their browser.
const browserStore = {
  init() {},
  snapshot() { return {...createSeed(), storageMode:'browser'}; },
  mutate() { throw Object.assign(new Error('Open the app to edit your browser exercise.'), {status:409}); }
};

let application;
function start() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url && !token) return createApp({store:browserStore, ai:new Ai()});
  if (!url || !token || !process.env.DEMO_ACCESS_TOKEN) {
    throw new Error('Shared storage requires a Redis REST URL, REST token, and demo access token.');
  }
  return createApp({store:new RedisStore(url, token)});
}

export default async function handler(request, response) {
  const url = new URL(request.url, 'http://localhost');
  // The rewrite supplies the endpoint when Vercel invokes the physical function URL.
  if (url.pathname === '/api/index' && url.searchParams.has('endpoint')) {
    request.url = '/api/' + url.searchParams.get('endpoint');
  }
  try {
    application ??= start().catch(error => { application = undefined; throw error; });
    const {server} = await application;
    server.emit('request', request, response);
  } catch {
    response.writeHead(503, {'Content-Type':'application/json','Cache-Control':'no-store'});
    response.end(JSON.stringify({error:'Shared exercise storage is unavailable. Check the Vercel configuration and retry.'}));
  }
}
