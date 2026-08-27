# NEON GUESS — 1v1 Reveal and 2v2 Lobby Switching

**Date:** 2026-08-27
**Scope:** Two defects only. No gameplay redesign.

## Protected scope lock

The repair does not modify target assignment, card selection, rounds, scoring, confirmation rules, reveal duration, Four-mode gameplay, Firebase game data paths, authentication, or room lifecycle. The only Rules change is the lobby seat allow-list required for the existing 2v2 Team A/B switch UI to use its already-visible third seat. The four-player room cap and 2+2 start gate remain unchanged.

## User attachment — Rules comparison

The attached file contains the previous Rules version. It confirms three separate observations:

| Reported observation | Evidence in attachment | Correct interpretation |
|---|---|---|
| A player cannot switch from Team A to Team B when the destination team is full in its first two seats | `teamRooms/$roomId/teamSeats/$seatId/.write` allow-list contains only `team_a_1`, `team_a_2`, `team_b_1`, and `team_b_2` | The visible third lobby seats were not legally claimable. This is a Rules defect. |
| A team change can be rejected even after the adapter is expanded | `teamRooms/$roomId/players/$uid/.validate` checks membership only in the first two seats | Player `teamId` validation must recognize the same third-seat IDs as the seat writer. |
| More than three players cannot connect to a 2v2 room | The attachment retains four join slots (`slot-1` through `slot-4`), but the fourth-player path had no dedicated regression proof | The intended room capacity is four, not three. This requires validating the four-slot path, not increasing the capacity beyond four. |

The 1v1 target mismatch is not caused by these Rules. It is a client synchronization/cache-lifecycle defect and is handled in the separate section below.

## Defect A — 1v1 Five Second Reveal target mismatch

### Evidence

The 1v1 engine already constructs the reveal snapshot from the authoritative owner-scoped `roundTargets`, and the existing regression confirms that Player A’s reveal target is the target Player A was trying to guess while Player B’s reveal target is the target Player B was trying to guess. The viewer-scoped `FB_DISPLAY_TARGET_RECEIVED` branch does not write into `roundTargets`.

The remaining synchronization divergence was in the client cache lifecycle: `FB_ROOM_SYNC` cleared `roundTargets` on a new round but preserved `displayTargets`. In addition, the private display-target listener did not notify the reducer when its Firebase node was absent. Therefore, an old viewer-scoped target could remain in local state while the next round’s private target write was still arriving. That stale state could produce an intermittent wrong reveal display for one player but not the other.

### Minimal repair

The reducer now clears `displayTargets` only for 1v1 when a new round or preview snapshot begins. The private display-target listener now emits `null` when the Firebase node is absent, and the reducer removes the corresponding stale player entry on that event. The authoritative reveal construction, winner, score, and five-second timing paths are unchanged.

## Defect B — 2v2 Lobby Team A/B switch and four-player connectivity

### Evidence

The lobby UI already renders three seats per team and wires the current player’s A/B controls to the `changeTeam` action. The adapter’s `teamSeatIds()` function, however, searched only `team_a_1/team_a_2` or `team_b_1/team_b_2`. When a destination team had its first two seats occupied, the adapter could not claim the visible third seat and returned the full-team error. The attached Firebase Rules independently allowed only those four seat IDs, so the third visible seat could not be used authoritatively even if the adapter was expanded.

The current source still has exactly four competitive join slots and the adapter rejects a fifth player. The corrected fixed-slot emulator test now verifies three successful non-host reservations, four total occupants, rejection/non-commit of all remaining concurrent attempts, and reuse of a released slot. This confirms that the intended four-player connection path is preserved and that the issue is not solved by allowing five or more players.

### Minimal repair

The competitive adapter now recognizes `team_a_3` and `team_b_3`. The Rules allow-list and player-team validation now recognize the same two lobby-only seat IDs. No new gameplay seat is created: join slots remain exactly four (`slot-1` through `slot-4`), the room remains capped at four players, and the existing balanced start requirement remains exactly two players in each team.

## Verification evidence

| Check | Result |
|---|---|
| 1v1 reveal regression | PASS — owner-scoped mapping and five-second timing preserved |
| 2v2 RTDB Rules emulator contract | PASS — third-seat switch, temporary 3+1 lobby, rebalancing, outsider protection, protected fields, host removal, and released-slot reuse |
| 2v2 fixed-slot emulator contract | PASS — 20 concurrent clients produced exactly four occupants, three successful non-host joins, blocked excess joins, and released-slot reuse |
| Security Rules source contract | PASS — private targets remain isolated and competitive reads are not globally public |
| Repository smoke QA | PASS |
| Team Battle flow/UI/target freshness QA | PASS |
| Pages route contract | PASS |
| Start-flow contract | PASS |
| Source image-path contract | PASS |
| Built image-path contract | PASS |
| Removed-player regression | PASS |
| Production build | PASS — Vite build completed; only pre-existing chunk-size/dynamic-import warnings |
| Diff hygiene | PASS — changes are limited to the 1v1 synchronization path, competitive lobby adapter, Rules, focused QA contracts, and evidence |

## Rules status

The attached Rules file is the old version and must not be pasted as-is. The project’s current `database.rules.json` contains the corrected six-seat lobby allow-list and matching `players/$uid.teamId` validation. It still keeps four join slots and does not permit a fifth player or a 3+2 match.

## Evidence boundary

These are source, emulator, regression, and build proofs. No claim is made here about a live two-device production session after deployment. The corrected Rules must be published to the Firebase Realtime Database, and the source changes must be published to the intended GitHub Pages deployment, before players can receive them.

## Protected-system status

```text
1v1: synchronization repair only; gameplay mapping and timing preserved
Tournament: untouched
Team Battle: lobby seat/Rules repair only; four-player cap and 2+2 start preserved
Four: untouched
Game Data: untouched
Image Paths: untouched
Firebase Rules: only the requested team-room lobby seat/validation clauses changed
```

## Decision

**CONDITIONAL — source and emulator verification passed; live Firebase publishing and live multi-device/browser verification remain outstanding.**
