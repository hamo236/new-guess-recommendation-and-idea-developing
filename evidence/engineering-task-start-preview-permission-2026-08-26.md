# Engineering Task: Repair 1v1 Start Preview Permission Rollback

## Context

Repository: `hamo236/new-guess-recommendation-and-idea-developing`, branch `main`, Firebase environment `neon-guess-test` only. The application is a React/Vite/Firebase Realtime Database multiplayer game. The incident affects the classic 1v1 Start Game flow.

## User-Reported Problem

After the host presses Start Game, the Preview/person-character surface appears for less than a second, disappears, and the client returns to the Lobby.

## Observed Behavior

The local reducer entered Preview optimistically before the Firebase Start Preview write completed. The Firebase root fan-out was denied by the local Rules emulator because three leaves in the production payload lacked child authorization: `revealEndTimestamp`, `transitionStartedAt`, and `transitionEndsAt`. The authoritative room remained in `lobby`; the existing listener and route guards then restored the Lobby. This is source- and emulator-backed, not a visual-only hypothesis.

## Expected Behavior

A successful Start Game request must authorize and persist the existing Preview state. A rejected Firebase request must not advance local state into a false Preview that is immediately rolled back by the authoritative listener.

## Reproduction Steps

1. Seed a valid 1v1 room with a host and a second player.
2. Submit the exact `syncEnterPreview` root multi-location update.
3. Before the Rules repair, observe `permission_denied` from the emulator because timestamp leaves lack `.write` authorization.
4. Observe that the application’s local optimistic Preview can be overwritten by the authoritative lobby snapshot.

## Root Cause

`syncEnterPreview` writes thirteen fields through one root `update(ref(db), updates)`. Firebase Realtime Database authorization is evaluated for every affected path. The classic room Rules authorized several sibling lifecycle fields but omitted the three timestamp children, so the entire multi-location update failed. Independently, `startGame` dispatched local `START_GAME` before awaiting the write, creating the visible flash.

## Implementation Requirements

1. Add host-only child authorization and numeric nonnegative validation for the three missing timestamp fields under `rooms/$roomCode`.
2. Await the existing `syncEnterPreview` operation before dispatching local `START_GAME`.
3. Add static and emulator regressions for exact fan-out success, non-host/outsider denial, invalid timestamp rejection, cross-room denial, and private-target isolation.
4. Do not change engine rules, payload semantics, targets, phases, rounds, timing, scoring, teams, brackets, capacity, join semantics, or navigation meaning.

## Allowlisted Files

- `database.rules.json`
- `src/context/GameStateContext.jsx`
- `scripts/security-rules-contract.test.mjs`
- `scripts/security-rules-emulator.test.mjs`
- `scripts/start-flow-contract.test.mjs`
- `package.json`
- related evidence artifacts under `evidence/`

## Verification Requirements

Run the focused contracts, the managed RTDB emulator suite, concurrent multi-client isolation, protected smoke and Team Battle regressions, image/path regressions, Pages route contract, production build, built-asset checks, and `git diff --check`. Label live Firebase publication and independent-device verification separately; they cannot be inferred from local tests.

## Rollback Boundary

Rollback only the allowlisted Rules/source/test changes if the build fails, exact fan-out authorization fails, private-target isolation regresses, or any protected gameplay contract changes. Do not delete rooms, alter production/Page, publish Rules automatically, or reset unrelated working-tree evidence.
