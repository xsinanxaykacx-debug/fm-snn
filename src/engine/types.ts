export type Position = 'GK' | 'DC' | 'DL' | 'DR' | 'DM' | 'MC' | 'ML' | 'MR' | 'AMC' | 'AML' | 'AMR' | 'ST';

export interface Attributes {
  passing: number;
  firstTouch: number;
  dribbling: number;
  crossing: number;
  shooting: number;
  finishing: number;
  technique: number;
  heading: number;
  setPieces: number;
  longShots: number;

  decisions: number;
  vision: number;
  anticipation: number;
  positioning: number;
  offTheBall: number;
  concentration: number;
  composure: number;
  workRate: number;
  teamwork: number;
  bravery: number;
  aggression: number;

  pace: number;
  acceleration: number;
  agility: number;
  stamina: number;
  strength: number;
  balance: number;

  marking: number;
  tackling: number;
  ballWinning: number;
  defensivePositioning: number;

  goalkeeper: number;
  reflexes: number;
  gkPositioning: number;
  handling: number;
  oneOnOne: number;
  aerialReach: number;
}

export interface CareerStats {
  // Kariyer (hep birikir)
  appearances: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  avgRating: number;
  minutesPlayed: number;
  motm: number;

  // Bu sezon (her sezon sıfırlanır)
  seasonAppearances: number;
  seasonGoals: number;
  seasonAssists: number;
  seasonYellowCards: number;
  seasonRedCards: number;
  seasonAvgRating: number;
  seasonMinutesPlayed: number;
  seasonMotm: number;
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
  fatigue: number;
  wage: number;
  value: number;
  clubId: string | null;
  injuryWeeks: number;
  injuryType: string | null;
  yellowCards: number;
  suspensionWeeks: number;
  sentOff: boolean;
  injured: boolean;
  redCard: boolean;

  careerStats: CareerStats;
}

export type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1';

export interface Tactic {
  formation: Formation;
  mentality: 'defensive' | 'balanced' | 'attacking';
  pressing: 'low' | 'medium' | 'high';
  tempo: 'slow' | 'normal' | 'fast';
  width: 'narrow' | 'normal' | 'wide';
  directness: 'short' | 'mixed' | 'direct';
  defensiveLine: 'deep' | 'normal' | 'high';
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
  lineup?: string[];
}

export interface MatchEvent {
  minute: number;
  type:
    | 'kickoff' | 'halftime' | 'fulltime'
    | 'pass' | 'dribble' | 'cross' | 'counter' | 'shot'
    | 'goal' | 'save' | 'miss' | 'blocked_shot'
    | 'yellow' | 'red' | 'injury' | 'substitution';
  playerId?: string;
  clubId?: string;
  team?: 'home' | 'away';
  description: string;
  xG?: number;
  weeks?: number;
}

export interface MatchStats {
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  onTarget: { home: number; away: number };
  chances: { home: number; away: number };
  xG?: { home: number; away: number };
  passes?: { home: number; away: number };
  passesCompleted?: { home: number; away: number };
  dribbles?: { home: number; away: number };
  dribblesSuccess?: { home: number; away: number };
  crosses?: { home: number; away: number };
  crossesSuccess?: { home: number; away: number };
  dangerousAttacks?: { home: number; away: number };
  recoveries?: { home: number; away: number };
  fouls?: { home: number; away: number };
  yellowCards?: { home: number; away: number };
  redCards?: { home: number; away: number };
}

export interface Match {
  id?: string;
  week?: number;
  homeId?: string;
  awayId?: string;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  stats: MatchStats | any;
  played?: boolean;
  possession?: { home: number; away: number };
  engine?: any;
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
  userLineup: string[];
}

// ═══════════════════════════════════════════════
// TAKIM BİRİMLERİ
// ═══════════════════════════════════════════════

export interface TeamUnits {
  attack: number;
  midfield: number;
  defense: number;
  wings: number;
  transition: number;
  goalkeeper: number;
  overall: number;
}

export interface UnitComparison {
  unit: string;
  icon: string;
  homeValue: number;
  awayValue: number;
  favored: 'home' | 'away' | 'neutral';
  advantagePct: number;
}