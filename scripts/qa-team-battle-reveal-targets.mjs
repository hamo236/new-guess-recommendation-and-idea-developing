import assert from 'node:assert/strict';
import { sanitizePublicState } from '../src/firebase/competitiveFirebase.js';
import {
  TEAM_IDS,
  createTeamBattleState,
  assignTeamTargets,
  confirmTeamRound,
  areAllRequiredTeamConfirmationsComplete,
  finishTeamRound,
} from '../src/modes/teamBattleEngine.js';
import { targetMapForTeams, targetSnapshotsForTeams } from '../src/modes/teamBattleTargetPlan.js';

const players = [1, 2, 3, 4].map((index) => ({ id: `p${index}`, name: `Player ${index}`, joinOrder: index }));
const roomSeed = 'QA-2V2-REVEAL:fixed';
const initial = createTeamBattleState({ teamRoomId: 'QA-2V2-REVEAL', players, category: 'sports', hostId: 'p1' });
const targets = targetMapForTeams('sports', initial.teams, { roomSeed, roundNumber: 1 });
let state = assignTeamTargets({ ...initial, createdAt: 'fixed' }, targets);

for (const [playerId, teamId] of [['p1', TEAM_IDS.A], ['p2', TEAM_IDS.A], ['p3', TEAM_IDS.B], ['p4', TEAM_IDS.B]]) {
  const target = targets[playerId];
  state = confirmTeamRound(state, playerId, 1000 + Number(playerId.slice(1)), {
    targetSnapshot: { id: target.id, targetId: target.targetId, name: target.name, image: target.image, teamId },
  });
}
assert.equal(areAllRequiredTeamConfirmationsComplete(state), true, 'both teams must complete their confirmation pair');

const completeSnapshots = targetSnapshotsForTeams('sports', state, { roomSeed, roundNumber: 1 });
assert.ok(completeSnapshots[TEAM_IDS.A]?.image, 'both-team snapshot helper must produce Team A image');
assert.ok(completeSnapshots[TEAM_IDS.B]?.image, 'both-team snapshot helper must produce Team B image');
const completeResult = finishTeamRound(state, TEAM_IDS.A, {
  winningTeamIds: [TEAM_IDS.A],
  targetSnapshots: completeSnapshots,
});
const publicResult = sanitizePublicState(completeResult);
const publicTargets = publicResult.match?.result?.targets || {};
assert.ok(publicTargets.p1?.image, 'public round result must retain Team A reveal image');
assert.ok(publicTargets.p3?.image, 'public round result must retain Team B reveal image');
assert.notEqual(publicTargets.p1.targetId, publicTargets.p3.targetId, 'the two team reveal images must remain distinct');

const playingPrivateState = sanitizePublicState({
  ...state,
  match: { ...state.match, status: 'playing', result: null },
});
assert.equal(playingPrivateState.match.targets, undefined, 'playing state must not expose per-player target map');
assert.equal(playingPrivateState.match.teamTargets, undefined, 'playing state must not expose team target map');

console.log('Team Battle reveal-target regression passed: both team images survive result projection while playing-state target privacy remains intact.');
