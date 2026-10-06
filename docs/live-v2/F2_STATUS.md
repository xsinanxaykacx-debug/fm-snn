# F2 — live-v2 UI frame adapter

## Scope

F2 adds a pure adapter from the live-v2 `MatchState` to the frame shape expected by the existing live-match UI boundary.

UI integration is deliberately deferred to F3.

## Adapter

- File: `src/engine/live-v2/adapters/liveFrame.ts`
- Function: `toLiveFrame(state, tick, time)`
- Pure function; no side effects.
- Does not mutate `MatchState`.
- Deterministic; no `Math.random()`.
- No UI imports.
- No legacy-engine imports.

## UI frame contract extracted

`LiveFrame` requires:

- `type: 'frame'`
- `time`
- `tick`
- `phase`
- `score.home` / `score.away`
- `ball.x/y/z`
- `ball.vx/vy`
- `ball.ownerId`
- `ball.lastTouchId`
- `players[]` with `id`, `x`, `y`, `isHome`, `facing`, `intent`

The UI worker sends `type: 'frame'` messages and the screen consumes the frame fields above. F2 does not modify that worker or the screen.

## Missing-field decisions

### facing

Decision: **derive in the adapter**.

Formula:

`Math.atan2(player.velocity.y, player.velocity.x)`

Rationale: facing is presentation state that can be deterministically derived from the v2 velocity. No MatchState expansion is needed.

For zero velocity, JavaScript's `Math.atan2(0, 0)` yields `0`, giving a stable deterministic value.

### intent

Decision: **do not read diagnostics and do not add per-player intent to MatchState in F2**.

The v2 `MatchState` does not retain the per-player `DecisionResult`; `decide()` returns decisions separately. `diagnostics.lastDecisionAction` is a single last action, not a per-player decision, so using it for every frame player would be semantically incorrect.

The adapter therefore emits the explicit deterministic sentinel `UNKNOWN`.

A later v2 decision/frame design can carry a real per-player decision without enlarging MatchState merely for this UI compatibility field.

### lastTouchId

Decision: **map directly**.

`MatchState.ball.lastTouchId` already exists and has the exact required nullable player-id semantics.

## Tests

File: `src/engine/live-v2/adapters/liveFrameAdapter.test.ts`

9 acceptance tests:

1. 22 players → 22 frame players
2. HOME/AWAY mapping
3. player coordinates
4. ball position/velocity/owner/lastTouchId
5. score and time/tick
6. determinism
7. immutability
8. facing derivation
9. explicit UNKNOWN intent

CI #820 on PR #59 passed:

- 47 test files
- **199 tests passed**
- test duration: **135.03 s**
- lint: pass, 0 errors
- build: pass

F1 baseline was 190 total tests; F2 adds 9 tests → **199 total tests**.

## Merge

- Branch: `feat/live-v2-ui-adapter`
- PR: #59
- PR merge SHA: `d5f932ae7a2d596a0443257abc135879608dea80`
- Pre-merge validation: CI #820 GREEN
- Post-merge main CI: **not independently observable yet through the GitHub workflow-run lookup for merge SHA `d5f932ae7a2d596a0443257abc135879608dea80`**.

The main push workflow is configured for `main`, so this is an evidence gap rather than a claim that no workflow exists. F3 remains blocked until a post-merge main GREEN run is independently verified.

## Scope guard

Compare `45b34e1d200995c55fe74b9a50407dc2d1099706` → `d5f932ae7a2d596a0443257abc135879608dea80` contains only:

- `src/engine/live-v2/adapters/liveFrame.ts`
- `src/engine/live-v2/adapters/liveFrameAdapter.test.ts`

No `src/components/*` files changed.

No `src/engine/live/*` files changed.

## Status

- F2 implementation: **MERGED**
- PR validation: **GREEN**
- Post-merge main CI: **PENDING / NOT YET VERIFIED**
- F2 overall gate: **BEKLİYOR**
- F3: **BEKLİYOR**
