import { describe, expect, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('BUG-020 shot runtime debug', () => {
  it('runs the deterministic T167-T170 window and emits shot/boundary evidence', () => {
    const data = generateGameData(20261004);
    const clubs = Object.values(data.clubs);
    const home = clubs[0];
    const away = clubs[1];
    const seen: number[] = [];

    const match = simulateMatchLive(home, away, data.players, {
      seed: 100000,
      week: 1,
      onTick: state => {
        if (state.tick >= 167 && state.tick <= 170) {
          seen.push(state.tick);
        }
      },
    });

    expect(seen).toEqual([167, 168, 169, 170]);
    expect(match.stats.shots.home + match.stats.shots.away).toBeGreaterThan(0);
  }, 120000);
});
