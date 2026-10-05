# Live-v2 Design

## Goal

Build a second live match engine from a small explicit state machine instead of repairing the existing large orchestration path.

The first target is correctness and observability, not visual or statistical parity.

## Architecture

input data -> MatchState -> perception -> decisions -> movement intent -> bounded movement -> ball physics -> event detection -> restart transition -> next MatchState

## Tick contract

1. Validate current state.
2. Read perception.
3. Produce decisions.
4. Produce movement intents.
5. Clamp player movement to the legal pitch domain.
6. Advance ball physics.
7. Resolve football events.
8. Apply restart/set-piece transition.
9. Advance clock.
10. Emit diagnostics.
11. Commit the next state.

No stage may silently mutate another stage's state.

## Boundary contract

boundary.ts is a total pure function.

It must:
- detect normal inside-to-outside crossings
- detect already-outside positions directly
- choose the nearest violated boundary deterministically if both endpoints are outside
- interpolate crossing z for a goal-line segment crossing
- use current z when recovery is from an already-outside position
- return one explicit football event or no event
- use no RNG and no match minute
- mutate no state
- require no caller-side recovery helper

## MatchState

The root state contains clock, phase, pitch, score, ball, players, teams, restart, event sequence and diagnostics. Positions and velocities must be finite. Player positions are legal pitch coordinates at commit time.

## Player movement invariant

Every committed player satisfies 0 <= x <= pitch.length and 0 <= y <= pitch.width. A movement target may be outside; the commit layer clamps or rejects it before writing state.

## Ball invariant

The ball may cross the boundary during physics. Boundary resolution immediately converts the crossing into a football event. A dead ball cannot remain in live-play state after the event transition.

## Feature flag

The UI/worker uses one adapter with kind = legacy or v2. The adapter is the only integration point. Existing engine modules are untouched.

## Acceptance gates

### Gate 1 — Pure modules
Boundary, movement bounds, ball physics, restart and RNG tests.

### Gate 2 — Short simulations
10 s, 60 s, 5 min, 45 min and 90 min. Each has a hard execution budget and progress assertion.

### Gate 3 — Full match
Reaches full_time; no player leaves pitch; no live ball remains after restart resolution; event sequence is consistent; identical seed/input produces identical output.

### Gate 4 — Statistical calibration
Only after correctness gates pass: goals, shots, xG, possession, cards/fouls and movement. Calibration must not hide correctness failures.