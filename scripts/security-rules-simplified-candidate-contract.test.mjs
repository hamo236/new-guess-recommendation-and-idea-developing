import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync(new URL('../database.rules.simplified-candidate.json', import.meta.url), 'utf8')).rules;
const socialRoom = rules.rooms.$roomCode;
const socialMessages = socialRoom.messages.$msgId;
const socialActions = socialRoom.actions.$roundId.$matchId.$matchRound.$actorId;
const privatePlayer = rules.privateRooms.$roomCode.$uid;
const ownTarget = privatePlayer.ownTarget;
const displayTarget = privatePlayer.displayTarget;

assert.match(socialRoom['.read'], /!data\.exists\(\)/, 'Existing classic rooms must allow lobby discovery and member reads only.');
assert.match(socialRoom['.write'], /hostId.*auth\.uid/, 'Existing classic room mutations must be host-authorized.');
assert.match(socialRoom['.write'], /!data\.exists\(\)/, 'Classic room creation must require a fresh room node.');
assert.ok(socialRoom.joinSlots?.$slotId, 'Classic joinSlots boundary is required.');
assert.ok(socialRoom.players?.$uid, 'Classic player boundary is required.');
assert.match(socialRoom.scores.$uid['.write'], /auth\.uid === \$uid/, 'Players may initialize only their own score.');
assert.match(socialRoom.scores.$uid['.write'], /newData\.val\(\) === 0/, 'Score initialization must start at zero.');

assert.match(socialMessages['.write'], /!data\.exists\(\)/, 'Messages must be append-only.');
assert.match(socialMessages['.write'], /playerId.*auth\.uid/, 'A message must be authored by the authenticated player.');
assert.match(socialMessages['.write'], /phase.*playing/, 'Guess-confirm messages must be limited to active play.');
assert.match(socialMessages['.validate'], /data\.exists\(\)/, 'Existing messages must remain immutable during host root transactions.');
assert.match(socialMessages['.validate'], /confirmerId/, 'Guess-confirm payload shape must be validated.');
assert.match(socialMessages['.validate'], /winnerId/, 'Guess-confirm winner identity must be validated.');

assert.equal(ownTarget['.read'], undefined, 'ownTarget must never be directly readable by a client.');
assert.match(ownTarget['.write'], /hostId/, 'Only the host may write hidden assigned targets.');
assert.match(displayTarget['.read'], /auth\.uid === \$uid/, 'Display targets must be viewer-scoped.');
assert.match(displayTarget['.write'], /hostId/, 'Only the host may publish display targets.');
assert.ok(socialActions, 'Four action path must include roundId, matchId, matchRound, and actorId.');
assert.match(socialActions['.write'], /auth\.uid === \$actorId/, 'Four actions must be actor-authenticated.');
assert.match(socialActions['.write'], /opponentPlayerId/, 'Four actions must match the assigned opponent.');
assert.match(socialActions['.write'], /roundId/, 'Four actions must match the active round.');

console.log('Candidate Rules static contract passed: host boundary, 1v1 relay, target privacy, and Four action nesting are structurally covered.');
