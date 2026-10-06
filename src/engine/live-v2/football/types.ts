import type { TeamSide, Vec2 } from '../state';

export type Role =
  | 'GK' | 'DR' | 'DL' | 'WBR' | 'WBL' | 'DC' | 'DMC' | 'MC' | 'MR' | 'ML'
  | 'AMC' | 'AML' | 'AMR' | 'GF' | 'ST' | 'KFL' | 'KFR';

export type RoleCategory = 'GK' | 'DEF' | 'MID' | 'ATT';
export const ROLE_CATEGORY: Record<Role, RoleCategory> = {
  GK:'GK', DR:'DEF', DL:'DEF', WBR:'DEF', WBL:'DEF', DC:'DEF',
  DMC:'MID', MC:'MID', MR:'MID', ML:'MID',
  AMC:'ATT', AML:'ATT', AMR:'ATT', GF:'ATT', ST:'ATT', KFL:'ATT', KFR:'ATT',
};
export type FormationName = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1';
export type Mentality = 'defensive' | 'balanced' | 'attacking';
export type Pressing = 'low' | 'medium' | 'high';
export type Tempo = 'slow' | 'normal' | 'fast';
export type Width = 'narrow' | 'normal' | 'wide';
export type Directness = 'short' | 'mixed' | 'direct';
export type DefensiveLine = 'deep' | 'normal' | 'high';
export type Tactics = { mentality:Mentality; pressing:Pressing; tempo:Tempo; width:Width; directness:Directness; defensiveLine:DefensiveLine };
export type PlayerAttributes = {
  passing:number; firstTouch:number; dribbling:number; crossing:number; shooting:number; finishing:number;
  decisions:number; vision:number; anticipation:number; positioning:number; offTheBall:number; composure:number;
  workRate:number; aggression:number; pace:number; acceleration:number; stamina:number; strength:number;
  tackling:number; marking:number; ballWinning:number; goalkeeper:number; reflexes:number; gkPositioning:number; handling:number;
};
export type PlayerMatchStats = {
  shots:number; shotsOnTarget:number; goals:number; assists:number; keyPasses:number; passes:number; successfulPasses:number;
  tackles:number; interceptions:number; fouls:number; yellow:number; red:number; saves:number; dribbles:number; minutes:number; xG:number;
};
export type TeamMatchStats = {
  shots:number; shotsOnTarget:number; goals:number; xG:number; passes:number; successfulPasses:number;
  tackles:number; interceptions:number; fouls:number; corners:number; throwIns:number; goalKicks:number; freeKicks:number;
  penalties:number; offsides:number; possessionTicks:number;
};
export type FootballEventType =
  | 'kickoff' | 'half_time' | 'full_time' | 'goal' | 'own_goal' | 'penalty_goal'
  | 'shot' | 'shot_on_target' | 'shot_off_target' | 'save' | 'blocked_shot'
  | 'pass' | 'key_pass' | 'assist' | 'dribble' | 'tackle' | 'intercept'
  | 'foul' | 'yellow' | 'red' | 'penalty' | 'offside' | 'corner' | 'throw_in'
  | 'goal_kick' | 'free_kick' | 'injury' | 'substitution';
export type FootballEvent = {
  id:string; type:FootballEventType; minute:number; tick:number; playerId?:string; teamId?:TeamSide;
  relatedPlayerId?:string; description:string; xG?:number; position?:Vec2;
};
export type FormationSlot = { role:Role; position:Vec2 };
export type FootballState = {
  formation:{HOME:FormationName;AWAY:FormationName};
  tactics:{HOME:Tactics;AWAY:Tactics};
  maxSubstitutions:3; substitutionsUsed:{HOME:number;AWAY:number}; kickoffSide:TeamSide;
  actionCooldowns:Record<string,number>;
  passSnapshot:Record<string,{tick:number;position:Vec2;receiverId:string}>;
  events:FootballEvent[]; playerStats:Record<string,PlayerMatchStats>;
  teamStats:Record<TeamSide,TeamMatchStats>; lastAssistBySide:{HOME:string|null;AWAY:string|null};
};
