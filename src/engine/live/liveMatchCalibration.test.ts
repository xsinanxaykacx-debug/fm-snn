import { describe, expect, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

const MATCHES = 5;
const MATCH_TICKS = 54_000;

describe('live match calibration measurement', () => {
  it('runs several complete matches and reports aggregate behavior', () => {
    const baseline = generateGameData();
    const rows: Array<Record<string, number | string>> = [];

    for (let i = 0; i < MATCHES; i += 1) {
      const data = structuredClone(baseline);
      const clubs = Object.values(data.clubs);
      const result = simulateMatchLive(clubs[0], clubs[1], data.players, {
        seed: 1000 + i,
        maxTicks: MATCH_TICKS,
      });

      const shots = result.stats.shots.home + result.stats.shots.away;
      const passes = result.stats.passes.home + result.stats.passes.away;
      const completed =
        result.stats.passesCompleted.home +
        result.stats.passesCompleted.away;

      rows.push({
        seed: 1000 + i,
        score: result.homeScore + '-' + result.awayScore,
        goals: result.homeScore + result.awayScore,
        xG: Number((result.stats.xG.home + result.stats.xG.away).toFixed(3)),
        shots,
        onTarget: result.stats.onTarget.home + result.stats.onTarget.away,
        passes,
        passCompletionPct: passes > 0 ? Number((completed / passes * 100).toFixed(1)) : 0,
        ticks: result.stats.ticks,
      });

      expect(result.stats.ticks).toBe(MATCH_TICKS);
      expect(result.stats.simulationSeconds).toBeCloseTo(5400, 6);

      const totalOnTarget =
        result.stats.onTarget.home +
        result.stats.onTarget.away;

      // Shot on target is a subset of recorded shots. Own goals are
      // deliberately excluded from shot/on-target attribution.
      expect(totalOnTarget).toBeLessThanOrEqual(shots);
    }

    console.log('=== LIVE MATCH CALIBRATION SAMPLE ===');
    console.table(rows);

    const totalGoals = rows.reduce((sum, row) => sum + Number(row.goals), 0);
    const totalXG = rows.reduce((sum, row) => sum + Number(row.xG), 0);
    const totalShots = rows.reduce((sum, row) => sum + Number(row.shots), 0);
    const totalPasses = rows.reduce((sum, row) => sum + Number(row.passes), 0);

    console.log({
      matches: MATCHES,
      avgGoals: totalGoals / MATCHES,
      avgXG: totalXG / MATCHES,
      avgShots: totalShots / MATCHES,
      avgPasses: totalPasses / MATCHES,
    });

    expect(rows).toHaveLength(MATCHES);
    expect(rows.every(row => Number.isFinite(Number(row.xG)))).toBe(true);
  }, 10 * 60 * 1000);
});
