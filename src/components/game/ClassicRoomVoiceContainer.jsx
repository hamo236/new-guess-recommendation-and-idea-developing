import VoiceRoomPanel from './VoiceRoomPanel.jsx';
import { useGameContext } from '../../context/GameStateContext';

export default function ClassicRoomVoiceContainer() {
  const { state, myPlayerId, myPlayer, GAME_MODES } = useGameContext();
  const mode = state?.mode;
  const isClassic = mode === GAME_MODES.ONE_V_ONE || mode === GAME_MODES.SOCIAL;
  const isFourPlayerSocial = mode === GAME_MODES.SOCIAL && (state?.players?.length || 0) > 2;
  if (!isClassic || !state?.roomCode || !myPlayerId || !state.players?.length) return null;

  const activeMatchId = isFourPlayerSocial ? state.playerAssignments?.[myPlayerId]?.matchId : null;
  const voiceScopeId = isFourPlayerSocial ? (activeMatchId || state.matchId || 'room') : 'room';
  const voiceRoomId = isFourPlayerSocial && voiceScopeId !== 'room'
    ? `${state.roomCode}:${voiceScopeId}`
    : state.roomCode;
  const eligibleParticipantIds = isFourPlayerSocial
    ? (activeMatchId
      ? [state.playerAssignments?.[myPlayerId]?.opponentPlayerId, myPlayerId].filter(Boolean)
      : state.players.map((player) => player.id))
    : state.players.map((player) => player.id);

  return (
    <div className="ng-room-voice-container rounded-[1.35rem] border border-primary-fixed/20 bg-surface/70 p-1 shadow-[0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur-md" role="group" aria-label="Room voice controls">
      <VoiceRoomPanel
        key={`${voiceRoomId}:${voiceScopeId}`}
        roomType="classic"
        roomId={voiceRoomId}
        scopeId={voiceScopeId}
        playerId={myPlayerId}
        displayName={myPlayer?.name || 'Player'}
        eligibleParticipantIds={eligibleParticipantIds}
        label={isFourPlayerSocial ? 'MATCH VOICE' : 'VOICE ROOM'}
        compact
      />
    </div>
  );
}
