import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ref, set, get, runTransaction } from 'firebase/database';

const rules = readFileSync(new URL('../database.rules.simplified-candidate.json', import.meta.url), 'utf8');
JSON.parse(rules);

const env = await initializeTestEnvironment({
  projectId: 'neon-guess-test-simplified-competitive',
  database: { host: '127.0.0.1', port: 9001, rules },
});
await env.clearDatabase();

const ts = 1700000000000;
const player = (id, joinOrder, isHost = false, teamId = null) => ({
  id,
  name: id,
  avatar: `${id}.png`,
  isHost,
  connected: true,
  score: 0,
  joinOrder,
  teamId,
});
const target = (id, playerId, teamId, matchId, roundNumber) => ({
  id,
  targetId: id,
  name: `Target ${id}`,
  image: `${id}.png`,
  playerId,
  teamId,
  targetOwnerTeamId: teamId,
  matchId,
  roundNumber,
  targetReady: true,
});
const teamPlayerStats = (ids, teams) => Object.fromEntries(ids.map((id) => [id, {
  playerId: id, teamId: teams[id], score: 0, guesses: 0, correctGuesses: 0, roundHistory: [], reward: null,
}]));
const teamState = (roomId, ids, teams, hostId = ids[0]) => {
  const teamPlayers = {
    team_a: ids.filter((id) => teams[id] === 'team_a'),
    team_b: ids.filter((id) => teams[id] === 'team_b'),
  };
  const matchId = `${roomId}_match_1`;
  return {
    teamRoomId: roomId,
    roomId,
    mode: 'team_battle',
    category: 'Football',
    phase: 'playing',
    roundNumber: 1,
    hostId,
    playerIds: ids,
    players: Object.fromEntries(ids.map((id, index) => [id, player(id, index + 1, id === hostId, teams[id])])),
    teams: {
      team_a: { teamId: 'team_a', playerIds: teamPlayers.team_a, score: 0 },
      team_b: { teamId: 'team_b', playerIds: teamPlayers.team_b, score: 0 },
    },
    teamByPlayer: teams,
    playerStats: teamPlayerStats(ids, teams),
    rewards: {},
    roundHistory: [],
    match: {
      matchId,
      status: 'playing',
      roundNumber: 1,
      phase: 'playing',
      targets: {},
      teamTargets: {},
      guesses: {},
      confirmations: { team_a: {}, team_b: {} },
      confirmationTeamId: null,
      confirmationTeamIds: [],
      roundSnapshot: null,
      result: null,
      roundEndTimestamp: ts + 60000,
      revealEndTimestamp: null,
    },
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  };
};
const teamLobby = (roomId, hostId) => ({
  roomId,
  teamRoomId: roomId,
  mode: 'team_battle',
  status: 'lobby',
  phase: 'lobby',
  category: 'Football',
  roundNumber: 0,
  hostId,
  players: { [hostId]: player(hostId, 1, true, 'team_a') },
  joinSlots: {
    'slot-1': { playerId: hostId, joinOrder: 1, reservedAt: ts },
    'slot-2': null,
    'slot-3': null,
    'slot-4': null,
  },
  teams: { team_a: { teamId: 'team_a', playerIds: [hostId] }, team_b: { teamId: 'team_b', playerIds: [] } },
  teamSeats: {
    team_a_1: { playerId: hostId, claimedAt: ts },
    team_a_2: null,
    team_b_1: null,
    team_b_2: null,
  },
  updatedAt: ts,
});
const tournamentLobby = (roomId, hostId) => ({
  roomId,
  tournamentId: roomId,
  mode: 'tournament',
  status: 'lobby',
  phase: 'lobby',
  category: 'Football',
  roundNumber: 0,
  hostId,
  players: { [hostId]: player(hostId, 1, true, null) },
  joinSlots: {
    'slot-1': { playerId: hostId, joinOrder: 1, reservedAt: ts },
    'slot-2': null,
    'slot-3': null,
    'slot-4': null,
  },
  updatedAt: ts,
});
const joinSlots = (hostId, ids) => Object.fromEntries([
  ['slot-1', hostId],
  ...ids.map((id, index) => [`slot-${index + 2}`, id]),
].map(([slot, id], index) => [slot, { playerId: id, joinOrder: index + 1, reservedAt: ts + index }]));
const joinTeamRoom = async (client, roomPath, id, slotId, teamSeat) => {
  await assertSucceeds(set(ref(client, `${roomPath}/joinSlots/${slotId}`), { playerId: id, joinOrder: Number(slotId.slice(-1)), reservedAt: ts + 10 }));
  await assertSucceeds(set(ref(client, `${roomPath}/teamSeats/${teamSeat}`), { playerId: id, claimedAt: ts + 10 }));
  await assertSucceeds(set(ref(client, `${roomPath}/players/${id}`), player(id, Number(slotId.slice(-1)), false, teamSeat.startsWith('team_a') ? 'team_a' : 'team_b')));
};
const joinTournamentRoom = async (client, roomPath, id, slotId) => {
  await assertSucceeds(set(ref(client, `${roomPath}/joinSlots/${slotId}`), { playerId: id, joinOrder: Number(slotId.slice(-1)), reservedAt: ts + 10 }));
  await assertSucceeds(set(ref(client, `${roomPath}/players/${id}`), player(id, Number(slotId.slice(-1)), false, null)));
};
const confirmation = (playerId, teamId, matchId, roundNumber) => ({ playerId, teamId, matchId, roundNumber, confirmedAt: ts + roundNumber });
const tournamentMatch = (matchId, ids, status = 'playing', roundNumber = 1) => ({
  matchId,
  playerIds: ids,
  playerMap: Object.fromEntries(ids.map((id) => [id, true])),
  status,
  roundNumber,
  phase: status === 'playing' ? 'playing' : status === 'pending' ? 'lobby' : 'round_result',
  scores: Object.fromEntries(ids.map((id) => [id, 0])),
  targets: {},
  guesses: {},
  result: null,
  revealEndTimestamp: null,
});
const tournamentState = (roomId, ids, hostId) => ({
  roomId,
  tournamentId: roomId,
  mode: 'tournament',
  category: 'Football',
  phase: 'semi_finals',
  roundNumber: 1,
  hostId,
  playerIds: ids,
  players: Object.fromEntries(ids.map((id, index) => [id, player(id, index + 1, id === hostId, null)])),
  playerStats: Object.fromEntries(ids.map((id) => [id, { playerId: id, score: 0, guesses: 0, correctGuesses: 0, roundHistory: [], reward: null }])),
  rewards: {},
  matches: {
    semi_a: tournamentMatch('semi_a', ids.slice(0, 2), 'playing'),
    semi_b: tournamentMatch('semi_b', ids.slice(2, 4), 'playing'),
    final: tournamentMatch('final', [], 'pending'),
    consolation: tournamentMatch('consolation', [], 'pending'),
  },
  transitionEndTimestamp: null,
  winnerId: null,
  secondPlaceId: null,
  thirdPlaceId: null,
  fourthPlaceId: null,
  status: 'active',
  createdAt: ts,
  updatedAt: ts,
});
const guess = (confirmerId, guesserId, roundNumber) => ({ playerId: confirmerId, confirmerId, guesserId, roundNumber, confirmed: true, correct: true, timestamp: ts + roundNumber });

try {
  const host = env.authenticatedContext('tb-host').database();
  const a2 = env.authenticatedContext('tb-a2').database();
  const b1 = env.authenticatedContext('tb-b1').database();
  const b2 = env.authenticatedContext('tb-b2').database();
  const outsider = env.authenticatedContext('tb-outsider').database();
  const teamPath = 'teamRooms/tb-candidate';
  const ids = ['tb-host', 'tb-a2', 'tb-b1', 'tb-b2'];
  const teams = { 'tb-host': 'team_a', 'tb-a2': 'team_a', 'tb-b1': 'team_b', 'tb-b2': 'team_b' };

  await assertSucceeds(runTransaction(ref(host, teamPath), (current) => current ?? teamLobby('tb-candidate', 'tb-host')));
  await joinTeamRoom(a2, teamPath, 'tb-a2', 'slot-2', 'team_a_2');
  await joinTeamRoom(b1, teamPath, 'tb-b1', 'slot-3', 'team_b_1');
  await joinTeamRoom(b2, teamPath, 'tb-b2', 'slot-4', 'team_b_2');
  const joinedLobby = (await get(ref(host, teamPath))).val();
  console.log('2v2 joined lobby players:', JSON.stringify(joinedLobby?.players));
  console.log('2v2 joined lobby host:', joinedLobby?.hostId, 'auth:', 'tb-host');
  const startingTeamState = teamState('tb-candidate', ids, teams);
  await assertSucceeds(set(ref(host, teamPath), {
    ...startingTeamState,
    players: joinedLobby.players,
    joinSlots: joinedLobby.joinSlots,
    teamSeats: joinedLobby.teamSeats,
  }));

  const teamRoundIds = [];
  for (const roundNumber of [1, 2, 3]) {
    const current = (await get(ref(host, teamPath))).val();
    const matchId = current.match.matchId;
    const roundId = `${matchId}:round:${roundNumber}`;
    teamRoundIds.push(roundId);
    await assertSucceeds(runTransaction(ref(b1, `${teamPath}/match/confirmations/team_b/tb-b1`), (value) => value ?? confirmation('tb-b1', 'team_b', matchId, roundNumber)));
    await assertSucceeds(runTransaction(ref(b2, `${teamPath}/match/confirmations/team_b/tb-b2`), (value) => value ?? confirmation('tb-b2', 'team_b', matchId, roundNumber)));
    const afterResult = {
      ...current,
      phase: roundNumber === 3 ? 'results' : 'round_result',
      status: roundNumber === 3 ? 'finished' : 'round_result',
      roundNumber,
      teams: { ...current.teams, team_b: { ...current.teams.team_b, score: roundNumber } },
      roundHistory: [...(current.roundHistory || []), { roundNumber, matchId, winningTeamIds: ['team_a'], completedAt: ts + roundNumber }],
      match: {
        ...current.match,
        status: roundNumber === 3 ? 'finished' : 'round_result',
        phase: roundNumber === 3 ? 'results' : 'round_result',
        roundNumber,
        result: { roundNumber, winningTeamIds: ['team_a'], teamScores: { team_a: roundNumber, team_b: roundNumber } },
        confirmations: { team_a: {}, team_b: {} },
        revealEndTimestamp: roundNumber === 3 ? null : ts + roundNumber * 5000,
      },
    };
    await assertSucceeds(runTransaction(ref(host, teamPath), (value) => value ? afterResult : value));
    if (roundNumber < 3) {
      const nextMatchId = `tb-candidate_match_${roundNumber + 1}`;
      await assertSucceeds(runTransaction(ref(host, teamPath), (value) => value ? {
        ...value,
        phase: 'playing', status: 'active', roundNumber: roundNumber + 1,
        match: { ...value.match, matchId: nextMatchId, status: 'playing', phase: 'playing', roundNumber: roundNumber + 1, result: null, confirmations: { team_a: {}, team_b: {} }, revealEndTimestamp: null },
      } : value));
      const next = (await get(ref(host, teamPath))).val();
      for (const [id, client] of [['tb-host', host], ['tb-a2', a2], ['tb-b1', b1], ['tb-b2', b2]]) {
        const ownTeam = teams[id];
        const opponentTeam = ownTeam === 'team_a' ? 'team_b' : 'team_a';
        await assertSucceeds(set(ref(client, `teamBattlePrivateTargets/tb-candidate/${id}/${next.match.matchId}/target`), target(`tb-target-${roundNumber + 1}-${opponentTeam}`, id, opponentTeam, next.match.matchId, roundNumber + 1)));
      }
    }
  }
  assert.deepEqual(teamRoundIds.length, 3);
  await assertSucceeds(get(ref(b1, `teamBattlePrivateTargets/tb-candidate/tb-b1/${(await get(ref(host, teamPath))).val().match.matchId}/target`)));
  await assertFails(get(ref(b1, 'teamBattlePrivateTargets/tb-candidate/tb-host/tb-candidate_match_2/target')));
  await assertFails(runTransaction(ref(outsider, `${teamPath}/match/confirmations/team_b/tb-outsider`), (value) => value ?? confirmation('tb-outsider', 'team_b', 'tb-candidate_match_3', 3)));

  const tournamentHost = env.authenticatedContext('tr-host').database();
  const trPlayers = ['tr-host', 'tr-a', 'tr-b', 'tr-c'];
  const tournamentPath = 'tournamentRooms/tr-candidate';
  await assertSucceeds(runTransaction(ref(tournamentHost, tournamentPath), (current) => current ?? tournamentLobby('tr-candidate', 'tr-host')));
  await joinTournamentRoom(env.authenticatedContext('tr-a').database(), tournamentPath, 'tr-a', 'slot-2');
  await joinTournamentRoom(env.authenticatedContext('tr-b').database(), tournamentPath, 'tr-b', 'slot-3');
  await joinTournamentRoom(env.authenticatedContext('tr-c').database(), tournamentPath, 'tr-c', 'slot-4');
  await assertSucceeds(set(ref(tournamentHost, tournamentPath), tournamentState('tr-candidate', trPlayers, 'tr-host')));

  const tournamentClient = Object.fromEntries(trPlayers.map((id) => [id, env.authenticatedContext(id).database()]));
  const playMatch = async (matchId, matchPlayers, finish = false) => {
    for (const roundNumber of [1, 2, 3]) {
      const snapshot = (await get(ref(tournamentHost, tournamentPath))).val();
      const currentMatch = snapshot.matches[matchId];
      for (const id of matchPlayers) {
        await assertSucceeds(runTransaction(ref(tournamentClient[id], `${tournamentPath}/matches/${matchId}/guesses/${id}`), (value) => value ?? guess(id, matchPlayers.find((candidate) => candidate !== id), roundNumber)));
      }
      if (roundNumber < 3) {
        await assertSucceeds(runTransaction(ref(tournamentHost, tournamentPath), (value) => value ? {
          ...value,
          roundNumber,
          matches: { ...value.matches, [matchId]: { ...value.matches[matchId], status: 'playing', phase: 'playing', roundNumber: roundNumber + 1, guesses: {}, targets: {}, result: null } },
        } : value));
      } else if (finish) {
        const winnerId = matchPlayers[0];
        const loserId = matchPlayers[1];
        await assertSucceeds(runTransaction(ref(tournamentHost, tournamentPath), (value) => value ? {
          ...value,
          matches: { ...value.matches, [matchId]: { ...value.matches[matchId], status: 'finished', phase: 'results', roundNumber: 3, result: { winnerId, loserId, matchId, scores: currentMatch.scores || {}, guesses: currentMatch.guesses || {}, targets: {} }, revealEndTimestamp: null } },
        } : value));
      }
    }
  };
  await playMatch('semi_a', ['tr-host', 'tr-a'], true);
  await playMatch('semi_b', ['tr-b', 'tr-c'], true);
  await assertSucceeds(runTransaction(ref(tournamentHost, tournamentPath), (value) => value ? {
    ...value,
    phase: 'transition',
    transitionEndTimestamp: ts + 5000,
    matches: {
      ...value.matches,
      final: { ...value.matches.final, playerIds: ['tr-host', 'tr-b'], playerMap: { 'tr-host': true, 'tr-b': true }, scores: { 'tr-host': 0, 'tr-b': 0 }, roundNumber: 1 },
      consolation: { ...value.matches.consolation, playerIds: ['tr-a', 'tr-c'], playerMap: { 'tr-a': true, 'tr-c': true }, scores: { 'tr-a': 0, 'tr-c': 0 }, roundNumber: 1 },
    },
  } : value));
  await assertSucceeds(runTransaction(ref(tournamentHost, tournamentPath), (value) => value ? {
    ...value,
    phase: 'playing',
    matches: Object.fromEntries(Object.entries(value.matches).map(([id, match]) => ['final', 'consolation'].includes(id) ? [id, { ...match, status: 'playing', phase: 'playing', roundNumber: 1, guesses: {}, result: null }] : [id, match])),
  } : value));
  await playMatch('final', ['tr-host', 'tr-b'], true);
  await playMatch('consolation', ['tr-a', 'tr-c'], true);
  const completed = (await get(ref(tournamentHost, tournamentPath))).val();
  assert.equal(completed.matches.final.status, 'finished');
  assert.equal(completed.matches.consolation.status, 'finished');
  await assertSucceeds(runTransaction(ref(tournamentHost, tournamentPath), (value) => value ? ({ ...value, phase: 'results', status: 'finished', winnerId: 'tr-host', secondPlaceId: 'tr-b', thirdPlaceId: 'tr-a', fourthPlaceId: 'tr-c' }) : value));

  console.log(JSON.stringify({
    status: 'passed',
    candidate: 'database.rules.simplified-candidate.json',
    teamBattle: {
      joinAndTeamSeats: 'allowed',
      roundsOneToThree: 'allowed',
      hostRoundResolutionAndAdvance: 'allowed',
      nextRoundPrivateTargets: 'allowed',
      crossPlayerPrivateTargetRead: 'blocked',
      outsiderConfirmation: 'blocked',
    },
    tournament: {
      semifinalAThreeRounds: 'allowed',
      semifinalBThreeRounds: 'allowed',
      finalAndThirdPlaceThreeRounds: 'allowed',
      finalResultsPersistence: 'allowed',
    },
    note: 'Rules authorize valid state transitions; bracket assignment and winner calculations remain authoritative application logic.'
  }, null, 2));
} finally {
  await env.cleanup();
}
