# Four/Tournament Confirmer Scoring Repair

Date: 2026-08-26
Repository: `hamo236/new-guess-recommendation-and-idea-developing`
Branch: `main`
Baseline commit: `8456bbd56a46e3a997ecbab95979eb0bf1855b0a`

## Scope and protected contract

The target defect was the Four/Tournament scorer-identity inversion across `semi_a`, `semi_b`, `final`, and `consolation` (Third Place). When the current player presses the opponent-labelled `GUESS CORRECT` button, the opponent is the actual guesser and must receive the point, cumulative score, correct-guess statistic, match win, and bracket placement.

The repair did not intentionally change pairing, bracket routing, three-round match structure, five-second reveal timing, target assignment or privacy, categories/content, score formula, Final/Third Place placement rules, room capacity, join/leave/refresh behavior, routes, 1v1, 2v2, authentication, or Firebase project boundaries. The active `database.rules.json` was not changed or published.

## Source-verified root cause

`TournamentGameplay` presents the current player with the opponent's target and the text “Confirm that <opponent> guessed your target correctly.” Before the repair, the UI passed only the current player's target ID. The Provider, Firebase writer, and engine treated the authenticated/current player as the guess owner. The persisted record was keyed by that confirmer and had no separate actual-guesser identity. Consequently, score, statistics, resolver output, and bracket winner selection followed the confirmer key rather than the player who guessed correctly.

A second source-level issue in the same path was that local scoring and later resolution could award an already-recorded correct guess again. The repaired engine marks a stored guess as scored and reconciles it idempotently before completing a round.

## Implementation

The Provider now derives the opponent as `guesserId` for Four-only confirmations. The Firebase writer keeps the authorized write path under the submitting `confirmerId`, while storing both `confirmerId` and `guesserId` in the confirmation payload. This preserves the existing participant-scoped Rules boundary and does not authorize a player to write another player's path.

The pure tournament engine now has an explicit `recordMatchConfirmation` transition. It validates that confirmer and guesser are distinct participants in the same match, scores the actual guesser, and prevents duplicate scoring. Stored confirmations are normalized by actual guesser for round and finished-match results. A malformed confirmation whose `guesserId` does not match the only valid opponent is rejected by score reconciliation.

The existing direct `recordMatchGuess` helper remains available as a compatibility wrapper for legacy tests/callers; the Four UI/Provider path uses the explicit confirmer/guesser transition.

## Test evidence

`ENGINE TEST VERIFIED`: `scripts/tournament-confirmer-score.test.mjs` passed. It simulates asymmetric 2–1 outcomes through both semifinals, Final, and Third Place, asserts exact cumulative scores, validates actual-guesser result identity and separate confirmer identity, checks five-second reveal timestamps, verifies final placements, verifies cumulative correct-guess statistics, and rejects a malformed confirmer-self `guesserId` without awarding a point.

`TEST VERIFIED`: the following adjacent Tournament tests passed:

- `scripts/tournament-lifecycle.test.mjs`
- `scripts/tournament-json-progression.test.mjs`
- `scripts/tournament-natural-guess-flow.test.mjs`
- `scripts/tournament-firebase-confirmation.test.mjs`
- `scripts/tournament-runtime-contract.test.mjs`

`TEST VERIFIED`: candidate-only Rules validation passed with the updated actor/guesser payload fixture:

- `scripts/security-rules-simplified-candidate-contract.test.mjs`
- `scripts/security-rules-simplified-candidate-competitive.test.mjs`

The candidate test confirmed that valid Tournament confirmations continue to write under each authenticated participant's own `matches/<matchId>/guesses/<confirmerId>` path. The candidate Rules file remains separate from the active Rules file and was not published.

`TEST VERIFIED`: `npm run test:team-battle`, `npm run test:start-flow`, and `npm test` passed. These cover protected 2v2 lifecycle/target/privacy contracts, Firebase-confirmed start flow, and repository smoke contracts.

`BUILD VERIFIED`: `npm run build` passed and generated the Pages fallback documents. Existing non-blocking Vite warnings remain for Firebase static/dynamic import chunking and a large approximately 666 kB JavaScript chunk. `git diff --check` passed.

## Runtime and external verification limits

`LIVE FIREBASE VERIFIED`: not performed. No Firebase Rules publication, database mutation, credential operation, or destructive action was performed. The changed payload is statically compatible with the active Rules checks because the write remains actor-scoped and retains `playerId === auth.uid`, active-match, participant, and current-round conditions; the active Rules file itself was not changed.

`LIVE BROWSER VERIFIED`: not performed in this pass.

`FOUR-CLIENT VERIFIED`: not performed. The deterministic engine and candidate emulator tests do not prove four independent phones or live listener convergence. Manual Test-environment validation remains required.

## Release assessment

The source repair and automated regression coverage are complete. The correct status for this pass is **CONDITIONAL / NEEDS USER TEST**: source, engine tests, adjacent regressions, candidate Rules emulator checks, and build are verified; live Firebase and four-client browser behavior remain unverified.

## Manual acceptance scenario

Use four independent clients against the Test environment. In each match, the player who actually guesses correctly must be the player whose score increases, while the opponent only confirms. Verify this in both semifinals, then repeat in Final and Third Place. Confirm all three rounds, the five-second reveal, bracket routing, final placements, refresh/reconnect behavior, and that no target is exposed to the wrong viewer.
