// src/engine/types.ts

// ═══════════════════════════════════════════════
// MEVKİLER (17 Pozisyon)
// ═══════════════════════════════════════════════

export type Position =
  | 'GK'
  | 'DL' | 'DC' | 'DR'
  | 'WBL' | 'WBR'
  | 'DMC'
  | 'ML' | 'MC' | 'MR'
  | 'AML' | 'AMC' | 'AMR'
  | 'KFL' | 'GF' | 'KFR'
  | 'ST';

export type SlotPosition = Position;

// ═══════════════════════════════════════════════
// SAHA BÖLGELERİ
// ═══════════════════════════════════════════════

export type PitchRow = 'ST' | 'FORVET' | 'ATAKORTA' | 'ORTA' | 'DEFANSIFORTA' | 'DEFANS' | 'GK';
export type PitchCol = 'SOL' | 'SOLORTA' | 'ORTA' | 'SAGORTA' | 'SAG';

export interface PitchZone {
  id: string;
  row: number;
  col: number;
  rowName: PitchRow;
  colName: PitchCol;
  suggestedPosition: SlotPosition;
  playerId: string | null;
  customLabel?: SlotPosition;
}

export interface CustomFormation {
  id: string;
  name: string;
  zones: PitchZone[];
}

// ═══════════════════════════════════════════════
// ATTRIBUTE'LAR
// ═══════════════════════════════════════════════

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

// ═══════════════════════════════════════════════
// KARİYER
// ═══════════════════════════════════════════════

export interface CareerStats {
  appearances: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  avgRating: number;
  minutesPlayed: number;
  motm: number;

  seasonAppearances: number;
  seasonGoals: number;
  seasonAssists: number;
  seasonYellowCards: number;
  seasonRedCards: number;
  seasonAvgRating: number;
  seasonMinutesPlayed: number;
  seasonMotm: number;

  // 🆕 KUPA İSTATİSTİKLERİ
  cupAppearances: number;
  cupGoals: number;
  cupAssists: number;
}

// ═══════════════════════════════════════════════
// OYUNCU
// ═══════════════════════════════════════════════

export interface Player {
  id: string;
  name: string;
  age: number;
  nationality: string;
  position: Position;
  secondaryPositions: Position[];
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
  recentRatings: number[];
  overall: number;

  contractYears: number;
  squadRole: 'first' | 'rotation' | 'backup' | 'u21';
}

// ═══════════════════════════════════════════════
// AKADEMİ
// ═══════════════════════════════════════════════

export interface AcademyPlayer extends Player {
  potential: number;
  potentialStars: number;
  scoutRating: string;
}

export interface AcademyState {
  players: Record<string, AcademyPlayer>;
  lastIntakeSeason: number;
}

// ═══════════════════════════════════════════════
// TAKTİK
// ═══════════════════════════════════════════════

export type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1' | 'CUSTOM';

export interface Tactic {
  formation: Formation;
  mentality: 'defensive' | 'balanced' | 'attacking';
  pressing: 'low' | 'medium' | 'high';
  tempo: 'slow' | 'normal' | 'fast';
  width: 'narrow' | 'normal' | 'wide';
  directness: 'short' | 'mixed' | 'direct';
  defensiveLine: 'deep' | 'normal' | 'high';
}

// ═══════════════════════════════════════════════
// KULÜP
// ═══════════════════════════════════════════════

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
  customFormation?: CustomFormation;
}

// ═══════════════════════════════════════════════
// MAÇ EVENT'LERİ
// ═══════════════════════════════════════════════

export interface MatchEvent {
  minute: number;
  type:
    | 'kickoff' | 'halftime' | 'fulltime'
    | 'pass' | 'dribble' | 'cross' | 'counter' | 'shot'
    | 'goal' | 'save' | 'miss' | 'blocked_shot'
    | 'yellow' | 'red' | 'injury' | 'substitution'
    | 'penalty_shootout';
  playerId?: string;
  clubId?: string;
  team?: 'home' | 'away';
  description: string;
  xG?: number;
  weeks?: number;
}

// ═══════════════════════════════════════════════
// MAÇ İSTATİSTİKLERİ
// ═══════════════════════════════════════════════

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

// ═══════════════════════════════════════════════
// MAÇ
// ═══════════════════════════════════════════════

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

  // 🆕 KUPA MAÇI
  isCup?: boolean;
  cupRound?: CupRound;
  penalties?: {
    home: number;
    away: number;
  };
  winnerId?: string;
}

// ═══════════════════════════════════════════════
// 🆕 KUPA TİPLERİ
// ═══════════════════════════════════════════════

export type CupRound = 'round1' | 'quarter' | 'semi' | 'final';

export interface CupMatch {
  id: string;
  round: CupRound;
  homeId: string;
  awayId: string;
  match: Match | null;
  winnerId: string | null;
}

export interface CupState {
  season: number;
  matches: Record<string, CupMatch>;
  currentRound: CupRound | null;
  champion: string | null;
  rounds: {
    round1: string[];
    quarter: string[];
    semi: string[];
    final: string[];
  };
}

// ═══════════════════════════════════════════════
// PUAN TABLOSU
// ═══════════════════════════════════════════════

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

// ═══════════════════════════════════════════════
// ANTRENMAN
// ═══════════════════════════════════════════════

export type TrainingFocus = 'attack' | 'defense' | 'physical' | 'tactical' | 'balanced';

export interface TrainingState {
  focus: TrainingFocus;
  intensity: 'light' | 'normal' | 'intense';
}

// ═══════════════════════════════════════════════
// OYUN STATE
// ═══════════════════════════════════════════════

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
  assistant: AssistantSettings;
  academy: AcademyState;

  // 🆕 KUPA
  cup: CupState;
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

// ═══════════════════════════════════════════════
// YARDIMCI MENAJER
// ═══════════════════════════════════════════════

export interface AssistantSettings {
  pressConference: boolean;
  training: boolean;
  lineupSuggestion: boolean;
  transferSuggestion: boolean;
  matchAnalysis: boolean;
}

// ═══════════════════════════════════════════════
// MAÇ MOTORU
// ═══════════════════════════════════════════════

export interface AttackSequenceAction {
  minute: number;
  action: 'pass' | 'dribble' | 'cross' | 'throughBall' | 'run' | 'recycle' | 'carry' | 'shot';
  playerId: string;
  playerName: string;
  playerPosition: string;
  fromZone: string;
  toZone: string;
  success: boolean;
  defensePressure: number;
  spaceCreated: number;
  description: string;
}

export interface AttackSequence {
  attackingClubId: string;
  defendingClubId: string;
  startedZone: string;
  finalZone: string;
  actions: AttackSequenceAction[];
  totalActions: number;
  finalPressure: number;
  spaceCreated: number;
  chanceQuality: number;
  resultedInShot: boolean;
  resultedInGoal: boolean;
  xG: number;
}

// ═══════════════════════════════════════════════
// SÖZLEŞME
// ═══════════════════════════════════════════════

export interface ContractOffer {
  playerId: string;
  playerName: string;
  currentWage: number;
  offeredWage: number;
  currentYears: number;
  offeredYears: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}