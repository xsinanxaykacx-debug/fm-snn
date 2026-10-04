import { describe, expect, it } from 'vitest';

import type { Player, Tactic } from '../types';
import {
  createSetPiece,
  selectTaker,
  updateSetPiece,
} from './setPieces';
import { DEFAULT_PITCH_DIMENSIONS } from './pitch';

const tactic: Tactic = {
  formation: '4-4-2',
  mentality: 'balanced',
  pressing: 'medium',
  tempo: 'normal',
  width: 'normal',
  directness: 'mixed',
  defensiveLine: 'normal',
};

function makePlayer(
  id: string,
  position: Player['position'],
  clubId: string
): Player {
  return {
    id,
    name: id,
    age: 25,
    nationality: 'TR',
    position,
    secondaryPositions: [],
    attributes: {
      passing: 12, firstTouch: 12, dribbling: 12, crossing: 12,
      shooting: 12, finishing: 12, technique: 12, heading: 12,
      setPieces: 12, longShots: 12, decisions: 12, vision: 12,
      anticipation: 12, positioning: 12, offTheBall: 12,
      concentration: 12, composure: 12, workRate: 12, teamwork: 12,
      bravery: 12, aggression: 12, pace: 12, acceleration: 12,
      agility: 12, stamina: 12, strength: 12, balance: 12,
      marking: 12, tackling: 12, ballWinning: 12,
      defensivePositioning: 12, goalkeeper: 12, reflexes: 12,
      gkPositioning: 12, handling: 12, oneOnOne: 12, aerialReach: 12,
    },
    condition: 100,
    morale: 100,
    form: 100,
    fatigue: 0,
    wage: 1000,
    value: 100000,
    clubId,
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
    overall: 70,
    contractYears: 2,
    squadRole: 'first',
  };
}

function makePlayers(): Record<string, Player> {
  const players: Record<string, Player> = {};
  for (let i = 1; i <= 10; i += 1) {
    players[`h${i}`] = makePlayer(
      `h${i}`,
      i === 1 ? 'GK' : i === 2 ? 'ST' : 'MC',
      'home'
    );
    players[`a${i}`] = makePlayer(
      `a${i}`,
      i === 1 ? 'GK' : i === 2 ? 'ST' : 'MC',
      'away'
    );
  }
  return players;
}

describe('BUG-025 live set-piece coverage', () => {
  it.each([
    'kickoff',
    'goal_kick',
    'corner',
    'throw_in',
    'free_kick',
    'penalty',
  ] as const)('creates a valid %s state with a taker and required players', type => {
    const players = makePlayers();
    const home = Object.fromEntries(
      Object.entries(players).filter(([, p]) => p.clubId === 'home')
    );
    const away = Object.fromEntries(
      Object.entries(players).filter(([, p]) => p.clubId === 'away')
    );

    const state = createSetPiece({
      pitch: DEFAULT_PITCH_DIMENSIONS,
      type,
      teamSide: 'HOME',
      ballPosition: { x: 52, y: 32 },
      takerTeamPlayers: home,
      defenderTeamPlayers: away,
      takerTactic: tactic,
      defenderTactic: tactic,
    });

    expect(state.takerId).not.toBeNull();
    expect(state.requiredPlayerIds).toContain(state.takerId);
    expect(state.status).toBe('positioning');

    for (const position of Object.values(state.targetPositions)) {
      expect(position.x).toBeGreaterThanOrEqual(0);
      expect(position.x).toBeLessThanOrEqual(DEFAULT_PITCH_DIMENSIONS.length);
      expect(position.y).toBeGreaterThanOrEqual(0);
      expect(position.y).toBeLessThanOrEqual(DEFAULT_PITCH_DIMENSIONS.width);
    }
  });

  it('selects the goalkeeper for a goal kick', () => {
    const players = makePlayers();
    expect(selectTaker('goal_kick', players)).toBe('h1');
  });

  it('times out positioning into ready state instead of getting stuck', () => {
    const players = makePlayers();
    const home = Object.fromEntries(
      Object.entries(players).filter(([, p]) => p.clubId === 'home')
    );
    const away = Object.fromEntries(
      Object.entries(players).filter(([, p]) => p.clubId === 'away')
    );

    const state = createSetPiece({
      pitch: DEFAULT_PITCH_DIMENSIONS,
      type: 'free_kick',
      teamSide: 'HOME',
      ballPosition: { x: 52, y: 32 },
      takerTeamPlayers: home,
      defenderTeamPlayers: away,
      takerTactic: tactic,
      defenderTactic: tactic,
    });

    const next = updateSetPiece(
      state,
      {},
      30
    );

    expect(next.status).toBe('ready');
  });
});
