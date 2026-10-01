// src/engine/live/movement.ts

/**
 * OYUNCU HAREKETİ
 * ----------------
 * Bu dosya Decision'ı fiziksel harekete çevirir.
 *
 * YASAK:
 *  - Karar üretme (decision.ts'in işi)
 *  - RNG
 *  - MatchEvent üretme
 *  - Stat güncelleme
 *  - Gol / aut / korner KARARI (events.ts'in işi)
 *  - Top fiziği (ball.ts'in işi)
 *  - Tackle çözümlemesi (tackle.ts'in işi)
 *  - Set-piece taker seçimi (setPieces.ts'in işi)
 *
 * KONTRAT:
 *  - movePlayer() hedefe doğru yönelir, ivmelenir, konumu günceller.
 *  - decision.power HAREKET HIZINI ETKİLEMEZ. maxSpeed player'dan gelir.
 *  - Clamp projectPointToPitch() ile yapılır.
 *  - Separation toplu, deterministik.
 *  - Top sahibi takibi attachBallToOwner() ile yapılır.
 *  - RNG yok.
 *  - Sabit sayı gömülmez; config.ts'ten import edilir.
 */

import type {
  Ball,
  Decision,
  LivePlayer,
  PitchDimensions,
  PlayerPhysicsConfig,
  Vec2,
} from '../types';

import {
  PLAYER_TURN_RATE,
  PLAYER_APPROACH_RADIUS,
  PLAYER_STOP_SPEED,
  PLAYER_TARGET_TOLERANCE,
  PLAYER_VELOCITY_EPSILON,
  DEFAULT_PLAYER_PHYSICS,
  PLAYER_SPEED,
  PLAYER_MULTIPLIERS,
} from './config';

import { projectPointToPitch } from './pitch';

import {
  attachBallToOwner,
  DEFAULT_BALL_PHYSICS,
} from './ball';

// ═══════════════════════════════════════════════
// MOVEMENT CONTEXT
// ═══════════════════════════════════════════════

export interface MovementContext {
  pitch: PitchDimensions;
  ball: Ball;
  players: Record<string, LivePlayer>;
}

// ═══════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// HIZ MODELİ
// ═══════════════════════════════════════════════

function attrRatio(value: number): number {
  return Math.max(0, Math.min(1, value / 20));
}

export function computeMaxSpeed(
  player: LivePlayer,
  physics: PlayerPhysicsConfig
): number {
  const attributes = player.player.attributes;
  const paceRatio = attrRatio(attributes.pace);
  const accelerationRatio = attrRatio(attributes.acceleration);

  const baseSpeed =
    PLAYER_SPEED.base +
    paceRatio * PLAYER_SPEED.paceWeight +
    accelerationRatio * PLAYER_SPEED.accelWeight;

  const conditionMultiplier =
    PLAYER_MULTIPLIERS.conditionBase +
    (player.player.condition / 100) * PLAYER_MULTIPLIERS.conditionWeight;
  const moraleMultiplier =
    PLAYER_MULTIPLIERS.moraleBase +
    (player.player.morale / 100) * PLAYER_MULTIPLIERS.moraleWeight;
  const formMultiplier =
    PLAYER_MULTIPLIERS.formBase +
    (player.player.form / 100) * PLAYER_MULTIPLIERS.formWeight;

  return (
    baseSpeed *
    conditionMultiplier *
    moraleMultiplier *
    formMultiplier *
    physics.maxSpeedMultiplier
  );
}

export function computeAcceleration(
  player: LivePlayer,
  physics: PlayerPhysicsConfig
): number {
  const accelerationRatio = attrRatio(
    player.player.attributes.acceleration
  );

  return (
    (PLAYER_SPEED.accelBase +
      accelerationRatio * PLAYER_SPEED.accelWeightAccel) *
    physics.accelerationMultiplier
  );
}

// ═══════════════════════════════════════════════
// HAREKET
// ═══════════════════════════════════════════════

export function movePlayer(
  player: LivePlayer,
  decision: Decision,
  context: MovementContext,
  physics: PlayerPhysicsConfig,
  tickDuration: number
): void {
  const pitch = context.pitch;

  // ─── Hedef yoksa yavaşla ───
  if (!decision.target) {
    player.velocity.x *= 1 - PLAYER_TURN_RATE * 0.5;
    player.velocity.y *= 1 - PLAYER_TURN_RATE * 0.5;

    const speed = Math.sqrt(
      player.velocity.x * player.velocity.x +
        player.velocity.y * player.velocity.y
    );

    if (speed < PLAYER_STOP_SPEED) {
      player.velocity.x = 0;
      player.velocity.y = 0;
    } else if (speed < PLAYER_VELOCITY_EPSILON) {
      player.velocity.x = 0;
      player.velocity.y = 0;
    }
    return;
  }

  // ─── Hedefe doğru yön ve mesafe ───
  const dx = decision.target.x - player.position.x;
  const dy = decision.target.y - player.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < PLAYER_TARGET_TOLERANCE) {
    player.velocity.x *= 1 - PLAYER_TURN_RATE * 0.5;
    player.velocity.y *= 1 - PLAYER_TURN_RATE * 0.5;

    const settledSpeed = Math.sqrt(
      player.velocity.x * player.velocity.x +
        player.velocity.y * player.velocity.y
    );

    if (settledSpeed < PLAYER_VELOCITY_EPSILON) {
      player.velocity.x = 0;
      player.velocity.y = 0;
    }

    return;
  }

  const nx = dx / dist;
  const ny = dy / dist;

  // ─── Hız ve ivme (player'dan) ───
  const maxSpeed = computeMaxSpeed(player, physics);
  const accel = computeAcceleration(player, physics);

  // ─── Yaklaşım yumuşatma ───
  const approachFactor = Math.min(1, dist / PLAYER_APPROACH_RADIUS);
  const targetSpeed = maxSpeed * approachFactor;

  // ─── Mevcut hız ───
  const currentSpeed = Math.sqrt(
    player.velocity.x * player.velocity.x +
      player.velocity.y * player.velocity.y
  );

  // ─── İvmelenme veya yavaşlama ───
  let newSpeed: number;
  if (currentSpeed < targetSpeed) {
    newSpeed = Math.min(
      targetSpeed,
      currentSpeed + accel * tickDuration
    );
  } else {
    const decel = accel * physics.decelerationMultiplier;
    newSpeed = Math.max(
      targetSpeed,
      currentSpeed - decel * tickDuration
    );
  }

  // ─── Yön dönüşü (blend) ───
  const blendX =
    player.velocity.x * (1 - PLAYER_TURN_RATE) +
    nx * newSpeed * PLAYER_TURN_RATE;
  const blendY =
    player.velocity.y * (1 - PLAYER_TURN_RATE) +
    ny * newSpeed * PLAYER_TURN_RATE;

  player.velocity.x = blendX;
  player.velocity.y = blendY;

  // ─── Konum güncelle ───
  const newX = player.position.x + player.velocity.x * tickDuration;
  const newY = player.position.y + player.velocity.y * tickDuration;

  const clamped = projectPointToPitch(pitch, { x: newX, y: newY });
  player.position.x = clamped.x;
  player.position.y = clamped.y;

  // ─── Facing güncelle ───
  let finalSpeed = Math.sqrt(
    player.velocity.x * player.velocity.x +
      player.velocity.y * player.velocity.y
  );

  if (finalSpeed < PLAYER_VELOCITY_EPSILON) {
    player.velocity.x = 0;
    player.velocity.y = 0;
    finalSpeed = 0;
  }

  if (finalSpeed > PLAYER_STOP_SPEED) {
    player.facing =
      (Math.atan2(player.velocity.y, player.velocity.x) * 180) / Math.PI;
  }
}

// ═══════════════════════════════════════════════
// SEPARATION (Toplu, Deterministik)
// ═══════════════════════════════════════════════

export function applyPlayerSeparation(
  players: Record<string, LivePlayer>,
  physics: PlayerPhysicsConfig,
  pitch: PitchDimensions
): void {
  const ids = Object.keys(players).sort();
  const minDist = physics.radius * 2;

  // ─── Tüm düzeltmeleri topla ───
  const corrections: Record<string, Vec2> = {};
  for (const id of ids) {
    corrections[id] = { x: 0, y: 0 };
  }

  // ─── Her çift için düzeltme ───
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = players[ids[i]];
      const b = players[ids[j]];

      const dx = b.position.x - a.position.x;
      const dy = b.position.y - a.position.y;
      const distSq = dx * dx + dy * dy;

      if (distSq >= minDist * minDist || distSq < 1e-9) continue;

      const dist = Math.sqrt(distSq);
      const overlap = minDist - dist;
      const nx = dx / dist;
      const ny = dy / dist;

      corrections[ids[i]].x -= nx * overlap * 0.5;
      corrections[ids[i]].y -= ny * overlap * 0.5;
      corrections[ids[j]].x += nx * overlap * 0.5;
      corrections[ids[j]].y += ny * overlap * 0.5;
    }
  }

  // ─── Düzeltmeleri uygula + clamp ───
  for (const id of ids) {
    const player = players[id];

    player.position.x += corrections[id].x;
    player.position.y += corrections[id].y;

    const clamped = projectPointToPitch(pitch, player.position);
    player.position.x = clamped.x;
    player.position.y = clamped.y;
  }
}

// ═══════════════════════════════════════════════
// TOP SAHİBİ TAKİBİ
// ═══════════════════════════════════════════════

export function updateBallOwnerAttachment(
  ball: Ball,
  players: Record<string, LivePlayer>
): void {
  if (ball.ownerId === null) return;

  const owner = players[ball.ownerId];

  if (!owner) {
    ball.ownerId = null;
    return;
  }

  attachBallToOwner(
    ball,
    owner.position,
    owner.facing,
    DEFAULT_BALL_PHYSICS
  );
}

// ═══════════════════════════════════════════════
// ANA FONKSİYON
// ═══════════════════════════════════════════════

/**
 * Tüm 22 oyuncuyu tek tick'te hareket ettirir.
 *
 * KONTRAT:
 *  • Sıra: movePlayer (her oyuncu) → separation → ballOwnerAttachment.
 *  • Kararlar dışarıdan gelir.
 *  • Top sahibi takibi ball.ts'e delege edilir.
 *  • Tackle ÇÖZÜLMEZ — liveMatch.ts'in işi.
 *  • RNG yok.
 *  • Oyuncuları mutate eder.
 *  • Void döner.
 */
export function moveAllPlayers(
  players: Record<string, LivePlayer>,
  decisions: Record<string, Decision>,
  context: MovementContext,
  tickDuration: number,
  physics: PlayerPhysicsConfig = DEFAULT_PLAYER_PHYSICS
): void {
  // ─── 1. Her oyuncuyu hareket ettir ───
  for (const id of Object.keys(players).sort()) {
    const player = players[id];

    // Karar kaydı herhangi bir nedenle bu tick'te gelmezse
    // oyuncunun son geçerli kararını fiziksel olarak sürdür.
    // Aksi halde velocity dolu kalıp position entegrasyonu atlanabilir.
    const decision =
      decisions[id] ??
      player.currentDecision;

    if (!decision) continue;

    movePlayer(player, decision, context, physics, tickDuration);
  }

  // ─── 2. Separation + clamp ───
  applyPlayerSeparation(players, physics, context.pitch);

  // ─── 3. Top sahibi takibi ───
  updateBallOwnerAttachment(context.ball, players);
}