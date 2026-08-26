# NEON GUESS 2v2 Round-1 Screen Load Investigation and Site-Only Fix

## Scope lock

This investigation covered the React/Vite site implementation of **2v2 Team Battle only**. Firebase Rules, Firebase Console, live database data, and gameplay-rule changes were out of scope and were not modified or published. The protected contracts were team assignment, opposing-team target visibility, dual confirmation, three rounds, the five-second reveal, scoring, navigation, and 1v1/Four isolation.

## User-reported symptom

After Round 1, when a team confirmed that the opposing team guessed correctly, the next 2v2 screen failed with:

> This game screen could not load. Check your connection then try loading the mode again.

Reloading then appeared to leave the room, and the user could not immediately resume the room from the 2v2 join screen.

## Evidence classification

| Evidence type | Finding | Status |
|---|---|---|
| SOURCE | `CompetitiveModePage.jsx` defined `useCountdown()` and called `useRef(...)`, but the React import contained only `useEffect`, `useMemo`, and `useState`. | Proven source defect |
| SOURCE | The 2v2 `round_result` and `finished` branches mount `TeamResult`, which uses `useCountdown`. | Proven execution path |
| SOURCE | `App.jsx` converts a render exception into the exact reported error text through `RouteErrorBoundary`. | Proven symptom mapping |
| SOURCE | Competitive provider saved Team Battle `resumeAfterRefresh` only for `playing`; `round_result` and `finished` were not considered resumable. | Proven recovery gap |
| SOURCE | The provider already clears the local session when a room snapshot contains a persisted `leftPlayers` entry outside lobby. This behavior was not changed because it is tied to authoritative departure state. | Protected behavior retained |
| TEST | Team Battle UI/adapter contract QA passed after adding assertions for the hook import and recovery states. | Passed |
| TEST | Deterministic Team Battle engine QA passed for dual confirmation, five-second reveal state, all three rounds, and final winner state. | Passed |
| TEST | Repository smoke QA passed. | Passed |
| BUILD | Vite production build completed successfully. | Passed; existing chunk-size and Firebase import warnings only |
| LIVE BROWSER | No independent live-browser or two-device test was claimed. | Not performed |
| LIVE FIREBASE | No Firebase Rules or live Firebase data was changed by this fix. | Confirmed non-scope |

## Root cause

The direct crash was a JavaScript runtime error, not a Firebase Rules denial. When the first 2v2 round finished, the page rendered the round-result component and invoked `useCountdown`. That hook dereferenced `useRef`, but `useRef` was not imported. React therefore threw during rendering, and the application’s route error boundary displayed the reported “This game screen could not load” message.

The reload/rejoin symptom had a separate site-side recovery weakness. The competitive provider persisted a session as resumable only while a Team Battle match was `playing`. A refresh during `round_result` or `finished` could therefore fail to attempt the intended session restoration. The repair now treats Team Battle `playing`, `round_result`, and `finished` states as resumable, without changing the authoritative room state or departure policy.

## Implemented changes

1. Added `useRef` to the existing React import in `src/pages/CompetitiveModePage.jsx`. No component layout, target logic, scoring, timers, or round engine logic was changed.
2. Extended Team Battle refresh-session persistence in `src/context/CompetitiveModeContext.jsx` to include `match.status` values `playing`, `round_result`, and `finished`.
3. Added static regressions in `scripts/qa-team-battle-ui.mjs` to prevent removal of the `useRef` import and to preserve recovery through round-result and finished states.

## Verification commands

```text
node scripts/qa-team-battle-ui.mjs
node scripts/qa-team-battle-flow.mjs
npm test
npm run build
git diff --check
```

All completed successfully. The production build reported only pre-existing advisory warnings about a large JavaScript chunk and Firebase dynamic/static import overlap.

## Release status

**READY FOR REVIEW / CONDITIONAL FOR LIVE ACCEPTANCE.** The source repair is narrowly scoped and locally verified. Live acceptance still requires the user to test two independent devices in the `neon-guess-test` deployment, complete Round 1 in 2v2, observe the next round, refresh during `round_result`, and confirm the room recovery path. Firebase Rules remain untouched by this change.
