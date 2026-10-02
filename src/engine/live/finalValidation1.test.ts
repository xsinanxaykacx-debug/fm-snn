import { expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

const SEED = 1000;
const MATCH_TICKS = 54_000;
const MATCH_SECONDS = 5_400;

it(
  'tek maç — 90:00 / 54.000 tick',
  () => {
    const baseline = generateGameData();
    const data = structuredClone(baseline);
    const clubs = Object.values(data.clubs);

    expect(clubs.length).toBeGreaterThanOrEqual(2);

    const home = clubs[0];
    const away = clubs[1];

    const startedAt = performance.now();

    const result = simulateMatchLive(
      home,
      away,
      data.players,
      {
        seed: SEED,
        maxTicks: MATCH_TICKS,
      },
    );

    const elapsedMs = performance.now() - startedAt;

    console.log('');
    console.log('=== TEK MAÇ PERFORMANS TESTİ ===');
    console.table({
      seed: SEED,
      ticks: result.stats.ticks,
      expectedTicks: MATCH_TICKS,
      simulationSeconds: result.stats.simulationSeconds,
      expectedSeconds: MATCH_SECONDS,
      elapsedMs: Number(elapsedMs.toFixed(2)),
      elapsedSec: Number((elapsedMs / 1000).toFixed(3)),
      score: `${result.homeScore}-${result.awayScore}`,
      goals: result.homeScore + result.awayScore,
      xG: Number(
        (result.stats.xG.home + result.stats.xG.away).toFixed(4),
      ),
      shots:
        result.stats.shots.home +
        result.stats.shots.away,
      passes:
        result.stats.passes.home +
        result.stats.passes.away,
      passCompletionPct:
        result.stats.passes.home +
        result.stats.passes.away > 0
          ? Number(
              (
                (
                  result.stats.passesCompleted.home +
                  result.stats.passesCompleted.away
                ) /
                (
                  result.stats.passes.home +
                  result.stats.passes.away
                ) *
                100
              ).toFixed(2),
            )
          : 0,
    });

    expect(result.stats.ticks).toBe(MATCH_TICKS);
    expect(result.stats.simulationSeconds).toBe(
      MATCH_SECONDS,
    );
  },
  30 * 60 * 1000,
);
