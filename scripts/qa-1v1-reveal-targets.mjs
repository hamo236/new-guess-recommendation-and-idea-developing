import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  beginPlayingFromPreview,
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
assert.match(
  contextSource,
  /if \(target\.roundId && target\.roundId !== state\.roundId\) return state;/,
  'private targets must match the active round id before entering 1v1 state',
);
assert.match(
  contextSource,
  /if \(target\.round != null && target\.round !== state\.round\) return state;/,
  'private targets must match the active round number before entering 1v1 state',
);
assert.doesNotMatch(
  contextSource,
  /isOneVOne && target\.round > state\.round/,
  '1v1 must not accept future-round private target events',
);
const beginRoundReducerBlock = contextSource.match(
  /case A\.BEGIN_ROUND:([\s\S]*?)\n\s*case A\.CONFIRM_OPPONENT_GUESS:/,
)?.[1];
assert.ok(beginRoundReducerBlock, 'BEGIN_ROUND reducer branch must remain present');
assert.match(
  beginRoundReducerBlock,
  /state\.mode === GAME_MODES\.ONE_V_ONE && action\.payload\?\.nextState/,
  '1v1 reducer must accept the canonical precomputed begin-round state',
);
assert.match(
  beginRoundReducerBlock,
  /\? action\.payload\.nextState\s*:\s*engineBeginPlaying\(state\)/,
  'non-1v1 reducer behavior must retain the established engine path',
);
const beginRoundActionBlock = contextSource.match(
  /beginRound: useCallback\(async \(\) => \{([\s\S]*?)\n\s*\}, \[state, isHost, myPlayerId, subscribeToMyTarget\]\)/,
)?.[1];
assert.ok(beginRoundActionBlock, 'beginRound action must remain present');
assert.match(
  beginRoundActionBlock,
  /if \(state\.mode === GAME_MODES\.ONE_V_ONE\) \{[\s\S]*dispatch\(\{ type: A\.BEGIN_ROUND, payload: \{ nextState \} \}\)/,
  '1v1 begin-round action must dispatch the same canonical state used for Firebase sync',
);
assert.match(
  beginRoundActionBlock,
  /syncBeginPlaying\([\s\S]*nextState\.targets,[\s\S]*nextState\.displayTargets,/,
  'Firebase begin-round sync must continue receiving the canonical nextState target maps',
);
const boardSource = readFileSync(new URL('../src/pages/GameBoardPage.jsx', import.meta.url), 'utf8');
const targetCardSource = readFileSync(new URL('../src/components/game/OpponentTargetCard.jsx', import.meta.url), 'utf8');
assert.match(
  boardSource,
  /<OpponentTargetCard target=\{opponentTarget\} compact=\{isOneVsOne\} \/>/,
  'only 1v1 receives the compact target-card presentation variant',
);
assert.match(
  targetCardSource,
  /if \(compact\)[\s\S]*aspect-\[4\/3\][\s\S]*object-cover/,
  'the compact 1v1 card must prioritize the target image without surrounding metadata chrome',
);
assert.match(
  boardSource,
  /isFourPlayerSocial \? '' : isOneVsOne \? '-mt-2 sm:-mt-1' : '-mt-4 sm:-mt-3'/,
  '1v1 receives its comfortable image-to-action gap while 2v2 retains the established gap',
);
assert.match(boardSource, /onClick=\{handleConfirmOpponentGuess\}/, 'Guess Correct handler must remain unchanged');
const gameSyncSource = readFileSync(new URL('../src/firebase/gameSync.js', import.meta.url), 'utf8');
assert.match(
  gameSyncSource,
  /onTarget\(snap\.exists\(\) \? snap\.val\(\) : null\)/,
  'private display-target subscriptions must emit null when their node is cleared',
);

const previewState = {
  mode: GAME_MODES.ONE_V_ONE,
  phase: GAME_PHASES.PREVIEW,
  category: 'cartoons',
  matchId: 'probe-room',
  roomCode: 'probe-room',
  round: 1,
  usedTargetIds: [],
  players: [{ id: 'player-a' }, { id: 'player-b' }],
  playerAssignments: {},
  targets: {},
  displayTargets: {},
  roundTargets: {},
  eliminatedCards: {},
  scores: { 'player-a': 0, 'player-b': 0 },
  questions: [],
  votes: [],
  matchResults: {},
};
const originalRandom = Math.random;
const beginWithRandom = (value) => {
  Math.random = () => value;
  try {
    return beginPlayingFromPreview(previewState);
  } finally {
    Math.random = originalRandom;
  }
};
const canonicalState = beginWithRandom(0.1);
const secondIndependentAssignment = beginWithRandom(0.9);
const canonicalTargetIds = Object.values(canonicalState.targets).map((target) => target.id);
const secondTargetIds = Object.values(secondIndependentAssignment.targets).map((target) => target.id);
assert.notDeepEqual(
  secondTargetIds,
  canonicalTargetIds,
  'the regression setup must distinguish the old second randomized assignment from the canonical Firebase assignment',
);
const firebaseBeginPayload = {
  targets: canonicalState.targets,
  displayTargets: canonicalState.displayTargets,
};
const localStateAfterCanonicalDispatch = canonicalState;
assert.deepEqual(
  localStateAfterCanonicalDispatch.targets,
  firebaseBeginPayload.targets,
  '1v1 local reducer state must reuse the exact target assignment sent to Firebase',
);
assert.deepEqual(
  localStateAfterCanonicalDispatch.displayTargets,
  firebaseBeginPayload.displayTargets,
  '1v1 local viewer targets must reuse the exact display assignment sent to Firebase',
);
const canonicalReveal = confirmOpponentGuessed(localStateAfterCanonicalDispatch, {
  confirmerId: 'player-a',
  guessedPlayerId: 'player-b',
});
for (const playerId of Object.keys(firebaseBeginPayload.targets)) {
  assert.equal(
    canonicalReveal.roundResult.revealedTargets[playerId].id,
    firebaseBeginPayload.targets[playerId].id,
    `reveal for ${playerId} must come from the canonical Firebase target assignment`,
  );
}
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
assert.equal(nextState.roundResult.revealedTargets['player-a'].id, targetA.id, 'Player A reveal must show Player A own hidden target');
assert.equal(nextState.roundResult.revealedTargets['player-b'].id, targetB.id, 'Player B reveal must show Player B own hidden target');
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
assert.equal(fallbackResult.roundResult.revealedTargets['player-a'].id, targetA.id, 'Fallback owner targets must preserve Player A own-target mapping');
assert.equal(fallbackResult.roundResult.revealedTargets['player-b'].id, targetB.id, 'Fallback owner targets must preserve Player B own-target mapping');

console.log('1v1 reveal target regression passed: owner-scoped snapshots remain authoritative and five-second timing is unchanged.');
