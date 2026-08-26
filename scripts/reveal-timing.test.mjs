import assert from 'node:assert/strict';
import { getStableRevealDeadline, REVEAL_DISPLAY_DURATION_MS } from '../src/game/revealTiming.js';

const receivedAt = 1_000_000;
const duration = REVEAL_DISPLAY_DURATION_MS;
assert.equal(duration, 5000);
assert.equal(getStableRevealDeadline(receivedAt + duration, receivedAt), receivedAt + duration);
assert.equal(getStableRevealDeadline(receivedAt + 1000, receivedAt), receivedAt + duration);
assert.equal(getStableRevealDeadline(receivedAt - 1000, receivedAt), receivedAt + duration);
assert.equal(getStableRevealDeadline(0, receivedAt), 0);
assert.equal(getStableRevealDeadline(null, receivedAt), 0);
console.log('Reveal timing regression passed: every valid round-result snapshot has at least 5000ms of reveal visibility.');
