import { createSeed } from './domain.mjs';

const key = 'afterlight:harborlight:v1';
// Compare and replace in Redis itself, including writes from different function instances.
const compareAndSet = "if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2]); return 1 else return 0 end";

export class RedisStore {
  constructor(url, token) {
    this.url = url;
    this.token = token;
  }
  async command(...args) {
    const response = await fetch(this.url, {
      method:'POST', headers:{Authorization:'Bearer ' + this.token, 'Content-Type':'application/json'},
      body:JSON.stringify(args), signal:AbortSignal.timeout(8000), cache:'no-store'
    });
    if (!response.ok) throw new Error('Exercise storage is unavailable.');
    const data = await response.json();
    if (data.error) throw new Error('Exercise storage rejected the operation.');
    return data.result;
  }
  async init() {
    await this.command('SET', key, JSON.stringify(createSeed()), 'NX');
  }
  async serialized() {
    const value = await this.command('GET', key);
    if (typeof value !== 'string') throw new Error('The shared exercise is missing.');
    return value;
  }
  async snapshot() { return JSON.parse(await this.serialized()); }
  async mutate(operation) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const previous = await this.serialized();
      const next = JSON.parse(previous);
      const result = await operation(next);
      if (await this.command('EVAL', compareAndSet, 1, key, previous, JSON.stringify(next))) return result;
    }
    throw Object.assign(new Error('The exercise changed several times. Please retry.'), {status:409});
  }
}
