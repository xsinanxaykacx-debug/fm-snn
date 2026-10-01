// src/engine/live/movement.ts

/**
 * OYUNCU HAREKETİ
 * ----------------
 * Bu dosya Decision'ı fiziksel harekete çevirir.
 *
 * YASAK:
 *  - Karar üretme (decision.ts'in işi)
 *  - RNG (deterministik olmalı; tackle.ts ayrı)
 *  - MatchEvent üretme
 *  - Stat güncelleme
 *  - Gol / aut / korner KARARI
 *
 * KONTRAT:
 *  - movePlayer() hedefe doğru yönelir, ivmelenir, konumu günceller.
 *  - Clamp movement.ts'in sorumluluğu.
 *  - Taç taker'ı için saha dışı izinli (OUT_OF_BOUNDS_MARGIN içinde).
 *  - Separation toplu, deterministik.
 *  - Top etkileşimi (control/tackle) tackle.ts / ball.ts'e delege edilir.
 */

import type {
  Ball,
  Decision,
  LivePlayer,
  PitchDimensions,
  Vec2,
} from '../types';
import { attachBallToOwner, controlBall, canControl } from './ball';
import { resolveTackle, type TackleOutcome } from './tackle';

// ═══════════════════════════════════════════════
// SABİTLER
// ═══════════════════════════════════════════════

import { OUT_OF_BOUNDS_MARGIN } from './pitch';

export interface PlayerPhysicsConfig {
  maxSpeedMultiplier: number;
  accelerationMultiplier: number;
  decelerationMultiplier: number;
  radius: number;
  ballControlRadius: number;
  tackleRadius: number;
}

export const DEFAULT_PLAYER_PHYSICS: PlayerPhysicsConfig = {
  maxSpeedMultiplier: 1.0,
  accelerationMultiplier: 1.0,
  decelerationMultiplier: 1.0,
  radius: 0.4,
  ballControlRadius: 0.6,
  tackleRadius: 1.0,
};

export interface MovementContext {
  pitch: PitchDimensions;
  ball: Ball;
  players: Record<string, LivePlayer>;
}

// ═══════════════════════════════════════════════
// HIZ MODELİ
// ═══════════════════════════════════════════════

/**
 * Attribute'u 1-20'den 0-1 oranına çevirir.
 */
function attrRatio(v: number): number {
  return Math.max(0, Math.min(1, v / 20));
}

/**
 * Bir oyuncunun maksimum hızını hesaplar (m/s).
 * Deterministik. RNG yok.
 */
export function computeMaxSpeed(
  player: LivePlayer,
  physics: PlayerPhysicsConfig
): number {
  const a = player.player.attributes;
  const paceRatio = attrRatio(a.pace);
  const accelRatio = attrRatio(a.acceleration);

  const baseSpeed = 4.0 + paceRatio * 5.0 + accelRatio * 1.5;

  const cond = player.player.condition;
  const morale = player.player.morale;
  const form = player.player.form;

  const condMul = 0.7 + (cond / 100) * 0.3;
  const moraleMul = 0.9 + (morale / 100) * 0.1;
  const formMul = 0.9 + (form / 100) * 0.1;

  return (
    baseSpeed *
    condMul *
    moraleMul *
    formMul *
    physics.maxSpeedMultiplier
  );
}

/**
 * Bir oyuncunun ivmesini hesaplar (m/s²).
 * Deterministik. RNG yok.
 */
export function computeAcceleration(
  player: LivePlayer,
  physics: PlayerPhysicsConfig
): number {
  const a = player.player.attributes;
  const accelRatio = attrRatio(a.acceleration);

  const base = 3.0 + accelRatio * 4.0;
  return base * physics.accelerationMultiplier;
}

// ═══════════════════════════════════════════════
// HAREKET
// ═══════════════════════════════════════════════

function distanceSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function clampToPitch(
  pitch: PitchDimensions,
  p: Vec2,
  allowOutside: boolean
): Vec2 {
  if (allowOutside) {
    return {
      x: Math.max(-OUT_OF_BOUNDS_MARGIN, Math.min(pitch.length + OUT_OF_BOUNDS_MARGIN, p.x)),
      y: Math.max(-OUT_OF_BOUNDS_MARGIN, Math.min(pitch.width + OUT_OF_BOUNDS_MARGIN, p.y)),
    };
  }
  return {
    x: Math.max(0, Math.min(pitch.length, p.x)),
    y: Math.max(0, Math.min(pitch.width, p.y)),
  };
}

/**
 * Bir oyuncunun pozisyonunu ve hızını bir tick ilerletir.
 *
 * KONTRAT:
 *  • Karar üretmez. `Decision` dışarıdan gelir.
 *  • Hedefe doğru yönelir, ivmelenir, konumu günceller.
 *  • Clamp movement.ts'in sorumluluğu.
 *  • Taç taker'ı için saha dışı izinli.
 *  • RNG yok.
 *  • Oyuncuyu mutate eder.
 */
export function movePlayer(
  player: LivePlayer,
  decision: Decision,
  context: MovementContext,
  physics: PlayerPhysicsConfig,
  tickDuration: number
): void {
  const pitch = context.pitch;

  // Hedef yoksa dur
  if (!decision.target) {
    player.velocity.x *= 0.9;
    player.velocity.y *= 0.9;
    return;
  }

  // Taç taker'ı için saha dışı izinli
  const allowOutside = isThrowInTaker(player, context);

  // Hedefe doğru yön
  const dx = decision.target.x - player.position.x;
  const dy = decision.target.y - player.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 0.05) {
    // Hedefe ulaşıldı — yavaşla
    player.velocity.x *= 0.85;
    player.velocity.y *= 0.85;
    return;
  }

  // Birim yön
  const nx = dx / dist;
  const ny = dy / dist;

  // Maksimum hız
  const maxSpeed = computeMaxSpeed(player, physics);

  // İvme
  const accel = computeAcceleration(player, physics);

  // Hedef hız — hedefe yaklaştıkça yavaşla (soft stop)
  const approachFactor = Math.min(1, dist / 2);
  const targetSpeed = maxSpeed * approachFactor * decision.power;

  // Mevcut hız vektörü büyüklüğü
  const currentSpeed = Math.sqrt(
    player.velocity.x * player.velocity.x +
    player.velocity.y * player.velocity.y
  );

  // İvmelenme veya yavaşlama
  let newSpeed: number;
  if (currentSpeed < targetSpeed) {
    newSpeed = Math.min(targetSpeed, currentSpeed + accel * tickDuration);
  } else {
    const decel = accel * physics.decelerationMultiplier;
    newSpeed = Math.max(targetSpeed, currentSpeed - decel * tickDuration);
  }

  // Hız vektörünü hedef yöne çevir (yumuşak dönüş)
  const turnRate = 0.5; // 0-1 arası
  const blendX = player.velocity.x * (1 - turnRate) + nx * newSpeed * turnRate;
  const blendY = player.velocity.y * (1 - turnRate) + ny * newSpeed * turnRate;

  player.velocity.x = blendX;
  player.velocity.y = blendY;

  // Konumu güncelle
  const newX = player.position.x + player.velocity.x * tickDuration;
  const newY = player.position.y + player.velocity.y * tickDuration;

  const clamped = clampToPitch(pitch, { x: newX, y: newY }, allowOutside);
  player.position.x = clamped.x;
  player.position.y = clamped.y;

  // Facing güncelle
  if (newSpeed > 0.1) {
    player.facing = (Math.atan2(player.velocity.y, player.velocity.x) * 180) / Math.PI;
  }
}

/**
 * Taç taker'ı mı?
 * Taç taker'ı saha dışına çıkabilir.
 */
function isThrowInTaker(
  player: LivePlayer,
  context: MovementContext
): boolean {
  // Saha dışına en yakın oyuncu ve topa en yakın oyuncu → taker
  // Basit yaklaşım: top saha dışındaysa, topa en yakın oyuncu taker
  const ball = context.ball;

  if (
    ball.position.x >= 0 &&
    ball.position.x <= context.pitch.length &&
    ball.position.y >= 0 &&
    ball.position.y <= context.pitch.width
  ) {
    // Top saha içinde — taker değil
    return false;
  }

  // Topun konumuna en yakın oyuncu bu mu?
  let closestId: string | null = null;
  let closestDist = Infinity;

  for (const id of Object.keys(context.players)) {
    const p = context.players[id];
    if (p.clubId !== player.clubId) continue;

    const d = distanceSq(p.position, {
      x: ball.position.x,
      y: ball.position.y,
    });
    if (d < closestDist) {
      closestDist = d;
      closestId = id;
    }
  }

  return closestId === player.player.id;
}

// ═══════════════════════════════════════════════
// SEPARATION (Toplu, Deterministik)
// ═══════════════════════════════════════════════

/**
 * Soft collision separation.
 *
 * KONTRAT:
 *  • Toplu hesaplama — iterasyon sırası sonucu değiştirmez.
 *  • Deterministik. RNG yok.
 *  • Oyuncuları mutate eder.
 */
export function applyPlayerSeparation(
  players: Record<string, LivePlayer>,
  physics: PlayerPhysicsConfig
): void {
  const ids = Object.keys(players).sort();
  const minDist = physics.radius * 2;

  // 1. Tüm düzeltmeleri hesapla
  const corrections: Record<string, Vec2> = {};
  for (const id of ids) {
    corrections[id] = { x: 0, y: 0 };
  }

  // 2. Her çift için düzeltme hesapla
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

      // Yarı yarıya düzeltme (toplam separation correction)
      corrections[ids[i]].x -= nx * overlap * 0.5;
      corrections[ids[i]].y -= ny * overlap * 0.5;
      corrections[ids[j]].x += nx * overlap * 0.5;
      corrections[ids[j]].y += ny * overlap * 0.5;
    }
  }

  // 3. Tüm düzeltmeleri topluca uygula
  for (const id of ids) {
    players[id].position.x += corrections[id].x;
    players[id].position.y += corrections[id].y;
  }
}

// ═══════════════════════════════════════════════
// TOP SAHİBİ TAKİBİ
// ═══════════════════════════════════════════════

/**
 * Top sahibi olan oyuncunun ayağına topu bağlar.
 *
 * KONTRAT:
 *  • Yalnızca ball.ownerId !== null ise çalışır.
 *  • ball.ts'teki attachBallToOwner'ı çağırır.
 */
export function updateBallOwnerAttachment(
  ball: Ball,
  players: Record<string, LivePlayer>,
  physics: PlayerPhysicsConfig
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
    { radius: physics.radius } as any
  );
}

// ═══════════════════════════════════════════════
// ANA FONKSİYON
// ═══════════════════════════════════════════════

/**
 * Tüm 22 oyuncuyu tek tick'te hareket ettirir.
 *
 * KONTRAT:
 *  • Sıra: movePlayer (her oyuncu) → separation → tackle → ballOwnerAttachment.
 *  • tackle yalnızca intent === 'tackle' olanlar için.
 *  • tackle movement'tan SONRA (mesafe kapanmış olabilir).
 *  • RNG yok (tackle.ts kendi seeded RNG'sini kullanır).
 *  • Oyuncuları mutate eder.
 *
 * Döner: Bu tick'te gerçekleşen tackle sonuçları.
 */
export function moveAllPlayers(
  players: Record<string, LivePlayer>,
  decisions: Record<string, Decision>,
  context: MovementContext,
  physics: PlayerPhysicsConfig,
  tickDuration: number
): TackleOutcome[] {
  const tackleOutcomes: TackleOutcome[] = [];

  // 1. Her oyuncuyu hareket ettir
  for (const id of Object.keys(players).sort()) {
    const player = players[id];
    const decision = decisions[id];
    if (!decision) continue;

    movePlayer(player, decision, context, physics, tickDuration);
  }

  // 2. Separation
  applyPlayerSeparation(players, physics);

  // 3. Tackle — movement'tan sonra
  for (const id of Object.keys(players).sort()) {
    const player = players[id];
    const decision = decisions[id];
    if (!decision) continue;
    if (decision.intent !== 'tackle') continue;

    // Hedef rakip
    const targetId = decision.targetPlayerId;
    if (!targetId) continue;

    const carrier = players[targetId];
    if (!carrier) continue;

    const dist = Math.sqrt(
      distanceSq(player.position, carrier.position)
    );

    if (dist > physics.tackleRadius) continue;

    // Tackle çözümle
    const angle = Math.atan2(
      carrier.position.y - player.position.y,
      carrier.position.x - player.position.x
    );

    const relSpeed = Math.sqrt(
      (player.velocity.x - carrier.velocity.x) ** 2 +
      (player.velocity.y - carrier.velocity.y) ** 2
    );

    const outcome = resolveTackle({
      tackler: player,
      ballCarrier: carrier,
      distance: dist,
      angle,
      relativeSpeed: relSpeed,
    });

    tackleOutcomes.push(outcome);
  }

  // 4. Top sahibi takibi
  updateBallOwnerAttachment(context.ball, players, physics);

  return tackleOutcomes;
}