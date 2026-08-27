import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ref, set, get, remove } from 'firebase/database';
import fs from 'node:fs';

const rules = fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId: 'neon-guess-test-emulator',
  database: {
    host: process.env.FIREBASE_RULES_EMULATOR_HOST || '127.0.0.1',
    port: Number(process.env.FIREBASE_RULES_EMULATOR_PORT || 9001),
    rules,
  },
});
try {
  const host = testEnv.authenticatedContext('host-a').database();
  const player = testEnv.authenticatedContext('player-b').database();
  const playerC = testEnv.authenticatedContext('player-c').database();
  const playerD = testEnv.authenticatedContext('player-d').database();
  const outsider = testEnv.authenticatedContext('outsider').database();
  const room = {
    roomId: 'tm-1', mode: 'team_battle', phase: 'lobby', status: 'lobby', hostId: 'host-a', roundNumber: 0,
    players: {
      'host-a': { id: 'host-a', name: 'Host', isHost: true, connected: true, score: 0, joinOrder: 1, teamId: 'team_a' },
    },
    teams: { team_a: { teamId: 'team_a', playerIds: ['host-a'] }, team_b: { teamId: 'team_b', playerIds: [] } },
  };
  await assertSucceeds(host.ref('teamRooms/tm-1').set(room));
  await assertSucceeds(host.ref('teamRooms/tm-1/teamSeats/team_a_1').set({ playerId: 'host-a' }));
  await assertSucceeds(host.ref('teamRooms/tm-1/joinSlots/slot-1').set({ playerId: 'host-a', joinOrder: 1 }));
  await assertSucceeds(player.ref('teamRooms/tm-1/players/player-b').set({ id: 'player-b', name: 'Player B', isHost: false, connected: true, score: 0, joinOrder: 2, teamId: 'team_a' }));
  await assertSucceeds(playerC.ref('teamRooms/tm-1/players/player-c').set({ id: 'player-c', name: 'Player C', isHost: false, connected: true, score: 0, joinOrder: 3, teamId: 'team_b' }));
  await assertSucceeds(playerD.ref('teamRooms/tm-1/players/player-d').set({ id: 'player-d', name: 'Player D', isHost: false, connected: true, score: 0, joinOrder: 4, teamId: 'team_b' }));
  await assertSucceeds(player.ref('teamRooms/tm-1/teamSeats/team_a_2').set({ playerId: 'player-b' }));
  await assertSucceeds(playerC.ref('teamRooms/tm-1/teamSeats/team_b_1').set({ playerId: 'player-c' }));
  await assertSucceeds(playerD.ref('teamRooms/tm-1/teamSeats/team_b_2').set({ playerId: 'player-d' }));
  await assertSucceeds(player.ref('teamRooms/tm-1/joinSlots/slot-2').set({ playerId: 'player-b', joinOrder: 2 }));
  await assertSucceeds(playerC.ref('teamRooms/tm-1/joinSlots/slot-3').set({ playerId: 'player-c', joinOrder: 3 }));
  await assertSucceeds(playerD.ref('teamRooms/tm-1/joinSlots/slot-4').set({ playerId: 'player-d', joinOrder: 4 }));
  await assertSucceeds(player.ref('teamRooms/tm-1/teamSeats/team_b_3').set({ playerId: 'player-b' }));
  await assertSucceeds(player.ref('teamRooms/tm-1/players/player-b/teamId').set('team_b'));
  await assertSucceeds(player.ref('teamRooms/tm-1/teamSeats/team_a_3').set({ playerId: 'player-b' }));
  await assertSucceeds(player.ref('teamRooms/tm-1/players/player-b/teamId').set('team_a'));
  await assertSucceeds(player.ref('teamRooms/tm-1/teamSeats/team_b_3').remove());
  await assertSucceeds(player.ref('teamRooms/tm-1/teamSeats/team_a_2').remove());
  await assertSucceeds(player.ref('teamRooms/tm-1/teamSeats/team_b_3').set({ playerId: 'player-b' }));
  await assertSucceeds(player.ref('teamRooms/tm-1/players/player-b/teamId').set('team_b'));
  await assertFails(player.ref('teamRooms/tm-1/players/player-b/score').set(999));
  await assertFails(player.ref('teamRooms/tm-1/players/player-b/id').set('host-a'));
  await assertFails(outsider.ref('teamRooms/tm-1/players/player-b/teamId').set('team_a'));
  await assertSucceeds(host.ref('teamRooms/tm-1/players/player-b').remove());
  await assertSucceeds(host.ref('teamRooms/tm-1/joinSlots/slot-2').remove());
  assert.equal((await get(host.ref('teamRooms/tm-1/players/player-b'))).exists(), false);
  assert.equal((await get(host.ref('teamRooms/tm-1/joinSlots/slot-2'))).exists(), false);
  await assertSucceeds(player.ref('teamRooms/tm-1/joinSlots/slot-2').set({ playerId: 'player-b', joinOrder: 2 }));
  console.log(JSON.stringify({ status: 'passed', scopedTeamSwitch: true, thirdSeatSwitch: true, temporaryThreeOneLobby: true, protectedFields: 'blocked', outsiderWrite: 'blocked', hostRemoval: true, releasedSlotReusable: true }, null, 2));
} finally {
  await testEnv.cleanup();
}
