# F3 — live-v2 UI switch

## Scope

F3 switches the live match chain from the legacy engine to live-v2:

`LiveMatchScreen → liveMatch.worker → live-v2`

The UI component was changed only at its worker boundary and seed boundary. No other UI component was changed.

## Seed producer

File: `src/engine/live-v2/adapters/matchSeed.ts`

- `createV2MatchSeed(season, fixture, week)`
- deterministic FNV-1a string hash
- output: `RngState = { seed: uint32 }`
- same input → same seed
- different fixture/week → different seed
- no dependency on the legacy `createMatchSeed`

Tests: 3.

## MatchState factory

File: `src/engine/live-v2/adapters/matchStateFactory.ts`

Input:

- HOME club id + 11 player ids
- AWAY club id + 11 player ids
- v2 `RngState`
- v2 `Pitch`

Output:

- v2 `MatchState`
- exactly 22 players
- 11 HOME + 11 AWAY
- deterministic fixed 4-4-2-style starting slots: GK / 4 DF / 4 MF / 2 FW
- no formation/tactics dependency yet

Tests: 3.

## Worker

File: `src/workers/liveMatch.worker.ts`

The worker now:

1. receives v2-compatible start data;
2. builds/uses the v2 seed;
3. builds MatchState through the v2 factory;
4. executes `runTick(state)` until 5400 ticks;
5. converts every 10th tick to the F2 `toLiveFrame` format;
6. posts the frame directly;
7. retains the existing debug recording boundary;
8. returns a temporary `Match` result until F4 adds proper result/stat parity.

No legacy engine import remains in the worker.

## LiveMatchScreen

File: `src/components/LiveMatchScreen.tsx`

Changes:

- removed legacy `createMatchSeed` import;
- imports `createV2MatchSeed`;
- sends v2 seed, season, fixture and pitch data;
- worker lifecycle and frame listener remain intact;
- `window.__LIVE_MATCH_DEBUG__` remains active and now records v2 LiveFrames.

No other component was modified.

## Debug

The existing debug console remains available:

- `window.dumpLiveMatchDebug()`
- `window.copyLiveMatchDebug()`
- `window.downloadLiveMatchDebug()`

F3 records v2 frame data rather than legacy diagnostic player internals.

## Tests

F2 baseline: 199 tests.

F3 additions:

- match seed: +3
- MatchState factory: +3

Final CI count:

**205/205 tests passed**

CI also reported 49 test files passed.

## CI

| Run | Stage | Result | Evidence |
|---|---|---|---|
| #823 | F3 initial PR validation | FAIL | Build failed: missing `DebugFrame` alias and duplicate `type` spread |
| #824 | F3 corrected PR validation | GREEN | Lint + Build + 205 tests |
| #825 | F3 corrected PR validation duplicate | GREEN | Lint + Build + 205 tests |

#823 failure was corrected without weakening tests.

#824 test duration: 113.36 s.

## Merge

PR: #60

Merge SHA:

`f6b36f5b7eba1ec3d11656d28525c791ac471c69`

Main was verified identical to this SHA after merge.

## Legacy / randomness guard

For the switched F3 chain:

- `src/workers/liveMatch.worker.ts` legacy live-engine imports: **0**
- `src/components/LiveMatchScreen.tsx` legacy live-engine imports: **0**
- `Math.random()` in the switched worker/UI: **0**
- `src/engine/live/*`: untouched
- other UI components: untouched

Repository-wide `Math.random()` was not claimed as zero because unrelated game-state code still contains it; F3 does not modify that code.

## Post-merge main CI

The merge commit itself did not expose a workflow run through the GitHub workflow lookup.

This F3 status document is therefore committed directly on the merged `main` tree to trigger the configured `push: main` validation. That run is the final post-merge main validation gate for F3.

## Status

- F3 implementation: **MERGED**
- PR validation: **GREEN**
- Main merge SHA: `f6b36f5b...`
- Post-merge main CI: **PENDING until independently GREEN**
- F4: **BEKLİYOR**
