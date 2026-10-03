import { describe, expect, it } from 'vitest';

import { resolveShotAction } from './actionResolution';
import type { LiveMatchState, LivePlayer } from '../types';

function makeAttributes(value: number) {
  return {
    passing: value,
    firstTouch: value,
    dribbling: value,
    crossing: value,
    shooting: value,
    finishing: value,
    technique: value,
    heading: value,
    setPieces: value,
    longShots: value,
    decisions: value,
    vision: value,
    anticipation: value,
    positioning: value,
    offTheBall: value,
    concentration: value,
    composure: value,
    workRate: value,
    teamwork: value,
    bravery: value,
    aggression: value,
    pace: value,
    acceleration: value,
    agility: value,
    stamina: value,
    strength: value,
    balance: value,
    marking: value,
    tackling: value,
    ballWinning: value,
    defensivePositioning: value,
    goalkeeper: value,
    reflexes: value,
    gkPositioning: value,
    handling: value,
    oneOnOne: value,
    aerialReach: value,
  };
}

function makePlayer(
  id: string,
  clubId: string,
  isHome: boolean,
  role: LivePlayer['role'],
  goalkeeper: boolean,
): LivePlayer {
  return {
    player: {
      id,
      name: id,
      age: 25,
      nationality: 'TR',
      position: goalkeeper ? 'GK' : 'ST',
      secondaryPositions: [],
      attributes: makeAttributes(75),
      condition: 100,
      morale: 100,
      form: 100,
      fatigue: 0,
      wage: 0,
      value: 0,
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
        avgRating: 0, minutesPlayed: 0, motm: 0, seasonAppearances: 0,
        seasonGoals: 0, seasonAssists: 0, seasonYellowCards: 0,
        seasonRedCards: 0, seasonAvgRating: 0, seasonMinutesPlayed: 0,
        seasonMotm: 0, cupAppearances: 0, cupGoals: 0, cupAssists: 0,
      },
      recentRatings: [],
      overall: 75,
      contractYears: 3,
      squadRole: 'first',
    },
    position: { x: isHome ? 85 : 95, y: 32 },
    velocity: { x: 0, y: 0 },
    facing: isHome ? 0 : 180,
    nextDecisionTime: 0,
    currentDecision: null,
    currentIntent: 'idle',
    isBallOwner: false,
    isChasingBall: false,
    isMarking: null,
    clubId,
    isHome,
    role,
    homePosition: { x: isHome ? 85 : 95, y: 32 },
    maxSpeed: 7,
    acceleration: 20,
  };
}

function makeState(shooter: LivePlayer, goalkeeper: LivePlayer): LiveMatchState {
  return {
    players: {
      [shooter.player.id]: shooter,
      [goalkeeper.player.id]: goalkeeper,
    },
    decisions: {
      [shooter.player.id]: {
        selected: { successProbability: 0.8 },
      },
    },
    home: {
      club: {
        id: 'HOME',
        tactic: {
          formation: '4-3-3',
          mentality: 'balanced',
          pressing: 'medium',
          tempo: 'normal',
          width: 'normal',
          directness: 'mixed',
          defensiveLine: 'normal',
        },
      },
    },
    away: {
      club: {
        id: 'AWAY',
        tactic: {
          formation: '4-3-3',
          mentality: 'balanced',
          pressing: 'medium',
          tempo: 'normal',
          width: 'normal',
          directness: 'mixed',
          defensiveLine: 'normal',
        },
      },
    },
  } as unknown as LiveMatchState;
}

describe('Live shot / goalkeeper separation', () => {
  it('xG is a property of the shot, not of goalkeeper skill', () => {
    const shooter = makePlayer('ST', 'HOME', true, 'ST', false);
    const weakKeeper = makePlayer('GK1', 'AWAY', false, 'GK', true);
    const strongKeeper = makePlayer('GK2', 'AWAY', false, 'GK', true);

    weakKeeper.player.attributes = {
      ...weakKeeper.player.attributes,
      goalkeeper: 40,
      reflexes: 40,
      gkPositioning: 40,
      handling: 40,
      oneOnOne: 40,
    };

    strongKeeper.player.attributes = {
      ...strongKeeper.player.attributes,
      goalkeeper: 95,
      reflexes: 95,
      gkPositioning: 95,
      handling: 95,
      oneOnOne: 95,
    };

    const weak = resolveShotAction(
      shooter,
      { intent: 'shoot', reason: 'shoot', target: { x: 104, y: 32 }, targetPlayerId: null, power: 1, timestamp: 0 },
      makeState(shooter, weakKeeper),
    );

    const strong = resolveShotAction(
      shooter,
      { intent: 'shoot', reason: 'shoot', target: { x: 104, y: 32 }, targetPlayerId: null, power: 1, timestamp: 0 },
      makeState(shooter, strongKeeper),
    );

    expect(strong.xG).toBeCloseTo(weak.xG, 10);
    expect(strong.probability).toBeLessThan(weak.probability);
  });
});
