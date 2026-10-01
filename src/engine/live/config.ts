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
 *  - perception.ts / decision.ts / movement.ts / ball.ts
 *    kendi sabitlerini tanımlamaz; buradan import eder.
 *
 * DEĞİŞMEZ (fiziksel / matematiksel gerçeklik):
 *  - gravity: -9.81 m/s²
 *  - ballRadius: 0.11 m
 *  - ballMass: 0.43 kg
 *  - goalWidth: 7.32 m  (types.ts PitchDimensions'da)
 *  - goalHeight: 2.44 m (types.ts PitchDimensions'da)
 *
 * KALİBRASYON:
 *  - airDrag, groundFriction, bounceFactor
 *  - decision interval'ları
 *  - chase sayısı
 *  - pressure / space yarıçapları
 *  - wall distance
 *  - candidate scoring ağırlıkları
 */

import type {
  BallPhysicsConfig,
  PlayerPhysicsConfig,
  LiveEngineConfig,
} from '../types';

// ═══════════════════════════════════════════════
// TICK
// ═══════════════════════════════════════════════

/** Simülasyon frekansı (Hz). */
export const TICK_RATE = 10;

/** Bir tick'in süresi (saniye). */
export const TICK_DURATION = 1 / TICK_RATE;

/** Maç süresi — iki yarı toplam saniye. 90 dk = 5400 sn. */
export const MATCH_DURATION_SECONDS = 90 * 60;

/** Bir yarı süresi — saniye. 45 dk = 2700 sn. */
export const HALF_DURATION_SECONDS = 45 * 60;

/** Uzatma — V1'de 0. */
export const ADDED_TIME_SECONDS = 0;

/** Half-time fazının süresi — tick. */
export const HALF_TIME_TICKS = 1;

// ═══════════════════════════════════════════════
// BALL FİZİĞİ
// ═══════════════════════════════════════════════

export const DEFAULT_BALL_PHYSICS: BallPhysicsConfig = {
  /** Yerçekimi (m/s²). Fiziksel sabit. */
  gravity: -9.81,

  /**
   * Hava direnci — TICK BAŞINA katsayı.
   * 10 Hz → saniyede yaklaşık 0.951.
   */
  airDrag: 0.995,

  /**
   * Zemin sürtünmesi — TICK BAŞINA katsayı.
   * 10 Hz → saniyede yaklaşık 0.738.
   */
  groundFriction: 0.97,

  /** Zemin sekme katsayısı (0..1). */
  bounceFactor: 0.6,

  /** Top yarıçapı (m). Fiziksel sabit. */
  radius: 0.11,

  /** Top kütlesi (kg). Fiziksel sabit. */
  mass: 0.43,

  /** Maksimum top hızı (m/s). */
  maxSpeed: 35,
};

/**
 * Top dokunma hız aralıkları (m/s).
 *
 * KONTRAT:
 *   speed = min + power * (max - min)
 *
 * power ∈ [0, 1]
 */
export const BALL_SPEED = {
  pass: {
    min: 4,
    max: 25,
  },

  shot: {
    min: 12,
    max: 35,
  },

  cross: {
    min: 10,
    max: 25,
  },

  clearance: {
    min: 15,
    max: 30,
  },
} as const;

/** Cross / clearance için dikey hız oranı. */
export const CROSS_VZ_RATIO = 0.3;
export const CLEARANCE_VZ_RATIO = 0.4;

/** Top kontrolü için maksimum top yüksekliği (m). */
export const BALL_CONTROL_MAX_HEIGHT = 1.0;

/** Bu yüksekliğin üstünde top "havada" kabul edilir. */
export const BALL_AIRBORNE_HEIGHT = 0.5;

/** Duran top eşiği (m/s). */
export const BALL_STOPPED_SPEED = 0.1;

/** Sekme sonrası topun durması için hız eşiği (m/s). */
export const BALL_BOUNCE_STOP_SPEED = 0.5;

/** Top sahibinin ayağının önünde tutulduğu mesafe (m). */
export const BALL_ATTACH_FOOT_DISTANCE = 0.5;

// ═══════════════════════════════════════════════
// PLAYER FİZİĞİ
// ═══════════════════════════════════════════════

export const DEFAULT_PLAYER_PHYSICS: PlayerPhysicsConfig = {
  maxSpeedMultiplier: 1.0,
  accelerationMultiplier: 1.0,
  decelerationMultiplier: 1.0,

  /** Oyuncu yarıçapı (m). */
  radius: 0.4,

  /** Top kontrolü mesafesi (m). */
  ballControlRadius: 0.6,

  /** Tackle etkileşim mesafesi (m). */
  tackleRadius: 1.0,
};

/**
 * Oyuncu hız formülü parametreleri.
 *
 * pace ve acceleration değerleri 1..20 ölçeğindedir.
 */
export const PLAYER_SPEED = {
  /** Baz hız (m/s). */
  base: 4.0,

  /** Pace katkısı (m/s). */
  paceWeight: 5.0,

  /** Acceleration katkısı (m/s). */
  accelWeight: 1.5,

  /** İvme baz değeri (m/s²). */
  accelBase: 3.0,

  /** Acceleration katkısı (m/s²). */
  accelWeightAccel: 4.0,
} as const;

/** Kondisyon / moral / form çarpanları. */
export const PLAYER_MULTIPLIERS = {
  conditionBase: 0.7,
  conditionWeight: 0.3,

  moraleBase: 0.9,
  moraleWeight: 0.1,

  formBase: 0.9,
  formWeight: 0.1,
} as const;

/** Oyuncu dönüş hızı. */
export const PLAYER_TURN_RATE = 0.5;

/** Hedefe yaklaşım yumuşatma yarıçapı (m). */
export const PLAYER_APPROACH_RADIUS = 2.0;

/** Oyuncu durma eşiği (m/s). */
export const PLAYER_STOP_SPEED = 0.05;

/** Hedefe varış toleransı (m). */
export const PLAYER_TARGET_TOLERANCE = 0.05;

// ═══════════════════════════════════════════════
// KARAR ZAMANI
// ═══════════════════════════════════════════════

export const DECISION = {
  /** Top sahibi karar interval'i (saniye). */
  ballOwnerInterval: 0.15,

  /** Top sahibi olmayanlar için minimum interval. */
  minInterval: 0.3,

  /** Top sahibi olmayanlar için maksimum interval. */
  maxInterval: 1.5,

  /** Decisions katkı çarpanı. */
  decisionsWeight: 0.02,

  /** Anticipation katkı çarpanı. */
  anticipationWeight: 0.02,

  /** Concentration katkı çarpanı. */
  concentrationWeight: 0.01,

  /**
   * Attribute oranı (0-1) × qualityScale.
   */
  qualityScale: 20,

  /** Aday ağırlık tabanı. */
  candidateFloorWeight: 0.05,

  /**
   * Rastgele jitter.
   * V1'de 0 → deterministik karar.
   */
  jitter: 0.0,
} as const;

// ═══════════════════════════════════════════════
// CHASE ALLOCATION
// ═══════════════════════════════════════════════

/** Takım başına maksimum chase oyuncusu. */
export const MAX_CHASE_PER_TEAM = 2;

/** Chase skorunda mesafe ağırlığı. */
export const CHASE_DISTANCE_WEIGHT = -0.7;

/** Chase skorunda tackling ağırlığı. */
export const CHASE_TACKLING_WEIGHT = 0.3;

// ═══════════════════════════════════════════════
// PERCEPTION
// ═══════════════════════════════════════════════

/** Space map grid boyutu (m). */
export const SPACE_GRID_SIZE = 4.0;

/** Space hesabında rakip etki yarıçapı (m). */
export const SPACE_OPPONENT_RADIUS = 15.0;

/** Rakip başına maksimum space cezası. */
export const SPACE_OPPONENT_PENALTY = 40.0;

/**
 * Space hesaplanamadığında kullanılan nötr değer.
 *
 * SpaceMap hücreleri 0..100 ölçeğindedir.
 */
export const SPACE_NEUTRAL = 50;

/** Pressure yarıçapı (m). */
export const PRESSURE_RADIUS = 10.0;

/** Rakip başına maksimum pressure katkısı. */
export const PRESSURE_PER_OPPONENT = 30.0;

/** Yakındaki takım arkadaşı / rakip sayısı. */
export const NEARBY_PLAYER_COUNT = 5;

/** Openness yarıçapı (m). */
export const OPENNESS_RADIUS = 8.0;

/** Rakip başına maksimum openness düşüşü. */
export const OPENNESS_PENALTY = 25.0;

// ═══════════════════════════════════════════════
// PASS OPTIONS
// ═══════════════════════════════════════════════

/** Pas yolunu etkileyen rakip yarıçapı (m). */
export const PASS_LANE_INTERFERENCE_RADIUS = 3.0;

/** Mesafe cezasının başladığı mesafe (m). */
export const PASS_DISTANCE_PENALTY_START = 15.0;

/** Pas mesafe cezası ölçeği. */
export const PASS_DISTANCE_PENALTY_SCALE = 30.0;

/** Pas başarı olasılığı alt sınırı. */
export const PASS_PROBABILITY_MIN = 0.1;

/** Pas başarı olasılığı üst sınırı. */
export const PASS_PROBABILITY_MAX = 0.95;

/**
 * Pas başarı olasılığı ağırlıkları.
 *
 * p =
 *   laneClarity * laneClarityWeight
 * + attrBonus   * attributeWeight
 * - distancePenalty * distancePenaltyWeight
 */
export const PASS_SUCCESS = {
  laneClarityWeight: 0.9,
  attributeWeight: 0.1,
  distancePenaltyWeight: 0.4,
} as const;

/** Pas yolundaki interference çarpanı. */
export const PASS_LANE_INTERFERENCE_WEIGHT = 0.3;

/**
 * Pas aday skor ağırlıkları.
 *
 * score =
 *   successProbability * successWeight
 * + tacticalValue      * tacticalWeight
 * + spaceValue         * spaceWeight
 * - risk               * riskWeight
 */
export const PASS_SCORE = {
  successWeight: 0.5,
  tacticalWeight: 0.3,
  spaceWeight: 0.2,
  riskWeight: 0.2,
} as const;

/** Through ball minimum mesafesi (m). */
export const THROUGH_BALL_MIN_DISTANCE = 25.0;

/** Through ball minimum tactical fit. */
export const THROUGH_BALL_MIN_TACTICAL = 0.6;

// ═══════════════════════════════════════════════
// CROSS
// ═══════════════════════════════════════════════

/** Cross hedefi kale merkezine maksimum mesafe (m). */
export const CROSS_TARGET_RADIUS = 18.0;

/** Cross başarı olasılığı alt sınırı. */
export const CROSS_PROBABILITY_MIN = 0.2;

/** Cross başarı olasılığı üst sınırı. */
export const CROSS_PROBABILITY_MAX = 0.8;

/** Cross baz olasılığı. */
export const CROSS_BASE_PROBABILITY = 0.6;

/** Cross attribute katkısı. */
export const CROSS_ATTR_WEIGHT = 0.2;

/** Cross mesafe cezası ölçeği. */
export const CROSS_DISTANCE_DIVISOR = 100;

/** Cross aday baz skoru. */
export const CROSS_BASE_SCORE = 0.55;

/** Cross skorunda attribute ağırlığı. */
export const CROSS_SCORE_ATTR_WEIGHT = 0.3;

/** Cross risk değeri. */
export const CROSS_RISK = 0.5;

/** Cross tactical fit değeri. */
export const CROSS_TACTICAL_FIT = 0.7;

// ═══════════════════════════════════════════════
// SHOOT
// ═══════════════════════════════════════════════

/** Şut adayı üretilebilecek maksimum mesafe (m). */
export const SHOOT_MAX_DISTANCE = 30.0;

/** Şut xG baz değeri. */
export const SHOOT_XG_BASE = 0.55;

/** Şut xG mesafe cezası. */
export const SHOOT_XG_DISTANCE_PENALTY = 0.02;

/**
 * Yakın mesafe eşiği.
 *
 * Bu mesafenin altında xG,
 * SHOOT_XG_MAX değerine yaklaşır.
 */
export const SHOOT_XG_CLOSE_DISTANCE = 6.0;

/** Şut xG pressure cezası. */
export const SHOOT_XG_PRESSURE_PENALTY = 0.3;

/** Minimum xG. */
export const SHOOT_XG_MIN = 0.02;

/** Maksimum xG. */
export const SHOOT_XG_MAX = 0.7;

/** Şut aday skor ağırlıkları. */
export const SHOOT_SCORE = {
  xGWeight: 1.5,
  finishingWeight: 0.3,
  composureWeight: 0.2,
} as const;

/** Şut tactical fit. */
export const SHOOT_TACTICAL_FIT = 0.6;

// ═══════════════════════════════════════════════
// DRIBBLE
// ═══════════════════════════════════════════════

/** Dribble için gerekli minimum space farkı. */
export const DRIBBLE_SPACE_DIFF_THRESHOLD = 5.0;

/** Dribble hedefinin ileri mesafesi (m). */
export const DRIBBLE_FORWARD_DISTANCE = 5.0;

/** Dribble başarı olasılığı alt sınırı. */
export const DRIBBLE_PROBABILITY_MIN = 0.2;

/** Dribble başarı olasılığı üst sınırı. */
export const DRIBBLE_PROBABILITY_MAX = 0.9;

/** Dribble baz skor. */
export const DRIBBLE_BASE_SCORE = 0.4;

/**
 * Dribble space skor ölçeği.
 *
 * Space perception tarafında 0..100,
 * DecisionCandidate.spaceValue tarafında 0..1'dir.
 */
export const DRIBBLE_SPACE_SCORE_DIVISOR = 200;

/** Dribble risk. */
export const DRIBBLE_RISK = 0.4;

/** Dribble tactical fit. */
export const DRIBBLE_TACTICAL_FIT = 0.5;

// ═══════════════════════════════════════════════
// HOLD
// ═══════════════════════════════════════════════

export const HOLD_BASE_SCORE = 0.3;

export const HOLD_TACTICAL_FIT = 0.4;

// ═══════════════════════════════════════════════
// MARK
// ═══════════════════════════════════════════════

/** Mark adayı için maksimum rakip mesafesi (m). */
export const MARK_MAX_DISTANCE = 25.0;

/** Mark skorunda openness ağırlığı. */
export const MARK_OPENNESS_WEIGHT = 0.7;

/** Mark skorunda mesafe ağırlığı. */
export const MARK_DISTANCE_WEIGHT = 0.3;

/** Mark baz skor. */
export const MARK_BASE_SCORE = 0.4;

/** Mark skor ölçeği. */
export const MARK_SCORE_DIVISOR = 200;

/** Mark başarı olasılığı. */
export const MARK_SUCCESS_PROBABILITY = 0.7;

/** Mark risk. */
export const MARK_RISK = 0.1;

/** Mark tactical fit. */
export const MARK_TACTICAL_FIT = 0.6;

// ═══════════════════════════════════════════════
// TACKLE
// ═══════════════════════════════════════════════

/** Tackle kazanma olasılığı alt sınırı. */
export const TACKLE_WIN_MIN = 0.05;

/** Tackle kazanma olasılığı üst sınırı. */
export const TACKLE_WIN_MAX = 0.95;

/** Tackle sigmoid ölçeği. */
export const TACKLE_SIGMOID_SCALE = 2.5;

/** Tackle mesafe cezası ölçeği. */
export const TACKLE_DISTANCE_PENALTY_SCALE = 1.5;

/** Temiz top kazanma baz olasılığı. */
export const TACKLE_CLEAN_CHANCE_BASE = 0.6;

/** Tackling attribute katkısı. */
export const TACKLE_CLEAN_CHANCE_TACKLING = 0.3;

/** Tackle aday baz skoru. */
export const TACKLE_BASE_SCORE = 0.7;

/** Tackle skorunda tackling ağırlığı. */
export const TACKLE_SCORE_TACKLING_WEIGHT = 0.3;

/** Tackle skorunda aggression ağırlığı. */
export const TACKLE_SCORE_AGGRESSION_WEIGHT = 0.1;

/** Tackle aday tahmini başarı olasılığı. */
export const TACKLE_ESTIMATED_SUCCESS = 0.5;

/** Tackle risk. */
export const TACKLE_RISK = 0.4;

/** Tackle tactical fit. */
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

/** Home position'a dönüş için minimum mesafe (m). */
export const RETURN_DISTANCE_THRESHOLD = 8.0;

/** Return baz skor. */
export const RETURN_BASE_SCORE = 0.4;

/** Return skor mesafe ölçeği. */
export const RETURN_SCORE_DIVISOR = 100;

/** Return başarı olasılığı. */
export const RETURN_SUCCESS_PROBABILITY = 1.0;

/** Return tactical fit. */
export const RETURN_TACTICAL_FIT = 0.4;

/** Hiç return adayı bulunamazsa fallback skor. */
export const RETURN_FALLBACK_SCORE = 0.5;

/** Support hedefinin top sahibinin önündeki mesafesi (m). */
export const SUPPORT_FORWARD_OFFSET = 15.0;

/** Support için minimum space değeri. */
export const SUPPORT_MIN_SPACE = 40.0;

/** Support baz skor. */
export const SUPPORT_BASE_SCORE = 0.5;

/** Support space skor ölçeği. */
export const SUPPORT_SPACE_DIVISOR = 200;

/** Support başarı olasılığı. */
export const SUPPORT_SUCCESS_PROBABILITY = 0.9;

/** Support risk. */
export const SUPPORT_RISK = 0.1;

/** Support tactical fit. */
export const SUPPORT_TACTICAL_FIT = 0.7;

/** Chase baz skor. */
export const CHASE_BASE_SCORE = 1.0;

/** Chase skor mesafe ölçeği. */
export const CHASE_SCORE_DIVISOR = 50;

/** Chase başarı olasılığı. */
export const CHASE_SUCCESS_PROBABILITY = 0.9;

/** Chase tactical fit. */
export const CHASE_TACTICAL_FIT = 0.9;

// ═══════════════════════════════════════════════
// FAUL
// ═══════════════════════════════════════════════

/** Faul olasılığı alt sınırı. */
export const FOUL_PROBABILITY_MIN = 0.05;

/** Faul olasılığı üst sınırı. */
export const FOUL_PROBABILITY_MAX = 0.6;

/** Faul baz olasılığı. */
export const FOUL_BASE_PROBABILITY = 0.15;

/** Faul aggression katkısı. */
export const FOUL_AGGRESSION_WEIGHT = 0.2;

/** Faul mesafe katkısı. */
export const FOUL_DISTANCE_WEIGHT = 0.25;

/** Hafif faul şiddeti eşiği. */
export const FOUL_SEVERITY_LIGHT = 0.35;

/** Orta faul şiddeti eşiği. */
export const FOUL_SEVERITY_MEDIUM = 0.65;

/** Faul şiddetinde aggression ağırlığı. */
export const FOUL_SEVERITY_AGGRESSION = 0.5;

/** Faul şiddetinde bravery ağırlığı. */
export const FOUL_SEVERITY_BRAVERY = 0.3;

/** Faul şiddetinde mesafe ağırlığı. */
export const FOUL_SEVERITY_DISTANCE = 0.2;

// ═══════════════════════════════════════════════
// SET-PIECE
// ═══════════════════════════════════════════════

/** Oyuncu hedef pozisyona bu mesafedeyse hazır kabul edilir (m). */
export const SET_PIECE_POSITION_TOLERANCE = 0.5;

/** Positioning için maksimum güvenlik süresi (saniye). */
export const SET_PIECE_MAX_POSITIONING_SECONDS = 8.0;

/** Taç oyuncusunun çizgiden içeri mesafesi (m). */
export const THROW_IN_DISTANCE_FROM_LINE = 0.5;

/** Barajın topa mesafesi (m). */
export const WALL_DISTANCE = 9.15;

/** Baraj oyuncuları arasındaki mesafe (m). */
export const WALL_PLAYER_SPACING = 0.6;

/** Set-piece türüne göre gerekli oyuncu sayısı. */
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

/**
 * Intent başına varsayılan güç çarpanları.
 *
 * KONTRAT:
 *   power ∈ [0, 1]
 *
 * movement.ts bu değeri hedef hıza çevirir.
 */
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

/** Her tick snapshot alınsın mı? */
export const SNAPSHOT_EVERY_TICK = false;

/** Snapshot geçmişinin maksimum uzunluğu. */
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

  ballOwnerDecisionInterval:
    DECISION.ballOwnerInterval,

  spaceGridSize: SPACE_GRID_SIZE,

  ballPhysics: DEFAULT_BALL_PHYSICS,

  playerPhysics: DEFAULT_PLAYER_PHYSICS,

  seed: null,
};