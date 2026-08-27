/**
 * gameEngine.js
 * Core game-state transition functions.
 * All functions are PURE â€” they take state, return new state.
 * UI â†’ Context â†’ gameEngine â†’ State
 */

import { GAME_MODES, score1v1Guess, scoreSocialRound, determineWinner } from './scoring.js';
import { assignTargetsToPlayers } from './targetSelector.js';
import { getItemsByCategory } from '../data/gameData.js';

export { GAME_MODES };

export const GAME_PHASES = {
  LOBBY: 'lobby',
  PREVIEW: 'preview',
  PLAYING: 'playing',
  ROUND_END: 'round_end',
  VOTING: 'voting',       // social deduction phase
  RESULTS: 'results',
};

export const TOTAL_ROUNDS = 3;
export const SOCIAL_TIMER_SECONDS = 8 * 60; // 480
export const REVEAL_DURATION_MS = 5000;

// â”€â”€â”€ Initial State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function buildInitialState() {
  return {
    phase: GAME_PHASES.LOBBY,
    mode: GAME_MODES.ONE_V_ONE,
    category: null,
    roomCode: null,
    matchId: null,
    roundId: null,
    players: [],
    hostId: null,
    // Round tracking
    round: 1,
    totalRounds: TOTAL_ROUNDS,
    // Per-player secret targets (own character â€” never shown in UI): { [playerId]: Item }
    targets: {},
    // Per-player visible opponent target (shown in UI): { [playerId]: Item }
    displayTargets: {},
    // Immutable per-round target snapshot used for completed-round Results.
    roundTargets: {},
    // Immutable resolved result keyed by roundId.
    roundResults: {},
    // Per-player eliminated card IDs: { [playerId]: string[] }
    eliminatedCards: {},
    // Cumulative scores: { [playerId]: number }
    scores: {},
    // Current turn player ID (1v1)
    currentTurnPlayerId: null,
    // Authoritative 3â€“4 knockout state. Keys are stable match/player IDs.
    bracket: null,
    playerAssignments: {},
    matchResults: {},
    standings: [],
    // Q&A history
    questions: [],
    // Votes (social mode): [{ voterId, targetId }]
    votes: [],
    // IDs of all items used as targets across ALL rounds this match
    usedTargetIds: [],
    // Timer (seconds remaining, social mode)
    timerSeconds: SOCIAL_TIMER_SECONDS,
    timerRunning: false,
    // Round winner info for display
    roundResult: null,
    // Timestamp when round-end reveal expires (local countdown source)
    revealEndTimestamp: 0,
    // Authoritative finals transition window shared by all clients.
    transitionStartedAt: 0,
    transitionEndsAt: 0,
  };
}

// â”€â”€â”€ Lobby Phase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Called when host clicks "Create Room" */
export function initRoom(state, { roomCode, matchId, hostPlayer, mode, category }) {
  return {
    ...buildInitialState(),
    phase: GAME_PHASES.LOBBY,
    roomCode,
    matchId: matchId ?? `${roomCode}:match:local`,
    roundId: null,
    mode,
    category,
    players: [hostPlayer],
    hostId: hostPlayer.id,
    scores: { [hostPlayer.id]: 0 },
    eliminatedCards: { [hostPlayer.id]: [] },
  };
}

export function createKnockoutBracket(players) {
  if (!Array.isArray(players) || players.length !== 4) return null;
  const [a, b, c, d] = players.map((p) => p.id);
  const matches = {
    // Fixed first-round bracket: seat 1 vs 4 and seat 2 vs 3.
    semifinal_1: { matchId: 'semifinal_1', stage: 'semifinal_1', playerA: a, playerB: d, status: 'active', winnerId: null, loserId: null, matchRound: 1, matchScores: { [a]: 0, [d]: 0 }, roundResult: null },
    semifinal_2: { matchId: 'semifinal_2', stage: 'semifinal_2', playerA: b, playerB: c, status: 'active', winnerId: null, loserId: null, matchRound: 1, matchScores: { [b]: 0, [c]: 0 }, roundResult: null },
  };
  const playerAssignments = {};
  Object.values(matches).forEach((match) => {
    playerAssignments[match.playerA] = { matchId: match.matchId, opponentPlayerId: match.playerB, stage: match.stage };
    playerAssignments[match.playerB] = { matchId: match.matchId, opponentPlayerId: match.playerA, stage: match.stage };
  });
  return { stage: 'semifinals', matches, playerAssignments };
}

function getKnockoutAssignment(state, playerId) {
  return state.playerAssignments?.[playerId] || null;
}

/** Add a player to the lobby */
export function playerJoined(state, newPlayer) {
  return {
    ...state,
    players: [...state.players, newPlayer],
    scores: { ...state.scores, [newPlayer.id]: 0 },
    eliminatedCards: { ...state.eliminatedCards, [newPlayer.id]: [] },
  };
}

/** Remove a player from the lobby */
export function playerLeft(state, playerId) {
  return {
    ...state,
    players: state.players.filter((p) => p.id !== playerId),
    scores: Object.fromEntries(
      Object.entries(state.scores).filter(([id]) => id !== playerId),
    ),
  };
}

// â”€â”€â”€ Round Start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Build displayTargets map: each player sees their opponent's secret target */
function buildDisplayTargets(playerIds, secretTargets) {
  const displayTargets = {};
  playerIds.forEach((id) => {
    const opponentIds = playerIds.filter((oid) => oid !== id);
    if (opponentIds.length === 1) {
      displayTargets[id] = secretTargets[opponentIds[0]];
    } else if (opponentIds.length > 1) {
      // Multi-player: show the next player's target in turn order
      const idx = playerIds.indexOf(id);
      const nextId = playerIds[(idx + 1) % playerIds.length];
      displayTargets[id] = secretTargets[nextId];
    }
  });
  return displayTargets;
}

/** Enter preview phase â€” show category pool before round begins (no targets yet) */
export function enterPreview(state) {
  const shouldSeedBracket = state.mode === GAME_MODES.SOCIAL
    && state.players.length === 4
    && (state.phase === GAME_PHASES.LOBBY || state.round === 1);
  const bracket = shouldSeedBracket ? createKnockoutBracket(state.players) : state.bracket;
  return {
    ...state,
    phase: GAME_PHASES.PREVIEW,
    bracket,
    playerAssignments: bracket?.playerAssignments ?? state.playerAssignments,
    targets: {},
    displayTargets: {},
    questions: [],
    votes: [],
    roundResult: null,
    revealEndTimestamp: 0,
    transitionStartedAt: 0,
    transitionEndsAt: 0,
    timerRunning: false,
    timerSeconds: SOCIAL_TIMER_SECONDS,
    roundId: null,
    roundTargets: {},
  };
}

/** Active player IDs â€” 1v1 flow uses exactly 2 players */
function getActivePlayerIds(state) {
  const all = state.players.map((p) => p.id);
  if (state.mode === GAME_MODES.ONE_V_ONE) {
    return all.slice(0, 2);
  }
  return all;
}

/** Begin playing from preview â€” assign secret targets and start the round */
export function beginPlayingFromPreview(state) {
  const playerIds = getActivePlayerIds(state);

  const targetItems = assignTargetsToPlayers(
    state.category,
    state.usedTargetIds,
    playerIds.length,
  );

  if (targetItems.length < playerIds.length) {
    console.warn('[gameEngine] Not enough unique targets â€” some may repeat.');
  }

  const newTargets = {};
  const newUsed = [...state.usedTargetIds];
  playerIds.forEach((id, idx) => {
    const item = targetItems[idx] ?? targetItems[0];
    newTargets[id] = item;
    if (!newUsed.includes(item.id)) newUsed.push(item.id);
  });

  const cyclicDisplayTargets = buildDisplayTargets(playerIds, newTargets);
  const newDisplayTargets = state.mode === GAME_MODES.SOCIAL && playerIds.length === 4
    ? Object.fromEntries(playerIds.map((id) => [id, newTargets[state.playerAssignments?.[id]?.opponentPlayerId]]).filter(([, target]) => target))
    : cyclicDisplayTargets;
  const roundId = `${state.matchId || state.roomCode || 'local'}:round:${state.round}`;

  const freshEliminated = {};
  playerIds.forEach((id) => { freshEliminated[id] = []; });

  return {
    ...state,
    phase: GAME_PHASES.PLAYING,
    roundId,
    targets: newTargets,
    displayTargets: newDisplayTargets,
    roundTargets: newTargets,
    eliminatedCards: freshEliminated,
    questions: [],
    votes: [],
    usedTargetIds: newUsed,
    currentTurnPlayerId: playerIds[0],
    timerSeconds: SOCIAL_TIMER_SECONDS,
    timerRunning: state.mode === GAME_MODES.SOCIAL,
    roundResult: null,
    matchResults: state.matchResults || {},
    transitionStartedAt: 0,
    transitionEndsAt: 0,
  };
}

/** @deprecated Use enterPreview + beginPlayingFromPreview. Kept for internal advanceRound compat. */
export function startRound(state) {
  return beginPlayingFromPreview(state);
}

// â”€â”€â”€ 1v1 Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Send a free-form chat message during PLAYING (no validation) */
export function sendChatMessage(state, { playerId, playerName, text }) {
  if (state.phase !== GAME_PHASES.PLAYING) return state;
  const msg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    playerId,
    playerName,
    message: text,
    timestamp: Date.now(),
    type: 'chat',
  };
  return { ...state, questions: [...state.questions, msg] };
}

/** @deprecated Use sendChatMessage. Kept for social-mode compat. */
export function submitQuestion(state, { text, playerId, playerName }) {
  const pid = playerId ?? state.currentTurnPlayerId;
  const pname = playerName ?? state.players.find((p) => p.id === pid)?.name ?? 'Player';
  return sendChatMessage(state, { playerId: pid, playerName: pname, text });
}

/** Opponent answers the latest unanswered question */
export function answerQuestion(state, { questionId, answer }) {
  const questions = state.questions.map((q) =>
    q.id === questionId ? { ...q, answer } : q,
  );
  // After answering, it's still the same player's turn (they asked, opponent answered)
  return { ...state, questions };
}

/** Capture the immutable target each player was trying to guess this round. */
function captureRoundTargets(state, activeIds) {
  const secretTargets = Object.keys(state.roundTargets || {}).length > 0
    ? state.roundTargets
    : (state.targets || {});
  const displayTargets = state.displayTargets || {};
  const isOneVOne = activeIds.length === 2;
  return Object.fromEntries(
    activeIds
      .map((playerId, index) => {
        const opponentId = activeIds.find((id) => id !== playerId);
        const target = isOneVOne
          ? secretTargets[playerId] ?? displayTargets[opponentId]
          : displayTargets[playerId]
          ?? (activeIds.length > 2
            ? secretTargets[activeIds[(index + 1) % activeIds.length]]
            : secretTargets[activeIds.find((id) => id !== playerId)]);
        return target ? [playerId, target] : null;
      })
      .filter(Boolean),
  );
}

/** Resolve one authoritative 3â€“4 knockout match without advancing unrelated matches. */
export function resolveKnockoutMatch(state, { matchId, confirmerId, guessedPlayerId, roundId, matchRound }) {
  if (state.mode !== GAME_MODES.SOCIAL || state.players.length !== 4 || state.phase !== GAME_PHASES.PLAYING) return state;
  if (roundId != null && roundId !== state.roundId) return state;
  const match = state.bracket?.matches?.[matchId];
  if (!match || match.status === 'resolved') return state;
  if (matchRound !== undefined && match.matchRound !== matchRound) return state;

  const assignment = getKnockoutAssignment(state, confirmerId);
  if (!assignment || assignment.matchId !== matchId) return state;

  const winnerId = guessedPlayerId || assignment.opponentPlayerId;
  if (winnerId !== assignment.opponentPlayerId || ![match.playerA, match.playerB].includes(winnerId)) return state;
  const loserId = winnerId === match.playerA ? match.playerB : match.playerA;
  const winner = state.players.find((p) => p.id === winnerId);

  const currentMatchRound = match.matchRound || 1;
  const roundResult = {
    matchId,
    roundId: state.roundId,
    matchRound: currentMatchRound,
    stage: match.stage,
    winnerId,
    loserId,
    confirmerId,
    guessedPlayerId: winnerId,
    pointsEarned: 1,
    message: `${winner?.name ?? 'Player'} GUESSED CORRECTLY!`,
    revealedTargets: captureRoundTargets(state, [match.playerA, match.playerB]),
    revealEndTimestamp: Date.now() + REVEAL_DURATION_MS,
  };

  const currentMatchScores = match.matchScores || { [match.playerA]: 0, [match.playerB]: 0 };
  const nextMatchScores = {
    ...currentMatchScores,
    [winnerId]: (currentMatchScores[winnerId] || 0) + 1,
  };
  const nextScores = { ...state.scores, [winnerId]: (state.scores[winnerId] || 0) + 1 };

  let nextMatchRound = currentMatchRound + 1;
  let nextMatchStatus = 'active';
  let matchWinnerId = null;
  let matchLoserId = null;

  if (currentMatchRound >= 3) {
    nextMatchStatus = 'resolved';
    const scoreA = nextMatchScores[match.playerA] || 0;
    const scoreB = nextMatchScores[match.playerB] || 0;
    if (scoreA > scoreB) {
      matchWinnerId = match.playerA;
      matchLoserId = match.playerB;
    } else if (scoreB > scoreA) {
      matchWinnerId = match.playerB;
      matchLoserId = match.playerA;
    } else {
      matchWinnerId = winnerId;
      matchLoserId = loserId;
    }
  }

  const nextTargets = { ...state.targets };
  const nextDisplayTargets = { ...state.displayTargets };
  const nextUsedTargetIds = [...state.usedTargetIds];

  if (nextMatchStatus === 'active') {
    const targetItems = assignTargetsToPlayers(
      state.category,
      nextUsedTargetIds,
      2
    );
    const pids = [match.playerA, match.playerB];
    pids.forEach((id, idx) => {
      const item = targetItems[idx] ?? targetItems[0];
      nextTargets[id] = item;
      if (!nextUsedTargetIds.includes(item.id)) {
        nextUsedTargetIds.push(item.id);
      }
    });
    nextDisplayTargets[match.playerA] = nextTargets[match.playerB];
    nextDisplayTargets[match.playerB] = nextTargets[match.playerA];
  }

  const resolvedMatch = {
    ...match,
    matchRound: nextMatchRound,
    matchScores: nextMatchScores,
    roundResult,
    status: nextMatchStatus,
    winnerId: matchWinnerId,
    loserId: matchLoserId,
    result: nextMatchStatus === 'resolved' ? roundResult : null,
  };

  const nextMatches = { ...(state.bracket.matches || {}), [matchId]: resolvedMatch };
  const nextResults = { ...(state.matchResults || {}) };
  nextResults[`${matchId}_round_${currentMatchRound}`] = roundResult;
  if (nextMatchStatus === 'resolved') {
    nextResults[matchId] = roundResult;
  }

  const semisComplete = ['semifinal_1', 'semifinal_2'].every((id) => nextMatches[id]?.status === 'resolved');
  let nextBracket = { ...state.bracket, matches: nextMatches };
  let nextAssignments = { ...state.playerAssignments };
  let nextPhase = GAME_PHASES.PLAYING;
  let nextRound = state.round;
  let nextRoundId = state.roundId;
  let transitionStartedAt = state.transitionStartedAt || 0;
  let transitionEndsAt = state.transitionEndsAt || 0;

  if (semisComplete && !nextMatches.final) {
    const s1 = nextMatches.semifinal_1;
    const s2 = nextMatches.semifinal_2;
    const final = {
      matchId: 'final',
      stage: 'final',
      playerA: s1.winnerId,
      playerB: s2.winnerId,
      status: 'active',
      winnerId: null,
      loserId: null,
      matchRound: 1,
      matchScores: { [s1.winnerId]: 0, [s2.winnerId]: 0 },
      roundResult: null,
    };
    const third = {
      matchId: 'third_place',
      stage: 'third_place',
      playerA: s1.loserId,
      playerB: s2.loserId,
      status: 'active',
      winnerId: null,
      loserId: null,
      matchRound: 1,
      matchScores: { [s1.loserId]: 0, [s2.loserId]: 0 },
      roundResult: null,
    };
    nextMatches.final = final; nextMatches.third_place = third;
    [final, third].forEach((m) => {
      nextAssignments[m.playerA] = { matchId: m.matchId, opponentPlayerId: m.playerB, stage: m.stage };
      nextAssignments[m.playerB] = { matchId: m.matchId, opponentPlayerId: m.playerA, stage: m.stage };
    });
    nextBracket = { ...nextBracket, stage: 'finals' };
    transitionStartedAt = Date.now();
    transitionEndsAt = transitionStartedAt + REVEAL_DURATION_MS;
    nextPhase = GAME_PHASES.PREVIEW; nextRound = state.round + 1; nextRoundId = null;
  }

  const finalsComplete = nextMatches.final?.status === 'resolved' && nextMatches.third_place?.status === 'resolved';
  let standings = state.standings || [];
  if (finalsComplete) {
    const placement = [nextMatches.final.winnerId, nextMatches.final.loserId, nextMatches.third_place.winnerId, nextMatches.third_place.loserId];
    standings = placement.map((id, index) => ({ ...(state.players.find((p) => p.id === id) || { id }), points: nextScores[id] || 0, place: index + 1 }));
    nextBracket = { ...nextBracket, stage: 'complete', standings };
    nextRound = 3;
    nextPhase = GAME_PHASES.RESULTS;
    transitionStartedAt = 0;
    transitionEndsAt = 0;
  }
  return { ...state, phase: nextPhase, round: nextRound, roundId: nextRoundId, bracket: nextBracket, playerAssignments: nextAssignments, matchResults: nextResults, scores: nextScores, roundResult, standings, transitionStartedAt, transitionEndsAt, targets: nextTargets, displayTargets: nextDisplayTargets, usedTargetIds: nextUsedTargetIds };
}

/** Opponent confirms that the other player guessed correctly (+1 to the guesser) */
export function confirmOpponentGuessed(state, { confirmerId, guessedPlayerId }) {
  if (state.phase !== GAME_PHASES.PLAYING) return state;
  const hasCurrentRoundResult = Boolean(
    state.roundResult?.roundId
      && state.roundResult.roundId === state.roundId,
  );
  if (hasCurrentRoundResult) return state;

  const activeIds = getActivePlayerIds(state);
  const resolvedWinnerId = guessedPlayerId
    ?? (activeIds.length > 2
      ? activeIds[(activeIds.indexOf(confirmerId) + 1) % activeIds.length]
      : activeIds.find((id) => id !== confirmerId));
  const opponent = state.players.find((p) => p.id === resolvedWinnerId);
  if (!opponent || opponent.id === confirmerId || !activeIds.includes(opponent.id)) return state;

  const winnerId = opponent.id;
  const points = 1;
  const revealEndTimestamp = Date.now() + REVEAL_DURATION_MS;

  const revealedTargets = captureRoundTargets(state, activeIds);

  const roundResult = {
    roundId: state.roundId,
    winnerId,
    winnerName: opponent.name,
    confirmerId,
    guessedPlayerId: winnerId,
    pointsEarned: points,
    message: `${opponent.name} GUESSED CORRECTLY!`,
    revealedTargets,
    revealEndTimestamp,
  };

  return {
    ...state,
    phase: GAME_PHASES.ROUND_END,
    scores: {
      ...state.scores,
      [winnerId]: (state.scores[winnerId] || 0) + points,
    },
    roundResult,
    roundResults: {
      ...(state.roundResults || {}),
      [state.roundId]: roundResult,
    },
    revealEndTimestamp,
  };
}

/** @deprecated Use confirmOpponentGuessed */
export function declareCorrectGuess(state, { playerId }) {
  const confirmerId = state.players.find((p) => p.id !== playerId)?.id;
  if (!confirmerId) return state;
  return confirmOpponentGuessed(state, { confirmerId });
}

/** Active player makes a guess on a card (legacy â€” card grid disabled during PLAYING) */
export function submitGuess(state, { guessedItemId, activePlayerId }) {
  if (state.phase !== GAME_PHASES.PLAYING) return state;

  const mySecret = state.targets[activePlayerId];
  const correct = mySecret ? mySecret.id === guessedItemId : false;
  const { points } = score1v1Guess(correct);

  // Add guess to question log as a special entry
  const guessEntry = {
    id: `guess_${Date.now()}`,
    playerId: activePlayerId,
    question: `GUESS: ${guessedItemId}`,
    answer: correct ? 'CORRECT' : 'WRONG',
    isGuess: true,
    correct,
    timestamp: Date.now(),
  };

  let newEliminated = { ...state.eliminatedCards };
  let newScores = { ...state.scores };
  let nextPhase = state.phase;

  if (correct) {
    newScores[activePlayerId] = (newScores[activePlayerId] || 0) + points;
    nextPhase = GAME_PHASES.ROUND_END;
  }
  // Wrong guesses no longer eliminate cards during PLAYING

  // Flip turn (whether correct or not, for continuity UI; phase will stop interaction anyway)
  const playerIds = state.players.map((p) => p.id);
  const revealedTargets = captureRoundTargets(state, playerIds);
  const currentIndex = playerIds.indexOf(state.currentTurnPlayerId);
  const nextTurnPlayerId = playerIds[(currentIndex + 1) % playerIds.length];

  return {
    ...state,
    phase: nextPhase,
    scores: newScores,
    eliminatedCards: newEliminated,
    questions: [...state.questions, guessEntry],
    currentTurnPlayerId: correct ? state.currentTurnPlayerId : nextTurnPlayerId,
    roundResult: correct
      ? {
          roundId: state.roundId,
          winnerId: activePlayerId,
          winnerName: state.players.find((p) => p.id === activePlayerId)?.name,
          pointsEarned: points,
          message: `${state.players.find((p) => p.id === activePlayerId)?.name ?? 'Player'} GUESSED CORRECTLY!`,
          revealedTargets,
        }
      : state.roundResult,
  };
}

/** Player manually eliminates a card â€” disabled during PLAYING phase */
export function toggleEliminateCard(state, { playerId, itemId }) {
  if (state.phase === GAME_PHASES.PLAYING) return state;
  const current = state.eliminatedCards[playerId] || [];
  const isElim = current.includes(itemId);
  return {
    ...state,
    eliminatedCards: {
      ...state.eliminatedCards,
      [playerId]: isElim
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    },
  };
}

// â”€â”€â”€ Social Deduction Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Timer tick â€” called every second by the hook */
export function timerTick(state) {
  if (!state.timerRunning || state.timerSeconds <= 0) return state;
  const newSeconds = Math.max(0, state.timerSeconds - 1);
  const expired = newSeconds === 0;
  return {
    ...state,
    timerSeconds: newSeconds,
    timerRunning: !expired,
    phase: expired ? GAME_PHASES.VOTING : state.phase,
  };
}

/** Cast a vote in social deduction mode */
export function castVote(state, { voterId, targetId }) {
  // Replace existing vote from same voter (each player votes once)
  const filtered = state.votes.filter((v) => v.voterId !== voterId);
  return { ...state, votes: [...filtered, { voterId, targetId }] };
}

/** End voting phase and compute social round scores */
export function resolveVoting(state) {
  const pointsMap = scoreSocialRound(
    state.votes,
    state.players.map((p) => ({ id: p.id, targetId: state.targets[p.id]?.id })),
  );

  const newScores = { ...state.scores };
  for (const [pid, pts] of Object.entries(pointsMap)) {
    newScores[pid] = (newScores[pid] || 0) + pts;
  }

  return { ...state, scores: newScores, phase: GAME_PHASES.ROUND_END };
}

// â”€â”€â”€ Round / Match Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Advance to the next round or end the match */
export function advanceRound(state) {
  if (state.round >= state.totalRounds) {
    // Match over
    const { winnerId, winnerName, isTie } = determineWinner(
      state.scores,
      state.players,
    );
    return {
      ...state,
      phase: GAME_PHASES.RESULTS,
      roundResult: {
        winnerId,
        winnerName,
        isTie,
        final: true,
        revealedTargets: state.roundResult?.revealedTargets ?? null,
        roundResults: state.roundResults || {},
        standings: [...state.players]
          .map((player) => ({ ...player, points: state.scores[player.id] ?? 0 }))
          .sort((a, b) => b.points - a.points),
      },
    };
  }

  // Enter preview for next round (targets assigned when host starts round)
  return enterPreview({ ...state, round: state.round + 1 });
}

/** Play Again â€” reset match state but keep players and room */
export function resetMatch(state) {
  const players = state.players;
  const freshScores = {};
  const freshEliminated = {};
  players.forEach((p) => {
    freshScores[p.id] = 0;
    freshEliminated[p.id] = [];
  });

  return {
    ...buildInitialState(),
    phase: GAME_PHASES.LOBBY,
    mode: state.mode,
    category: state.category,
    roomCode: state.roomCode,
    matchId: state.matchId,
    roundId: null,
    players,
    hostId: state.hostId,
    scores: freshScores,
    eliminatedCards: freshEliminated,
  };
}

/** Get items for the active game board for a given player */
export function getBoardItems(state, category) {
  return getItemsByCategory(category);
}

