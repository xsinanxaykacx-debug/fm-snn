export type Position = 'GK' | 'DC' | 'DL' | 'DR' | 'MC' | 'ML' | 'MR' | 'ST';

export interface Attributes {
  pace: number;
  passing: number;
  shooting: number;
  defending: number;
  physical: number;
  mental: number;
  goalkeeping: number;
}

export interface Player {
  id: string;
  name: string;
  age: number;
  nationality: string;
  position: Position;
  attributes: Attributes;
  condition: number;
  morale: number;
  form: number;
  wage: number;
  value: number;
  clubId: string | null;
  injuryWeeks: number;
  injuryType: string | null;
  yellowCards: number;
  suspensionWeeks: number;
}

export type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1';

export interface Tactic {
  formation: Formation;
  mentality: 'defensive' | 'balanced' | 'attacking';
  pressing: 'low' | 'medium' | 'high';
  tempo: 'slow' | 'normal' | 'fast';
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  budget: number;
  wageBudget: number;
  stadiumCapacity: number;
  reputation: number;
  formation: Formation;
  tactic: Tactic;
  isUser: boolean;
}

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'yellow' | 'red' | 'injury' | 'chance' | 'save' | 'miss';
  playerId?: string;
  clubId: string;
  description: string;
}

export interface MatchStats {
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  onTarget: { home: number; away: number };
  chances: { home: number; away: number };
}

export interface Match {
  id: string;
  week: number;
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  stats: MatchStats;
  played: boolean;
}

export interface TableRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
}

export type TrainingFocus = 'attack' | 'defense' | 'physical' | 'tactical' | 'balanced';

export interface TrainingState {
  focus: TrainingFocus;
  intensity: 'light' | 'normal' | 'intense';
}

export interface GameState {
  season: number;
  currentWeek: number;
  userClubId: string;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  fixtures: Match[];
  table: Record<string, TableRow>;
  transferList: string[];
  news: string[];
  seasonOver: boolean;
  training: TrainingState;
}