# Release / QA Guard Report — Join and 1v1 Start Repair

**Date:** 2026-08-26  
**Repository:** `hamo236/new-guess-recommendation-and-idea-developing`  
**Branch / commit:** `main` / `e3bf98c88a780d7a2d07166837e12a14bcf44b92`  
**Firebase scope:** `neon-guess-test` only  
**Production/Page Firebase:** explicitly unchanged and denylisted

## Decision

**CONDITIONAL.** The Test repository source, Rules artifact, emulator contracts, protected regressions, production build, Git push, and GitHub Pages workflow are verified. Live multiplayer acceptance remains conditional because the corrected RTDB Rules still require manual publication in the `neon-guess-test` Firebase Console, followed by a fresh independent-device 1v1 Join and Start test.

## Executive summary

The 1v1 Start symptom was a real synchronization failure with a visible optimistic-state consequence. `syncEnterPreview` sent a single root multi-location update. Three timestamp leaves in that payload had no child write authorization in the classic room Rules, so the entire update was rejected. The client nevertheless entered local Preview first; the authoritative listener later restored the old `lobby` snapshot, and the existing route guards returned the user to the Lobby.

The repair adds host-only, nonnegative numeric authorization for the three missing timestamp children and makes the existing `startGame` action await the existing Firebase write before dispatching local `START_GAME`. No new writer, backend, schema, gameplay rule, target path, or route meaning was introduced.

## Verification matrix

| Gate | Status | Evidence |
| --- | --- | --- |
| Incident intent | PASS | The patch directly addresses the rejected Start Preview fan-out and false optimistic Preview. |
| Source | PASS | `syncEnterPreview` payload, `GameStateContext.startGame`, Rules paths, listeners, and route rollback chain were traced. |
| Scope | PASS | Only the Rules, Start callback, focused contracts, emulator regression, package script, and evidence artifacts changed. |
| Static Start contract | PASS | `npm run test:start-flow` passed; Firebase confirmation precedes local `START_GAME`. |
| Static Rules contract | PASS | `node scripts/security-rules-contract.test.mjs` passed. |
| RTDB emulator | PASS | Exact host fan-out succeeds; player, outsider, negative timestamp, and cross-room writes fail; private targets remain isolated. |
| Concurrent multi-client | PASS | 20-client isolation/capacity suite passed; rooms remained capped and join scores initialized safely. |
| Protected gameplay regressions | PASS | `npm test` and Team Battle QA passed, including three-round flow, five-second reveal state, target projection/privacy, and final winner contracts. |
| Image/routes regressions | PASS | Source image paths, built image paths, removed-player, and Pages route contracts passed. |
| Build | PASS | `npm run build` passed and generated route entry documents. Existing Vite warnings are non-blocking and unchanged in scope. |
| Git diff hygiene | PASS | `git diff --check` passed; no credentials or service-account material was added. |
| GitHub push | PASS | `origin/main` points to `e3bf98c`. |
| GitHub Pages workflow | PASS | Run `32979272340` completed successfully for the pushed SHA. |
| Live Firebase Rules publication | NOT VERIFIED / USER GATE | The agent did not publish RTDB Rules. Manual Console publication is required. |
| Live independent 1v1 Join after final repair | NOT VERIFIED | Requires a fresh room and a separate device/profile after Rules publication. |
| Live independent 1v1 Start after final repair | NOT VERIFIED | Requires the host to Start after the second client joins. |
| Live 2v2/Four full multiplayer regression | NOT VERIFIED | No four-independent-client evidence was available in this pass. |
| Refresh/reconnect/Leave and target-privacy live checks | NOT VERIFIED | These remain separate acceptance gates. |

## Changed files

| File | Purpose |
| --- | --- |
| `database.rules.json` | Authorizes the host to write `revealEndTimestamp`, `transitionStartedAt`, and `transitionEndsAt`; validates each as a nonnegative number. |
| `src/context/GameStateContext.jsx` | Waits for the existing `syncEnterPreview` write before local Preview dispatch. |
| `scripts/security-rules-contract.test.mjs` | Structural authorization and type assertions for the Start fields. |
| `scripts/security-rules-emulator.test.mjs` | Exact Start fan-out and negative authorization regression. |
| `scripts/start-flow-contract.test.mjs` | Source-order contract for Firebase confirmation before local `START_GAME`. |
| `package.json` | Registers `test:start-flow`. |
| `evidence/*` | Durable incident, engineering-task, research, audit, and release evidence. |

## Protected systems audit

**NO CONSTITUTION CHANGE.** The patch does not change target selection, target ownership, opponent-facing visibility, characters, categories, questions, 1v1 rules, 2v2/team rules, Four/Tournament rules, team composition, rounds, five-second reveal, timers, voting, elimination, scoring, winner determination, rematch behavior, room capacity, join semantics, navigation meaning, authentication, or private-target storage paths. `beginRound` was intentionally not changed because it is a separate transaction/private-target path and this incident was isolated to Start Preview.

## Required user gate

In the Firebase Console, select the `neon-guess-test` project, open Realtime Database Rules, replace the Rules with the reviewed repository artifact `database.rules.json`, and press **Publish**. Do not publish these Rules to any other Firebase project.

After publication, create a fresh 1v1 room on the Test Pages site. Join it from a genuinely independent device or browser profile. Confirm that the host’s Start Game remains in Preview instead of flashing back to Lobby. Record the exact room code, both client states, and any Firebase diagnostic message if it fails.

## Rollback / containment

The commit is isolated and reversible with Git if a verified regression appears. No raw database deletion, production change, Page-Firebase operation, service account, new backend, or secret was used. The unverified live gates must not be described as completed until the user performs the manual Rules publication and independent-client validation.

## References

[1]: https://firebase.google.com/docs/database/security "Firebase Realtime Database Security"
[2]: https://firebase.google.com/docs/database/security/rules-conditions "Firebase Realtime Database Rules Conditions"
[3]: https://firebase.google.com/docs/database/web/read-and-write#save_data_as_transactions "Firebase Realtime Database Web Transactions"
