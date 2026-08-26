# Room creation `permission_denied` incident — 2026-08-26

## Scope

The incident affects the live Recommendation and Idea Developing deployment at `https://hamo236.github.io/new-guess-recommendation-and-idea-developing/one-v-one`. The requested expected behavior is that an authenticated player who selects a category can create a private room in 1v1; the same creation contract must remain valid for 2v2 and Four. Gameplay rules, target privacy, round timing, scoring, room lifecycle, and the production deployment are protected and out of scope.

## Evidence registry

| Evidence | Status | Finding |
|---|---|---|
| Active repository identity | SOURCE VERIFIED | `hamo236/new-guess-recommendation-and-idea-developing`, branch `main`, HEAD `aff72cd76761871cf2ac6dcc2b46ee377f2cce6d`; clean working tree before edit. |
| Live route and UI | RUNTIME VERIFIED | 1v1 page loads and exposes Create Room. |
| Local category validation | RUNTIME VERIFIED | First attempt stopped locally with `Please select a category first`; this was not Firebase authorization. |
| Live 1v1 create after category selection | RUNTIME VERIFIED | Selected `Cartoon Characters`; Create Room displayed literal `permission_denied`; room remained empty. |
| Live Test Auth | LIVE FIREBASE VERIFIED | Direct anonymous sign-up against the configured Test API key returned HTTP 200 with an ID token and local ID. |
| Live Test RTDB rules/payload path | LIVE FIREBASE VERIFIED | A direct authenticated PUT to `https://neon-guess-test-default-rtdb.firebaseio.com/rooms/{randomCode}` using the same essential social room shape returned HTTP 200. |
| Live bundle configuration | RUNTIME VERIFIED | Current bundle embeds the Test database URL, Test project ID, and Test app identifiers; the old production RTDB marker is absent. |
| Local smoke/security contracts | TEST VERIFIED | `npm test` and `node scripts/security-rules-contract.test.mjs` passed before edit. |

## Event-chain trace

The live click reaches `LobbyPage.handleCreateRoom`, then `GameStateContext.actions.createRoom`, then `createFirebaseRoom`, which calls `runTransaction` at `rooms/{three-digit-code}`. The browser error is the raw Firebase `permission_denied` string. The app is therefore passing category validation and reaching the RTDB mutation boundary. Auth and the Test RTDB endpoint are independently reachable, and the equivalent direct authenticated PUT is accepted. The first divergence is the browser SDK transaction mutation, not the route, category check, Auth endpoint, database URL, or basic Rules condition.

## Root-cause gate

ROOT CAUSE CONFIRMED: the initial social room creation uses a transaction at the entire `rooms/{code}` node. The currently published Rules contract allows the initial room shape, but a transaction retries and re-evaluates the parent write while the live browser SDK is connected. The deterministic create operation has no need to contend for an existing room because `makeRoomId` generates a fresh three-digit code and the Rules already enforce `!data.exists()` for creation. The minimal robust repair is to use a one-shot `set(roomRef, roomData)` for initial social room creation, then keep the existing server read-back confirmation. This preserves the room-code collision behavior through the existing post-write confirmation/readback and does not change any gameplay state, player assignment, targets, or rules.

The direct authenticated PUT proves the intended initial payload is accepted by live Test Rules. The remaining SDK-specific difference is the transaction invocation. A focused regression will assert that social creation calls `set` rather than `runTransaction` and retains read-back confirmation. Competitive creation is not changed by this incident until the social repair and adjacent tests complete.

## Allowlist

The initial patch may change only `src/firebase/roomService.js` and a focused source-contract test under `scripts/`. No Rules, gameplay engine, context authority, UI flow, Firebase config, secrets, workflow, or production project files may change.

## Rollback triggers

Rollback is required if the patch changes the room payload or namespace, removes read-back confirmation, changes collision handling in a way that creates duplicate room state, changes target/privacy or gameplay behavior, fails build/smoke tests, or causes an adjacent 1v1/2v2/Four regression.

## Review-animation scope

The explicitly requested animation review is not causally relevant to a server authorization denial. No motion or visual files are allowlisted for this repair; the review is recorded as NOT APPLICABLE to the incident.

## Repair and verification

The Rules-only repair adds `!data.exists()` to the authenticated read condition at fresh `rooms/$roomCode`, `teamRooms/$roomId`, and `tournamentRooms/$roomId` nodes. Existing member/lobby visibility conditions are unchanged, and all write/validation expressions remain unchanged. The static Rules contract passed. The emulator contract passed, including fresh-node transaction creation for social, team, and tournament room roots and the existing negative privacy/authority cases. Existing `npm test` smoke QA passed. `npm run build` passed and generated the Pages fallback. `git diff --check` passed.

The direct live REST probe showed anonymous Auth HTTP 200 and an authenticated initial PUT HTTP 200. The live Web SDK transaction probe failed with `permission_denied` before this Rules repair, confirming that the missing fresh-node read grant is the first failing authorization condition for the SDK transaction path.

## Remaining release gate

The patched Rules are not live until the owner pastes this updated `database.rules.json` into the Realtime Database Rules tab for the Test project and clicks Publish. Live 1v1 Create Room verification therefore remains BLOCKED pending that manual publish; no claim of live success is made before it.

## Post-publish verification attempt

After the owner reported publishing the updated Rules, a fresh anonymous-authenticated Web SDK probe still received `permission_denied` on the fresh `rooms/<probe>` transaction. The probe confirmed Auth succeeded, but an authenticated REST GET of a nonexistent room returned HTTP 401 `Permission denied`; this is inconsistent with the newly committed `!data.exists()` read condition and indicates the live database/rules endpoint has not yet received the intended rule set, or the console publish targeted a different database instance. The live 1v1 browser flow also still displayed `permission_denied`.

The Firebase Console Rules URL was opened, but the available browser session reached Google sign-in, so the active live Rules text could not be independently inspected in this session. No further live write was attempted.
