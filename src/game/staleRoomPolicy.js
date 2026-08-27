export const ROOM_TTL_MS = Object.freeze({
  lobby: 24 * 60 * 60 * 1000,
  results: 7 * 24 * 60 * 60 * 1000,
  finished: 7 * 24 * 60 * 60 * 1000,
});

const ACTIVE_PHASES = new Set(['playing', 'preview', 'reveal', 'round_result']);

export function getRoomActivityTimestamp(room) {
  return Number(room?.updatedAt || room?.createdAt || 0);
}

export function hasConnectedPlayers(room) {
  return Object.values(room?.players || {}).some((player) => player?.connected === true);
}

export function isStaleRoom(room, now = Date.now()) {
  if (!room || hasConnectedPlayers(room)) return false;
  if (ACTIVE_PHASES.has(room.phase) || room.status === 'playing') return false;
  const ttl = ROOM_TTL_MS[room.phase] || ROOM_TTL_MS[room.status] || ROOM_TTL_MS.lobby;
  const activityTimestamp = getRoomActivityTimestamp(room);
  return activityTimestamp > 0 && now - activityTimestamp >= ttl;
}

export function createStaleRoomError() {
  const error = new Error('This room has expired because it has been inactive for too long. Please create a new room.');
  error.code = 'room/stale';
  return error;
}

export function clearExpiredRoomSession(storage, storageKey) {
  if (!storage || !storageKey) return;
  try {
    storage.removeItem(storageKey);
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

export const staleRoomPolicy = Object.freeze({
  roomTtlMs: ROOM_TTL_MS,
  activePhases: [...ACTIVE_PHASES],
  hardDeletion: false,
});

export default staleRoomPolicy;

/**
 * This module intentionally does not delete RTDB data. A client cannot be a
 * trusted global reaper. It only rejects stale, unoccupied rooms and clears
 * the local recovery session when the caller handles the policy error.
 */
