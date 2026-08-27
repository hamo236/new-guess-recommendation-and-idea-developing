import React, { lazy, Suspense, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import LobbyPage from './pages/LobbyPage';
import TopAppBar from './components/layout/TopAppBar';
import NavigationDrawer from './components/layout/NavigationDrawer';
import BottomNavBar from './components/layout/BottomNavBar';
import UiSoundLayer from './components/layout/UiSoundLayer';
import SessionRouteRestore from './components/SessionRouteRestore';
import ConnectionRecoveryBanner from './components/ConnectionRecoveryBanner';
import VoiceRoomPanel from './components/game/VoiceRoomPanel.jsx';
import { useGameContext } from './context/GameStateContext';

const GameBoardPage = lazy(() => import('./pages/GameBoardPage'));
const GameResultsPage = lazy(() => import('./pages/GameResultsPage'));
const AdminGateway = lazy(() => import('./pages/AdminGateway'));
const TournamentPage = lazy(() => import('./pages/TournamentPage'));
const TeamBattlePage = lazy(() => import('./pages/TeamBattlePage'));
const DailyGuessPage = lazy(() => import('./pages/DailyGuessPage'));
const HowToPlayPage = lazy(() => import('./pages/HowToPlayPage'));

function RouteLoadingFallback() {
  return (
    <main
      className="flex min-h-[40vh] flex-1 items-center justify-center px-4 py-12"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-center shadow-2xl shadow-cyan-950/20">
        <div
          className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold tracking-wide text-cyan-100">Loading game mode…</p>
        <p className="mt-2 text-xs text-slate-400">Preparing the next screen safely.</p>
      </div>
    </main>
  );
}

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('[NEON GUESS] Route module failed to load', error);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-[40vh] flex-1 items-center justify-center px-4 py-12" role="alert">
        <div className="w-full max-w-sm rounded-3xl border border-rose-300/20 bg-slate-950/80 p-6 text-center shadow-2xl shadow-rose-950/20">
          <p className="text-sm font-semibold text-rose-100">This game screen could not load.</p>
          <p className="mt-2 text-xs text-slate-400">Check your connection, then try loading the mode again.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 min-h-11 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Reload game
          </button>
        </div>
      </main>
    );
  }
}

function PersistentClassicVoiceRoom() {
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
    <div className="pointer-events-none fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+6.25rem)] z-[60] w-auto max-w-[16rem] sm:left-auto sm:right-4 sm:top-24 sm:w-[min(16rem,calc(100vw-2rem))]">
      <div className="pointer-events-auto">
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
    </div>
  );
}

function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const isGame = location.pathname === '/game';
  const isAdmin = location.pathname === '/admin';
  const isCompetitive = location.pathname === '/tournament' || location.pathname === '/team-battle';

  // Game and Admin pages manage their own top UI
  const hideGlobalNav = isGame || isAdmin || isCompetitive;
  const hideBottomNav = isGame || isAdmin;

  return (
    <div className="min-h-screen w-full flex flex-col relative overflow-hidden">
      {!hideGlobalNav && (
        <TopAppBar
          toggleDrawer={() => setDrawerOpen((open) => !open)}
          drawerOpen={drawerOpen}
        />
      )}
      {!hideGlobalNav && (
        <>
          <NavigationDrawer isOpen={drawerOpen} closeDrawer={() => setDrawerOpen(false)} />
          {drawerOpen && (
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-30 hidden bg-black/40 md:block"
            />
          )}
        </>
      )}

      <div className="flex-1 overflow-x-hidden flex flex-col h-full w-full">
        {!isCompetitive && <SessionRouteRestore />}
        <ConnectionRecoveryBanner />
        <PersistentClassicVoiceRoom />
        <RouteErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
            <Route path="/" element={<LobbyPage />} />
            <Route path="/one-v-one" element={<LobbyPage />} />
            <Route path="/game" element={<GameBoardPage />} />
            <Route path="/results" element={<GameResultsPage />} />
            <Route path="/admin" element={<AdminGateway />} />
            <Route path="/tournament" element={<TournamentPage />} />
            <Route path="/team-battle" element={<TeamBattlePage />} />
            <Route path="/daily" element={<DailyGuessPage />} />
            <Route path="/how-to-play" element={<HowToPlayPage />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </div>

      {!hideBottomNav && <BottomNavBar />}
      <UiSoundLayer />
    </div>
  );
}

export default App;
