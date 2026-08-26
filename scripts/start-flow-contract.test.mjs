import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/context/GameStateContext.jsx', import.meta.url), 'utf8');
const startBlock = source.match(/startGame:\s*useCallback\(async \(\) => \{([\s\S]*?)\n\s*\}, \[state, isHost, isFirebaseConfigured\]\)/)?.[1];

assert.ok(startBlock, 'startGame callback must remain present');
const syncIndex = startBlock.indexOf('await syncEnterPreview');
const dispatchIndex = startBlock.indexOf("dispatch({ type: A.START_GAME })");
assert.notEqual(syncIndex, -1, 'Firebase Start preview synchronization must remain present');
assert.notEqual(dispatchIndex, -1, 'START_GAME local transition must remain present');
assert.ok(syncIndex < dispatchIndex, 'Firebase confirmation must precede the local START_GAME transition');

console.log('Start flow contract passed: local preview begins only after Firebase confirmation.');
