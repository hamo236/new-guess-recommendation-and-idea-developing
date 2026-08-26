# NEON GUESS — 1v1/Four Target and Guess Correct Incident

**Date:** 2026-08-26  
**Project:** `hamo236/new-guess-recommendation-and-idea-developing`  
**Firebase scope:** `neon-guess-test` only  
**Investigation mode:** Research and diagnosis only; no application or Rules repair was applied during this incident pass.

## Incident statement

The user reported two behaviors after manually publishing the simplified candidate Rules:

1. The Target shown during the five-second reveal was different from the expected Target.
2. In a four-player social match, the Host-side phone could press `Guess Correct` for the opponent, while the non-Host opponent phone could not. Refreshing and re-entering did not restore the non-Host action.

The user described Player 1 versus Player 4, which maps to the Four-player social knockout path rather than the classic 1v1 two-player path. The two symptoms therefore require separate root-cause decisions.

## Finding A — non-Host Guess Correct is a Rules candidate defect

**Status:** `TEST VERIFIED`.

The production writer is `syncImpostorAction` and persists the action at:

```text
rooms/<roomCode>/actions/<roundId>/<matchId>/<matchRound>/<actorId>
```

The simplified candidate Rules currently authorize the dynamic action at:

```text
rooms/$roomCode/actions/$roundId/$matchId/$actorId
```

The candidate is therefore one dynamic path level too shallow: it treats `<matchRound>` as `$actorId` and never reaches the real `<actorId>` leaf. A non-Host write at the production path has no matching child `.write` grant and is denied. The Host still succeeds because the candidate has a broad existing-room Host boundary at `rooms/$roomCode`.

A managed Firebase Database Emulator probe used the exact path:

```text
rooms/incident-four/actions/round-1/match-1/1/player-4
```

The result was:

| Actor | Result | Explanation |
|---|---|---|
| `player-1` Host | Allowed | Parent Host boundary grants the write |
| `player-4` non-Host | Denied | Candidate action path does not match the production hierarchy |
| `outsider` | Denied | Membership and actor checks reject the write |

The emulator process exited successfully and printed the finding explicitly. This reproduces the reported asymmetry without relying on browser behavior.

The relevant candidate Rules fragment is in `database.rules.simplified-candidate.json` at the `actions` block. The required structural correction, if later authorized for implementation, is to model `$matchRound` and `$actorId` separately. This is a Rules-only authorization correction and must be accompanied by negative tests preventing another actor from writing a player’s action.

## Finding B — the five-second reveal mapping is source-level and semantically reversed

**Status:** `SOURCE VERIFIED` and `TEST VERIFIED` through a deterministic pure-engine probe.

The engine starts a 1v1 round with secret targets:

```text
state.targets[player-1] = Target A
state.targets[player-4] = Target B
```

During play, the established privacy behavior is viewer-scoped:

```text
displayTargets[player-1] = Target B
 displayTargets[player-4] = Target A
```

That is correct for gameplay because each player sees the opponent-facing target.

However, `captureRoundTargets` in `src/game/gameEngine.js` currently builds the persisted reveal object using the opponent’s secret target:

```text
revealedTargets[playerId] = secretTargets[opponentId]
```

`RoundRevealPanel.jsx` then renders that value under the label:

```text
<Player name> TARGET
```

Therefore the current result is:

| Label | Target rendered | Player’s own secret target |
|---|---|---|
| Player 1 TARGET | Target B | Target A |
| Player 4 TARGET | Target A | Target B |

The deterministic probe produced exactly this mapping. The mismatch is not produced by Firebase Rules and is not caused by the Start Preview repair. It is a source-level semantic mismatch between the reveal object’s index and the reveal panel’s label. The function comment says it captures the target each player was trying to guess, while the UI labels the value as that player’s target. The established gameplay constitution protects target privacy during play, but the post-round reveal must follow the established UI contract; this incident requires confirming the intended post-round label/value contract before any source change is authorized.

The safe distinction is:

- Do not change `displayTargets` or playing-time privacy.
- Do not expose `ownTarget` in public playing state.
- If the intended reveal is each player’s own completed target, change only the post-round capture/indexing contract and add a focused test.
- If the intended reveal is “target attempted by this player,” retain the data mapping but rename the UI label and confirm that this is the established product meaning. No such semantic change should be guessed during repair.

## Why Refresh did not solve the non-Host action

Refresh restores the client session and the viewer-scoped private `displayTarget`; it does not change the authorization path used by `syncImpostorAction`. The non-Host action is still written to the same four-level production path, so re-entry cannot repair a Rules path mismatch. The observed persistence after Refresh is consistent with the Rules denial.

The Provider also intentionally gives the Host the responsibility to process some `guess_confirm` messages, while the Four-player social path writes `confirm_guess` actions directly through `syncImpostorAction`. These are distinct paths. The reported Player 1 versus Player 4 asymmetry is explained by the Four-player action path and does not establish a defect in the classic two-player message relay.

## Decision

The first confirmed node-edge failures are:

1. **Rules candidate mismatch:** non-Host Four-player action path is denied because the candidate omits `$matchRound`.
2. **Independent source semantic mismatch:** post-round `revealedTargets` is indexed by player ID but populated with the opponent’s target, then displayed under the player’s own name.

The previously completed Start Preview repair did not modify `gameEngine.js`, `RoundRevealPanel.jsx`, or the Four-player action writer. It is therefore not supported by the evidence as the cause of the reveal mapping defect. The simplified Rules candidate is supported by direct emulator evidence as the cause of the non-Host action asymmetry.

## Protected boundaries

No gameplay repair was performed in this pass. The following remain locked: target assignment, target privacy during `playing`, rounds and order, five-second reveal duration, scoring formula, timers, teams, brackets, room capacity, Join semantics, Leave/Refresh meaning, navigation meaning, and Production/Page Firebase separation.

## Required next gates before implementation

1. Confirm whether the reported room was Four-player social or classic 1v1; the Player 1 versus Player 4 description strongly indicates Four-player.
2. Confirm the intended meaning of the post-round label: each player’s own completed secret target, or the target that player attempted to guess.
3. Prepare a minimal candidate Rules correction for the exact four-level action path.
4. Add emulator assertions for Host success, non-Host own-action success, cross-actor denial, wrong opponent denial, stale round denial, and outsider denial.
5. Add a pure-engine regression for the chosen reveal contract before changing any target-related source.
6. Re-run protected 1v1, 2v2, and Four regression suites.
7. Do not leave permissive `.write: auth != null` Rules published.
8. Publish only the reviewed Test Rules manually in `neon-guess-test`.
9. Re-test with independent clients and capture Firebase/browser diagnostics.
10. Keep the release decision `CONDITIONAL` or `BLOCKED` until those live gates pass.

## References

[1]: https://firebase.google.com/docs/database/security "Firebase Realtime Database Security Rules"  
[2]: https://firebase.google.com/docs/rules/unit-tests "Firebase Rules Unit Testing"  
[3]: https://firebase.google.com/docs/database/web/structure-data "Firebase Realtime Database Data Structure"


## Scope correction — true One-by-One (added 2026-08-26)

The user subsequently clarified that the reported asymmetric `Guess Correct` behavior was observed in the **classic One-by-One / 1v1 mode**, not in Four. The original Four classification above must not be used as the diagnosis of that user incident. The Four action-path finding remains an adjacent regression lesson only.

### Correct 1v1 operation contract

In classic 1v1, the button is available to either player while the room is playing. The non-Host does not directly resolve the room. The flow is:

```text
player clicks Guess Correct
→ GameStateContext creates a guess_confirm payload
→ syncSendChatMessage writes rooms/<code>/messages/<messageId>
→ Host listener selects the latest confirmation
→ Host calls syncConfirmOpponentGuess
→ Firebase root transaction persists the round-end state
```

The relevant relay payload currently contains `id`, `type`, `confirmerId`, `winnerId`, `playerId`, `playerName`, and `timestamp`; it does **not** contain a `roundId`. Therefore a Rules test cannot honestly claim stale-message rejection by round identity until the existing product payload carries such an identity. This report does not modify that gameplay/network contract.

### Candidate-only 1v1 evidence

A production-shaped local Realtime Database Emulator regression now exercises the actual create → join → playing boundary and the two 1v1 player directions against `database.rules.simplified-candidate.json` without overwriting `database.rules.json` or contacting live Firebase. It verified:

| Contract | Result | Evidence label |
|---|---|---|
| Guest `guess_confirm` message | Allowed | `TEST VERIFIED` |
| Host-originated confirmation message | Allowed | `TEST VERIFIED` |
| Duplicate message key | Blocked | `TEST VERIFIED` |
| Outsider forged confirmation | Blocked | `TEST VERIFIED` |
| Self-selected winner | Blocked | `TEST VERIFIED` |
| Host root resolution transaction | Allowed | `TEST VERIFIED` |
| `round_end`, score increment, `roundResult`, `roundResults` persistence | Verified | `TEST VERIFIED` |
| Viewer’s `displayTarget` read | Allowed | `TEST VERIFIED` |
| Viewer reading another player’s `displayTarget` | Blocked | `TEST VERIFIED` |
| Viewer reading `ownTarget` | Blocked | `TEST VERIFIED` |

The same candidate regression covers the adjacent Four action path at `actions/$roundId/$matchId/$matchRound/$actorId`, with exact-round allow and cross-actor, outsider, wrong-target, and stale-round blocks. This is **not** a reclassification of the user’s 1v1 incident.

### Corrected interpretation

The open authenticated Rules experiment is valid evidence that the previously published restrictive Rules blocked at least one real 1v1 operation. It is not proof that every candidate field or every live operation is correct. The candidate now passes the available local 1v1 relay contract, but live Firebase publication and two-independent-device testing remain external gates. No claim of `LIVE FIREBASE VERIFIED`, `LIVE BROWSER VERIFIED`, or two-device verification is made here.

### Reveal issue remains separate

The five-second reveal mapping remains a source-level semantic mismatch: `captureRoundTargets` stores the opponent’s target under each player ID, while `RoundRevealPanel` labels the value as `<player name> TARGET`. During play, the viewer-scoped opponent target behavior remains protected and correct. No source repair was applied because the intended post-round meaning still requires an explicit product decision: either show the target assigned to that player, or label the existing value as the target that player attempted to guess.

### Current safety boundary

The committed `database.rules.json` was restored exactly to the Git `HEAD` artifact after candidate testing. The simplified candidate remains a separate untracked file and has not been published to Firebase by this work. The user must not leave the permissive diagnostic Rules (`.read/.write: auth != null`) published.
