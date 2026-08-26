import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const competitivePage = fs.readFileSync(path.join(repo, 'src/pages/CompetitiveModePage.jsx'), 'utf8');
const lobbyPage = fs.readFileSync(path.join(repo, 'src/pages/LobbyPage.jsx'), 'utf8');
const provider = fs.readFileSync(path.join(repo, 'src/context/CompetitiveModeContext.jsx'), 'utf8');
const roomManager = fs.readFileSync(path.join(repo, 'src/game/roomManager.js'), 'utf8');

assert.match(roomManager, /export const MAX_PLAYERS = 4;/, 'shared room capacity must remain four');
assert.match(competitivePage, /const TEAM_LOBBY_SEATS = 3;/, '2v2 must preserve the existing three-seat visual model');
assert.match(competitivePage, /teamA: players\.filter\(\(player\) => player\.teamId === 'team_a'\)\.length/,
  '2v2 readiness must count Team A players explicitly');
assert.match(competitivePage, /teamB: players\.filter\(\(player\) => player\.teamId === 'team_b'\)\.length/,
  '2v2 readiness must count Team B players explicitly');
assert.match(competitivePage, /teamA === 2 && teamB === 2/,
  '2v2 readiness must require exactly two players per team');
assert.match(competitivePage, /const balancedStart = mode === COMPETITIVE_MODES\.TEAM_BATTLE \? isBalancedTeamLobby\(players\) : players\.length === 4/,
  '2v2 Start must use an exact balanced lobby predicate');
assert.match(competitivePage, /disabled=\{!balancedStart \|\| Boolean\(pendingAction\)\}/,
  '2v2 Start must remain disabled until the lobby is balanced');
assert.match(competitivePage, /actions\.onChangeTeam \|\| actions\.changeTeam/, 'each player must retain a lobby team-switch action');
assert.match(provider, /validateTeamAssignments\(lobbyAssignments(?:, players\.map\(\(player\) => player\.id\))?\)/, 'authoritative 2v2 start validation must remain enabled');
assert.match(lobbyPage, /mode === GAME_MODES\.SOCIAL.*players\.length !== 4/s, 'Four must require exactly four players before Start');
assert.match(lobbyPage, /Room Full|room full/i, 'full-room feedback must be represented in the lobby flow');
assert.match(lobbyPage, /GAME_MODES\.ONE_V_ONE.*players\.length !== 2/s, '1v1 must require exactly two players');

console.log('Lobby capacity contract passed.');
