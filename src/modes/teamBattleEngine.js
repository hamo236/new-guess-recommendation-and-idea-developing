import { clone, COMPETITIVE_MODES, MODE_PHASES } from './modeTypes.js';

export const TEAM_IDS = { A: 'team_a', B: 'team_b' };

const createPlayerStats = (player, teamId) => ({ playerId: player.id, teamId, score: 0, guesses: 0, correctGuesses: 0, roundHistory: [], reward: null });

export function createTeamConfirmations(teams = {}) {
  return Object.fromEntries(Object.values(teams).map((team) => [team.teamId, {}]));
}

export function getTeamConfirmationStatus(state, teamId) {
  const team = state?.teams?.[teamId];
  const confirmations = state?.match?.confirmations?.[teamId] || {};
  const requiredPlayerIds = team?.playerIds || [];
  const confirmedPlayerIds = requiredPlayerIds.filter((playerId) => confirmations[playerId]?.roundNumber === state?.roundNumber && confirmations[playerId]?.matchId === state?.match?.matchId);
  return { teamId, requiredPlayerIds, confirmedPlayerIds, confirmedCount: confirmedPlayerIds.length, requiredCount: requiredPlayerIds.length, complete: requiredPlayerIds.length > 0 && confirmedPlayerIds.length === requiredPlayerIds.length };
}

export function getRequiredConfirmationTeams(state) {
  const explicitTeams = Array.isArray(state?.match?.confirmationTeamIds) ? state.match.confirmationTeamIds : [];
  const legacyTeam = state?.match?.confirmationTeamId;
  const confirmedTeams = Object.values(state?.teams || {}).map((team) => team.teamId).filter((teamId) => Object.values(state?.match?.confirmations?.[teamId] || {}).some((entry) => entry?.roundNumber === state?.roundNumber && entry?.matchId === state?.match?.matchId));
  const guessedTeams = Object.values(state?.match?.guesses || {}).filter((guess) => guess?.correct).map((guess) => guess.opponentTeamId || state.teamByPlayer?.[guess.targetOwnerId]).filter(Boolean);
  return [...new Set([...explicitTeams, ...(legacyTeam ? [legacyTeam] : []), ...confirmedTeams, ...guessedTeams])].filter((teamId) => state?.teams?.[teamId]);
}

export function areAllRequiredTeamConfirmationsComplete(state) {
  const requiredTeams = getRequiredConfirmationTeams(state);
  return requiredTeams.length > 0 && requiredTeams.every((teamId) => getTeamConfirmationStatus(state, teamId).complete);
}

export function getCompletedConfirmationTeams(state) {
  return getRequiredConfirmationTeams(state).filter((teamId) => getTeamConfirmationStatus(state, teamId).complete);
}

export function hasResolvableTeamConfirmation(state) {
  return getCompletedConfirmationTeams(state).length > 0;
}

export function areAllTeamConfirmationsComplete(state) {
  return areAllRequiredTeamConfirmationsComplete(state);
}

export function confirmTeamRound(state, playerId, timestamp = Date.now(), { targetSnapshot = null } = {}) {
  if (!state || state.match?.status !== 'playing' || !state.players?.[playerId]) return state;
  const snapshotTargetId = targetSnapshot?.targetId || targetSnapshot?.id;
  if (!snapshotTargetId || !targetSnapshot?.name) return state;
  const teamId = state.teamByPlayer?.[playerId];
  const snapshotTeamId = targetSnapshot?.teamId && state.teams?.[targetSnapshot.teamId] ? targetSnapshot.teamId : null;
  const existingRequiredTeams = getRequiredConfirmationTeams(state);
  const requiredTeams = existingRequiredTeams.length > 0 ? existingRequiredTeams : (snapshotTeamId ? [snapshotTeamId] : []);
  if (!teamId || requiredTeams.length === 0 || !requiredTeams.includes(teamId)) return state;
  const existingConfirmation = state.match.confirmations?.[teamId]?.[playerId];
  const existingIsCurrent = existingConfirmation?.roundNumber === state.roundNumber && existingConfirmation?.matchId === state.match.matchId;
  const teamStatus = getTeamConfirmationStatus(state, teamId);
  if (existingIsCurrent) {
    // A completed pair is immutable; only withdraw an individual pending confirmation.
    if (teamStatus.complete) return state;
    const nextTeamConfirmations = { ...(state.match.confirmations?.[teamId] || {}) };
    delete nextTeamConfirmations[playerId];
    const confirmations = { ...(state.match.confirmations || {}), [teamId]: nextTeamConfirmations };
    const hasCurrentGuessEvidence = Object.values(state.match.guesses || {}).some((guess) => guess?.correct && (guess.opponentTeamId || state.teamByPlayer?.[guess.targetOwnerId]) === teamId);
    const remainingCurrentConfirmation = Object.values(nextTeamConfirmations).some((entry) => entry?.roundNumber === state.roundNumber && entry?.matchId === state.match.matchId);
    const confirmationTeamIds = [...new Set([...requiredTeams, teamId])].filter((requiredTeamId) => requiredTeamId !== teamId || remainingCurrentConfirmation || hasCurrentGuessEvidence);
    const nextConfirmationTeamId = confirmationTeamIds[0] || null;
    return { ...state, match: { ...state.match, confirmationTeamId: nextConfirmationTeamId, confirmationTeamIds, confirmations }, updatedAt: timestamp };
  }
  const confirmations = { ...(state.match.confirmations || {}), [teamId]: { ...(state.match.confirmations?.[teamId] || {}), [playerId]: { playerId, teamId, matchId: state.match.matchId, roundNumber: state.roundNumber, confirmedAt: timestamp, targetSnapshot: targetSnapshot ? clone(targetSnapshot) : null } } };
  const confirmationTeamIds = [...new Set([...requiredTeams, teamId])];
  const teamPlayers = state.teams?.[teamId]?.playerIds || [];
  const teamConfirmed = teamPlayers.length === 2 && teamPlayers.every((id) => confirmations[teamId]?.[id]?.roundNumber === state.roundNumber && confirmations[teamId]?.[id]?.matchId === state.match.matchId);
  const snapshot = state.match.roundSnapshot || (teamConfirmed && targetSnapshot ? { gameInstanceId: state.teamRoomId, matchId: state.match.matchId, roundId: `${state.match.matchId}_round_${state.roundNumber}`, roundNumber: state.roundNumber, target: clone(targetSnapshot), targetOwnerTeamId: teamId, completedAt: null } : null);
  return { ...state, match: { ...state.match, confirmationTeamId: state.match.confirmationTeamId || teamId, confirmationTeamIds, confirmations, roundSnapshot: snapshot }, updatedAt: timestamp };
}

export function validateTeamAssignments(teams = {}, playerIds = []) {
  const teamA = teams?.[TEAM_IDS.A]?.playerIds || [];
  const teamB = teams?.[TEAM_IDS.B]?.playerIds || [];
  const all = [...teamA, ...teamB];
  return playerIds.length === 4 && teamA.length === 2 && teamB.length === 2 && all.length === 4 && new Set(all).size === 4 && playerIds.every((id) => all.includes(id));
}

export function createBalancedTeamAssignments(players = []) {
  const ordered = [...players].sort((a, b) => (Number(a.joinOrder) || 999) - (Number(b.joinOrder) || 999));
  return { [TEAM_IDS.A]: { teamId: TEAM_IDS.A, playerIds: ordered.slice(0, 2).map((player) => player.id) }, [TEAM_IDS.B]: { teamId: TEAM_IDS.B, playerIds: ordered.slice(2, 4).map((player) => player.id) } };
}

export function createTeamBattleState({ teamRoomId, players, category, hostId, teamAssignments }) {
  const ids = players.map((player) => player.id);
  if (ids.length !== 4) throw new Error('Team Battle requires exactly four players.');
  const assigned = teamAssignments || createBalancedTeamAssignments(players);
  if (!validateTeamAssignments(assigned, ids)) throw new Error('Team Battle requires a valid 2v2 assignment.');
  const teams = { [TEAM_IDS.A]: { teamId: TEAM_IDS.A, playerIds: [...assigned[TEAM_IDS.A].playerIds], score: 0 }, [TEAM_IDS.B]: { teamId: TEAM_IDS.B, playerIds: [...assigned[TEAM_IDS.B].playerIds], score: 0 } };
  const teamByPlayer = Object.fromEntries(Object.entries(teams).flatMap(([teamId, team]) => team.playerIds.map((playerId) => [playerId, teamId])));
  return {
    teamRoomId, mode: COMPETITIVE_MODES.TEAM_BATTLE, category, phase: MODE_PHASES.PLAYING, roundNumber: 1, hostId, playerIds: ids,
    players: Object.fromEntries(players.map((player) => [player.id, { ...clone(player), teamId: teamByPlayer[player.id] }])),
    teams, teamByPlayer, playerStats: Object.fromEntries(players.map((player) => [player.id, createPlayerStats(player, teamByPlayer[player.id])])), rewards: {}, roundHistory: [],
    match: { matchId: `${teamRoomId}_match_1`, status: 'playing', roundNumber: 1, phase: MODE_PHASES.PLAYING, targets: {}, guesses: {}, confirmations: createTeamConfirmations(teams), confirmationTeamId: null, confirmationTeamIds: [], roundSnapshot: null, result: null, roundEndTimestamp: null, revealEndTimestamp: null },
    status: 'active', createdAt: Date.now(), updatedAt: Date.now(),
  };
}

export function assignTeamTargets(state, targets) {
  const teamTargets = Object.fromEntries(Object.values(state.teams || {}).map((team) => {
    const source = team.playerIds.map((playerId) => targets?.[playerId]).find(Boolean);
    return source ? [team.teamId, { ...clone(source), teamId: team.teamId, targetId: source.targetId || source.id, matchId: state.match.matchId, roundNumber: state.roundNumber, targetReady: true }] : [team.teamId, null];
  }));
  const safeTargets = Object.fromEntries(state.playerIds.map((playerId) => {
    const teamId = state.teamByPlayer[playerId];
    const teamTarget = teamTargets[teamId];
    return teamTarget ? [playerId, { ...clone(teamTarget), playerId, teamId: teamId }] : null;
  }).filter(Boolean));
  return { ...state, match: { ...state.match, targets: safeTargets, teamTargets, guesses: {}, confirmations: createTeamConfirmations(state.teams), confirmationTeamId: null, confirmationTeamIds: [], status: 'playing', phase: MODE_PHASES.PLAYING, roundEndTimestamp: Date.now() + 60000, revealEndTimestamp: null }, phase: MODE_PHASES.PLAYING, status: 'active', updatedAt: Date.now() };
}

function rewardForTeam(teamId, isWinner) { return { teamId, placement: isWinner ? 1 : 2, points: isWinner ? 3 : 1, awardedAt: Date.now() }; }

export function finishTeamRound(state, winningTeamId, result = {}) {
  const winningTeamIds = [...new Set(result.winningTeamIds || (Array.isArray(winningTeamId) ? winningTeamId : [winningTeamId]))].filter((teamId) => state.teams[teamId]);
  if (winningTeamIds.length === 0) throw new Error('Winning team does not exist.');
  if (state.match.status !== 'playing' || !hasResolvableTeamConfirmation(state)) return state;
  const teams = Object.fromEntries(Object.entries(state.teams).map(([teamId, team]) => [teamId, winningTeamIds.includes(teamId) ? { ...team, score: team.score + 1 } : team]));
  const guesses = clone(result.guesses || state.match.guesses || {});
  const completedAt = Date.now();
  const requiredTeamIds = getRequiredConfirmationTeams(state);
  const requestedSnapshots = result.targetSnapshots || {};
  const requestedSnapshot = result.targetSnapshot || requestedSnapshots[requiredTeamIds[0]] || null;
  const baseSnapshot = state.match.roundSnapshot || (requestedSnapshot ? { gameInstanceId: state.teamRoomId, matchId: state.match.matchId, roundId: `${state.match.matchId}_round_${state.roundNumber}`, roundNumber: state.roundNumber, target: clone(requestedSnapshot), targetOwnerTeamId: requiredTeamIds[0] || null } : null);
  const frozenSnapshot = baseSnapshot ? { ...clone(baseSnapshot), completedAt } : null;
  const revealSnapshots = Object.fromEntries(Object.entries(requestedSnapshots).filter(([, snapshot]) => snapshot).map(([teamId, snapshot]) => [teamId, { gameInstanceId: state.teamRoomId, matchId: state.match.matchId, roundId: `${state.match.matchId}_round_${state.roundNumber}`, roundNumber: state.roundNumber, target: clone(snapshot), targetOwnerTeamId: teamId, completedAt }]));
  const revealTargets = Object.fromEntries(Object.entries(revealSnapshots).flatMap(([teamId, snapshot]) => (state.teams?.[teamId]?.playerIds || []).map((playerId) => [playerId, { ...clone(snapshot.target), playerId, teamId }] )));
  const roundResult = { ...result, targets: revealTargets, gameInstanceId: state.teamRoomId, roundId: `${state.match.matchId}_round_${state.roundNumber}`, roundNumber: state.roundNumber, matchId: state.match.matchId, playerIds: [...state.playerIds], guesses, confirmationTeamId: state.match.confirmationTeamId || null, confirmationTeamIds: requiredTeamIds, winningTeamId: winningTeamIds.length === 1 ? winningTeamIds[0] : null, winningTeamIds, teamScores: { [TEAM_IDS.A]: teams[TEAM_IDS.A].score, [TEAM_IDS.B]: teams[TEAM_IDS.B].score }, revealSnapshot: frozenSnapshot, revealSnapshots, completedRoundTarget: frozenSnapshot?.target || null, completedAt };
  const playerStats = { ...state.playerStats };
  state.playerIds.forEach((playerId) => {
    const guess = guesses[playerId] || null;
    const existing = playerStats[playerId] || createPlayerStats(state.players[playerId] || { id: playerId }, state.teamByPlayer[playerId]);
    playerStats[playerId] = { ...existing, score: existing.score + (guess?.correct ? 1 : 0), guesses: existing.guesses + (guess ? 1 : 0), correctGuesses: existing.correctGuesses + (guess?.correct ? 1 : 0), roundHistory: [...(existing.roundHistory || []), { roundNumber: state.roundNumber, matchId: state.match.matchId, target: clone(revealTargets[playerId] || state.match.targets?.[playerId] || null), guess: clone(guess) }] };
  });
  const next = { ...state, teams, playerStats, roundHistory: [...(state.roundHistory || []), roundResult], updatedAt: Date.now() };
  if (next.roundNumber >= 3) {
    const otherId = winningTeamIds[0] === TEAM_IDS.A ? TEAM_IDS.B : TEAM_IDS.A;
    const winner = teams[TEAM_IDS.A].score === teams[TEAM_IDS.B].score ? (winningTeamIds[0] || TEAM_IDS.A) : (teams[TEAM_IDS.A].score > teams[TEAM_IDS.B].score ? TEAM_IDS.A : TEAM_IDS.B);
    const rewards = Object.fromEntries(next.playerIds.map((playerId) => { const teamId = next.teamByPlayer[playerId]; return [playerId, rewardForTeam(teamId, teamId === winner)]; }));
    const rewardedStats = Object.fromEntries(next.playerIds.map((playerId) => [playerId, { ...playerStats[playerId], reward: rewards[playerId] }]));
    return { ...next, rewards, playerStats: rewardedStats, phase: MODE_PHASES.RESULTS, status: 'finished', match: { ...next.match, status: 'finished', phase: MODE_PHASES.RESULTS, result: { ...roundResult, winningTeamId: winner }, revealEndTimestamp: null }, finalResult: { winningTeamId: winner, teamScores: roundResult.teamScores, playerIds: [...next.playerIds], playerStats: clone(rewardedStats), rewards } };
  }
  return { ...next, phase: MODE_PHASES.ROUND_RESULT, status: 'round_result', match: { ...next.match, status: 'round_result', phase: MODE_PHASES.ROUND_RESULT, result: roundResult, roundSnapshot: null, revealEndTimestamp: Date.now() + 5000 } };
}

export function advanceTeamRound(state, targets) {
  if (state.status !== 'round_result' || state.roundNumber >= 3) return state;
  const nextRound = state.roundNumber + 1;
  const nextMatchId = `${state.teamRoomId}_match_${nextRound}`;
  return assignTeamTargets({ ...state, roundNumber: nextRound, match: { ...state.match, matchId: nextMatchId, roundNumber: nextRound, result: null, roundSnapshot: null, revealEndTimestamp: null } }, targets);
}
