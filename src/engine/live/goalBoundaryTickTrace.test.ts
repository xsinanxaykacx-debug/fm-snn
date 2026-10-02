import { describe, it, expect, vi, afterEach } from 'vitest';
import * as eventsModule from './events';
import { simulateMatchLive } from './liveMatch';
import { GoalBoundaryTickTraceDiagnostic } from './diagnostics/goalBoundaryTickTraceDiagnostic';
import {
  installDeterministicRandom,
  DEFAULT_FIXTURE_SEED,
} from './diagnostics/deterministicFixture';
import { generateGameData } from '../data/generateData';

const MATCH_SEED = 1000;
const MATCH_TICKS = 54_000;
const WINDOW = 20;

const RUN =
  typeof process !== 'undefined' &&
  process.env.RUN_GOAL_TICK_TRACE === '1';

describe.skipIf(!RUN)('Goal Boundary Tick Trace V5', () => {
  let spy: ReturnType<typeof vi.spyOn> | null = null;
  let random: ReturnType<typeof installDeterministicRandom> | null = null;

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

  it(`fixtureSeed ${DEFAULT_FIXTURE_SEED}, matchSeed ${MATCH_SEED}`, () => {
    random = installDeterministicRandom(DEFAULT_FIXTURE_SEED);
    spy = vi.spyOn(eventsModule, 'detectBoundaryOutcome');

    const data = generateGameData();
    const clubs = Object.values(data.clubs);
    const home = structuredClone(clubs[0]);
    const away = structuredClone(clubs[1]);
    const players = structuredClone(data.players);

    const diagnostic = new GoalBoundaryTickTraceDiagnostic(WINDOW);

    simulateMatchLive(home, away, players, {
      seed: MATCH_SEED,
      maxTicks: MATCH_TICKS,
      onTick: state => {
        diagnostic.onTick(state, spy!.mock.calls.length);
      },
    });

    const calls = spy.mock.calls.map((call, i) => ({
      input: call[0],
      result: spy!.mock.results[i].value,
    }));

    const report = diagnostic.finalize(calls);

    expect(report.goals.length).toBeGreaterThanOrEqual(0);
  }, 10 * 60 * 1000);
});
