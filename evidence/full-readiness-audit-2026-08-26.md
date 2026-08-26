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
