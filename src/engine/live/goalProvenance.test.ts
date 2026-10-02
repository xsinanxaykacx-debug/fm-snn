// src/engine/live/goalProvenance.test.ts
//
// Goal provenance diagnostic — B
//
// Kullanım:
//   $env:RUN_GOAL_PROVENANCE="1"
//   npx vitest run src/engine/live/goalProvenance.test.ts
//
// Production koduna dokunmaz.

import { describe, it, expect } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';
import { GoalProvenanceDiagnostic } from './diagnostics/goalProvenanceDiagnostic';

const SEED = 1000;
const MATCH_TICKS = 54_000;

const RUN =
  typeof process !== 'undefined' &&
  process.env.RUN_GOAL_PROVENANCE === '1';

describe.skipIf(!RUN)('Goal provenance diagnostic B', () => {
  it(`seed ${SEED} — goal provenance`, () => {
    const data = generateGameData();
    const clubs = Object.values(data.clubs);

    if (clubs.length < 2) {
      throw new Error('Goal provenance diagnostic için en az iki kulüp gerekli.');
    }

    const home = structuredClone(clubs[0]);
    const away = structuredClone(clubs[1]);
    const clonedPlayers = structuredClone(data.players);

    const diagnostic = new GoalProvenanceDiagnostic();

    const result = simulateMatchLive(
      home,
      away,
      clonedPlayers,
      {
        seed: SEED,
        maxTicks: MATCH_TICKS,
        onTick: state => diagnostic.onTick(state),
      }
    );

    const report = diagnostic.finalize(
      result.events,
      result.stats
    );

    console.log('=== MATCH RESULT ===');
    console.table({
      score: `${result.homeScore}-${result.awayScore}`,
      ticks: MATCH_TICKS,
      totalEvents: result.events.length,
    });

    expect(report.accounting.totalGoals).toBe(
      report.summary.totalGoals
    );
  }, 10 * 60 * 1000);
});
