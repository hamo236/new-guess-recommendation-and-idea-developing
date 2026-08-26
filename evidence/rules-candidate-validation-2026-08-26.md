# NEON GUESS — Simplified RTDB Rules Candidate Validation

**Date:** 2026-08-26  
**Repository:** `hamo236/new-guess-recommendation-and-idea-developing`  
**Branch:** `main`  
**Firebase scope:** `neon-guess-test` only  
**Artifact:** `database.rules.simplified-candidate.json`  
**Status:** `CONDITIONAL — local candidate verified; live publication and independent-device acceptance are still required`

## Scope lock

This pass addresses the corrected user incident in **classic One-by-One / 1v1**, not Four. The target is the asymmetric `Guess Correct` flow after refresh/re-entry and the Rules operation contract supporting Create, Join, Start, round resolution, score persistence, and target privacy.

Protected behavior remains unchanged: during play each viewer sees the opponent’s target, private `ownTarget` is not exposed to another player, round progression and scoring remain authoritative, the five-second reveal duration is not changed, and navigation, room capacity, authentication, 2v2, Four, and tournament gameplay are not rewritten. Four is tested only as an adjacent Rules-path regression.

## Confirmed source contract

The classic 1v1 action is not a direct guest room transaction. The actual flow is:

```text
Guess Correct button
→ GameStateContext.confirmOpponentGuess
→ syncSendChatMessage at rooms/<code>/messages/<messageId>
→ Host onMessagesUpdate selects the latest guess_confirm
→ Host syncConfirmOpponentGuess
→ root transaction at rooms/<code>
→ round_end, score, result, timestamps, and round history persist
```

The current `guess_confirm` payload has no `roundId`. The Rules candidate therefore does not claim stale-message rejection by round identity; such a guarantee requires the existing payload or an equivalent server-authoritative round identity to be added, which was outside this Rules-only pass.

## Candidate emulator evidence

The durable regression is `scripts/security-rules-simplified-candidate.test.mjs`. It loads the candidate file directly into a local Realtime Database Emulator and uses a production-shaped create → join → playing fixture. It does not overwrite the committed Rules artifact or contact live Firebase.

| Operation or security boundary | Result | Evidence label |
|---|---:|---|
| Production-shaped 1v1 create/join lifecycle | Allowed | `TEST VERIFIED` |
| Guest `guess_confirm` relay message | Allowed | `TEST VERIFIED` |
| Host-originated `guess_confirm` relay message | Allowed | `TEST VERIFIED` |
| Duplicate message key | Blocked | `TEST VERIFIED` |
| Outsider forged confirmation | Blocked | `TEST VERIFIED` |
| Self-selected winner | Blocked | `TEST VERIFIED` |
| Host root resolution transaction | Allowed | `TEST VERIFIED` |
| `round_end` persistence | Verified | `TEST VERIFIED` |
| Score increment persistence | Verified | `TEST VERIFIED` |
| `roundResult` and `roundResults` persistence | Verified | `TEST VERIFIED` |
| Viewer’s own `displayTarget` read | Allowed | `TEST VERIFIED` |
| Cross-player `displayTarget` read | Blocked | `TEST VERIFIED` |
| Viewer reading private `ownTarget` | Blocked | `TEST VERIFIED` |
| Four exact action nesting: `$roundId/$matchId/$matchRound/$actorId` | Allowed for valid actor | `TEST VERIFIED` adjacent regression |
| Four cross-actor action | Blocked | `TEST VERIFIED` adjacent regression |
| Four outsider action | Blocked | `TEST VERIFIED` adjacent regression |
| Four wrong-target action | Blocked | `TEST VERIFIED` adjacent regression |
| Four stale-round action | Blocked | `TEST VERIFIED` adjacent regression |

The static companion contracts are `scripts/security-rules-simplified-candidate-contract.test.mjs` and the repository contract `scripts/security-rules-contract.test.mjs`. The candidate-specific contract checks the host boundary, lobby discovery, append-only message structure, target privacy branches, Four action nesting, and the competitive validator structure. The repository contract was made tolerant of valid host-parent authorization cascading.

## Verification executed

All of the following completed with exit code `0` in the local environment:

```text
node scripts/security-rules-simplified-candidate.test.mjs
node scripts/security-rules-simplified-candidate-competitive.test.mjs
node scripts/security-rules-simplified-candidate-contract.test.mjs
node scripts/security-rules-emulator.test.mjs
node scripts/multi-client-isolation-emulator.test.mjs
node scripts/security-rules-contract.test.mjs
npm run test:start-flow
npm test
npm run test:team-battle
npm run build
git diff --check
```

The active Rules emulator suite passed its existing create/start-preview, target privacy, authority, lifecycle, and outsider checks. The 20-client isolation suite passed room capacity, no cross-room player bleed, and lobby discovery. The candidate-specific competitive suite passed 2v2 join/team-seat setup, rounds 1–3, host resolution/advance, next-round private targets, cross-player privacy denial, outsider confirmation denial, Tournament semifinal A/B rounds 1–3, final and third-place rounds 1–3, and final-results persistence. Start-flow, smoke, Team Battle QA, the repository static Rules contract, and the Vite build passed. The build emitted only the existing large-chunk warning; no build failure occurred.

## Repository safety state

The committed active Rules file was restored byte-for-byte from `HEAD` after candidate testing:

```text
HEAD / active database.rules.json:
480fd94f7e30641b8b83263b292511c2b86a8b9849392a954cd533cd86bce163

Candidate database.rules.simplified-candidate.json:
caa3c1b7d35a25e3415c19445b29de3c9f7d9da928efa0f28ec0426cf0c4233e
```

No Firebase Console publication was performed. No production or Page Firebase project was accessed. The permissive diagnostic Rules (`.read/.write: auth != null`) must not remain published because they allow any authenticated user to read and mutate other rooms and private branches.

## Security tradeoff requiring review

The simplified candidate intentionally uses an existing-room Host parent write boundary so the current root transaction can persist the complete 1v1 resolution atomically. This is simpler and matches the current client architecture, but it is broader than a least-privilege per-leaf design: a compromised authenticated Host session could attempt writes under its own room. The candidate’s compensating checks preserve member-only reads, append-only messages, private target isolation, identity checks, and action ownership, but this tradeoff should be accepted consciously before publication.

## Reveal issue — not a Rules repair

Source inspection and a deterministic engine probe show that `captureRoundTargets` stores the opponent’s target under each player ID, while `RoundRevealPanel` renders that value under `<player name> TARGET`. This creates a label/value mismatch on the five-second reveal screen. It is independent of RTDB authorization and was not changed in this pass because the product contract must be chosen explicitly:

1. Keep the data mapping and rename the label to mean **the target this player attempted to guess**; or
2. Keep the existing label and change only post-round reveal indexing so each player’s label shows the target assigned to that player.

The during-play rule that each player sees the opponent’s target must remain unchanged in either case.

## Release decision

**CONDITIONAL, not live-ready yet.** The local candidate Rules and regression suite are verified for the tested 1v1 operation contract. This does not prove that the candidate is already published in `neon-guess-test`, that the current live Console text matches this hash, or that two independent phones complete both player directions over the network. Those are manual user gates.

## Required manual gates

1. In Firebase Console for `neon-guess-test`, confirm that permissive diagnostic Rules are not left published.
2. Paste the reviewed candidate JSON only after inspecting the complete file and publish it manually.
3. Confirm the published Console Rules correspond to the candidate artifact supplied with this report.
4. On device A, sign in anonymously, create a classic One-by-One room, and copy the room code.
5. On device B, join using the code and verify that both players remain in the same room.
6. Start the round and verify each device sees the opponent’s target, not its own.
7. Press `Guess Correct` from device A for device B and confirm round end, score, and reveal transition.
8. Refresh or re-enter device B, play the next round, and press `Guess Correct` from device B for device A.
9. Confirm the five-second reveal screen and record whether each label should represent the assigned target or the target attempted by that player.
10. Capture any `PERMISSION_DENIED` message with the room code, stage, actor device, and timestamp if either direction still fails.
