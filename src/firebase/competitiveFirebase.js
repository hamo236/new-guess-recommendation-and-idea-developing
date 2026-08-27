import { child, get, onDisconnect, onValue, ref, remove, runTransaction, set, update } from 'firebase/database';
import { db } from './config.js';
import { clone } from '../modes/modeTypes.js';
import { normalizeRoomCode } from '../game/roomManager.js';
import { createJoinDiagnostic, addJoinDiagnosticError } from './joinDiagnostics.js';

const ROOTS = { tournament: 'tournamentRooms', team_battle: 'teamRooms' };
const PRIVATE_ROOTS = { tournament: 'tournamentPrivateTargets', team_battle: 'teamBattlePrivateTargets' };

function roomRef(mode, roomId) {
  if (!db) return null;
  const root = ROOTS[mode];
  if (!root) throw new Error(`Unsupported competitive mode: ${mode}`);
  return ref(db, `${root}/${roomId}`);
}

function privateTargetRef(mode, roomId, matchId, playerId) {
  if (!db) return null;
  if (mode === 'team_battle') return ref(db, `${PRIVATE_ROOTS.team_battle}/${roomId}/${playerId}/${matchId}/target`);
  return ref(db, `${PRIVATE_ROOTS.tournament}/${roomId}/${playerId}/${matchId}/target`);
}

function competitiveJoinError(error, stage, fallbackCode = 'room/join-failed') {
  const enriched = error instanceof Error ? error : new Error(String(error || 'Competitive room join failed.'));
  if (!enriched.code) enriched.code = fallbackCode;
  if (!enriched.joinDiagnostic) enriched.joinDiagnostic = createJoinDiagnostic({ stage, error: enriched });
  return addJoinDiagnosticError(enriched, enriched.joinDiagnostic);
}

function policyJoinError(stage, code, message) {
  const error = new Error(message);
  error.code = code;
  return competitiveJoinError(error, stage, code);
}

const COMPETITIVE_JOIN_READ_ATTEMPTS = 3;
const COMPETITIVE_JOIN_RETRY_DELAYS_MS = [250, 600];

function waitForCompetitiveJoinRetry(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function readCompetitiveRoomWithRetry(target) {
  let lastError = null;
  for (let attempt = 1; attempt <= COMPETITIVE_JOIN_READ_ATTEMPTS; attempt += 1) {
    try {
      return await get(target);
    } catch (error) {
      lastError = error;
      if (attempt < COMPETITIVE_JOIN_READ_ATTEMPTS) {
        await waitForCompetitiveJoinRetry(COMPETITIVE_JOIN_RETRY_DELAYS_MS[attempt - 1] || 600);
      }
    }
  }
  throw lastError || new Error('Competitive room read failed.');
}

export function getCompetitiveNamespace(mode) {
  return ROOTS[mode];
}

export function subscribeCompetitiveConnection({ onConnection, onError }) {
  if (!db) {
    onConnection?.(null);
    return () => {};
  }
  return onValue(ref(db, '.info/connected'), (snapshot) => {
    onConnection?.(snapshot.val() === true);
  }, onError);
}

const JOIN_SLOT_IDS = ['slot-1', 'slot-2', 'slot-3', 'slot-4'];
const TEAM_SEAT_IDS = ['team_a_1', 'team_a_2', 'team_a_3', 'team_b_1', 'team_b_2', 'team_b_3'];

function teamSeatIds(teamId) {
  return teamId === 'team_a'
    ? ['team_a_1', 'team_a_2', 'team_a_3']
    : ['team_b_1', 'team_b_2', 'team_b_3'];
}

function teamSeatForJoinSlot(slotId) {
  return { 'slot-1': 'team_a_1', 'slot-2': 'team_a_2', 'slot-3': 'team_b_1', 'slot-4': 'team_b_2' }[slotId] || null;
}

function joinSlotsRef(mode, roomId) {
  const target = roomRef(mode, roomId);
  return target ? child(target, 'joinSlots') : null;
}

function slotNumber(slotId) {
  return Number(String(slotId).replace('slot-', ''));
}

function teamForSlot(mode, slotId) {
  if (mode !== 'team_battle') return null;
  return slotNumber(slotId) <= 2 ? 'team_a' : 'team_b';
}

function setupPresence(mode, roomId, playerId) {
  const target = roomRef(mode, roomId);
  if (!target) return;
  const presenceRef = child(target, `players/${playerId}/connected`);
  onDisconnect(presenceRef).set(false);
}

async function reserveCompetitiveSlot({ mode, roomId, playerId, roomSnapshot }) {
  const slots = roomSnapshot?.joinSlots || {};
  const existing = JOIN_SLOT_IDS.find((slotId) => slots[slotId]?.playerId === playerId);
  if (existing) return { slotId: existing, committed: false, reconnect: true };
  for (const slotId of JOIN_SLOT_IDS.slice(1)) {
    const target = child(joinSlotsRef(mode, roomId), slotId);
    const result = await runTransaction(target, (current) => {
      if (current?.playerId) return;
      return { playerId, joinOrder: slotNumber(slotId), reservedAt: Date.now() };
    });
    if (result.committed && result.snapshot.val()?.playerId === playerId) return { slotId, committed: true, reconnect: false };
  }
  return { slotId: null, committed: false, reconnect: false };
}

async function claimTeamSeat({ mode, roomId, teamId, playerId }) {
  const seats = teamSeatIds(teamId);
  for (const seatId of seats) {
    const result = await runTransaction(child(roomRef(mode, roomId), `teamSeats/${seatId}`), (current) => {
      if (current?.playerId) return;
      return { playerId, claimedAt: Date.now() };
    });
    if (result.committed && result.snapshot.val()?.playerId === playerId) return seatId;
  }
  return null;
}

async function releaseTeamSeat({ mode, roomId, seatId, playerId, allowHostRelease = false }) {
  if (!seatId) return;
  await runTransaction(child(roomRef(mode, roomId), `teamSeats/${seatId}`), (current) => {
    if (current?.playerId === playerId || (allowHostRelease && current?.playerId)) return null;
    return current;
  });
}

async function releaseCompetitiveSlot({ mode, roomId, slotId, playerId, allowHostRelease = false }) {
  if (!slotId) return;
  const target = child(joinSlotsRef(mode, roomId), slotId);
  await runTransaction(target, (current) => {
    if (current?.playerId === playerId) return null;
    if (allowHostRelease && current?.playerId) return null;
    return current;
  });
}

export async function createCompetitiveRoom({ mode, roomId, player, category }) {
  const normalizedRoomId = normalizeRoomCode(roomId);
  const target = roomRef(mode, normalizedRoomId);
  if (!target) throw new Error('Firebase not configured');
  const playerRecord = { ...clone(player), isHost: true, connected: true, joinOrder: 1, teamId: mode === 'team_battle' ? 'team_a' : null };
  const result = await runTransaction(target, (current) => current || {
    roomId: normalizedRoomId,
    mode,
    status: 'lobby',
    phase: 'lobby',
    category,
    roundNumber: 0,
    hostId: player.id,
    players: { [player.id]: playerRecord },
    joinSlots: Object.fromEntries(JOIN_SLOT_IDS.map((slotId) => [slotId, slotId === 'slot-1' ? { playerId: player.id, joinOrder: 1, reservedAt: Date.now() } : null])),
    ...(mode === 'team_battle' ? { teams: { team_a: { teamId: 'team_a', playerIds: [player.id] }, team_b: { teamId: 'team_b', playerIds: [] } }, teamSeats: Object.fromEntries(TEAM_SEAT_IDS.map((seatId) => [seatId, seatId === 'team_a_1' ? { playerId: player.id, claimedAt: Date.now() } : null])) } : {}),
    updatedAt: Date.now(),
  });
  if (!result.committed) throw new Error('Room already exists.');
  setupPresence(mode, normalizedRoomId, player.id);
  return result.snapshot.val();
}

export async function joinCompetitiveRoom({ mode, roomId, player }) {
  const normalizedRoomId = normalizeRoomCode(roomId);
  const target = roomRef(mode, normalizedRoomId);
  if (!target) throw policyJoinError('firebase-config', 'firebase/not-configured', 'Firebase is not configured for this mode.');

  let initialSnapshot;
  try {
    initialSnapshot = await readCompetitiveRoomWithRetry(target);
  } catch (error) {
    throw competitiveJoinError(error, 'room-read', error?.code || 'room/network-unreachable');
  }
  if (!initialSnapshot.exists()) throw policyJoinError('room-read', 'room/not-found', `Room ${normalizedRoomId} was not found on the server. Check the code and try again.`);
  const initialRoom = initialSnapshot.val();
  if (initialRoom.removedPlayers?.[player.id]) throw policyJoinError('room-policy', 'room/player-removed', 'You were removed from this room.');

  const existingPlayer = initialRoom.players?.[player.id];
  const isReconnect = Boolean(existingPlayer);
  if (!isReconnect && (initialRoom.status !== 'lobby' || initialRoom.phase !== 'lobby')) throw policyJoinError('room-policy', 'room/game-in-progress', 'This room has already started. Only returning players can reconnect.');
  if (!isReconnect && Object.keys(initialRoom.players || {}).length >= 4) throw policyJoinError('room-policy', 'room/full', 'Room is full. Ask the host to create a new room.');

    if (isReconnect) {
    try {
      await update(child(target, `players/${player.id}`), { connected: true });
      const reconnectedSnapshot = await get(target);
      setupPresence(mode, normalizedRoomId, player.id);
      return { room: reconnectedSnapshot.val(), isReconnect: true };
    } catch (error) {
      throw competitiveJoinError(error, 'post-join-verify', error?.code || 'room/reconnect-failed');
    }
  }
  let reservation;
  try {
    reservation = await reserveCompetitiveSlot({ mode, roomId: normalizedRoomId, playerId: player.id, roomSnapshot: initialRoom });
  } catch (error) {
    throw competitiveJoinError(error, 'join-slot', error?.code || 'room/join-slot-failed');
  }
  if (!reservation.slotId) throw policyJoinError('join-slot', 'room/full', 'Room is full. Ask the host to create a new room.');
  const nextPlayer = { ...clone(player), isHost: false, connected: true, joinOrder: slotNumber(reservation.slotId), teamId: teamForSlot(mode, reservation.slotId) };
  const teamSeat = mode === 'team_battle' ? await claimTeamSeat({ mode, roomId: normalizedRoomId, teamId: nextPlayer.teamId, playerId: player.id }) : null;
  if (mode === 'team_battle' && !teamSeat) {
    await releaseCompetitiveSlot({ mode, roomId: normalizedRoomId, slotId: reservation.slotId, playerId: player.id }).catch(() => {});
    throw policyJoinError('join-slot', 'room/team-full', 'No seat is available in the assigned team. Please retry.');
  }
  try {
    await set(child(target, `players/${player.id}`), nextPlayer);
  } catch (error) {
    if (teamSeat) await releaseTeamSeat({ mode, roomId: normalizedRoomId, seatId: teamSeat, playerId: player.id }).catch(() => {});
    if (reservation.committed) await releaseCompetitiveSlot({ mode, roomId: normalizedRoomId, slotId: reservation.slotId, playerId: player.id }).catch(() => {});
    throw competitiveJoinError(error, 'join-player-record', error?.code || 'room/join-player-record-failed');
  }
  const finalRoom = (await get(target)).val();
  if (!finalRoom?.players?.[player.id]) {
    if (!finalRoom) throw policyJoinError('post-join-verify', 'room/not-found', `Room ${normalizedRoomId} was not found on the server. Check the code and try again.`);
    if (finalRoom.status !== 'lobby' || finalRoom.phase !== 'lobby') throw policyJoinError('post-join-verify', 'room/game-in-progress', 'This room has already started. Only returning players can reconnect.');
    if (Object.keys(finalRoom.players || {}).length >= 4) throw policyJoinError('post-join-verify', 'room/full', 'Room is full. Ask the host to create a new room.');
    throw policyJoinError('post-join-verify', 'room/join-not-committed', 'The server did not confirm your join. Please retry.');
  }

  setupPresence(mode, normalizedRoomId, player.id);
  return { room: finalRoom, isReconnect };
}

export async function setCompetitiveTeam({ mode, roomId, playerId, teamId }) {
  if (mode !== 'team_battle' || !['team_a', 'team_b'].includes(teamId)) throw new Error('Team switching is only available in 2v2 lobby.');
  const target = roomRef(mode, roomId);
  if (!target) throw new Error('Firebase not configured');
  const current = (await get(target)).val();
  if (!current || current.status !== 'lobby' || current.phase !== 'lobby' || !current.players?.[playerId]) throw new Error('Team switching is available only for lobby players.');
  const previousTeamId = current.players[playerId].teamId;
  if (previousTeamId === teamId) return current;
  const seatSnapshot = await get(child(target, 'teamSeats'));
  const previousSeatId = seatSnapshot.exists() ? Object.entries(seatSnapshot.val() || {}).find(([, seat]) => seat?.playerId === playerId)?.[0] : null;
  const claimedSeatId = await claimTeamSeat({ mode, roomId, teamId, playerId });
  if (!claimedSeatId) throw new Error('That team is full or the room has already started.');
  try {
    await set(child(target, `players/${playerId}/teamId`), teamId);
    await releaseTeamSeat({ mode, roomId, seatId: previousSeatId, playerId });
  } catch (error) {
    await releaseTeamSeat({ mode, roomId, seatId: claimedSeatId, playerId }).catch(() => {});
    throw error;
  }
  const next = (await get(target)).val();
  if (next?.players?.[playerId]?.teamId !== teamId) throw new Error('The team change was not confirmed by the server.');
  return next;
}

export async function removeCompetitivePlayer({ mode, roomId, playerId }) {
  const target = roomRef(mode, roomId);
  if (!target) throw new Error('Firebase not configured');
  if (mode === 'team_battle') {
    const current = (await get(target)).val();
    if (!current || current.status !== 'lobby' || current.phase !== 'lobby' || !current.players?.[playerId]) throw new Error('Player removal is available only in the active lobby.');
    const slotSnapshot = await get(joinSlotsRef(mode, roomId));
    const ownedSlotId = slotSnapshot.exists() ? JOIN_SLOT_IDS.find((slotId) => slotSnapshot.val()?.[slotId]?.playerId === playerId) : null;
    const seatSnapshot = await get(child(target, 'teamSeats'));
    const ownedSeatId = seatSnapshot.exists() ? Object.entries(seatSnapshot.val() || {}).find(([, seat]) => seat?.playerId === playerId)?.[0] : null;
    await update(target, { [`players/${playerId}`]: null, [`removedPlayers/${playerId}`]: true });
    await releaseCompetitiveSlot({ mode, roomId, slotId: ownedSlotId, playerId, allowHostRelease: true });
    await releaseTeamSeat({ mode, roomId, seatId: ownedSeatId, playerId, allowHostRelease: true });
    if ((await get(child(target, `players/${playerId}`))).exists()) throw new Error('Player removal was not confirmed by the server.');
  } else {
    await update(target, { [`players/${playerId}`]: null, [`removedPlayers/${playerId}`]: true });
  }
  if (db) await remove(ref(db, `${PRIVATE_ROOTS[mode]}/${roomId}/${playerId}`));
}

export async function leaveCompetitiveRoom({ mode, roomId, playerId, isHost }) {
  const target = roomRef(mode, roomId);
  if (!target) return;
  const slotsSnapshot = !isHost ? await get(joinSlotsRef(mode, roomId)) : null;
  const ownedSlotId = slotsSnapshot?.exists() ? JOIN_SLOT_IDS.find((slotId) => slotsSnapshot.val()?.[slotId]?.playerId === playerId) : null;
  if (isHost) {
    await remove(target);
    if (db) await remove(ref(db, `${PRIVATE_ROOTS[mode]}/${roomId}`));
    return;
  }
  if (mode === 'tournament') {
    // A non-host must never delete or rewrite the tournament root. Use only the
    // member-scoped paths authorized by Rules, preserving the room for others.
    await update(target, {
      [`players/${playerId}`]: null,
      [`leftPlayers/${playerId}`]: true,
    });
    await releaseCompetitiveSlot({ mode, roomId, slotId: ownedSlotId, playerId });
    if (db) await remove(ref(db, `${PRIVATE_ROOTS[mode]}/${roomId}/${playerId}`));
    return;
  }
  const result = await runTransaction(target, (current) => {
    if (!current || !current.players?.[playerId]) return current;
    return { ...current, players: { ...current.players, [playerId]: null }, leftPlayers: { ...(current.leftPlayers || {}), [playerId]: true }, updatedAt: Date.now() };
  });
  const next = result.snapshot.val();
  if (!result.committed || next?.players?.[playerId]) throw new Error('Leaving the lobby was rejected because the match changed. Refresh and try again.');
  await releaseCompetitiveSlot({ mode, roomId, slotId: ownedSlotId, playerId });
  if (db) await remove(ref(db, `${PRIVATE_ROOTS[mode]}/${roomId}/${playerId}`));
}

export function sanitizePublicState(state) {
  const safe = clone(state);
  // Legacy tournament rooms stored private targets under the public room node; never write that payload again.
  delete safe.private;
  if (safe?.matches) {
    safe.matches = Object.fromEntries(Object.entries(safe.matches).map(([matchId, match]) => {
      const safeMatch = { ...match };
      delete safeMatch.targets;
      if (safeMatch.guesses) safeMatch.guesses = Object.fromEntries(Object.entries(safeMatch.guesses).map(([playerId, guess]) => { const { targetId: _targetId, ...safeGuess } = guess || {}; return [playerId, safeGuess]; }));
      if (safeMatch.result) {
        const { targets: rawTargets, ...safeResult } = safeMatch.result;
        const canRevealTeamTargets = safe.mode === 'team_battle' && ['round_result', 'finished'].includes(safeMatch.status) && rawTargets;
        safeMatch.result = canRevealTeamTargets ? { ...safeResult, targets: rawTargets } : safeResult;
      }
      return [matchId, safeMatch];
    }));
  }
  if (safe?.playerStats) {
    safe.playerStats = Object.fromEntries(Object.entries(safe.playerStats).map(([playerId, stats]) => [playerId, { ...stats, roundHistory: Array.isArray(stats?.roundHistory) ? stats.roundHistory.map((entry) => { const { target: _target, guess: rawGuess, ...safeEntry } = entry || {}; const { targetId: _targetId, ...guess } = rawGuess || {}; return { ...safeEntry, ...(rawGuess ? { guess } : {}) }; }) : stats?.roundHistory }]));
  }
  if (safe?.match) {
    delete safe.match.targets;
    delete safe.match.teamTargets;
    if (safe.match.status === 'playing' && safe.match.roundSnapshot) { const { target: _target, ...safeRoundSnapshot } = safe.match.roundSnapshot; safe.match.roundSnapshot = safeRoundSnapshot; }
    if (safe.match.guesses) safe.match.guesses = Object.fromEntries(Object.entries(safe.match.guesses).map(([playerId, guess]) => { const { targetId: _targetId, ...safeGuess } = guess || {}; return [playerId, safeGuess]; }));
    if (safe.match.confirmations) safe.match.confirmations = Object.fromEntries(Object.entries(safe.match.confirmations).map(([teamId, entries]) => [teamId, Object.fromEntries(Object.entries(entries || {}).map(([playerId, confirmation]) => { const { targetSnapshot: _targetSnapshot, ...safeConfirmation } = confirmation || {}; return [playerId, safeConfirmation]; }))]));
  }
  if (Array.isArray(safe?.roundHistory)) safe.roundHistory = safe.roundHistory.map((result) => { const safeGuesses = result?.guesses ? Object.fromEntries(Object.entries(result.guesses).filter(([, guess]) => guess != null).map(([playerId, guess]) => { const { targetId: _targetId, ...safeGuess } = guess || {}; return [playerId, safeGuess]; })) : null; const { completedRoundTarget: _completedRoundTarget, guesses: _guesses, ...safeResult } = result || {}; return safeGuesses ? { ...safeResult, guesses: safeGuesses } : safeResult; });
  return safe;
}

export async function submitTournamentGuess({ roomId, matchId, confirmerId, guesserId, roundNumber }) {
  const target = roomRef('tournament', roomId);
  if (!target) throw new Error('Firebase not configured');
  const guessRef = child(target, `matches/${matchId}/guesses/${confirmerId}`);
  const result = await runTransaction(guessRef, (current) => current || {
    playerId: confirmerId,
    confirmerId,
    guesserId,
    roundNumber: Number(roundNumber),
    confirmed: true,
    correct: true,
    timestamp: Date.now(),
  });
  if (!result.committed) throw new Error('Guess confirmation was rejected because the round changed.');
  return result.snapshot.val();
}

export async function submitTeamConfirmation({ roomId, matchId, teamId, playerId, roundNumber }) {
  const target = roomRef('team_battle', roomId);
  if (!target) throw new Error('Firebase not configured');
  const confirmationRef = child(target, `match/confirmations/${teamId}/${playerId}`);
  const result = await runTransaction(confirmationRef, (current) => current || {
    playerId,
    teamId,
    matchId,
    roundNumber: Number(roundNumber),
    confirmedAt: Date.now(),
  });
  if (!result.committed) throw new Error('Team confirmation was rejected because the round changed.');
  return result.snapshot.val();
}

export async function mutateCompetitiveState({ mode, roomId, mutate }) {
  const target = roomRef(mode, roomId);
  if (!target) throw new Error('Firebase not configured');
  const result = await runTransaction(target, (current) => (current ? sanitizePublicState(mutate(clone(current))) : current));
  return result.snapshot.val();
}

export async function writeCompetitiveState({ mode, roomId, state }) {
  const target = roomRef(mode, roomId);
  if (!target) throw new Error('Firebase not configured');
  await set(target, { ...sanitizePublicState(state), roomId, mode, updatedAt: Date.now() });
}

export async function writeCompetitiveTarget({ mode, roomId, matchId, playerId, target }) {
  const targetRef = privateTargetRef(mode, roomId, matchId, playerId);
  if (!targetRef) throw new Error('Firebase not configured');
  await set(targetRef, clone({ ...target, playerId, targetId: target.targetId || target.id, matchId, targetReady: true }));
}

export function subscribeCompetitiveTarget({ mode, roomId, matchId, playerId, onTarget, onError }) {
  const target = privateTargetRef(mode, roomId, matchId, playerId);
  if (!target) return () => {};
  return onValue(target, (snapshot) => onTarget(snapshot.exists() ? snapshot.val() : null), onError);
}

export function subscribeCompetitiveRoom({ mode, roomId, onState, onError }) {
  const target = roomRef(mode, roomId);
  if (!target) return () => {};
  return onValue(target, (snapshot) => onState(snapshot.exists() ? snapshot.val() : null), onError);
}


export function subscribeCompetitiveChat({ mode, roomId, onMessages, onError }) {
  const target = roomRef(mode, roomId);
  if (!target) { onMessages?.([]); return () => {}; }
  const messagesTarget = child(target, 'messages');
  return onValue(messagesTarget, (snapshot) => {
    const messages = Object.values(snapshot.val() || {})
      .filter((message) => message && message.type === 'chat' && typeof message.message === 'string')
      .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0))
      .slice(-100);
    onMessages?.(messages);
  }, onError);
}

export async function sendCompetitiveChatMessage({ mode, roomId, playerId, playerName, message }) {
  const target = roomRef(mode, roomId);
  const trimmed = String(message || '').trim();
  if (!target) throw new Error('Firebase not configured');
  if (!playerId || !trimmed) return;
  if (trimmed.length > 500) throw new Error('Message is too long.');
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await set(child(target, `messages/${messageId}`), {
    id: messageId,
    playerId,
    playerName: String(playerName || 'Player').slice(0, 40),
    message: trimmed,
    timestamp: Date.now(),
    type: 'chat',
  });
}
