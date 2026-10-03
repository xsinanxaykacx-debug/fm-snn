import { describe, expect, it } from 'vitest';
import { simulateMatchLive } from './liveMatch';
import type { Club, Player } from '../types';

function fixtureClub(id: string, isUser: boolean): Club {
  return {
    id,
    name: id,
    shortName: id,
    isUser,
    reputation: 10,
    budget: 0,
    formation: '4-4-2',
    tactic: {
      formation: '4-4-2',
      mentality: 'balanced',
      pressing: 'balanced',
      tempo: 'normal',
      width: 'balanced',
      passing: 'mixed',
      defensiveLine: 'balanced',
    },
  } as Club;
}

describe('live fixture identity', () => {
  it('preserves the fixture id supplied by the game UI', () => {
    const home = fixtureClub('home', true);
    const away = fixtureClub('away', false);
    const players = {} as Record<string, Player>;

    const result = simulateMatchLive(home, away, players, {
      matchId: 's1_w1_home_away',
      maxTicks: 1,
      seed: 1,
    });

    expect(result.id).toBe('s1_w1_home_away');
  });
});
