import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('BUG-020 live scoring acceptance', () => {
  it('restores non-zero live scoring across real 0-to-90 matches', () => {
    const { clubs, players } = generateGameData(20261004);
    const clubList = Object.values(clubs);

    let totalGoals = 0;
    let totalShots = 0;
    let matchesWithGoals = 0;

    for (let i = 0; i < 10; i += 1) {
      const home = clubList[(i * 2) % clubList.length];
      const away = clubList[(i * 2 + 1) % clubList.length];

      const result = simulateMatchLive(home, away, players, {
        week: 20 + i,
        seed: 82000 + i,
      });

      totalGoals += result.homeScore + result.awayScore;
      totalShots += result.stats.shots.home + result.stats.shots.away;

      if (result.homeScore + result.awayScore > 0) {
        matchesWithGoals += 1;
      }
    }

    const averageGoals = totalGoals / 10;

    expect(totalShots).toBeGreaterThan(0);
    expect(totalGoals).toBeGreaterThan(5);
    expect(averageGoals).toBeGreaterThan(0.5);
    expect(matchesWithGoals).toBeGreaterThan(2);
  }, 120000);
});
