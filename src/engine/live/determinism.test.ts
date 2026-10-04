import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('BUG-021 live engine determinism', () => {
  it('produces the same score and event stream for the same seed', () => {
    const first = generateGameData(20261004);
    const second = generateGameData(20261004);

    const home1 = first.clubs.club_1;
    const away1 = first.clubs.club_14;
    const home2 = second.clubs.club_1;
    const away2 = second.clubs.club_14;

    expect(home1).toBeDefined();
    expect(away1).toBeDefined();
    expect(home2).toBeDefined();
    expect(away2).toBeDefined();

    const match1 = simulateMatchLive(home1, away1, first.players, {
      seed: 424242,
      week: 6,
    });
    const match2 = simulateMatchLive(home2, away2, second.players, {
      seed: 424242,
      week: 6,
    });

    expect(match2.homeScore).toBe(match1.homeScore);
    expect(match2.awayScore).toBe(match1.awayScore);
    expect(match2.events).toEqual(match1.events);
  }, 120_000);
});
