import assert from 'node:assert/strict';
import {
  TOURNAMENT_MATCH_IDS,
  TOURNAMENT_REVEAL_MS,
  createTournamentState,
  startMatch,
  recordMatchConfirmation,
  completeTournamentRound,
  advanceTournamentRound,
  finishMatch,
  startNextTournamentMatches,
  reconcileTournamentMatchScores,
} from '../src/modes/tournamentEngine.js';
import { MODE_PHASES, createModePlayer } from '../src/modes/modeTypes.js';

const players = ['p1', 'p2', 'p3', 'p4'].map((id, index) => createModePlayer({ id, name: `Player ${index + 1}`, isHost: index === 0 }));
const targetMap = (ids, round, matchId) => Object.fromEntries(ids.map((id, index) => [id, {
  id: `${matchId}-${id}-target-${round}`,
  name: `${id} target ${round}`,
  image: `/target-${matchId}-${id}-${round}.png`,
  playerId: id,
  targetId: `${matchId}-${id}-target-${round}`,
}]));

function confirmCorrectGuess(state, matchId, guesserId) {
  const match = state.matches[matchId];
  const confirmerId = match.playerIds.find((id) => id !== guesserId);
  const targetId = match.targets[guesserId].id;
  return recordMatchConfirmation(state, matchId, confirmerId, targetId, guesserId, true);
}

function resolveUnconfirmedPlayer(state, matchId) {
  const match = state.matches[matchId];
  const confirmerId = match.playerIds.find((id) => !match.guesses?.[id]);
  const guesserId = match.playerIds.find((id) => id !== confirmerId);
  return recordMatchConfirmation(state, matchId, confirmerId, '__timeout__', guesserId, false);
}

function finishRound(state, matchId, guesserId, round, expectedScores) {
  let next = state;
  const match = next.matches[matchId];
  if (round > 1) next = advanceTournamentRound(next, matchId, targetMap(match.playerIds, round, matchId));
  next = confirmCorrectGuess(next, matchId, guesserId);
  next = resolveUnconfirmedPlayer(next, matchId);
  assert.deepEqual(next.matches[matchId].scores, expectedScores, `${matchId} round ${round} must credit the actual guesser exactly once`);
  next = completeTournamentRound(next, matchId);
  assert.equal(next.matches[matchId].status, 'round_result');
  assert.ok(next.matches[matchId].revealEndTimestamp >= next.matches[matchId].result.completedAt + TOURNAMENT_REVEAL_MS - 5);
  return next;
}

function finishThreeRoundMatch(state, matchId, winnersByRound) {
  let next = state;
  const ids = next.matches[matchId].playerIds;
  const scores = Object.fromEntries(ids.map((id) => [id, 0]));
  winnersByRound.forEach((guesserId, index) => {
    scores[guesserId] += 1;
    next = finishRound(next, matchId, guesserId, index + 1, { ...scores });
  });
  const winnerId = scores[ids[0]] >= scores[ids[1]] ? ids[0] : ids[1];
  const playingMatch = { ...next.matches[matchId], status: 'playing', phase: MODE_PHASES.PLAYING };
  next = finishMatch({ ...next, matches: { ...next.matches, [matchId]: playingMatch } }, matchId, winnerId);
  assert.equal(next.matches[matchId].result.winnerId, winnerId);
  assert.equal(next.matches[matchId].scores[winnerId], 2, `${matchId} winner must have two round points`);
  assert.equal(next.matches[matchId].scores[ids.find((id) => id !== winnerId)], 1, `${matchId} loser must have one round point`);
  return next;
}

let malformedState = createTournamentState({ tournamentId: 't-malformed', roomId: '456', players, category: 'football', hostId: 'p1' });
malformedState = startMatch(malformedState, TOURNAMENT_MATCH_IDS.SEMI_A, targetMap(malformedState.matches.semi_a.playerIds, 1, TOURNAMENT_MATCH_IDS.SEMI_A));
malformedState = { ...malformedState, matches: { ...malformedState.matches, [TOURNAMENT_MATCH_IDS.SEMI_A]: { ...malformedState.matches[TOURNAMENT_MATCH_IDS.SEMI_A], guesses: { p1: { playerId: 'p1', confirmerId: 'p1', guesserId: 'p1', roundNumber: 1, confirmed: true, correct: true } } } } };
malformedState = reconcileTournamentMatchScores(malformedState, TOURNAMENT_MATCH_IDS.SEMI_A);
assert.deepEqual(malformedState.matches[TOURNAMENT_MATCH_IDS.SEMI_A].scores, { p1: 0, p2: 0 }, 'a malformed confirmer-self guesser identity must not redirect scoring');

let state = createTournamentState({ tournamentId: 't-confirmer', roomId: '123', players, category: 'football', hostId: 'p1' });
state = startMatch(state, TOURNAMENT_MATCH_IDS.SEMI_A, targetMap(state.matches.semi_a.playerIds, 1, TOURNAMENT_MATCH_IDS.SEMI_A));
state = startMatch(state, TOURNAMENT_MATCH_IDS.SEMI_B, targetMap(state.matches.semi_b.playerIds, 1, TOURNAMENT_MATCH_IDS.SEMI_B));

// In each call, the confirmer is the other player. The actual guesser must receive the point.
state = finishThreeRoundMatch(state, TOURNAMENT_MATCH_IDS.SEMI_A, ['p2', 'p2', 'p1']);
state = finishThreeRoundMatch(state, TOURNAMENT_MATCH_IDS.SEMI_B, ['p4', 'p4', 'p3']);
assert.deepEqual(state.matches.final.playerIds, ['p2', 'p4']);
assert.deepEqual(state.matches.consolation.playerIds, ['p1', 'p3']);

state = startNextTournamentMatches(state, {
  [TOURNAMENT_MATCH_IDS.FINAL]: targetMap(state.matches.final.playerIds, 1, TOURNAMENT_MATCH_IDS.FINAL),
  [TOURNAMENT_MATCH_IDS.CONSOLATION]: targetMap(state.matches.consolation.playerIds, 1, TOURNAMENT_MATCH_IDS.CONSOLATION),
});
state = finishThreeRoundMatch(state, TOURNAMENT_MATCH_IDS.FINAL, ['p4', 'p4', 'p2']);
state = finishThreeRoundMatch(state, TOURNAMENT_MATCH_IDS.CONSOLATION, ['p1', 'p1', 'p3']);

assert.equal(state.phase, MODE_PHASES.RESULTS);
assert.equal(state.status, 'finished');
assert.deepEqual([state.winnerId, state.secondPlaceId, state.thirdPlaceId, state.fourthPlaceId], ['p4', 'p2', 'p1', 'p3']);
for (const matchId of Object.values(TOURNAMENT_MATCH_IDS)) {
  const match = state.matches[matchId];
  if (match.playerIds.length !== 2) continue;
  for (const playerId of match.playerIds) {
    const guess = match.result.guesses[playerId];
    assert.equal(guess?.guesserId, playerId, `${matchId} result must expose the guess under the actual guesser`);
    assert.equal(guess?.confirmerId, match.playerIds.find((id) => id !== playerId), `${matchId} must retain the confirming player separately`);
  }
}
assert.equal(state.playerStats.p2.correctGuesses, 3);
assert.equal(state.playerStats.p4.correctGuesses, 4);
assert.equal(state.playerStats.p1.correctGuesses, 3);
assert.equal(state.playerStats.p3.correctGuesses, 2);

console.log('tournament-confirmer-score: PASS');
console.log('Four confirmer actions credit the actual guesser across both semifinals, Final, and Third Place without duplicate round points.');
