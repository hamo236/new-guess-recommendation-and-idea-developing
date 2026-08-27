import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameContext } from '../context/GameStateContext';
import { getItemsByCategory } from '../data/gameData';
import { formatTime } from '../hooks/useGameTimer';
import OpponentTargetCard from '../components/game/OpponentTargetCard';
import RoundRevealPanel from '../components/game/RoundRevealPanel';
import MatchTimeline from '../components/game/MatchTimeline';
import CompetitiveChatPanel from '../components/game/CompetitiveChatPanel';
import RoomLeaveDialog from '../components/RoomLeaveDialog';
import { getStableRevealDeadline } from '../game/revealTiming';

function formatChatTime(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isChatMessage(msg) {
  return msg.type === 'chat' || (
    !msg.isCorrectGuess &&
    !msg.isGuess &&
    msg.type !== 'guess_confirm' &&
    (msg.message || msg.question)
  );
}

const GameBoardPage = () => {
  const { state, actions, myPlayerId, myPlayer, isHost, isFirebaseConfigured, GAME_PHASES, GAME_MODES } = useGameContext();
  const [showExitDialog, setShowExitDialog] = useState(false);
  const navigate = useNavigate();
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  const [displaySeconds, setDisplaySeconds] = useState(null);
  const timerIntervalRef = useRef(null);

  const {
    phase, mode, category, players, displayTargets,
    questions, timerEndTimestamp, round, totalRounds,
    scores, roundResult, bracket, transitionEndsAt,
  } = state;

  const isPreview = phase === GAME_PHASES.PREVIEW;
  const isPlaying = phase === GAME_PHASES.PLAYING;
  const isOneVsOne = mode === GAME_MODES.ONE_V_ONE;
  const isFourPlayerSocial = mode === GAME_MODES.SOCIAL && players.length > 2;

  const opponentTarget = myPlayerId ? displayTargets[myPlayerId] : null;
  const boardItems = category ? getItemsByCategory(category) : [];

  const oppPlayers = players.filter((p) => p.id !== myPlayerId);
  const myAssignment = mode === GAME_MODES.SOCIAL && players.length > 2
    ? state.playerAssignments?.[myPlayerId]
    : null;
  const assignedOpponentId = myAssignment?.opponentPlayerId ?? null;
  const activeMatchId = myAssignment?.matchId ?? null;
  const activeMatch = activeMatchId ? bracket?.matches?.[activeMatchId] : null;
  const activeMatchRound = activeMatch?.matchRound ?? round;
  const activeMatchTotalRounds = isFourPlayerSocial ? 3 : totalRounds;
  const primaryOpponent = players.find((p) => p.id === assignedOpponentId)
    ?? (oppPlayers[0] ?? null);
  const activeMatchPlayers = activeMatch ? [players.find((p) => p.id === activeMatch.playerA), players.find((p) => p.id === activeMatch.playerB)].filter(Boolean) : [];
  const voiceRoomId = isFourPlayerSocial && activeMatchId ? `${state.roomCode}:${activeMatchId}` : state.roomCode;
  const voiceEligibleParticipantIds = isFourPlayerSocial ? activeMatchPlayers.map((player) => player.id) : players.map((player) => player.id);
  const matchResult = activeMatchId ? state.matchResults?.[activeMatchId] : null;
  const activeMatchRoundResult = isFourPlayerSocial ? (activeMatch?.roundResult ?? null) : null;
  const [matchRevealSeconds, setMatchRevealSeconds] = useState(null);
  const matchRevealEndTimestamp = activeMatchRoundResult?.revealEndTimestamp ?? 0;
  const [transitionSeconds, setTransitionSeconds] = useState(null);
  const knockoutAutoStartRef = useRef(null);
  const matchRevealDeadlineRef = useRef({ key: null, deadline: 0 });
  const matchRevealKey = `${state.roomCode || 'local'}:${activeMatchId || 'none'}:${activeMatchRound}:${matchRevealEndTimestamp}`;
  if (matchRevealDeadlineRef.current.key !== matchRevealKey) {
    matchRevealDeadlineRef.current = { key: matchRevealKey, deadline: getStableRevealDeadline(matchRevealEndTimestamp) };
  }
  const effectiveMatchRevealEndTimestamp = matchRevealDeadlineRef.current.deadline;
  const matchRevealActive = isFourPlayerSocial
    && phase === GAME_PHASES.PLAYING
    && !!activeMatchRoundResult
    && effectiveMatchRevealEndTimestamp > Date.now();
  const isKnockoutTransition = isFourPlayerSocial && isPreview && round > 1 && bracket?.stage === 'finals';
  const finalMatch = bracket?.matches?.final;
  const thirdPlaceMatch = bracket?.matches?.third_place;
  const playerName = (playerId) => players.find((player) => player.id === playerId)?.name ?? 'Player';
  const beginRoundRef = useRef(actions.beginRound);
  beginRoundRef.current = actions.beginRound;

  const chatMessages = questions.filter(isChatMessage);
  // CompetitiveChatPanel owns the isChatPending duplicate-action guard and the "Message could not be sent." feedback.

  useEffect(() => {
    if (mode !== GAME_MODES.SOCIAL || !timerEndTimestamp) {
      setDisplaySeconds(null);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.round((timerEndTimestamp - Date.now()) / 1000));
      setDisplaySeconds(remaining);
      if (remaining === 0) clearInterval(timerIntervalRef.current);
    };
    tick();
    timerIntervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerIntervalRef.current);
  }, [timerEndTimestamp, mode, GAME_MODES.SOCIAL]);

  useEffect(() => {
    if (phase === GAME_PHASES.ROUND_END) navigate('/results');
    if (phase === GAME_PHASES.VOTING)    navigate('/results');
    if (phase === GAME_PHASES.RESULTS)   navigate('/results');
    if (phase === GAME_PHASES.LOBBY)     navigate(mode === GAME_MODES.ONE_V_ONE ? '/one-v-one' : '/');
  }, [phase, mode, navigate, GAME_PHASES, GAME_MODES]);

  // Knockout matches resolve independently. Only players in the resolved match
  // leave the board for its result view; the other semifinal remains playable.
  useEffect(() => {
    if (isFourPlayerSocial && phase === GAME_PHASES.PLAYING && matchResult && !matchRevealActive) {
      navigate('/results');
    }
  }, [isFourPlayerSocial, phase, GAME_PHASES, matchResult, matchRevealActive, navigate]);

  useEffect(() => {
    if (!isFourPlayerSocial || !matchRevealEndTimestamp) {
      setMatchRevealSeconds(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((effectiveMatchRevealEndTimestamp - Date.now()) / 1000));
      setMatchRevealSeconds(remaining);
    };
    tick();
    const intervalId = setInterval(tick, 250);
    return () => clearInterval(intervalId);
  }, [isFourPlayerSocial, effectiveMatchRevealEndTimestamp]);

  // After both semifinals resolve, Firebase persists the finals bracket in PREVIEW.
  // Only this isolated four-player knockout path auto-enters the next round.
  useEffect(() => {
    if (!isKnockoutTransition || !transitionEndsAt) {
      setTransitionSeconds(null);
      return;
    }

    let intervalId = null;
    let fallbackTimeoutId = null;

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((transitionEndsAt - now) / 1000));
      setTransitionSeconds(remaining);

      if (now >= transitionEndsAt) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }

        const autoStartKey = `${state.roomCode || 'local'}:${round}:${transitionEndsAt}`;
        if (knockoutAutoStartRef.current !== autoStartKey) {
          knockoutAutoStartRef.current = autoStartKey;
          if (isHost || !isFirebaseConfigured) {
            beginRoundRef.current();
          } else {
            fallbackTimeoutId = setTimeout(() => {
              beginRoundRef.current();
            }, 1500);
          }
        }
      }
    };

    intervalId = setInterval(tick, 250);
    tick();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
    };
  }, [isFirebaseConfigured, isHost, isKnockoutTransition, round, state.roomCode, transitionEndsAt]);



  const handleLeaveGame = async () => {
    if (isLeaving) return;
    setLeaveError('');
    setIsLeaving(true);
    try {
      await actions.leaveRoom();
      setShowExitDialog(false);
      navigate('/');
    } catch (error) {
      setIsLeaving(false);
      setLeaveError(error?.message || 'Could not leave the game. Try again.');
    }
  };



  const handleBeginRound = async () => {
    await actions.beginRound();
  };

  const handleConfirmOpponentGuess = async () => {
    const currentRoundHasResult = roundResult?.roundId === state.roundId;
    if (!isPlaying || matchResult || (!isFourPlayerSocial && currentRoundHasResult) || !primaryOpponent) return;
    await actions.confirmOpponentGuess();
  };

  const myScore = (myPlayerId && scores[myPlayerId]) ?? 0;
  const oppScore = primaryOpponent ? (scores[primaryOpponent.id] ?? 0) : 0;

  const timerDisplay = mode === GAME_MODES.SOCIAL && displaySeconds !== null
    ? formatTime(displaySeconds)
    : null;
  const timerCritical = displaySeconds !== null && displaySeconds <= 30;

  const canBeginRound = isPreview && (isHost || !isFirebaseConfigured);
  // In a four-player knockout, only the current player's match locks after its own result.
  // Legacy 1v1/social modes retain their existing room-wide round lock.
  const roundLocked = isFourPlayerSocial ? (!!matchResult || matchRevealActive) : (roundResult?.roundId === state.roundId);
  const knockoutActionReady = !isFourPlayerSocial
    || (!!activeMatchId && !!state.roundId && !!opponentTarget && !matchResult && !matchRevealActive);

  return (
    <div className="h-full w-full flex flex-col relative bg-cyber-grid overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-surface-container-lowest/80 via-surface/90 to-surface-container/90 pointer-events-none z-0" />

      <header className="relative z-20 flex justify-between items-center px-container-margin h-16 bg-white/5 backdrop-blur-xl border-b border-white/10 shrink-0">
        <div className="flex items-center gap-gutter">
          <div className="flex flex-col items-center">
            <span className="font-label-caps text-label-caps text-primary">YOU</span>
            <span className="font-stats-num text-stats-num text-on-surface">{myScore}</span>
          </div>
          {primaryOpponent && (
            <>
              <div className="h-8 w-px bg-white/20" />
              <div className="flex flex-col items-center">
                <span className="font-label-caps text-label-caps text-on-surface-variant">OPP</span>
                <span className="font-stats-num text-stats-num text-on-surface-variant">{oppScore}</span>
              </div>
            </>
          )}
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
          <span className={`mb-1 rounded-full border px-2 py-0.5 font-label-caps text-[9px] tracking-[0.14em] ${
            isPreview ? 'border-secondary-fixed/30 bg-secondary-fixed/10 text-secondary-fixed' : 'border-primary-fixed/25 bg-primary-fixed/5 text-primary-fixed'
          }`}>
            {isPreview ? 'ROUND BRIEFING' : 'LIVE MATCH'}
          </span>
          <h1 className="font-headline-sm text-headline-sm text-primary neon-text-glow">
            {isPreview ? 'PREVIEW' : `ROUND ${activeMatchRound}/${activeMatchTotalRounds}`}
          </h1>
          {isPlaying && primaryOpponent && (
            <span className="font-label-caps text-[10px] text-on-surface-variant">
              vs {primaryOpponent.name}
            </span>
          )}
        </div>

        {timerDisplay ? (
          <div className="flex items-center gap-2">
            <span className="font-label-caps text-[9px] tracking-widest text-on-surface-variant">
              {isPreview ? 'STARTS IN' : 'TIME'}
            </span>
            <span className="material-symbols-outlined animate-pulse-neon text-primary-fixed" aria-hidden="true">timer</span>
            <span className={`font-stats-num text-stats-num animate-pulse-neon ${timerCritical ? 'text-error' : 'text-primary-fixed'}`} aria-live="polite">
              {timerDisplay}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {isPlaying && (
              <button
                type="button"
                onClick={() => setShowExitDialog(true)}
                className="font-label-caps text-[10px] text-error border border-error/50 rounded-md px-2 py-1 hover:bg-error/10 transition-colors"
              >
                EXIT GAME
              </button>
            )}
            <span className={`font-label-caps text-label-caps px-2 py-1 rounded-full ${
              isPreview ? 'text-secondary bg-secondary/10' : 'text-primary-fixed bg-primary-fixed/10'
            }`}>
              {isPreview ? 'Preview' : 'Live'}
            </span>
          </div>
        )}
      </header>

      <MatchTimeline phase={phase} GAME_PHASES={GAME_PHASES} className="relative z-20 border-b border-white/5 bg-surface/30 backdrop-blur-md" />

      <main className={`relative z-10 flex-1 flex flex-col overflow-hidden ${isPlaying ? 'pb-[320px]' : ''}`}>
        {matchRevealActive && matchRevealSeconds !== null && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-surface/95 backdrop-blur-xl px-container-margin">
            <section className="w-full max-w-2xl glass-panel rounded-2xl border border-primary-fixed/30 p-6 text-center">
              <span className="font-label-caps text-label-caps text-secondary uppercase tracking-widest">Round {activeMatchRound} complete</span>
              <h2 className="font-display-lg text-display-lg text-primary neon-text-glow mt-2">Target Reveal</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">Next round starts automatically in {matchRevealSeconds}s</p>
              <div className="grid gap-3 sm:grid-cols-2 mt-5">
                {activeMatchPlayers.map((player) => {
                  const target = activeMatchRoundResult?.revealedTargets?.[player.id];
                  return <div key={player.id} className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="font-label-caps text-[10px] text-primary-fixed">{player.name}</p><p className="font-headline-sm text-on-surface mt-2">{target?.name ?? ""}</p></div>;
                })}
              </div>
            </section>
          </div>
        )}

        {isPreview && (isKnockoutTransition ? (
          <div className="flex-1 overflow-y-auto px-container-margin py-stack-md no-scrollbar">
            <div className="max-w-2xl mx-auto w-full flex flex-col items-center justify-center gap-stack-lg text-center min-h-full">
              <span className="font-label-caps text-label-caps text-secondary uppercase tracking-widest">Semifinals Complete</span>
              <h2 className="font-display-lg text-display-lg text-on-background">Next Matches</h2>
              <div className="w-full grid gap-4">
                {[['FINAL', finalMatch], ['THIRD PLACE', thirdPlaceMatch]].map(([label, match]) => (
                  <section key={label} className="glass-panel rounded-xl p-stack-md border border-white/10">
                    <p className="font-label-caps text-label-caps text-primary-fixed uppercase tracking-widest mb-2">{label}</p>
                    <p className="font-headline-sm text-headline-sm text-on-surface">{playerName(match?.playerA)}</p>
                    <p className="font-label-caps text-label-caps text-secondary my-1">VS</p>
                    <p className="font-headline-sm text-headline-sm text-on-surface">{playerName(match?.playerB)}</p>
                  </section>
                ))}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant animate-pulse">
                Continuing automatically{transitionSeconds !== null ? ` in ${transitionSeconds}s…` : '…'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-container-margin py-stack-md no-scrollbar">
            <div className="max-w-2xl mx-auto w-full flex flex-col gap-stack-md">
              <div className="text-center flex flex-col gap-2">
                <span className="font-label-caps text-label-caps text-secondary uppercase tracking-widest">
                  Category Preview
                </span>
                <p className="font-body-lg text-body-lg text-on-surface">
                  Review the 15 possible characters before the round begins.
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Round {round} of {totalRounds} - Cards are view-only - no guessing or elimination.
                </p>
                <div
                  className="mx-auto mt-2 inline-flex min-h-9 items-center gap-2 rounded-full border border-primary-fixed/20 bg-primary-fixed/5 px-3 py-1.5 text-left"
                  aria-live="polite"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary-fixed" aria-hidden="true">
                    {timerDisplay ? 'hourglass_top' : canBeginRound ? 'play_circle' : 'groups'}
                  </span>
                  <span className="font-label-caps text-[10px] tracking-wider text-primary-fixed">
                    {timerDisplay ? 'Round starts soon' : canBeginRound ? 'Host controls the start' : 'Waiting for the host'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {boardItems.map((item) => (
                  <div
                    key={item.id}
                    className="relative aspect-square rounded-lg overflow-hidden glass-panel border border-white/10 pointer-events-none select-none"
                    aria-hidden="true"
                  >
                    <img src={item.image} alt="" className="w-full h-full object-cover opacity-90" draggable={false} />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-1.5 pb-1.5 pt-6 flex items-end justify-center min-h-[34%]">
                      <span className="max-w-full text-center font-label-caps text-[9px] sm:text-[10px] leading-[1.15] tracking-[0.08em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] break-words">{item.name}</span>
                    </div>
                  </div>
                ))}
              </div>


              <div className="sticky bottom-0 pt-stack-sm pb-safe flex flex-col items-center gap-3 bg-gradient-to-t from-surface/95 via-surface/80 to-transparent">

                {canBeginRound ? (
                  <button
                    onClick={handleBeginRound}
                    className="w-full max-w-xs bg-primary-fixed text-on-primary-fixed font-headline-sm text-headline-sm px-8 py-4 rounded-lg shadow-[0_0_20px_rgba(125,244,255,0.4)] hover:shadow-[0_0_30px_rgba(125,244,255,0.6)] transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wider"
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                    Start Round
                  </button>
                ) : (
                  <p className="font-label-caps text-label-caps text-on-surface-variant animate-pulse text-center">
                    Waiting for the host to start the round…
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        {isPlaying && (
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-container-margin py-stack-md no-scrollbar">
            <div className="max-w-md mx-auto w-full flex flex-col items-center gap-stack-md">

              <div className="w-full text-center">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
                  Round {activeMatchRound} / {activeMatchTotalRounds}
                </span>
              </div>

              {!isFourPlayerSocial && (
              <div className="w-full glass-panel rounded-lg p-4 flex flex-col gap-2 border border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">You</span>
                    <span className="font-body-lg text-body-lg text-on-surface truncate">{myPlayer?.name ?? 'Player'}</span>
                  </div>
                  <span className="font-stats-num text-stats-num text-primary shrink-0">{myScore}</span>
                </div>
                <div className="flex items-center justify-center gap-2 py-1">
                  <span className="font-label-caps text-label-caps text-secondary">VS</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">Opponent</span>
                     <span className="font-body-lg text-body-lg text-on-surface truncate">{primaryOpponent?.name ?? '—'}</span>
                  </div>
                  <span className="font-stats-num text-stats-num text-on-surface-variant shrink-0">{oppScore}</span>
                </div>
              </div>

              )}

              {isFourPlayerSocial ? (
                opponentTarget ? (
                  <figure className="w-full max-w-[320px] flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3" aria-label={`Opponent target: ${opponentTarget.name}`}>
                    <img
                      src={opponentTarget.image}
                      alt={opponentTarget.name}
                      className="h-20 w-20 shrink-0 rounded-xl object-cover border border-primary-fixed/35"
                    />
                    <figcaption className="min-w-0">
                      <span className="block font-label-caps text-[10px] tracking-[0.12em] text-primary-fixed">OPPONENT TARGET</span>
                      <span className="mt-1 block truncate font-headline-sm text-headline-sm text-white">{opponentTarget.name}</span>
                    </figcaption>
                  </figure>
                ) : null
              ) : (
                <OpponentTargetCard target={opponentTarget} compact={isOneVsOne} />
              )}

              {primaryOpponent && (
                <button
                  onClick={handleConfirmOpponentGuess}
                  disabled={roundLocked || !knockoutActionReady}
                  className={`${isFourPlayerSocial ? '' : isOneVsOne ? '-mt-2 sm:-mt-1' : '-mt-4 sm:-mt-3'} w-full max-w-xs bg-secondary text-on-secondary font-headline-sm text-headline-sm px-4 py-4 rounded-lg shadow-[0_0_20px_rgba(233,179,255,0.4)] hover:shadow-[0_0_30px_rgba(233,179,255,0.6)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 uppercase tracking-wider min-h-[52px] text-center leading-tight` }
                >
                  <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                  {primaryOpponent.name} · GUESS CORRECT
                </button>
              )}

              {roundLocked && (
                <p className="font-label-caps text-label-caps text-primary-fixed animate-pulse">
                  Round locked - redirecting
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {isPlaying && (
        <div className="fixed bottom-0 inset-x-0 z-30 px-3 pb-safe">
          <CompetitiveChatPanel
            messages={chatMessages}
            playerId={myPlayerId}
            onSend={actions.sendChatMessage}
            disabled={!isPlaying || Boolean(roundResult)}
          />
        </div>
      )}
      {showExitDialog && (
        <RoomLeaveDialog
          title="Are you sure you want to leave the game?"
          onConfirm={handleLeaveGame}
          onCancel={() => !isLeaving && setShowExitDialog(false)}
          isPending={isLeaving}
          error={leaveError}
        />
      )}
    </div>
  );
};

export default GameBoardPage;



