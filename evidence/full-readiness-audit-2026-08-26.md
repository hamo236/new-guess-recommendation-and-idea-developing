# NEON GUESS Recommendation and Idea Developing — Full Readiness Audit

Date: 2026-08-26
Active repository: `hamo236/new-guess-recommendation-and-idea-developing`
Local checkout: `/home/ubuntu/neon_guess_test_upload_staging`
Branch/commit at intake: `main` / `eaf129a37492313bc166436c17a3c063a221f47b`
Firebase environment: Test only, expected project `neon-guess-test`
Production/Page: explicitly denylisted; no production changes authorized.

## User outcome
Perform a deep security, reliability, software-readiness, and presentation/motion audit, then implement only evidence-supported deployment-readiness, security, reliability, scalability, accessibility, and presentation-only fixes. Push approved changes to the active Recommendation and Idea Developing repository and Pages deployment.

## Protected functionality
The existing gameplay contract is immutable during this cycle: target assignment and privacy, character/category content, 1v1, 2v2, Four/Tournament rules, team composition, rounds, timers and reveal timing, voting, scoring, winner determination, rematch behavior, room capacity/join semantics, navigation meaning, Firebase schema/authority, authentication, and synchronization semantics.

## Authorized implementation boundary
Security enforcement, reliability, scalability, diagnostics, tests, deployment configuration/headers only when verified, and presentation-only CSS/markup/motion changes that preserve callbacks, state ownership, routes, effects, data access, and disabled/loading behavior. No gameplay, Firebase schema, target logic, or new dependency changes without a separate scope gate.

## Initial evidence
- Live Rules publication was reported by the owner and Rules Playground later returned simulated read allowed for a fresh authenticated room path.
- Live browser verification confirmed 1v1 Create Room succeeds after the Rules repair.
- Current checkout contains one local incident-evidence modification that is not yet committed; no temporary probe remains.
- Current source/build/runtime, multi-client, deep-link, accessibility, and visual findings remain to be audited and labeled separately.

## Success and stop gates
A change may proceed only when the first failing layer is evidenced, the allowlisted files are recorded, protected contracts are checked, focused and adjacent tests pass, the build passes, and the diff contains no unauthorized functional drift. Any target/privacy/gameplay/Firebase-authority change is a stop and scope-expansion event.

## Roles
Investigator: establish facts and first divergence.
Implementer: make the smallest allowlisted patch.
Adversarial Reviewer: search for bypasses and hidden regressions.
Release Judge: assign an evidence-based release status.

## External research evidence

1. Firebase states that Realtime Database Rules are enforced on the server for every read and write, default access is denied, and `.read`, `.write`, `.validate`, and `.indexOn` have distinct roles. It also states that shallow read/write rules cascade and a shallower allow can override a deeper deny, while validation rules do not cascade. Source: https://firebase.google.com/docs/database/security (accessed 2026-08-26).
2. Firebase's rules-conditions guidance documents `auth` as null before authentication and populated after sign-in, distinguishes existing `data` from proposed `newData`, and recommends validation for structure/type constraints. Source: https://firebase.google.com/docs/database/security/rules-conditions (accessed 2026-08-26).
3. Firebase's web read/write guidance documents that a transaction operates through a database reference and that a non-existent snapshot reports `exists() === false`; it recommends attaching listeners at the lowest needed level and using the Local Emulator Suite for rules testing. Source: https://firebase.google.com/docs/database/web/read-and-write#save_data_as_transactions (accessed 2026-08-26).

These sources are research evidence only. They do not replace repository, emulator, browser, or live Firebase verification.

## Live visual/runtime observation 1

- LIVE RUNTIME OBSERVED: the public home URL loads with title `Neon Guess` and the application root renders the navigation shell, Lobby, Game, Results, Tournament, Team Battle, Admin Gateway, and primary actions for Team Battle, 1v1, Today's Drop, and How to Play.
- NOT VERIFIED: screenshot upload failed for this visit, so no visual pixel-level conclusion is drawn from the home page.
- SECURITY/BOUNDARY: no interaction or source change was made during this observation.

## Live visual/runtime observation 2

The live home page loaded successfully at the active Pages URL. Text extraction shows the expected top navigation and mode cards for 2v2 Team Battle and 1v1 Guess Who, plus Daily Drop and How to Play. The rendered screenshot shows a dark neon visual system, large mode cards, and clearly visible primary action buttons. This is a presentation observation only; no gameplay behavior was changed or inferred. The first browser view had reset to about:blank, but a fresh navigation restored the page, so the transient view reset is recorded as NOT VERIFIED rather than treated as a product defect.

## Baseline verification

TEST VERIFIED: `npm test` passed the existing smoke contracts for invite, timeline, rematch, host guards, gameplay async guards, recovery projection, competitive guards, daily drop, and dead-link contracts. TEST VERIFIED: source image-path regression passed for 136 shared Vite-base paths. TEST VERIFIED: built image-path regression passed. TEST VERIFIED: removed-player regression passed with the expected 68 football players and protected adjacent entries intact. BUILD VERIFIED: `npm run build` passed and generated the Pages 404 fallback.

BUILD WARNING / NOT A FAILURE: Vite reports Firebase database modules imported both dynamically and statically, so the dynamic import will not create a separate chunk. Vite also reports a 666.11 kB minified main chunk above the 500 kB advisory threshold. These are release-readiness findings to assess separately; no patch is authorized yet because changing imports or chunking can affect Firebase initialization and route behavior.

WORKTREE NOTE: the active checkout has only audit/incident evidence changes plus the persisted system-map inventory; no application source change was made in this audit phase.

## Live visual/runtime observations 3-4

- LIVE 1v1 route loads successfully. The room form presents player name, category, room code, Create Room, Join Room, and a disabled Start Game action in a coherent dark-neon card. No functional inference was made from the visual inspection.
- LIVE 2v2 route loads successfully. The entry card presents name, category, room code, and Create/Join actions. The rendered desktop screenshot shows the two action buttons visually compressed against the right side of the card, with labels appearing narrow/wrapped under the browser annotation overlay; this is a presentation-only candidate requiring responsive inspection before any change. No gameplay or Firebase behavior was changed.
- Both observations are presentation evidence only; no protected gameplay contract was inferred or modified.

## Live visual/runtime observations 5-6

The live Four-player route loads and presents the expected title, category selector, room code field, and Create/Join actions. Its entry layout is visually cleaner than the 2v2 screenshot at the same viewport width, but the shared action row still needs responsive validation at narrow widths.

The live How to Play route loads with a clear dark-neon guide, category cards, mode sections, and an Arabic toggle. The first viewport is readable and the primary controls are visible. The page is taller than the viewport and reports additional content below; this is expected for a guide page, but narrow-screen scrolling and language-toggle layout remain visual QA items. No functional behavior was changed.

## Finding SEC-001 — tracked stale production/session QA artifact

Severity: HIGH (public-repository hygiene and session-data exposure); confidence: HIGH.

Evidence: tracked file `qa-client-state.json` contains the historical production Realtime Database host marker `guess-who-multiplayer-fc5c4-default-rtdb.firebaseio.com`, two captured room/player session identifiers, player names, room code `RKWJ`, timestamps, and localhost QA output. The artifact is not part of the Vite build path, but the active repository is public, so it unnecessarily exposes historical production topology and session identifiers.

Root cause: a browser QA capture was committed as a repository artifact instead of being retained privately or sanitized. Impact: public disclosure of an old Firebase host and stale room/player identifiers; it does not prove current bundle usage, and no private service-account credential was found in this artifact. Classification: SECURITY_ENFORCEMENT_ONLY / release hygiene. Planned control: remove the tracked artifact, add an ignore rule for future client-state captures, and re-scan the repository/bundle for the old production marker. Do not alter gameplay or Firebase runtime behavior.

## Finding REL-001 — GitHub Pages direct refresh returns HTTP 404 for BrowserRouter routes

Severity: MEDIUM release-readiness; confidence: HIGH.

Evidence from live deployment at `https://hamo236.github.io/new-guess-recommendation-and-idea-developing`: `/` returned HTTP 200, while `/one-v-one`, `/team-battle`, `/tournament`, `/how-to-play`, `/game`, and `/results` returned HTTP 404 with the application title in the fallback response. In-app navigation can still mount the SPA, but direct open or browser refresh at those paths is not reliable.

Root cause: the workflow copies only `dist/index.html` to `dist/404.html`. GitHub Pages does not materialize route-specific `index.html` files for BrowserRouter paths, so direct path resolution remains a Pages 404 before React can mount. `SessionRouteRestore` correctly handles Firebase phase restoration after the app mounts; it cannot run when Pages never serves the document.

Safe repair boundary: update only the static Pages packaging helper/workflow output to create route-specific fallback documents (or equivalent Pages-safe rewrite) for existing app routes. Do not change React routes, navigation semantics, session recovery, or gameplay state.

## Confirmed security baseline

The current Rules file uses authenticated access and default-deny behavior. Fresh-room transaction reads are explicitly allowed only when the node does not exist; existing-room reads are restricted to members or lobby visibility. Private target branches require the matching authenticated player for reads. The live Test Rules were manually published and the live 1v1 Create Room was verified successful before this audit.

## Approved implementation scope for this cycle

1. Remove tracked browser QA captures containing historical room/player/session identifiers and a stale database host marker; add narrow ignore rules for future `qa-*-state.json` and `qa-*-state.txt` captures.
2. Generate route-specific `index.html` documents for every existing BrowserRouter route during Pages packaging, while retaining `404.html`. This changes only static-host resolution and does not change React routing, navigation, Firebase, gameplay, targets, scoring, timers, or room state.
3. Add a deterministic `test:pages-routes` contract that fails if a direct route document is missing after build.

Protected and unchanged: gameplay engines, target selection/private projections, scoring, round/match progression, room payloads, Firebase Rules, auth, and competitive synchronization.

## Post-deployment live verification — 2026-08-26

- Pages workflow run `32930724695` completed successfully for commit `dcacf1d`.
- Direct HTTP checks for `/`, `/one-v-one`, `/game`, `/results`, `/admin`, `/tournament`, `/team-battle`, `/daily`, and `/how-to-play` returned HTTP 200 after the route-packaging repair.
- Live home page loaded with the expected NEON GUESS shell and existing mode cards. No gameplay state was changed during visual inspection.
- Live `/one-v-one/` direct navigation loaded the existing room-entry surface, including Create Room, Join Room, host-name input, and the existing Four Impostor social-room panel. This confirms static route resolution and preserves the current UI structure.
- The first broad Firebase marker scan was a false positive because it matched the intentional Test database URL and a placeholder URL; the exact old production marker was absent, the Test marker was present only in the intended fallback config, no private credential patterns were found, `git diff --check` passed, and protected `src/game`, `src/firebase`, `src/context`, and `database.rules.json` paths were not modified in this release pass.

## Live 1v1 interaction check — 2026-08-26

The deployed `/one-v-one/` surface loaded directly and displayed `Firebase Connected — Real-time Multiplayer Active`. The temporary host name was accepted. The Create Room control correctly blocked the attempt with `Please select a category first`, which is an existing validation guard; no room was created and no gameplay state was altered. This confirms the live form is reachable and the precondition guard is functioning. A category selection is required before the next authorized smoke attempt.

The live DOM inspection of `/one-v-one/` found no `<select>` or category input. The visible room panel currently exposes the existing `Four IMPOSTOR Social room strategy` mode control and Create Room action, while Create Room correctly reports `Please select a category first`. This is recorded as a live UI-state observation only; no mode or gameplay behavior was changed during the audit.
## Live 1v1 validation checkpoint — successful
- After selecting the existing Cartoon Characters category, the deployed Create Room action succeeded.
- The live waiting room displayed `Room Created!`, invite code `188`, host `QA Host 826 (You)`, and `Players (1/2)`.
- The Start Game control remained correctly disabled because the existing 1v1 contract requires exactly two players.
- This validates the post-Rules live transaction path and waiting-room projection; gameplay, target assignment, scoring, and timing were not changed.
## Live 2v2 validation checkpoint
The deployed `/team-battle/` route loaded directly and exposed the expected player-name input, existing category selector, room-code input, Create Room, and Join Room controls. At the captured viewport, the right-side action controls appear visually compressed/narrow inside the entry panel; this remains a presentation-only finding and is not being changed during the live behavior test. The next behavior step is to enter a temporary player name and create one room using the existing selected category.
## Live 2v2 validation checkpoint — successful
The deployed Team Battle route created room `728` successfully after the existing category was left unchanged. The waiting room showed `1/4`, the host `QA Team Host 826`, the invite code, a disabled Start Match control because three more players are required, and `Realtime connected` after a transient reconnect banner settled. The room and competitive state were not modified beyond this authorized create smoke test. The captured viewport also confirms a presentation-only issue: the compact room-entry action rail is visually narrow/compressed on the live page; it does not block room creation but remains a candidate for a separate CSS-only repair.

### 2v2 cleanup result
The existing Leave control was used after the room-creation smoke test. The UI transitioned to `closed` and displayed `PERMISSION_DENIED: Permission denied`, `Retry connection`, and “This Team Battle room has ended or was closed.” Cleanup was therefore attempted through the product path, but a clean backend leave/deletion confirmation was not obtained. No raw database deletion was performed. This is recorded as a recovery/cleanup observation requiring independent-client follow-up, not as a new source defect without trace evidence.

## Live Four-player validation checkpoint — successful
The deployed `/tournament/` route created room `106` successfully using the existing `Types of Sports` category. The waiting room displayed `1/4`, host `QA Four Host 826`, the invite code, a disabled Start Match control because three more players are required, and a recovered/connected realtime status. No match was started and no gameplay, target, scoring, round, or bracket state was changed.

### Four-player cleanup result
The existing Leave control was used after the Four-player room-creation smoke test. The UI transitioned to `closed` and showed `PERMISSION_DENIED: Permission denied`, `Retry connection`, and the message that the room had ended or was closed. Cleanup was attempted through the product path, but a clean backend leave/deletion confirmation was not obtained. No raw database deletion was performed.

## Live 1v1 recovery observation — stale local session
On direct navigation to `/one-v-one/`, the deployed page reported `RECOVERY AVAILABLE`, retained room `188`, and displayed `transaction failed: Data returned contains undefined in property 'rooms.188.players.zC8mhxiOqhOkkYUdYBnGWOC4UNC2.joinOrder'`. The page offered `RECONNECT OR RESET`, `TRY AGAIN`, and `START NEW ROOM`. This is runtime evidence of a stale local/session payload from the earlier smoke room; it is not yet classified as a source defect or live Rules defect. No gameplay was started and no target data was exposed in this observation.

### 1v1 recovery reset result
The existing `START NEW ROOM` recovery control was used. The stale room `188` and its undefined `joinOrder` transaction message disappeared from the rendered recovery panel, and the live page returned to the normal room-entry surface with `Firebase Connected — Real-time Multiplayer Active`. This confirms the local reset path is observable and non-destructive; it does not prove cross-client recovery or backend cleanup.

### Fresh 1v1 host attempt — existing category guard
After resetting the stale session and opening the dedicated 1v1 route, entering `QA Independent Host 826` and pressing Create Room produced the existing `Please select a category first` guard. The visible selector displayed `Cartoon Characters`, but the control had not been explicitly changed in this fresh form state. No room was created and no gameplay state changed. The next bounded step is to explicitly select the existing first category, then retry once.

### Fresh 1v1 host room — live creation verified
After explicitly toggling the existing category selector and restoring `Cartoon Characters`, Create Room succeeded on the deployed Test site. The waiting room displayed invite code `247`, host `QA Independent Host 826 (You)`, `Players (1/2)`, and Start Game remained disabled with `1v1 requires exactly 2 players (1/2)`. This is `LIVE BROWSER` and `LIVE FIREBASE` single-client host evidence only. Independent join, refresh/reconnect after a join, target privacy, and full gameplay remain unverified in this pass.


## Incident: independent 1v1 Join Permission Denied — 2026-08-26

### Live failure evidence
The host-created room `247` was opened from an independent phone. The phone reported `Stage: join-transaction`, `Status: failed`, `Code: PERMISSION_DENIED`, correlation `join-mta2el56-ryj6seew`, elapsed `1842ms`; browser connectivity was reported as Online/4G. This is **LIVE BROWSER / LIVE FIREBASE — FAIL** for independent 1v1 join.

### Root-cause trace
`src/firebase/roomService.js` uses the existing sequence: reserve a `joinSlots/<slot>` transaction, create `players/<uid>` transactionally, then initialize `rooms/<code>/scores/<uid>` to numeric zero. The prior social `scores` parent `.write` expression attempted to authorize a non-host only when `auth.uid === newData.child(auth.uid).val()` and that same child value equaled `0`. A UID string cannot equal numeric zero, so the non-host score initialization branch was unsatisfiable. The live stage is consistent with this source/rules contradiction. The exact failing child operation is **SOURCE VERIFIED** and **EMULATOR VERIFIED**; post-deployment child-path confirmation remains pending.

### Repair implemented locally
- `database.rules.json`: retained host-only aggregate score-map replacement and added a child `$uid` rule allowing only the authenticated UID to create its own zero score after its player record exists while the room is in lobby; removed the contradictory non-host aggregate branch.
- `scripts/multi-client-isolation-emulator.test.mjs`: added the application’s real post-join score write and verifies every actual non-host occupant gets a zero score while capacity and cross-room isolation hold.
- `scripts/security-rules-contract.test.mjs`: added static assertions for host-only aggregate writes and own-UID/zero-score/player-exists child authorization.
- `src/firebase/roomService.js`: intentionally unchanged. No gameplay source, target logic, rounds, timers, scoring formulas, room capacity, join semantics, navigation, or UI flow changed.

### Verification
- **TEST VERIFIED:** single-room boundary probe passed for slot transaction, player transaction, and child score write.
- **TEST VERIFIED:** 20-client emulator isolation/capacity regression passed; both rooms remained capped at four and actual joiners received zero scores.
- **TEST VERIFIED:** existing Rules emulator suite passed, including private-target isolation, protected authority writes, lifecycle scope, and outsider denial.
- **TEST VERIFIED / BUILD VERIFIED:** existing smoke, Team Battle, image paths, built image paths, removed-player, Pages routes, static Rules contract, and production build all passed.
- **SOURCE VERIFIED:** only `database.rules.json` and focused regression tests changed in the repair; protected gameplay implementation was not edited.

### Required external gate
The corrected `database.rules.json` still requires manual publication by the user in the `neon-guess-test` Firebase Console. This workflow does not publish RTDB Rules automatically. Until publication and a fresh independent-device retry succeed, independent live joining remains **NOT VERIFIED**, and release status remains **NOT READY** for multiplayer readiness.


## Incident: 1v1 Start Game Preview flashes then returns to Lobby — 2026-08-26

### Live failure evidence
The reported behavior was a brief Preview/character surface immediately after pressing Start Game, followed by disappearance and return to the Lobby. A live four-client reproduction was not available; the application source and a local RTDB emulator reproduced the causal rollback chain. Independent live post-repair Start verification remains pending.

### Root-cause trace
**SOURCE VERIFIED:** `LobbyPage.handleStartGame` invokes the Provider `startGame` action and then navigates to `/game`. `GameStateContext.startGame` previously dispatched local `START_GAME` before awaiting `syncEnterPreview`. `syncEnterPreview` performs one root `update(ref(db), updates)` covering `phase`, `status`, `round`, `roundResult`, `bracket`, `playerAssignments`, `matchResults`, `standings`, `revealEndTimestamp`, `transitionStartedAt`, `transitionEndsAt`, and `timerEndTimestamp`.

**EMULATOR VERIFIED:** the exact fan-out was denied before the repair because the classic room Rules had host authorization for several sibling fields but no child `.write` grant for `revealEndTimestamp`, `transitionStartedAt`, or `transitionEndsAt`. The failed Firebase write left authoritative room state in `lobby`; the room listener then dispatched `FB_ROOM_SYNC`, and the existing `/game` guards correctly redirected a lobby-phase client back to the 1v1 entry route. The flash was therefore an optimistic local Preview followed by authoritative rollback, not a missing Preview component.

### Repair implemented
- `database.rules.json`: added host-only child `.write` rules for `revealEndTimestamp`, `transitionStartedAt`, and `transitionEndsAt`, each with numeric nonnegative validation. Existing host authorization for the other Start fan-out fields and the prior join-score repair remain intact.
- `src/context/GameStateContext.jsx`: `startGame` now awaits the existing `syncEnterPreview` write before dispatching local `START_GAME`. A rejected Firebase write therefore cannot show a false local Preview that is immediately rolled back. The existing engine transition, payload, route meaning, targets, rounds, reveal timing, scoring, timers, teams, brackets, capacity, and join semantics were not changed.
- `scripts/security-rules-emulator.test.mjs`: added the exact Start fan-out regression. Host success, player denial, outsider denial, negative timestamp denial, cross-room denial, and private-target assertions are covered.
- `scripts/security-rules-contract.test.mjs`: added structural authorization/type assertions for the Start timestamp children.
- `scripts/start-flow-contract.test.mjs` and `package.json`: added a source contract proving Firebase confirmation precedes local `START_GAME` dispatch.

### Verification after final repair
- **TEST VERIFIED:** `npm run test:start-flow` passed.
- **TEST VERIFIED:** `node scripts/security-rules-contract.test.mjs` passed.
- **EMULATOR VERIFIED:** `npx --yes firebase-tools emulators:exec --only database --project neon-guess-test "node scripts/security-rules-emulator.test.mjs && node scripts/multi-client-isolation-emulator.test.mjs"` passed. The suite covered exact Start fan-out authorization, private target isolation, protected authority writes, lifecycle scope, outsider denial, 20 concurrent clients, capacity capping, lobby discovery, and score initialization.
- **TEST VERIFIED:** `npm test`, `npm run test:team-battle`, `npm run test:image-paths`, `npm run test:removed-player`, `npm run test:pages-routes`, and `npm run test:image-paths:built` passed.
- **BUILD VERIFIED:** `npm run build` passed and generated the Pages route documents. Existing non-blocking Vite warnings remain: Firebase dynamic/static import overlap and a 666.20 kB minified main chunk.
- **DIFF VERIFIED:** `git diff --check` passed after the final source/test edits.

### Protected-contract audit
**NO CONSTITUTION CHANGE.** No target assignment or visibility, character/category content, 1v1/2v2/Four rules, rounds, five-second reveal, scoring, timers, voting, winner logic, rematch behavior, teams/brackets, room capacity, join semantics, navigation meaning, or private-target paths were changed. `beginRound` and its transaction/private-target fan-out were intentionally left unchanged because this incident was isolated to Start Preview authorization and optimistic ordering.

### Remaining release gates
The corrected `database.rules.json` is a reviewed artifact and still requires manual publication by the user in the `neon-guess-test` Firebase Console. No Rules publication or production/Page Firebase operation was performed by this workflow. After publication, a fresh 1v1 room must be created and joined from an independent device/profile, then Start Game must be exercised from the host. Refresh/reconnect/Leave, target privacy, and full independent-client 2v2/Four gameplay remain **NOT VERIFIED**. Release decision for the live multiplayer change remains **CONDITIONAL/BLOCKED pending the manual Rules publish and independent-client validation**.

## Final engineering memory

The reusable regression rule is: whenever a Firebase action uses a root multi-location update, every leaf in the payload must have an explicit compatible authorization/validation contract, and local UI state must not advance optimistically ahead of an authoritative write when a rejected write would trigger listener rollback and navigation. Preserve the separation between source, emulator, build, live browser, live Firebase, and four-client evidence in future reports.
