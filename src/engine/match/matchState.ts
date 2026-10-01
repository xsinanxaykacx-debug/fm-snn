import type { Club } from '../types';
import type { TeamAnalysis } from './teamAnalysis';

export interface TeamMatchState {
  club: Club;
  analysis: TeamAnalysis;
  score: number;
  condition: number;
  momentum: number;
  mentality: 'defensive' | 'balanced' | 'attacking';
  tempo: 'slow' | 'normal' | 'fast';
  pressing: 'low' | 'medium' | 'high';
  width: 'narrow' | 'normal' | 'wide';
  directness: 'short' | 'mixed' | 'direct';
  defensiveLine: 'deep' | 'normal' | 'high';
  redCards: number;
  yellowCards: number;
  shots: number;
  onTarget: number;
  xG: number;
  passes: number;
  passesCompleted: number;
  dribbles: number;
  dribblesSuccess: number;
  crosses: number;
  crossesSuccess: number;
  dangerousAttacks: number;
  recoveries: number;
  turnovers: number;
  injuredPlayers?: string[];
}

export interface MatchState {
  minute: number;
  home: TeamMatchState;
  away: TeamMatchState;
  homeScore: number;
  awayScore: number;
  possessionTeam: 'home' | 'away';
  ballZone: string;
  events: any[];
  possessionCount: { home: number; away: number };
  sequences: any[];
  userLineup?: string[];
}

export function createTeamMatchState(
  club: Club,
  analysis: TeamAnalysis
): TeamMatchState {
  return {
    club,
    analysis,
    score: 0,
    condition: 100,
    momentum: 0,
    mentality: club.tactic.mentality,
    tempo: club.tactic.tempo,
    pressing: club.tactic.pressing,
    width: club.tactic.width,
    directness: club.tactic.directness,
    defensiveLine: club.tactic.defensiveLine,
    redCards: 0,
    yellowCards: 0,
    shots: 0,
    onTarget: 0,
    xG: 0,
    passes: 0,
    passesCompleted: 0,
    dribbles: 0,
    dribblesSuccess: 0,
    crosses: 0,
    crossesSuccess: 0,
    dangerousAttacks: 0,
    recoveries: 0,
    turnovers: 0,
  };
}

export function updateDynamicTactics(state: MatchState): void {
  const { minute, homeScore, awayScore, home, away } = state;

  const isLate = minute > 70;

  if (homeScore < awayScore) {
    if (isLate) {
      home.mentality = 'attacking';
      home.tempo = 'fast';
      home.pressing = 'high';
      home.defensiveLine = 'high';
    }
    home.momentum = Math.min(100, home.momentum + 3);
    away.momentum = Math.max(-100, away.momentum - 2);
  } else if (homeScore > awayScore) {
    if (isLate) {
      home.mentality = 'defensive';
      home.tempo = 'slow';
      home.pressing = 'low';
      home.defensiveLine = 'deep';
    }
    home.momentum = Math.min(100, home.momentum + 1);
    away.momentum = Math.max(-100, away.momentum - 3);
  }

  if (awayScore < homeScore) {
    if (isLate) {
      away.mentality = 'attacking';
      away.tempo = 'fast';
      away.pressing = 'high';
      away.defensiveLine = 'high';
    }
    away.momentum = Math.min(100, away.momentum + 3);
    home.momentum = Math.max(-100, home.momentum - 2);
  } else if (awayScore > homeScore) {
    if (isLate) {
      away.mentality = 'defensive';
      away.tempo = 'slow';
      away.pressing = 'low';
      away.defensiveLine = 'deep';
    }
    away.momentum = Math.min(100, away.momentum + 1);
    home.momentum = Math.max(-100, home.momentum - 3);
  }

  if (home.redCards > 0) {
    home.mentality = 'defensive';
    home.defensiveLine = 'deep';
  }
  if (away.redCards > 0) {
    away.mentality = 'defensive';
    away.defensiveLine = 'deep';
  }
}

export function consumeCondition(state: MatchState): void {
  const homeFatigue = calcFatigue(state.home);
  const awayFatigue = calcFatigue(state.away);

  state.home.condition = Math.max(40, state.home.condition - homeFatigue);
  state.away.condition = Math.max(40, state.away.condition - awayFatigue);
}

function calcFatigue(team: TeamMatchState): number {
  let fatigue = 1.0;

  if (team.pressing === 'high') fatigue += 0.5;
  else if (team.pressing === 'low') fatigue -= 0.2;

  if (team.tempo === 'fast') fatigue += 0.4;
  else if (team.tempo === 'slow') fatigue -= 0.2;

  if (team.mentality === 'attacking') fatigue += 0.3;
  else if (team.mentality === 'defensive') fatigue -= 0.1;

  fatigue += Math.abs(team.momentum) / 300;

  return fatigue;
}

export function calculatePossession(state: MatchState): { home: number; away: number } {
  const total = state.possessionCount.home + state.possessionCount.away;
  if (total === 0) return { home: 50, away: 50 };

  const homePct = Math.round((state.possessionCount.home / total) * 100);
  return { home: homePct, away: 100 - homePct };
}