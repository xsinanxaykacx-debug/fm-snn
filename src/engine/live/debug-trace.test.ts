import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('BUG-020 boundary debug', () => {
  it('T167-T170 boundary trace', () => {
    const data = generateGameData(20261004);
    const clubs = Object.values(data.clubs);
    const home = clubs[0];
    const away = clubs[1];
    simulateMatchLive(home, away, data.players, {
      seed: 100000,
      week: 1,
      onTick: (_state) => {},
    });
  }, 120000);
});
