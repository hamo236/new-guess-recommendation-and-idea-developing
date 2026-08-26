# Engineering Task: Repair social-room non-host join authorization

## Context
The active repository is `hamo236/new-guess-recommendation-and-idea-developing`, branch `main`, using Firebase Realtime Database project `neon-guess-test`. The affected live route is the published 1v1 route. The host successfully created room `247`; an independent phone client attempted to join and received a diagnostic at stage `join-transaction` with `PERMISSION_DENIED`, while the browser reported online/4G.

## User-Reported Problem
A second device cannot join a 1v1 room. The user requested deep investigation, decisive evidence, a safe repair, and execution without touching gameplay systems or their rules.

## Observed Behavior
`LIVE BROWSER / LIVE FIREBASE`: host creation succeeded for room `247`, but the independent phone failed during the join transaction with `PERMISSION_DENIED` after 1842 ms. The diagnostic identifies the failing operation stage but does not by itself identify the individual RTDB child write.

## Expected Behavior
A non-host authenticated client that has successfully reserved an available lobby slot and created its own authorized player record must be able to initialize its own zero score and complete the existing 1v1 join flow.

## Reproduction Steps
1. On the published Test Pages URL, create a 1v1 room with an existing category.
2. From an independent device/browser identity, enter the room code and join.
3. Observe the supplied diagnostic: stage `join-transaction`, code `PERMISSION_DENIED`.

## Investigation Findings
`src/firebase/roomService.js` reserves `rooms/<code>/joinSlots/<slotId>` transactionally, writes `rooms/<code>/players/<uid>` transactionally, and then performs `update(ref(db), { rooms/<code>/scores/<uid>: 0 })` for a new non-host.

`database.rules.json` previously authorized `rooms/$roomCode/scores` only at the parent node. Its non-host branch required `auth.uid === newData.child(auth.uid).val()` while also requiring `newData.child(auth.uid).val() === 0`. A Firebase UID cannot simultaneously equal numeric zero, so the non-host score initialization authorization was unsatisfiable. Existing isolation tests did not reproduce the defect because their join helper stopped after the player record write and omitted the application’s score initialization write.

The player and slot rules authorize the preceding operations for a legitimate lobby join. The score write is therefore the first confirmed source-level authorization divergence in the application’s actual join chain.

## Root Cause
Confirmed at source/rules level: the non-host `scores` parent write branch is internally contradictory and cannot authorize `rooms/<code>/scores/<uid> = 0`. The live diagnostic is consistent with this root cause; the exact child-path observation remains pending after deployment of the corrected rules contract.

## Affected Areas
- `database.rules.json`: social-room score authorization only.
- `scripts/multi-client-isolation-emulator.test.mjs`: real join sequence regression coverage.
- `scripts/security-rules-contract.test.mjs`: static contract guard for the non-contradictory rule shape.
- `src/firebase/roomService.js`: inspected only; no behavior change is planned.

## Implementation Requirements
Keep the host-only parent `scores` replacement rule. Add a child `$uid` rule allowing only the authenticated joining UID to create its own numeric zero score while the room is in lobby, the room is in lobby status, and the player record already exists. Remove the contradictory non-host branch from the aggregate parent rule. Execute the existing post-join score write unchanged.

## Constraints
Do not change targets, target visibility or assignment, categories/content, room capacity or join semantics, teams, rounds, timers, reveal timing, scoring formulas, match progression, navigation meaning, or any production/Page Firebase project. Use Test project scope only. Do not publish RTDB Rules autonomously; the user must manually publish the reviewed Test Rules in Firebase Console.

## Verification Requirements
Run the static Rules contract, syntax checks, the updated emulator integration test when an emulator is available, the existing smoke/team/image/removed-player/pages-route tests, production build, diff review, and a fresh independent-device live join. Label source, test, build, browser, Firebase, and multi-client evidence separately.

## Regression Checks
The repair must preserve host score-map writes, player/slot authorization, room isolation, four-player cap for social rooms, private-target isolation, competitive room creation/join contracts, and all protected gameplay contracts. No constitution amendment is authorized or required.

## Rollback Boundary
Rollback only the three allowlisted source/rules/test changes if the focused regression, build, diff review, or protected-mode checks fail. Do not touch live database data or perform raw destructive cleanup.

## Status
Investigation complete; repair implemented locally; live Test Rules publication and post-deployment independent-client verification remain external gates.
