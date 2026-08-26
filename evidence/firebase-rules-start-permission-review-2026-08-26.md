# NEON GUESS — Firebase Rules and Start Permission Review

**Date:** 2026-08-26  
**Scope:** Recommendation and Idea Developing repository with Firebase project `neon-guess-test` only  
**Mode:** REPORT MODE — no source, Rules, Firebase data, or deployment changes were made during this review  
**Status:** SECURITY REVIEW COMPLETE — REMAINING RISKS REQUIRE ATTENTION

## Executive conclusion

The new `PERMISSION_DENIED` is not evidence that security should be removed. It is evidence that the current Rules contract and the client’s multi-location write contract are not fully aligned. The rules are intentionally strict in several places, which is appropriate for room isolation and private targets, but the current 1v1 start/preview synchronization writes fields that do not have explicit child authorization rules. Because the existing room-level `.write` rule is host-only for **new room creation** and does not grant updates to an existing room, an update containing an unruled child can be denied even when the host is authenticated and the other fields are legitimate.

The strongest source-level hypothesis is that the user’s “Start” action reaches `syncEnterPreview()`, which performs a root-level fan-out `update()` to an existing `/rooms/<code>` room. That update writes `revealEndTimestamp`, `transitionStartedAt`, and `transitionEndsAt`, while the current `/rooms/$roomCode` Rules expose no matching child `.write` rules for those fields. The host rules exist for `phase`, `status`, `round`, `roundResult`, `bracket`, `playerAssignments`, `matchResults`, `standings`, and `timerEndTimestamp`, but not for all fields in the fan-out. This is a **SOURCE VERIFIED, high-confidence cause candidate** for a denial at lobby Start/preview. It is not yet a conclusive LIVE FIREBASE root-cause proof because the diagnostic shown so far does not include the exact failing Start stage and deployed Rules revision.

A second, independent class of risk exists in the later `syncBeginPlaying()` path: it updates the room transaction and then writes private `ownTarget` and viewer-facing `displayTarget` records. Those paths are intentionally sensitive and must remain tightly authorized. They must not be opened broadly merely to eliminate an error. The report therefore separates the lobby Start/preview boundary from the later Begin Round/target boundary.

## Evidence classification

| Finding | Evidence level | Meaning |
|---|---|---|
| The active repository is Recommendation and Idea Developing and the approved Firebase project is `neon-guess-test` | SOURCE VERIFIED | Baseline identity was recorded before review |
| The independent phone previously failed during `join-transaction` with `PERMISSION_DENIED` while online | LIVE FIREBASE VERIFIED | This proves a real authorization failure occurred during Join, not a generic offline banner |
| The repository contains a scoped score-child repair for non-host Join | SOURCE VERIFIED | The repair was pushed as `756d334`; it does not prove that the live Rules Console has that exact version |
| The current user reports `PERMISSION_DENIED` when attempting to Start after entering | USER OBSERVED | Exact diagnostic stage for this new failure was not provided |
| `syncEnterPreview()` writes three fields with no matching child Rules in the social room Rules | SOURCE VERIFIED | High-confidence source mismatch candidate |
| The deployed Firebase Rules exactly match the repository file | NOT VERIFIED | Firebase Rules are manually published and are not deployed by GitHub Pages |
| The Start denial is caused specifically by one missing field rather than another update field | NOT VERIFIED | Requires exact emulator probe or live diagnostic with a fresh room and current Rules |
| Four-client authorization and gameplay privacy | BLOCKED / NOT VERIFIED | Distinct four-client evidence is unavailable |

## System trace: what “Start” actually does

The visible Start button is in `src/pages/LobbyPage.jsx`. It first checks the minimum player count, exact 1v1 capacity, and category. It then calls `actions.startGame()` and navigates to `/game` only if that promise resolves. Therefore a rejection before navigation is a Firebase synchronization failure or a host/phase guard failure, not a game-board rendering error.

In `src/context/GameStateContext.jsx`, `startGame()` checks that the authenticated Firebase user is the host, computes the existing engine preview state, dispatches the local `START_GAME` action, and calls `syncEnterPreview(state.roomCode, nextState)` when Firebase is configured. This preserves the existing gameplay transition; the review does not propose changing it.

In `src/firebase/gameSync.js`, `syncEnterPreview()` uses one root-level `update(ref(db), updates)` with these paths:

| Written path | Intended actor | Current Rules evidence |
|---|---|---|
| `rooms/<code>/phase` | Host | Explicit host `.write` exists |
| `rooms/<code>/status` | Host | Explicit host `.write` exists |
| `rooms/<code>/round` | Host | Explicit host `.write` exists |
| `rooms/<code>/roundResult` | Host | Explicit host `.write` exists |
| `rooms/<code>/bracket` | Host | Explicit host `.write` exists |
| `rooms/<code>/playerAssignments` | Host | Explicit host `.write` exists |
| `rooms/<code>/matchResults` | Host | Explicit host `.write` exists |
| `rooms/<code>/standings` | Host | Explicit host `.write` exists |
| `rooms/<code>/revealEndTimestamp` | Host | **No explicit child `.write` rule found** |
| `rooms/<code>/transitionStartedAt` | Host | **No explicit child `.write` rule found** |
| `rooms/<code>/transitionEndsAt` | Host | **No explicit child `.write` rule found** |
| `rooms/<code>/timerEndTimestamp` | Host | Explicit host `.write` exists |

The existing parent rule at `/rooms/$roomCode` allows creation only when the room does not exist and the new record is a valid host lobby. It does not grant a host a blanket update right to an existing room. Firebase Rules are hierarchical and `.write` grants cascade, but a missing child rule does not become host-authorized merely because the caller is the host. The root-level update must satisfy authorization and validation for every affected path.

## Confirmed current Rules behavior

The current social room rules intentionally implement these controls:

| Surface | Current policy | Security purpose | Review result |
|---|---|---|---|
| Root `/` | No global read/write grant | Prevent database-wide exposure | Correct and should remain closed |
| New `/rooms/<code>` | Authenticated host only, valid lobby shape | Prevent arbitrary room creation | Appropriate |
| Existing room read | Authenticated users may read lobby rooms; playing rooms require membership | Permit code-based lobby entry while limiting active state | Product-compatible but broad lobby read; retain only if lobby data contains no secrets |
| Join slot creation | Authenticated user can claim an empty allowed slot for self during lobby | Prevent slot theft and enforce capacity boundary | Appropriate in principle |
| Player creation | Self UID, reserved slot, lobby phase/status, valid fields | Bind player record to Auth identity and slot | Appropriate in principle |
| Score initialization | Self UID, new value `0`, existing player, lobby phase/status | Allow joiner initialization without allowing score tampering | Narrow and appropriate |
| Aggregate scores map | Host-only | Preserve authoritative score control | Appropriate |
| Private `ownTarget` | Not client-readable; host writes for a room player | Protect hidden assignment | Critical and correct |
| Private `displayTarget` | Viewer-scoped read; host writes | Provide intended opponent-facing card without exposing own target | Critical and correct |
| Gameplay phase fields | Mostly host-only child writes | Keep authoritative state under host/provider path | Appropriate but incomplete for all fields actually written |
| Actions/guesses | Player identity, room mode, round/match/assignment checks | Prevent replay, cross-round, and cross-player actions | Requires full live negative testing |

## Root-cause analysis

### Finding F-START-001 — Preview fan-out contains unruled fields

**Severity:** High for availability; security impact depends on the eventual repair  
**Confidence:** High as a source-level mismatch; medium as the exact live cause  
**Location:** `src/firebase/gameSync.js`, `syncEnterPreview()`; `database.rules.json` under `rooms/$roomCode`  
**Classification:** `RELIABILITY_ONLY` / `SECURITY_ENFORCEMENT_ONLY` if repaired by adding narrowly host-scoped rules

The application’s Start operation writes `revealEndTimestamp`, `transitionStartedAt`, and `transitionEndsAt` to an existing social room. The Rules file contains no explicit child `.write` authorization for these fields. The room parent `.write` is restricted to valid new-room creation, so it cannot serve as an update grant. Since the operation is a single fan-out update, any denied affected path can reject the whole operation. This explains why a user can successfully create a room and join it, yet receive `PERMISSION_DENIED` only when pressing Start.

**Expected secure behavior:** the authenticated host may write only the existing preview fields required by the current product flow, in the correct lobby/preview transition, while non-host clients remain unable to alter them.

**Abuse scenario if repaired too broadly:** granting `auth != null` or a blanket room-level host update would let any authenticated participant manipulate phase, transitions, timers, assignments, scores, or result state. That would violate authoritative-state and multiplayer security boundaries.

**Required proof before repair:** run a Rules emulator test or Rules Playground write simulation for the exact fan-out, first with the host UID and then with a non-host UID, and inspect the deployed Rules version. The test must cover the complete update, not isolated fields only.

### Finding F-JOIN-002 — Join and Start may be two different live failures

**Severity:** High for availability  
**Confidence:** High  
**Location:** `roomService.js` and `GameStateContext.jsx`  
**Classification:** `RELIABILITY_ONLY`

The earlier independent-phone diagnostic reported `Stage: join-transaction`. The current report says the user entered and then received an error while trying to Start. These are not automatically the same failure. Join can fail at slot transaction, player transaction, score initialization, or final verification. Start can fail at preview fan-out, later Begin Round room transaction, private-target writes, or navigation recovery. The diagnostic stage is therefore essential; a generic `PERMISSION_DENIED` message is insufficient for a conclusive root cause.

**Required evidence:** record `Stage`, `Code`, `Correlation`, room mode, player count, actor role, and whether the error appeared before or after navigation to `/game`. No repair should be selected from the generic error string alone.

### Finding F-TARGET-003 — Private-target writes are a separate high-risk boundary

**Severity:** Critical if exposed; currently structurally protected in source and Rules  
**Confidence:** High for the protection intent; live verification incomplete  
**Location:** `gameSync.js` and `database.rules.json` private room branches  
**Classification:** `SECURITY_ENFORCEMENT_ONLY`

Later `syncBeginPlaying()` writes `ownTarget` and `displayTarget` through a fan-out update. The current design stores hidden assignment and viewer-facing target separately. The user’s protected contract is that a player sees the opponent-facing target and must not read their own assigned target. Any “fix” that grants general room-membership reads or broad private-room writes would create a privacy vulnerability. The target paths must remain owner/viewer scoped according to the existing product contract, and live multi-client negative tests are still required.

### Finding F-RULES-004 — Manual Rules deployment can diverge from source

**Severity:** High for availability and release confidence  
**Confidence:** High  
**Location:** Firebase Console versus `database.rules.json`  
**Classification:** `RELIABILITY_ONLY`

GitHub Pages deployment publishes the web bundle, not RTDB Rules. The repository can contain the repaired Rules while Firebase still executes an older version, or Firebase can contain a manual edit not represented in Git. This is a direct explanation for “the source appears fixed but the live client still receives Permission Denied.” The Firebase Console’s Rules history/version and project/database URL must be recorded for every live verification.

## Research-backed principles

Firebase’s official documentation states that every RTDB read/write is evaluated on the Firebase servers and is denied unless Rules allow it. It also states that `.read` and `.write` rules cascade, while `.validate` rules do not cascade and must pass for every relevant non-null node. This means a parent-level allow can authorize deeper writes, but a missing parent grant does not imply that a host can update arbitrary children.

Firebase also documents `data` as the pre-write state and `newData` as the merged post-write state. This is central to the room lifecycle rules: creating a fresh node has `data.exists() === false`, while joining or starting an existing room evaluates against existing room state. Conditions that correctly authorize room creation can therefore be invalid for an existing-room update.

Firebase’s web documentation describes `update()` as a multi-location write that can update lower-level child paths simultaneously. For this application, that means the complete preview or target fan-out must be tested as one operation. Testing only `phase` or only `scores/<uid>` is not enough to prove the full request succeeds.

Firebase recommends the Local Emulator Suite for Rules and data-model testing before deployment. The project already contains emulator-oriented regression artifacts, but the current static contract focuses strongly on fresh-room reads, score initialization, isolation, and private target structure; it does not yet prove the complete 1v1 preview fan-out.

Sources: [Firebase RTDB Security Rules](https://firebase.google.com/docs/database/security), [Rules conditions](https://firebase.google.com/docs/database/security/rules-conditions), and [Read and Write Data on the Web](https://firebase.google.com/docs/database/web/read-and-write).

## Adversarial future-failure review

| ID | Future operation | Likely denial or abuse point | Current evidence | Priority |
|---|---|---|---|---|
| F-01 | Lobby Start → preview fan-out | Missing child Rules for transition/reveal fields | Source-level mismatch | Immediate |
| F-02 | Join slot transaction | Transaction requires readable path and valid fresh-node rule | Previously repaired and emulator-tested; live independent join was previously denied before Rules sync | Immediate |
| F-03 | Player record transaction | UID, reserved slot, lobby phase, and validation must all agree | Source/Rules aligned by inspection; live proof incomplete | Immediate |
| F-04 | Score initialization update | Multi-location update must pass score-child and parent/validation semantics | Narrow repair exists; deployed-version proof required | Immediate |
| F-05 | Begin Round room transaction | Existing room update must authorize every changed room field | Partially covered; full operation proof absent | High |
| F-06 | Private target fan-out | Missing or overbroad read/write rule can cause denial or privacy exposure | Structural isolation source-verified; live privacy negative test absent | Critical |
| F-07 | Confirm guess/action | Actor, active match, round, opponent, and idempotency conditions can reject stale actions | Rules exist; adversarial runtime matrix absent | High |
| F-08 | Votes/eliminated cards/messages | Member/self/host checks and validations can reject legitimate events or permit tampering | Rules inspected; complete sequence not live-tested | High |
| F-09 | Refresh/reconnect | Existing-player path must be readable and rejoin without resetting state; presence write must be authorized | Source path exists; independent runtime proof absent | High |
| F-10 | Leave/remove/cleanup | Player self-removal, host removal, score/private cleanup may be a compound write with mixed authorization | Earlier UI Leave attempts observed permission-denied closed-room state | High |
| F-11 | Host migration | HostId/player isHost writes can be denied or become a privilege escalation if broadened | Source and Rules are complex; concurrency proof absent | High |
| F-12 | Cross-room reads and writes | Lobby read policy and room-code guessing may expose non-secret state or permit unauthorized mutation | Room isolation controls exist; enumeration/metadata review incomplete | High |
| F-13 | Concurrent joins | Slot transaction race can reserve slots correctly but subsequent player/score writes may partially diverge | Emulator isolation exists; live multi-client proof incomplete | High |
| F-14 | Rules/source drift | Pages bundle and Firebase Rules can be on different revisions | Manually published Rules required | Immediate |
| F-15 | Root or ancestor reads | A Rules Playground test at `/` returns denied by design; testing the wrong path can cause false diagnosis | Screenshot confirms root read denied | Informational |

## What should not be done

Do not change the root rule to public read/write. Do not grant all authenticated users a blanket write at `/rooms/$roomCode`. Do not remove private target restrictions. Do not move targets into public room state. Do not weaken score validation. Do not make the non-host a host or allow a non-host to write phase, status, timer, assignments, bracket, or results. Do not infer a successful fix from a Rules Playground read at `/`; the root denial is expected.

Do not modify game logic to hide a Rules failure. The correct repair boundary is the authorization contract for the already-existing writes, followed by emulator, negative, build, and independent-client validation.

## Ten-task research and remediation plan — report only

| Task | Research/audit objective | Deliverable | Acceptance evidence |
|---|---|---|---|
| 1 | Capture a fresh incident record for the current Start failure | Redacted diagnostic with exact stage/code/correlation, actor role, room mode, and route | Start failure classified as preview, begin-round, target, or navigation |
| 2 | Verify deployed Firebase identity and Rules revision | Project ID, RTDB URL, Rules publish timestamp/version, and source commit comparison | No source/live Rules drift remains unclassified |
| 3 | Build a complete write matrix from every provider action | Table mapping each `set`, `update`, and transaction path to actor, phase, and Rule | Every legitimate path has an explicit authorization contract |
| 4 | Reproduce the exact Start fan-out in the Rules emulator | Focused emulator test using a host and non-host with the complete update | Host allowed; non-host denied; no partial unsafe state |
| 5 | Audit missing child fields and validation semantics | Candidate minimal Rules change list, especially preview transition fields | No blanket parent grant; all affected fields covered narrowly |
| 6 | Audit Join as an atomic lifecycle | Emulator matrix for slot, player, score, capacity, duplicate, stale, and cross-room cases | Legitimate independent join succeeds; attacker variants fail |
| 7 | Audit Begin Round and private-target fan-out | Multi-location target authorization matrix for owner, viewer, opponent, host, and outsider | Existing target visibility contract preserved; own target remains unreadable |
| 8 | Audit action, vote, message, cleanup, refresh, and host migration writes | Adversarial Rules matrix including replay, stale round, wrong room, wrong actor, and disconnect | No future denial or privilege bypass remains unclassified |
| 9 | Define deployment and rollback gates | Manual Rules publish checklist plus source/Rules hash and rollback procedure | Test-only deployment can be reproduced and verified without touching production |
| 10 | Re-run release QA with independent clients | Live 1v1, 2v2, Four, Refresh, Leave, isolation, capacity, and privacy matrix | Status becomes READY only if all release-critical gates are proven; otherwise CONDITIONAL/BLOCKED |

## Proposed minimal repair direction — not executed

The likely safe direction is to add explicit, host-scoped child authorization for the existing preview transition fields that `syncEnterPreview()` already writes, with conditions matching the existing room host and valid lifecycle. The exact condition must be designed against the emulator and the deployed data shape; this report does not authorize or perform the edit. A second option is to reduce the preview update to fields already covered by the Rules, but that could alter synchronized state behavior and therefore requires a gameplay-contract review; it should not be selected automatically.

Any repair must include a focused negative test proving that a non-host cannot write those fields, a complete fan-out test proving the host operation succeeds, a cross-room test, a stale-phase test, and a protected-target regression. If the exact Start stage is not captured, the plan must first return to Task 1 rather than guessing.

## Release decision

**CONDITIONAL — not READY.**

The current evidence supports a strong source-level explanation for a Start/preview authorization mismatch and identifies several future denial boundaries. It does not prove that the Rules currently published in Firebase equal the repository Rules, does not prove the exact failing Start field in the live environment, and does not provide independent-client proof for all modes and lifecycle paths. No gameplay contract was intentionally changed during this report-only review.

**Next required user evidence:** provide the complete diagnostic generated by the failed Start attempt, especially `Stage`, `Code`, `Correlation`, and whether the action was performed by the host. Then verify the Firebase Console Rules version for `neon-guess-test` before any future repair or publish action.
