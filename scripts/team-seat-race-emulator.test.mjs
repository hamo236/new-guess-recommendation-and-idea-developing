import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { get, set } from 'firebase/database';
import fs from 'node:fs';

const rules = fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');
const testEnv = await initializeTestEnvironment({ projectId: 'neon-guess-test-emulator', database: { rules } });
try {
  const clients = Object.fromEntries(['host-a', 'player-b', 'player-c', 'player-d'].map((id) => [id, testEnv.authenticatedContext(id).database()]));
  const room = {
    roomId: 'race-1', mode: 'team_battle', phase: 'lobby', status: 'lobby', hostId: 'host-a', roundNumber: 0,
    players: {
      'host-a': { id: 'host-a', isHost: true, connected: true, score: 0, joinOrder: 1, teamId: 'team_a' },
      'player-b': { id: 'player-b', isHost: false, connected: true, score: 0, joinOrder: 2, teamId: 'team_a' },
      'player-c': { id: 'player-c', isHost: false, connected: true, score: 0, joinOrder: 3, teamId: 'team_a' },
      'player-d': { id: 'player-d', isHost: false, connected: true, score: 0, joinOrder: 4, teamId: 'team_b' },
    },
    teams: { team_a: { teamId: 'team_a', playerIds: ['host-a', 'player-b', 'player-c'] }, team_b: { teamId: 'team_b', playerIds: ['player-d'] } },
  };
  await assertSucceeds(clients['host-a'].ref('teamRooms/race-1').set(room));
  const results = await Promise.all([
    assertFails(clients['player-b'].ref('teamRooms/race-1/players/player-b/teamId').set('team_b')),
    assertFails(clients['player-c'].ref('teamRooms/race-1/players/player-c/teamId').set('team_b')),
  ]);
  const players = (await get(clients['host-a'].ref('teamRooms/race-1/players'))).val();
  const teamBCount = Object.values(players).filter((player) => player.teamId === 'team_b').length;
  console.log(JSON.stringify({ status: 'capacity-preserved', teamBCount, attemptedConcurrentMoves: 2, deniedMoves: results.length, documentedLimit: 2 }, null, 2));
  assert.equal(teamBCount, 1, 'Direct teamId writes must not bypass team-seat claims.');
} finally {
  await testEnv.cleanup();
}
