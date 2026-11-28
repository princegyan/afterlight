import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { Store } from './lib/store.mjs';
import { Ai } from './lib/ai.mjs';
import { MAP_CONFIG, InputError } from './lib/domain.mjs';
import { scenarioRequest } from './lib/scenario-api.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
async function readBody(request) {
  let size = 0; const chunks = [];
  for await (const chunk of request) { size += chunk.length; if (size > 1_500_000) throw new InputError('Request is too large.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new InputError('Send valid JSON.'); }
}
function send(response, status, value) { response.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); response.end(JSON.stringify(value)); }
function notFound(message = 'Record not found.') { const error = new Error(message); error.status = 404; throw error; }
function tokenMatches(provided, expected) { const a=Buffer.from(provided), b=Buffer.from(expected); return a.length === b.length && timingSafeEqual(a,b); }
export async function createApp({dataDir = resolve(ROOT,process.env.DATA_DIR || 'data'), store = new Store(dataDir), ai = new Ai({key:process.env.AI_API_KEY,model:process.env.AI_MODEL,base:process.env.AI_BASE_URL}), accessToken = process.env.DEMO_ACCESS_TOKEN || ''} = {}) {
  await store.init();
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
        const result = await scenarioRequest({method:request.method, path, read:()=>readBody(request), store, ai, mapConfig});
        return send(response, result.status, result.data);
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
