# Live Motor Inventory — pre-live-v2

The existing live engine is preserved unchanged. This inventory maps responsibilities before designing live-v2.

| Responsibility | Current location | v2 decision |
|---|---|---|
| Match loop / tick progression | src/engine/live/liveMatch.ts | Explicit phase pipeline |
| Match state | src/engine/types.ts via LiveMatchState | New live-v2/types.ts |
| Ball physics | src/engine/live/ball.ts | Isolated physics step |
| Player movement | src/engine/live/movement.ts | Bounded movement step |
| Perception | src/engine/live/perception.ts | Read-only perception snapshot |
| Decisions | src/engine/live/decision.ts | New decision layer |
| Tackles | src/engine/live/tackle.ts | Event resolver |
| Boundary rules | src/engine/live/events.ts | New boundary.ts; no caller fallback |
| Set pieces | src/engine/live/setPieces.ts | Explicit restart state machine |
| Action probability | src/engine/live/actionResolution.ts | New action resolver |
| Discipline | src/engine/live/discipline.ts | New foul/card resolver |
| RNG | src/engine/live/rng.ts | Single seeded RNG dependency |
| Worker/UI bridge | src/workers/liveMatch.worker.ts and LiveMatchScreen.tsx | Adapter only |

## Known failure classes

1. Boundary detection depends on inside-to-outside crossing history.
2. recoverOutsideCrossing() is a safety patch for missed boundary state.
3. applyBoundaryOutcome() has been used as a second fallback layer.
4. Player movement can produce positions outside the pitch.
5. Long integration tests can reach the 120-second Vitest timeout.
6. The tick pipeline contains many responsibilities, making stalls hard to localize.
7. Boundary semantics are coupled to orchestration rather than represented as a total function.

## v2 invariants

- The old engine is not modified.
- live-v2 has no imports from src/engine/live.
- Boundary resolution is total for every finite ball state.
- No boundary outcome depends on a previous successful boundary detection.
- Player movement is bounded before state commit.
- A tick has explicit phases and a finite transition budget.
- Every state transition is deterministic for a supplied seed.
- Every subsystem can be unit-tested without running a 90-minute match.
- Runtime diagnostics expose tick, phase, ball position and velocity.

## Migration

The application selects the engine through one adapter/feature flag. The old engine remains available and untouched until v2 acceptance criteria are met.