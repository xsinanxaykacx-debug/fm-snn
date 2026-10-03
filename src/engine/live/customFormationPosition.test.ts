import { describe, expect, it } from 'vitest';

import { getStartingXI } from '../data/generateData';
import { createEmptyZones } from '../formation/zones';
import type { Player } from '../types';

function player(id: string): Player {
  return {
    id,
    name: id,
    age: 25,
    nationality: 'TR',
    position: 'MC',
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

describe('Custom formation starting XI', () => {
  it('reads all 11 players from zones in deterministic row/col order', () => {
    const players = Object.fromEntries(
      Array.from({ length: 11 }, (_, index) => {
        const id = `player-${index + 1}`;
        return [id, player(id)];
      })
    );

    const zones = createEmptyZones();
    zones.slice(0, 11).forEach((zone, index) => {
      zone.playerId = `player-${index + 1}`;
    });

    const xi = getStartingXI(
      'club-1',
      players,
      'CUSTOM',
      undefined,
      { id: 'custom-1', name: 'Test', zones }
    );

    expect(xi).toHaveLength(11);
    expect(xi.map(p => p.id)).toEqual(
      zones
        .slice(0, 11)
        .sort((a, b) => a.row - b.row || a.col - b.col)
        .map(zone => zone.playerId)
    );
  });
});
