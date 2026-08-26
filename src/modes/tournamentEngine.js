import { clone, COMPETITIVE_MODES, MODE_PHASES } from './modeTypes.js';

export const TOURNAMENT_MATCH_IDS = { SEMI_A: 'semi_a', SEMI_B: 'semi_b', FINAL: 'final', CONSOLATION: 'consolation' };
export const TOURNAMENT_TARGET_BASE_OFFSETS = Object.freeze({
  [TOURNAMENT_MATCH_IDS.SEMI_A]: 0,
  [TOURNAMENT_MATCH_IDS.SEMI_B]: 3,
  [TOURNAMENT_MATCH_IDS.FINAL]: 6,
  [TOURNAMENT_MATCH_IDS.CONSOLATION]: 9,
});
export function tournamentTargetOffset(matchId, roundNumber = 1) {
  const baseOffset = TOURNAMENT_TARGET_BASE_OFFSETS[matchId];
  if (baseOffset === undefined) return null;
  return baseOffset + Math.max(0, (Number(roundNumber) - 1) * 2);
}
export const TOURNAMENT_ROUND_COUNT = 3;
export const TOURNAMENT_REVEAL_MS = 5000;

const cloneOr = (value, fallback) => clone(value == null ? fallback : value);

const createPlayerStats = (player) => ({
  playerId: player.id,
  score: 0,
  guesses: 0,
  correctGuesses: 0,
  roundHistory: [],
  reward: null,
});

const createMatch = (id, playerIds, status = 'pending') => ({
  matchId: id,
  playerIds,
  playerMap: Object.fromEntries(playerIds.map((id) => [id, true])),
  status,
  roundNumber: 1,
  phase: status === 'playing' ? MODE_PHASES.PLAYING : MODE_PHASES.LOBBY,
  scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
  targets: {},
  guesses: {},
  result: null,
  revealEndTimestamp: null,
});

export function createTournamentState({ tournamentId, roomId, players, category, hostId }) {
  const ids = players.map((player) => player.id);
  if (ids.length !== 4) throw new Error('Tournament requires exactly four players.');
  return {
    tournamentId, roomId, mode: COMPETITIVE_MODES.TOURNAMENT, category,
    phase: MODE_PHASES.SEMI_FINALS, roundNumber: 1, hostId, playerIds: ids,
    players: Object.fromEntries(players.map((player) => [player.id, clone(player)])),
    playerStats: Object.fromEntries(players.map(createPlayerStats)),
    rewards: {},
    matches: {
      [TOURNAMENT_MATCH_IDS.SEMI_A]: createMatch(TOURNAMENT_MATCH_IDS.SEMI_A, ids.slice(0, 2), 'playing'),
      [TOURNAMENT_MATCH_IDS.SEMI_B]: createMatch(TOURNAMENT_MATCH_IDS.SEMI_B, ids.slice(2, 4), 'playing'),
      [TOURNAMENT_MATCH_IDS.FINAL]: createMatch(TOURNAMENT_MATCH_IDS.FINAL, [], 'pending'),
      [TOURNAMENT_MATCH_IDS.CONSOLATION]: createMatch(TOURNAMENT_MATCH_IDS.CONSOLATION, [], 'pending'),
    },
    transitionEndTimestamp: null, winnerId: null, secondPlaceId: null, thirdPlaceId: null, fourthPlaceId: null,
    status: 'active', createdAt: Date.now(), updatedAt: Date.now(),
  };
}

export function startMatch(state, matchId, targets) {
  const current = state.matches[matchId];
  if (!current || current.playerIds.length !== 2) throw new Error('Match must have two players.');
  return {
    ...state,
    matches: { ...state.matches, [matchId]: { ...current, status: 'playing', phase: MODE_PHASES.PLAYING, targets: cloneOr(targets, {}), guesses: {}, result: null, revealEndTimestamp: null } },
    phase: matchId.startsWith('semi_') ? MODE_PHASES.SEMI_FINALS : MODE_PHASES.PLAYING,
    transitionEndTimestamp: null, updatedAt: Date.now(),
  };
}

function getStoredGuessForPlayer(match, playerId) {
  const direct = match?.guesses?.[playerId];
  if (direct?.guesserId === playerId || (!direct?.confirmerId && direct?.confirmed !== true && direct?.playerId === playerId)) {
    return { entry: direct, confirmerId: direct?.confirmerId || match.playerIds.find((id) => id !== playerId) };
  }
  const found = Object.entries(match?.guesses || {}).find(([confirmerId, guess]) => guess?.guesserId === playerId || (!guess?.confirmerId && guess?.confirmed === true && guess?.playerId === confirmerId && confirmerId !== playerId));
  if (!found) return { entry: null, confirmerId: null };
  const [confirmerId, entry] = found;
  return { entry, confirmerId };
}

function applyStoredGuessScore(state, matchId, confirmerId, guess) {
  const current = state.matches[matchId];
  if (!current || !guess || guess.scored === true) return state;
  const expectedGuesserId = current.playerIds.find((id) => id !== confirmerId);
  if (!expectedGuesserId || (guess.guesserId && guess.guesserId !== expectedGuesserId)) return state;
  const guesserId = expectedGuesserId;
  const correct = Boolean(guess.correct);
  const oldStats = state.playerStats?.[guesserId] || createPlayerStats(state.players[guesserId] || { id: guesserId });
  const playerStats = {
    ...state.playerStats,
    [guesserId]: { ...oldStats, score: oldStats.score + (correct ? 1 : 0), guesses: oldStats.guesses + 1, correctGuesses: oldStats.correctGuesses + (correct ? 1 : 0) },
  };
  return {
    ...state,
    playerStats,
    matches: { ...state.matches, [matchId]: { ...current, scores: { ...current.scores, [guesserId]: (current.scores[guesserId] || 0) + (correct ? 1 : 0) }, guesses: { ...current.guesses, [confirmerId]: { ...guess, playerId: confirmerId, confirmerId, guesserId, scored: true } } } },
    updatedAt: Date.now(),
  };
}

export function recordMatchConfirmation(state, matchId, confirmerId, targetId, guesserId, correct = true) {
  const current = state.matches[matchId];
  if (!current || current.status !== 'playing' || !current.playerIds.includes(confirmerId) || !current.playerIds.includes(guesserId) || confirmerId === guesserId) return state;
  if (current.guesses?.[confirmerId] || getStoredGuessForPlayer(current, guesserId).entry) return state;
  const guess = { playerId: confirmerId, confirmerId, guesserId, targetId, roundNumber: current.roundNumber, confirmed: true, correct: Boolean(correct), scored: false, timestamp: Date.now() };
  const recorded = { ...state, matches: { ...state.matches, [matchId]: { ...current, guesses: { ...current.guesses, [confirmerId]: guess } } }, updatedAt: Date.now() };
  return applyStoredGuessScore(recorded, matchId, confirmerId, guess);
}

export function reconcileTournamentMatchScores(state, matchId) {
  const current = state.matches[matchId];
  if (!current) return state;
  let next = state;
  Object.entries(current.guesses || {}).forEach(([confirmerId, guess]) => {
    next = applyStoredGuessScore(next, matchId, confirmerId, guess);
  });
  return next;
}

export function recordMatchGuess(state, matchId, playerId, targetId) {
  const current = state.matches[matchId];
  if (!current || !current.playerIds.includes(playerId)) return state;
  const confirmerId = current.playerIds.find((id) => id !== playerId);
  const correct = current.targets?.[confirmerId]?.id === targetId;
  return recordMatchConfirmation(state, matchId, confirmerId, targetId, playerId, correct);
}

export function completeTournamentRound(state, matchId) {
  const current = state.matches[matchId];
  if (!current || current.status !== 'playing' || current.playerIds.length !== 2) return state;
  if (current.playerIds.some((playerId) => !current.guesses?.[playerId])) return state;
  const normalizedGuesses = Object.fromEntries(current.playerIds.map((playerId) => [playerId, clone(getStoredGuessForPlayer(current, playerId).entry || null)]));
  const roundResult = {
    roundNumber: current.roundNumber,
    guesses: normalizedGuesses,
    targets: cloneOr(current.targets, {}),
    scores: cloneOr(current.scores, {}),
    revealSnapshot: current.playerIds.map((playerId) => ({ playerId, target: clone(current.targets?.[playerId] || null), guess: clone(normalizedGuesses[playerId] || null) })),
    completedAt: Date.now(),
  };
  const playerStats = { ...state.playerStats };
  current.playerIds.forEach((id) => {
    const existing = playerStats[id] || createPlayerStats(state.players[id] || { id });
    playerStats[id] = { ...existing, roundHistory: [...(existing.roundHistory || []), { roundNumber: current.roundNumber, matchId, target: clone(current.targets?.[id] || null), guess: clone(getStoredGuessForPlayer(current, id).entry || null) }] };
  });
  return {
    ...state,
    playerStats,
    matches: { ...state.matches, [matchId]: { ...current, status: 'round_result', phase: MODE_PHASES.ROUND_RESULT, result: roundResult, revealEndTimestamp: Date.now() + TOURNAMENT_REVEAL_MS } },
    updatedAt: Date.now(),
  };
}

export function advanceTournamentRound(state, matchId, targets) {
  const current = state.matches[matchId];
  if (!current || current.status !== 'round_result' || current.roundNumber >= TOURNAMENT_ROUND_COUNT) return state;
  return {
    ...state,
    matches: { ...state.matches, [matchId]: { ...current, status: 'playing', phase: MODE_PHASES.PLAYING, roundNumber: current.roundNumber + 1, targets: cloneOr(targets, {}), guesses: {}, result: null, revealEndTimestamp: null } },
    phase: matchId.startsWith('semi_') ? MODE_PHASES.SEMI_FINALS : MODE_PHASES.PLAYING,
    roundNumber: current.roundNumber + 1,
    updatedAt: Date.now(),
  };
}

function rewardForPlacement(place) {
  return { placement: place, points: Math.max(1, 5 - place), awardedAt: Date.now() };
}

function applyRewards(state, placements) {
  const rewards = Object.fromEntries(Object.entries(placements).map(([playerId, place]) => [playerId, rewardForPlacement(place)]));
  const playerStats = { ...state.playerStats };
  Object.entries(rewards).forEach(([playerId, reward]) => { playerStats[playerId] = { ...(playerStats[playerId] || createPlayerStats(state.players[playerId] || { id: playerId })), reward }; });
  return { rewards, playerStats };
}

export function finishMatch(state, matchId, winnerId, result = {}) {
  const current = state.matches[matchId];
  if (!current || current.status !== 'playing' || !current.playerIds.includes(winnerId)) return state;
  const loserId = current.playerIds.find((id) => id !== winnerId);
  const playerStats = { ...state.playerStats };
  current.playerIds.forEach((id) => {
    const guess = getStoredGuessForPlayer(current, id).entry || null;
    const existing = playerStats[id] || createPlayerStats(state.players[id] || { id });
    const alreadyRecorded = (existing.roundHistory || []).some((entry) => entry.matchId === matchId && entry.roundNumber === current.roundNumber);
    playerStats[id] = alreadyRecorded ? existing : { ...existing, roundHistory: [...(existing.roundHistory || []), { roundNumber: current.roundNumber, matchId, target: clone(current.targets?.[id] || null), guess: clone(guess) }] };
  });
  const normalizedGuesses = Object.fromEntries(current.playerIds.map((playerId) => [playerId, clone(getStoredGuessForPlayer(current, playerId).entry || null)]));
  const finished = { ...current, status: 'finished', phase: MODE_PHASES.RESULTS, result: { ...result, winnerId, loserId, matchId, scores: cloneOr(current.scores, {}), guesses: normalizedGuesses, targets: cloneOr(current.targets, {}), playerIds: [...current.playerIds] }, revealEndTimestamp: null };
  const matches = { ...state.matches, [matchId]: finished };
  const semiA = matches[TOURNAMENT_MATCH_IDS.SEMI_A];
  const semiB = matches[TOURNAMENT_MATCH_IDS.SEMI_B];
  if (matchId.startsWith('semi_') && semiA.status === 'finished' && semiB.status === 'finished') {
    const winnerA = semiA.result?.winnerId; const winnerB = semiB.result?.winnerId; const loserA = semiA.result?.loserId; const loserB = semiB.result?.loserId;
    const semifinalIds = new Set([winnerA, winnerB, loserA, loserB]);
    if (!winnerA || !winnerB || !loserA || !loserB || semifinalIds.size !== 4) throw new Error('Tournament bracket is incomplete: both semifinal winners and losers are required before Final and 3rd Place can start.');
    matches[TOURNAMENT_MATCH_IDS.FINAL] = { ...matches[TOURNAMENT_MATCH_IDS.FINAL], playerIds: [winnerA, winnerB], playerMap: { [winnerA]: true, [winnerB]: true }, scores: { [winnerA]: 0, [winnerB]: 0 }, roundNumber: 1 };
    matches[TOURNAMENT_MATCH_IDS.CONSOLATION] = { ...matches[TOURNAMENT_MATCH_IDS.CONSOLATION], playerIds: [loserA, loserB], playerMap: { [loserA]: true, [loserB]: true }, scores: { [loserA]: 0, [loserB]: 0 }, roundNumber: 1 };
    return { ...state, playerStats, phase: MODE_PHASES.TRANSITION, transitionEndTimestamp: Date.now() + 5000, matches, updatedAt: Date.now() };
  }
  if (matchId === TOURNAMENT_MATCH_IDS.FINAL) {
    const consolation = matches[TOURNAMENT_MATCH_IDS.CONSOLATION];
    const consolationWinner = consolation.result?.winnerId; const consolationLoser = consolation.result?.loserId;
    const placements = { [winnerId]: 1, [loserId]: 2 };
    if (consolationWinner) placements[consolationWinner] = 3;
    if (consolationLoser) placements[consolationLoser] = 4;
    const rewardData = consolation.status === 'finished' ? applyRewards({ ...state, playerStats }, placements) : { rewards: state.rewards, playerStats };
    return { ...state, playerStats: rewardData.playerStats, rewards: rewardData.rewards, phase: consolation.status === 'finished' ? MODE_PHASES.RESULTS : MODE_PHASES.PLAYING, winnerId, secondPlaceId: loserId, thirdPlaceId: consolationWinner || null, fourthPlaceId: consolationLoser || null, matches, status: consolation.status === 'finished' ? 'finished' : 'final_pending_consolation', updatedAt: Date.now() };
  }
  if (matchId === TOURNAMENT_MATCH_IDS.CONSOLATION && matches[TOURNAMENT_MATCH_IDS.FINAL].status === 'finished') {
    const finalWinner = matches[TOURNAMENT_MATCH_IDS.FINAL].result.winnerId; const finalLoser = matches[TOURNAMENT_MATCH_IDS.FINAL].result.loserId;
    const placements = { [finalWinner]: 1, [finalLoser]: 2, [winnerId]: 3, [loserId]: 4 };
    const rewardData = applyRewards({ ...state, playerStats }, placements);
    return { ...state, playerStats: rewardData.playerStats, rewards: rewardData.rewards, phase: MODE_PHASES.RESULTS, winnerId: finalWinner, secondPlaceId: finalLoser, thirdPlaceId: winnerId, fourthPlaceId: loserId, status: 'finished', matches, updatedAt: Date.now() };
  }
  return { ...state, playerStats, matches, updatedAt: Date.now() };
}

export function startNextTournamentMatches(state, targetsByMatch) {
  if (state.phase !== MODE_PHASES.TRANSITION) return state;
  let next = { ...state, roundNumber: 1, phase: MODE_PHASES.PLAYING, transitionEndTimestamp: null, updatedAt: Date.now() };
  for (const matchId of [TOURNAMENT_MATCH_IDS.FINAL, TOURNAMENT_MATCH_IDS.CONSOLATION]) next = startMatch(next, matchId, targetsByMatch[matchId] || {});
  return next;
}
