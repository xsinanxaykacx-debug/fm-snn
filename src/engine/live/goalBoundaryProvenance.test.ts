import { describe, expect, it, vi } from 'vitest';
import * as eventsModule from './events';
import { simulateMatchLive } from './liveMatch';
import { generateGameData } from '../data/generateData';
import {
  GoalBoundaryProvenanceDiagnostic,
} from './diagnostics/goalBoundaryProvenanceDiagnostic';
import {
  installDeterministicRandom,
  DEFAULT_FIXTURE_SEED,
} from './diagnostics/deterministicFixture';

const FIXTURE_SEED = DEFAULT_FIXTURE_SEED;
const MATCH_SEED = 1000;
const MATCH_TICKS = 54_000;

const RUN =
  typeof process !== 'undefined' &&
  process.env.RUN_GOAL_BOUNDARY_PROVENANCE === '1';

describe.skipIf(!RUN)('Goal Boundary Provenance V3', () => {
  it(
    `fixtureSeed ${FIXTURE_SEED}, matchSeed ${MATCH_SEED}`,
    () => {
      const random = installDeterministicRandom(FIXTURE_SEED);
      const spy = vi.spyOn(eventsModule, 'detectBoundaryOutcome');

      try {
        const data = generateGameData();
        const clubs = Object.values(data.clubs);

        if (clubs.length < 2) {
          throw new Error(
            'Goal Boundary Provenance V3 için en az iki kulüp gerekli.',
          );
        }

        const home = structuredClone(clubs[0]);
        const away = structuredClone(clubs[1]);
        const players = structuredClone(data.players);
        const diagnostic = new GoalBoundaryProvenanceDiagnostic();

        simulateMatchLive(home, away, players, {
          seed: MATCH_SEED,
          maxTicks: MATCH_TICKS,
          onTick: state =>
            diagnostic.onTick(state, spy.mock.calls.length),
        });

        const boundaryCalls = spy.mock.calls.map((call, index) => ({
          input: call[0],
          result: spy.mock.results[index].value,
        }));

        const report = diagnostic.finalize(boundaryCalls);

        expect(report.summary.totalGoals).toBeGreaterThanOrEqual(0);
      },
      10 * 60 * 1000,
    );
  });
});
