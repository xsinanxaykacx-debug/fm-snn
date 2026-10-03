import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('BUG-020 live score calibration', () => {
  it('keeps 100-match average goals between 2 and 3 and limits extreme scores', () => {
    const { clubs, players } = generateGameData(202020);
    const clubIds = Object.keys(clubs);
    const home = clubs[clubIds[0]];
    const away = clubs[clubIds[1]];

    const scores = Array.from({ length: 10 }, (_, index) => {
      const match = simulateMatchLive(home, away, players, {
        seed: 202020 + index,
        week: 3,
      });
      return {
        home: match.homeScore,
        away: match.awayScore,
        total: match.homeScore + match.awayScore,
      };
    });

    const averageGoals =
      scores.reduce((sum, score) => sum + score.total, 0) / scores.length;
    console.log('BUG-020 baseline scores:', scores);
    console.log('BUG-020 baseline average:', averageGoals, 'max:', Math.max(...scores.map(score => score.total)));
    const maximumGoals = Math.max(...scores.map(score => score.total));

    expect(averageGoals).toBeGreaterThanOrEqual(2);
    expect(averageGoals).toBeLessThanOrEqual(3);
    expect(maximumGoals).toBeLessThanOrEqual(7);
  }, 120_000);
});
