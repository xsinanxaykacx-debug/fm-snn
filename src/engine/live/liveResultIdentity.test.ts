import { describe, expect, it } from 'vitest';
import { simulateMatchLive } from './liveMatch';
import { generateGameData } from '../data/generateData';

describe('live fixture identity', () => {
  it('preserves the fixture id supplied by the game UI', () => {
    const { clubs, players } = generateGameData();
    const [homeId, awayId] = Object.keys(clubs).slice(0, 2);
    const home = { ...clubs[homeId], isUser: true };
    const away = { ...clubs[awayId], isUser: false };

    const result = simulateMatchLive(home, away, players, {
      matchId: 's1_w1_home_away',
      maxTicks: 1,
      seed: 1,
    });

    expect(result.id).toBe('s1_w1_home_away');
  });
});
