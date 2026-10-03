// src/engine/live/config.ts

/**
 * LIVE MOTOR CONFIG
 * ------------------
 * Bu dosya TEK config/sabit kaynağıdır.
 *
 * YASAK:
 *  - Tip tanımı (types.ts'in işi)
 *  - Fonksiyon / mantık
 *  - Modül bağımlılığı (yalnızca type import)
 *  - Runtime state
 *
 * KONTRAT:
 *  - Tüm sihirli sayılar buradan gelir.
 *  - Kalibrasyon parametreleri buraya yazılır.
 *  - perception.ts / decision.ts / movement.ts / ball.ts / tackle.ts
 *    kendi sabitlerini tanımlamaz; buradan import eder.
 */

import type {
  BallPhysicsConfig,
  PlayerPhysicsConfig,
  LiveEngineConfig,
} from '../types';

// ═══════════════════════════════════════════════
// TICK
// ═══════════════════════════════════════════════

export const TICK_RATE = 10;
export const TICK_DURATION = 1 / TICK_RATE;
export const MATCH_DURATION_SECONDS = 90 * 60;
export const HALF_DURATION_SECONDS = 45 * 60;
export const ADDED_TIME_SECONDS = 0;
export const HALF_TIME_TICKS = 1;

// ═══════════════════════════════════════════════
// BALL FİZİĞİ
// ═══════════════════════════════════════════════

export const DEFAULT_BALL_PHYSICS: BallPhysicsConfig = {
  gravity: -9.81,
  airDrag: 0.995,
  groundFriction: 0.97,
  bounceFactor: 0.6,
  radius: 0.11,
  mass: 0.43,
  maxSpeed: 35,
};

export const BALL_SPEED = {
  pass: { min: 4, max: 25 },
  shot: { min: 12, max: 35 },
  cross: { min: 10, max: 25 },
  clearance: { min: 15, max: 30 },
} as const;

export const CROSS_VZ_RATIO = 0.3;
export const CLEARANCE_VZ_RATIO = 0.4;

export const BALL_CONTROL_MAX_HEIGHT = 1.0;
export const BALL_AIRBORNE_HEIGHT = 0.5;
export const BALL_STOPPED_SPEED = 0.1;

/**
 * Loose-ball kontrol eşiği.
 * Top bu hızın altındaysa, fiziksel olarak hâlâ isMoving olsa bile
 * kontrol mesafesine giren oyuncu topu alabilir.
 */
export const BALL_CONTROL_MAX_SPEED = 1.5;
export const BALL_BOUNCE_STOP_SPEED = 0.5;
export const BALL_ATTACH_FOOT_DISTANCE = 0.5;

// ═══════════════════════════════════════════════
// PLAYER FİZİĞİ
// ═══════════════════════════════════════════════

export const DEFAULT_PLAYER_PHYSICS: PlayerPhysicsConfig = {
  maxSpeedMultiplier: 1.0,
  accelerationMultiplier: 1.0,
  decelerationMultiplier: 1.0,
  radius: 0.4,
  ballControlRadius: 0.6,
  tackleRadius: 1.0,
};

export const PLAYER_SPEED = {
  base: 4.0,
  paceWeight: 5.0,
  accelWeight: 1.5,
  accelBase: 3.0,
  accelWeightAccel: 4.0,
} as const;

export const PLAYER_MULTIPLIERS = {
  conditionBase: 0.7,
  conditionWeight: 0.3,
  moraleBase: 0.9,
  moraleWeight: 0.1,
  formBase: 0.9,
  formWeight: 0.1,
} as const;

export const PLAYER_TURN_RATE = 0.5;
export const PLAYER_APPROACH_RADIUS = 2.0;
export const PLAYER_STOP_SPEED = 0.05;
export const PLAYER_TARGET_TOLERANCE = 0.05;
export const PLAYER_VELOCITY_EPSILON = 0.001;

// ═══════════════════════════════════════════════
// MAÇ İÇİ YORGUNLUK
// ═══════════════════════════════════════════════

export const FATIGUE_PER_MINUTE = 0.12;
export const FATIGUE_STAMINA_FACTOR = 0.5;
export const FATIGUE_FITNESS_FACTOR = 0.6;
export const FATIGUE_MIN_CONDITION = 5;
export const FATIGUE_HALFTIME_RECOVERY = 2.5;

// ═══════════════════════════════════════════════
// KARAR ZAMANI
// ═══════════════════════════════════════════════

export const DECISION = {
  ballOwnerInterval: 0.15,
  minInterval: 0.3,
  maxInterval: 1.5,
  decisionsWeight: 0.02,
  anticipationWeight: 0.02,
  concentrationWeight: 0.01,
  qualityScale: 20,
  candidateFloorWeight: 0.05,
  jitter: 0.0,
} as const;

// ═══════════════════════════════════════════════
// CHASE ALLOCATION
// ═══════════════════════════════════════════════

export const MAX_CHASE_PER_TEAM = 2;
export const CHASE_DISTANCE_WEIGHT = -0.7;
export const CHASE_TACKLING_WEIGHT = 0.3;
export const GK_CHASE_MAX_DISTANCE = 18.0;
export const GK_CHASE_MAX_X = 18.0;
export const GK_SWEEPER_DISTANCE = 10.0;

// ═══════════════════════════════════════════════
// PERCEPTION
// ═══════════════════════════════════════════════

export const SPACE_GRID_SIZE = 4.0;
export const SPACE_OPPONENT_RADIUS = 15.0;
export const SPACE_OPPONENT_PENALTY = 40.0;
export const SPACE_NEUTRAL = 50;
export const PRESSURE_RADIUS = 10.0;
export const PRESSURE_PER_OPPONENT = 30.0;
export const NEARBY_PLAYER_COUNT = 5;
export const OPENNESS_RADIUS = 8.0;
export const OPENNESS_PENALTY = 25.0;

// ═══════════════════════════════════════════════
// PASS OPTIONS
// ═══════════════════════════════════════════════

export const PASS_LANE_INTERFERENCE_RADIUS = 3.0;
export const PASS_DISTANCE_PENALTY_START = 15.0;
export const PASS_DISTANCE_PENALTY_SCALE = 30.0;
export const PASS_PROBABILITY_MIN = 0.1;
export const PASS_PROBABILITY_MAX = 0.95;

export const PASS_SUCCESS = {
  laneClarityWeight: 0.9,
  attributeWeight: 0.1,
  distancePenaltyWeight: 0.4,
} as const;

export const PASS_LANE_INTERFERENCE_WEIGHT = 0.3;

export const PASS_SCORE = {
  successWeight: 0.5,
  tacticalWeight: 0.3,
  spaceWeight: 0.2,
  riskWeight: 0.2,
} as const;

export const THROUGH_BALL_MIN_DISTANCE = 25.0;
export const THROUGH_BALL_MIN_TACTICAL = 0.6;

// ═══════════════════════════════════════════════
// CROSS
// ═══════════════════════════════════════════════

export const CROSS_TARGET_RADIUS = 18.0;
export const CROSS_PROBABILITY_MIN = 0.2;
export const CROSS_PROBABILITY_MAX = 0.8;
export const CROSS_BASE_PROBABILITY = 0.6;
export const CROSS_ATTR_WEIGHT = 0.2;
export const CROSS_DISTANCE_DIVISOR = 100;
export const CROSS_BASE_SCORE = 0.55;
export const CROSS_SCORE_ATTR_WEIGHT = 0.3;
export const CROSS_RISK = 0.5;
export const CROSS_TACTICAL_FIT = 0.7;

// ═══════════════════════════════════════════════
// SHOOT
// ═══════════════════════════════════════════════

export const SHOOT_MAX_DISTANCE = 30.0;
export const SHOOT_XG_BASE = 0.55;
export const SHOOT_XG_DISTANCE_PENALTY = 0.02;
export const SHOOT_XG_CLOSE_DISTANCE = 6.0;
export const SHOOT_XG_PRESSURE_PENALTY = 0.3;
export const SHOOT_XG_MIN = 0.02;
export const SHOOT_XG_MAX = 0.7;

export const SHOOT_SCORE = {
  xGWeight: 1.5,
  finishingWeight: 0.3,
  composureWeight: 0.2,
} as const;

export const SHOOT_TACTICAL_FIT = 0.6;

// ═══════════════════════════════════════════════
// DRIBBLE
// ═══════════════════════════════════════════════

export const DRIBBLE_SPACE_DIFF_THRESHOLD = 5.0;
export const DRIBBLE_FORWARD_DISTANCE = 5.0;
export const DRIBBLE_PROBABILITY_MIN = 0.2;
export const DRIBBLE_PROBABILITY_MAX = 0.9;
export const DRIBBLE_BASE_SCORE = 0.4;
export const DRIBBLE_SPACE_SCORE_DIVISOR = 200;
export const DRIBBLE_RISK = 0.4;
export const DRIBBLE_TACTICAL_FIT = 0.5;

// ═══════════════════════════════════════════════
// HOLD
// ═══════════════════════════════════════════════

export const HOLD_BASE_SCORE = 0.3;
export const HOLD_TACTICAL_FIT = 0.4;

// ═══════════════════════════════════════════════
// MARK
// ═══════════════════════════════════════════════

export const MARK_MAX_DISTANCE = 25.0;
export const MARK_OPENNESS_WEIGHT = 0.7;
export const MARK_DISTANCE_WEIGHT = 0.3;
export const MARKING_OFFSET_DISTANCE = 2.0;
export const MARK_ASSIGNMENT_MAX_PER_OPPONENT = 1;
export const MARK_THREAT_DISTANCE_WEIGHT = 0.35;
export const MARK_THREAT_GOAL_WEIGHT = 0.30;
export const MARK_THREAT_OPENNESS_WEIGHT = 0.20;
export const MARK_THREAT_ROLE_WEIGHT = 0.15;
export const MARK_BASE_SCORE = 0.4;
export const MARK_SCORE_DIVISOR = 200;
export const MARK_SUCCESS_PROBABILITY = 0.7;
export const MARK_RISK = 0.1;
export const MARK_TACTICAL_FIT = 0.6;

// ═══════════════════════════════════════════════
// TACKLE
// ═══════════════════════════════════════════════

export const TACKLE_WIN_MIN = 0.05;
export const TACKLE_WIN_MAX = 0.95;

export const TACKLE_SIGMOID_SCALE = 2.5;
export const TACKLE_DISTANCE_PENALTY_SCALE = 1.5;

// ─── Attack Power ───
export const TACKLE_ATTACK_TACKLING_WEIGHT = 1.0;
export const TACKLE_ATTACK_AGGRESSION_WEIGHT = 0.5;
export const TACKLE_ATTACK_BRAVERY_WEIGHT = 0.3;

// ─── Defense Power ───
export const TACKLE_DEFENSE_DRIBBLING_WEIGHT = 1.0;
export const TACKLE_DEFENSE_AGILITY_WEIGHT = 0.5;
export const TACKLE_DEFENSE_BALANCE_WEIGHT = 0.3;
export const TACKLE_DEFENSE_RELATIVE_SPEED_WEIGHT = 0.5;

export const TACKLE_RELATIVE_SPEED_SCALE = 10;

// ─── Clean chance ───
export const TACKLE_CLEAN_MIN = 0.5;
export const TACKLE_CLEAN_MAX = 0.95;
export const TACKLE_CLEAN_CHANCE_BASE = 0.6;
export const TACKLE_CLEAN_CHANCE_TACKLING = 0.3;

// ─── Aday skor ağırlıkları (decision.ts) ───
export const TACKLE_BASE_SCORE = 0.7;
export const TACKLE_SCORE_TACKLING_WEIGHT = 0.3;
export const TACKLE_SCORE_AGGRESSION_WEIGHT = 0.1;
export const TACKLE_ESTIMATED_SUCCESS = 0.5;
export const TACKLE_RISK = 0.4;
export const TACKLE_TACTICAL_FIT = 0.8;

// ═══════════════════════════════════════════════
// INTERCEPT
// ═══════════════════════════════════════════════

export const INTERCEPT_BASE_SCORE = 0.6;
export const INTERCEPT_ESTIMATED_SUCCESS = 0.4;
export const INTERCEPT_RISK = 0.3;
export const INTERCEPT_TACTICAL_FIT = 0.6;

// ═══════════════════════════════════════════════
// RETURN / SUPPORT / MOVE
// ═══════════════════════════════════════════════

export const RETURN_DISTANCE_THRESHOLD = 8.0;
export const RETURN_BASE_SCORE = 0.4;
export const RETURN_SCORE_DIVISOR = 100;
export const RETURN_SUCCESS_PROBABILITY = 1.0;
export const RETURN_TACTICAL_FIT = 0.4;
export const RETURN_FALLBACK_SCORE = 0.5;

export const SUPPORT_FORWARD_OFFSET = 15.0;
export const SUPPORT_MIN_SPACE = 40.0;
export const SUPPORT_BASE_SCORE = 0.5;
export const SUPPORT_SPACE_DIVISOR = 200;
export const SUPPORT_SUCCESS_PROBABILITY = 0.9;
export const SUPPORT_RISK = 0.1;
export const SUPPORT_TACTICAL_FIT = 0.7;

export const CHASE_BASE_SCORE = 1.0;
export const CHASE_SCORE_DIVISOR = 50;
export const CHASE_SUCCESS_PROBABILITY = 0.9;
export const CHASE_TACTICAL_FIT = 0.9;

// ═══════════════════════════════════════════════
// FAUL
// ═══════════════════════════════════════════════

export const FOUL_PROBABILITY_MIN = 0.05;
export const FOUL_PROBABILITY_MAX = 0.6;
export const FOUL_BASE_PROBABILITY = 0.15;
export const FOUL_AGGRESSION_WEIGHT = 0.2;
export const FOUL_DISTANCE_WEIGHT = 0.25;

export const FOUL_SEVERITY_LIGHT = 0.35;
export const FOUL_SEVERITY_MEDIUM = 0.65;
export const FOUL_SEVERITY_AGGRESSION = 0.5;
export const FOUL_SEVERITY_BRAVERY = 0.3;
export const FOUL_SEVERITY_DISTANCE = 0.2;

// ═══════════════════════════════════════════════
// SET-PIECE
// ═══════════════════════════════════════════════

export const SET_PIECE_POSITION_TOLERANCE = 0.5;
export const SET_PIECE_MAX_POSITIONING_SECONDS = 8.0;
export const THROW_IN_DISTANCE_FROM_LINE = 0.5;
export const WALL_DISTANCE = 9.15;
export const WALL_PLAYER_SPACING = 0.6;

export const SET_PIECE_REQUIRED_COUNT = {
  kickoff: 2,
  goal_kick: 4,
  corner: 5,
  throw_in: 2,
  free_kick: 4,
  penalty: 5,
} as const;

// ═══════════════════════════════════════════════
// DECISION POWER
// ═══════════════════════════════════════════════

export const DECISION_POWER = {
  shootBase: 0.8,
  shootAttrWeight: 0.2,

  passBase: 0.4,
  passSuccessWeight: 0.4,

  crossBase: 0.5,
  crossAttrWeight: 0.3,

  clearance: 0.9,

  dribble: 0.5,

  move: 0.7,
  return: 0.7,
  hold: 0.7,

  tackle: 0.8,
  intercept: 0.8,
  mark: 0.6,

  default: 0.5,
} as const;

// ═══════════════════════════════════════════════
// SNAPSHOT
// ═══════════════════════════════════════════════

export const SNAPSHOT_EVERY_TICK = false;
export const SNAPSHOT_MAX_HISTORY = 10000;

// ═══════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════

export const DEFAULT_LIVE_ENGINE_CONFIG: LiveEngineConfig = {
  tickRate: TICK_RATE,
  tickDuration: TICK_DURATION,
  renderRate: 60,
  minDecisionInterval: DECISION.minInterval,
  maxDecisionInterval: DECISION.maxInterval,
  ballOwnerDecisionInterval: DECISION.ballOwnerInterval,
  spaceGridSize: SPACE_GRID_SIZE,
  ballPhysics: DEFAULT_BALL_PHYSICS,
  playerPhysics: DEFAULT_PLAYER_PHYSICS,
  seed: null,
};