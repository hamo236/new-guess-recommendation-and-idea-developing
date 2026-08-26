import assert from 'node:assert/strict';
import fs from 'node:fs';

const context = fs.readFileSync(new URL('../src/context/CompetitiveModeContext.jsx', import.meta.url), 'utf8');
const firebase = fs.readFileSync(new URL('../src/firebase/competitiveFirebase.js', import.meta.url), 'utf8');
const engine = fs.readFileSync(new URL('../src/modes/tournamentEngine.js', import.meta.url), 'utf8');
const rules = fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');

assert.match(context, /submitTournamentGuess\(\{ roomId, matchId: active\.matchId, confirmerId: playerId, guesserId, roundNumber: active\.roundNumber \}\)/, 'Tournament Guess Correct must send the confirmer and actual guesser separately');
assert.match(context, /const hasConfirmation = match\.playerIds\.some\(\(id\) => Boolean\(match\.guesses\?\.\[id\]\)\)/, 'One valid opponent confirmation must be sufficient to trigger the Tournament round resolver, matching 1v1');
assert.match(context, /const protectedTargets = currentMatch\?\.targets[\s\S]*targetMapForTournament\(resolved\.category, currentMatch\.playerIds[\s\S]*getTournamentRoomSeed\(resolved, roomId\)/, 'Host resolution must reconstruct room-seeded protected targets inside the authoritative transaction when public state is sanitized');
assert.match(firebase, /matches\/\$\{matchId\}\/guesses\/\$\{confirmerId\}/, 'Scoped Tournament confirmation writer must target only the submitting confirmer');
assert.match(firebase, /confirmerId,\n    guesserId,/, 'Tournament confirmation payload must retain confirmer and actual guesser identities');
assert.match(engine, /playerMap: Object\.fromEntries\(playerIds\.map\(\(id\) => \[id, true\]\)\)/, 'Tournament matches must expose an explicit participant map for rules validation');
assert.match(engine, /recordMatchConfirmation\(state, matchId, confirmerId, targetId, guesserId/, 'Tournament scoring must accept confirmer and actual guesser as separate identities');
assert.match(engine, /guesserId\].*correctGuesses/, 'Tournament scoring must update statistics using the actual guesser identity');
assert.match(rules, /"matches": \{[\s\S]*"guesses": \{[\s\S]*data\.parent\(\)\.parent\(\)\.child\('playerMap'\)\.child\(auth\.uid\)\.val\(\) === true/, 'Tournament rules must permit only a participant to write their own active-match guess');
assert.match(rules, /newData\.child\('roundNumber'\)\.val\(\) === data\.parent\(\)\.parent\(\)\.child\('roundNumber'\)\.val\(\)/, 'Tournament guess writes must be restricted to the current round');

console.log('tournament-firebase-confirmation: PASS');
console.log('Non-host Tournament confirmations use a participant-scoped Firebase path with active-match and current-round validation.');
