import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';

const rules = readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId: 'neon-guess-test-emulator',
    database: { rules, host: process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1', port: Number(process.env.FIREBASE_DATABASE_EMULATOR_PORT || 9001) },
});
await testEnv.clearDatabase();

try {
  const host = testEnv.authenticatedContext('host-a').database();
  const playerB = testEnv.authenticatedContext('player-b').database();
  const outsider = testEnv.authenticatedContext('outsider-c').database();
  const room = {
    hostId: 'host-a',
    mode: '1v1',
    phase: 'lobby',
    status: 'lobby',
    players: {
      'host-a': { id: 'host-a', name: 'Host', isHost: true, connected: true, score: 0, joinOrder: 1 },
      'player-b': { id: 'player-b', name: 'Player B', isHost: false, connected: true, score: 0, joinOrder: 2 },
    },
  };
  const target = {
    id: 'target-1', name: 'Private Target', category: 'Animals',
    round: 1, roundId: 'round-1', targetReady: true,
  };

  // Firebase SDK transactions require read permission before their first write.
  // This is the exact fresh-node operation used by social room creation.
  await assertSucceeds(host.ref('rooms/transaction-r1').transaction((current) => current ?? room));
  await assertSucceeds(host.ref('rooms/r1').set(room));

  // Mirrors syncEnterPreview's exact root fan-out. This failed before the
  // timestamp child Rules were added because the host write was denied.
  const startPreviewUpdates = {
    'rooms/r1/phase': 'preview',
    'rooms/r1/status': 'preview',
    'rooms/r1/round': 1,
    'rooms/r1/roundResult': null,
    'rooms/r1/bracket': null,
    'rooms/r1/playerAssignments': {},
    'rooms/r1/matchResults': {},
    'rooms/r1/standings': [],
    'rooms/r1/revealEndTimestamp': 0,
    'rooms/r1/transitionStartedAt': 0,
    'rooms/r1/transitionEndsAt': 0,
    'rooms/r1/timerEndTimestamp': 0,
  };
  await assertSucceeds(host.ref('/').update(startPreviewUpdates));
  await assertFails(playerB.ref('/').update(startPreviewUpdates));
  await assertFails(outsider.ref('/').update(startPreviewUpdates));
  await assertFails(host.ref('/').update({
    'rooms/r1/transitionEndsAt': -1,
  }));
  await assertFails(playerB.ref('/').update({
    'rooms/r2/phase': 'preview',
  }));

  await assertSucceeds(host.ref('privateRooms/r1/host-a/ownTarget').set(target));
  await assertSucceeds(host.ref('privateRooms/r1/player-b/ownTarget').set({ ...target, id: 'target-b' }));
  await assertSucceeds(host.ref('privateRooms/r1/host-a/displayTarget').set({ ...target, id: 'target-b' }));
  await assertSucceeds(host.ref('privateRooms/r1/player-b/displayTarget').set({ ...target, id: 'target-1' }));

  await assertSucceeds(playerB.ref('rooms/r1').get());
  await assertSucceeds(playerB.ref('privateRooms/r1/player-b/displayTarget').get());
  await assertFails(playerB.ref('privateRooms/r1/player-b/ownTarget').get());
  await assertFails(playerB.ref('privateRooms/r1/host-a/ownTarget').get());
  await assertFails(playerB.ref('privateRooms/r1/host-a/displayTarget').get());
  await assertFails(outsider.ref('privateRooms/r1/player-b/displayTarget').get());
  await assertFails(playerB.ref('privateRooms/r1').get());
  await assertFails(playerB.ref('privateRooms/r1/player-b/ownTarget').set({ ...target, name: 'tampered' }));
  await assertFails(playerB.ref('privateRooms/r1/player-b/displayTarget').set({ ...target, name: 'tampered' }));
  await assertFails(playerB.ref('rooms/r1/hostId').set('player-b'));
  await assertFails(playerB.ref('rooms/r1/players/player-b/score').set(9999));
  await assertFails(playerB.ref('rooms/r1/players/player-b/isHost').set(true));
  await assertFails(playerB.ref('rooms/r1/players/player-b/joinOrder').set(1));
  await assertFails(playerB.ref('rooms/r1/players/player-b/id').set('host-a'));
  await assertSucceeds(playerB.ref('rooms/r1/players/player-b/connected').set(false));

  await assertSucceeds(host.ref('rooms/r1/players/player-b/isHost').set(true));
  await assertSucceeds(host.ref('rooms/r1/players/host-a/connected').set(false));
  await assertSucceeds(host.ref('rooms/r1/hostId').set('player-b'));

  const publicRoom = (await playerB.ref('rooms/r1').get()).val();
  assert.equal(publicRoom.players['host-a'].name, 'Host');

  const competitiveRoom = {
    roomId: 'tb-1', mode: 'team_battle', phase: 'lobby', status: 'lobby',
    hostId: 'host-a', roundNumber: 0,
    players: {
      'host-a': { id: 'host-a', name: 'Host', isHost: true, connected: true, score: 0, joinOrder: 1, teamId: 'team_a' },
    },
    teams: { team_a: { teamId: 'team_a', playerIds: ['host-a'] }, team_b: { teamId: 'team_b', playerIds: [] } },
  };
  await assertSucceeds(host.ref('teamRooms/transaction-tb').transaction((current) => current ?? competitiveRoom));
  await assertSucceeds(host.ref('teamRooms/tb-1').set(competitiveRoom));
  await assertSucceeds(host.ref('teamRooms/tb-1/teamSeats/team_a_1').set({ playerId: 'host-a' }));
  await assertSucceeds(playerB.ref('teamRooms/tb-1/players/player-b').set({ id: 'player-b', name: 'Player B', isHost: false, connected: true, score: 0, joinOrder: 2, teamId: 'team_a' }));
  await assertSucceeds(playerB.ref('teamRooms/tb-1/teamSeats/team_a_2').set({ playerId: 'player-b' }));
  await assertSucceeds(playerB.ref('teamRooms/tb-1').get());

  // These are intentionally red tests against the current broad parent .write grant.
  await assertFails(playerB.ref('teamRooms/tb-1/status').set('finished'));
  await assertFails(playerB.ref('teamRooms/tb-1/hostId').set('player-b'));
  await assertFails(playerB.ref('teamRooms/tb-1').set({ ...competitiveRoom, status: 'finished' }));
  await assertSucceeds(playerB.ref('teamRooms/tb-1/players/player-b/connected').set(false));
  await assertSucceeds(playerB.ref('teamRooms/tb-1/leftPlayers/player-b').set(true));
  // Lobby discovery is intentionally readable to authenticated joiners; membership isolation is tested after play starts.
  await assertSucceeds(outsider.ref('teamRooms/tb-1').get());
  await assertSucceeds(host.ref('teamRooms/tb-1/status').set('playing'));
  await assertFails(outsider.ref('teamRooms/tb-1').get());

  const tournamentRoom = { ...competitiveRoom, roomId: 'tr-1', mode: 'tournament', teams: undefined };
  delete tournamentRoom.teams;
  await assertSucceeds(host.ref('tournamentRooms/transaction-tr').transaction((current) => current ?? tournamentRoom));
  await assertSucceeds(host.ref('tournamentRooms/tr-1').set(tournamentRoom));
  await assertFails(playerB.ref('tournamentRooms/tr-1').remove());
  await assertFails(playerB.ref('tournamentRooms/tr-1/status').set('finished'));
  await assertSucceeds(playerB.ref('tournamentRooms/tr-1/players/player-b').remove());
  await assertSucceeds(playerB.ref('tournamentRooms/tr-1/leftPlayers/player-b').set(true));
  const tournamentAfterMemberLeave = await host.ref('tournamentRooms/tr-1').get();
  assert.equal(tournamentAfterMemberLeave.exists(), true, 'A non-host Tournament leave must preserve the room node.');
  assert.equal(tournamentAfterMemberLeave.val().players['host-a'].id, 'host-a');

  console.log('Rules emulator passed: public room read works, private targets stay isolated, competitive members cannot overwrite room authority, lifecycle writes remain scoped, and outsiders are denied.');
} finally {
  await testEnv.cleanup();
}
