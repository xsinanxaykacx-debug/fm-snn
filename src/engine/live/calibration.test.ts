import { describe, expect, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('BUG-020 live scoring calibration', () => {
  it('keeps the 100-match average total goals between 2 and 3', () => {
    const { clubs, players } = generateGameData(20261004);
    const clubList = Object.values(clubs);

    const totalGoals = Array.from({ length: 100 }, (_, i) => {
      const home = clubList[(i * 2) % clubList.length];
      const away = clubList[(i * 2 + 1) % clubList.length];

      const match = simulateMatchLive(home, away, players, {
        week: 20,
        seed: 100000 + i,
      });
      return match.homeScore + match.awayScore;
    }).reduce((sum, goals) => sum + goals, 0);

    const averageGoals = totalGoals / 100;

    expect(averageGoals).toBeGreaterThanOrEqual(2);
    expect(averageGoals).toBeLessThanOrEqual(3);
  });
});
