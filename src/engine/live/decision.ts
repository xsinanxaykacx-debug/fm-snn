/**
 * src/engine/live/decision.ts
 *
 * KARAR KATMANI
 * ==============
 *
 * Bu dosya oyuncunun bu tick'te ne yapacağına karar verir.
 *
 * SORUMLULUKLAR
 * -------------
 * - Decision timing
 * - Full perception
 * - Context belirleme
 * - Priority layer
 * - Chase allocation
 * - Ball action candidate üretimi
 * - Seeded weightedChoice
 * - Decision üretimi
 *
 * YASAK
 * -----
 * - Oyuncu hareket ettirmek
 * - Top fiziği
 * - MatchEvent üretmek
 * - Stat güncellemek
 * - Math.random()
 * - Fizik uygulamak
 *
 * MİMARİ
 * ------
 *
 * SET-PIECE
 *     ↓
 * CONTEXT
 *     ↓
 * ┌─────────────────────────────────────┐
 * │ Rakip topu                          │
 * │   TACKLE                            │
 * │   CHASE                             │
 * │   MARK                              │
 * │   RETURN                            │
 * │                                     │
 * │ Takım arkadaşı topu                │
 * │   SUPPORT                           │
 * │   RETURN                            │
 * │                                     │
 * │ Loose ball                          │
 * │   CHASE                             │
 * │   MARK                              │
 * │   RETURN                            │
 * └─────────────────────────────────────┘
 *
 * Top bende:
 *   BALL ACTION
 *     pass
 *     through_ball
 *     cross
 *     shoot
 *     dribble
 *     hold
 *
 * weightedChoice SADECE Ball Action'da kullanılır.
 */

import type {
  Ball,
  Decision,
  DecisionCandidate,
  DecisionCandidateType,
  DecisionDebug,
  DecisionReason,
  LivePlayer,
  Perception,
  PitchDimensions,
  PlayerPhysicsConfig,
  RngState,
  SetPieceState,
  Vec2,
} from '../types';

import {
  // Decision timing
  DECISION,

  // Chase
  CHASE_DISTANCE_WEIGHT,
  CHASE_TACKLING_WEIGHT,
  MAX_CHASE_PER_TEAM,

  // Pass
  PASS_SCORE,
  THROUGH_BALL_MIN_DISTANCE,
  THROUGH_BALL_MIN_TACTICAL,

  // Cross
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

  // Shoot
  SHOOT_MAX_DISTANCE,
  SHOOT_XG_BASE,
  SHOOT_XG_CLOSE_DISTANCE,
  SHOOT_XG_DISTANCE_PENALTY,
  SHOOT_XG_PRESSURE_PENALTY,
  SHOOT_XG_MIN,
  SHOOT_XG_MAX,
  SHOOT_SCORE,
  SHOOT_TACTICAL_FIT,

  // Dribble
  DRIBBLE_SPACE_DIFF_THRESHOLD,
  DRIBBLE_FORWARD_DISTANCE,
  DRIBBLE_PROBABILITY_MIN,
  DRIBBLE_PROBABILITY_MAX,
  DRIBBLE_BASE_SCORE,
  DRIBBLE_SPACE_SCORE_DIVISOR,
  DRIBBLE_RISK,
  DRIBBLE_TACTICAL_FIT,

  // Hold
  HOLD_BASE_SCORE,
  HOLD_TACTICAL_FIT,

  // Mark
  MARK_MAX_DISTANCE,
  MARK_OPENNESS_WEIGHT,
  MARK_DISTANCE_WEIGHT,

  // Tackle
  TACKLE_BASE_SCORE,
  TACKLE_SCORE_TACKLING_WEIGHT,
  TACKLE_SCORE_AGGRESSION_WEIGHT,
  TACKLE_ESTIMATED_SUCCESS,
  TACKLE_RISK,
  TACKLE_TACTICAL_FIT,

  // Intercept
  INTERCEPT_BASE_SCORE,
  INTERCEPT_ESTIMATED_SUCCESS,
  INTERCEPT_RISK,
  INTERCEPT_TACTICAL_FIT,

  // Return
  RETURN_DISTANCE_THRESHOLD,
  RETURN_BASE_SCORE,
  RETURN_SCORE_DIVISOR,
  RETURN_SUCCESS_PROBABILITY,
  RETURN_TACTICAL_FIT,
  RETURN_FALLBACK_SCORE,

  // Support
  SUPPORT_FORWARD_OFFSET,
  SUPPORT_MIN_SPACE,
  SUPPORT_BASE_SCORE,
  SUPPORT_SPACE_DIVISOR,
  SUPPORT_SUCCESS_PROBABILITY,
  SUPPORT_RISK,
  SUPPORT_TACTICAL_FIT,

  // Chase
  CHASE_BASE_SCORE,
  CHASE_SCORE_DIVISOR,
  CHASE_SUCCESS_PROBABILITY,
  CHASE_TACTICAL_FIT,

  // Power
  DECISION_POWER,

  // Space
  SPACE_NEUTRAL,

  // Set-piece
  SET_PIECE_POSITION_TOLERANCE,
} from './config';

import {
  computeDistance,
  computeFullPerception,
} from './perception';

import { weightedChoice } from './rng';


// ============================================================
// TEMEL YARDIMCILAR
// ============================================================

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function attrRatio(value: number): number {
  return clamp01(value / 20);
}


// ============================================================
// SPACE
// ============================================================

/**
 * Perception space değerini 0-1 ölçeğine çevirir.
 *
 * perception.space.cells:
 *   0..100
 *
 * DecisionCandidate.spaceValue:
 *   0..1
 */
function sampleSpace01(
  perception: Perception,
  position: Vec2
): number {
  return sampleSpaceRaw(perception, position) / 100;
}

function sampleSpaceRaw(
  perception: Perception,
  position: Vec2
): number {
  const { space } = perception;

  const col = Math.floor(position.x / space.gridSize);
  const row = Math.floor(position.y / space.gridSize);

  if (
    col < 0 ||
    col >= space.cols ||
    row < 0 ||
    row >= space.rows
  ) {
    return SPACE_NEUTRAL;
  }

  return space.cells[row * space.cols + col];
}


// ============================================================
// DECISION TIMING
// ============================================================

export function computeDecisionInterval(
  player: LivePlayer
): number {
  if (player.isBallOwner) {
    return DECISION.ballOwnerInterval;
  }

  const attributes = player.player.attributes;

  const decisionsBonus =
    attrRatio(attributes.decisions) *
    DECISION.decisionsWeight *
    DECISION.qualityScale;

  const anticipationBonus =
    attrRatio(attributes.anticipation) *
    DECISION.anticipationWeight *
    DECISION.qualityScale;

  const concentrationBonus =
    attrRatio(attributes.concentration) *
    DECISION.concentrationWeight *
    DECISION.qualityScale;

  const interval =
    DECISION.maxInterval -
    decisionsBonus -
    anticipationBonus -
    concentrationBonus;

  return Math.max(
    DECISION.minInterval,
    Math.min(
      DECISION.maxInterval,
      interval
    )
  );
}

export function shouldDecide(
  player: LivePlayer,
  time: number
): boolean {
  return time >= player.nextDecisionTime;
}


// ============================================================
// CHASE ALLOCATION
// ============================================================

/**
 * Her takım için en fazla MAX_CHASE_PER_TEAM oyuncu seçilir.
 *
 * Skor:
 *
 *   distance * CHASE_DISTANCE_WEIGHT
 *   +
 *   tackling * CHASE_TACKLING_WEIGHT
 *
 * CHASE_DISTANCE_WEIGHT negatif olduğu için
 * daha yakın oyuncu daha yüksek skor alır.
 *
 * Tie-break:
 *   player.id ASC
 */
export function allocateChase(
  teamPlayers: LivePlayer[],
  ballPosition: Vec2
): Set<string> {
  const scored = teamPlayers.map(player => {
    const distance = computeDistance(
      player.position,
      ballPosition
    );

    const tackling = attrRatio(
      player.player.attributes.tackling
    );

    const score =
      distance * CHASE_DISTANCE_WEIGHT +
      tackling * CHASE_TACKLING_WEIGHT;

    return {
      id: player.player.id,
      score,
    };
  });

  scored.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    return a.id.localeCompare(b.id);
  });

  const chase = new Set<string>();

  const limit = Math.min(
    MAX_CHASE_PER_TEAM,
    scored.length
  );

  for (let i = 0; i < limit; i++) {
    chase.add(scored[i].id);
  }

  return chase;
}


// ============================================================
// BALL ACTION
// ============================================================

function generateBallCarrierCandidates(
  self: LivePlayer,
  perception: Perception,
  state: DecisionState
): DecisionCandidate[] {
  const candidates: DecisionCandidate[] = [];


  // ==========================================================
  // PASS
  // ==========================================================

  for (const option of perception.passOptions) {
    const successProbability =
      clamp01(option.successProbability);

    const tacticalFit =
      clamp01(option.tacticalValue);

    const risk =
      clamp01(1 - option.laneClarity);

    const spaceValue =
      sampleSpace01(
        perception,
        option.targetPosition
      );

    const attributeFit =
      attrRatio(
        self.player.attributes.passing
      );

    const score =
      successProbability *
        PASS_SCORE.successWeight +
      tacticalFit *
        PASS_SCORE.tacticalWeight +
      spaceValue *
        PASS_SCORE.spaceWeight -
      risk *
        PASS_SCORE.riskWeight;

    const isThroughBall =
      option.distance > THROUGH_BALL_MIN_DISTANCE &&
      option.tacticalValue > THROUGH_BALL_MIN_TACTICAL;

    candidates.push({
      type: isThroughBall
        ? 'through_ball'
        : 'pass',

      targetPlayerId:
        option.targetPlayerId,

      target:
        option.targetPosition,

      score,

      successProbability,

      risk,

      tacticalFit,

      attributeFit,

      spaceValue,

      pressurePenalty:
        clamp01(perception.pressure / 100),

      reason: isThroughBall
        ? 'through_ball'
        : 'pass',
    });
  }


  // ==========================================================
  // CROSS
  // ==========================================================

  const onWing =
    perception.zone.self === 'attack_left' ||
    perception.zone.self === 'attack_right' ||
    perception.zone.self === 'midfield_left' ||
    perception.zone.self === 'midfield_right';

  if (onWing) {
    const crossTarget =
      findCrossTarget(
        perception,
        state
      );

    if (crossTarget !== null) {
      const distance =
        computeDistance(
          self.position,
          crossTarget.position
        );

      const crossing =
        attrRatio(
          self.player.attributes.crossing
        );

      const successProbability =
        clamp01(
          Math.max(
            CROSS_PROBABILITY_MIN,
            Math.min(
              CROSS_PROBABILITY_MAX,
              CROSS_BASE_PROBABILITY +
                crossing * CROSS_ATTR_WEIGHT -
                distance / CROSS_DISTANCE_DIVISOR
            )
          )
        );

      const spaceValue =
        sampleSpace01(
          perception,
          crossTarget.position
        );

      const score =
        CROSS_BASE_SCORE +
        crossing * CROSS_SCORE_ATTR_WEIGHT;

      candidates.push({
        type: 'cross',

        targetPlayerId:
          crossTarget.id,

        target:
          crossTarget.position,

        score,

        successProbability,

        risk:
          clamp01(CROSS_RISK),

        tacticalFit:
          clamp01(CROSS_TACTICAL_FIT),

        attributeFit:
          crossing,

        spaceValue,

        pressurePenalty:
          clamp01(perception.pressure / 100),

        reason: 'cross',
      });
    }
  }


  // ==========================================================
  // SHOOT
  // ==========================================================

  const distanceToGoal =
    computeDistance(
      self.position,
      state.attackingGoalPos
    );

  if (distanceToGoal < SHOOT_MAX_DISTANCE) {
    const finishing =
      attrRatio(
        self.player.attributes.finishing
      );

    const composure =
      attrRatio(
        self.player.attributes.composure
      );

    const technique =
      attrRatio(
        self.player.attributes.technique
      );

    const xG =
      estimateXG(
        distanceToGoal,
        perception.pressure
      );

    const score =
      xG * SHOOT_SCORE.xGWeight +
      finishing *
        SHOOT_SCORE.finishingWeight +
      composure *
        SHOOT_SCORE.composureWeight;

    candidates.push({
      type: 'shoot',

      targetPlayerId: null,

      target:
        state.attackingGoalPos,

      score,

      successProbability:
        clamp01(xG),

      risk:
        clamp01(1 - xG),

      tacticalFit:
        clamp01(SHOOT_TACTICAL_FIT),

      attributeFit:
        clamp01(
          (finishing +
            composure +
            technique) / 3
        ),

      spaceValue:
        sampleSpace01(
          perception,
          self.position
        ),

      pressurePenalty:
        clamp01(perception.pressure / 100),

      reason: 'shoot',
    });
  }


  // ==========================================================
  // DRIBBLE
  // ==========================================================

  const dribbling =
    attrRatio(
      self.player.attributes.dribbling
    );

  const agility =
    attrRatio(
      self.player.attributes.agility
    );

  const spaceHere =
    sampleSpace01(
      perception,
      self.position
    );

  const dribbleTarget: Vec2 = {
    x:
      self.position.x +
      DRIBBLE_FORWARD_DISTANCE,

    y:
      self.position.y,
  };

  const spaceAhead =
    sampleSpace01(
      perception,
      dribbleTarget
    );

  const spaceDifference =
    spaceAhead - spaceHere;

  if (
    spaceDifference >
    DRIBBLE_SPACE_DIFF_THRESHOLD / 100
  ) {
    const pressure =
      clamp01(
        perception.pressure / 100
      );

    const rawSuccess =
      dribbling * 0.6 +
      agility * 0.4 -
      pressure;

    const successProbability =
      Math.max(
        DRIBBLE_PROBABILITY_MIN,
        Math.min(
          DRIBBLE_PROBABILITY_MAX,
          rawSuccess
        )
      );

    const score =
      DRIBBLE_BASE_SCORE +
      spaceAhead *
        (100 / DRIBBLE_SPACE_SCORE_DIVISOR);

    candidates.push({
      type: 'dribble',

      targetPlayerId: null,

      target: dribbleTarget,

      score,

      successProbability,

      risk:
        clamp01(DRIBBLE_RISK),

      tacticalFit:
        clamp01(DRIBBLE_TACTICAL_FIT),

      attributeFit:
        clamp01(
          (dribbling + agility) / 2
        ),

      spaceValue:
        clamp01(spaceAhead),

      pressurePenalty:
        pressure,

      reason: 'dribble',
    });
  }


  // ==========================================================
  // HOLD
  // ==========================================================

  candidates.push({
    type: 'hold',

    targetPlayerId: null,

    target: null,

    score:
      HOLD_BASE_SCORE,

    successProbability: 1,

    risk: 0,

    tacticalFit:
      clamp01(HOLD_TACTICAL_FIT),

    attributeFit:
      attrRatio(
        self.player.attributes.technique
      ),

    spaceValue:
      clamp01(spaceHere),

    pressurePenalty: 0,

    reason: 'hold',
  });

  return candidates;
}


// ============================================================
// BALL ACTION SEÇİMİ
// ============================================================

function decideBallAction(
  self: LivePlayer,
  perception: Perception,
  state: DecisionState
): {
  decision: Decision;
  selected: DecisionCandidate | null;
  candidates: DecisionCandidate[];
} {
  const candidates =
    generateBallCarrierCandidates(
      self,
      perception,
      state
    );

  if (candidates.length === 0) {
    const decision: Decision = {
      intent: 'hold',
      reason: 'hold',
      target: null,
      targetPlayerId: null,
      power: 0,
      timestamp: state.time,
    };

    return {
      decision,
      selected: null,
      candidates: [],
    };
  }


  // ----------------------------------------------------------
  // Aday skorlarını pozitif ağırlıklara dönüştür
  // ----------------------------------------------------------

  const minScore =
    Math.min(
      ...candidates.map(
        candidate => candidate.score
      )
    );

  const weights =
    candidates.map(candidate =>
      Math.max(
        DECISION.candidateFloorWeight,
        candidate.score - minScore
      )
    );


  // ----------------------------------------------------------
  // RNG SADECE BURADA
  // ----------------------------------------------------------

  const selected =
    weightedChoice(
      state.rng,
      candidates,
      weights
    );

  const intent =
    candidateTypeToIntent(
      selected.type
    );

  const decision: Decision = {
    intent,

    reason:
      selected.type,

    target:
      selected.target,

    targetPlayerId:
      selected.targetPlayerId,

    power:
      computePowerForCandidate(
        selected
      ),

    timestamp:
      state.time,
  };

  return {
    decision,
    selected,
    candidates,
  };
}


// ============================================================
// PRIORITY LAYER
// ============================================================

/**
 * Top sahibi olmayan oyuncular için çalışır.
 *
 * weightedChoice YOK.
 *
 * Öncelik:
 *
 * SET-PIECE
 *     ↓
 * rakip topu:
 * TACKLE
 * CHASE
 * MARK
 * RETURN
 *
 * takım arkadaşı topu:
 * SUPPORT
 * RETURN
 *
 * loose:
 * CHASE
 * MARK
 * RETURN
 */
function decidePriorityIntent(
  self: LivePlayer,
  perception: Perception,
  state: DecisionState,
  chaseSet: Set<string>,
  ballCarrier: LivePlayer | null
): Decision {
  const ballPosition: Vec2 = {
    x: state.ball.position.x,
    y: state.ball.position.y,
  };


  // ==========================================================
  // 1 — SET PIECE
  // ==========================================================

  if (
    state.setPiece !== null &&
    (
      state.setPiece.status === 'positioning' ||
      state.setPiece.status === 'ready'
    )
  ) {
    return decideSetPiece(
      self,
      state.setPiece,
      state.time
    );
  }


  // ==========================================================
  // 2 — RAKİP TOP SAHİBİ
  // ==========================================================

  if (
    ballCarrier !== null &&
    ballCarrier.clubId !== self.clubId
  ) {
    const distanceToCarrier =
      computeDistance(
        self.position,
        ballCarrier.position
      );


    // --------------------------------------------------------
    // TACKLE
    // --------------------------------------------------------

    if (
      distanceToCarrier <=
      state.playerPhysics.tackleRadius
    ) {
      const tackling =
        attrRatio(
          self.player.attributes.tackling
        );

      const aggression =
        attrRatio(
          self.player.attributes.aggression
        );

      const score =
        TACKLE_BASE_SCORE +
        tackling *
          TACKLE_SCORE_TACKLING_WEIGHT +
        aggression *
          TACKLE_SCORE_AGGRESSION_WEIGHT;

      void score;

      return {
        intent: 'tackle',

        reason: 'tackle',

        target:
          ballCarrier.position,

        targetPlayerId:
          ballCarrier.player.id,

        power:
          DECISION_POWER.tackle,

        timestamp:
          state.time,
      };
    }


    // --------------------------------------------------------
    // CHASE
    // --------------------------------------------------------

    if (
      chaseSet.has(
        self.player.id
      )
    ) {
      return {
        intent: 'move',

        reason: 'chase',

        target:
          ballPosition,

        targetPlayerId: null,

        power:
          DECISION_POWER.move,

        timestamp:
          state.time,
      };
    }


    // --------------------------------------------------------
    // MARK
    // --------------------------------------------------------

    const markTarget =
      findMarkTarget(
        self,
        perception
      );

    if (markTarget !== null) {
      return {
        intent: 'mark',

        reason: 'mark',

        target:
          markTarget.position,

        targetPlayerId:
          markTarget.id,

        power:
          DECISION_POWER.mark,

        timestamp:
          state.time,
      };
    }


    // --------------------------------------------------------
    // RETURN
    // --------------------------------------------------------

    return makeReturnDecision(
      self,
      state.time
    );
  }


  // ==========================================================
  // 3 — TAKIM ARKADAŞI TOP SAHİBİ
  // ==========================================================

  if (
    ballCarrier !== null &&
    ballCarrier.clubId === self.clubId
  ) {
    const supportPosition =
      computeSupportPosition(
        self,
        ballCarrier,
        state
      );

    const supportSpace =
      sampleSpace01(
        perception,
        supportPosition
      );

    if (
      supportSpace >
      SUPPORT_MIN_SPACE / 100
    ) {
      return {
        intent: 'move',

        reason: 'support',

        target:
          supportPosition,

        targetPlayerId: null,

        power:
          DECISION_POWER.move,

        timestamp:
          state.time,
      };
    }

    return makeReturnDecision(
      self,
      state.time
    );
  }


  // ==========================================================
  // 4 — LOOSE BALL
  // ==========================================================

  if (ballCarrier === null) {

    // --------------------------------------------------------
    // CHASE
    // --------------------------------------------------------

    if (
      chaseSet.has(
        self.player.id
      )
    ) {
      return {
        intent: 'move',

        reason: 'chase',

        target:
          ballPosition,

        targetPlayerId: null,

        power:
          DECISION_POWER.move,

        timestamp:
          state.time,
      };
    }


    // --------------------------------------------------------
    // MARK
    // --------------------------------------------------------

    const markTarget =
      findMarkTarget(
        self,
        perception
      );

    if (markTarget !== null) {
      return {
        intent: 'mark',

        reason: 'mark',

        target:
          markTarget.position,

        targetPlayerId:
          markTarget.id,

        power:
          DECISION_POWER.mark,

        timestamp:
          state.time,
      };
    }


    // --------------------------------------------------------
    // RETURN
    // --------------------------------------------------------

    return makeReturnDecision(
      self,
      state.time
    );
  }


  // ==========================================================
  // FALLBACK
  // ==========================================================

  return makeReturnDecision(
    self,
    state.time
  );
}


// ============================================================
// SET PIECE
// ============================================================

function decideSetPiece(
  self: LivePlayer,
  setPiece: SetPieceState,
  time: number
): Decision {
  const target =
    setPiece.targetPositions[
      self.player.id
    ];


  // ----------------------------------------------------------
  // Hedefi olan oyuncu
  // ----------------------------------------------------------

  if (target !== undefined) {
    const distance =
      computeDistance(
        self.position,
        target
      );

    if (
      distance >
      SET_PIECE_POSITION_TOLERANCE
    ) {
      return {
        intent: 'move',

        reason: 'set_piece',

        target,

        targetPlayerId: null,

        power:
          DECISION_POWER.move,

        timestamp: time,
      };
    }


    // --------------------------------------------------------
    // Hedefe ulaştı
    // --------------------------------------------------------

    return {
      intent: 'hold',

      reason: 'set_piece',

      target,

      targetPlayerId: null,

      power: 0,

      timestamp: time,
    };
  }


  // ----------------------------------------------------------
  // Hedefi yoksa normal formation'a dönmez.
  //
  // Set-piece aktif olduğu sürece normal karar ağacına
  // geçilmemesi gerekiyor.
  // ----------------------------------------------------------

  return {
    intent: 'hold',

    reason: 'set_piece',

    target: null,

    targetPlayerId: null,

    power: 0,

    timestamp: time,
  };
}


// ============================================================
// RETURN
// ============================================================

function makeReturnDecision(
  self: LivePlayer,
  time: number
): Decision {
  return {
    intent: 'return_to_position',

    reason: 'formation',

    target:
      self.homePosition,

    targetPlayerId: null,

    power:
      DECISION_POWER.return,

    timestamp: time,
  };
}


// ============================================================
// SUPPORT POSITION
// ============================================================

function computeSupportPosition(
  self: LivePlayer,
  ballCarrier: LivePlayer,
  state: DecisionState
): Vec2 {
  const offset =
    state.attackingDirection *
    SUPPORT_FORWARD_OFFSET;

  return {
    x:
      ballCarrier.position.x +
      offset,

    y:
      ballCarrier.position.y,
  };
}


// ============================================================
// CROSS TARGET
// ============================================================

function findCrossTarget(
  perception: Perception,
  state: DecisionState
): {
  id: string;
  position: Vec2;
} | null {
  const goalPosition =
    state.attackingGoalPos;

  let best:
    {
      id: string;
      position: Vec2;
      distance: number;
    } | null = null;

  for (
    const teammate
    of perception.teammates
  ) {
    const distanceToGoal =
      computeDistance(
        teammate.position,
        goalPosition
      );

    if (
      distanceToGoal >
      CROSS_TARGET_RADIUS
    ) {
      continue;
    }

    if (
      best === null ||
      distanceToGoal <
        best.distance
    ) {
      best = {
        id:
          teammate.id,

        position:
          teammate.position,

        distance:
          distanceToGoal,
      };
    }
  }

  if (best === null) {
    return null;
  }

  return {
    id: best.id,
    position: best.position,
  };
}


// ============================================================
// MARK TARGET
// ============================================================

function findMarkTarget(
  self: LivePlayer,
  perception: Perception
): {
  id: string;
  position: Vec2;
} | null {
  let best:
    {
      id: string;
      position: Vec2;
      score: number;
    } | null = null;

  for (
    const opponent
    of perception.opponents
  ) {
    if (
      opponent.distance >
      MARK_MAX_DISTANCE
    ) {
      continue;
    }


    // openness:
    //   0   = çok kapalı
    //   100 = çok açık
    //
    // Tehdit:
    //   0..1

    const opennessThreat =
      clamp01(
        1 -
        opponent.openness / 100
      );


    // Yakınlık:
    //   0..1

    const distanceScore =
      clamp01(
        (
          MARK_MAX_DISTANCE -
          opponent.distance
        ) /
        MARK_MAX_DISTANCE
      );


    const score =
      opennessThreat *
        MARK_OPENNESS_WEIGHT +
      distanceScore *
        MARK_DISTANCE_WEIGHT;

    if (
      best === null ||
      score > best.score ||
      (
        score === best.score &&
        opponent.id.localeCompare(
          best.id
        ) < 0
      )
    ) {
      best = {
        id:
          opponent.id,

        position:
          opponent.position,

        score,
      };
    }
  }

  if (best === null) {
    return null;
  }

  return {
    id: best.id,
    position: best.position,
  };
}


// ============================================================
// INTENT
// ============================================================

function candidateTypeToIntent(
  type: DecisionCandidateType
): Decision['intent'] {
  switch (type) {

    case 'pass':
    case 'through_ball':
    case 'clear':
      return 'pass';

    case 'cross':
      return 'cross';

    case 'shoot':
      return 'shoot';

    case 'dribble':
      return 'dribble';

    case 'hold':
      return 'hold';

    case 'move':
      return 'move';

    case 'return':
      return 'return_to_position';

    case 'tackle':
      return 'tackle';

    case 'intercept':
      return 'intercept';

    case 'mark':
      return 'mark';

    default:
      return 'idle';
  }
}


// ============================================================
// POWER
// ============================================================

function computePowerForCandidate(
  candidate: DecisionCandidate
): number {
  switch (candidate.type) {

    case 'shoot':
      return (
        DECISION_POWER.shootBase +
        candidate.attributeFit *
          DECISION_POWER.shootAttrWeight
      );

    case 'pass':
    case 'through_ball':
      return (
        DECISION_POWER.passBase +
        candidate.successProbability *
          DECISION_POWER.passSuccessWeight
      );

    case 'cross':
      return (
        DECISION_POWER.crossBase +
        candidate.attributeFit *
          DECISION_POWER.crossAttrWeight
      );

    case 'clear':
      return DECISION_POWER.clearance;

    case 'dribble':
      return DECISION_POWER.dribble;

    case 'move':
      return DECISION_POWER.move;

    case 'return':
      return DECISION_POWER.return;

    case 'hold':
      return DECISION_POWER.hold;

    case 'tackle':
      return DECISION_POWER.tackle;

    case 'intercept':
      return DECISION_POWER.intercept;

    case 'mark':
      return DECISION_POWER.mark;

    default:
      return DECISION_POWER.default;
  }
}


// ============================================================
// XG
// ============================================================

function estimateXG(
  distanceToGoal: number,
  pressure: number
): number {

  // Çok uzak:
  // mevcut minimum xG kullanılır.

  if (
    distanceToGoal >
    SHOOT_MAX_DISTANCE
  ) {
    return SHOOT_XG_MIN;
  }


  // Yakın mesafe:
  // maksimum xG'ye ulaş.

  if (
    distanceToGoal <=
    SHOOT_XG_CLOSE_DISTANCE
  ) {
    return SHOOT_XG_MAX;
  }


  const base =
    SHOOT_XG_BASE -
    (
      distanceToGoal -
      SHOOT_XG_CLOSE_DISTANCE
    ) *
    SHOOT_XG_DISTANCE_PENALTY;


  const pressurePenalty =
    clamp01(pressure / 100) *
    SHOOT_XG_PRESSURE_PENALTY;


  return Math.max(
    SHOOT_XG_MIN,

    Math.min(
      SHOOT_XG_MAX,
      base - pressurePenalty
    )
  );
}


// ============================================================
// DECISION STATE
// ============================================================

export interface DecisionState {
  ball: Ball;

  players:
    Record<string, LivePlayer>;

  pitch:
    PitchDimensions;

  time: number;

  rng:
    RngState;

  attackingDirection:
    1 | -1;

  attackingGoalPos:
    Vec2;

  playerPhysics:
    Pick<
      PlayerPhysicsConfig,
      'tackleRadius'
    >;

  setPiece:
    SetPieceState | null;
}


// ============================================================
// TEK OYUNCU KARARI
// ============================================================

export function decideForPlayer(
  self: LivePlayer,
  state: DecisionState,
  chaseSet: Set<string>
): {
  decision: Decision;
  debug: DecisionDebug;
} {

  const perception =
    computeFullPerception(
      self,
      {
        ball:
          state.ball,

        players:
          state.players,

        pitch:
          state.pitch,

        time:
          state.time,
      }
    );


  const ball =
    state.ball;

  const ballOwnerId =
    ball.ownerId;

  const ballCarrier =
    ballOwnerId !== null
      ? (
          state.players[
            ballOwnerId
          ] ?? null
        )
      : null;


  // ==========================================================
  // BENDE TOP
  // ==========================================================

  if (
    ballCarrier !== null &&
    ballCarrier.player.id ===
      self.player.id
  ) {
    const result =
      decideBallAction(
        self,
        perception,
        state
      );

    return {
      decision:
        result.decision,

      debug: {
        playerId:
          self.player.id,

        playerName:
          self.player.name,

        timestamp:
          state.time,

        perception,

        candidates:
          result.candidates,

        selected:
          result.selected,

        decision:
          result.decision,

        reason:
          result.decision.reason,
      },
    };
  }


  // ==========================================================
  // TOP BENDE DEĞİL
  // ==========================================================

  const decision =
    decidePriorityIntent(
      self,
      perception,
      state,
      chaseSet,
      ballCarrier
    );


  return {
    decision,

    debug: {
      playerId:
        self.player.id,

      playerName:
        self.player.name,

      timestamp:
        state.time,

      perception,

      candidates: [],

      selected: null,

      decision,

      reason:
        decision.reason,
    },
  };
}


// ============================================================
// TÜM OYUNCULAR
// ============================================================

export interface ComputeAllDecisionsResult {
  decisions:
    Record<string, Decision>;

  debugs:
    Record<string, DecisionDebug>;
}

export function computeAllDecisions(
  state: DecisionState
): ComputeAllDecisionsResult {

  const decisions:
    Record<string, Decision> = {};

  const debugs:
    Record<string, DecisionDebug> = {};


  // ----------------------------------------------------------
  // Deterministik oyuncu sırası
  // ----------------------------------------------------------

  const allPlayers =
    Object.keys(
      state.players
    )
      .sort()
      .map(
        id => state.players[id]
      );


  const ballPosition: Vec2 = {
    x:
      state.ball.position.x,

    y:
      state.ball.position.y,
  };


  // ----------------------------------------------------------
  // Takım chase allocation
  // ----------------------------------------------------------

  const homePlayers =
    allPlayers.filter(
      player => player.isHome
    );

  const awayPlayers =
    allPlayers.filter(
      player => !player.isHome
    );


  const homeChase =
    allocateChase(
      homePlayers,
      ballPosition
    );

  const awayChase =
    allocateChase(
      awayPlayers,
      ballPosition
    );


  // ----------------------------------------------------------
  // Karar üretimi
  // ----------------------------------------------------------

  for (
    const id of Object.keys(
      state.players
    ).sort()
  ) {
    const player =
      state.players[id];


    // ========================================================
    // KARAR ZAMANI GELMEDİ
    // ========================================================

    if (
      !shouldDecide(
        player,
        state.time
      )
    ) {
      const currentDecision =
        player.currentDecision;


      decisions[id] =
        currentDecision ??
        {
          intent: 'idle',

          reason: 'formation',

          target: null,

          targetPlayerId: null,

          power: 0,

          timestamp:
            state.time,
        };

      continue;
    }


    // ========================================================
    // CHASE SET
    // ========================================================

    const chaseSet =
      player.isHome
        ? homeChase
        : awayChase;


    // ========================================================
    // KARAR
    // ========================================================

    const result =
      decideForPlayer(
        player,
        state,
        chaseSet
      );


    decisions[id] =
      result.decision;

    debugs[id] =
      result.debug;


    // ========================================================
    // PLAYER STATE
    // ========================================================

    player.currentDecision =
      result.decision;

    player.currentIntent =
      result.decision.intent;


    player.nextDecisionTime =
      state.time +
      computeDecisionInterval(
        player
      );


    // --------------------------------------------------------
    // Chase
    // --------------------------------------------------------

    player.isChasingBall =
      result.decision.reason ===
      'chase';


    // --------------------------------------------------------
    // Mark
    // --------------------------------------------------------

    player.isMarking =
      result.decision.reason ===
        'mark'
        ? result.decision.targetPlayerId
        : null;
  }


  return {
    decisions,
    debugs,
  };
}