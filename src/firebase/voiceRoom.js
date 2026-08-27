import { db } from './config.js';
import {
  onValue,
  onDisconnect,
  push,
  ref,
  remove,
  set,
  update,
  serverTimestamp,
} from 'firebase/database';

const ROOT_BY_ROOM_TYPE = {
  classic: 'rooms',
  teamRooms: 'teamRooms',
  'team-battle': 'teamRooms',
  tournament: 'tournamentRooms',
};

const voiceCallsPath = (roomType, roomId) =>
  `${ROOT_BY_ROOM_TYPE[roomType] || roomType}/${roomId}/voiceCalls`;

export function getVoiceCallsRef(roomType, roomId) {
  if (!db || !roomType || !roomId) return null;
  return ref(db, voiceCallsPath(roomType, roomId));
}

export function subscribeVoiceCalls(roomType, roomId, callback) {
  const callsRef = getVoiceCallsRef(roomType, roomId);
  if (!callsRef) return () => {};
  return onValue(callsRef, (snapshot) => callback(snapshot.val() || {}));
}

export async function createVoiceCall({ roomType, roomId, scopeId, hostId, eligibleParticipantIds }) {
  const callsRef = getVoiceCallsRef(roomType, roomId);
  if (!callsRef) throw new Error('Firebase is not configured.');

  const callRef = push(callsRef);
  const eligible = Object.fromEntries(
    [...new Set(eligibleParticipantIds.filter(Boolean))].map((id) => [id, true]),
  );
  const now = Date.now();

  await set(callRef, {
    hostId,
    scopeId: scopeId || 'room',
    status: 'open',
    createdAt: now,
    expiresAt: now + (30 * 60 * 1000),
    eligible,
    participants: {},
  });
  return callRef.key;
}

export async function expandVoiceCallEligibility({ roomType, roomId, callId, eligibleParticipantIds = [] }) {
  const callRef = getVoiceCallsRef(roomType, roomId);
  if (!callRef || !callId) return;
  const eligible = Object.fromEntries(
    [...new Set(eligibleParticipantIds.filter(Boolean))].map((id) => [`eligible/${id}`, true]),
  );
  if (Object.keys(eligible).length === 0) return;
  await update(ref(callRef, callId), eligible);
}

export async function joinVoiceCall({ roomType, roomId, callId, participantId, displayName }) {
  if (!db || !roomType || !roomId || !callId || !participantId) {
    throw new Error('Voice room identity is incomplete.');
  }

  const participantRef = ref(
    db,
    `${voiceCallsPath(roomType, roomId)}/${callId}/participants/${participantId}`,
  );

  // Register disconnect cleanup before writing presence so abrupt tab/network
  // termination does not leave a stale participant when Firebase can process it.
  await onDisconnect(participantRef).remove();
  const safeDisplayName = String(displayName || 'Player').trim().slice(0, 40) || 'Player';
  await set(participantRef, {
    participantId,
    displayName: safeDisplayName,
    joinedAt: Date.now(),
    active: true,
  });

  return () => remove(participantRef);
}

export async function leaveVoiceCall({ roomType, roomId, callId, participantId }) {
  if (!db || !roomType || !roomId || !callId || !participantId) return;
  const participantRef = ref(
    db,
    `${voiceCallsPath(roomType, roomId)}/${callId}/participants/${participantId}`,
  );
  await onDisconnect(participantRef).cancel().catch(() => {});
  await remove(participantRef);
}

export function subscribeVoiceSignals({ roomType, roomId, callId, receiverId, senderId }, callback) {
  if (!db || !roomType || !roomId || !callId || !receiverId || !senderId) return () => {};
  const signalRef = ref(
    db,
    `${voiceCallsPath(roomType, roomId)}/${callId}/signals/${senderId}/${receiverId}`,
  );
  return onValue(signalRef, (snapshot) => callback(snapshot.val() || {}));
}

function serializeSessionDescription(description) {
  if (!description) return null;
  const json = typeof description.toJSON === 'function'
    ? description.toJSON()
    : { type: description.type, sdp: description.sdp };
  if (!json?.type || typeof json.sdp !== 'string' || !json.sdp.trim()) return null;
  return { type: String(json.type), sdp: json.sdp };
}

export async function removeVoiceSignal({ roomType, roomId, callId, senderId, receiverId, signalId }) {
  if (!db || !roomType || !roomId || !callId || !senderId || !receiverId || !signalId) return;
  const signalRef = ref(
    db,
    `${voiceCallsPath(roomType, roomId)}/${callId}/signals/${senderId}/${receiverId}/${signalId}`,
  );
  await remove(signalRef);
}

export async function writeVoiceSignal({ roomType, roomId, callId, senderId, receiverId, signal }) {
  if (!db || !roomType || !roomId || !callId || !senderId || !receiverId || !signal) return;
  const signalType = String(signal.type || '');
  if (!['offer', 'answer', 'candidate'].includes(signalType)) return;
  const payload = { type: signalType };
  if (signalType === 'candidate') {
    const candidate = signal.candidate?.toJSON ? signal.candidate.toJSON() : signal.candidate;
    if (!candidate || typeof candidate !== 'object' || typeof candidate.candidate !== 'string' || candidate.candidate.length > 4096) return;
    payload.candidate = {
      candidate: candidate.candidate,
      ...(candidate.sdpMid == null ? {} : { sdpMid: String(candidate.sdpMid).slice(0, 128) }),
      ...(candidate.sdpMLineIndex == null ? {} : { sdpMLineIndex: Number(candidate.sdpMLineIndex) }),
      ...(candidate.usernameFragment == null ? {} : { usernameFragment: String(candidate.usernameFragment).slice(0, 256) }),
    };
  }
  if (signalType === 'offer' || signalType === 'answer') {
    payload.description = serializeSessionDescription(signal.description);
    if (!payload.description || payload.description.sdp.length > 20000) return;
  }
  const signalRef = push(
    ref(db, `${voiceCallsPath(roomType, roomId)}/${callId}/signals/${senderId}/${receiverId}`),
  );
  await onDisconnect(signalRef).remove();
  await set(signalRef, { ...payload, createdAt: serverTimestamp() });
}
