# Live Match Engine V1 — Architecture Decisions

## Status

These decisions are the current architecture contract for the `live-transition-v1` branch.

## Pipeline

The match engine is layered:

`WORLD → PHYSICS → PERCEPTION → DECISION → INTERACTION → ARBITRATION → RESOLUTION → WORLD`

### WORLD
Authoritative state of the match: 22 players, ball, positions, velocities, possession and other existing world state.

### PHYSICS
Objective, deterministic physical measurements. Physics does not know tactics, roles or decisions.

### PERCEPTION
Player-specific interpretation/filtering of the objective physics state. Perception is subjective to the player.

### DECISION
Player intent. A decision expresses what a player wants to do; it does not directly mutate the world.

### INTERACTION
Detects competing/overlapping decisions and physical interactions.

### ARBITRATION
Resolves conflicts between interactions before state mutation. This includes timing, positional advantage and football-rule consequences such as foul handling.

### RESOLUTION
Applies the resolved outcome to the authoritative world state.

## V1 Physics Contract

The first physics layer is intentionally minimal.

```ts
export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerPhysicsState {
  id: string;
  position: Vector2;
  // Primary state maintained by the movement/world engine; not derived from position deltas.
  velocity: Vector2;
}

export interface BallPhysicsState {
  position: Vector2;
  velocity: Vector2;
}

export interface PairPhysics {
  distance: number;
  relativeSpeed: number;
  closingSpeedAB: number;
  closingSpeedBA: number;
}

export interface PhysicsSnapshot {
  tick: number;
  players: PlayerPhysicsState[];
  ball: BallPhysicsState;
  playerPairs: Map<string, PairPhysics>;
  ballPairs: Map<string, PairPhysics>;
}
```

### Velocity state contract

`PlayerPhysicsState.velocity` is a primary state maintained by the movement/world engine. It is not derived from position differences in the V1 physics snapshot.

Acceleration is not part of V1. If acceleration is introduced later, its derivation from velocity differences will be explicitly documented.

### Deliberate V1 exclusions

The initial physics snapshot does not contain derived concepts that have not yet been implemented and validated:

- acceleration
- lateral speed
- time to contact
- approach angle
- nearest opponent
- pressure density
- space/control metrics

These are added only when a concrete layer requires them.

## Pair Semantics

For every pair:

- `distance >= 0`
- `relativeSpeed >= 0`
- `closingSpeedBA = -closingSpeedAB` structurally
- `abs(closingSpeedAB) <= relativeSpeed` within floating-point tolerance
- no self-pairs

`relativeSpeed` is the symmetric magnitude `|vA - vB|`.

`closingSpeedAB` is the signed radial closing component from A toward B.

The same `PairPhysics` contract is used for player-player and player-ball physics. Ball-specific concepts such as ownership, control quality and spin remain outside `PairPhysics`.

### Coincident-position rule

If two entities occupy the exact same position, the radial direction is undefined. V1 defines `closingSpeed = 0` for this case.

This prevents `0/0` from producing `NaN` and contaminating downstream calculations. The condition remains explicitly represented by `distance = 0`; higher layers may treat coincident entities as a contact/collision situation.

## V1 Computation Policy

`buildPhysicsSnapshot(world)` is evaluated once per simulation tick.

For a normal 22-player match this produces:

- 231 unique player-player pairs: C(22,2)
- 22 player-ball pairs
- 253 pair calculations per tick

No spatial-hash or active-window optimization is introduced in V1. Correctness is prioritized first; optimization is driven by profiling later.

## Closing Speed

The existing deterministic `calculateClosingSpeed` helper remains the source of truth for the initial closing-speed geometry.

When a pair is built, `closingSpeedAB` is calculated once and `closingSpeedBA` is structurally derived as `-closingSpeedAB`; the reverse direction is not independently recalculated.

Closing speed is objective physics data. Different players may interpret the same value differently in the perception/decision layers.

## Validation Requirements

Before connecting the new physics snapshot to tackle resolution, the physics layer must validate:

1. 231 player pairs for 22 players.
2. 22 player-ball pairs.
3. Non-negative distance.
4. Non-negative relative speed.
5. Antisymmetry of closing speed.
6. Closing speed magnitude cannot exceed relative speed.
7. No self-pairs.
8. Same input produces the same snapshot.
9. Deterministic geometry cases: head-on, same-direction chase, perpendicular motion and separation.
10. Shadow comparison against the existing `calculateClosingSpeed` implementation.
11. A single-player world produces zero player pairs and one ball pair.
12. Coincident positions produce `distance = 0` and `closingSpeed = 0`.

## Shadow Comparison

Shadow comparison is a migration-time development/test diagnostic, not a production requirement.

It is enabled only when the explicit `SHADOW_COMPARE`/development flag is active. It compares the legacy closing-speed result with the corresponding `PhysicsSnapshot` pair and records:

```text
physicsShadowComparison:
  totalTackles: N
  matching: N - K
  mismatching: K
  maxDelta: X
```

The new physics snapshot must not replace tackle physics until mismatches are understood and the migration target is verified.

## Integration Strategy

The new physics layer is introduced alongside the existing live/tackle implementation.

The existing tackle system continues to operate while the new snapshot is validated.

During migration, equivalent physics values may be compared in shadow mode. Once validated, consumers are migrated to `PhysicsSnapshot` incrementally.

The tackle win-probability model is not tuned as part of this architecture change. Mechanical correctness is established before statistical calibration.

## Invariants

These are architecture-level invariants:

- `closingSpeedBA === -closingSpeedAB` (structurally enforced)
- `abs(closingSpeedAB) <= relativeSpeed` within floating-point tolerance
- `playerPairs.size === C(n, 2)`
- `ballPairs.size === n`
- no self-pairs
- same world input produces the same snapshot
- coincident positions produce zero closing speed

## Open Questions / V2

These are intentionally deferred:

- acceleration: add when a real consumer requires it; derive from velocity differences and document the exact tick interval
- time to contact: add after tackle-window analysis establishes the need
- approach angle: add when interaction/decision logic requires it
- spatial indexing/active-window optimization: add only after profiling demonstrates a need
- additional pressure, space and control metrics: add when their consuming layer is implemented

## Design Principles

- Do not replace physical calculations with arbitrary probability tuning.
- Do not assign possession directly merely to force an outcome.
- Do not put decision/tactical concepts into the objective physics layer.
- Calculate a physical quantity once per tick/interaction and reuse it downstream.
- Keep layers testable and deterministic where randomness is not part of the layer's responsibility.
- Protect invariants structurally where practical; tests remain required as regression guards.
- Extend contracts minimally when a real consumer requires a new value.
