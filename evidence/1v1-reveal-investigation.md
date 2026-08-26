# 1v1 Five Second Reveal Investigation

## Scope

This investigation is limited to the classic 1v1 post-round Five Second Reveal target projection. It does not authorize changes to reveal duration, round count or order, target/card assignment, scoring, confirmation rules, 2v2, Four, Firebase Rules, or live configuration.

## Evidence

1. `src/game/gameEngine.js` assigns each player an owner-scoped target in `targets` and preserves the same owner-scoped map in `roundTargets` at `beginPlayingFromPreview`.
2. `buildDisplayTargets` intentionally maps each 1v1 player ID to the opponent's secret target. That is the target the player sees and tries to guess during play.
3. `captureRoundTargets` creates the post-round reveal map by mapping each player ID to the opponent's owner-scoped target for 1v1. This is the established reveal contract used by both `confirmOpponentGuessed` and the legacy `submitGuess` path.
4. `src/firebase/gameSync.js` writes both private payloads correctly for every round: `ownTarget` under the owner player ID and `displayTarget` under the viewer player ID. `syncConfirmOpponentGuess` persists the engine-produced `roundResult.revealedTargets` without recomputing or swapping it.
5. `src/context/GameStateContext.jsx` currently subscribes only to `subscribeToDisplayTarget` during `PLAYING` and `ROUND_END`. Its display-target reducer branch also copies that viewer-scoped target into `roundTargets[playerId]` for 1v1.
6. The 1v1 `roundTargets` state is therefore vulnerable to being replaced by viewer-scoped display data after a Firebase round update/recovery. That map is later treated by `captureRoundTargets` as if it were owner-scoped, so the reveal producer can select the wrong target or retain stale cross-round data. The renderer is a pass-through and is not the source of the mismatch.

## Minimal repair direction

Keep the existing opponent-target display subscription and UI privacy behavior. Stop treating a viewer-scoped `displayTarget` as an owner-scoped `roundTargets` entry in 1v1. The reveal producer should continue to use the immutable owner-scoped round snapshot when it exists, with the existing display fallback only for compatibility. Add a focused regression that proves a 1v1 state containing owner-scoped `roundTargets` and viewer-scoped `displayTargets` reveals the opponent target for each player, not the viewer-scoped value keyed under the same player.

## Verification boundary

Local source/tests, emulator checks if available, and build output are not live multi-device Firebase/browser proof. Final status must remain conditional until the user performs a real 1v1 test on two independent clients.

## Implemented fix

The `FB_DISPLAY_TARGET_RECEIVED` reducer branch now updates only `displayTargets`. It no longer copies viewer-scoped data into `roundTargets`, which remains reserved for the owner-scoped immutable target snapshot used by the reveal producer. No reveal UI, timer, round transition, target assignment, or gameplay action was changed.

## Validation

The focused regression `scripts/qa-1v1-reveal-targets.mjs` passed. It exercises the real `confirmOpponentGuessed` transition, proves the reveal map remains opponent-target aligned for both players, verifies the winner and score remain unchanged, verifies the existing `REVEAL_DURATION_MS` timing, and checks the owner-target fallback path.

The repository smoke, Team Battle suite, start-flow, image-path, route, removed-player, protected 2v2, protected Four, production build, and built image-path checks all passed. The final audit reported no whitespace errors, no protected source-path changes, no Firebase Rules diff, and unchanged Rules hashes:

- `database.rules.json`: `480fd94f7e30641b8b83263b292511c2b86a8b9849392a954cd533cd86bce163`
- `database.rules.simplified-candidate.json`: `caa3c1b7d35a25e3415c19445b29de3c9f7d9da928efa0f28ec0426cf0c4233e`

## Remaining verification boundary

No live browser session or two-device Firebase playtest was performed in this task. Local tests and build output establish source-level and deterministic regression evidence, not live multi-client proof. A real 1v1 test remains required before declaring the issue fully verified in production-like use.
