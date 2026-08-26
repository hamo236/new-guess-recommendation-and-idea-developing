import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing file: ${relativePath}`);
    return '';
  }
  return readFileSync(absolutePath, 'utf8');
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const lobby = read('src/pages/LobbyPage.jsx');
const results = read('src/pages/GameResultsPage.jsx');
const gameState = read('src/context/GameStateContext.jsx');
const timeline = read('src/components/game/MatchTimeline.jsx');
const gameBoard = read('src/pages/GameBoardPage.jsx');
const leaveDialog = read('src/components/RoomLeaveDialog.jsx');
const recoveryCard = read('src/components/ActiveMatchRecoveryCard.jsx');
const competitivePage = read('src/pages/CompetitiveModePage.jsx');
const competitiveContext = read('src/context/CompetitiveModeContext.jsx');
const competitiveFirebase = read('src/firebase/competitiveFirebase.js');
const teamEngine = read('src/modes/teamBattleEngine.js');
const app = read('src/App.jsx');
const bottomNav = read('src/components/layout/BottomNavBar.jsx');
const dailyPage = read('src/pages/DailyGuessPage.jsx');
const dailyChallenge = read('src/utils/dailyChallenge.js');

assert(lobby.includes('handleShareInvite'), 'Lobby invite sharing handler is missing.');
assert(lobby.includes('navigator.share'), 'Lobby Web Share fallback is missing.');
assert(lobby.includes('role="status"'), 'Lobby invite feedback is missing an accessible status.');
assert(results.includes('MatchTimeline'), 'Results page is missing the match timeline projection.');
assert(results.includes('canRematch'), 'Results page is missing the rematch guard.');
assert(gameState.includes('isHost'), 'Game state host identity guard is missing.');
assert(gameState.includes('Only the host can reset the match'), 'Reset host authorization message is missing.');
assert(gameState.includes("Only the host can start the game."), 'Start host authorization message is missing.');
assert(gameState.includes('startGame: useCallback(async () => {\n      // Starting a Firebase room is authoritative'), 'Start action is missing the authoritative host guard.');
assert(timeline.includes('GAME_PHASES'), 'Match timeline is not derived from authoritative phases.');
assert(gameBoard.includes('isChatPending'), 'Gameplay chat duplicate-action guard is missing.');
assert(gameBoard.includes('Message could not be sent.'), 'Gameplay chat failure feedback is missing.');
assert(gameBoard.includes('isLeaving'), 'Gameplay leave duplicate-action guard is missing.');
assert(leaveDialog.includes('isPending'), 'Leave dialog pending state is missing.');
assert(recoveryCard.includes('TRY AGAIN'), 'Active match recovery retry control is missing.');
assert(recoveryCard.includes('START NEW ROOM'), 'Active match recovery dismiss control is missing.');
assert(recoveryCard.includes('role={isRestoring ? \'status\' : \'alert\'}'), 'Recovery card is missing accessible async feedback roles.');
assert(recoveryCard.includes("'retryable-error':"), 'Recovery card status map must quote the hyphenated retryable-error key.');
assert(gameState.includes('retrySessionRecovery'), 'Session recovery retry action is not exposed.');
assert(gameState.includes('rejoinAttemptedRef.current) return;'), 'Session recovery retry is missing the duplicate-attempt guard.');
assert(gameState.includes('clearSessionRecovery'), 'Session recovery dismiss action is not exposed.');
assert(lobby.includes('ActiveMatchRecoveryCard'), 'Lobby is missing the active match recovery projection.');
assert(lobby.includes('role="group" aria-label="Lobby setup"'), 'Lobby setup toggle group is missing an accessible name.');
assert(lobby.includes('aria-pressed={lobbyMode === \'create\'}'), 'Create Room toggle state is not exposed semantically.');
assert(lobby.includes('aria-pressed={mode === GAME_MODES.ONE_V_ONE}'), 'Game mode toggle state is not exposed semantically.');
assert(lobby.includes('aria-pressed={isActive}'), 'Category selection state is not exposed semantically.');
assert(lobby.includes('aria-label="Your name"'), 'Create-room name input is missing an accessible name.');
assert(lobby.includes('htmlFor="join-name"') && lobby.includes('id="join-name"'), 'Join name label is not associated with its input.');
assert(lobby.includes('htmlFor="join-code"') && lobby.includes('id="join-code"'), 'Room code label is not associated with its input.');
assert(lobby.includes(') : (\n              <>\n              {/* Join Room panel */}') && lobby.includes('\n              </>\n            )}\n          </section>'), 'Join Room ternary must wrap sibling panels in a valid JSX fragment.');
assert(!lobby.includes('href="#"'), 'Lobby contains a dead navigation link.');
assert(!results.includes('href="#"'), 'Results contains a dead navigation link.');
assert(competitivePage.includes('TeamSlotPreview'), '2v2 team-slot preview is missing.');
assert(competitivePage.includes('aria-label="2v2 team slots"'), '2v2 team-slot preview is missing an accessible name.');
assert(competitivePage.includes('mode === COMPETITIVE_MODES.TEAM_BATTLE && <TeamSlotPreview players={players} actions={{ ...actions, onChangeTeam:'), '2v2 team-slot preview is not isolated to Team Battle lobby mode or its guarded action wrapper is missing.');
assert(competitivePage.includes('grouped by join order'), '2v2 team assignment preview does not explain its read-only ordering.');
assert(competitivePage.includes('Number(a.joinOrder)') && competitivePage.includes('Number(b.joinOrder)'), '2v2 preview must sort by persisted join order.');
assert(competitiveContext.includes('mode === COMPETITIVE_MODES.TEAM_BATTLE') && competitiveContext.includes('Number(a.joinOrder)'), 'Team Battle start must sort players by persisted join order.');
assert(competitiveFirebase.includes('joinOrder: 1'), 'Competitive host join order is not persisted.');
assert(competitiveFirebase.includes('child('), 'Competitive Firebase adapter must use modular child references.');
assert(!competitiveFirebase.includes('ref(target,'), 'Competitive Firebase adapter still uses the invalid ref(DatabaseReference, childPath) pattern.');
assert(competitiveContext.includes('targetMapForTeams'), 'Team Battle provider is missing shared-team target generation.');
assert(teamEngine.includes('teamTargets'), 'Team Battle engine is missing the shared team-target projection.');
assert(teamEngine.includes('teamId: teamId'), 'Team Battle engine does not preserve team identity on shared targets.');
assert(lobby.includes('premium-2v2-hero') && lobby.includes("navigate('/team-battle')"), 'Main Lobby is missing the first-class 2v2 Team Battle entry.');
assert(bottomNav.includes("{ name: '2v2', icon: 'groups', path: '/team-battle' }"), 'Mobile navigation is missing the dedicated 2v2 Team Battle destination.');
assert(bottomNav.includes('touch-feedback') && bottomNav.includes('min-h-11'), 'Mobile 2v2 navigation target is not touch-safe.');
assert(lobby.includes('Shared team targets') && lobby.includes('Host starts'), '2v2 Lobby entry is missing its core player-facing promises.');
assert(!lobby.includes('Choose a competitive circuit'), 'Legacy competitive-circuit selector should be replaced by the 2v2 entry.');
assert(competitiveFirebase.includes('joinSlots') && competitiveFirebase.includes('reserveCompetitiveSlot') && competitiveFirebase.includes('joinOrder: slotNumber(reservation.slotId)'), 'Competitive join order must come from an atomic Fixed Slot reservation.');
assert(competitivePage.includes('pendingAction'), 'Competitive mode duplicate-action guard is missing.');
assert(competitivePage.includes("run = async (fn, actionKey = 'action')"), 'Competitive action runner contract is missing.');
assert(competitivePage.includes("pendingAction === 'leave'"), 'Competitive leave pending feedback is missing.');
assert(competitivePage.includes('role="alert"'), 'Competitive failure feedback is missing an accessible alert role.');
assert(competitivePage.includes('pendingAction={pendingAction}'), 'Competitive player-removal pending state is not wired.');
assert(competitivePage.includes('MATCH READINESS'), 'Competitive lobby readiness strip is missing.');
assert(competitivePage.includes('const safeMatch = match ||') && competitivePage.includes('Array.isArray(safeMatch.playerIds)'), 'Tournament bracket must safely render pending matches before final/consolation players are assigned.');
assert(competitivePage.includes('role="status"') && competitivePage.includes('aria-live="polite"'), 'Competitive readiness feedback is missing an accessible status live region.');
assert(competitivePage.includes('aria-busy={pendingAction === \'create\'}'), 'Competitive create action is missing semantic busy state.');
assert(competitivePage.includes('aria-busy={pendingAction === \'join\'}'), 'Competitive join action is missing semantic busy state.');
assert(competitivePage.includes('min-h-11') && competitivePage.includes('touch-feedback'), 'Competitive mobile touch-target utilities are missing.');
assert(competitivePage.includes('className="touch-feedback min-h-11'), 'Competitive primary actions are missing tactile touch styling.');
assert(competitivePage.includes('grid-cols-1 sm:grid-cols-2'), 'Competitive player list is not narrow-mobile safe.');
assert(!competitivePage.includes('</button></p>}'), 'Competitive lobby contains a malformed closing-tag artifact.');
assert(app.includes('path="/daily"'), 'Daily Guess Drop route is missing.');
assert(lobby.includes("navigate('/daily')"), 'Lobby Daily Guess Drop entry point is missing.');
assert(dailyPage.includes('Your result is saved on this device'), 'Daily result persistence boundary is not visible to the user.');
assert(dailyPage.includes('does not affect multiplayer rooms or rankings'), 'Daily non-authoritative boundary is not visible to the user.');
assert(dailyChallenge.includes('getDailyChallengeId'), 'Daily challenge date key is missing.');
assert(dailyChallenge.includes('localStorage'), 'Daily device-only completion storage is missing.');
assert(dailyChallenge.includes('return true;') && dailyChallenge.includes('return false;'), 'Daily persistence success is not reported truthfully.');
assert(dailyPage.includes('isPersisted'), 'Daily completion UI does not distinguish persisted and memory-only results.');
assert(dailyChallenge.includes('seededOrder'), 'Daily challenge selection is not deterministic.');
assert(dailyPage.includes('score + (selectedId === question.answerId ? 1 : 0)'), 'Daily final-answer score is vulnerable to an async state-update race.');

if (failures.length > 0) {
  console.error('QA smoke checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('QA smoke checks passed: invite, timeline, rematch, host-guards, gameplay async guards, recovery projection, competitive guards, daily drop, and dead-link contracts are present.');
