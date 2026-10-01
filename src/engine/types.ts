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

export type PitchRow =
  | 'ST'
  | 'FORVET'
  | 'ATAKORTA'
  | 'ORTA'
  | 'DEFANSIFORTA'
  | 'DEFANS'
  | 'GK';

export type PitchCol =
  | 'SOL'
  | 'SOLORTA'
  | 'ORTA'
  | 'SAGORTA'
  | 'SAG';

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
// SAHA GEOMETRİSİ (LIVE + FROZEN ORTAK)
// ═══════════════════════════════════════════════

export interface PitchDimensions {
  length: number;
  width: number;

  goalWidth: number;
  goalHeight: number;
  postRadius: number;

  penaltyAreaDepth: number;
  penaltyAreaWidth: number;

  goalAreaDepth: number;
  goalAreaWidth: number;

  penaltySpotDistance: number;
  centerCircleRadius: number;
  cornerArcRadius: number;
}

// ═══════════════════════════════════════════════
// VEKTÖRLER
// ═══════════════════════════════════════════════

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// ═══════════════════════════════════════════════
// ATTRIBUTE'LAR
// ═══════════════════════════════════════════════

export interface Attributes {
  // Teknik
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

  // Zihinsel
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

  // Fiziksel
  pace: number;
  acceleration: number;
  agility: number;
  stamina: number;
  strength: number;
  balance: number;

  // Savunma
  marking: number;
  tackling: number;
  ballWinning: number;
  defensivePositioning: number;

  // Kaleci
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

export type Formation =
  | '4-4-2'
  | '4-3-3'
  | '3-5-2'
  | '4-2-3-1'
  | 'CUSTOM';

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
    | 'kickoff'
    | 'halftime'
    | 'fulltime'
    | 'pass'
    | 'dribble'
    | 'cross'
    | 'counter'
    | 'shot'
    | 'goal'
    | 'save'
    | 'miss'
    | 'blocked_shot'
    | 'yellow'
    | 'red'
    | 'injury'
    | 'substitution'
    | 'penalty_shootout'
    | 'corner'
    | 'throw_in'
    | 'goal_kick'
    | 'free_kick'
    | 'penalty'
    | 'offside'
    | 'foul';

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
  possession: {
    home: number;
    away: number;
  };

  shots: {
    home: number;
    away: number;
  };

  onTarget: {
    home: number;
    away: number;
  };

  chances: {
    home: number;
    away: number;
  };

  xG?: {
    home: number;
    away: number;
  };

  passes?: {
    home: number;
    away: number;
  };

  passesCompleted?: {
    home: number;
    away: number;
  };

  dribbles?: {
    home: number;
    away: number;
  };

  dribblesSuccess?: {
    home: number;
    away: number;
  };

  crosses?: {
    home: number;
    away: number;
  };

  crossesSuccess?: {
    home: number;
    away: number;
  };

  dangerousAttacks?: {
    home: number;
    away: number;
  };

  recoveries?: {
    home: number;
    away: number;
  };

  fouls?: {
    home: number;
    away: number;
  };

  yellowCards?: {
    home: number;
    away: number;
  };

  redCards?: {
    home: number;
    away: number;
  };

  // LIVE MOTOR
  corners?: {
    home: number;
    away: number;
  };

  throwIns?: {
    home: number;
    away: number;
  };

  goalKicks?: {
    home: number;
    away: number;
  };

  offsides?: {
    home: number;
    away: number;
  };
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

  stats: MatchStats;

  played?: boolean;

  possession?: {
    home: number;
    away: number;
  };

  engine?: any;

  isCup?: boolean;
  cupRound?: CupRound;

  penalties?: {
    home: number;
    away: number;
  };

  winnerId?: string;

  sequences?: AttackSequence[];
}

// ═══════════════════════════════════════════════
// KUPA TİPLERİ
// ═══════════════════════════════════════════════

export type CupRound =
  | 'round1'
  | 'quarter'
  | 'semi'
  | 'final';

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

export type TrainingFocus =
  | 'attack'
  | 'defense'
  | 'physical'
  | 'tactical'
  | 'balanced';

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
// MAÇ MOTORU — ATTACK SEQUENCE (FROZEN)
// ═══════════════════════════════════════════════

export interface AttackSequenceAction {
  minute: number;

  action:
    | 'pass'
    | 'dribble'
    | 'cross'
    | 'throughBall'
    | 'run'
    | 'recycle'
    | 'carry'
    | 'shot';

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

  shotTaken?: boolean;

  shotOutcome?:
    | 'goal'
    | 'save'
    | 'miss'
    | 'blocked';

  shotOnTarget?: boolean;
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

  status:
    | 'PENDING'
    | 'ACCEPTED'
    | 'REJECTED';
}

// ═══════════════════════════════════════════════
// DEBUG: ACTION SOURCE
// ═══════════════════════════════════════════════

export interface ActionDebugInfo {
  actionIndex: number;
  action: string;
  zone: string;

  attackerId: string;
  attackerName: string;
  attackerPosition: string;
  attackerPower: number;

  defenderId: string | null;
  defenderName: string | null;
  defenderPosition: string | null;
  defenderPower: number;

  diff: number;
  probability: number;
  success: boolean;
}

// ═══════════════════════════════════════════════
// DEBUG: SHOT
// ═══════════════════════════════════════════════

export interface ShotDebugInfo {
  sequenceChanceQuality: number;
  sequenceFinalZone: string;
  sequenceTotalActions: number;

  shooterId: string;
  shooterName: string;
  shooterPosition: string;

  xG: number;
  distance: number;
  angle: number;
  pressure: number;

  outcome:
    | 'goal'
    | 'save'
    | 'miss'
    | 'blocked';

  onTarget: boolean;
  isHome: boolean;
}

// ═══════════════════════════════════════════════
// LIVE MOTOR TİPLERİ
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// SEEDED RNG
// ═══════════════════════════════════════════════

export interface RngState {
  seed: number;
  counter: number;
}

// ═══════════════════════════════════════════════
// TOP (LIVE)
// ═══════════════════════════════════════════════

export interface Ball {
  position: Vec3;
  velocity: Vec3;

  ownerId: string | null;

  lastTouchId: string | null;
  lastTouchClubId: string | null;

  isMoving: boolean;
}

// ═══════════════════════════════════════════════
// OYUNCU ROLÜ (LIVE)
// ═══════════════════════════════════════════════

export type PlayerRole =
  | 'GK'
  | 'CB'
  | 'FB'
  | 'WB'
  | 'DM'
  | 'CM'
  | 'AM'
  | 'W'
  | 'ST';

// ═══════════════════════════════════════════════
// INTENT / DECISION
// ═══════════════════════════════════════════════

export type Intent =
  | 'idle'
  | 'move'
  | 'chase'
  | 'pass'
  | 'shoot'
  | 'cross'
  | 'dribble'
  | 'tackle'
  | 'intercept'
  | 'mark'
  | 'hold'
  | 'return_to_position';

/**
 * Bir Decision'ın nedeni ve bir candidate'ın tipi.
 *
 * KONTRAT:
 *  • Ball Action candidate'ları:
 *      pass, through_ball, cross, shoot, dribble, hold, clear.
 *  • Priority Layer davranışları:
 *      tackle, intercept, mark, chase, support, return, move.
 *  • Set-piece / formasyon:
 *      set_piece, formation.
 *
 * intent ve reason AYRI kavramlardır:
 *  • intent → hangi fiziksel eylem
 *  • reason → neden bu eylem
 */
export type DecisionCandidateType =
  // Ball Action
  | 'pass'
  | 'through_ball'
  | 'cross'
  | 'dribble'
  | 'shoot'
  | 'hold'
  | 'clear'

  // Priority Layer
  | 'move'
  | 'chase'
  | 'support'
  | 'return'
  | 'tackle'
  | 'intercept'
  | 'mark'

  // Set-piece / formasyon
  | 'set_piece'
  | 'formation';

export interface Decision {
  intent: Intent;

  /**
   * Kararın nedeni.
   *
   * Örnek:
   *   intent = 'move'
   *   reason = 'chase'
   *   intent = 'move'
   *   reason = 'support'
   *   intent = 'return_to_position'
   *   reason = 'formation'
   *   intent = 'move'
   *   reason = 'set_piece'
   */
  reason: DecisionCandidateType;

  target: Vec2 | null;
  targetPlayerId: string | null;

  power: number;
  timestamp: number;
}

// ═══════════════════════════════════════════════
// LIVE OYUNCU
// ═══════════════════════════════════════════════

export interface LivePlayer {
  player: Player;

  position: Vec2;
  velocity: Vec2;
  facing: number;

  nextDecisionTime: number;

  currentDecision: Decision | null;
  currentIntent: Intent;

  isBallOwner: boolean;
  isChasingBall: boolean;
  isMarking: string | null;

  clubId: string;
  isHome: boolean;

  role: PlayerRole;

  homePosition: Vec2;

  maxSpeed: number;
  acceleration: number;
}

// ═══════════════════════════════════════════════
// PERCEPTION — CHEAP
// ═══════════════════════════════════════════════

export interface PerceivedBall {
  position: Vec3;
  velocity: Vec3;

  distance: number;
  angle: number;

  airborne: boolean;

  ownerId: string | null;
  ownerIsTeammate: boolean;
}

export interface CheapPerception {
  ball: PerceivedBall;

  nearbyDistances: Record<string, number>;

  ballZone: ZoneType;
  selfZone: ZoneType;
}

// ═══════════════════════════════════════════════
// PERCEPTION — FULL
// ═══════════════════════════════════════════════

export type ZoneType =
  | 'defense_left'
  | 'defense_center'
  | 'defense_right'
  | 'midfield_left'
  | 'midfield_center'
  | 'midfield_right'
  | 'attack_left'
  | 'attack_center'
  | 'attack_right';

export interface PerceivedPlayer {
  id: string;

  position: Vec2;
  velocity: Vec2;

  distance: number;
  angle: number;

  role: PlayerRole;

  hasBall: boolean;

  /**
   * 0-100 ölçeğinde.
   * Decision katmanında gerekli yerde 0-1'e normalize edilir.
   */
  openness: number;
}

export interface PassOption {
  targetPlayerId: string;
  targetPosition: Vec2;

  distance: number;
  angle: number;

  /**
   * 0-1
   */
  successProbability: number;

  /**
   * 0-1
   */
  laneClarity: number;

  /**
   * 0-1
   */
  tacticalValue: number;
}

export interface SpaceMap {
  gridSize: number;
  cols: number;
  rows: number;

  /**
   * Perception space değerleri 0-100 ölçeğindedir.
   * DecisionCandidate.spaceValue ise 0-1'dir.
   */
  cells: Float32Array;
}

export interface Perception {
  time: number;

  self: LivePlayer;

  ball: PerceivedBall;

  teammates: PerceivedPlayer[];
  opponents: PerceivedPlayer[];

  space: SpaceMap;

  /**
   * 0-100
   */
  pressure: number;

  passOptions: PassOption[];
  availablePassOptions: number;

  zone: {
    ball: ZoneType;
    self: ZoneType;
    attackDirection: 1 | -1;
  };
}

// ═══════════════════════════════════════════════
// PERCEPTION CACHE
// ═══════════════════════════════════════════════

export interface PerceptionCacheEntry {
  cheap: CheapPerception;

  full: Perception | null;

  fullAt: number;
}

// ═══════════════════════════════════════════════
// DECISION — CANDIDATE & DEBUG
// ═══════════════════════════════════════════════

export interface DecisionCandidate {
  type: DecisionCandidateType;

  targetPlayerId: string | null;
  target: Vec2 | null;

  /**
   * Adayın genel ağırlık skoru.
   */
  score: number;

  /**
   * Aşağıdaki bütün bileşenler 0-1 ölçeğindedir.
   */
  successProbability: number;
  risk: number;
  tacticalFit: number;
  attributeFit: number;
  spaceValue: number;
  pressurePenalty: number;

  /**
   * Candidate'ın davranış nedeni.
   */
  reason: DecisionCandidateType;
}

export interface DecisionDebug {
  playerId: string;
  playerName: string;

  timestamp: number;

  perception: Perception;

  candidates: DecisionCandidate[];

  selected: DecisionCandidate | null;

  decision: Decision | null;

  reason: DecisionCandidateType;
}

// ═══════════════════════════════════════════════
// LIVE TAKIM
// ═══════════════════════════════════════════════

export interface LiveTeamState {
  club: Club;

  players: string[];

  formation: Formation;

  tactic: Tactic;

  mentality: Tactic['mentality'];

  hasPossession: boolean;

  isHome: boolean;

  attackingDirection: 1 | -1;

  formationZones: PitchZone[];
}

// ═══════════════════════════════════════════════
// MAÇ FAZI
// ═══════════════════════════════════════════════

export type MatchPhase =
  | 'kickoff'
  | 'first_half'
  | 'half_time'
  | 'second_half'
  | 'full_time'
  | 'goal_kick'
  | 'corner'
  | 'throw_in'
  | 'free_kick'
  | 'penalty'
  | 'goal';

// ═══════════════════════════════════════════════
// SET-PIECE
// ═══════════════════════════════════════════════

export type SetPieceType =
  | 'kickoff'
  | 'goal_kick'
  | 'corner'
  | 'throw_in'
  | 'free_kick'
  | 'penalty';

export type SetPieceStatus =
  | 'positioning'
  | 'ready'
  | 'played';

export interface SetPieceState {
  type: SetPieceType;

  teamSide: 'HOME' | 'AWAY';

  takerId: string | null;

  ballPosition: Vec2;

  targetPositions: Record<string, Vec2>;

  requiredPlayerIds: string[];

  status: SetPieceStatus;

  elapsed: number;
}

// ═══════════════════════════════════════════════
// LIVE MAÇ İSTATİSTİKLERİ
// ═══════════════════════════════════════════════

export interface LiveMatchStats extends MatchStats {
  possession: {
    home: number;
    away: number;
  };

  shots: {
    home: number;
    away: number;
  };

  onTarget: {
    home: number;
    away: number;
  };

  chances: {
    home: number;
    away: number;
  };

  xG: {
    home: number;
    away: number;
  };

  passes: {
    home: number;
    away: number;
  };

  passesCompleted: {
    home: number;
    away: number;
  };

  dribbles: {
    home: number;
    away: number;
  };

  dribblesSuccess: {
    home: number;
    away: number;
  };

  crosses: {
    home: number;
    away: number;
  };

  crossesSuccess: {
    home: number;
    away: number;
  };

  dangerousAttacks: {
    home: number;
    away: number;
  };

  recoveries: {
    home: number;
    away: number;
  };

  /** Counter-press V1 fiziksel recovery metrikleri. */
  counterPressAttempts: number;
  counterPressRecoveries: number;
  counterPressRollsPassed: number;
  counterPressTackleWins: number;
  counterPressTackleFailures: number;
  counterPressTackleFouls: number;
  counterPressCleanRecoveries: number;
  counterPressLooseBallRecoveries: number;
  counterPressTackleWinChanceSum: number;
  counterPressTackleWinChanceMin: number;
  counterPressTackleWinChanceMax: number;
  counterPressTackleRelativeSpeedSum: number;
  counterPressTackleDistanceSum: number;

  fouls: {
    home: number;
    away: number;
  };

  yellowCards: {
    home: number;
    away: number;
  };

  redCards: {
    home: number;
    away: number;
  };

  corners: {
    home: number;
    away: number;
  };

  throwIns: {
    home: number;
    away: number;
  };

  goalKicks: {
    home: number;
    away: number;
  };

  offsides: {
    home: number;
    away: number;
  };

  ticks: number;
  simulationSeconds: number;
}

// ═══════════════════════════════════════════════
// LIVE MAÇ STATE
// ═══════════════════════════════════════════════

export interface TransitionState {
  counterPressClubId: string | null;
  counterPressPlayerId: string | null;
  breakClubId: string | null;
  startedAt: number;
  expiresAt: number;
  counterPressProbability: number;
  breakQuality: number;

  /** İlk rakip aksiyon penceresinde en fazla bir fiziksel contest. */
  hasAttemptedCounterPress: boolean;
  isRecoveryContestActive: boolean;

  /**
   * Counter-press tackle sonrası top hemen kontrol edilemezse,
   * sonraki loose-ball kontrolünü recovery olarak ilişkilendirmek için
   * bekleyen bağlam.
   */
  pendingLooseBallRecoveryClubId: string | null;
  pendingLooseBallRecoveryPlayerId: string | null;
}

export interface LiveMatchState {
  time: number;
  tick: number;

  phase: MatchPhase;

  addedTime: number;

  pitch: PitchDimensions;

  home: LiveTeamState;
  away: LiveTeamState;

  ball: Ball;

  players: Record<string, LivePlayer>;

  score: {
    home: number;
    away: number;
  };

  stats: LiveMatchStats;

  events: MatchEvent[];

  setPiece: SetPieceState | null;

  decisions: Record<string, DecisionDebug>;

  sequences: AttackSequence[];

  rng: RngState;

  perceptionCache: Record<string, PerceptionCacheEntry>;

  lastBallOwnerId: string | null;
  transition: TransitionState;

  isStopped: boolean;
  isFinished: boolean;
}

// ═══════════════════════════════════════════════
// LIVE SNAPSHOT
// ═══════════════════════════════════════════════

export interface LiveSnapshot {
  time: number;
  tick: number;

  ball: Ball;

  players: Record<
    string,
    {
      position: Vec2;
      velocity: Vec2;
      facing: number;
      isBallOwner: boolean;
      currentIntent: Intent;
    }
  >;

  score: {
    home: number;
    away: number;
  };

  phase: MatchPhase;
}

// ═══════════════════════════════════════════════
// LIVE CONFIG
// ═══════════════════════════════════════════════

export interface BallPhysicsConfig {
  gravity: number;
  airDrag: number;
  groundFriction: number;
  bounceFactor: number;

  radius: number;
  mass: number;

  maxSpeed: number;
}

export interface PlayerPhysicsConfig {
  maxSpeedMultiplier: number;
  accelerationMultiplier: number;
  decelerationMultiplier: number;

  radius: number;
  ballControlRadius: number;
  tackleRadius: number;
}

export interface LiveEngineConfig {
  tickRate: number;
  tickDuration: number;
  renderRate: number;

  minDecisionInterval: number;
  maxDecisionInterval: number;
  ballOwnerDecisionInterval: number;

  spaceGridSize: number;

  ballPhysics: BallPhysicsConfig;
  playerPhysics: PlayerPhysicsConfig;

  seed: number | null;
}

// ═══════════════════════════════════════════════
// TACKLE
// ═══════════════════════════════════════════════

export type TackleOutcome =
  | {
      type: 'won';

      tacklerId: string;
      ballCarrierId: string;

      newOwnerId: string | null;

      point: Vec2;
      debug?: { winChance: number; cleanChance: number; relativeSpeed: number; distance: number; };
    }
  | {
      type: 'failed';

      tacklerId: string;
      ballCarrierId: string;
      debug?: { winChance: number; relativeSpeed: number; distance: number; };
    }
  | {
      type: 'foul';

      tacklerId: string;
      ballCarrierId: string;

      severity:
        | 'light'
        | 'medium'
        | 'severe';

      point: Vec2;
      debug?: { winChance: number; relativeSpeed: number; distance: number; };
    };

// ═══════════════════════════════════════════════
// BOUNDARY EVENT (events.ts)
// ═══════════════════════════════════════════════

export type BoundaryType =
  | 'TOUCHLINE'
  | 'GOAL_LINE'
  | 'GOAL_MOUTH'
  | 'NONE';

// ═══════════════════════════════════════════════
// LIVE MATCH RESULT
// ═══════════════════════════════════════════════

export interface LiveMatchResult {
  match: Match;
  state: LiveMatchState;
  snapshots: LiveSnapshot[];
}