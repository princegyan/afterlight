import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist', {recursive:true});
await cp('public', 'dist', {recursive:true});
await mkdir('dist/exercise', {recursive:true});
for (const file of ['domain.mjs', 'ai.mjs', 'scenario-api.mjs', 'judge-store.mjs']) {
  await cp('lib/' + file, 'dist/exercise/' + file);
}
