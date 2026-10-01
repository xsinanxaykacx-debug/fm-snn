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
- `closingSpeedBA = -closingSpeedAB` within floating-point tolerance
- `abs(closingSpeedAB) <= relativeSpeed` within floating-point tolerance
- no self-pairs

`relativeSpeed` is the symmetric magnitude `|vA - vB|`.

`closingSpeedAB` is the signed radial closing component from A toward B.

The same `PairPhysics` contract is used for player-player and player-ball physics. Ball-specific concepts such as ownership, control quality and spin remain outside `PairPhysics`.

## V1 Computation Policy

`buildPhysicsSnapshot(world)` is evaluated once per simulation tick.

For a normal 22-player match this produces:

- 231 unique player-player pairs: C(22,2)
- 22 player-ball pairs
- 253 pair calculations per tick

No spatial-hash or active-window optimization is introduced in V1. Correctness is prioritized first; optimization is driven by profiling later.

## Closing Speed

The existing deterministic `calculateClosingSpeed` helper remains the source of truth for the initial closing-speed geometry.

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

## Integration Strategy

The new physics layer is introduced alongside the existing live/tackle implementation.

The existing tackle system continues to operate while the new snapshot is validated.

During migration, equivalent physics values may be compared in shadow mode. Once validated, consumers are migrated to `PhysicsSnapshot` incrementally.

The tackle win-probability model is not tuned as part of this architecture change. Mechanical correctness is established before statistical calibration.

## Design Principles

- Do not replace physical calculations with arbitrary probability tuning.
- Do not assign possession directly merely to force an outcome.
- Do not put decision/tactical concepts into the objective physics layer.
- Calculate a physical quantity once per tick/interaction and reuse it downstream.
- Keep layers testable and deterministic where randomness is not part of the layer's responsibility.
- Extend contracts minimally when a real consumer requires a new value.
