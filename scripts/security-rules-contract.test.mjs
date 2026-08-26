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

assert.match(tournamentRoom['.read'], /players.*auth\.uid/);
assert.doesNotMatch(tournamentRoom['.read'], /^auth != null$/);
assert.match(teamRoom['.read'], /players.*auth\.uid/);
assert.doesNotMatch(teamRoom['.read'], /^auth != null$/);
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
