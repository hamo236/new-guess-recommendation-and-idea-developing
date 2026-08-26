# Lobby Capacity and Readiness — Evidence Report

## Scope lock

**Requested outcome:** update only lobby capacity, readiness, and pre-start team movement for 1v1, Four, and 2v2 in `hamo236/new-guess-recommendation-and-idea-developing` on `main`.

**Protected systems:** five-second reveal timing, round count and order, target/card assignment and privacy, scoring, confirmations, Four bracket progression, gameplay engines, routes outside lobby controls, Firebase Rules, live Firebase configuration, and live publication.

**Allowlisted source changes:** `src/pages/CompetitiveModePage.jsx` and `src/pages/LobbyPage.jsx`.

**Allowlisted QA changes:** `scripts/qa-lobby-capacity-contract.mjs`, `scripts/qa-team-battle-ui.mjs`, and the stale lobby wording assertion in `scripts/qa-smoke.mjs`.

## SOURCE VERIFIED

The competitive adapter already had a fixed four-player `joinSlots` capacity, atomic two-seat Team A/Team B switching, released-seat reuse, and authoritative 2+2 validation at Team Battle start. The classic room service already used capacity two for 1v1 and four for Four, including full-room rejection. No adapter, service, gameplay, or Rules source change was required for those authoritative behaviors.

The implementation therefore changes only the lobby projection and guards. Team Battle keeps three visible seat rows per team, retains the existing player-scoped Team A/Team B controls, communicates the exact 2+2 requirement, and disables Start until the current lobby distribution is exactly 2+2. Classic Four now requires exactly four players before Start; 1v1 retains its exact-two requirement. Local mock full-room feedback explicitly says `Room Full`.

## TEST VERIFIED

The following checks passed after the patch:

| Check | Result |
| --- | --- |
| `node scripts/qa-lobby-capacity-contract.mjs` | PASS |
| `npm run test:team-battle` | PASS |
| `npm test` | PASS |
| `npm run test:start-flow` | PASS |
| `npm run test:image-paths` | PASS |
| `npm run test:pages-routes` | PASS |
| `npm run test:removed-player` | PASS |
| 2v2 asymmetric confirmation, guessed-correct repair, reveal targets, engine, flow, and target freshness scripts | PASS |
| Four confirmer score, lifecycle, JSON progression, natural guess flow, Firebase confirmation, and runtime contract scripts | PASS |

The smoke-test wording assertion was updated because the old read-only `grouped by join order` statement contradicted the newly approved ability to move teams. Persisted join-order sorting assertions remain in place.

## LOCAL EMULATOR VERIFIED — NOT LIVE FIREBASE

With `FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9001`, both available emulator checks passed:

| Check | Result |
| --- | --- |
| `competitive-fixed-slots-emulator.test.mjs` | PASS: four occupants, fifth join blocked, cross-slot overwrite blocked, released slot reused |
| `team-switch-remove-emulator.test.mjs` | PASS: scoped team switch, protected fields blocked, outsider write blocked, host removal, released slot reused |

These are local emulator results and are not live Firebase or four-client proof.

## BUILD VERIFIED

`npm run build` passed. `npm run test:image-paths:built` passed. Existing Vite chunk-size and dynamic-import warnings were non-fatal and unrelated to this lobby-only patch.

## RULES AND SCOPE AUDIT

The active Rules hash remained `480fd94f7e30641b8b83263b292511c2b86a8b9849392a954cd533cd86bce163`.

The candidate Rules hash remained `caa3c1b7d35a25e3415c19445b29de3c9f7d9da928efa0f28ec0426cf0c4233e`.

`git diff --check` passed, and the Rules diff was empty. No live Firebase configuration, publication, database data, gameplay, reveal, scoring, target assignment, or round system was changed.

## NOT VERIFIED

No live browser session or four-independent-device Firebase playtest was performed in this pass. Real-world verification is still required for 2v2 Team A/B movement, 3+1 Start blocking, exact 2+2 enabling, fifth-player Room Full behavior, leave-and-replacement behavior, classic 1v1/Four capacity, and confirming that a normal game after Start remains unchanged.

## Release status

**CONDITIONAL / NEEDS USER TEST.** The scoped source, deterministic contracts, local emulator checks, protected regressions, and production build passed. The change should not be called live-verified or release-ready until the manual multi-client scenarios below are completed.

## Manual multi-client test plan

1. In 2v2, create a room and join with four independent clients; confirm three visible seat rows in both Team A and Team B.
2. Move a player from Team A to Team B and confirm the player appears under the selected current team on every connected lobby.
3. Create a 3+1 distribution and confirm Start remains disabled and the lobby explains the exact 2+2 requirement.
4. Move one player back so the lobby is 2+2 and confirm the host Start control enables.
5. Attempt a fifth 2v2 join while four players are present and confirm the joining client sees Room Full.
6. Have one 2v2 player leave, then join with a replacement client and confirm the released capacity is reusable.
7. In classic 1v1, fill the room with two clients and attempt a third join; confirm Room Full.
8. In Four, verify Start is blocked with two and three players, then enabled with exactly four; attempt a fifth join and confirm Room Full.
9. After starting each relevant mode, verify ordinary target privacy, confirmations, scoring, round progression, and the five-second reveal remain unchanged.
10. Refresh or reconnect a lobby participant after a team move or replacement and confirm the authoritative current lobby state is restored without changing gameplay state.
