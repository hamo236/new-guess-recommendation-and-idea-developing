# 2v2 Team Battle Target Reveal Repair Evidence — 2026-08-26

## Executive finding

The reported 2v2 defect was a **state projection and reconstruction bug**, not a Firebase Rules publication problem. The five-second reveal component already rendered two team cards, but the authoritative `round_result` payload could contain only the target snapshot available to the viewer that completed resolution. In the online path, confirmation records intentionally persist actor and round metadata without private target images, and public sanitization removes private confirmation snapshots. The resolver therefore could not reliably reconstruct both team targets.

The repair now reconstructs one completed target snapshot for **each team** from the existing deterministic `targetMapForTeams` contract at round resolution. Public sanitization exposes those target images only for a completed Team Battle `round_result` or `finished` result, while continuing to remove playing-state target maps and private confirmation snapshots. No Rules file was modified or published.

## User contract and protected behavior

| Area | Required and preserved behavior |
|---|---|
| Reveal | Team A and Team B target images both appear between rounds and on final results |
| Timing | Existing five-second reveal and synchronized advance remain unchanged |
| Privacy | Playing state does not expose `match.targets` or `match.teamTargets`; each player continues seeing the opponent target through the private-target path |
| Confirmation | Both teammates must complete the existing confirmation pair before resolution |
| Rounds | Exactly three rounds remain in the existing order |
| Gameplay | Team assignment, target rotation, categories, score/winner logic, Leave/recovery, routing, 1v1, and Four/Tournament remain outside the repair scope |
| Firebase | Only the `neon-guess-test` application path is in scope; no Rules publication, database deletion, credentials, or production/Page project access was performed |

## Source evidence

The page-level `TeamRevealTargets` component iterates through both `state.teams` entries and looks up each card using `result.targets[team.playerIds[0]]`. The UI therefore has a two-card contract and was not the primary cause.

The Provider’s original `resolveTeamRound` assembled `targetSnapshots` from the current viewer’s `privateTarget` and from `confirmation.targetSnapshot` values. The Team Battle Firebase confirmation writer does not persist target snapshots in the public confirmation record, and `sanitizePublicState` removes those private fields. Consequently, the transaction’s available snapshot set depended on which client performed the resolution. This explains why Team A or Team B could appear inconsistently.

The original Firebase sanitizer also removed `safe.match.result.targets` unconditionally. Even when a completed result contained both snapshots, the public listener could not receive them for the reveal UI. The failure is reproducible locally: a result built with only Team B’s available snapshot has `result.targets.p3` but no `result.targets.p1`, causing the Team A image card to render `Target unavailable.`

## Implementation

The patch is intentionally narrow.

First, `targetSnapshotsForTeams` was added to `src/modes/teamBattleTargetPlan.js`. It uses the existing category, team assignments, room seed, and round number to produce one sanitized target snapshot per team without changing target selection or rotation.

Second, `resolveTeamRound` in `src/context/CompetitiveModeContext.jsx` now calls that helper with the authoritative current Team Battle state and the same room-seed/round contract used when targets are assigned. The resolver no longer depends on one viewer’s private target for reveal completeness.

Third, `sanitizePublicState` in `src/firebase/competitiveFirebase.js` now preserves `match.result.targets` only when `safe.mode === 'team_battle'` and the match status is `round_result` or `finished`. It continues stripping targets during `playing`, and no Tournament or 1v1 result-target exposure was enabled.

Fourth, `scripts/qa-team-battle-reveal-targets.mjs` covers both-team images in raw and public completed results, distinct target IDs, and playing-state privacy. `scripts/qa-team-battle-ui.mjs` now asserts deterministic dual-target reconstruction and completed-Team-Battle-only public projection.

## Verification results

| Evidence class | Result |
|---|---|
| Pre-repair deterministic regression | FAIL reproduced: second team target was absent when only one viewer snapshot was supplied |
| Focused dual-target reveal regression | PASS |
| Team Battle engine QA | PASS |
| Team Battle 3-round flow QA | PASS |
| Team Battle UI/adapter contract | PASS |
| Fresh target rotation/privacy-compatible mapping | PASS |
| `npm run test:team-battle` | PASS |
| `npm run test:start-flow` | PASS |
| Repository smoke `npm test` | PASS |
| Four/Tournament identity regression | PASS |
| Four lifecycle, bracket, UI, Firebase, runtime contracts | PASS |
| Image paths, removed-player, and route contracts | PASS |
| Production build | PASS |
| `git diff --check` | PASS |

The production build emitted only existing non-blocking warnings about Firebase static/dynamic imports and a large JavaScript chunk. The build completed successfully and generated the BrowserRouter fallback documents.

## Change boundary

Changed files are limited to the 2v2 target-planning helper, Team Battle Provider resolution, Firebase public-state projection, Team Battle UI contract assertions, the focused reveal regression, and this evidence report. `database.rules.json` and `database.rules.simplified-candidate.json` were not modified. The prior Four scoring repair at commit `1e2e475` remains intact.

## Verification limits

Local engine, static, smoke, and build tests establish source-level and deterministic behavior. They do not prove live synchronization across four independent devices, the currently published Firebase Rules state, network retry behavior, or a real deployed GitHub Pages build. Those remain **NEEDS USER TEST**.

## Manual acceptance test

Use four independent browsers or phones in the Test deployment. Start a 2v2 room, confirm that each player sees the opponent team target during `playing`, complete both teammates’ confirmations, and inspect the `round_result` reveal. Both Team A and Team B cards must show an image and distinct target name. Wait through the existing five-second transition and repeat for rounds 2 and 3. Then refresh one client during the reveal and confirm that it recovers without exposing either team’s playing-state target before the result is authoritative.
