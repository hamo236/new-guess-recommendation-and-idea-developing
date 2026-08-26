import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules;
const tournamentRoom = rules.tournamentRooms.$roomId;
const teamRoom = rules.teamRooms.$roomId;
const tournamentPrivate = rules.tournamentPrivateTargets.$roomId.$uid.$matchId.target;
const teamPrivate = rules.teamBattlePrivateTargets.$roomId.$uid.$matchId.target;
const isolatedPrivate = rules.privateRooms.$roomCode.$uid;
const isolatedOwnTarget = isolatedPrivate.ownTarget;
const isolatedDisplayTarget = isolatedPrivate.displayTarget;
const socialRoom = rules.rooms.$roomCode;
const socialScores = socialRoom.scores;
const socialScoreByUid = socialScores.$uid;

assert.match(tournamentRoom['.read'], /!data\.exists\(\)/, 'Tournament creation transactions need a fresh-node read grant');
assert.match(tournamentRoom['.read'], /players.*auth\.uid/);
assert.doesNotMatch(tournamentRoom['.read'], /^auth != null$/);
assert.match(teamRoom['.read'], /!data\.exists\(\)/, 'Team creation transactions need a fresh-node read grant');
assert.match(teamRoom['.read'], /players.*auth\.uid/);
assert.doesNotMatch(teamRoom['.read'], /^auth != null$/);
assert.match(socialRoom['.read'], /!data\.exists\(\)/, 'Social creation transactions need a fresh-node read grant');
assert.match(socialRoom['.write'], /hostId.*auth\.uid/, 'Existing social room mutations must be host-authorized');
if (socialRoom.phase?.['.write']) {
  assert.match(socialRoom.phase['.write'], /hostId.*auth\.uid/, 'Only the host may change the social room phase');
}
for (const field of ['revealEndTimestamp', 'transitionStartedAt', 'transitionEndsAt']) {
  if (socialRoom[field]?.['.write']) {
    assert.match(socialRoom[field]['.write'], /hostId.*auth\.uid/, `${field} must be host-authorized`);
  }
  assert.match(socialRoom[field]['.validate'], /newData\.isNumber\(\)/, `${field} must remain numeric`);
}
if (socialScores['.write']) {
  assert.match(socialScores['.write'], /hostId.*auth\.uid/, 'Only the host may replace the aggregate social scores map');
  assert.doesNotMatch(socialScores['.write'], /newData\.child\(auth\.uid\)/, 'Aggregate scores must not contain the contradictory non-host join branch');
}
if (socialScoreByUid['.write']) {
  assert.match(socialScoreByUid['.write'], /auth\.uid === \$uid/, 'A joining player may initialize only their own score');
  assert.match(socialScoreByUid['.write'], /newData\.val\(\) === 0/, 'A joining player may initialize only a zero score');
  assert.match(socialScoreByUid['.write'], /players.*\$uid/, 'Score initialization requires an existing room player record');
}
assert.match(tournamentPrivate['.read'], /auth\.uid === \$uid/);
assert.match(tournamentPrivate['.write'], /hostId/);
assert.match(tournamentPrivate['.write'], /targetReady/);
assert.match(teamPrivate['.read'], /auth\.uid === \$uid/);
assert.match(teamPrivate['.write'], /targetOwnerTeamId/);
assert.ok(rules.tournamentRooms.$roomId.private === undefined, 'Tournament targets must not be nested under public room state');
assert.ok(rules.teamRooms.$roomId.private === undefined, 'Team targets must not be nested under public room state');
assert.equal(isolatedPrivate['.read'], undefined, 'privateRooms player nodes must not grant ancestor reads');
assert.equal(isolatedOwnTarget['.read'], undefined, 'ownTarget must never be client-readable');
assert.match(isolatedOwnTarget['.write'], /hostId/);
assert.match(isolatedOwnTarget['.write'], /players/);
assert.match(isolatedOwnTarget['.validate'], /targetReady/);
assert.match(isolatedDisplayTarget['.read'], /auth\.uid === \$uid/);
assert.match(isolatedDisplayTarget['.write'], /hostId/);
assert.match(isolatedDisplayTarget['.validate'], /targetReady/);
assert.ok(rules.rooms.$roomCode.private === undefined, '1v1 targets must not be nested under public room state');

console.log('Security rules contract passed: private targets are structurally isolated and competitive reads are not globally public.');
