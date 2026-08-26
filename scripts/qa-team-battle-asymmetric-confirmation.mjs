import assert from 'node:assert/strict';
import {
  TEAM_IDS,
  createTeamBattleState,
  assignTeamTargets,
  confirmTeamRound,
  areAllRequiredTeamConfirmationsComplete,
  hasResolvableTeamConfirmation,
  getCompletedConfirmationTeams,
  finishTeamRound,
} from '../src/modes/teamBattleEngine.js';

const players = [1, 2, 3, 4].map((index) => ({ id: `p${index}`, name: `Player ${index}`, joinOrder: index }));
const target = (id, teamId) => ({ id, targetId: id, name: id.toUpperCase(), image: `${id}.png`, teamId });
const targets = {
  p1: target('target-a', TEAM_IDS.A),
  p2: target('target-a', TEAM_IDS.A),
  p3: target('target-b', TEAM_IDS.B),
  p4: target('target-b', TEAM_IDS.B),
};

const initial = createTeamBattleState({ teamRoomId: 'QA-ASYMMETRIC', players, category: 'sports', hostId: 'p1' });
const state = assignTeamTargets(initial, targets);
const confirmation = (playerId, teamId, timestamp) => ({ playerId, teamId, matchId: state.match.matchId, roundNumber: state.roundNumber, confirmedAt: timestamp, targetSnapshot: targets[playerId] });

// Reported online case: A1 confirms B, while B1 and B2 confirm A.
// Model the merged persisted state directly because the old local toggle gate
// rejects the second team after the first team becomes required.
const asymmetric = { ...state, match: { ...state.match, confirmationTeamId: TEAM_IDS.A, confirmationTeamIds: [TEAM_IDS.A, TEAM_IDS.B], confirmations: {
  [TEAM_IDS.A]: { p1: confirmation('p1', TEAM_IDS.A, 1000) },
  [TEAM_IDS.B]: { p3: confirmation('p3', TEAM_IDS.B, 1001), p4: confirmation('p4', TEAM_IDS.B, 1002) },
} } };
assert.equal(asymmetric.match.confirmations[TEAM_IDS.A].p1.roundNumber, 1);
assert.equal(Object.keys(asymmetric.match.confirmations[TEAM_IDS.B]).length, 2);
assert.equal(areAllRequiredTeamConfirmationsComplete(asymmetric), false, 'the legacy all-required predicate should still report the other team as pending');
assert.deepEqual([...asymmetric.match.confirmationTeamIds].filter((teamId) => hasResolvableTeamConfirmation({ ...asymmetric, match: { ...asymmetric.match, confirmationTeamIds: [teamId] } })), [TEAM_IDS.A, TEAM_IDS.B]);
assert.equal(hasResolvableTeamConfirmation(asymmetric), true, 'a complete confirmation pair must resolve despite one pending confirmation on the other team');
assert.deepEqual(getCompletedConfirmationTeams(asymmetric), [TEAM_IDS.B], 'only Team B is complete in the reported 1-plus-2 case');
const result = finishTeamRound(asymmetric, TEAM_IDS.A, {
  guesses: asymmetric.match.guesses,
  winningTeamIds: [TEAM_IDS.A],
  targetSnapshots: { [TEAM_IDS.A]: targets.p1, [TEAM_IDS.B]: targets.p3 },
});
assert.equal(result.status, 'round_result');
assert.equal(result.teams[TEAM_IDS.A].score, 1);
assert.equal(result.teams[TEAM_IDS.B].score, 0);

// Reverse direction: A1+A2 complete while B1 remains pending; Team B gets the point.
const reverse = { ...state, match: { ...state.match, confirmationTeamId: TEAM_IDS.B, confirmationTeamIds: [TEAM_IDS.B, TEAM_IDS.A], confirmations: {
  [TEAM_IDS.A]: { p1: confirmation('p1', TEAM_IDS.A, 1100), p2: confirmation('p2', TEAM_IDS.A, 1101) },
  [TEAM_IDS.B]: { p3: confirmation('p3', TEAM_IDS.B, 1102) },
} } };
assert.equal(hasResolvableTeamConfirmation(reverse), true);
assert.deepEqual(getCompletedConfirmationTeams(reverse), [TEAM_IDS.A]);
const reverseResult = finishTeamRound(reverse, TEAM_IDS.B, {
  guesses: reverse.match.guesses,
  winningTeamIds: [TEAM_IDS.B],
  targetSnapshots: { [TEAM_IDS.A]: targets.p1, [TEAM_IDS.B]: targets.p3 },
});
assert.equal(reverseResult.status, 'round_result');
assert.equal(reverseResult.teams[TEAM_IDS.A].score, 0);
assert.equal(reverseResult.teams[TEAM_IDS.B].score, 1);

// An incomplete single confirmation must remain cancellable before any pair completes.
let cancellable = assignTeamTargets(initial, targets);
cancellable = confirmTeamRound(cancellable, 'p1', 2000, { targetSnapshot: targets.p1 });
assert.equal(Object.keys(cancellable.match.confirmations[TEAM_IDS.A]).length, 1);
cancellable = confirmTeamRound(cancellable, 'p1', 2001, { targetSnapshot: targets.p1 });
assert.equal(Object.keys(cancellable.match.confirmations[TEAM_IDS.A]).length, 0);
assert.equal(areAllRequiredTeamConfirmationsComplete(cancellable), false);
assert.equal(hasResolvableTeamConfirmation(cancellable), false);

console.log('2v2 asymmetric confirmation QA passed: one pending confirmation is non-blocking, either complete pair resolves and scores the opposing team, and incomplete confirmations can be cancelled.');
