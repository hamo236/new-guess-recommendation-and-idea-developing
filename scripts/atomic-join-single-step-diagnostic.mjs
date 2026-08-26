import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, set, get, runTransaction } from 'firebase/database';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const projectId = 'demo-neon-guess-single-step';
const rulesPath = join(dirname(fileURLToPath(import.meta.url)), 'atomic-join-poc.rules.json');
const rules = readFileSync(rulesPath, 'utf8');
const env = await initializeTestEnvironment({ projectId, database: { host: '127.0.0.1', port: 9011, rules } });
const report = [];
const record = async (name, fn) => {
  try { const value = await fn(); report.push({ name, status: 'passed', value: value ?? null }); }
  catch (error) { report.push({ name, status: 'failed', code: error.code ?? null, message: error.message }); }
};
try {
  const host = env.authenticatedContext('host').database();
  const client = env.authenticatedContext('client-1').database();
  await record('create-room', () => set(ref(host, 'pocRooms/202/'), { status: 'lobby', capacity: 4, slots: { 'slot-1': { playerId: 'host' }, 'slot-2': { playerId: '' }, 'slot-3': { playerId: '' }, 'slot-4': { playerId: '' } } }));
  await record('read-slot', async () => (await get(ref(client, 'pocRooms/202/slots/slot-2'))).val());
  await record('direct-claim', () => set(ref(client, 'pocRooms/202/slots/slot-2'), { playerId: 'client-1' }));
  await record('read-claimed-slot', async () => (await get(ref(host, 'pocRooms/202/slots/slot-2'))).val());
  await record('single-transaction-claim', async () => {
    const result = await runTransaction(ref(client, 'pocRooms/202/slots/slot-3'), (current) => {
      if (current?.playerId) return current;
      return { playerId: 'client-1' };
    });
    return { committed: result.committed, value: result.snapshot.val() };
  });
  console.log(JSON.stringify({ projectId, report }, null, 2));
} finally { await env.cleanup(); }
