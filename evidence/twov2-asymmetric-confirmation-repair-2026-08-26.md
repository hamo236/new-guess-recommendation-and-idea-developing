# 2v2 Asymmetric Confirmation Deadlock Repair

**Repository:** `hamo236/new-guess-recommendation-and-idea-developing`  
**Branch:** `main`  
**Scope:** Team Battle / 2v2 only  
**Date:** 2026-08-26

## Incident contract

In a 2v2 round, every player may confirm that the opposing team guessed correctly. A round must resolve when **at least one team has a complete pair of confirmations** from both of its players. A single confirmation from the other team is pending evidence and must not block the completed pair.

For example, if A1 confirms Team B, while B1 and B2 confirm Team A, Team B has completed its pair. The round must resolve and Team A receives the point because Team B’s two players confirmed that Team A guessed correctly. The incomplete A1 confirmation must not make the resolver wait for A2.

## Source diagnosis

The existing engine built `getRequiredConfirmationTeams` from every team that had any current confirmation. The `areAllRequiredTeamConfirmationsComplete` predicate then required **every** such team to reach two confirmations. Therefore the persisted state `Team A = 1/2` and `Team B = 2/2` was treated as incomplete, even though one team had a complete pair.

The Provider used the same all-required predicate in both `resolveTeamRound` and its automatic resolution effect. Consequently, the state could remain in `playing` indefinitely. Since the round never entered `round_result`, the normal five-second reveal timer and advance path were never reached. This is a progression-gate defect in 2v2 confirmation logic, not a Firebase Rules defect.

The existing individual toggle path already removed a pending confirmation when the same player pressed again before the team pair was complete. That behavior was retained.

## Minimal implementation

The repair adds two pure engine helpers:

- `getCompletedConfirmationTeams(state)` returns only required teams whose two current-round confirmations are complete.
- `hasResolvableTeamConfirmation(state)` returns whether at least one completed team exists.

Only Team Battle resolution uses the new predicate. `finishTeamRound`, `resolveTeamRound`, and the Provider auto-resolution effect now resolve from completed teams only. The existing `areAllRequiredTeamConfirmationsComplete` predicate remains available for compatibility and existing tests that explicitly model both-team completion.

The resolution winner list is now derived from completed teams. A completed Team A pair awards the point to Team B; a completed Team B pair awards the point to Team A. If both teams complete, both results remain supported as before.

No gameplay content, target assignment, target privacy, category data, teams, round count, five-second reveal duration, round order, 1v1, Four/Tournament, routing, or Firebase Rules were modified.

## Regression coverage

A new deterministic test, `scripts/qa-team-battle-asymmetric-confirmation.mjs`, proves the following:

1. The pre-repair state with A1 pending and B1+B2 complete fails the old all-required completion predicate.
2. The new resolvable-team predicate recognizes the completed pair.
3. `finishTeamRound` enters `round_result` and awards the point to the correct opposing team.
4. An incomplete single confirmation can still be toggled off before a pair completes.
5. The incomplete cancellation path does not resolve a round.

The existing Team Battle engine, three-round flow, guessed-correct cancellation, dual-target reveal, UI contract, and target-freshness tests remain passing.

## Validation evidence

The following commands passed after the repair:

```text
node scripts/qa-team-battle-asymmetric-confirmation.mjs
node scripts/qa-team-battle-engine.mjs
node scripts/qa-team-battle-flow.mjs
node scripts/qa-guessed-correct-repair.mjs
node scripts/qa-team-battle-reveal-targets.mjs
node scripts/qa-team-battle-ui.mjs
node scripts/qa-team-battle-target-freshness.mjs
npm run test:team-battle
npm run test:start-flow
node scripts/tournament-confirmer-score.test.mjs
node scripts/tournament-lifecycle.test.mjs
node scripts/tournament-json-progression.test.mjs
node scripts/tournament-natural-guess-flow.test.mjs
node scripts/tournament-firebase-confirmation.test.mjs
node scripts/tournament-runtime-contract.test.mjs
npm run test:image-paths
npm run test:pages-routes
npm run test:removed-player
npm test
npm run build
git diff --check
```

The production build completed successfully. Existing non-blocking warnings remain about Firebase static/dynamic imports and the large JavaScript chunk; these warnings were not introduced as a gameplay change and did not fail the build.

## Security and release boundary

The active Rules file and the simplified candidate Rules file were not modified. No Firebase Console publication, live database write, data deletion, credential use, or service-account operation was performed. The change is source-only and must still receive live multi-client verification in the user’s `neon-guess-test` Firebase environment.

## Verification limits

**SOURCE:** verified through the Team Battle engine and Provider resolution paths.  
**TEST:** deterministic local regression and protected-mode suite passed.  
**BUILD:** production build passed.  
**LIVE FIREBASE:** not verified in this run.  
**LIVE BROWSER / independent devices:** needs user test with four clients.
