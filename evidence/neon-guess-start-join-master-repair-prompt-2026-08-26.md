# Senior Engineering Master Prompt — NEON GUESS Start/Join Authorization and State-Recovery Repair

Copy and use the following prompt as the execution command for the next engineering cycle.

---

## ROLE AND MISSION

Act as a senior full-stack software engineer, React/Vite engineer, Firebase Realtime Database authorization engineer, multiplayer-synchronization engineer, security engineer, QA/release engineer, and autonomous bug-fixing lead. You are responsible for investigating, repairing, verifying, and safely releasing the reported NEON GUESS failure rather than merely describing it.

Use the following operating disciplines throughout the task:

- `autonomous-bug-to-engineering`
- `neon-guess-autonomous-production-debugger`
- `manus-max-code-execution-agent`
- `neon-guess-release-qa-guard`
- `guess-who-application-security`

Treat these as engineering constraints, not as permission to make broad changes. The project-specific source, current repository state, Firebase Rules, tests, and verified runtime evidence are the authority.

Your mission is to restore reliable room joining and game starting while preserving every existing game rule and privacy contract. The final result must be a minimal, evidence-backed repair with regression protection and an honest release status.

Do not stop after producing a plan or report. Investigate first, then implement the smallest justified repair, verify it, inspect the complete diff, deploy only the selected Test project, and report exactly what was and was not proven.

Never promise a 100% result without the corresponding live evidence. Use precise evidence labels such as `OBSERVED`, `SOURCE VERIFIED`, `ENGINE TEST VERIFIED`, `BUILD VERIFIED`, `LIVE BROWSER VERIFIED`, `LIVE FIREBASE VERIFIED`, `FOUR-CLIENT VERIFIED`, `NOT VERIFIED`, and `BLOCKED BY ENVIRONMENT`.

---

## ACTIVE PROJECT AND HARD SCOPE LOCK

Work only on the following project:

- GitHub repository: `hamo236/new-guess-recommendation-and-idea-developing`
- Product identity: Recommendation and Idea Developing
- Branch: `main`, unless the repository workflow requires a temporary branch and the user explicitly approves it
- Live Pages URL: `https://hamo236.github.io/new-guess-recommendation-and-idea-developing/`
- Firebase project: `neon-guess-test` only
- Firebase RTDB URL: `https://neon-guess-test-default-rtdb.firebaseio.com`
- Local working copy, when available: `/home/ubuntu/neon_guess_test_upload_staging`

Do not access, modify, deploy, or publish to any production Firebase project, production Page, unrelated repository, or similarly named Test Play project. Do not use or expose Firebase secrets, service-account keys, private keys, passwords, or tokens.

Before any edit, verify the repository identity using `git remote -v`, `git status`, the current branch, `package.json`, the expected `src/` tree, the current commit, the Pages workflow, and the Firebase project identifiers. If the identity is uncertain, stop in `BASELINE` and do not edit.

Read the nearest `AGENTS.md` and all relevant project instructions before modifying anything. Preserve existing user changes and do not reset or delete unrelated work.

---

## IMMUTABLE GAMEPLAY AND PRIVACY CONSTITUTION

The following systems are protected and must not be changed unless the user explicitly authorizes a precise behavior change with acceptance tests. A repair that changes any item below must be rolled back:

1. The game rules, guessing rules, target assignment, target selection, target visibility, categories, image/content lists, cards, boards, and player-facing prompts.
2. The 1v1, 2v2, and Four modes, including their room semantics, player capacity, team assignment, seat behavior, bracket behavior, match structure, winner logic, rematch behavior, and navigation meaning.
3. Round count, round ordering, phase ordering, timers, reveal timing, five-second reveal behavior, scoring, results, tie handling, transitions, and end-of-match behavior.
4. The privacy contract that a player must not see their own assigned private target and may see only the opponent-facing target required by the existing game design.
5. Authentication meaning, anonymous identity semantics, user/session ownership, and cross-room isolation.
6. Firebase namespaces, room codes, room ownership, Join/Leave semantics, refresh/reconnect behavior, and authoritative state ownership.
7. Existing working UI behavior except for an evidence-backed presentation or error-state repair directly required by the incident.

Allowed changes are limited to authorization-contract alignment, state-confirmation/recovery needed to prevent a false optimistic transition, focused diagnostics, regression tests, documentation/evidence, and strictly necessary presentation-only error handling. Do not use a visual change to hide an authorization or synchronization failure.

---

## COMPLETE INCIDENT HISTORY AND VERIFIED CONTEXT

The project previously experienced these problems:

### Incident A — Fresh-room creation permission failure

A Firebase transaction used to create a new room required a read of the not-yet-existing room node. The original Rules did not permit the transaction to read a fresh room, so creation returned `PERMISSION_DENIED`. A narrow `!data.exists()` allowance was added for new room transactions under the relevant room roots. This was manually published in Firebase Test and single-client room creation was later verified.

Do not remove that protection and do not replace it with public root read/write access.

### Incident B — 1v1 independent Join permission failure

A second independent client attempted to join a 1v1 room and received:

```text
Stage: join-transaction
Status: failed
Code: PERMISSION_DENIED
Message: PERMISSION_DENIED: Permission denied
Correlation: join-mta2el56-ryj6seew
Browser online: true
Network: 4g
Time: 2026-08-26T12:23:21.276Z
```

The failure was traced to the social-room join transaction and a post-join score initialization path. A narrowly scoped Rules repair was prepared and pushed in commit `756d334`, but the subsequent Start failure shows that the full lifecycle contract is still incomplete or that the published Rules/source versions may not match.

Do not assume that a successful Join repair proves Start, Begin Round, or later gameplay writes are authorized.

### Incident C — Rules Playground root read denied

The Firebase Rules Playground showed `Simulated read denied` while testing a `get` at the root path `/`. This is expected when root `.read` is false and is not evidence that the game-room child rules are broken. Never weaken root security to make the Playground root read pass.

Test exact room and child paths with the correct authenticated identity instead.

### Incident D — Start Game screen flashes and disappears

After the user published a Rules file, pressing `Start Game` caused the game/character screen to appear for less than one second and then disappear. The user also observed `PERMISSION_DENIED` during the Start flow.

The investigation produced this source/emulator-supported causal chain:

1. The 1v1 UI dispatches an optimistic local Start/Preview state.
2. The game screen becomes visible before Firebase confirms the authoritative update.
3. `syncEnterPreview` sends a multi-location `update()` for Start Preview.
4. The Start payload includes transition/reveal timestamp fields such as `transitionStartedAt`, `transitionEndsAt`, and `revealEndTimestamp`.
5. The current Rules contract did not explicitly authorize all fields required by that Start fan-out under the same host/room/phase conditions.
6. Firebase rejects the multi-location write with `PERMISSION_DENIED`.
7. The room listener receives or retains the authoritative `lobby` state.
8. React merges the lobby snapshot over the optimistic local Preview state.
9. `GameBoardPage` sees a non-game phase and redirects or stops rendering the board.
10. The user experiences a brief game-screen flash followed by disappearance.

This is a strong `SOURCE VERIFIED` and `ENGINE TEST VERIFIED` diagnosis. It must still be confirmed by a post-repair live browser/Firebase test. If current source or Rules contradict this history, do not force the old conclusion; re-run the full trace and record the discrepancy.

### Incident E — Cleanup permission-denied states

Temporary 2v2 and Four rooms were created successfully through the live UI. Existing Leave attempts produced permission-denied/closed-room states in some cases. No destructive raw database deletion was performed.

Treat cleanup failures as a separate lifecycle track. Do not delete rooms through REST, direct database mutation, or administrator credentials. Use only the existing product Leave path or document the blocked cleanup state.

### Current verification limits

Previous evidence confirmed single-client creation for 1v1, 2v2, and Four. It did not prove full independent-client Join, Start, Refresh/Reconnect, Leave, cross-room isolation, capacity enforcement, or private-target behavior for every mode. Do not label those paths as verified until truly observed with distinct identities/devices or an equivalent Rules Emulator contract.

---

## REQUIRED INVESTIGATION BEFORE EDITING

Follow the Evidence-Gated Repair Protocol. Do not patch from the symptom alone.

### State 0 — Intake

Record the user-visible symptom, expected behavior, trigger, affected mode, route, device/browser, timing, exact diagnostic fields, and whether the error happens before or after the screen flash.

Separate issue tracks:

- Track A: 1v1 independent Join authorization.
- Track B: 1v1 Start Preview authorization and state recovery.
- Track C: 1v1 Begin Round/target/reveal authorization.
- Track D: 2v2 Start/transition authorization.
- Track E: Four Start/transition authorization.
- Track F: Refresh/Reconnect/Leave/cleanup lifecycle.
- Track G: Rules publication drift between repository and Firebase Console.

Do not combine all tracks into one uncontrolled patch.

### State 1 — Baseline

Create a baseline journal containing:

- Repository remote, branch, commit, and clean/dirty status.
- Relevant file hashes before editing.
- Firebase project identifiers without secrets.
- Current published Pages commit and workflow status.
- Current `database.rules.json` hash and relevant Rules version evidence.
- Available npm scripts, emulator configuration, and test commands.
- Existing incident evidence and report paths.

If the local Rules file and the user-published Firebase Rules cannot be compared, label the comparison `NOT VERIFIED` and do not claim they are identical.

### State 2 — Knowledge and system map

Read and use these project artifacts when present:

- `evidence/start-game-disappearing-screen-root-cause-2026-08-26.md`
- `evidence/firebase-rules-start-permission-review-2026-08-26.md`
- `evidence/firebase-rules-expanded-authorization-review-2026-08-26.md`
- `evidence/firebase-rules-security-proposals-2026-08-26.md`
- `evidence/full-readiness-audit-2026-08-26.md`
- `src/firebase/roomService.js`
- `src/firebase/gameSync.js`
- `src/firebase/competitiveFirebase.js`
- `src/context/GameStateContext.jsx`
- `src/context/CompetitiveModeContext.jsx`
- `src/pages/LobbyPage.jsx`
- `src/pages/GameBoardPage.jsx`
- `database.rules.json`
- Existing security, emulator, protected-mode, build, and route tests.

Build a redacted vertical map for every affected mode:

```text
rendered button/state
→ UI handler
→ Provider/context action
→ local reducer/state transition
→ Firebase transaction or update
→ Rules evaluation
→ server snapshot
→ listener callback
→ reducer merge
→ route guard/rendered component
→ error/recovery/cleanup
```

Mark each node and edge as `IMPLEMENTED`, `BROKEN`, `MISSING`, `NOT VERIFIED`, or `BLOCKED`.

### State 3 — Exact Start and Join trace

Trace every operation rather than only the first visible screen. Enumerate exact paths, payload fields, actor identity, preconditions, and postconditions for:

- Create room.
- Join room.
- Join slot reservation.
- Player record creation.
- Score initialization.
- Host Start Preview.
- Begin Playing/Begin Round.
- Reveal/timer transition.
- Score/result writes.
- Presence and disconnect behavior.
- Leave and cleanup.
- Session restoration after refresh.

For each multi-location update, list every destination path. A multi-location update must be authorized consistently across all destinations; one denied child can reject the whole operation.

Record the first divergence exactly:

- UI divergence.
- State divergence.
- Payload divergence.
- Rules denial.
- Listener stale snapshot.
- Route-guard redirect.
- Runtime exception.
- Session/auth identity mismatch.

### State 4 — Rules and data-contract audit

Audit the actual Rules file as a field-level authorization contract. For every operation, answer:

1. Who is allowed: host, joined player, teammate, opponent, or any authenticated participant?
2. Which room, match, round, phase, and identity conditions are required?
3. Is the condition enforced at the parent write boundary and/or exact child boundary?
4. Does the rule use `data`, `newData`, `root`, `auth`, and `now` correctly?
5. Does a transaction require a read permission before it can complete?
6. Does an update touch a child whose own authorization condition denies it?
7. Are immutable fields protected against tampering?
8. Are type, range, timestamp, cardinality, and phase validations present?
9. Does the rule accidentally allow cross-room or cross-player writes?
10. Does the source write a field that Rules never authorize?

Do not solve a denial by opening `.read` or `.write` at the database root, room root, or unrestricted public child.

### State 5 — Emulator reproduction

Use the Local Rules Emulator and the actual repository Rules. Reproduce:

- Host creates a room.
- Independent anonymous/authenticated client joins.
- Joiner initializes only their own score.
- Host performs the exact Start fan-out.
- Non-host attempts the same Start fan-out and is denied.
- A participant from another room attempts to read/write the room and is denied.
- A participant attempts to read another player’s private target and is denied.
- Invalid phase, round, timestamp, score, and identity payloads are denied.
- A refresh/reconnect-like read is allowed only for the correct participant and room.
- Leave is allowed only through the intended lifecycle condition.

The tests must use distinct auth identities and must assert both positive and negative cases. Do not use a fixed random winner/slot assumption; validate the actual occupant set.

### State 6 — React state and route-recovery audit

Prove or disprove the optimistic-transition race:

- Does `START_GAME` or equivalent dispatch before Firebase confirmation?
- Does navigation occur before the authoritative write resolves?
- Does `syncEnterPreview` reject or swallow an error?
- Does the listener deliver an older `lobby` snapshot after local Preview?
- Does the reducer allow an older snapshot to overwrite a newer local intent?
- Does `GameBoardPage` redirect solely from phase?
- Can `SessionRouteRestore` race with page navigation?
- Is the user shown a stable error/retry state, or only a screen flash?

Do not suppress the redirect or force the screen to remain visible unless the authoritative state is valid. The correct repair must preserve the authoritative Firebase state model.

### State 7 — Cross-mode audit

Inspect 2v2 and Four independently. Do not assume their `teamRooms` and `tournamentRooms` contracts match classic `rooms`.

For each mode, enumerate:

- Room root and player/seat paths.
- Host/participant authority.
- Start fields and transition fields.
- Team/bracket/match/round identifiers.
- Private target paths and visibility conditions.
- Score/result paths.
- Listener and recovery behavior.
- Exact Rules clauses.

If no real independent clients are available, use Emulator evidence and label live behavior `NOT VERIFIED`.

### State 8 — Adversarial security review

Attempt to bypass the intended contract without changing production data:

- Write as unauthenticated user.
- Write as authenticated user from another room.
- Write another player’s score.
- Write another player’s private target.
- Change room host or team assignment.
- Skip phase order.
- Change round/match identifiers.
- Set invalid timestamps or scores.
- Replay an old Start/Begin Round payload.
- Use stale session identity after refresh.
- Enumerate room codes.
- Abuse retry/transaction behavior.
- Submit oversized or malformed payloads.

The security repair is unacceptable if it fixes Start by creating a privilege-escalation path.

---

## REQUIRED ROOT-CAUSE DECISION

Before editing, write an internal engineering task with:

- Context.
- User-reported problem.
- Exact reproduction.
- Confirmed observations.
- Competing hypotheses.
- First divergence.
- Root cause and confidence.
- Exact files and Rules paths affected.
- Protected systems.
- Minimal allowlist.
- Regression tests.
- Rollback triggers.
- Live verification requirements.

If the root cause is not proven, remain in TRACE and do not patch. If the current live error differs from the earlier report, create a separate incident track rather than forcing the old diagnosis.

The expected primary hypothesis to prove or reject is:

> The Start fan-out is rejected because one or more transition/reveal child paths written by the application are not authorized for the host under the current Rules contract; the optimistic local React transition then gets overwritten by an authoritative lobby snapshot, causing the brief screen flash and disappearance.

This is a hypothesis until current source, emulator, and live diagnostic evidence agree.

---

## IMPLEMENTATION RULES AFTER ROOT-CAUSE PROOF

Only after the root cause is proven, implement the smallest safe repair.

### Authorization repair

If the Rules mismatch is confirmed:

- Add only exact child-level authorization clauses required by the existing Start payload.
- Restrict writes to the correct authenticated host and correct room.
- Require the correct lobby/preview phase and valid existing room/player state.
- Use `newData` validation for type, allowed range, and required transition fields.
- Protect immutable host, player, category, target, room-code, match, and round identity fields.
- Preserve deny-by-default root Rules.
- Preserve private target isolation.
- Preserve cross-room isolation.
- Add negative tests for non-host, wrong-room, wrong-phase, malformed, replayed, and unauthorized writes.

Do not grant a broad room-root write merely because the application currently uses a multi-location update.

### State-flow repair

If the optimistic transition is confirmed as a release-critical UX/state defect:

- Keep Firebase authoritative.
- Do not fabricate a successful Preview/Playing state locally.
- Prefer awaiting the authoritative Start result before navigating, or preserve the current route with a stable loading/error state until confirmation.
- Surface the diagnostic error without hiding it.
- Prevent an older snapshot from overwriting a newer confirmed state, but do not ignore authoritative server rollback.
- Preserve existing route meaning and gameplay order.
- Do not change round logic, timer values, target assignment, scoring, or reveal behavior.

Any state-flow change must have a focused regression test proving that a rejected Start does not flash into a false game screen and that a confirmed Start still enters the exact existing Preview state.

### Source and Rules consistency

If the repository Rules file is changed, produce a clearly named artifact containing the exact version for manual Firebase Console publication. Do not auto-publish RTDB Rules, do not use destructive database operations, and do not touch production. The user must manually publish Rules in `neon-guess-test`.

---

## REQUIRED TEST AND VERIFICATION MATRIX

Run the strongest available checks in order and save their outputs.

### Focused authorization tests

- Fresh-room transaction read/write contract.
- 1v1 independent Join transaction.
- Joiner own-score initialization.
- Host Start fan-out positive case.
- Non-host Start denial.
- Wrong-room Start denial.
- Wrong-phase Start denial.
- Invalid transition/reveal field denial.
- Private-target read isolation.
- Cross-room read/write isolation.

### Focused state-flow tests

- Start rejected: no false persistent game screen.
- Start rejected: useful diagnostic remains visible.
- Start confirmed: exact existing Preview state appears.
- Older lobby snapshot cannot create an unexplained UI flash after confirmed Start.
- Session restore does not bypass authorization.
- Refresh/reconnect preserves only valid authoritative state.

### Adjacent-mode tests

- 2v2 create, join, capacity, Start, transition, and denial paths.
- Four create, join, capacity, Start, bracket/round transition, and denial paths.
- Team/seat/bracket identity cannot be altered by another participant.
- No private target leakage in any mode.

### Repository and release checks

Run all applicable existing scripts, including but not limited to:

- `npm test`
- `npm run test:team-battle`
- `npm run test:image-paths`
- `npm run test:image-paths:built`
- `npm run test:removed-player`
- `npm run test:pages-routes`
- `node scripts/security-rules-contract.test.mjs`
- Rules Emulator suite.
- Updated multi-client isolation regression.
- `npm run build`
- `git diff --check`

Do not claim a test ran unless usable output was obtained. If a command fails twice for environmental reasons, classify it as `BLOCKED BY ENVIRONMENT` and change the evidence strategy instead of repeating it indefinitely.

### Live verification

After the user manually publishes the Test Rules and Pages deployment succeeds:

1. Open the current live Recommendation and Idea Developing URL with a hard refresh.
2. Create a new 1v1 room.
3. Join from a genuinely independent phone/browser profile with a distinct anonymous identity.
4. Confirm Players (2/2).
5. Start from the correct Host.
6. Confirm the screen does not flash and disappear.
7. Confirm the exact existing Preview/Playing flow.
8. Confirm no own private target is exposed.
9. Test Refresh/Reconnect.
10. Test Leave through the existing UI.
11. Repeat bounded Join/Start checks for 2v2 and Four where independent clients are available.
12. Record `Stage`, `Code`, `Correlation`, browser/network state, timestamp, route, and client role for every failure.

A single browser tab cannot prove multi-client behavior. Do not label a single-client observation as `FOUR-CLIENT VERIFIED`.

---

## DIFF, SECURITY, AND ROLLBACK GATES

Before committing:

- Review the complete diff, not only the intended hunks.
- Confirm only allowlisted files changed.
- Confirm no gameplay constants, target arrays, category content, round logic, scoring, timers, navigation meaning, or protected Firebase roots changed.
- Confirm no credentials or service-account material entered the repository.
- Confirm Rules remain deny-by-default at the root.
- Confirm the new Rules clauses are narrower than the old broad alternatives.
- Confirm every changed source field exists end-to-end from producer to listener/render.
- Confirm the original failing test would fail before the fix when practical.
- Confirm focused positive and negative authorization tests pass.
- Confirm adjacent modes do not regress.

Rollback immediately if:

- A protected gameplay invariant changes.
- A test is weakened rather than fixed.
- A broad public read/write is introduced.
- The patch cannot explain the original symptom.
- The build or route packaging fails.
- 2v2/Four behavior regresses.
- Private target isolation weakens.
- The active repository or Firebase project is uncertain.
- The patch relies on an unverified live assumption.

Commit only a coherent, scoped change. Push only to the selected Recommendation and Idea Developing repository. Let the existing Pages workflow deploy the source change. Never claim Firebase Rules were deployed automatically; they require the user’s manual Publish action in `neon-guess-test`.

---

## REQUIRED FINAL REPORT

Report in clear Arabic/Egyptian Arabic and use this exact structure:

### إيه المشكلة؟
State the observed symptom and confirmed root cause in simple language.

### إيه اللي اتصلح؟
Describe the actual source/Rules repair, or state that no repair was justified.

### إيه الملفات أو القواعد اللي اتغيرت؟
List only the actual changed files and exact Rules paths. State whether Firebase Console publication remains a user step.

### الدليل
Use a table with separate labels for source, emulator, build, browser, Firebase, and independent-client evidence.

### الاختبارات
List only tests that actually ran and their outcomes.

### الأمان
Explain how Join/Start was fixed without opening root access, exposing private targets, permitting cross-room writes, or changing gameplay authority.

### حالة الإصدار
Use exactly one: `READY`, `CONDITIONAL`, `BLOCKED`, or `NOT READY`.

### المطلوب من المستخدم
Give only the necessary manual steps, such as publishing Test Rules, opening a fresh room, or joining from an independent device.

### ما لم يُثبت بعد
State every remaining gap honestly. Do not use “fixed” when only source tests passed and live multi-client evidence is missing.

Always include the next 10 concrete verification or release steps at the end, but do not pretend they are complete until they are actually performed.

---

## FINAL EXECUTION COMMAND

Now execute this workflow as a disciplined senior engineer:

1. Establish identity and baseline.
2. Load the previous reports and protected constitution.
3. Trace Join and Start from UI to Firebase Rules to listener and route recovery.
4. Reproduce the authorization contract in the Rules Emulator.
5. Prove or reject the Start fan-out mismatch and optimistic-state race.
6. Audit 2v2 and Four independently.
7. Write the internal English engineering task and scoped change plan.
8. Implement only the smallest evidence-backed repair.
9. Add focused positive, negative, stale-state, privacy, and cross-room regressions.
10. Run focused, adjacent, build, route, security, and release checks.
11. Inspect the full diff and verify the protected gameplay constitution.
12. Push only the selected Test repository and wait for Pages deployment.
13. Provide the exact Test Rules artifact for the user’s manual Firebase Publish step when needed.
14. Conduct live independent-client verification where available.
15. Produce the final Arabic report with honest evidence labels and a precise release decision.

If any required evidence is missing, mark the gate `NOT VERIFIED` or `BLOCKED BY ENVIRONMENT`; do not replace missing proof with confidence, assumptions, or a broad permission change.

---

**End of execution prompt.**

Author: Manus AI
Date: 2026-08-26
Project scope: Recommendation and Idea Developing + `neon-guess-test` only
Operational status at prompt creation: Start live fix not yet verified; release remains `CONDITIONAL/BLOCKED` until the required repair and independent-client checks pass.

---

## Internal source references used to construct this prompt

- `evidence/start-game-disappearing-screen-root-cause-2026-08-26.md`
- `evidence/firebase-rules-start-permission-review-2026-08-26.md`
- `evidence/firebase-rules-expanded-authorization-review-2026-08-26.md`
- `evidence/firebase-rules-security-proposals-2026-08-26.md`
- `evidence/full-readiness-audit-2026-08-26.md`
- `src/firebase/roomService.js`
- `src/firebase/gameSync.js`
- `src/firebase/competitiveFirebase.js`
- `src/context/GameStateContext.jsx`
- `src/context/CompetitiveModeContext.jsx`
- `src/pages/LobbyPage.jsx`
- `src/pages/GameBoardPage.jsx`
- `src/components/SessionRouteRestore.jsx`
- `database.rules.json`
- `scripts/security-rules-contract.test.mjs`
- `scripts/security-rules-emulator.test.mjs`
- `scripts/multi-client-isolation-emulator.test.mjs`

The prompt intentionally does not contain Firebase secret values, service-account credentials, private keys, or destructive database instructions.

---

## References

[1]: https://firebase.google.com/docs/database/security "Firebase Realtime Database Security Rules"
[2]: https://firebase.google.com/docs/database/security/rules-conditions "Firebase Realtime Database Rules Conditions"
[3]: https://firebase.google.com/docs/database/web/read-and-write#save_data_as_transactions "Firebase Realtime Database Transactions"
[4]: https://firebase.google.com/docs/emulator-suite/connect_rtdb "Firebase Local Emulator Suite Realtime Database"

---

## Ten immediate next actions for the execution run

1. Confirm the active repository, branch, commit, worktree, and Firebase Test identity.
2. Read the gameplay constitution and all incident reports before editing.
3. Reproduce the exact 1v1 Start fan-out in the Rules Emulator.
4. Capture each denied child path and the corresponding source writer.
5. Verify whether the published Console Rules match `database.rules.json`.
6. Add focused positive and negative authorization assertions.
7. Patch only the missing Start authorization and confirmed state-confirmation defect.
8. Run protected-mode, privacy, isolation, build, and route regressions.
9. Push only the Recommendation and Idea Developing Test repository and wait for Pages deployment.
10. Perform independent-client live Join/Start/Refresh/Leave checks and assign the evidence-based release status.

---

## STOP CONDITIONS

Stop and request user input instead of proceeding if any of the following occurs:

- The active project identity is ambiguous.
- A production resource might be touched.
- Firebase Console login or manual Rule publication is required.
- A destructive database operation appears necessary.
- The proposed fix would alter protected gameplay or target privacy.
- The source and published Rules cannot be reconciled safely.
- Independent-client evidence is required but unavailable; mark that gate blocked rather than inventing proof.

The goal is not to make Firebase permissive. The goal is to make every legitimate operation explicitly authorized, every illegitimate operation denied, and every UI transition consistent with authoritative state.

---

End.
