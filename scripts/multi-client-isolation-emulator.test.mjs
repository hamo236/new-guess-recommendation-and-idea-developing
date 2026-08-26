import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';

const rules = readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId: 'neon-guess-multiclient-emulator',
  database: { rules },
});

const room = (hostId) => ({
  hostId,
  mode: 'social',
  phase: 'lobby',
  status: 'lobby',
  round: 1,
  roundId: 'round-1',
  joinSlots: {
    'slot-1': { playerId: hostId, joinOrder: 1 },
    'slot-2': null,
    'slot-3': null,
    'slot-4': null,
  },
  players: {
    [hostId]: { id: hostId, name: hostId, isHost: true, connected: true, score: 0, joinOrder: 1 },
  },
  scores: { [hostId]: 0 },
});

async function concurrentJoin(db, roomCode, playerId) {
  const roomSnapshot = await db.ref(`rooms/${roomCode}`).get();
  const current = roomSnapshot.val();
  if (!current || current.status !== 'lobby' || current.phase !== 'lobby') return { committed: false, snapshot: roomSnapshot };
  const slotIds = ['slot-2', 'slot-3', 'slot-4'];
  for (const slotId of slotIds) {
    const slotRef = db.ref(`rooms/${roomCode}/joinSlots/${slotId}`);
    const claim = await slotRef.transaction((slot) => {
      if (slot?.playerId) return;
      return { playerId, joinOrder: Number(slotId.replace('slot-', '')) };
    });
    if (!claim.committed || claim.snapshot.val()?.playerId !== playerId) continue;
    const playerRef = db.ref(`rooms/${roomCode}/players/${playerId}`);
    await playerRef.set({
      id: playerId,
      name: playerId,
      isHost: false,
      connected: true,
      score: 0,
      joinOrder: Number(slotId.replace('slot-', '')),
    });
    return { committed: true, slotId };
  }
  return { committed: false, snapshot: roomSnapshot };
}

try {
  const hostA = testEnv.authenticatedContext('room-a-host').database();
  const hostB = testEnv.authenticatedContext('room-b-host').database();
  await assertSucceeds(hostA.ref('rooms/101').set(room('room-a-host')));
  await assertSucceeds(hostB.ref('rooms/202').set(room('room-b-host')));

  const clientsA = ['a1', 'a2', 'a3'];
  const clientsB = ['b1', 'b2', 'b3'];
  const clients = [...clientsA, ...clientsB, ...Array.from({ length: 14 }, (_, index) => `overflow-${index + 1}`)];
  const results = await Promise.all(clients.map(async (playerId, index) => {
    const db = testEnv.authenticatedContext(playerId).database();
    const roomCode = index < clientsA.length ? '101' : index < clientsA.length + clientsB.length ? '202' : (index % 2 ? '101' : '202');
    const result = await concurrentJoin(db, roomCode, playerId);
    return { playerId, roomCode, committed: result.committed, snapshot: result.snapshot?.val?.() };
  }));

  const roomA = (await hostA.ref('rooms/101').get()).val();
  const roomB = (await hostB.ref('rooms/202').get()).val();
  assert.equal(Object.keys(roomA.players).length, 4, 'Room A must remain capped at four players.');
  assert.equal(Object.keys(roomB.players).length, 4, 'Room B must remain capped at four players.');
  assert.equal(roomA.players['room-a-host'].id, 'room-a-host');
  assert.equal(roomB.players['room-b-host'].id, 'room-b-host');
  assert.equal(Object.keys(roomA.players).some((id) => id.startsWith('b')), false, 'Room A must not receive Room B players.');
  assert.equal(Object.keys(roomB.players).some((id) => id.startsWith('a')), false, 'Room B must not receive Room A players.');
  assert.equal(results.length, 20);

  const playerB1 = testEnv.authenticatedContext('b1').database();
  const outsider = testEnv.authenticatedContext('outsider').database();
  await assertSucceeds(playerB1.ref('rooms/101').get());
  await assertSucceeds(outsider.ref('rooms/101').get());

  console.log(JSON.stringify({
    status: 'passed',
    concurrentClients: clients.length,
    roomAPlayers: Object.keys(roomA.players),
    roomBPlayers: Object.keys(roomB.players),
    lobbyDiscoveryAllowed: true,
    privateTargetIsolationCoveredByRulesSuite: true,
    overflowCapped: true,
  }, null, 2));
} finally {
  await testEnv.cleanup();
}
