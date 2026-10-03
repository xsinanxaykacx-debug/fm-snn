import { describe, expect, it } from 'vitest';

import { calculateTeamUnits } from './teamUnits';
import type { Club, Player } from '../types';

const club: Club = {
  id: 'club-1',
  name: 'Test',
  shortName: 'TST',
  budget: 0,
  wageBudget: 0,
  stadiumCapacity: 0,
  reputation: 50,
  formation: '4-3-3',
  tactic: {
    formation: '4-3-3',
    mentality: 'balanced',
    pressing: 'medium',
    tempo: 'normal',
    width: 'normal',
    directness: 'mixed',
    defensiveLine: 'normal',
  },
  isUser: true,
};

function player(id: string, position: Player['position']): Player {
  const attributes = Object.fromEntries(
    [
      'passing', 'firstTouch', 'dribbling', 'crossing', 'shooting', 'finishing',
      'technique', 'heading', 'setPieces', 'longShots', 'decisions', 'vision',
      'anticipation', 'positioning', 'offTheBall', 'concentration', 'composure',
      'workRate', 'teamwork', 'bravery', 'aggression', 'pace', 'acceleration',
      'agility', 'stamina', 'strength', 'balance', 'marking', 'tackling',
      'ballWinning', 'defensivePositioning', 'goalkeeper', 'reflexes',
      'gkPositioning', 'handling', 'oneOnOne', 'aerialReach',
    ].map(key => [key, 10])
  ) as Player['attributes'];

  return {
    id,
    name: id,
    age: 25,
    nationality: 'TR',
    position,
    secondaryPositions: [],
    attributes,
    condition: 100,
    morale: 100,
    form: 100,
    fatigue: 0,
    wage: 0,
    value: 0,
    clubId: club.id,
    injuryWeeks: 0,
    injuryType: null,
    yellowCards: 0,
    suspensionWeeks: 0,
    sentOff: false,
    injured: false,
    redCard: false,
    careerStats: {
      appearances: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0,
      avgRating: 0, minutesPlayed: 0, motm: 0,
      seasonAppearances: 0, seasonGoals: 0, seasonAssists: 0,
      seasonYellowCards: 0, seasonRedCards: 0, seasonAvgRating: 0,
      seasonMinutesPlayed: 0, seasonMotm: 0,
      cupAppearances: 0, cupGoals: 0, cupAssists: 0,
    },
    recentRatings: [],
    overall: 10,
    contractYears: 1,
    squadRole: 'rotation',
  };
}

describe('POSITION_GROUPS.MID', () => {
  it('includes DMC and excludes the invalid DM position', () => {
    const players = {
      dmc: player('dmc', 'DMC'),
    };

    const units = calculateTeamUnits(club, players);
    expect(units.midfield).toBeGreaterThan(40);
  });
});
