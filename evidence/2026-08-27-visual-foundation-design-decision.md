# NEON GUESS — Visual Foundation Design Decision Record

**Run ID:** 2026-08-27-visual-foundation-phase-1

**Target surface:** Shared frontend visual foundation: material tiers, hierarchy, touch/focus feedback, reduced motion, and mobile-safe layout primitives.

**Requested mode:** FRONTEND_IMPLEMENTATION

## Player and product intent

**Player/context:** A first-time or returning mobile player entering NEON GUESS, creating or joining a room, waiting in a lobby, or reading a competitive status surface.

**What the player just did:** Opened a mode, tapped an existing action, or reached a state that needs immediate visual confirmation.

**What the player must do next:** Understand the current context and identify the existing primary action without scanning every decorative surface.

**Primary screen job:** Make the next legitimate action visually obvious while preserving the premium neon/glass identity.

**What must remain hidden:** Targets, private reveal data, authoritative state ownership, Firebase details, and any gameplay information not already projected by the existing UI.

## Product-specific design direction

**Product-world vocabulary:** signal, neon arena, player roster, team lane, reveal beacon, bracket stage, voice channel.

**Color world:** `signal-cyan` (`#7df4ff`), `violet-echo` (`#e9b3ff`), `arena-night` (`#070b12`), `glass-surface` (`rgba(255,255,255,0.05)`), `ready-green` (`#75f2b2`), `attention-amber` (`#ffd166`).

**Typography roles and rationale:** Keep existing display and body conventions. Use concise uppercase mono kickers only for system context; use readable body text for player actions and status. Do not reduce text solely to fit a card.

**Layout grammar:** One primary lane, grouped secondary information, stable rails for status, safe mobile gutters, and progressive visual emphasis rather than equal-brightness cards.

**Signature element:** A restrained cyan signal rail or beacon marks the current action/state, while secondary surfaces retain glass depth without competing glow.

**Three defaults rejected and product-specific alternatives:**

1. Reject “make every button full-width”; use one primary action rail and compact but touch-safe secondary controls.
2. Reject “remove blur to make it simple”; use material tiers and opaque fallback surfaces when text needs stronger contrast.
3. Reject “animate everything to feel smooth”; use immediate pressed/focus feedback and short transform/opacity motion only where it explains state.

**Selected direction:** Calm Command Center + Premium Material Hierarchy.

## State-first design matrix

| Element | Existing state projection | Idle | Focus/pressed | Disabled/loading | Success/failure | Waiting/reconnect | Privacy/reveal risk |
|---|---|---|---|---|---|---|---|
| Existing button | Existing `disabled`, handler, and label | Compact premium surface | Existing focus ring plus immediate press treatment | Preserve existing disabled/loading truth | Preserve existing existing label/status | Do not infer new state | No target or private data added |
| Existing card/panel | Existing rendered content | Tiered glass surface | Border/highlight only | Preserve current content | Preserve current content | Stable height where possible | No hidden data revealed |
| Existing team/voice control | Existing props and callback | Clear affordance with label/icon | Focus and pressed states | Existing disabled state | Existing result/status | Existing reconnect projection | No new connection state |
| Existing status rail | Existing text/state | Muted but legible | No state mutation | Existing loading text | Existing success/failure | Existing waiting/reconnect text | No authoritative state duplication |

## Motion contract

**Trigger:** Existing interaction or existing rendered presentation transition only.

**Purpose:** Confirm press/focus, clarify a small visual state transition, or prevent a jarring surface change.

**Properties animated:** `transform`, `opacity`, `background-color`, `border-color`, `box-shadow` only where already used and where the change remains lightweight.

**Duration/easing:** Existing 140ms fast and 180ms standard tokens; use ease-out/custom responsive curves for entering feedback. No new gameplay timing.

**Interruptibility:** CSS transitions only; no new keyframe-driven repeated interaction motion and no new JS animation state.

**Reduced-motion fallback:** Remove movement and decorative pulse while preserving readable color/opacity/status feedback under `prefers-reduced-motion: reduce`.

**Failure or timeout behavior:** Visual styling never reports success or changes disabled/loading truth. Existing handler result remains authoritative.

## Responsive and accessibility contract

**Supported widths:** 320px, 360px, 390px, and desktop widths.

**Mobile composition:** Safe page gutters, no horizontal overflow, one primary action lane, touch-safe hit areas, stable status regions.

**No-overflow check:** Test long English and Arabic labels, narrow screens, text resizing, and rotated/stacked action clusters.

**Keyboard/focus behavior:** Preserve native tab order and visible focus; do not hide focus behind glow.

**Semantic names:** Preserve existing button/link names; labels may be clarified only when presentation-only and without changing handlers.

**Contrast and non-color cues:** Important states use text, border, icon, or shape in addition to color. Text remains readable over glass.

**Touch target behavior:** Visual controls may be compact, but their existing clickable/hit area remains comfortable and separated from adjacent actions.

**Text resize/wrapping:** Allow wrapping or stable max-width; do not clip essential status or action labels.

## Safety and implementation boundary

**Repository evidence:** The repository already contains neon/glass tokens and multiple presentation utilities in `src/index.css`; current working tree also contains unrelated pre-existing gameplay/Rules changes from the earlier task.

**Allowed files for this phase:** `src/index.css` only, plus this evidence record and narrowly scoped visual/source contracts if needed.

**Protected callbacks/state/routes/effects:** All React handlers, props, conditions, state, effects, timers, Firebase calls, and navigation outcomes remain untouched.

**Protected multiplayer/Firebase/privacy systems:** `src/game/**`, `src/context/**`, `src/firebase/**`, `database.rules.json`, target/card assignment, target privacy, rounds, reveal timing, scoring, room lifecycle, authentication, and Team Battle synchronization.

**Non-goals:** No Home/Lobby JSX rearrangement in this phase, no How to Play relocation yet, no Four bracket markup change, no Voice/Call callback or label-flow change, no dependency, package, route, or configuration change.

**Rollback point:** Revert only the new CSS foundation block and leave the pre-existing working-tree changes untouched.

## Decision and verification

**HDDQS before implementation:** The direction is product-specific through signal/beacon/arena vocabulary, has a clear primary lane, uses premium materials intentionally, rejects generic full-width and glow-everything defaults, and keeps state projection separate from presentation.

**Changed files planned:** `src/index.css` only.

**Unchanged protected systems required:** Gameplay, targets, cards, reveal timing, rounds, scoring, 1v1/2v2/Four flow, Firebase, Rules, auth, routes, callbacks, and state/effects.

**Checks planned:** CSS/source contract, protected-file diff audit, build, smoke, Team Battle, image paths, routes, and visual responsive inspection where available.

**Checks not run yet:** All implementation checks are pending until the CSS patch is applied.

**Runtime evidence:** Not yet collected for this phase.

**Visual evidence:** Prior research and current token inspection only; post-patch visual review is pending.

**Remaining uncertainty:** Exact runtime rendering cost of nested backdrop filters varies by browser/device and must be checked on real mobile viewport emulation after the patch.

**Status:** NOT_VERIFIED


## Runtime visual check — 2026-08-27

The Vite app rendered successfully at `/neon-guess-game-public/`. The Home surface showed the existing hierarchy of `2v2 Team Battle`, `1v1 Guess Who`, Daily Drop, and a compact `HOW TO PLAY` control. The rendered viewport showed no horizontal overflow during inspection. The foundation patch preserved the existing neon title, glass cards, cyan/purple accents, and button affordances. The inspection was presentation-only; no gameplay route or runtime state was exercised.

The browser accessibility extraction confirmed that the primary interactive controls remained available: Enter Team Battle, Enter 1v1, Play Today’s Drop, and How to Play.

## Verification update

`npm test` passed. `npm run test:team-battle` passed. The focused 1v1 reveal, 2v2 team-switch, route, start-flow, image-path, built-image-path, and removed-player contracts passed. `npm run build` passed and generated the GitHub Pages fallback documents. The initial broad motion grep reported a pre-existing `ng-recovery-breathe` animation at line 1623; this animation was not changed by the foundation patch. The new CSS diff itself adds no keyframes or repeated animation and uses only short transitions on presentation properties.

**Phase status:** PASS for the scoped CSS foundation, with live-device performance still requiring real-device validation before a production release.


## Home/Lobby Hierarchy Pass — 2026-08-27

The next frontend-only pass retuned the existing Home/Lobby presentation through `src/index.css` only. The primary mode actions remain the strongest visual lane, Daily Drop remains a quieter secondary surface, and `HOW TO PLAY` remains a compact tertiary control. The patch preserves the existing semantic controls, labels, disabled states, handlers, routes, and render branches; no JSX, React state, callback, navigation, or gameplay file was changed.

The premium treatment is preserved through the existing neon/glass language. The change uses hierarchy, spacing, border/glow restraint, and responsive rhythm rather than removing blur or flattening surfaces. Touch-safe clickable areas remain separate from their compact visual treatment. No new keyframe or repeated animation was introduced; motion remains limited to lightweight presentation transitions and the existing reduced-motion policy.

## Home/Lobby Verification Update

The production build passed after the hierarchy patch. `npm test` and `npm run test:team-battle` passed. Focused contracts for 1v1 reveal targets, lobby capacity, routes, start flow, image paths, removed players, reveal timing, voice reliability, and voice SDP passed. Runtime inspection at `/neon-guess-game-public/` showed the mode hierarchy, Daily Drop, and compact How to Play control without observed horizontal overflow. The final CSS audit found the intended Home/Lobby marker and no new animation/keyframe rule. The pre-existing `ng-recovery-breathe` animation remains unchanged.

**Phase status:** PASS for the Home/Lobby presentation-only hierarchy pass. Real-device performance and touch validation remain required before production release; no live deployment was performed.


## Competitive surface phase runtime inspection — 2026-08-27

The local Vite preview loaded the correct base-path route at `/neon-guess-game-public/competitive`. The global shell, navigation, and dark premium background rendered. The route displayed no active lobby/bracket content because no live competitive room/session was present in the local preview; therefore no claim is made about an active four-player bracket or Voice/Call state from this inspection. CSS and automated contracts remain the source of verification for this presentation-only patch.

The first attempted route without the configured base path correctly returned the Vite base-path guidance and was not treated as an application failure.


## Gameplay-surface runtime inspection — 2026-08-27

The local gameplay navigation redirected to the existing `/neon-guess-game-public/one-v-one` lobby route rather than opening an active match, so no live target or reveal state was entered or mutated. The rendered shell remained stable: compact header navigation, room-entry controls, waiting-room surface, and Start Game control were visible without horizontal overflow at the inspected viewport. This is route/shell evidence only; active multi-client gameplay visual proof remains unavailable in this local inspection. Automated gameplay, reveal, team-battle, timing, and protected-scope contracts passed separately.


## Final cross-screen polish — 2026-08-27

The final polish remained presentation-only in `src/index.css`. It added a shared interaction language for the existing Home, competitive, and gameplay shells: transparent mobile tap highlight, `touch-action: manipulation`, explicit focus-visible treatment for form controls, balanced heading wrapping, and a compact mobile minimum control height. No JSX, React state, handlers, callbacks, routes, gameplay files, Firebase files, or Rules were changed in this polish.

### Final release gates

- `npm test`: PASS.
- `npm run test:team-battle`: PASS.
- Production `npm run build`: PASS; Vite produced the static bundle and route fallbacks.
- `git diff --check`: PASS.
- New `@keyframes`, `animation`, or `animation-name` declarations in the final CSS diff: none.
- The final working-tree audit identified only the previously accumulated gameplay/Rules repair files, the visual CSS file, and evidence records; no new protected-system file was introduced by the final polish.

The build emitted existing non-blocking warnings about Firebase chunking and a large main chunk; these are performance follow-up items, not build failures. Runtime inspection remained limited to the available local shell/route state and did not constitute a live multi-client gameplay or real-device touch proof.

**Final polish status:** PASS for the scoped presentation-only change; real-device validation and publication remain outstanding.
