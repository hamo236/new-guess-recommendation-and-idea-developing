import assert from 'node:assert/strict';
import { createRoomWithCollisionRetry } from '../src/game/roomCreationRetry.js';

const generatedCodes = ['101', '202', '303'];
const attemptedCodes = [];
let collisionCount = 0;
const createdCode = await createRoomWithCollisionRetry({
  generateCode: () => generatedCodes[attemptedCodes.length],
  create: async (code) => {
    attemptedCodes.push(code);
    if (collisionCount < 2) {
      collisionCount += 1;
      throw new Error('Room code already exists. Please try again.');
    }
  },
});
assert.equal(createdCode, '303');
assert.deepEqual(attemptedCodes, ['101', '202', '303']);

let nonCollisionAttempts = 0;
await assert.rejects(
  () => createRoomWithCollisionRetry({
    generateCode: () => '404',
    create: async () => {
      nonCollisionAttempts += 1;
      throw new Error('Permission denied.');
    },
  }),
  (error) => error.message === 'Permission denied.'
);
assert.equal(nonCollisionAttempts, 1, 'Non-collision failures must not be retried.');

let exhaustedAttempts = 0;
await assert.rejects(
  () => createRoomWithCollisionRetry({
    generateCode: () => String(500 + exhaustedAttempts),
    maxAttempts: 3,
    create: async () => {
      exhaustedAttempts += 1;
      throw new Error('Room already exists.');
    },
  }),
  (error) => error.code === 'room-code-collision-exhausted'
    && error.message.includes('several attempts')
);
assert.equal(exhaustedAttempts, 3, 'Collision retry must stop at the configured bound.');

console.log('Room-creation retry tests passed: collision recovery, non-collision fail-fast, and bounded exhaustion.');
