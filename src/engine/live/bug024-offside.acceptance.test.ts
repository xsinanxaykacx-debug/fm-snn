import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('BUG-024 live offside acceptance', () => {
  it('emits an offside and restarts with a defensive free kick in real live matches', () => {
    const { clubs, players } = generateGameData(20261004);
    const clubList = Object.values(clubs);

    let offsideCount = 0;
    let restartCount = 0;

    for (let i = 0; i < 3; i += 1) {
      const home = clubList[(i * 2) % clubList.length];
      const away = clubList[(i * 2 + 1) % clubList.length];

      const result = simulateMatchLive(home, away, players, {
        week: 10 + i,
        seed: 70000 + i,
      });

      const offsides = result.events.filter(event => event.type === 'offside');
      offsideCount += offsides.length;

      for (const event of offsides) {
        const index = result.events.indexOf(event);
        const restart = result.events[index + 1];
        if (restart?.type === 'free_kick') restartCount += 1;
      }
    }

    expect(offsideCount).toBeGreaterThan(0);
    expect(restartCount).toBe(offsideCount);
  }, 120000);
});
