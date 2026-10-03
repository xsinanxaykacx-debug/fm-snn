import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('BUG-020 live score calibration', () => {
  it('keeps 100 neutral live matches within a football-realistic goal range', () => {
    const { clubs, players } = generateGameData(20261003);
    const home = clubs.club_1;
    const away = clubs.club_14;
    expect(home?.name).toBe('İstanbul FK');
    expect(away?.name).toBe('Milano Inter');

    const scores: number[] = [];
    for (let i = 0; i < 100; i += 1) {
      const match = simulateMatchLive(home, away, players, { seed: 9000 + i });
      scores.push(match.homeScore + match.awayScore);
    }

    const average = scores.reduce((sum, goals) => sum + goals, 0) / scores.length;
    const max = Math.max(...scores);

    console.log(JSON.stringify({ average, max, scores }));

    expect(average).toBeGreaterThanOrEqual(2);
    expect(average).toBeLessThanOrEqual(3);
    expect(max).toBeLessThanOrEqual(7);
  }, 120_000);
});
