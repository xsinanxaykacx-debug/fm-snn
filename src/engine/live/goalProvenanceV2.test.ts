// src/engine/live/goalProvenanceV2.test.ts
//
// Goal provenance V2 — deterministic fixture
//
// Kullanım:
//   $env:RUN_GOAL_PROVENANCE_V2="1"
//   npx vitest run src/engine/live/goalProvenanceV2.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { simulateMatchLive } from './liveMatch';
import {
  installDeterministicRandom,
  DEFAULT_FIXTURE_SEED,
  type DeterministicRandomHandle,
} from './diagnostics/deterministicFixture';
import {
  loadDeterministicFixture,
  cloneFixture,
  type Fixture,
} from './diagnostics/loadFixture';
import { GoalProvenanceDiagnosticV2 } from './diagnostics/goalProvenanceDiagnosticV2';

const MATCH_SEED = 1000;
const MATCH_TICKS = 54_000;

const RUN =
  typeof process !== 'undefined' &&
  process.env.RUN_GOAL_PROVENANCE_V2 === '1';

describe.skipIf(!RUN)('Goal provenance V2 — deterministic fixture', () => {
  let handle: DeterministicRandomHandle;
  let fixture: Fixture;

  beforeEach(() => {
    handle = installDeterministicRandom(DEFAULT_FIXTURE_SEED);
    fixture = loadDeterministicFixture();
  });

  afterEach(() => {
    handle.restore();
  });

  it(
    `fixtureSeed=${DEFAULT_FIXTURE_SEED}, matchSeed=${MATCH_SEED}`,
    () => {
      const { home, away, players } = cloneFixture(fixture);
      const diag = new GoalProvenanceDiagnosticV2();

      const result = simulateMatchLive(home, away, players, {
        seed: MATCH_SEED,
        maxTicks: MATCH_TICKS,
        onTick: state => diag.onTick(state),
      });

      const report = diag.finalize(result.events, result.stats);

      console.log('=== MATCH RESULT ===');
      console.table({
        score: `${result.homeScore}-${result.awayScore}`,
        totalEvents: result.events.length,
      });

      expect(report.summary.totalGoals).toBe(result.homeScore + result.awayScore);
    },
    10 * 60 * 1000
  );
});
