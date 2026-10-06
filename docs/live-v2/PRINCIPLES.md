# Live-v2 Motor Principles

This document is the canonical engineering contract for the live-v2 football engine.

1. Pure functions: domain logic is input → output and has no hidden global state.
2. Immutable state: a tick returns a new MatchState; input state is never mutated.
3. Small modules: one responsibility per module; split modules that become multi-domain.
4. Explicit contracts: inputs, outputs, invariants, and deterministic ordering are explicit.
5. UI independence: the engine owns simulation state; UI consumes adapter frames only.
6. Deterministic RNG: Math.random() is forbidden; all stochastic decisions consume state.seed.
7. Stable iteration: critical decisions use explicit stable sorting and player.id tie-breaks.
8. Same seed + same input = same complete output.
9. Test-first: new football behavior receives a test before its implementation is considered complete.
10. Regression tests: every corrected defect has a regression invariant.
11. CI GREEN is required before merge.
12. Tests are never weakened to make implementation pass.
13. Every CI run is reported; no result is inferred.
14. Commits represent one hypothesis or one coherent responsibility.
15. No assume-passes: unverified runtime results are not reported as successful.
16. Runtime truth matters: deterministic CI and real runtime evidence are separate acceptance layers.
17. Legacy src/engine/live/* is immutable and is never imported or copied.
18. No temporary runtime patches, fake goals, injected events, or score forcing.
19. Every feature layer is complete before the next layer is accepted.
20. The F3.1 scheduler contract remains 60 ticks/s, 6 ticks/frame, 100ms/frame, 900 frames, 5400 ticks and 90 real seconds.
