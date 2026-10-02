// src/engine/live/goalBoundaryRawTrace.test.ts
//
// Goal Boundary Raw Trace V6 — test harness
//
// Kullanım:
//   $env:RUN_GOAL_RAW_TRACE="1"
//   npx vitest run src/engine/live/goalBoundaryRawTrace.test.ts

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as eventsModule from './events';
import { simulateMatchLive } from './liveMatch';
import { GoalBoundaryRawTraceDiagnostic } from './diagnostics/goalBoundaryRawTraceDiagnostic';
import {
  installDeterministicRandom,
  DEFAULT_FIXTURE_SEED,
  type DeterministicRandomHandle,
} from './diagnostics/deterministicFixture';
import { generateGameData } from '../data/generateData';

const MATCH_SEED = 1000;
const MATCH_TICKS = 54_000;

const TARGET_GOAL_INDEX = 46;
const LOOKBACK = 200;
const LOOKAHEAD = 20;

const RUN =
  typeof process !== 'undefined' &&
  process.env.RUN_GOAL_RAW_TRACE === '1';

describe.skipIf(!RUN)('Goal Boundary Raw Trace V6', () => {
  let spy: ReturnType<typeof vi.spyOn> | null = null;
  let random: DeterministicRandomHandle | null = null;

  afterEach(() => {
    if (spy) {
      spy.mockRestore();
      spy = null;
    }
    if (random) {
      random.restore();
      random = null;
    }
  });

  it(
    `target=#${TARGET_GOAL_INDEX}, fixtureSeed=${DEFAULT_FIXTURE_SEED}, matchSeed=${MATCH_SEED}`,
    () => {
      random = installDeterministicRandom(DEFAULT_FIXTURE_SEED);
      spy = vi.spyOn(eventsModule, 'detectBoundaryOutcome');

      const data = generateGameData();
      const clubs = Object.values(data.clubs);
      const home = structuredClone(clubs[0]);
      const away = structuredClone(clubs[1]);
      const players = structuredClone(data.players);

      const diag = new GoalBoundaryRawTraceDiagnostic(
        TARGET_GOAL_INDEX,
        LOOKBACK,
        LOOKAHEAD
      );

      simulateMatchLive(home, away, players, {
        seed: MATCH_SEED,
        maxTicks: MATCH_TICKS,
        onTick: state => diag.onTick(state, spy!.mock.calls.length),
      });

      const calls = spy.mock.calls.map((call, i) => ({
        input: call[0],
        result: spy!.mock.results[i].value,
      }));

      const report = diag.finalize(calls);
      expect(report.boundaryTick).not.toBeNull();
    },
    10 * 60 * 1000
  );
});
