import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameContext } from '../context/GameStateContext';
import RoundRevealPanel from '../components/game/RoundRevealPanel';
import MatchTimeline from '../components/game/MatchTimeline';
import RoomLeaveDialog from '../components/RoomLeaveDialog';
import { getPlayerAvatar, getPlayerAvatarLabel, getRosterAvatarIndex } from '../ui/playerAvatars.js';
import { getStableRevealDeadline } from '../game/revealTiming.js';

const GameResultsPage = () => {
  const { state, actions, myPlayerId, GAME_PHASES, GAME_MODES, CATEGORIES, isHost, isFirebaseConfigured } = useGameContext();
  const navigate = useNavigate();
  const [localVote, setLocalVote] = useState(null);
  const [revealSecondsLeft, setRevealSecondsLeft] = useState(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isVotePending, setIsVotePending] = useState(false);
  const [isResolvePending, setIsResolvePending] = useState(false);
  const [isPlayAgainPending, setIsPlayAgainPending] = useState(false);
  const [isLeavePending, setIsLeavePending] = useState(false);
  const [actionError, setActionError] = useState('');
  const [selectedReaction, setSelectedReaction] = useState(null);
  const [reactionNotice, setReactionNotice] = useState('');
  const autoAdvancedRef = useRef(null);
  const revealDeadlineRef = useRef({ key: null, deadline: 0 });

  const {
    phase, round, totalRounds, players, scores, roundResult,
    mode, targets, questions, votes, revealEndTimestamp, standings: authoritativeStandings,
    playerAssignments, matchResults,
  } = state;

  const activeMatchId = mode === 'social' && players.length === 4
    ? playerAssignments?.[myPlayerId]?.matchId
    : null;
  const activeMatchResult = activeMatchId ? matchResults?.[activeMatchId] : null;
  const visibleRoundResult = activeMatchResult ?? roundResult;

  const isFinal = phase === GAME_PHASES.RESULTS;
  const isVoting = phase === GAME_PHASES.VOTING;
  const isRoundEnd = phase === GAME_PHASES.ROUND_END;

  const standings = mode === 'social' && Array.isArray(authoritativeStandings) && authoritativeStandings.length === players.length
    ? authoritativeStandings.map((entry) => ({ ...entry, pts: entry.points ?? scores[entry.id] ?? 0 }))
    : [...players]
      .map((p) => ({ ...p, pts: scores[p.id] ?? 0 }))
      .sort((a, b) => b.pts - a.pts);

  const winner = (isFinal && standings[0])
    ? players.find((p) => p.id === standings[0].id) || standings[0]
    : (visibleRoundResult?.winnerId ? players.find((p) => p.id === visibleRoundResult.winnerId) : null);

  const revealTs = visibleRoundResult?.revealEndTimestamp ?? revealEndTimestamp ?? 0;
  const revealedTargets = visibleRoundResult?.revealedTargets ?? null;
  const chatHistory = useMemo(
    () => questions.filter((q) => q.type === 'chat'),
    [questions],
  );

  // Navigate to game when phase moves to preview (after auto-advance)
  useEffect(() => {
    if (phase === GAME_PHASES.PREVIEW) navigate('/game');
    if (phase === GAME_PHASES.LOBBY) navigate(mode === GAME_MODES.ONE_V_ONE ? '/one-v-one' : '/');
  }, [phase, mode, navigate, GAME_PHASES, GAME_MODES]);

  // 5-second reveal countdown + auto-advance (host only for Firebase)
  useEffect(() => {
    if (!isRoundEnd || isFinal || !revealTs) {
      setRevealSecondsLeft(null);
      return;
    }

    const revealKey = `${mode}:${round}:${revealTs}`;
    if (revealDeadlineRef.current.key !== revealKey) {
      revealDeadlineRef.current = { key: revealKey, deadline: getStableRevealDeadline(revealTs) };
    }
    const effectiveRevealTs = revealDeadlineRef.current.deadline;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((effectiveRevealTs - Date.now()) / 1000));
      setRevealSecondsLeft(remaining);

      if (remaining === 0 && autoAdvancedRef.current !== round && (isHost || !isFirebaseConfigured)) {
        autoAdvancedRef.current = round;
        actions.advanceRound();
      }
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [isRoundEnd, isFinal, revealTs, isHost, isFirebaseConfigured, actions, round]);

  const handleVote = async (targetId) => {
    if (localVote || isVotePending) return;
    setActionError('');
    setLocalVote(targetId);
    setIsVotePending(true);
    try {
      await actions.castVote(myPlayerId, targetId);
    } catch (error) {
      setLocalVote(null);
      setActionError(error.message || 'Your vote could not be submitted. Try again.');
    } finally {
      setIsVotePending(false);
    }
  };

  const handleResolveVotes = async () => {
    if (isResolvePending) return;
    setActionError('');
    setIsResolvePending(true);
    try {
      await actions.resolveVoting();
    } catch (error) {
      setActionError(error.message || 'Results could not be revealed yet.');
    } finally {
      setIsResolvePending(false);
    }
  };

  const canRematch = isHost || !isFirebaseConfigured;
  const reactions = [
    { id: 'gg', label: 'GG', icon: 'sports_score' },
    { id: 'wow', label: 'Wow', icon: 'star' },
    { id: 'close', label: 'So close', icon: 'near_me' },
    { id: 'rematch', label: 'Rematch', icon: 'replay' },
  ];

  const handleReaction = (reaction) => {
    setSelectedReaction(reaction.id);
    setReactionNotice(`${reaction.label} noted — nice round.`);
  };

  const handlePlayAgain = async () => {
    if (!canRematch || isPlayAgainPending) return;
    setActionError('');
    setIsPlayAgainPending(true);
    try {
      await actions.resetMatch();
      navigate(mode === GAME_MODES.ONE_V_ONE ? '/one-v-one' : '/');
    } catch (error) {
      setIsPlayAgainPending(false);
      setActionError(error.message || 'The room could not be reset. Please try again.');
    }
  };

  const handleLeaveRoom = async () => {
    if (isLeavePending) return;
    setShowLeaveDialog(false);
    setActionError('');
    setIsLeavePending(true);
    try {
      await actions.leaveRoom();
      navigate(mode === GAME_MODES.ONE_V_ONE ? '/one-v-one' : '/');
    } catch (error) {
      setIsLeavePending(false);
      setActionError(error.message || 'The room could not be closed. Please try again.');
    }
  };

  // â”€â”€ Social Voting Phase (preserved, not active in 1v1 flow) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isVoting) {
    return (
      <div className="text-on-background h-full flex flex-col overflow-x-hidden relative pt-20 pb-24">
        <MatchTimeline phase={phase} GAME_PHASES={GAME_PHASES} className="border-b border-white/5 bg-surface/30 backdrop-blur-md" />
        <main className="ng-page-shell flex-grow px-container-margin py-stack-lg flex flex-col gap-stack-lg max-w-2xl mx-auto w-full">
          <div className="text-center">
            <p className="font-label-caps text-label-caps text-secondary uppercase tracking-widest mb-2">Time's Up!</p>
            <h2 className="font-display-lg text-display-lg text-on-background mb-1">VOTE NOW</h2>
            <div className="h-1 w-24 bg-gradient-to-r from-transparent via-secondary to-transparent mx-auto mb-4" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Who is the Impostor? Tap a player to vote.
            </p>
          </div>

              <div className="glass-panel-heavy rounded-xl p-stack-lg flex flex-col gap-4 animate-fade-in-up">
                {actionError && (
                  <p role="alert" className="text-center font-body-sm text-body-sm text-error">
                    {actionError}
                  </p>
                )}
            {players
              .filter((p) => p.id !== myPlayerId)
              .map((player) => {
                const theirTarget = targets[player.id];
                const voted = localVote === theirTarget?.id;
                const voteCount = Array.isArray(votes)
                  ? votes.filter((v) => v.targetId === theirTarget?.id).length
                  : Object.values(votes || {}).filter((v) => v.targetId === theirTarget?.id).length;

                return (
                  <button
                    key={player.id}
                    onClick={() => theirTarget && handleVote(theirTarget.id)}
                    disabled={!!localVote || isVotePending}
                    className={`ng-interactive glass-panel rounded-lg p-4 flex items-center gap-4 border transition-all active:scale-95 disabled:cursor-default ${
                      voted ? 'border-secondary/60 bg-secondary/10 neon-border' : 'border-white/10 hover:border-white/30 disabled:hover:border-white/10'
                    }`}
                  >
                    <img src={getPlayerAvatar(player, getRosterAvatarIndex(players, player))} alt={getPlayerAvatarLabel(player, getRosterAvatarIndex(players, player))} className="w-12 h-12 rounded-full object-cover border-2 border-white/30" loading="lazy" />
                    <div className="flex-1 text-left">
                      <p className="font-headline-sm text-headline-sm text-on-surface">{player.name}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        {player.connected === false ? 'âڑ، Disconnected' : 'Online'}
                      </p>
                    </div>
                    {voteCount > 0 && (
                      <span className="font-label-caps text-label-caps text-secondary bg-secondary/20 rounded-full px-2 py-1 text-xs">
                        {voteCount} vote{voteCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {voted && <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_vote</span>}
                  </button>
                );
              })}
          </div>

          {isHost && localVote && (
            <button
              onClick={handleResolveVotes}
              disabled={isResolvePending}
              className="ng-interactive bg-secondary text-on-secondary font-headline-sm text-headline-sm py-4 rounded-lg shadow-[0_0_20px_rgba(233,179,255,0.4)] hover:shadow-[0_0_30px_rgba(233,179,255,0.6)] transition-all active:scale-95 disabled:opacity-60 disabled:cursor-wait"
            >
              {isResolvePending ? 'Revealing…' : 'Reveal Results'}
            </button>
          )}
          {!isHost && localVote && (
            <p className="text-center font-body-sm text-body-sm text-on-surface-variant animate-pulse">
              Waiting for host to reveal resultsâ€¦
            </p>
          )}
        </main>
      </div>
    );
  }

  // â”€â”€ Round End / Final Results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="text-on-background h-full flex flex-col overflow-x-hidden relative">
      <MatchTimeline phase={phase} GAME_PHASES={GAME_PHASES} className="border-b border-white/5 bg-surface/30 backdrop-blur-md" />
      <main className="ng-page-shell flex-grow px-container-margin py-stack-lg flex flex-col gap-stack-lg max-w-7xl mx-auto w-full items-center justify-center relative pt-24 pb-24">
        <div className="ng-result-shell glass-panel-heavy rounded-xl p-3 sm:p-stack-lg w-full max-w-2xl flex flex-col gap-4 sm:gap-stack-lg items-center relative overflow-hidden z-10 animate-fade-in-up">
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary-fixed rounded-full blur-[100px] opacity-20 pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-secondary-fixed-dim rounded-full blur-[100px] opacity-20 pointer-events-none" />

          <div className="ng-result-heading text-center w-full z-10">
            <span className="inline-flex items-center rounded-full border border-primary-fixed/25 bg-primary-fixed/5 px-2.5 py-1 font-label-caps text-[9px] tracking-[0.14em] text-primary-fixed">
              {isFinal ? 'MATCH COMPLETE' : 'ROUND RESULT'}
            </span>
            <p className="mt-2 font-label-caps text-[10px] tracking-[0.14em] text-on-surface-variant uppercase">
              {isFinal ? 'Final standings' : `Round ${round} / ${totalRounds}`}
            </p>
            <h2 className="mt-1 font-display-lg text-display-lg text-on-background leading-tight">
              {isFinal ? 'The winner is clear' : 'Winner identified'}
            </h2>
            <div className="h-px w-20 bg-gradient-to-r from-transparent via-primary-fixed to-transparent mx-auto mt-3" />
          </div>

          {isFinal && (
            <section className="w-full z-10">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest mb-3">
                TYPE OF GAME
              </h3>
              <div className="ng-choice-grid grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  [CATEGORIES.CARTOONS, 'Cartoon Characters'],
                  [CATEGORIES.FOOTBALL, 'Football Players'],
                  [CATEGORIES.SPORTS, 'Sports'],
                  [CATEGORIES.ANIMALS, 'Animals'],
                ].map(([categoryId, label]) => (
                  <button
                    key={categoryId}
                    onClick={() => actions.setCategory(categoryId)}
                    className={`ng-interactive rounded-lg border px-3 py-3 font-body-sm text-body-sm transition-colors ${state.category === categoryId ? 'border-primary-fixed bg-primary-fixed/20 text-primary-fixed' : 'border-white/10 text-on-surface-variant hover:border-white/30'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {actionError && (
            <div role="alert" className="ng-result-alert w-full z-10 rounded-lg border border-error/35 bg-error/10 px-3 py-2.5 text-center">
              <span className="font-label-caps text-[10px] tracking-wider text-error">ACTION NEEDS ATTENTION</span>
              <p className="mt-1 font-body-sm text-body-sm text-error">{actionError}</p>
            </div>
          )}

          {(winner || visibleRoundResult) && (
            <div className="ng-winner-card w-full glass-panel rounded-xl p-3 sm:p-stack-md flex flex-col sm:flex-row items-center gap-3 sm:gap-gutter neon-glow z-10">
              <div className="relative w-24 h-24 shrink-0 rounded-full overflow-hidden border-2 border-primary-fixed shadow-[0_0_15px_rgba(125,244,255,0.4)]">
                {winner ? (
                  <img src={getPlayerAvatar(winner, getRosterAvatarIndex(players, winner))} alt={getPlayerAvatarLabel(winner, getRosterAvatarIndex(players, winner))} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary-fixed text-3xl">emoji_events</span>
                  </div>
                )}
              </div>
              <div className="flex-grow min-w-0 text-center sm:text-left">
                <span className="font-label-caps text-[10px] tracking-[0.14em] text-secondary uppercase">{visibleRoundResult?.isTie ? 'ROUND DRAW' : isFinal ? 'WINNER' : 'ROUND WINNER'}</span>
                <h3 className="mt-1 font-headline-md text-headline-md text-primary-fixed truncate">
                  {visibleRoundResult?.isTie ? 'Tie' : (winner?.name ?? visibleRoundResult?.message ?? '—')}
                </h3>
                {visibleRoundResult?.pointsEarned !== undefined && (
                  <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant flex items-center justify-center sm:justify-start gap-1">
                    <span className="material-symbols-outlined text-[16px]">grade</span>
                    +{visibleRoundResult.pointsEarned} pts this round
                  </p>
                )}
              </div>
              {winner && !visibleRoundResult?.isTie && (
                <div className="ng-winner-score shrink-0 text-center sm:text-right">
                  <span className="block font-label-caps text-[9px] tracking-[0.14em] text-on-surface-variant">TOTAL</span>
                  <strong className="block font-stats-num text-stats-num text-on-background">{standings.find((entry) => entry.id === winner.id)?.pts ?? 0}</strong>
                </div>
              )}
            </div>
          )}

          {/* 5-second reveal â€” both secret targets */}
          {(isRoundEnd || isFinal) && revealedTargets && (
            <section className="w-full z-10 rounded-xl border border-primary-fixed/15 bg-primary-fixed/[0.03] p-3 sm:p-4" aria-label="Target reveal">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="font-label-caps text-[10px] tracking-[0.14em] text-primary-fixed">TARGET REVEAL</span>
                <span className="font-body-sm text-[10px] text-on-surface-variant">Round information</span>
              </div>
              <RoundRevealPanel players={players} revealedTargets={revealedTargets} isOneVOne={mode === GAME_MODES.ONE_V_ONE} />
            </section>
          )}

          {isRoundEnd && revealSecondsLeft !== null && (
            <div className="ng-result-transition w-full z-10 rounded-xl border border-primary-fixed/20 bg-primary-fixed/5 px-3 py-3 text-center" data-countdown={revealSecondsLeft} role="status" aria-live="polite">
              <div className="flex items-center justify-center gap-2">
                <span className="ng-transition-beacon__dot" aria-hidden="true" />
                <span className="font-label-caps text-[10px] tracking-[0.14em] text-primary-fixed">NEXT ROUND</span>
                <span className="ng-transition-beacon__dot" aria-hidden="true" />
              </div>
              <p className="mt-1 font-stats-num text-stats-num text-primary-fixed">
                {revealSecondsLeft > 0
                  ? `${revealSecondsLeft}s`
                  : round >= totalRounds
                    ? 'RESULTS'
                    : 'STARTING'}
              </p>
              {!isHost && isFirebaseConfigured && revealSecondsLeft > 0 && (
                <p className="font-body-sm text-body-sm text-on-surface-variant text-xs mt-1">
                  Waiting for host to advanceâ€¦
                </p>
              )}
            </div>
          )}

          {mode === 'social' && players.length === 4 && !isFinal && (
            <div className="w-full text-center z-10 py-3 px-4 rounded-lg bg-primary-fixed/10 border border-primary-fixed/30">
              <p className="font-label-caps text-label-caps text-primary-fixed animate-pulse">
                {round === 1
                  ? 'Semifinal Match Complete â€” Waiting for parallel Semifinal to finishâ€¦'
                  : 'Match Complete â€” Waiting for parallel match to finishâ€¦'}
              </p>
            </div>
          )}

          <section className="w-full z-10 rounded-xl border border-secondary-fixed/15 bg-secondary-fixed/[0.03] p-3 sm:p-4" aria-labelledby="round-reaction-title">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h4 id="round-reaction-title" className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
                Quick reaction
              </h4>
              {reactionNotice && (
                <span role="status" className="font-body-sm text-body-sm text-primary-fixed text-right">
                  {reactionNotice}
                </span>
              )}
            </div>
            <div className="ng-choice-grid grid grid-cols-2 sm:grid-cols-4 gap-2">
              {reactions.map((reaction) => (
                <button
                  key={reaction.id}
                  type="button"
                  aria-label={`React: ${reaction.label}`}
                  aria-pressed={selectedReaction === reaction.id}
                  onClick={() => handleReaction(reaction)}
                  className={`ng-interactive min-h-12 rounded-lg border px-2.5 py-2 flex items-center justify-center gap-1.5 font-label-caps text-[10px] tracking-wider transition-all active:scale-95 ${selectedReaction === reaction.id ? 'border-primary-fixed bg-primary-fixed/15 text-primary-fixed neon-border' : 'border-white/10 text-on-surface-variant hover:border-white/30 hover:text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{reaction.icon}</span>
                  {reaction.label}
                </button>
              ))}
            </div>
          </section>

          <div className="ng-standings-board w-full flex flex-col gap-2 z-10 rounded-xl border border-white/10 bg-white/[0.025] p-3 sm:p-4">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-white/10 pb-2">
              <h4 className="font-headline-sm text-headline-sm text-on-surface">
                {isFinal ? 'Final Standings' : 'Current Standings'}
              </h4>
              <span className="font-label-caps text-[9px] tracking-wider text-on-surface-variant">POINTS BOARD</span>
            </div>
            {standings.map((player, idx) => (
              <div
                key={player.id}
                  className={`ng-standing-row flex items-center justify-between gap-3 p-3 rounded-lg transition-colors ${
                  idx === 0
                    ? 'bg-white/5 border border-primary-fixed/30 shadow-[inset_0_0_10px_rgba(125,244,255,0.1)]'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`font-stats-num text-stats-num w-6 text-center ${idx === 0 ? 'text-primary-fixed' : 'text-on-surface-variant'}`}>
                    {idx + 1}
                  </span>
                  <div className={`w-8 h-8 rounded-full overflow-hidden bg-surface-container-high border ${idx === 0 ? 'border-primary-fixed/50' : 'border-white/20'}`}>
                    {player ? (
                      <img src={getPlayerAvatar(player, getRosterAvatarIndex(players, player))} alt={getPlayerAvatarLabel(player, getRosterAvatarIndex(players, player))} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-on-surface-variant text-sm">person</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className={`font-body-lg text-body-lg text-on-surface ${idx === 0 ? 'font-semibold' : ''}`}>
                      {player.name}{player.id === myPlayerId ? ' (You)' : ''}
                    </span>
                  </div>
                </div>
                <span className="font-stats-num text-stats-num text-on-background">
                  {player.pts} pt{player.pts !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>

          {chatHistory.length > 0 && (
            <details className="w-full z-10 cursor-pointer">
              <summary className="font-label-caps text-label-caps text-on-surface-variant border-b border-white/10 pb-2 mb-2 select-none">
                Chat History ({chatHistory.length} messages)
              </summary>
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto no-scrollbar">
                {chatHistory.map((q) => (
                  <p key={q.id} className="font-body-sm text-body-sm text-on-surface-variant text-xs">
                    {q.playerName ?? players.find((p) => p.id === q.playerId)?.name}: {q.message ?? q.question}
                  </p>
                ))}
              </div>
            </details>
          )}

          <div className="ng-action-rail w-full flex flex-col sm:flex-row gap-3 mt-4 z-10">
            {isFinal && (
              <>
                <button onClick={() => setShowLeaveDialog(true)} className="ng-interactive flex-1 py-3 px-6 rounded-lg font-label-caps text-label-caps text-error bg-transparent border border-error/60 hover:bg-error/10 transition-all uppercase tracking-wider text-center active:scale-95">
                  EXIT
                </button>
                <button onClick={() => setShowLeaveDialog(true)} className="ng-interactive flex-1 py-3 px-6 rounded-lg font-label-caps text-label-caps text-on-surface bg-transparent border border-white/20 hover:bg-white/10 transition-all uppercase tracking-wider text-center active:scale-95">
                  DASHBOARD
                </button>
              </>
            )}
            {isFinal ? (
              <button
                onClick={handlePlayAgain}
                disabled={!canRematch || isPlayAgainPending}
                className="ng-interactive flex-1 py-3 px-6 rounded-lg font-label-caps text-label-caps text-black bg-primary-fixed hover:bg-primary-fixed-dim transition-all neon-glow uppercase tracking-wider text-center font-bold active:scale-95 disabled:opacity-60 disabled:cursor-wait"
              >
                {isPlayAgainPending ? 'Resetting…' : canRematch ? 'Play Again' : 'Waiting for host…'}
              </button>
            ) : isRoundEnd ? (
              <p className="ng-result-waiting w-full text-center font-label-caps text-label-caps text-on-surface-variant text-xs py-3">
                {isHost || !isFirebaseConfigured
                  ? 'Advancing automatically after revealâ€¦'
                  : 'Host will advance to the next round shortlyâ€¦'}
              </p>
            ) : (
              <button
                onClick={handlePlayAgain}
                disabled={!canRematch || isPlayAgainPending}
                className="ng-interactive flex-1 py-3 px-6 rounded-lg font-label-caps text-label-caps text-primary-fixed bg-transparent border border-primary-fixed hover:bg-primary-fixed/10 transition-all uppercase tracking-wider text-center active:scale-95 disabled:opacity-60 disabled:cursor-wait"
              >
                {isPlayAgainPending ? 'Leaving…' : canRematch ? 'Quit' : 'Waiting for host…'}
              </button>
            )}
          </div>
        </div>
      </main>
      {showLeaveDialog && <RoomLeaveDialog onConfirm={handleLeaveRoom} onCancel={() => setShowLeaveDialog(false)} />}
    </div>
  );
};

export default GameResultsPage;

