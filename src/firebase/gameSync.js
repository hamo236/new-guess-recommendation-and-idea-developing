/**
 * src/firebase/gameSync.js
 * Synchronizes intentional game actions to Firebase RTDB.
 * Only called by GameStateContext on meaningful game actions ط£آ¢أ¢â€ڑآ¬أ¢â‚¬â€Œ NOT on every render.
 *
 * Architecture:
 *   UI ط£آ¢أ¢â‚¬آ أ¢â‚¬â„¢ GameStateContext (local reducer) ط£آ¢أ¢â‚¬آ أ¢â‚¬â„¢ gameSync ط£آ¢أ¢â‚¬آ أ¢â‚¬â„¢ Firebase
 *
 * SECRET TARGET PROTECTION:
 *   Each player's hidden assignment is retained at: privateRooms/{code}/{playerId}/ownTarget
 *   The viewer-facing opponent card is written to: privateRooms/{code}/{viewerId}/displayTarget
 *   Clients read only their own displayTarget; ownTarget is never client-readable.
 *   The shared room state does NOT contain any player's secret target.
 */

import { ref, set, update, get, push, onValue, off, runTransaction } from 'firebase/database';
import { db, isFirebaseConfigured } from './config.js';
import { getCurrentUserId } from './auth.js';

// Guard: all exports become no-ops if Firebase is not configured.
function firebaseOp(fn) {
  return async (...args) => {
    if (!isFirebaseConfigured || !db) return;
    return fn(...args);
  };
}

// ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ Write Helpers ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬

/**
 * Write preview phase state to Firebase (category pool visible, no targets yet).
 */
export const syncEnterPreview = firebaseOp(async (code, gameData) => {
  const updates = {};
  updates[`rooms/${code}/phase`] = 'preview';
  updates[`rooms/${code}/status`] = 'preview';
  updates[`rooms/${code}/round`] = gameData.round;
  updates[`rooms/${code}/roundResult`] = null;
  updates[`rooms/${code}/bracket`] = gameData.bracket ?? null;
  updates[`rooms/${code}/playerAssignments`] = gameData.playerAssignments ?? {};
  updates[`rooms/${code}/matchResults`] = gameData.matchResults ?? {};
  updates[`rooms/${code}/standings`] = gameData.standings ?? [];
  updates[`rooms/${code}/revealEndTimestamp`] = 0;
  updates[`rooms/${code}/transitionStartedAt`] = gameData.transitionStartedAt ?? 0;
  updates[`rooms/${code}/transitionEndsAt`] = gameData.transitionEndsAt ?? 0;
  updates[`rooms/${code}/timerEndTimestamp`] = 0;
  await update(ref(db), updates);
});

/**
 * Write the shared game start state to Firebase.
 * @param {string} code - Room code
 * @param {object} gameData - beginPlayingFromPreview() result from the local engine
 * @param {object} targets - { [playerId]: Item } ط£آ¢أ¢â€ڑآ¬أ¢â‚¬â€Œ each player's own secret target
 * @param {object} displayTargets - { [playerId]: Item } ط£آ¢أ¢â€ڑآ¬أ¢â‚¬â€Œ opponent target shown in UI
 */
export const syncBeginPlaying = firebaseOp(async (code, gameData, targets, displayTargets) => {
  const roomRef = ref(db, `rooms/${code}`);
  await runTransaction(roomRef, (current) => {
    if (!current) return current;
    // Idempotency guard: if room is already playing this round, do not overwrite state
    if (current.phase === 'playing' && current.round === gameData.round && current.roundId === gameData.roundId) {
      return current;
    }

    const timerEndTimestamp = gameData.timerRunning
      ? Date.now() + (gameData.timerSeconds * 1000)
      : 0;



    return {
      ...current,
      phase: gameData.phase,
      round: gameData.round,
      roundId: gameData.roundId,
      matchId: gameData.matchId,
      activePlayerIds: Object.keys(targets),
      bracket: gameData.bracket ?? current.bracket ?? null,
      playerAssignments: gameData.playerAssignments ?? current.playerAssignments ?? {},
      matchResults: gameData.matchResults ?? current.matchResults ?? {},
      standings: gameData.standings ?? current.standings ?? [],
      status: 'playing',
      currentTurnPlayerId: gameData.currentTurnPlayerId,
      usedTargetIds: gameData.usedTargetIds,
      eliminatedCards: gameData.eliminatedCards,
      votes: {},
      roundResult: null,
      transitionStartedAt: 0,
      transitionEndsAt: 0,
      timerEndTimestamp,
    };
  });

  const privateUpdates = {};
  for (const [playerId, item] of Object.entries(targets || {})) {
    privateUpdates[`privateRooms/${code}/${playerId}/ownTarget`] = {
      id: item.id,
      name: item.name,
      image: item.image,
      category: item.category,
      round: gameData.round,
      roundId: gameData.roundId,
      targetReady: true,
    };
  }
  for (const [playerId, item] of Object.entries(displayTargets || {})) {
    privateUpdates[`privateRooms/${code}/${playerId}/displayTarget`] = {
      id: item.id,
      name: item.name,
      image: item.image,
      category: item.category,
      round: gameData.round,
      roundId: gameData.roundId,
      targetReady: true,
    };
  }
  if (Object.keys(privateUpdates).length) await update(ref(db), privateUpdates);
});

/** @deprecated Use syncEnterPreview + syncBeginPlaying */
export const syncStartGame = firebaseOp(async (code, gameData, targets) => {
  await syncBeginPlaying(code, gameData, targets, gameData.displayTargets ?? {});
});

/**
 * Write one idempotent UID-owned action for the active original 3ط£آ¢أ¢â€ڑآ¬أ¢â‚¬إ“4 round.
 * The round/player path prevents duplicate submissions from producing extra points.
 */
export const syncImpostorAction = firebaseOp(async (code, action) => {
  if (!action?.roundId || !action?.actorId || !action?.actorUid || !action?.opponentUid || !action?.matchId || !action?.matchRound) throw new Error('invalid action contract');
  const authenticatedUid = getCurrentUserId();
  if (!authenticatedUid || authenticatedUid !== action.actorUid) throw new Error('invalid actor');
  const roomRef = ref(db, 'rooms/' + code);
  await runTransaction(roomRef, (current) => {
    if (!current || current.mode !== 'social' || current.phase !== 'playing' || current.roundId !== action.roundId) return current;
    const match = current.bracket?.matches?.[action.matchId];
    const assignment = current.playerAssignments?.[action.actorId];
    if (!match || match.status !== 'active') return current;
    if (match.matchRound !== action.matchRound) return current;
    if (![match.playerA, match.playerB].includes(action.actorId)) return current;
    if (assignment?.matchId !== action.matchId) return current;
    if (assignment.opponentPlayerId !== action.opponentUid) return current;
    if (action.targetPlayerId !== action.opponentUid || ![match.playerA, match.playerB].includes(action.opponentUid)) return current;
    if (current.actions?.[action.roundId]?.[action.matchId]?.[action.matchRound]?.[action.actorId]) return current;
    return { ...current, actions: { ...(current.actions || {}), [action.roundId]: { ...(current.actions?.[action.roundId] || {}), [action.matchId]: { ...(current.actions?.[action.roundId]?.[action.matchId] || {}), [action.matchRound]: { ...(current.actions?.[action.roundId]?.[action.matchId]?.[action.matchRound] || {}), [action.actorId]: { ...action, createdAt: action.createdAt ?? Date.now() } } } } } };
  });
});

/**
 * Write a chat message to Firebase.
 */
export const syncSendChatMessage = firebaseOp(async (code, messageData) => {
  const msgRef = ref(db, `rooms/${code}/messages/${messageData.id}`);
  await set(msgRef, messageData);
});

/** @deprecated Use syncSendChatMessage */
export const syncSubmitQuestion = syncSendChatMessage;

/**
 * Update an existing question with an answer.
 */
export const syncAnswerQuestion = firebaseOp(async (code, questionId, answer) => {
  const msgRef = ref(db, `rooms/${code}/messages/${questionId}/answer`);
  await set(msgRef, answer);
});

/**
 * Resolve exactly one original 3ط£آ¢أ¢â€ڑآ¬أ¢â‚¬إ“4 knockout match. Unrelated matches remain active.
 */
export const syncResolveKnockoutMatch = firebaseOp(async (code, nextState, matchId, roundResult) => {
  if (!roundResult?.roundId || !matchId) return;
  const roomRef = ref(db, `rooms/${code}`);
  await runTransaction(roomRef, (current) => {
    if (!current || current.phase !== 'playing' || current.roundId !== roundResult.roundId) return current;
    const previousResult = current.matchResults?.[matchId];
    const sameMatchRound = previousResult
      && previousResult.roundId === roundResult.roundId
      && previousResult.matchRound === roundResult.matchRound;
    if (sameMatchRound) return current;
    const isKnockoutRoom = current.mode === 'social'
      && Object.keys(current.players || {}).length === 4
      && current.bracket;
    const keepPlayingForIndependentMatch = isKnockoutRoom
      && nextState.phase === 'playing';
    const completedMatch = current.bracket?.matches?.[matchId];
    const completedPlayerIds = [completedMatch?.playerA, completedMatch?.playerB].filter(Boolean);
    const isOpeningFinalsRound = (completedMatch?.stage === 'final' || completedMatch?.stage === 'third_place')
      && roundResult.matchRound === 1;
    const completedRevealedTargets = {};
    completedPlayerIds.forEach((playerId) => {
      const snapshot = isOpeningFinalsRound
        ? roundResult.revealedTargets?.[playerId]
        : roundResult.revealedTargets?.[playerId];
      if (snapshot) completedRevealedTargets[playerId] = snapshot;
    });
    const completedRoundResult = {
      ...roundResult,
      revealedTargets: Object.keys(completedRevealedTargets).length === completedPlayerIds.length
        ? completedRevealedTargets
        : (roundResult.revealedTargets || {}),
    };
    const completedBracket = nextState.bracket
      ? {
          ...nextState.bracket,
          matches: {
            ...(nextState.bracket.matches || {}),
            [matchId]: {
              ...(nextState.bracket.matches?.[matchId] || {}),
              roundResult: completedRoundResult,
            },
          },
        }
      : nextState.bracket;
    const resolvedMatch = nextState.bracket?.matches?.[matchId]?.status === 'resolved';
    const nextMatchResults = { ...(current.matchResults || {}) };
    if (resolvedMatch) {
      nextMatchResults[matchId] = completedRoundResult;
    } else {
      delete nextMatchResults[matchId];
    }
    nextMatchResults[`${matchId}_round_${completedRoundResult.matchRound}`] = completedRoundResult;
    return {
      ...current,
      scores: nextState.scores,
      // Knockout results belong to the resolved match only. Keep the room
      // playing only while another independently active match remains.
      roundResult: isKnockoutRoom ? null : completedRoundResult,
      matchResults: nextMatchResults,
      bracket: completedBracket,
      playerAssignments: nextState.playerAssignments,
      standings: nextState.standings || [],
      phase: nextState.phase,
      status: nextState.phase === 'preview'
        ? 'preview'
        : nextState.phase === 'results'
          ? 'results'
          : 'playing',
      round: nextState.round,
      roundId: nextState.roundId,
      transitionStartedAt: nextState.transitionStartedAt ?? 0,
      transitionEndsAt: nextState.transitionEndsAt ?? 0,
       revealEndTimestamp: isKnockoutRoom ? 0 : (roundResult.revealEndTimestamp ?? 0),
      timerEndTimestamp: isKnockoutRoom
        ? (keepPlayingForIndependentMatch ? (current.timerEndTimestamp ?? 0) : 0)
        : (nextState.phase === 'preview' ? 0 : current.timerEndTimestamp ?? 0),
        };
  });

  if (nextState.phase === 'playing' && nextState.targets) {
    const privateUpdates = {};
    const activeMatch = nextState.bracket?.matches?.[matchId];
    [activeMatch?.playerA, activeMatch?.playerB].filter(Boolean).forEach((playerId) => {
      const item = nextState.targets[playerId];
      if (!item) return;
      const assignment = nextState.playerAssignments?.[playerId];
      const itemMatch = nextState.bracket?.matches?.[assignment?.matchId];
      privateUpdates[`privateRooms/${code}/${playerId}/ownTarget`] = {
        id: item.id, name: item.name, image: item.image, category: item.category,
        round: nextState.round, roundId: nextState.roundId,
        matchId: assignment?.matchId ?? null, matchRound: itemMatch?.matchRound ?? null, targetReady: true,
      };
      const displayItem = nextState.displayTargets?.[playerId];
      if (displayItem) privateUpdates[`privateRooms/${code}/${playerId}/displayTarget`] = {
        id: displayItem.id, name: displayItem.name, image: displayItem.image, category: displayItem.category,
        round: nextState.round, roundId: nextState.roundId, targetReady: true,
      };
    });
    if (Object.keys(privateUpdates).length) await update(ref(db), privateUpdates);
  }
});

/**
 * Synchronize opponent-confirmed correct guess and round lock with reveal data.
 */
export const syncConfirmOpponentGuess = firebaseOp(async (code, newScores, roundResult, revealEndTimestamp) => {
  if (!roundResult?.roundId) return;
  const roomRef = ref(db, `rooms/${code}`);
  await runTransaction(roomRef, (current) => {
    if (!current || current.phase !== 'playing' || current.roundId !== roundResult.roundId) {
      return current;
    }
    const roomPlayers = Object.values(current.players || {});
    const revealedTargets = roundResult.revealedTargets || {};
    const persistedRoundResult = {
      ...roundResult,
      revealedTargets: roomPlayers.length === 2 && Object.keys(revealedTargets).length === 2
        ? revealedTargets
        : {},
    };

    return {
      ...current,
      scores: newScores,
      phase: 'round_end',
      status: 'round_end',
      roundResult: persistedRoundResult,
      roundResults: {
        ...(current.roundResults || {}),
        [roundResult.roundId]: persistedRoundResult,
      },
       revealEndTimestamp: revealEndTimestamp ?? roundResult.revealEndTimestamp ?? 0,
      timerEndTimestamp: 0,
    };
  });
});

/** @deprecated Use syncConfirmOpponentGuess */
export const syncDeclareCorrectGuess = syncConfirmOpponentGuess;

/**
 * Synchronize a guess action and its result.
 */
export const syncSubmitGuess = firebaseOp(async (code, guessEntry, newScores, eliminatedCards, nextPhase, currentTurnPlayerId, roundResult) => {
  const updates = {};
  updates[`rooms/${code}/messages/${guessEntry.id}`] = guessEntry;
  updates[`rooms/${code}/scores`] = newScores;
  updates[`rooms/${code}/eliminatedCards`] = eliminatedCards;
  updates[`rooms/${code}/phase`] = nextPhase;
  updates[`rooms/${code}/currentTurnPlayerId`] = currentTurnPlayerId;
  if (roundResult) {
    updates[`rooms/${code}/roundResult`] = roundResult;
  }
  await update(ref(db), updates);
});

/**
 * Sync a player's manual card elimination (toggle).
 * This is a local-only action ط£آ¢أ¢â€ڑآ¬أ¢â‚¬â€Œ only that player's board changes.
 * We sync it so re-joining restores their eliminated cards.
 */
export const syncToggleEliminate = firebaseOp(async (code, playerId, eliminatedCards) => {
  const elimRef = ref(db, `rooms/${code}/eliminatedCards/${playerId}`);
  await set(elimRef, eliminatedCards);
});

/**
 * Write a vote in social deduction mode.
 */
export const syncCastVote = firebaseOp(async (code, voterId, targetId) => {
  const voteRef = ref(db, `rooms/${code}/votes/${voterId}`);
  await set(voteRef, { voterId, targetId, timestamp: Date.now() });
});

/**
 * Host resolves voting: write final scores and advance phase to ROUND_END.
 * Only the host should call this to prevent duplicate resolution.
 */
export const syncResolveVoting = firebaseOp(async (code, newScores) => {
  const updates = {};
  updates[`rooms/${code}/scores`] = newScores;
  updates[`rooms/${code}/phase`] = 'round_end';
  updates[`rooms/${code}/timerEndTimestamp`] = 0;
  await update(ref(db), updates);
});

/**
 * Advance to next round or final results.
 * Only the host should call this.
 */
export const syncAdvanceRound = firebaseOp(async (code, nextState) => {
  const updates = {};
  updates[`rooms/${code}/phase`] = nextState.phase;
  updates[`rooms/${code}/round`] = nextState.round;
  updates[`rooms/${code}/roundId`] = nextState.roundId;
  updates[`rooms/${code}/transitionStartedAt`] = nextState.transitionStartedAt ?? 0;
  updates[`rooms/${code}/transitionEndsAt`] = nextState.transitionEndsAt ?? 0;
  updates[`rooms/${code}/matchId`] = nextState.matchId;
  updates[`rooms/${code}/currentTurnPlayerId`] = nextState.currentTurnPlayerId;
  updates[`rooms/${code}/usedTargetIds`] = nextState.usedTargetIds;
  updates[`rooms/${code}/eliminatedCards`] = nextState.eliminatedCards;
  updates[`rooms/${code}/votes`] = {};
  updates[`rooms/${code}/roundResult`] = nextState.roundResult ?? null;
  updates[`rooms/${code}/bracket`] = nextState.bracket ?? null;
  updates[`rooms/${code}/playerAssignments`] = nextState.playerAssignments ?? {};
  updates[`rooms/${code}/matchResults`] = nextState.matchResults ?? {};
  updates[`rooms/${code}/standings`] = nextState.standings ?? [];
  updates[`rooms/${code}/revealEndTimestamp`] = 0;

  if (nextState.phase === 'preview') {
    updates[`rooms/${code}/status`] = 'preview';
    updates[`rooms/${code}/timerEndTimestamp`] = 0;
  } else if (nextState.timerRunning) {
    updates[`rooms/${code}/timerEndTimestamp`] = Date.now() + (nextState.timerSeconds * 1000);
  } else {
    updates[`rooms/${code}/timerEndTimestamp`] = 0;
  }

  // Write new private targets when beginning a round from preview
  if (nextState.phase === 'playing' && nextState.targets) {
    for (const [playerId, item] of Object.entries(nextState.targets)) {
      const assignment = nextState.playerAssignments?.[playerId]; const itemMatch = nextState.bracket?.matches?.[assignment?.matchId]; const itemData = { id: item.id, name: item.name, image: item.image, category: item.category, round: nextState.round, roundId: nextState.roundId, matchId: assignment?.matchId ?? null, matchRound: itemMatch?.matchRound ?? null, targetReady: true };
      updates[`privateRooms/${code}/${playerId}/ownTarget`] = itemData;
    }
    if (nextState.displayTargets) {
      for (const [playerId, item] of Object.entries(nextState.displayTargets)) {
        updates[`privateRooms/${code}/${playerId}/displayTarget`] = {
          id: item.id,
          name: item.name,
          image: item.image,
          category: item.category,
          round: nextState.round,
          roundId: nextState.roundId,
          targetReady: true,
        };
      }
    }

  }

  await update(ref(db), updates);
});

/**
 * Synchronize a post-game category selection for the existing room.
 */
export const syncSetCategory = firebaseOp(async (code, category) => {
  await update(ref(db), { [`rooms/${code}/category`]: category });
});

/**
 * Reset match ط£آ¢أ¢â€ڑآ¬أ¢â‚¬â€Œ write clean lobby state.
 */
export const syncResetMatch = firebaseOp(async (code, players, category) => {
  const freshScores = {};
  const freshEliminated = {};
  Object.keys(players).forEach((pid) => {
    freshScores[pid] = 0;
    freshEliminated[pid] = [];
  });

  const updates = {};
  updates[`rooms/${code}/phase`] = 'lobby';
  updates[`rooms/${code}/status`] = 'lobby';
  if (category !== undefined) updates[`rooms/${code}/category`] = category;
  updates[`rooms/${code}/round`] = 1;
  updates[`rooms/${code}/roundId`] = null;
  updates[`rooms/${code}/bracket`] = null;
  updates[`rooms/${code}/playerAssignments`] = {};
  updates[`rooms/${code}/matchResults`] = {};
  updates[`rooms/${code}/standings`] = [];
  updates[`rooms/${code}/transitionStartedAt`] = 0;
  updates[`rooms/${code}/transitionEndsAt`] = 0;
  updates[`rooms/${code}/currentTurnPlayerId`] = null;
  updates[`rooms/${code}/scores`] = freshScores;
  updates[`rooms/${code}/eliminatedCards`] = freshEliminated;
  updates[`rooms/${code}/usedTargetIds`] = [];
  updates[`rooms/${code}/votes`] = {};
  updates[`rooms/${code}/roundResult`] = null;
  updates[`rooms/${code}/revealEndTimestamp`] = 0;
  updates[`rooms/${code}/timerEndTimestamp`] = 0;
  updates[`rooms/${code}/messages`] = {};
  Object.keys(players || {}).forEach((playerId) => {
    updates[`privateRooms/${code}/${playerId}/ownTarget`] = null;
    updates[`privateRooms/${code}/${playerId}/displayTarget`] = null;
  });
  await update(ref(db), updates);
});

// ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ Realtime Subscription ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬ط£آ¢أ¢â‚¬â€Œأ¢â€ڑآ¬

/**
 * Subscribe to all real-time room events.
 * Returns an unsubscribe function for cleanup.
 *
 * @param {string} code - Room code
 * @param {object} callbacks
 * @param {function} callbacks.onRoomUpdate   - called with full room snapshot
 * @param {function} callbacks.onMessagesUpdate - called with messages snapshot
 * @param {function} callbacks.onActionsUpdate - called with action map for the active round
 * @returns {function} unsubscribe - call on component unmount
 */
export function subscribeToRoom(code, { onRoomUpdate, onMessagesUpdate, onActionsUpdate }) {
  if (!isFirebaseConfigured || !db) return () => {};

  const roomRef = ref(db, `rooms/${code}`);
  const messagesRef = ref(db, `rooms/${code}/messages`);
  const actionsRef = ref(db, `rooms/${code}/actions`);

  const roomUnsub = onValue(roomRef, (snap) => {
    onRoomUpdate(snap.exists() ? snap.val() : null);
  });

  const msgUnsub = onValue(messagesRef, (snap) => {
    if (snap.exists()) {
      onMessagesUpdate(Object.values(snap.val()));
    } else {
      onMessagesUpdate([]);
    }
  });

  const actionsUnsub = onValue(actionsRef, (snap) => {
    onActionsUpdate?.(snap.exists() ? snap.val() : {});
  });

  return () => {
    roomUnsub?.();
    msgUnsub?.();
    actionsUnsub?.();
    off(roomRef);
    off(messagesRef);
    off(actionsRef);
  };
}

/**
 * Subscribe to a player's private display target (opponent's secret ط£آ¢أ¢â€ڑآ¬أ¢â‚¬â€Œ shown in UI).
 */
export function subscribeToDisplayTarget(code, playerId, onTarget) {
  if (!isFirebaseConfigured || !db) return () => {};

  const displayRef = ref(db, `privateRooms/${code}/${playerId}/displayTarget`);

  const unsub = onValue(displayRef, (snap) => {
    if (snap.exists()) {
      onTarget(snap.val());
    }
  });

  return () => off(displayRef);
}

/**
 * Subscribe to a player's private target (secret target).
 * Only readable by the authenticated player themselves (enforced by RTDB rules).
 *
 * @param {string} code
 * @param {string} playerId
 * @param {function} onTarget - callback with {id, name, image, category}
 * @returns {function} unsubscribe
 */
export function subscribeToPrivateTarget(code, playerId, onTarget) {
  if (!isFirebaseConfigured || !db) return () => {};

  const privateRef = ref(db, `privateRooms/${code}/${playerId}/ownTarget`);


  const handleSnap = (snap) => {
    if (snap.exists()) onTarget(snap.val());
  };

  onValue(privateRef, handleSnap);

  return () => {
    off(privateRef);

  };
}






