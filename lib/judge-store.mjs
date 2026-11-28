import { createSeed } from './domain.mjs';
import { Ai } from './ai.mjs';
import { scenarioRequest } from './scenario-api.mjs';

// IndexedDB serializes read/write transactions across tabs on the same origin.
let database;
function openDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    const open = indexedDB.open('afterlight-judge', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('scenario');
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => { database = undefined; reject(open.error); };
  });
  return database;
}

async function transaction(operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scenario', 'readwrite');
    const records = tx.objectStore('scenario');
    const request = records.get('harborlight');
    let result;
    request.onsuccess = () => {
      try {
        const state = request.result ?? createSeed();
        result = operation ? operation(state) : state;
        if (operation || !request.result) records.put(state, 'harborlight');
      } catch (error) { tx.abort(); reject(error); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error || new Error('The exercise could not be saved in this browser.'));
  });
}

const store = {snapshot: () => transaction(), mutate: transaction};
const ai = new Ai();
export async function judgeRequest(path, body) {
  const {data} = await scenarioRequest({path, method:body === undefined ? 'GET' : 'POST', read:() => body, store, ai});
  if (path === '/api/state') data.storageMode = 'browser';
  return data;
}
