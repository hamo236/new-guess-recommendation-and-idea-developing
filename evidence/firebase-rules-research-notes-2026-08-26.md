# Firebase Rules research notes — 2026-08-26

## Official sources

1. Firebase, “Understand Firebase Realtime Database Security Rules,” https://firebase.google.com/docs/database/security (last updated 2026-08-24 UTC, retrieved 2026-08-26).
   - Every read/write request is completed only if server Rules allow it; default access is denied.
   - `.read` and `.write` rules cascade. A shallower allow overrides a deeper deny.
   - `.validate` rules do not cascade and are evaluated for every relevant non-null node in a write.
   - Authenticated identity is exposed to RTDB Rules through `auth.uid` and related token fields.

2. Firebase, “Use conditions in Realtime Database Security Rules,” https://firebase.google.com/docs/database/security/rules-conditions (retrieved 2026-08-26).
   - `data` is the pre-write state; `newData` is the merged post-write state.
   - Rules can reference `root`, `data`, and `newData` at other paths.
   - `.write` must grant access before `.validate` can accept the data; invalid data is rejected even if write authorization passes.
   - A path-key `$variable` is a string and must be compared with the correct type.

3. Firebase, “Read and Write Data on the Web,” https://firebase.google.com/docs/database/web/read-and-write (retrieved 2026-08-26).
   - `set()` replaces data at its target path; `update()` writes specified child paths and can perform fan-out updates.
   - `get()` reads a server snapshot and can fail if the server value cannot be returned.
   - Listeners receive initial and subsequent snapshots; listeners should be attached at the lowest required path to avoid unnecessary payloads.
   - Firebase Local Emulator Suite is recommended for prototyping and Rules testing before live deployment.

## Project evidence observed in source

- Active repository: `/home/ubuntu/neon_guess_test_upload_staging`, branch `main`, commit `756d334`; remote is Recommendation and Idea Developing.
- Firebase config resolves to Test identifiers in `src/firebase/firebasePublicConfig.js`: project `neon-guess-test`, RTDB URL `https://neon-guess-test-default-rtdb.firebaseio.com`.
- `roomService.js` 1v1 join sequence: read `/rooms/<code>`; reserve `/rooms/<code>/joinSlots/<slot>` via transaction; create `/rooms/<code>/players/<uid>` via transaction; initialize `/rooms/<code>/scores/<uid>` with root-level `update()`; then read back the room and set presence.
- The reported live diagnostic identified `Stage: join-transaction`, `Code: PERMISSION_DENIED`, while browser online, proving the failure was during the join transaction group rather than a generic offline error.
- Current social Rules around `/rooms/$roomCode`: room read allows authenticated users when room is absent or in lobby, or when they are members; room creation is host-only; join slot creation is self-UID/lobby constrained; player creation is self-UID and requires a reserved slot/lobby; score child creation is self-UID, value 0, lobby, and existing player; parent `scores` write is host-only.
- Important transaction fact to verify in the report: a client transaction requires read permission at the transaction path, and a multi-location `update()` is authorized across all affected locations. A child `.write` rule cannot override a shallower parent `.write` allow/deny; the final decision must be checked against actual deployed Rules and the exact operation shape.

## Scope lock

This is REPORT MODE only. No source, Rules, Firebase data, deployment, or gameplay behavior is to be changed during this research pass. Protected contracts include target privacy, target assignment, modes, room capacity/join semantics, rounds, timers, scoring, teams, brackets, reveal, Leave, refresh, and winner logic.

## Evidence status

- SOURCE VERIFIED: repository identity, source join sequence, current Rules file.
- LIVE FIREBASE VERIFIED: independent phone failure at `join-transaction` with `PERMISSION_DENIED`.
- RULES DEPLOYMENT VERSION: NOT VERIFIED in this pass; Firebase Console state may differ from repository file until manually published.
- ROOT CAUSE OF THE NEW START FAILURE: NOT VERIFIED; requires exact Start diagnostic stage and a comparison of deployed Rules with the repository Rules.
- FOUR-CLIENT VERIFIED: not available.

## Report direction

The final report must not claim that the current `scores/$uid` repair solves Start. It must distinguish join failure from start failure, explain cascading `.write` behavior and transaction/read requirements, enumerate likely future denial boundaries for start, target writes, action writes, votes, messages, cleanup, reconnect, and host migration, and propose—but not execute—a 10-task repair/validation plan.

## Expanded research checkpoint

### Official primary source reviewed

- Firebase, “Understand Firebase Realtime Database Security Rules,” https://firebase.google.com/docs/database/security. The page states that Rules live on Firebase servers, are enforced automatically, and every read/write completes only when Rules allow it; default access is denied. It distinguishes `.read`, `.write`, `.validate`, and `.indexOn`, and states validation does not cascade.
- Search results also identified the relevant official follow-up sources for the next research passes: https://firebase.google.com/docs/database/security/rules-conditions, https://firebase.google.com/docs/database/web/read-and-write, https://firebase.google.com/docs/auth/web/anonymous-auth, and https://firebase.google.com/docs/emulator-suite/connect_auth.

### Active baseline re-confirmed

- Repository remote: https://github.com/hamo236/new-guess-recommendation-and-idea-developing.git.
- Branch: `main`; source commit: `756d3342bdffa32ff7acbdb3697b6a5d884b9760`.
- Firebase identifiers in source: project `neon-guess-test`; RTDB `https://neon-guess-test-default-rtdb.firebaseio.com`; auth domain `neon-guess-test.firebaseapp.com`.
- Working tree contains only two uncommitted report artifacts created for this report-only audit: `evidence/firebase-rules-research-notes-2026-08-26.md` and `evidence/firebase-rules-start-permission-review-2026-08-26.md`; no source or Rules edits were made in this expanded pass.

### Current Rules inventory from source

- `rooms/$roomCode` has a fresh-room-only parent `.write`; existing-room host updates are not granted at the parent. Explicit child rules cover some lobby/game fields, but the complete client fan-out must be compared field by field.
- `teamRooms/$roomId` and `tournamentRooms/$roomId` have an existing-room host parent `.write`, but child validation and authorization still determine whether a multi-location operation is accepted safely.
- `privateRooms`, `teamBattlePrivateTargets`, and `tournamentPrivateTargets` keep target records outside public room state. The exact viewer-facing/own-target contract must be preserved while checking that the client’s target write shape matches the Rules validation shape.
- Team seats and join slots are separately authorized, so capacity and player-record updates can fail independently if a client performs a compound write that is not covered by all relevant child rules.

### Research status

- Phase 1 baseline is source verified. Live Firebase Rules revision remains not verified because Rules are manually published in Console and GitHub Pages does not publish them.
- The expanded report must cover both availability failures (legitimate host/player denied) and security failures (overbroad grants), across 1v1, 2v2, and Four. No future Rule should be recommended as a blanket authenticated or blanket room-host write without a complete fan-out emulator test and a non-host negative test.

## Official evidence pass: Rules semantics, auth, performance, and testing

The official Firebase Rules conditions guide, https://firebase.google.com/docs/database/security/rules-conditions, confirms that `auth` is null before authentication and that authenticated requests expose a unique `auth.uid`; it distinguishes pre-write `data` from merged post-write `newData`; and it confirms that `.write` authorization and `.validate` are separate, with validation evaluated only after a write grant and not cascading. It also documents `root` cross-path references and `$` path variables. These semantics are directly relevant to compound room writes: every path in the client fan-out must be authorized and validated against the merged state, and a child validation failure rejects the whole write.

The official web read/write guide, https://firebase.google.com/docs/database/web/read-and-write, documents `update()` for multi-location fan-out and warns that `set()` replaces data at the addressed location. It recommends listeners at the lowest needed path and explains that `onValue()` fires for child changes. This supports auditing whether Start/Join fan-outs write only allowlisted paths and whether listeners download more room state than necessary.

The official performance guide, https://firebase.google.com/docs/database/usage/optimize, recommends measuring before optimizing, using native SDK connections, flat structures, multi-path updates, query limits, low-level listeners, and listener cleanup. It cites a 200,000 active-connection limit as a general Realtime Database capacity figure and notes that actual project quotas/usage must still be checked. This is background capacity evidence, not proof that this app has been load-tested.

The official anonymous-auth guide, https://firebase.google.com/docs/auth/web/anonymous-auth, confirms anonymous accounts are temporary authenticated identities usable with Rules, and that anonymous sign-in must complete before `onAuthStateChanged` supplies the UID. It also documents IP-based limits on new anonymous sign-ups. Therefore a phone Join failure must distinguish `auth.uid` mismatch, auth readiness/session persistence, and RTDB authorization; Browser online status alone does not prove the Firebase Auth token is ready or accepted by Rules.

The official Emulator Suite RTDB guide, https://firebase.google.com/docs/emulator-suite/connect_rtdb, states that emulator project IDs should match the app project ID, demo projects avoid accidental live-resource changes, emulators start with closed rules, and Rules coverage can be inspected at `/.inspect/coverage` and `/.inspect/coverage.json`. It also documents clearing/importing emulator data between tests.

The official Rules unit-testing guide, https://firebase.google.com/docs/rules/unit-tests, states that `@firebase/rules-unit-testing` can mock authenticated and unauthenticated contexts, that `assertSucceeds` and `assertFails` should be used, and that emulator data persists unless explicitly cleared. It also warns that normal Firebase Auth flow does not work inside the emulator, so test contexts must model auth deliberately. This is important when comparing emulator proof with a live anonymous-auth phone session.

The official RTDB Rules emulator setup page, https://firebase.google.com/docs/database/security/test-rules-emulator, recommends starting the Database emulator and automating Rules tests before deployment.

Research implication: a future Rules design must be verified as a complete transaction contract, not as isolated Playground reads. The test matrix must include authenticated host and non-host contexts, anonymous UID identity, create/join/start fan-outs, every child validation, cross-room reads/writes, stale/replayed writes, and explicit negative assertions. The current report remains research-only; no source, Rules, Firebase Console, or deployment change has been made in this pass.
