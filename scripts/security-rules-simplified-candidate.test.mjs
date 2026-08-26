import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ref, set, get, runTransaction, onValue } from 'firebase/database';

const rulesPath = new URL('../database.rules.simplified-candidate.json', import.meta.url);
const rules = readFileSync(rulesPath, 'utf8');
JSON.parse(rules);

const testEnv = await initializeTestEnvironment({
  projectId: 'neon-guess-test-simplified-candidate',
  database: { host: '127.0.0.1', port: 9001, rules },
});
await testEnv.clearDatabase();

const roomPath = 'rooms/one-v-one-candidate';
const roundId = 'one-v-one-candidate:round:1';
const revealEndTimestamp = 1700000005000;

const player = (id, name, isHost, joinOrder) => ({
  id,
  name,
  avatar: `${id}.png`,
  isHost,
  connected: true,
  score: 0,
  joinOrder,
});

const target = (id, name) => ({
  id,
  name,
  category: 'Football',
  round: 1,
  roundId,
  targetReady: true,
});

const initialRoom = {
  matchId: 'one-v-one-candidate:match',
  hostId: 'host-1',
  status: 'lobby',
  phase: 'lobby',
  mode: '1v1',
  category: 'Football',
  round: 1,
  roundId: null,
  totalRounds: 3,
  currentTurnPlayerId: 'host-1',
  timerEndTimestamp: 0,
  createdAt: 1700000000000,
  joinSlots: {
    'slot-1': { playerId: 'host-1', joinOrder: 1, reservedAt: 1700000000000 },
    'slot-2': null,
    'slot-3': null,
    'slot-4': null,
  },
  players: { 'host-1': player('host-1', 'Host', true, 1) },
  usedTargetIds: [],
  scores: { 'host-1': 0 },
  messages: {},
  votes: {},
  roundResult: null,
  roundResults: {},
  bracket: null,
  playerAssignments: {},
  matchResults: {},
  standings: [],
};

const playingRoom = {
  ...initialRoom,
  status: 'playing',
  phase: 'playing',
  roundId,
  joinSlots: {
    ...initialRoom.joinSlots,
    'slot-2': { playerId: 'guest-2', joinOrder: 2, reservedAt: 1700000001000 },
  },
  players: {
    'host-1': initialRoom.players['host-1'],
    'guest-2': player('guest-2', 'Guest', false, 2),
  },
  scores: { 'host-1': 0, 'guest-2': 0 },
  usedTargetIds: ['target-a', 'target-b'],
  currentTurnPlayerId: 'host-1',
};

const confirmMessage = (id, confirmerId, winnerId, timestamp = 1700000002000) => ({
  id,
  type: 'guess_confirm',
  confirmerId,
  winnerId,
  playerId: confirmerId,
  playerName: confirmerId === 'host-1' ? 'Host' : 'Guest',
  timestamp,
});

const roundResult = {
  roundId,
  winnerId: 'guest-2',
  winnerName: 'Guest',
  confirmerId: 'host-1',
  guessedPlayerId: 'guest-2',
  pointsEarned: 1,
  message: 'Guest GUESSED CORRECTLY!',
  revealedTargets: {
    'host-1': target('target-b', 'Target B'),
    'guest-2': target('target-a', 'Target A'),
  },
  revealEndTimestamp,
};

const socialRoomPath = 'rooms/four-action-candidate';
const socialRoom = {
  ...playingRoom,
  matchId: 'four-action-candidate:match',
  mode: 'social',
  players: {
    'host-1': player('host-1', 'Host', true, 1),
    'p2': player('p2', 'Player 2', false, 2),
    'p3': player('p3', 'Player 3', false, 3),
    'p4': player('p4', 'Player 4', false, 4),
  },
  joinSlots: {
    'slot-1': { playerId: 'host-1', joinOrder: 1, reservedAt: 1700000000000 },
    'slot-2': { playerId: 'p2', joinOrder: 2, reservedAt: 1700000000000 },
    'slot-3': { playerId: 'p3', joinOrder: 3, reservedAt: 1700000000000 },
    'slot-4': { playerId: 'p4', joinOrder: 4, reservedAt: 1700000000000 },
  },
  bracket: {
    matches: {
      'match-a': {
        status: 'active',
        matchRound: 1,
        playerA: 'host-1',
        playerB: 'p4',
      },
    },
  },
  playerAssignments: {
    'host-1': { matchId: 'match-a', opponentPlayerId: 'p4' },
    p4: { matchId: 'match-a', opponentPlayerId: 'host-1' },
    p2: { matchId: 'match-b', opponentPlayerId: 'p3' },
    p3: { matchId: 'match-b', opponentPlayerId: 'p2' },
  },
};

try {
  const host = testEnv.authenticatedContext('host-1').database();
  const guest = testEnv.authenticatedContext('guest-2').database();
  const outsider = testEnv.authenticatedContext('outsider').database();
  const p4 = testEnv.authenticatedContext('p4').database();
  const p2 = testEnv.authenticatedContext('p2').database();
  const p3 = testEnv.authenticatedContext('p3').database();

  // Production-shaped creation and join boundary.
  await assertSucceeds(runTransaction(ref(host, roomPath), (current) => current ?? initialRoom));
  await assertSucceeds(runTransaction(ref(guest, `${roomPath}/joinSlots/slot-2`), (current) => current ?? {
    playerId: 'guest-2', joinOrder: 2, reservedAt: 1700000001000,
  }));
  await assertSucceeds(runTransaction(ref(guest, `${roomPath}/players/guest-2`), (current) => current ?? player('guest-2', 'Guest', false, 2)));
  await assertSucceeds(set(ref(guest, `${roomPath}/scores/guest-2`), 0));

  // The host moves the complete room into the real playing shape used by the 1v1 flow.
  await assertSucceeds(set(ref(host, roomPath), playingRoom));

  const transactionProbePath = 'rooms/one-v-one-transaction-probe';
  await assertSucceeds(set(ref(host, transactionProbePath), { ...initialRoom }));
  await assertSucceeds(set(ref(guest, `${transactionProbePath}/joinSlots/slot-2`), { playerId: 'guest-2', joinOrder: 2, reservedAt: 1700000001000 }));
  await assertSucceeds(set(ref(guest, `${transactionProbePath}/players/guest-2`), player('guest-2', 'Guest', false, 2)));
  await assertSucceeds(set(ref(guest, `${transactionProbePath}/scores/guest-2`), 0));
  await assertSucceeds(set(ref(host, transactionProbePath), playingRoom));
  const transactionProbeHost = testEnv.authenticatedContext('host-1').database();
  await assertSucceeds(runTransaction(ref(transactionProbeHost, transactionProbePath), (current) => current ? { ...current, phase: 'round_end' } : current));

  const messageTransactionPath = 'rooms/one-v-one-message-transaction-probe';
  await assertSucceeds(set(ref(host, messageTransactionPath), { ...initialRoom }));
  await assertSucceeds(set(ref(guest, `${messageTransactionPath}/joinSlots/slot-2`), { playerId: 'guest-2', joinOrder: 2, reservedAt: 1700000001000 }));
  await assertSucceeds(set(ref(guest, `${messageTransactionPath}/players/guest-2`), player('guest-2', 'Guest', false, 2)));
  await assertSucceeds(set(ref(guest, `${messageTransactionPath}/scores/guest-2`), 0));
  await assertSucceeds(set(ref(host, messageTransactionPath), playingRoom));
  await assertSucceeds(set(ref(guest, `${messageTransactionPath}/messages/confirm-guest`), confirmMessage('confirm-guest', 'guest-2', 'host-1')));
  const messageTransactionHost = testEnv.authenticatedContext('host-1').database();
  const messageBefore = (await get(ref(messageTransactionHost, messageTransactionPath))).val();
  assert.equal(messageBefore.phase, 'playing');
  assert.equal(messageBefore.messages['confirm-guest'].type, 'guess_confirm');
  assert.equal(messageBefore.messages['confirm-guest'].playerId, 'guest-2');
  await assertSucceeds(runTransaction(ref(messageTransactionHost, messageTransactionPath), (current) => ({ ...(current ?? messageBefore), phase: 'round_end', status: 'round_end' })));

  // Private target contract: the viewer can read only its displayTarget, never ownTarget.
  await assertSucceeds(set(ref(host, 'privateRooms/one-v-one-candidate/host-1/ownTarget'), target('target-a', 'Target A')));
  await assertSucceeds(set(ref(host, 'privateRooms/one-v-one-candidate/guest-2/ownTarget'), target('target-b', 'Target B')));
  await assertSucceeds(set(ref(host, 'privateRooms/one-v-one-candidate/host-1/displayTarget'), target('target-b', 'Target B')));
  await assertSucceeds(set(ref(host, 'privateRooms/one-v-one-candidate/guest-2/displayTarget'), target('target-a', 'Target A')));
  await assertSucceeds(get(ref(guest, 'privateRooms/one-v-one-candidate/guest-2/displayTarget')));
  await assertFails(get(ref(guest, 'privateRooms/one-v-one-candidate/guest-2/ownTarget')));
  await assertFails(get(ref(guest, 'privateRooms/one-v-one-candidate/host-1/displayTarget')));
  await assertFails(get(ref(outsider, 'privateRooms/one-v-one-candidate/guest-2/displayTarget')));

  const playingSnapshot = (await get(ref(guest, roomPath))).val();
  assert.equal(playingSnapshot.phase, 'playing');
  assert.equal(playingSnapshot.players['guest-2'].id, 'guest-2');

  // Both player directions use the same message relay while the room is playing.
  const normalChat = {
    id: 'chat-guest-1', playerId: 'guest-2', playerName: 'Guest',
    message: 'ready', timestamp: 1700000001400, type: 'chat',
  };
  await assertSucceeds(set(ref(guest, `${roomPath}/messages/${normalChat.id}`), normalChat));
  const hostMessage = confirmMessage('confirm-host-1', 'host-1', 'guest-2', 1700000001500);
  await assertSucceeds(set(ref(host, `${roomPath}/messages/${hostMessage.id}`), hostMessage));
  const guestMessage = confirmMessage('confirm-guest-1', 'guest-2', 'host-1');
  await assertSucceeds(set(ref(guest, `${roomPath}/messages/${guestMessage.id}`), guestMessage));
  // Same message key cannot be replayed or overwritten.
  await assertFails(set(ref(guest, `${roomPath}/messages/${guestMessage.id}`), { ...guestMessage, timestamp: 1700000003000 }));
  // A non-member cannot forge a confirmation for a real player.
  await assertFails(set(ref(outsider, `${roomPath}/messages/confirm-outsider`), confirmMessage('confirm-outsider', 'outsider', 'host-1')));
  // A player cannot confirm themself as the winner.
  await assertFails(set(ref(guest, `${roomPath}/messages/confirm-self`), confirmMessage('confirm-self', 'guest-2', 'guest-2')));

  // Exact host-side syncConfirmOpponentGuess-shaped root transaction.
  const resolutionHost = testEnv.authenticatedContext('host-1').database();
  const hostBeforeResolution = (await get(ref(resolutionHost, roomPath))).val();
  assert.equal(hostBeforeResolution.phase, 'playing');
  assert.equal(hostBeforeResolution.scores['guest-2'], 0);
  await new Promise((resolve) => {
    const unsubscribe = onValue(ref(resolutionHost, roomPath), () => {
      unsubscribe();
      resolve();
    }, { onlyOnce: true });
  });
  await assertSucceeds(runTransaction(ref(resolutionHost, roomPath), (current) => {
    const base = current ?? hostBeforeResolution;
    return {
      ...base,
      scores: { ...base.scores, 'guest-2': 1 },
      phase: 'round_end',
      status: 'round_end',
      roundResult,
      roundResults: { ...(base.roundResults || {}), [roundId]: roundResult },
      revealEndTimestamp,
      timerEndTimestamp: 0,
    };
  }));
  const resolved = (await get(ref(host, roomPath))).val();
  assert.equal(resolved.phase, 'round_end');
  assert.equal(resolved.scores['guest-2'], 1);
  assert.equal(resolved.roundResults[roundId].winnerId, 'guest-2');

  // A new confirmation after round_end is rejected by the candidate phase guard.
  const lateHostMessage = confirmMessage('confirm-host-late', 'host-1', 'guest-2', 1700000004000);
  await assertFails(set(ref(host, `${roomPath}/messages/${lateHostMessage.id}`), lateHostMessage), 'A confirmation after round end must not be accepted.');

  // Adjacent Four path: seed through host creation and authenticated joins, then enter playing.
  const socialLobby = {
    ...socialRoom,
    phase: 'lobby', status: 'lobby', roundId: null,
    players: { 'host-1': socialRoom.players['host-1'] },
    joinSlots: {
      'slot-1': socialRoom.joinSlots['slot-1'], 'slot-2': null,
      'slot-3': null, 'slot-4': null,
    },
    scores: { 'host-1': 0 }, bracket: null, playerAssignments: {},
  };
  await assertSucceeds(set(ref(host, socialRoomPath), socialLobby));
  for (const [client, slot, id] of [[p2, 'slot-2', 'p2'], [p3, 'slot-3', 'p3'], [p4, 'slot-4', 'p4']]) {
    await assertSucceeds(set(ref(client, `${socialRoomPath}/joinSlots/${slot}`), { playerId: id, joinOrder: Number(slot.slice(-1)), reservedAt: 1700000001000 }));
    await assertSucceeds(set(ref(client, `${socialRoomPath}/players/${id}`), socialRoom.players[id]));
    await assertSucceeds(set(ref(client, `${socialRoomPath}/scores/${id}`), 0));
  }
  await assertSucceeds(set(ref(host, socialRoomPath), socialRoom));
  const p4Action = {
    actionId: 'action-four-action-candidate:round:1_match-a_1_p4',
    actorUid: 'p4',
    type: 'confirm_guess',
    actorId: 'p4',
    targetPlayerId: 'host-1',
    opponentUid: 'host-1',
    matchId: 'match-a',
    matchRound: 1,
    roundId,
    createdAt: 1700000010000,
  };
  await assertSucceeds(set(ref(p4, `${socialRoomPath}/actions/${roundId}/match-a/1/p4`), p4Action));
  await assertFails(set(ref(p4, `${socialRoomPath}/actions/${roundId}/match-a/1/host-1`), { ...p4Action, actorId: 'host-1', actorUid: 'p4' }));
  await assertFails(set(ref(outsider, `${socialRoomPath}/actions/${roundId}/match-a/1/outsider`), { ...p4Action, actorId: 'outsider', actorUid: 'outsider' }));
  await assertFails(set(ref(p4, `${socialRoomPath}/actions/${roundId}/match-a/1/p4-wrong-target`), { ...p4Action, actionId: 'wrong-target', actorId: 'p4', actorUid: 'p4', targetPlayerId: 'p2' }));
  await assertFails(set(ref(p4, `${socialRoomPath}/actions/old-round/match-a/1/p4`), { ...p4Action, actionId: 'stale-round', roundId: 'old-round' }));

  console.log(JSON.stringify({
    status: 'passed',
    candidate: 'database.rules.simplified-candidate.json',
    oneVOne: {
      productionJoinShape: 'allowed',
      guestGuessConfirmMessage: 'allowed',
      duplicateMessageKey: 'blocked',
      outsiderForgery: 'blocked',
      selfWinner: 'blocked',
      hostResolutionTransaction: 'allowed',
      roundEndPersistence: 'verified',
      privateDisplayRead: 'allowed',
      privateOwnTargetRead: 'blocked',
      crossPlayerDisplayRead: 'blocked',
    },
    fourAdjacent: {
      exactMatchRoundAction: 'allowed',
      crossActor: 'blocked',
      outsider: 'blocked',
      wrongTarget: 'blocked',
      staleRound: 'blocked',
    },
    note: 'The current 1v1 message payload has no roundId, so stale-message rejection is not claimed by this Rules test.'
  }, null, 2));
} finally {
  await testEnv.cleanup();
}
