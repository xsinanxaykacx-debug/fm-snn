# Live Motor Inventory — pre-live-v2

## 1. Scope

The existing live engine is preserved unchanged. live-v2 is a parallel implementation under `src/engine/live-v2/`.

This document is an inventory of the legacy responsibilities and the planned v2 replacement boundaries.

## 2. Legacy module inventory

| Responsibility | Current module | Current role / risk | v2 replacement |
|---|---|---|---|
| Match loop / tick progression | `src/engine/live/liveMatch.ts` | Owns too many phases and orchestration decisions | Explicit phase pipeline / reducer |
| Match state | `src/engine/types.ts`, `LiveMatchState` | Shared mutable state shape coupled to legacy flow | `src/engine/live-v2/state.ts` |
| Ball physics | `src/engine/live/ball.ts` | Physics and match-flow assumptions can interact | Pure ball-physics step |
| Player movement | `src/engine/live/movement.ts` | Player positions can escape pitch bounds | `live-v2/movement.ts`, clamp before commit |
| Perception | `src/engine/live/perception.ts` | Repeated spatial work can make ticks expensive | Read-only perception snapshot |
| Decisions | `src/engine/live/decision.ts` | Decision logic coupled to live state orchestration | Pure decision module |
| Tackles | `src/engine/live/tackle.ts` | Tackle result mutates/feeds several concerns | Pure tackle/event resolver |
| Boundary rules | `src/engine/live/events.ts` | Boundary detection depends on crossing history and fallback recovery | `live-v2/boundary.ts`, total pure resolver |
| Set pieces | `src/engine/live/setPieces.ts` | Restart semantics spread across flow | Explicit restart state machine |
| Action probability | `src/engine/live/actionResolution.ts` | Action resolution mixed with simulation context | Pure action resolver + injected RNG |
| Discipline | `src/engine/live/discipline.ts` | Foul/card side effects cross responsibilities | Pure foul/card event resolver |
| RNG | `src/engine/live/rng.ts` | Randomness can leak into low-level helpers | One seeded RNG dependency at decision boundaries |
| Worker/UI bridge | `src/workers/liveMatch.worker.ts`, `LiveMatchScreen.tsx` | Presentation/runtime bridge can hide engine failures | Thin adapter only |

## 3. Known failure classes in the legacy design

1. Boundary detection depends on an inside-to-outside crossing being observed.
2. `recoverOutsideCrossing()` is a safety patch for missed boundary state.
3. `applyBoundaryOutcome()` can act as another fallback layer.
4. Player movement can produce positions outside the pitch.
5. Long integration tests can hit the 120-second Vitest timeout.
6. The tick pipeline contains many responsibilities, making stalls difficult to localize.
7. Boundary semantics are coupled to orchestration instead of being a total function.

## 4. v2 invariants

- The legacy engine is not modified.
- live-v2 imports nothing from `src/engine/live/*`.
- Boundary resolution is total for finite positions.
- No boundary result requires a previously successful boundary-detection call.
- Player positions are bounded before state commit.
- A tick has explicit phases and a finite transition budget.
- Deterministic modules produce identical output for identical input.
- Randomness is injected only where domain decisions require it.
- Every subsystem can be unit-tested without running a 90-minute match.
- Runtime diagnostics expose tick, phase, ball position and velocity.

## 5. v2 migration map

### Gate 1 — pure foundations

1. `state.ts`
2. `boundary.ts`
3. `movement.ts`
4. ball physics
5. restart transitions
6. seeded RNG

### Gate 2 — short deterministic simulations

Run 10 s, 60 s, 5 min, 45 min and 90 min simulations.

Each run must have:
- an explicit execution budget;
- a progress assertion;
- no player outside the pitch;
- no impossible restart state;
- deterministic replay for the same seed/input.

### Gate 3 — full match acceptance

A 90-minute run must reach `full_time` and produce:
- a valid event sequence;
- bounded player positions;
- a valid ball/restart state;
- deterministic replay;
- diagnostics identifying the last completed tick/phase.

### Gate 4 — statistical calibration

Only after correctness:
- goals;
- shots;
- xG;
- possession;
- fouls/cards;
- movement;
- tactical effects.

Statistical tuning must not be used to hide state-machine defects.

## 6. Migration strategy

The application will select the engine through one adapter/feature flag:

`legacy | v2`

The legacy engine remains available and untouched until v2 acceptance gates are met. No v2 module should import a legacy implementation to make a test pass.
