import { describe, expect, it } from 'vitest';

import {
  resolveBreakAction,
  resolveCounterPress,
} from './actionResolution';

import type {
  LiveMatchState,
  LivePlayer,
  Tactic,
} from '../types';

function attributes(overrides: Partial<LivePlayer['player']['attributes']> = {}) {
  return {
    passing: 70,
    firstTouch: 70,
    dribbling: 70,
    crossing: 60,
    shooting: 65,
    finishing: 65,
    technique: 70,
    heading: 60,
    setPieces: 50,
    longShots: 60,
    decisions: 75,
    vision: 75,
    anticipation: 75,
    positioning: 75,
    offTheBall: 75,
    concentration: 75,
    composure: 75,
    workRate: 85,
    teamwork: 80,
    bravery: 75,
    aggression: 75,
    pace: 85,
    acceleration: 85,
    agility: 80,
    stamina: 85,
    strength: 75,
    balance: 80,
    marking: 75,
    tackling: 80,
    ballWinning: 80,
    defensivePositioning: 80,
    goalkeeper: 10,
    reflexes: 10,
    gkPositioning: 10,
    handling: 10,
    oneOnOne: 10,
    aerialReach: 10,
    ...overrides,
  };
}

function player(
  id: string,
  clubId: string,
  isHome: boolean,
  x: number,
  y: number,
  role: LivePlayer['role'],
  overrides: Partial<LivePlayer['player']['attributes']> = {},
  condition = 100
): LivePlayer {
  return {
    player: {
      id,
      name: id,
      age: 25,
      nationality: 'TR',
      position: role === 'GK' ? 'GK' : 'MC',
      secondaryPositions: [],
      attributes: attributes(overrides),
      condition,
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
        appearances: 0,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        avgRating: 0,
        minutesPlayed: 0,
        motm: 0,
        seasonAppearances: 0,
        seasonGoals: 0,
        seasonAssists: 0,
        seasonYellowCards: 0,
        seasonRedCards: 0,
        seasonAvgRating: 0,
        seasonMinutesPlayed: 0,
        seasonMotm: 0,
        cupAppearances: 0,
        cupGoals: 0,
        cupAssists: 0,
      },
      recentRatings: [],
      overall: 75,
      contractYears: 3,
      squadRole: 'first',
    },
    position: { x, y },
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
    homePosition: { x, y },
    maxSpeed: 7,
    acceleration: 20,
  };
}

function state(
  players: Record<string, LivePlayer>,
  homeTactic?: Tactic,
  awayTactic?: Tactic
): LiveMatchState {
  return {
    players,
    home: {
      club: { id: 'HOME', tactic: homeTactic ?? {
        formation: '4-3-3',
        mentality: 'balanced',
        pressing: 'medium',
        tempo: 'normal',
        width: 'normal',
        directness: 'mixed',
        defensiveLine: 'normal',
      } },
    } as LiveMatchState['home'],
    away: {
      club: { id: 'AWAY', tactic: awayTactic ?? {
        formation: '4-3-3',
        mentality: 'balanced',
        pressing: 'medium',
        tempo: 'normal',
        width: 'normal',
        directness: 'mixed',
        defensiveLine: 'normal',
      } },
    } as LiveMatchState['away'],
  } as LiveMatchState;
}

describe('Live transition resolution', () => {
  it('high pressing and proximity increase counter-press probability', () => {
    const p = player('p1', 'HOME', true, 51, 32, 'CM', {
      tackling: 90,
      anticipation: 90,
      positioning: 85,
      workRate: 95,
      aggression: 85,
    });

    const s = state(
      { p },
      {
        formation: '4-3-3',
        mentality: 'balanced',
        pressing: 'high',
        tempo: 'normal',
        width: 'normal',
        directness: 'mixed',
        defensiveLine: 'high',
      }
    );

    const near = resolveCounterPress([p], { x: 52, y: 32 }, s);
    const far = resolveCounterPress([p], { x: 68, y: 32 }, s);

    expect(near.probability).toBeGreaterThan(far.probability);
    expect(near.playerId).toBe('p1');
  });

  it('defensive line changes counter-press probability monotonically', () => {
    const p = player('p1', 'HOME', true, 51, 32, 'CM', {
      tackling: 90,
      anticipation: 90,
      positioning: 85,
      workRate: 95,
      aggression: 85,
    });

    const high = resolveCounterPress(
      [p],
      { x: 52, y: 32 },
      state(
        { p },
        {
          formation: '4-3-3',
          mentality: 'balanced',
          pressing: 'medium',
          tempo: 'normal',
          width: 'normal',
          directness: 'mixed',
          defensiveLine: 'high',
        }
      )
    );

    const normal = resolveCounterPress(
      [p],
      { x: 52, y: 32 },
      state(
        { p },
        {
          formation: '4-3-3',
          mentality: 'balanced',
          pressing: 'medium',
          tempo: 'normal',
          width: 'normal',
          directness: 'mixed',
          defensiveLine: 'normal',
        }
      )
    );

    const deep = resolveCounterPress(
      [p],
      { x: 52, y: 32 },
      state(
        { p },
        {
          formation: '4-3-3',
          mentality: 'balanced',
          pressing: 'medium',
          tempo: 'normal',
          width: 'normal',
          directness: 'mixed',
          defensiveLine: 'deep',
        }
      )
    );

    expect(high.probability).toBeGreaterThan(normal.probability);
    expect(normal.probability).toBeGreaterThan(deep.probability);
  });

  it('break quality responds to tempo, directness, role and condition', () => {
    const fast = player('p1', 'HOME', true, 52, 32, 'W', {
      pace: 95,
      acceleration: 95,
      offTheBall: 90,
      decisions: 90,
    }, 100);

    const tired = player('p2', 'HOME', true, 52, 32, 'W', {
      pace: 95,
      acceleration: 95,
      offTheBall: 90,
      decisions: 90,
    }, 55);

    const s = state(
      { p1: fast, p2: tired },
      {
        formation: '4-3-3',
        mentality: 'attacking',
        pressing: 'high',
        tempo: 'fast',
        width: 'wide',
        directness: 'direct',
        defensiveLine: 'high',
      }
    );

    const fastBreak = resolveBreakAction(fast, s);
    const tiredBreak = resolveBreakAction(tired, s);

    expect(fastBreak.quality).toBeGreaterThan(tiredBreak.quality);
    expect(fastBreak.probability).toBeGreaterThan(tiredBreak.probability);
  });

  it('counter-press ignores the goalkeeper as a pressing runner', () => {
    const gk = player('gk', 'HOME', true, 51, 32, 'GK', {
      tackling: 99,
      anticipation: 99,
      positioning: 99,
      workRate: 99,
    });

    const result = resolveCounterPress(
      [gk],
      { x: 51, y: 32 },
      state({ gk })
    );

    expect(result.playerId).toBeNull();
    expect(result.probability).toBe(0.05);
  });
});
