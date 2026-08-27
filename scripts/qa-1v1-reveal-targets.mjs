import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  confirmOpponentGuessed,
  GAME_MODES,
  GAME_PHASES,
  REVEAL_DURATION_MS,
} from '../src/game/gameEngine.js';

const contextSource = readFileSync(new URL('../src/context/GameStateContext.jsx', import.meta.url), 'utf8');
const displayReducerBlock = contextSource.match(
  /case A\.FB_DISPLAY_TARGET_RECEIVED: \{([\s\S]*?)\n\s*case A\.SET_MY_PLAYER_ID:/,
)?.[1];
assert.ok(displayReducerBlock, '1v1 display-target reducer branch must remain present');
assert.match(displayReducerBlock, /displayTargets:/, 'display-target events must continue populating displayTargets');
assert.doesNotMatch(
  displayReducerBlock,
  /roundTargets:/,
  'viewer-scoped display targets must not populate the owner-scoped round snapshot',
);
assert.match(
  displayReducerBlock,
  /if \(!target\)[\s\S]*delete nextDisplayTargets\[action\.payload\.playerId\]/,
  'cleared display-target events must remove stale viewer-scoped targets',
);
assert.match(
  contextSource,
  /displayTargets: state\.mode === GAME_MODES\.ONE_V_ONE && clearRoundSnapshot \? \{\} : state\.displayTargets/,
  'only 1v1 room round transitions may clear stale viewer-scoped targets',
);
const gameSyncSource = readFileSync(new URL('../src/firebase/gameSync.js', import.meta.url), 'utf8');
assert.match(
  gameSyncSource,
  /onTarget\(snap\.exists\(\) \? snap\.val\(\) : null\)/,
  'private display-target subscriptions must emit null when their node is cleared',
);

const targetA = { id: 'target-a', name: 'Target A', image: '/a.png', category: 'people' };
const targetB = { id: 'target-b', name: 'Target B', image: '/b.png', category: 'people' };
const before = Date.now();
const state = {
  mode: GAME_MODES.ONE_V_ONE,
  phase: GAME_PHASES.PLAYING,
  round: 2,
  roundId: 'room-123:round:2',
  players: [
    { id: 'player-a', name: 'Player A' },
    { id: 'player-b', name: 'Player B' },
  ],
  scores: { 'player-a': 0, 'player-b': 0 },
  roundResult: null,
  targets: {
    'player-a': targetA,
    'player-b': targetB,
  },
  roundTargets: {
    'player-a': targetA,
    'player-b': targetB,
  },
  displayTargets: {
    'player-a': targetB,
    'player-b': targetA,
  },
};

const nextState = confirmOpponentGuessed(state, {
  confirmerId: 'player-a',
  guessedPlayerId: 'player-b',
});

assert.equal(nextState.phase, GAME_PHASES.ROUND_END, '1v1 confirmation must enter the existing round-end reveal phase');
assert.equal(nextState.roundResult.revealedTargets['player-a'].id, targetB.id, 'Player A reveal must show the target Player A was trying to guess');
assert.equal(nextState.roundResult.revealedTargets['player-b'].id, targetA.id, 'Player B reveal must show the target Player B was trying to guess');
assert.equal(nextState.roundResult.winnerId, 'player-b', 'Reveal regression must not change the confirmed winner');
assert.equal(nextState.scores['player-b'], 1, 'Reveal regression must not change existing 1v1 scoring');
assert.ok(
  nextState.roundResult.revealEndTimestamp >= before + REVEAL_DURATION_MS - 50
    && nextState.roundResult.revealEndTimestamp <= Date.now() + REVEAL_DURATION_MS + 50,
  'Reveal duration must remain the existing five seconds',
);

const fallbackState = {
  ...state,
  roundTargets: {},
};
const fallbackResult = confirmOpponentGuessed(fallbackState, {
  confirmerId: 'player-b',
  guessedPlayerId: 'player-a',
});
assert.equal(fallbackResult.roundResult.revealedTargets['player-a'].id, targetB.id, 'Fallback owner targets must preserve Player A reveal mapping');
assert.equal(fallbackResult.roundResult.revealedTargets['player-b'].id, targetA.id, 'Fallback owner targets must preserve Player B reveal mapping');

console.log('1v1 reveal target regression passed: owner-scoped snapshots remain authoritative and five-second timing is unchanged.');
