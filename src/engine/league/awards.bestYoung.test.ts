import { describe, expect, it } from 'vitest';

import { calculateSeasonAwards } from './awards';
import type { GameState, Player } from '../types';

function youngCandidate(
  id: string,
  age: number,
  appearances: number,
  rating: number
): Player {
  return {
    id,
    name: id,
    age,
    nationality: 'TR',
    position: 'ST',
    secondaryPositions: [],
    attributes: {} as Player['attributes'],
    condition: 100,
    morale: 100,
    form: 100,
    fatigue: 0,
    wage: 0,
    value: 0,
    clubId: 'club-1',
    injuryWeeks: 0,
    injuryType: null,
    yellowCards: 0,
    suspensionWeeks: 0,
    sentOff: false,
    injured: false,
    redCard: false,
    careerStats: {
      appearances,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      avgRating: rating,
      minutesPlayed: appearances * 90,
      motm: 0,
      seasonAppearances: appearances,
      seasonGoals: 0,
      seasonAssists: 0,
      seasonYellowCards: 0,
      seasonRedCards: 0,
      seasonAvgRating: rating,
      seasonMinutesPlayed: appearances * 90,
      seasonMotm: 0,
      cupAppearances: 0,
      cupGoals: 0,
      cupAssists: 0,
    },
    recentRatings: [],
    overall: 10,
    contractYears: 1,
    squadRole: 'rotation',
  };
}

describe('calculateSeasonAwards — best young', () => {
  it('enforces all three best young eligibility thresholds', () => {
    const state = {
      season: 1,
      userClubId: 'club-1',
      clubs: {
        'club-1': { id: 'club-1', name: 'Test', isUser: true },
      },
      players: {
        eligible: youngCandidate('eligible', 23, 3, 7.0),
        tooOld: youngCandidate('tooOld', 24, 20, 9.5),
        tooFew: youngCandidate('tooFew', 20, 2, 9.8),
      },
      table: {
        'club-1': { clubId: 'club-1', points: 0 },
      },
    } as unknown as GameState;

    const award = calculateSeasonAwards(state).find(a => a.id === 'best_young');

    expect(award?.winnerId).toBe('eligible');
  });
});
