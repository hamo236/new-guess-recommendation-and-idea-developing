import assert from 'node:assert/strict';
import {
  ROOM_TTL_MS,
  createStaleRoomError,
  getRoomActivityTimestamp,
  hasConnectedPlayers,
  isStaleRoom,
  staleRoomPolicy,
} from '../src/game/staleRoomPolicy.js';

const now = 2_000_000_000_000;
const staleLobby = { status: 'lobby', phase: 'lobby', updatedAt: now - ROOM_TTL_MS.lobby - 1, players: { host: { connected: false } } };
const activeLobby = { ...staleLobby, players: { host: { connected: true } } };
const activeMatch = { status: 'playing', phase: 'playing', updatedAt: now - (ROOM_TTL_MS.lobby * 10), players: {} };
const freshLobby = { status: 'lobby', phase: 'lobby', updatedAt: now - ROOM_TTL_MS.lobby + 1, players: {} };
const staleFinished = { status: 'finished', phase: 'finished', updatedAt: now - ROOM_TTL_MS.finished - 1, players: {} };

assert.equal(hasConnectedPlayers(activeLobby), true);
assert.equal(hasConnectedPlayers(staleLobby), false);
assert.equal(isStaleRoom(staleLobby, now), true);
assert.equal(isStaleRoom(activeLobby, now), false, 'Connected players protect the room from stale handling.');
assert.equal(isStaleRoom(activeMatch, now), false, 'Active gameplay is never stale-reaped by this client policy.');
assert.equal(isStaleRoom(freshLobby, now), false);
assert.equal(isStaleRoom(staleFinished, now), true);
assert.equal(getRoomActivityTimestamp({ createdAt: 42 }), 42);
assert.equal(getRoomActivityTimestamp({ updatedAt: 84, createdAt: 42 }), 84);
assert.equal(createStaleRoomError().code, 'room/stale');
assert.equal(staleRoomPolicy.hardDeletion, false);

console.log(JSON.stringify({
  status: 'passed',
  policy: 'free-ttl-protection',
  lobbyTtlHours: ROOM_TTL_MS.lobby / (60 * 60 * 1000),
  finishedTtlDays: ROOM_TTL_MS.finished / (24 * 60 * 60 * 1000),
  activeGameplayDeletion: false,
  hardDeletion: false,
}, null, 2));
