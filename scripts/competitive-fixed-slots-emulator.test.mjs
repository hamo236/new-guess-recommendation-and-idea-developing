import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ref, runTransaction, set, get } from 'firebase/database';

const rules = readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId: 'neon-guess-test-emulator',
  database: {
    rules,
    host: process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1',
    port: Number(process.env.FIREBASE_DATABASE_EMULATOR_PORT || 9001),
  },
});
await testEnv.clearDatabase();

const slotIds = ['slot-2', 'slot-3', 'slot-4'];
const playerRecord = (id, joinOrder, teamId) => ({ id, name: id, isHost: false, connected: true, score: 0, joinOrder, teamId });

try {
  const host = testEnv.authenticatedContext('host-fixed').database();
  await assertSucceeds(set(ref(host, 'teamRooms/fixed-1'), {
    roomId: 'fixed-1', mode: 'team_battle', status: 'lobby', phase: 'lobby', hostId: 'host-fixed', roundNumber: 0,
    players: { 'host-fixed': { id: 'host-fixed', name: 'Host', isHost: true, connected: true, score: 0, joinOrder: 1, teamId: 'team_a' } },
    joinSlots: {
      'slot-1': { playerId: 'host-fixed', joinOrder: 1 }, 'slot-2': null, 'slot-3': null, 'slot-4': null,
    },
    teams: { team_a: { teamId: 'team_a', playerIds: ['host-fixed'] }, team_b: { teamId: 'team_b', playerIds: [] } },
  }));

  const ids = Array.from({ length: 20 }, (_, index) => `fixed-client-${index + 1}`);
  const results = await Promise.all(ids.map(async (id, index) => {
    const db = testEnv.authenticatedContext(id).database();
    const slotId = slotIds[index % slotIds.length];
    const result = await runTransaction(ref(db, `teamRooms/fixed-1/joinSlots/${slotId}`), (current) => current?.playerId ? undefined : { playerId: id, joinOrder: Number(slotId.at(-1)) });
    if (!result.committed || result.snapshot.val()?.playerId !== id) return { id, committed: false, slotId };
    const joinOrder = Number(slotId.at(-1));
    await assertSucceeds(set(ref(db, `teamRooms/fixed-1/players/${id}`), playerRecord(id, joinOrder, joinOrder <= 2 ? 'team_a' : 'team_b')));
    return { id, committed: true, slotId };
  }));

  const finalRoom = (await get(ref(host, 'teamRooms/fixed-1'))).val();
  const occupants = Object.values(finalRoom.joinSlots).filter(Boolean);
  assert.equal(occupants.length, 4, 'Fixed slots must cap the room at four occupants.');
  assert.equal(new Set(occupants.map((slot) => slot.playerId)).size, 4, 'Every reserved slot must have a unique owner.');
  assert.equal(results.filter((result) => result.committed).length, 3, 'Exactly three non-host joins may commit.');
  assert.equal(results.filter((result) => !result.committed).length, 17, 'All remaining concurrent joins must be rejected or not committed.');

  const firstOwner = occupants.find((slot) => slot.playerId !== 'host-fixed');
  const outsider = testEnv.authenticatedContext('fixed-outsider').database();
  await assertFails(set(ref(outsider, 'teamRooms/fixed-1/joinSlots/slot-2'), { playerId: 'fixed-outsider', joinOrder: 2 }));
  await assertFails(set(ref(testEnv.authenticatedContext(firstOwner.playerId).database(), 'teamRooms/fixed-1/joinSlots/slot-2'), { playerId: firstOwner.playerId, joinOrder: 2 }));
  const ownerDb = testEnv.authenticatedContext(firstOwner.playerId).database();
  await assertSucceeds(set(ref(ownerDb, 'teamRooms/fixed-1/joinSlots/slot-2'), null));
  const replacementDb = testEnv.authenticatedContext('fixed-replacement').database();
  const replacement = await runTransaction(ref(replacementDb, 'teamRooms/fixed-1/joinSlots/slot-2'), (current) => current?.playerId ? undefined : { playerId: 'fixed-replacement', joinOrder: 2 });
  assert.equal(replacement.committed, true, 'A released slot must be reusable by a later client.');

  console.log(JSON.stringify({ status: 'passed', totalClients: ids.length, capacity: 4, successfulJoins: 3, occupants: occupants.map((slot) => slot.playerId), crossSlotOverwrite: 'blocked', releasedSlotReused: true }, null, 2));
} finally {
  await testEnv.cleanup();
}
