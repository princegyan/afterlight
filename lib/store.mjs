import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createSeed } from './domain.mjs';

export class Store {
  constructor(directory) { this.directory = resolve(directory); this.path = join(this.directory, 'scenario.json'); this.queue = Promise.resolve(); }
  async init() {
    await mkdir(this.directory, { recursive: true });
    try {
      this.state = JSON.parse(await readFile(this.path, 'utf8'));
      if (this.state.version !== 1 || !Array.isArray(this.state.incidents) || !Array.isArray(this.state.audit)) throw new Error('Unsupported or invalid scenario file. Restore a backup before continuing.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.state = createSeed(); await this.persist(this.state);
    }
  }
  async persist(state) { await writeFile(`${this.path}.tmp`, JSON.stringify(state, null, 2), { mode: 0o600 }); await rename(`${this.path}.tmp`, this.path); }
  snapshot() { return structuredClone(this.state); }
  async mutate(operation) {
    const task = this.queue.then(async () => {
      const next = structuredClone(this.state);
      const result = await operation(next);
      await this.persist(next);
      this.state = next;
      return result;
    });
    this.queue = task.catch(() => {});
    return task;
  }
}
