// src/engine/live/index.ts

/**
 * LIVE MOTOR PUBLIC API
 * ======================
 *
 * Bu dosya live motorun dışarıya açılan tek giriş noktasıdır.
 *
 * YASAK:
 *  - Yeni mantık
 *  - State mutation
 *  - RNG
 *
 * KONTRAT:
 *  - Tüm public tipler buradan export edilir.
 *  - Tüm public fonksiyonlar buradan export edilir.
 *  - gameStore SADECE bu dosyadan import eder.
 *  - Dış dünya (UI, store) iç modülleri doğrudan import etmez.
 *
 * NOT:
 *  - TeamSide pitch.ts'ten gelir (canonical).
 *  - events.ts'teki TeamSide ayrı isimle (EventsTeamSide) export edilir.
 *  - types.ts'teki tekrarlı tipler alias'lanır (…Type).
 *  - Config sabitleri perception.ts'ten DEĞİL, config.ts'ten export edilir.
 */

// ═══════════════════════════════════════════════
// ANA GİRİŞ NOKTASI
// ═══════════════════════════════════════════════

export {
  simulateMatchLive,
  type SimulateMatchLiveOptions,
} from './liveMatch';

// ═══════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════

export {
  TICK_RATE,
  TICK_DURATION,
  MATCH_DURATION_SECONDS,
  HALF_DURATION_SECONDS,
  ADDED_TIME_SECONDS,
  HALF_TIME_TICKS,
  SNAPSHOT_EVERY_TICK,
  SNAPSHOT_MAX_HISTORY,

  DEFAULT_BALL_PHYSICS,
  DEFAULT_PLAYER_PHYSICS,
  DEFAULT_LIVE_ENGINE_CONFIG,

  BALL_SPEED,
  CROSS_VZ_RATIO,
  CLEARANCE_VZ_RATIO,

  BALL_CONTROL_MAX_HEIGHT,
  BALL_AIRBORNE_HEIGHT,
  BALL_STOPPED_SPEED,
  BALL_BOUNCE_STOP_SPEED,
  BALL_ATTACH_FOOT_DISTANCE,

  PLAYER_SPEED,
  PLAYER_MULTIPLIERS,
  PLAYER_TURN_RATE,
  PLAYER_APPROACH_RADIUS,
  PLAYER_STOP_SPEED,
  PLAYER_TARGET_TOLERANCE,

  DECISION,
  MAX_CHASE_PER_TEAM,
  CHASE_DISTANCE_WEIGHT,
  CHASE_TACKLING_WEIGHT,

  SPACE_GRID_SIZE,
  SPACE_OPPONENT_RADIUS,
  SPACE_OPPONENT_PENALTY,
  SPACE_NEUTRAL,
  PRESSURE_RADIUS,
  PRESSURE_PER_OPPONENT,
  NEARBY_PLAYER_COUNT,
  OPENNESS_RADIUS,
  OPENNESS_PENALTY,

  PASS_LANE_INTERFERENCE_RADIUS,
  PASS_LANE_INTERFERENCE_WEIGHT,
  PASS_DISTANCE_PENALTY_START,
  PASS_DISTANCE_PENALTY_SCALE,
  PASS_PROBABILITY_MIN,
  PASS_PROBABILITY_MAX,
  PASS_SUCCESS,
  PASS_SCORE,
  THROUGH_BALL_MIN_DISTANCE,
  THROUGH_BALL_MIN_TACTICAL,

  CROSS_TARGET_RADIUS,
  CROSS_PROBABILITY_MIN,
  CROSS_PROBABILITY_MAX,
  CROSS_BASE_PROBABILITY,
  CROSS_ATTR_WEIGHT,
  CROSS_DISTANCE_DIVISOR,
  CROSS_BASE_SCORE,
  CROSS_SCORE_ATTR_WEIGHT,
  CROSS_RISK,
  CROSS_TACTICAL_FIT,

  SHOOT_MAX_DISTANCE,
  SHOOT_XG_BASE,
  SHOOT_XG_CLOSE_DISTANCE,
  SHOOT_XG_DISTANCE_PENALTY,
  SHOOT_XG_PRESSURE_PENALTY,
  SHOOT_XG_MIN,
  SHOOT_XG_MAX,
  SHOOT_SCORE,
  SHOOT_TACTICAL_FIT,

  DRIBBLE_SPACE_DIFF_THRESHOLD,
  DRIBBLE_FORWARD_DISTANCE,
  DRIBBLE_PROBABILITY_MIN,
  DRIBBLE_PROBABILITY_MAX,
  DRIBBLE_BASE_SCORE,
  DRIBBLE_SPACE_SCORE_DIVISOR,
  DRIBBLE_RISK,
  DRIBBLE_TACTICAL_FIT,

  HOLD_BASE_SCORE,
  HOLD_TACTICAL_FIT,

  MARK_MAX_DISTANCE,
  MARK_OPENNESS_WEIGHT,
  MARK_DISTANCE_WEIGHT,
  MARK_BASE_SCORE,
  MARK_SCORE_DIVISOR,
  MARK_SUCCESS_PROBABILITY,
  MARK_RISK,
  MARK_TACTICAL_FIT,

  TACKLE_WIN_MIN,
  TACKLE_WIN_MAX,
  TACKLE_SIGMOID_SCALE,
  TACKLE_DISTANCE_PENALTY_SCALE,
  TACKLE_ATTACK_TACKLING_WEIGHT,
  TACKLE_ATTACK_AGGRESSION_WEIGHT,
  TACKLE_ATTACK_BRAVERY_WEIGHT,
  TACKLE_DEFENSE_DRIBBLING_WEIGHT,
  TACKLE_DEFENSE_AGILITY_WEIGHT,
  TACKLE_DEFENSE_BALANCE_WEIGHT,
  TACKLE_DEFENSE_RELATIVE_SPEED_WEIGHT,
  TACKLE_RELATIVE_SPEED_SCALE,
  TACKLE_CLEAN_MIN,
  TACKLE_CLEAN_MAX,
  TACKLE_CLEAN_CHANCE_BASE,
  TACKLE_CLEAN_CHANCE_TACKLING,
  TACKLE_BASE_SCORE,
  TACKLE_SCORE_TACKLING_WEIGHT,
  TACKLE_SCORE_AGGRESSION_WEIGHT,
  TACKLE_ESTIMATED_SUCCESS,
  TACKLE_RISK,
  TACKLE_TACTICAL_FIT,

  INTERCEPT_BASE_SCORE,
  INTERCEPT_ESTIMATED_SUCCESS,
  INTERCEPT_RISK,
  INTERCEPT_TACTICAL_FIT,

  RETURN_DISTANCE_THRESHOLD,
  RETURN_BASE_SCORE,
  RETURN_SCORE_DIVISOR,
  RETURN_SUCCESS_PROBABILITY,
  RETURN_TACTICAL_FIT,
  RETURN_FALLBACK_SCORE,

  SUPPORT_FORWARD_OFFSET,
  SUPPORT_MIN_SPACE,
  SUPPORT_BASE_SCORE,
  SUPPORT_SPACE_DIVISOR,
  SUPPORT_SUCCESS_PROBABILITY,
  SUPPORT_RISK,
  SUPPORT_TACTICAL_FIT,

  CHASE_BASE_SCORE,
  CHASE_SCORE_DIVISOR,
  CHASE_SUCCESS_PROBABILITY,
  CHASE_TACTICAL_FIT,

  FOUL_PROBABILITY_MIN,
  FOUL_PROBABILITY_MAX,
  FOUL_BASE_PROBABILITY,
  FOUL_AGGRESSION_WEIGHT,
  FOUL_DISTANCE_WEIGHT,
  FOUL_SEVERITY_LIGHT,
  FOUL_SEVERITY_MEDIUM,
  FOUL_SEVERITY_AGGRESSION,
  FOUL_SEVERITY_BRAVERY,
  FOUL_SEVERITY_DISTANCE,

  SET_PIECE_POSITION_TOLERANCE,
  SET_PIECE_MAX_POSITIONING_SECONDS,
  THROW_IN_DISTANCE_FROM_LINE,
  WALL_DISTANCE,
  WALL_PLAYER_SPACING,
  SET_PIECE_REQUIRED_COUNT,

  DECISION_POWER,
} from './config';

// ═══════════════════════════════════════════════
// PITCH
// ═══════════════════════════════════════════════

export {
  DEFAULT_PITCH_DIMENSIONS,
  OUT_OF_BOUNDS_MARGIN,

  createPoint,
  addPoints,
  subtractPoints,
  multiplyVector,
  distanceSquared,
  distance,
  lerpPoint,

  isInsidePitch,
  isOutsidePitchWithMargin,

  getGoalMouth,
  getGoalGeometry,
  isInsideGoalMouth,

  distanceToPost,
  isPointTouchingPost,

  getPenaltyArea,
  isInsidePenaltyArea,

  getGoalArea,
  isInsideGoalArea,

  segmentIntersection,
  getPitchBoundarySegments,
  detectBoundaryCrossing,

  getCornerPoint,
  isInsideCornerArc,

  getPitchCenter,
  getHalfwayLine,
  isOnHalfwayLine,

  isOnGoalLine,
  isOnTouchline,

  closestPointOnPitchBoundary,
  projectPointToPitch,

  validatePitchDimensions,

  type TeamSide,
  type PitchPoint,
  type PitchVector,
  type Segment,
  type GoalPost,
  type GoalGeometry,
  type BoundaryType,
  type BoundaryCrossing,
  type GoalMouth,
  type RectArea,
} from './pitch';

// ═══════════════════════════════════════════════
// RNG
// ═══════════════════════════════════════════════

export {
  createRng,
  cloneRng,
  nextFloat,
  nextInt,
  nextIntRange,
  nextBool,
  weightedChoice,
  shuffleInPlace,
  pickOne,
  nextGaussian,
  type RngState,
} from './rng';

// ═══════════════════════════════════════════════
// BALL
// ═══════════════════════════════════════════════

export {
  createBall,
  stepBall,
  applyPass,
  applyShot,
  applyCross,
  applyClearance,
  canControl,
  controlBall,
  releaseBall,
  attachBallToOwner,
  ballSpeed,
  ballIsAirborne,
  ballDistanceTo,
  type BallPhysicsConfig,
} from './ball';

// ═══════════════════════════════════════════════
// PERCEPTION
// ═══════════════════════════════════════════════

export {
  computeDistance,
  computeBearing,
  computeRelativeAngle,

  zoneOf,
  normalizeRole,

  computeOpenness,

  computeCheapPerception,
  computeFullPerception,

  computeSpaceMap,
  computePressure,

  computePassOptions,
  computeLaneClarity,
  computePassSuccessProbability,
  computePassTacticalValue,
} from './perception';

// ═══════════════════════════════════════════════
// DECISION
// ═══════════════════════════════════════════════

export {
  computeDecisionInterval,
  shouldDecide,
  allocateChase,
  decideForPlayer,
  computeAllDecisions,
  type DecisionState,
  type ComputeAllDecisionsResult,
} from './decision';

// ═══════════════════════════════════════════════
// MOVEMENT
// ═══════════════════════════════════════════════

export {
  computeMaxSpeed,
  computeAcceleration,
  movePlayer,
  applyPlayerSeparation,
  updateBallOwnerAttachment,
  moveAllPlayers,
  type MovementContext,
} from './movement';

// ═══════════════════════════════════════════════
// TACKLE
// ═══════════════════════════════════════════════

export {
  resolveTackle,
  computeFoulProbability,
  computeFoulSeverity,
  resolveAllTackles,
  type TackleContext,
} from './tackle';

// ═══════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════

export {
  detectBoundaryOutcome,
  detectOffside,
  detectBallControl,
  detectDeadBall,

  type TeamSide as EventsTeamSide,
  type BoundaryOutcome,
  type DetectEventInput,
  type OffsideOutcome,
} from './events';

// ═══════════════════════════════════════════════
// SET-PIECES
// ═══════════════════════════════════════════════

export {
  takerScore,
  selectTaker,
  computeTargetPositions,
  computeRequiredPlayers,
  createSetPiece,
  updateSetPiece,
  markSetPiecePlayed,

  type SetPieceType,
  type SetPieceStatus,
  type SetPieceState,
  type SetPieceContext,
} from './setPieces';

// ═══════════════════════════════════════════════
// LIVE TYPES (types.ts'ten)
// ═══════════════════════════════════════════════

export type {
  // Top
  Ball,

  // Oyuncu
  LivePlayer,
  LiveTeamState,
  PlayerRole,

  // Karar
  Decision,
  DecisionCandidate,
  DecisionCandidateType,
  DecisionDebug,
  Intent,

  // Perception
  CheapPerception,
  Perception,
  PerceivedBall,
  PerceivedPlayer,
  PassOption,
  SpaceMap,
  ZoneType,
  PerceptionCacheEntry,

  // Set-piece
  SetPieceState as SetPieceStateType,

  // Tackle
  TackleOutcome,

  // Live match
  LiveMatchState,
  LiveMatchStats,
  LiveSnapshot,
  LiveMatchResult,
  MatchPhase,

  // Config tipleri
  BallPhysicsConfig as BallPhysicsConfigType,
  PlayerPhysicsConfig,
  LiveEngineConfig,

  // Saha / vektör
  PitchDimensions,
  Vec2,
  Vec3,

  // RNG tipi
  RngState as RngStateType,
} from '../types';

// ═══════════════════════════════════════════════
// VERSİYON
// ═══════════════════════════════════════════════

export const LIVE_ENGINE_VERSION = '1.0.0';