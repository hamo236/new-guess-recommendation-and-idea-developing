# Four/Tournament Confirmer Scoring Scope Lock

Date: 2026-08-26
Repository: `hamo236/new-guess-recommendation-and-idea-developing`
Branch: `main`
Baseline commit: `8456bbd56a46e3a997ecbab95979eb0bf1855b0a`

## Target

Repair scorer identity in Four/Tournament matches. When player A presses the UI action labelled `player B · GUESS CORRECT`, player B is the actual guesser and must receive the round point, cumulative match score, correct-guess statistics, match win, and resulting bracket placement. The scope covers `semi_a`, `semi_b`, `final`, and `consolation` (third-place match), with three rounds per match.

## Source-verified contract

`TournamentGameplay` tells the current player to confirm that the opponent guessed the current player's target correctly. The current implementation passes only the current player's private target ID to `actions.recordGuess(targetId)`. The Provider, Firebase writer, and engine then use the current authenticated/player ID as the guess owner. This is the first confirmed identity divergence.

## Protected

Pairing and bracket rules; exactly three rounds in each Four match; existing five-second reveal timing; target assignment and private-target boundaries; categories/content; score formula; semifinal winner/loser routing into Final and Third Place; final placements; room capacity/join/leave/refresh/recovery; routes/navigation; 1v1 behavior; 2v2 behavior; existing Firebase project boundary (`neon-guess-test` only); no Firebase publication or destructive data action.

## Allowlist for implementation

- `src/pages/CompetitiveModePage.jsx` only if the action must pass explicit confirmer/guesser identity or confirmation state must be adjusted.
- `src/context/CompetitiveModeContext.jsx` for Four-only action routing and exactly-once resolution.
- `src/firebase/competitiveFirebase.js` for the scoped tournament confirmation payload/path if required by the existing authorization contract.
- `src/modes/tournamentEngine.js` for a pure, identity-explicit confirmation/score transition.
- Focused Four/Tournament tests and static contracts.
- This evidence report.

Active `database.rules.json` is not in the allowlist. The prior simplified Rules candidate remains separate and will only be touched if a tested payload/path change proves Rules compatibility requires a candidate-only adjustment.

## Evidence states

- SOURCE VERIFIED: current UI wording, Provider call chain, Firebase payload, engine scoring key, and resolver path were inspected.
- ENGINE TEST PENDING: a failing deterministic test must demonstrate that confirmer A currently receives credit when opponent B guessed correctly.
- LIVE FIREBASE / LIVE BROWSER / FOUR-CLIENT: not yet verified in this task.

## Rollback triggers

Rollback the scoped patch if it changes protected bracket/round/reveal/target behavior, causes a 1v1 or 2v2 regression, fails build/syntax, allows duplicate scoring, or cannot preserve the current authorized Firebase write boundary.

## Scope closure

The deterministic failing regression reproduced the inversion, and the minimal identity-explicit repair passed focused, adjacent, candidate-Rules, protected-mode, smoke, and build validation. See `evidence/four-confirmer-scoring-repair-2026-08-26.md` for the complete evidence matrix and remaining live-validation limits.

- ENGINE TEST VERIFIED: confirmer actions credit the actual guesser across both semifinals, Final, and Third Place.
- BUILD VERIFIED: production build and `git diff --check` passed.
- LIVE FIREBASE / LIVE BROWSER / FOUR-CLIENT: still not verified in this task.
