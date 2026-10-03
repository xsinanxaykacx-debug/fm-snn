import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('BUG-020 live score calibration', () => {
  it('keeps 100 neutral live matches within a football-realistic goal range', () => {
    const { clubs, players } = generateGameData(20261003);
    const clubIds = Object.keys(clubs).slice(0, 2);
    const home = clubs[clubIds[0]];
    const away = clubs[clubIds[1]];

    const scores: number[] = [];
    for (let i = 0; i < 100; i += 1) {
      const match = simulateMatchLive(home, away, players, { seed: 9000 + i });
      scores.push(match.homeScore + match.awayScore);
    }

    const average = scores.reduce((sum, goals) => sum + goals, 0) / scores.length;
    const max = Math.max(...scores);

    expect(average).toBeGreaterThanOrEqual(2);
    expect(average).toBeLessThanOrEqual(3);
    expect(max).toBeLessThanOrEqual(7);
  }, 120_000);
});
