// src/engine/live/decision.ts

/**
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
 * OYUNCU BAZLI YÖN
 * -----------------
 * attackingDirection ve attackingGoalPos her oyuncu için
 * self.isHome üzerinden hesaplanır.
 *
 * HOME → hücum yönü +1 → hedef (pitch.length, pitch.width/2)
 * AWAY → hücum yönü -1 → hedef (0, pitch.width/2)
 */

import type {
  Ball,
  Decision,
  DecisionCandidate,
  DecisionCandidateType,
  DecisionDebug,
  LivePlayer,
  Perception,
  PitchDimensions,
  PlayerPhysicsConfig,
  RngState,
  SetPieceState,
  Vec2,
} from '../types';

import {
  DECISION,

  CHASE_DISTANCE_WEIGHT,
  CHASE_TACKLING_WEIGHT,
  MAX_CHASE_PER_TEAM,
  GK_CHASE_MAX_DISTANCE,
  GK_CHASE_MAX_X,

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
  MARKING_OFFSET_DISTANCE,
  MARK_ASSIGNMENT_MAX_PER_OPPONENT,
  MARK_THREAT_DISTANCE_WEIGHT,
  MARK_THREAT_GOAL_WEIGHT,
  MARK_THREAT_OPENNESS_WEIGHT,
  MARK_THREAT_ROLE_WEIGHT,

  SUPPORT_FORWARD_OFFSET,
  SUPPORT_MIN_SPACE,

  DECISION_POWER,
  SPACE_NEUTRAL,
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
// OYUNCU BAZLI YÖN
// ============================================================

function getAttackingDirection(self: LivePlayer): 1 | -1 {
  return self.isHome ? 1 : -1;
}

function getAttackingGoalPos(
  self: LivePlayer,
  pitch: PitchDimensions
): Vec2 {
  return self.isHome
    ? { x: pitch.length, y: pitch.width / 2 }
    : { x: 0, y: pitch.width / 2 };
}

// ============================================================
// SPACE
// ============================================================

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
    Math.min(DECISION.maxInterval, interval)
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

function isGoalkeeperChaseAllowed(
  player: LivePlayer,
  ballPosition: Vec2,
  pitch: PitchDimensions
): boolean {
  if (player.role !== 'GK') return true;

  const distance = computeDistance(player.position, ballPosition);
  if (distance > GK_CHASE_MAX_DISTANCE) return false;

  const ownPenaltyArea =
    player.isHome
      ? ballPosition.x <= pitch.penaltyAreaDepth &&
        ballPosition.y >= (pitch.width - pitch.penaltyAreaWidth) / 2 &&
        ballPosition.y <= (pitch.width + pitch.penaltyAreaWidth) / 2
      : ballPosition.x >= pitch.length - pitch.penaltyAreaDepth &&
        ballPosition.y >= (pitch.width - pitch.penaltyAreaWidth) / 2 &&
        ballPosition.y <= (pitch.width + pitch.penaltyAreaWidth) / 2;

  if (ownPenaltyArea) return true;

  const ownHalf =
    player.isHome
      ? ballPosition.x <= pitch.length / 2
      : ballPosition.x >= pitch.length / 2;

  const goalkeeperXDistance =
    player.isHome
      ? Math.abs(ballPosition.x - player.homePosition.x)
      : Math.abs(ballPosition.x - player.homePosition.x);

  return ownHalf && goalkeeperXDistance <= GK_CHASE_MAX_X;
}

export function allocateChase(
  teamPlayers: LivePlayer[],
  ballPosition: Vec2,
  pitch?: PitchDimensions
): Set<string> {
  const scored = teamPlayers
    .filter(player =>
      pitch === undefined ||
      isGoalkeeperChaseAllowed(player, ballPosition, pitch)
    )
    .map(player => {
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
// BALL ACTION — CANDIDATE ÜRETİMİ
// ============================================================

function generateBallCarrierCandidates(
  self: LivePlayer,
  perception: Perception,
  _state: DecisionState,
  attackingGoalPos: Vec2,
  attackingDirection: 1 | -1
): DecisionCandidate[] {
  const candidates: DecisionCandidate[] = [];

  // ─── PASS ───
  for (const option of perception.passOptions) {
    const successProbability = clamp01(
      option.successProbability
    );

    const tacticalFit = clamp01(option.tacticalValue);

    const risk = clamp01(1 - option.laneClarity);

    const spaceValue = sampleSpace01(
      perception,
      option.targetPosition
    );

    const attributeFit = attrRatio(
      self.player.attributes.passing
    );

    const score =
      successProbability * PASS_SCORE.successWeight +
      tacticalFit * PASS_SCORE.tacticalWeight +
      spaceValue * PASS_SCORE.spaceWeight -
      risk * PASS_SCORE.riskWeight;

    const isThroughBall =
      option.distance > THROUGH_BALL_MIN_DISTANCE &&
      option.tacticalValue > THROUGH_BALL_MIN_TACTICAL;

    candidates.push({
      type: isThroughBall ? 'through_ball' : 'pass',
      targetPlayerId: option.targetPlayerId,
      target: option.targetPosition,
      score,
      successProbability,
      risk,
      tacticalFit,
      attributeFit,
      spaceValue,
      pressurePenalty: clamp01(perception.pressure / 100),
      reason: isThroughBall ? 'through_ball' : 'pass',
    });
  }

  // ─── CROSS ───
  const onWing =
    perception.zone.self === 'attack_left' ||
    perception.zone.self === 'attack_right' ||
    perception.zone.self === 'midfield_left' ||
    perception.zone.self === 'midfield_right';

  if (onWing) {
    const crossTarget = findCrossTarget(
      perception,
      attackingGoalPos
    );

    if (crossTarget !== null) {
      const distance = computeDistance(
        self.position,
        crossTarget.position
      );

      const crossing = attrRatio(
        self.player.attributes.crossing
      );

      const successProbability = clamp01(
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

      const spaceValue = sampleSpace01(
        perception,
        crossTarget.position
      );

      const score =
        CROSS_BASE_SCORE +
        crossing * CROSS_SCORE_ATTR_WEIGHT;

      candidates.push({
        type: 'cross',
        targetPlayerId: crossTarget.id,
        target: crossTarget.position,
        score,
        successProbability,
        risk: clamp01(CROSS_RISK),
        tacticalFit: clamp01(CROSS_TACTICAL_FIT),
        attributeFit: crossing,
        spaceValue,
        pressurePenalty: clamp01(perception.pressure / 100),
        reason: 'cross',
      });
    }
  }

  // ─── SHOOT ───
  const distanceToGoal = computeDistance(
    self.position,
    attackingGoalPos
  );

  if (distanceToGoal < SHOOT_MAX_DISTANCE) {
    const finishing = attrRatio(
      self.player.attributes.finishing
    );

    const composure = attrRatio(
      self.player.attributes.composure
    );

    const technique = attrRatio(
      self.player.attributes.technique
    );

    const xG = estimateXG(
      distanceToGoal,
      perception.pressure
    );

    const score =
      xG * SHOOT_SCORE.xGWeight +
      finishing * SHOOT_SCORE.finishingWeight +
      composure * SHOOT_SCORE.composureWeight;

    candidates.push({
      type: 'shoot',
      targetPlayerId: null,
      target: attackingGoalPos,
      score,
      successProbability: clamp01(xG),
      risk: clamp01(1 - xG),
      tacticalFit: clamp01(SHOOT_TACTICAL_FIT),
      attributeFit: clamp01(
        (finishing + composure + technique) / 3
      ),
      spaceValue: sampleSpace01(perception, self.position),
      pressurePenalty: clamp01(perception.pressure / 100),
      reason: 'shoot',
    });
  }

  // ─── DRIBBLE ───
  const dribbling = attrRatio(
    self.player.attributes.dribbling
  );

  const agility = attrRatio(
    self.player.attributes.agility
  );

  const spaceHere = sampleSpace01(
    perception,
    self.position
  );

  // Oyuncu bazlı hücum yönü
  const dribbleTarget: Vec2 = {
    x:
      self.position.x +
      attackingDirection * DRIBBLE_FORWARD_DISTANCE,
    y: self.position.y,
  };

  const spaceAhead = sampleSpace01(
    perception,
    dribbleTarget
  );

  const spaceDifference = spaceAhead - spaceHere;

  if (
    spaceDifference >
    DRIBBLE_SPACE_DIFF_THRESHOLD / 100
  ) {
    const pressure = clamp01(
      perception.pressure / 100
    );

    const rawSuccess =
      dribbling * 0.6 +
      agility * 0.4 -
      pressure;

    const successProbability = Math.max(
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
      risk: clamp01(DRIBBLE_RISK),
      tacticalFit: clamp01(DRIBBLE_TACTICAL_FIT),
      attributeFit: clamp01(
        (dribbling + agility) / 2
      ),
      spaceValue: clamp01(spaceAhead),
      pressurePenalty: pressure,
      reason: 'dribble',
    });
  }

  // ─── HOLD ───
  candidates.push({
    type: 'hold',
    targetPlayerId: null,
    target: null,
    score: HOLD_BASE_SCORE,
    successProbability: 1,
    risk: 0,
    tacticalFit: clamp01(HOLD_TACTICAL_FIT),
    attributeFit: attrRatio(
      self.player.attributes.technique
    ),
    spaceValue: clamp01(spaceHere),
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
  state: DecisionState,
  attackingGoalPos: Vec2,
  attackingDirection: 1 | -1
): {
  decision: Decision;
  selected: DecisionCandidate | null;
  candidates: DecisionCandidate[];
} {
  const candidates = generateBallCarrierCandidates(
    self,
    perception,
    state,
    attackingGoalPos,
    attackingDirection
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

    return { decision, selected: null, candidates: [] };
  }

  const minScore = Math.min(
    ...candidates.map(candidate => candidate.score)
  );

  const weights = candidates.map(candidate =>
    Math.max(
      DECISION.candidateFloorWeight,
      candidate.score - minScore
    )
  );

  const selected = weightedChoice(
    state.rng,
    candidates,
    weights
  );

  const intent = candidateTypeToIntent(selected.type);

  const decision: Decision = {
    intent,
    reason: selected.type,
    target: selected.target,
    targetPlayerId: selected.targetPlayerId,
    power: computePowerForCandidate(selected),
    timestamp: state.time,
  };

  return { decision, selected, candidates };
}

// ============================================================
// PRIORITY LAYER
// ============================================================

function decidePriorityIntent(
  self: LivePlayer,
  perception: Perception,
  state: DecisionState,
  chaseSet: Set<string>,
  ballCarrier: LivePlayer | null,
  attackingDirection: 1 | -1,
  markAssignments: MarkAssignments
): Decision {
  const ballPosition: Vec2 = {
    x: state.ball.position.x,
    y: state.ball.position.y,
  };

  // ─── 1. SET-PIECE ───
  if (
    state.setPiece !== null &&
    (state.setPiece.status === 'positioning' ||
      state.setPiece.status === 'ready')
  ) {
    return decideSetPiece(
      self,
      state.setPiece,
      state.time
    );
  }

  // ─── 2. RAKİP TOP SAHİBİ ───
  if (
    ballCarrier !== null &&
    ballCarrier.clubId !== self.clubId
  ) {
    const distanceToCarrier = computeDistance(
      self.position,
      ballCarrier.position
    );

    // TACKLE
    if (
      distanceToCarrier <=
      state.playerPhysics.tackleRadius
    ) {
      return {
        intent: 'tackle',
        reason: 'tackle',
        target: ballCarrier.position,
        targetPlayerId: ballCarrier.player.id,
        power: DECISION_POWER.tackle,
        timestamp: state.time,
      };
    }

    // CHASE
    if (chaseSet.has(self.player.id)) {
      return {
        intent: 'move',
        reason: 'chase',
        target: ballPosition,
        targetPlayerId: null,
        power: DECISION_POWER.move,
        timestamp: state.time,
      };
    }

    // MARK
    const assignedMarkId = markAssignments[self.player.id];
    const assignedMark = assignedMarkId === undefined
      ? null
      : perception.opponents.find(opponent => opponent.id === assignedMarkId) ?? null;

    if (assignedMark !== null) {
      const markTargetPoint = computeMarkingPoint(
        self,
        assignedMark.position
      );

      return {
        intent: 'mark',
        reason: 'mark',
        target: markTargetPoint,
        targetPlayerId: assignedMark.id,
        power: DECISION_POWER.mark,
        timestamp: state.time,
      };
    }

    return makeReturnDecision(self, state.time);
  }

  // ─── 3. TAKIM ARKADAŞI TOP SAHİBİ ───
  if (
    ballCarrier !== null &&
    ballCarrier.clubId === self.clubId &&
    isSupportRole(self)
  ) {
    const supportPosition = computeSupportPosition(
      self,
      ballCarrier,
      attackingDirection
    );

    const supportSpace = sampleSpace01(
      perception,
      supportPosition
    );

    if (supportSpace > SUPPORT_MIN_SPACE / 100) {
      return {
        intent: 'move',
        reason: 'support',
        target: supportPosition,
        targetPlayerId: null,
        power: DECISION_POWER.move,
        timestamp: state.time,
      };
    }

    return makeReturnDecision(self, state.time);
  }

  // ─── 4. LOOSE BALL ───
  if (ballCarrier === null) {
    if (chaseSet.has(self.player.id)) {
      return {
        intent: 'move',
        reason: 'chase',
        target: ballPosition,
        targetPlayerId: null,
        power: DECISION_POWER.move,
        timestamp: state.time,
      };
    }

    const assignedMarkId = markAssignments[self.player.id];
    const assignedMark = assignedMarkId === undefined
      ? null
      : perception.opponents.find(opponent => opponent.id === assignedMarkId) ?? null;

    if (assignedMark !== null) {
      return {
        intent: 'mark',
        reason: 'mark',
        target: computeMarkingPoint(self, assignedMark.position),
        targetPlayerId: assignedMark.id,
        power: DECISION_POWER.mark,
        timestamp: state.time,
      };
    }

    return makeReturnDecision(self, state.time);
  }

  return makeReturnDecision(self, state.time);
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
    setPiece.targetPositions[self.player.id];

  if (target !== undefined) {
    const distance = computeDistance(
      self.position,
      target
    );

    if (distance > SET_PIECE_POSITION_TOLERANCE) {
      return {
        intent: 'move',
        reason: 'set_piece',
        target,
        targetPlayerId: null,
        power: DECISION_POWER.move,
        timestamp: time,
      };
    }

    return {
      intent: 'hold',
      reason: 'set_piece',
      target,
      targetPlayerId: null,
      power: 0,
      timestamp: time,
    };
  }

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
    target: self.homePosition,
    targetPlayerId: null,
    power: DECISION_POWER.return,
    timestamp: time,
  };
}

// ============================================================
// SUPPORT / MARKING GEOMETRY
// ============================================================

function isSupportRole(self: LivePlayer): boolean {
  return (
    self.role === 'DM' ||
    self.role === 'CM' ||
    self.role === 'W' ||
    self.role === 'AM' ||
    self.role === 'ST'
  );
}

function computeMarkingPoint(
  self: LivePlayer,
  target: Vec2
): Vec2 {
  const dx = self.position.x - target.x;
  const dy = self.position.y - target.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 0.001) {
    return { x: target.x, y: target.y };
  }

  return {
    x: target.x + (dx / distance) * MARKING_OFFSET_DISTANCE,
    y: target.y + (dy / distance) * MARKING_OFFSET_DISTANCE,
  };
}

// ============================================================
// SUPPORT POSITION
// ============================================================

function computeSupportPosition(
  self: LivePlayer,
  ballCarrier: LivePlayer,
  attackingDirection: 1 | -1
): Vec2 {
  // Destek oyuncusu topa yapışmaz.
  // Kendi formasyon referansını korur; topa sınırlı ölçüde yaklaşır.
  const homeX = self.homePosition.x;
  const homeY = self.homePosition.y;

  const ballPull = 0.30;
  const carrierOffset =
    attackingDirection * Math.min(SUPPORT_FORWARD_OFFSET, 10);

  const targetX =
    homeX +
    (ballCarrier.position.x - homeX) * ballPull +
    carrierOffset;

  const targetY =
    homeY +
    (ballCarrier.position.y - homeY) * 0.20;

  return {
    x: Math.max(2, Math.min(102, targetX)),
    y: Math.max(2, Math.min(62, targetY)),
  };
}

// ============================================================
// CROSS TARGET
// ============================================================

function findCrossTarget(
  perception: Perception,
  attackingGoalPos: Vec2
): { id: string; position: Vec2 } | null {
  let best: {
    id: string;
    position: Vec2;
    distance: number;
  } | null = null;

  for (const teammate of perception.teammates) {
    const distanceToGoal = computeDistance(
      teammate.position,
      attackingGoalPos
    );

    if (distanceToGoal > CROSS_TARGET_RADIUS) continue;

    if (
      best === null ||
      distanceToGoal < best.distance
    ) {
      best = {
        id: teammate.id,
        position: teammate.position,
        distance: distanceToGoal,
      };
    }
  }

  if (best === null) return null;

  return {
    id: best.id,
    position: best.position,
  };
}

// ============================================================
// GLOBAL MARK ASSIGNMENT
// ============================================================

export type MarkAssignments = Record<string, string>;

function markRoleThreat(position: LivePlayer['player']['position']): number {
  switch (position) {
    case 'ST':
      return 1.00;
    case 'AMC':
    case 'AML':
    case 'AMR':
      return 0.85;
    case 'KFL':
    case 'GF':
    case 'KFR':
      return 0.75;
    case 'MC':
    case 'ML':
    case 'MR':
      return 0.55;
    case 'DMC':
      return 0.45;
    default:
      return 0.30;
  }
}

function buildMarkAssignments(
  players: LivePlayer[],
  ballPosition: Vec2,
  pitch: PitchDimensions
): MarkAssignments {
  const assignments: MarkAssignments = {};

  for (const defendingHome of [true, false]) {
    const defenders = players.filter(
      player => player.isHome === defendingHome && player.role !== 'GK'
    );

    const opponents = players.filter(
      player => player.isHome !== defendingHome
    );

    const opponentThreats = opponents
      .map(opponent => {
        const distanceToBall = computeDistance(
          opponent.position,
          ballPosition
        );

        const defendingGoal = defendingHome
          ? { x: 0, y: pitch.width / 2 }
          : { x: pitch.length, y: pitch.width / 2 };

        const distanceToGoal = computeDistance(
          opponent.position,
          defendingGoal
        );

        const nearbyTeammates = opponents.filter(
          teammate =>
            teammate.player.id !== opponent.player.id &&
            computeDistance(
              teammate.position,
              opponent.position
            ) <= 8
        ).length;

        const openness = clamp01(
          1 - nearbyTeammates / 3
        );

        const ballThreat = clamp01(
          1 - distanceToBall / MARK_MAX_DISTANCE
        );

        const goalThreat = clamp01(
          1 - distanceToGoal / pitch.length
        );

        const roleThreat = markRoleThreat(
          opponent.player.position
        );

        const score =
          ballThreat * MARK_THREAT_DISTANCE_WEIGHT +
          goalThreat * MARK_THREAT_GOAL_WEIGHT +
          openness * MARK_THREAT_OPENNESS_WEIGHT +
          roleThreat * MARK_THREAT_ROLE_WEIGHT;

        return {
          opponent,
          score,
        };
      })
      .sort((a, b) =>
        b.score - a.score ||
        a.opponent.player.id.localeCompare(
          b.opponent.player.id
        )
      );

    const usedDefenders = new Set<string>();

    for (const threat of opponentThreats) {
      const defenderCandidates = defenders
        .filter(defender => !usedDefenders.has(defender.player.id))
        .map(defender => ({
          player: defender,
          distance: computeDistance(
            defender.position,
            threat.opponent.position
          ),
        }))
        .filter(candidate => candidate.distance <= MARK_MAX_DISTANCE)
        .sort((a, b) =>
          a.distance - b.distance ||
          a.player.player.id.localeCompare(b.player.player.id)
        );

      const assignmentCount = Math.min(
        MARK_ASSIGNMENT_MAX_PER_OPPONENT,
        defenderCandidates.length
      );

      for (let i = 0; i < assignmentCount; i++) {
        const defender = defenderCandidates[i].player;
        assignments[defender.player.id] =
          threat.opponent.player.id;
        usedDefenders.add(defender.player.id);
      }
    }
  }

  // Karşılıklı markajı kır:
  // A -> B ve B -> A oluşmuşsa daha yakın olan savunmacı markajı korur.
  // Böylece iki oyuncu birbirine kilitlenmez.
  for (const defenderId of Object.keys(assignments).sort()) {
    const targetId = assignments[defenderId];
    if (assignments[targetId] !== defenderId) continue;

    const defender = allPlayers[defenderId];
    const reciprocalDefender = allPlayers[targetId];
    const target = allPlayers[targetId];
    const reciprocalTarget = allPlayers[defenderId];

    if (
      !defender ||
      !reciprocalDefender ||
      !target ||
      !reciprocalTarget
    ) {
      continue;
    }

    const ownDistance = computeDistance(
      defender.position,
      target.position
    );

    const reciprocalDistance = computeDistance(
      reciprocalDefender.position,
      reciprocalTarget.position
    );

    if (
      ownDistance > reciprocalDistance ||
      (
        ownDistance === reciprocalDistance &&
        defenderId > targetId
      )
    ) {
      delete assignments[defenderId];
    }
  }

  return assignments;
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
    case 'chase':
    case 'support':
      return 'move';

    case 'return':
    case 'formation':
      return 'return_to_position';

    case 'set_piece':
      return 'move';

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
  if (distanceToGoal > SHOOT_MAX_DISTANCE) {
    return SHOOT_XG_MIN;
  }

  if (distanceToGoal <= SHOOT_XG_CLOSE_DISTANCE) {
    return SHOOT_XG_MAX;
  }

  const base =
    SHOOT_XG_BASE -
    (distanceToGoal - SHOOT_XG_CLOSE_DISTANCE) *
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
  players: Record<string, LivePlayer>;
  pitch: PitchDimensions;
  time: number;
  rng: RngState;
  playerPhysics: Pick<PlayerPhysicsConfig, 'tackleRadius'>;
  setPiece: SetPieceState | null;
}

// ============================================================
// TEK OYUNCU KARARI
// ============================================================

export function decideForPlayer(
  self: LivePlayer,
  state: DecisionState,
  chaseSet: Set<string>,
  markAssignments: MarkAssignments = {}
): {
  decision: Decision;
  debug: DecisionDebug;
} {
  const attackingDirection = getAttackingDirection(self);

  const attackingGoalPos = getAttackingGoalPos(
    self,
    state.pitch
  );

  const perception = computeFullPerception(
    self,
    {
      ball: state.ball,
      players: state.players,
      pitch: state.pitch,
      time: state.time,
    }
  );

  const ball = state.ball;
  const ballOwnerId = ball.ownerId;

  const ballCarrier =
    ballOwnerId !== null
      ? (state.players[ballOwnerId] ?? null)
      : null;

  // ─── BENDE TOP ───
  if (
    ballCarrier !== null &&
    ballCarrier.player.id === self.player.id
  ) {
    const result = decideBallAction(
      self,
      perception,
      state,
      attackingGoalPos,
      attackingDirection
    );

    return {
      decision: result.decision,

      debug: {
        playerId: self.player.id,
        playerName: self.player.name,
        timestamp: state.time,
        perception,
        candidates: result.candidates,
        selected: result.selected,
        decision: result.decision,
        reason: result.decision.reason,
      },
    };
  }

  // ─── TOP BENDE DEĞİL ───
  const decision = decidePriorityIntent(
    self,
    perception,
    state,
    chaseSet,
    ballCarrier,
    attackingDirection,
    markAssignments
  );

  return {
    decision,

    debug: {
      playerId: self.player.id,
      playerName: self.player.name,
      timestamp: state.time,
      perception,
      candidates: [],
      selected: null,
      decision,
      reason: decision.reason,
    },
  };
}

// ============================================================
// TÜM OYUNCULAR
// ============================================================

export interface ComputeAllDecisionsResult {
  decisions: Record<string, Decision>;
  debugs: Record<string, DecisionDebug>;
}

export function computeAllDecisions(
  state: DecisionState
): ComputeAllDecisionsResult {
  const decisions: Record<string, Decision> = {};
  const debugs: Record<string, DecisionDebug> = {};

  const allPlayers = Object.keys(state.players)
    .sort()
    .map(id => state.players[id]);

  const ballPosition: Vec2 = {
    x: state.ball.position.x,
    y: state.ball.position.y,
  };

  const homePlayers = allPlayers.filter(p => p.isHome);
  const awayPlayers = allPlayers.filter(p => !p.isHome);

  const homeChase = allocateChase(homePlayers, ballPosition, state.pitch);
  const awayChase = allocateChase(awayPlayers, ballPosition, state.pitch);
  const markAssignments = buildMarkAssignments(
    allPlayers,
    ballPosition,
    state.pitch
  );

  for (const id of Object.keys(state.players).sort()) {
    const player = state.players[id];

    if (!shouldDecide(player, state.time)) {
      const currentDecision = player.currentDecision;

      decisions[id] =
        currentDecision ?? {
          intent: 'idle',
          reason: 'formation',
          target: null,
          targetPlayerId: null,
          power: 0,
          timestamp: state.time,
        };

      continue;
    }

    const chaseSet = player.isHome
      ? homeChase
      : awayChase;

    const result = decideForPlayer(
      player,
      state,
      chaseSet,
      markAssignments
    );

    decisions[id] = result.decision;
    debugs[id] = result.debug;

    player.currentDecision = result.decision;
    player.currentIntent = result.decision.intent;

    player.nextDecisionTime =
      state.time + computeDecisionInterval(player);

    player.isChasingBall =
      result.decision.reason === 'chase';

    player.isMarking =
      result.decision.reason === 'mark'
        ? result.decision.targetPlayerId
        : null;
  }

  return { decisions, debugs };
}