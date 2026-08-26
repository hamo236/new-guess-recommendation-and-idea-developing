# 2v2 Team Battle Target Reveal Scope Lock — 2026-08-26

## Target
Repair the Team Battle (`2v2`) five-second `round_result` reveal so both Team A and Team B completed target images are rendered for every completed round.

## User-observed symptom
Between rounds, the reveal cards for both teams are present, but only one team’s target image appears. The other card renders without its target image. The affected target can vary between Team A and Team B.

## Expected behavior
After a Team Battle round resolves, the five-second reveal must show the completed target protected by Team A and the completed target protected by Team B, using the existing target presentation and authoritative round result. The reveal remains five seconds, followed by the existing next-round transition.

## Protected behavior
- Exactly two stable teams: Team A and Team B, two players per team.
- Target privacy during `playing`: each player sees the opponent team target, not the own-team target.
- Both teammates must confirm before the round resolves.
- Exactly three rounds, in order: `playing → round_result/reveal → next playing`, then final results.
- Existing target rotation and category/content data.
- Existing cumulative scoring, winner/tie behavior, result screen, refresh/recovery, Leave, routing, 1v1, Four/Tournament, authentication, and Firebase namespaces.
- No Firebase Rules publication, active Rules overwrite, database deletion, credential handling, or production/Page changes.

## Initial source evidence
- `TeamResult` renders `TeamRevealTargets` during `round_result` and `finished`.
- `TeamRevealTargets` renders one card per `state.teams` entry but reads the image only from `result.targets[team.playerIds[0]]`.
- `finishTeamRound` constructs `result.targets` from `requestedSnapshots` and `revealSnapshots`; the Provider currently builds `targetSnapshots` from one viewer’s `privateTarget` plus available confirmation snapshots.
- The complete event chain still needs validation across the Team Battle engine, Provider, Firebase writer/listener/sanitizer, and existing tests before choosing the minimal repair.

## Allowlist candidate
`src/modes/teamBattleEngine.js`, `src/context/CompetitiveModeContext.jsx`, `src/pages/CompetitiveModePage.jsx`, relevant Team Battle target/Firebase adapter only if the traced contract requires it, and focused regression/contract/evidence files.

## Evidence limits
No live Firebase or four-client browser result has been supplied for this incident. Local deterministic and integration tests can establish source/engine/build behavior but cannot by themselves prove real-device synchronization.

## Completed source trace

The defect has two linked, source-verified causes in the online path. First, `resolveTeamRound` currently constructs `targetSnapshots` from the current viewer's `privateTarget` plus `confirmation.targetSnapshot` values. The Team Battle confirmation writer intentionally persists only `{ playerId, teamId, matchId, roundNumber, confirmedAt }`, so online confirmations do not carry snapshots. Public-state sanitization also removes `match.confirmations.*.*.targetSnapshot`, so a transaction cannot recover those private snapshots from the public room state. The result therefore depends on whichever one target is available to the resolving viewer.

Second, `sanitizePublicState` unconditionally removes `safe.match.result.targets`, even when `match.status` is `round_result` or `finished`. `TeamRevealTargets` renders its two cards from `result.targets[team.playerIds[0]]`; it already has the correct two-card rendering loop, but the public result payload cannot reliably contain the two target images. This is a state-projection defect, not a Firebase Rules publication problem.

## Minimal repair direction

At resolution time, reconstruct both team target snapshots from the same deterministic `targetMapForTeams` contract already used for assignment and delayed target fallback. This avoids exposing targets during `playing`, avoids relying on one viewer's private target, and preserves target privacy. Then allow only Team Battle `match.result.targets` to pass through public sanitization when the match is already in `round_result` or `finished`; continue stripping playing targets, `match.targets`, `match.teamTargets`, private confirmation snapshots, and all Tournament/1v1 private target payloads.
