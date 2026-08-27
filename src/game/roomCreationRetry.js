const DEFAULT_MAX_ATTEMPTS = 10;

export function isRoomCreationCollision(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code === 'room-exists'
    || code === 'room/already-exists'
    || /room(?: code)? already exists/.test(message);
}

export async function createRoomWithCollisionRetry({
  create,
  generateCode,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}) {
  if (typeof create !== 'function') throw new TypeError('A room creation function is required.');
  if (typeof generateCode !== 'function') throw new TypeError('A room-code generator is required.');

  const attemptsLimit = Math.max(1, Math.floor(Number(maxAttempts) || DEFAULT_MAX_ATTEMPTS));
  let lastCollision;

  for (let attempt = 0; attempt < attemptsLimit; attempt += 1) {
    const code = generateCode();
    try {
      await create(code);
      return code;
    } catch (error) {
      if (!isRoomCreationCollision(error)) throw error;
      lastCollision = error;
    }
  }

  const exhausted = new Error('Could not create a unique room code after several attempts. Please try again.');
  exhausted.code = 'room-code-collision-exhausted';
  exhausted.cause = lastCollision;
  throw exhausted;
}

export { DEFAULT_MAX_ATTEMPTS as ROOM_CREATION_MAX_ATTEMPTS };
