import fs from 'node:fs';

const page = fs.readFileSync(new URL('../src/pages/CompetitiveModePage.jsx', import.meta.url), 'utf8');
const adapter = fs.readFileSync(new URL('../src/firebase/competitiveFirebase.js', import.meta.url), 'utf8');
const context = fs.readFileSync(new URL('../src/context/CompetitiveModeContext.jsx', import.meta.url), 'utf8');

if (!page.includes("useRef") || !page.match(/import React, \{[^}]*useRef[^}]*\} from 'react';/)) throw new Error('CompetitiveModePage useCountdown requires an imported useRef hook.');
if (!page.includes('function useCountdown(endTimestamp)') || !page.includes('deadlineRef')) throw new Error('CompetitiveModePage countdown hook is missing its stable deadline state.');

const gameplayStart = page.indexOf('function TeamBattleGameplay');
const gameplayEnd = page.indexOf('function BracketMatch');
if (gameplayStart < 0 || gameplayEnd < 0) throw new Error('Team Battle gameplay component is missing.');
const gameplay = page.slice(gameplayStart, gameplayEnd);

if (gameplay.includes('GuessGrid') || gameplay.includes('GUESS BOARD')) throw new Error('Team Battle gameplay must not render the Guess Board or guess cards.');
if (gameplay.includes('TIME LEFT') || gameplay.includes('roundEndTimestamp')) throw new Error('Team Battle gameplay must not render a countdown timer.');
if (!gameplay.includes('<TeamBattleIdentity state={state} actions={actions} />')) throw new Error('Team Battle must show the current team identity panel.');
if (!gameplay.includes('opponentTeamLabel={opponentLabel}')) throw new Error('Team Battle must label the opposing team target.');
if (!page.includes("<img src={target.image} alt={target.name}")) throw new Error('The opposing team target must be rendered as an image when ready.');
if (!gameplay.includes('GUESSED CORRECT')) throw new Error('Team Battle must expose the compact opposing-team confirmation action.');
if (!gameplay.includes('onClick={() => actions.confirmTeamGuess()}')) throw new Error('Confirmation must call the authoritative confirmTeamGuess action.');
if (!gameplay.includes('disabled={!myTeamRequired || !actions.canMutateCompetitive || (hasConfirmed && confirmedIds.length === 2)}')) throw new Error('Confirmation must remain restricted to the authoritative defending team, mutable state, and immutable completed pair.');
if (gameplay.includes('disabled={!myTeamRequired || !actions.targetReady || !actions.canMutateCompetitive')) throw new Error('Team Guess Correct must not be blocked by delayed private target readiness.');
if (!context.includes('privateTarget, targetReady, canMutateCompetitive])')) throw new Error('Team Guess Correct callback must capture current mutation capability.');
if (!gameplay.includes("hasConfirmed ? 'undo' : 'check_circle'") || !gameplay.includes('CANCEL CONFIRMATION')) throw new Error('Confirmation must visibly support cancelling the current player confirmation.');
if (!gameplay.includes('guessedConfirmationTeams') || !gameplay.includes('lockedConfirmationTeams.includes(myTeam.teamId)')) throw new Error('Confirmation UI must recognize every required team derived from authoritative correct guesses.');
if (gameplay.includes('requiredTeamsComplete') || gameplay.includes('actions.resolveTeamRound()') || gameplay.includes('actions.advanceTeam()')) throw new Error('Team Battle page must not own authoritative resolve/advance effects; provider is the single transition owner.');
if (!page.includes('TEAM ROSTERS') || !page.includes('NAMES IN ROOM') || !page.includes('YOUR NAME')) throw new Error('Team Battle must show room-registered names and the current player name badge.');
if (!page.includes("state.status === 'round_result' || state.status === 'finished'") || !page.includes('<TeamResult state={state} actions={actions} onDashboard={() => navigate(\'/\')} />')) throw new Error('Team Battle round_result and finished states must mount TeamResult for reveal and final-results rendering.');
if (!page.includes('function FinalTeamResult') || !page.includes('TEAM BATTLE COMPLETE') || !page.includes('state.finalResult?.winningTeamId')) throw new Error('Finished Team Battle state must render the authoritative final result screen.');
if (!page.includes('<TeamRevealTargets state={state} result={state.match?.result} />')) throw new Error('Finished Team Battle results must reveal the final round targets from the authoritative match result.');
if (!page.includes('isHost ?') || !page.includes('HOST CONTROLS') || !page.includes('REMATCH') || !page.includes('actions.startMode(selectedCategory)')) throw new Error('Only the room master may choose a rematch category and start a rematch.');
if (!page.includes("const isFinishedResults = state.status === 'finished' && state.phase === MODE_PHASES.RESULTS") || !page.includes('!isFinishedResults')) throw new Error('Rematch must be gated by the authoritative finished/results state.');
if (!context.includes('teamStartInFlightRef') || !context.includes('Team Battle rematch is available only after the match finishes.') || !context.includes('Team Battle rematch is already starting.')) throw new Error('Provider must reject invalid-phase and duplicate Team Battle rematch starts.');
if (!page.includes('DASHBOARD') || !page.includes('LEAVE')) throw new Error('Final Team Battle results must expose Dashboard and Leave controls.');
if (!page.includes('function TeamRevealTargets') || !page.includes('result?.targets?.[team.playerIds[0]]') || !page.includes('<TeamRevealTargets state={state} result={result} />')) throw new Error('Team Battle reveal must expose and render both teams’ completed-round target snapshots.');
if (!context.includes('teamResolutionInFlightRef') || !context.includes('areAllRequiredTeamConfirmationsComplete(state)') || !context.includes('resolveTeamRound()')) throw new Error('Provider must automatically resolve a complete Team Battle confirmation set.');
if (!context.includes('teamAdvanceInFlightRef') || !context.includes('state.match?.revealEndTimestamp') || !context.includes('advanceTeam()')) throw new Error('Provider must automatically advance after the reveal timestamp expires.');
if (!context.includes("['playing', 'round_result', 'finished'].includes(next.match?.status)") || !context.includes('resumableTeamBattle')) throw new Error('Team Battle session recovery must remain enabled through round results and finished state.');
const resolveBlock = context.slice(context.indexOf('const resolveTeamRound'), context.indexOf('const advanceTeam'));
const advanceBlock = context.slice(context.indexOf('const advanceTeam'), context.indexOf('useEffect(() => {', context.indexOf('const advanceTeam')));
if (resolveBlock.includes('state.hostId !== playerId') || advanceBlock.includes('state.hostId !== playerId') || advanceBlock.includes('current.hostId !== playerId')) throw new Error('Team Battle resolve/advance must not depend on a live host tab; Firebase transaction guards remain authoritative.');
if (!page.includes("disabled={pendingAction === 'leave'}")) throw new Error('Leave/Disconnect must not be disabled by unrelated pending actions.');
if (!page.includes('Waiting for the synchronized transition...')) throw new Error('Round result must not imply that only the host can advance the next round.');
if (!page.includes("status === 'closed' && !state") || !page.includes('This Team Battle room has ended or was closed.')) throw new Error('Closed Team Battle rooms must show an explicit recovery message.');
if (page.includes('TEAM_IDS.A') || page.includes('TEAM_IDS.B')) throw new Error('Team roster UI must not depend on an unresolved TEAM_IDS identifier.');

if (!adapter.includes("mode === 'team_battle'")) throw new Error('Team Battle adapter branch is missing.');
if (!context.includes('submitTeamConfirmation') || !context.includes('confirmTeamRound') || !context.includes('targetMatchesCurrentRound')) throw new Error('Team Battle confirmation must use the scoped player confirmation path, engine cancellation path, and current target guard.');
if (!context.includes('privateTargetMatchesRound') || !context.includes('if (!targetReady || !privateTarget || !privateTargetMatchesRound) return current;') || !context.includes('targetMatchesCurrentRound') || !context.includes('if (!team?.teamId || !canMutateCompetitive) return;')) throw new Error('Team Battle actions must validate team membership and mutation capability.');
if (!context.includes('targetSnapshotsForTeams(current.category, current') || !context.includes('roomSeed: `${current.teamRoomId}:${current.createdAt}`')) throw new Error('Team Battle resolution must reconstruct both completed team targets from the deterministic round contract.');
if (!adapter.includes("safe.mode === 'team_battle'") || !adapter.includes("['round_result', 'finished'].includes(safeMatch.status)") || !adapter.includes('rawTargets')) throw new Error('Only completed Team Battle result targets may be projected publicly for reveal.');
const confirmBlock = context.slice(context.indexOf('const confirmTeamGuess'), context.indexOf('const resolveTeamRound'));
if (confirmBlock.includes('if (!targetReady') || confirmBlock.includes('if (!privateTarget')) throw new Error('Team Guess Correct must not require delayed private target readiness before submitting confirmation.');
if (!confirmBlock.includes('targetMapForTeams(state.category, state.teams') || !confirmBlock.includes('deterministicTargets?.[playerId]')) throw new Error('Team Guess Correct must have a deterministic current-round target fallback when private target delivery is delayed.');
if (adapter.includes('writeTeamBattleConfirmation')) throw new Error('Deprecated direct Team Battle confirmation writer must remain removed.');
if (!adapter.includes('export async function submitTeamConfirmation') || !adapter.includes('match/confirmations/${teamId}/${playerId}')) throw new Error('Team Battle must persist each teammate confirmation through the scoped Firebase child path.');
if (!adapter.includes('delete safe.match.targets') || !adapter.includes('delete safe.match.teamTargets') || !adapter.includes('safe.roundHistory = safe.roundHistory.map')) throw new Error('Public state must sanitize private target payloads and round history.');
if (!adapter.includes('players: { ...current.players, [playerId]: null }') || !adapter.includes('leftPlayers: { ...(current.leftPlayers || {}), [playerId]: true }')) throw new Error('Team Battle Leave must remove only the current player and mark the departure.');

if (!page.includes('TEAM ASSIGNMENT PREVIEW') || !page.includes('Keep both teams balanced.')) throw new Error('2v2 lobby must explain balanced team assignment.');
if (!page.includes('const TEAM_LOBBY_SEATS = 3') || !page.includes('Array.from({ length: TEAM_LOBBY_SEATS }') || !page.includes('{team.players.length}/{TEAM_LOBBY_SEATS} READY')) throw new Error('2v2 lobby must expose three selectable seats per team.');
if (!adapter.includes('claimTeamSeat') || !adapter.includes('teamSeats') || !adapter.includes('No seat is available in the assigned team')) throw new Error('2v2 switching must use atomic team-seat claims while preserving the four-player room cap.');
if (!page.includes('min-h-10 min-w-10') || !page.includes('min-h-12 flex-1 sm:flex-none')) throw new Error('2v2 lobby actions must preserve comfortable touch targets.');
if (!gameplay.includes('rounded-3xl border border-white/10 bg-gradient-to-r') || !gameplay.includes('2v2 TEAM BATTLE') || !gameplay.includes('ROUND {state.roundNumber} / 3')) throw new Error('2v2 gameplay must preserve the distinct round header.');
if (!gameplay.includes('rounded-3xl p-4 sm:p-5') || !gameplay.includes('focus-visible:ring-2')) throw new Error('2v2 gameplay panels and controls must retain visual focus affordances.');

console.log('Team Battle UI/adapter contract QA passed: opposing target projection, scoped dual confirmation, authoritative resolution, removed timer/guess board, privacy sanitization, roster names, Leave control, hierarchy, and touch targets are present.');
