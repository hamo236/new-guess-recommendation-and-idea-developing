import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ref, set, get, runTransaction } from 'firebase/database';

const projectId = 'demo-neon-guess-atomic-poc';
const rulesPath = join(dirname(fileURLToPath(import.meta.url)), 'atomic-join-poc.rules.json');
const rules = readFileSync(rulesPath, 'utf8');
const testEnv = await initializeTestEnvironment({ projectId, database: { host: '127.0.0.1', port: 9010, rules } });

const isPermissionDenied = (error) => String(error?.code ?? error?.message).toUpperCase().includes('PERMISSION_DENIED');

try {
  const host = testEnv.authenticatedContext('host').database();
  await assertSucceeds(set(ref(host, 'pocRooms/101'), {
    status: 'lobby', capacity: 4,
    slots: {
      'slot-1': { playerId: 'host' },
      'slot-2': { playerId: '' },
      'slot-3': { playerId: '' },
      'slot-4': { playerId: '' },
    },
  }));

  const ids = Array.from({ length: 20 }, (_, i) => `client-${i + 1}`);
  const slotIds = ['slot-2', 'slot-3', 'slot-4'];
  const settled = await Promise.all(ids.map(async (id, index) => {
    const db = testEnv.authenticatedContext(id).database();
    const slotId = slotIds[index % slotIds.length];
    try {
      const result = await runTransaction(ref(db, `pocRooms/101/slots/${slotId}`), (current) => {
        if (current?.playerId) return;
        return { playerId: id };
      });
      return { id, slotId, status: result.committed ? 'committed' : 'not-committed', value: result.snapshot.val() };
    } catch (error) {
      if (isPermissionDenied(error)) return { id, slotId, status: 'rejected-occupied-or-unauthorized' };
      return { id, slotId, status: 'unexpected-error', code: error.code, message: error.message };
    }
  }));

  const final = (await get(ref(host, 'pocRooms/101'))).val();
  const occupants = Object.values(final.slots).filter((slot) => slot?.playerId);
  const successful = settled.filter((result) => result.status === 'committed');
  assert.equal(occupants.length, 4, 'Atomic slot reservation must never exceed four occupants.');
  assert.equal(new Set(occupants.map((slot) => slot.playerId)).size, 4, 'Reserved slots must have unique owners.');
  assert.equal(successful.length, 3, 'Exactly three new clients may commit.');
  assert.equal(settled.filter((result) => result.status === 'unexpected-error').length, 0, 'No unexpected client errors are allowed.');

  const outsider = testEnv.authenticatedContext('outsider').database();
  await assertFails(set(ref(outsider, 'pocRooms/101/slots/slot-2'), { playerId: 'outsider' }));
  const reconnectOwner = occupants.find((slot) => slot.playerId !== 'host')?.playerId;
  await assertFails(set(ref(testEnv.authenticatedContext(reconnectOwner).database(), 'pocRooms/101/slots/slot-2'), { playerId: reconnectOwner }));

  console.log(JSON.stringify({
    status: 'passed', totalClients: ids.length, capacity: 4,
    finalOccupants: occupants.map((slot) => slot.playerId),
    successfulNewJoins: successful.map((result) => ({ id: result.id, slotId: result.slotId })),
    rejectedContention: settled.filter((result) => result.status === 'rejected-occupied-or-unauthorized').length,
    unauthorizedOverwrite: 'blocked',
    occupiedSlotReconnectOverwrite: 'blocked',
  }, null, 2));
} finally {
  await testEnv.cleanup();
}
