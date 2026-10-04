import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('BUG-020 runtime debug', () => {
  it('traces first live out-of-bounds candidates', () => {
    const { clubs, players } = generateGameData(20261004);
    const clubList = Object.values(clubs);
    const home = clubList[0];
    const away = clubList[1];

    simulateMatchLive(home, away, players, {
      week: 20,
      seed: 100000,
      onTick: () => {},
    });
  }, 120000);
});
