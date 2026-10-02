// src/engine/live/ball.ts

import type { Ball, PitchDimensions, Vec2, Vec3 } from '../types';

// ═══════════════════════════════════════════════
// FİZİK CONFIG
// ═══════════════════════════════════════════════

export interface BallPhysicsConfig {
  /** Yerçekimi (m/s²). Negatif. */
  gravity: number;

  /** Hava direnci — TICK BAŞINA katsayı. 10 Hz'de 0.995 → saniyede ≈ 0.951. */
  airDrag: number;

  /** Zemin sürtünmesi — TICK BAŞINA katsayı. 10 Hz'de 0.97 → saniyede ≈ 0.738. */
  groundFriction: number;

  /** Zemin sekme katsayısı (0..1). */
  bounceFactor: number;

  /** Top yarıçapı (m). */
  radius: number;

  /** Top kütlesi (kg) — şimdilik kullanılmıyor. */
  mass: number;

  /** Maksimum top hızı (m/s). */
  maxSpeed: number;
}

export const DEFAULT_BALL_PHYSICS: BallPhysicsConfig = {
  gravity: -9.81,
  airDrag: 0.995,
  groundFriction: 0.97,
  bounceFactor: 0.6,
  radius: 0.11,
  mass: 0.43,
  maxSpeed: 35,
};

// ═══════════════════════════════════════════════
// HIZ ARALIKLARI (çağıran tarafından kullanılır)
// ═══════════════════════════════════════════════

export const BALL_SPEED = {
  pass: { min: 4,  max: 25 },
  shot: { min: 12, max: 35 },
  cross: { min: 10, max: 25 },
  clearance: { min: 15, max: 30 },
} as const;

// ═══════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════

function clampPower(power: number): number {
  if (!Number.isFinite(power)) return 0;
  if (power < 0) return 0;
  if (power > 1) return 1;
  return power;
}

function speedForRange(
  range: { min: number; max: number },
  power: number
): number {
  const p = clampPower(power);
  return range.min + p * (range.max - range.min);
}

function directionTo(from: Vec3, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < 1e-6) {
    // Aynı noktaya pas: minimal bir yön ver, NaN üretme
    return { x: 1, y: 0 };
  }

  return { x: dx / len, y: dy / len };
}

function normalizeDirection(dir: Vec2): Vec2 {
  const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);

  if (len < 1e-6) {
    return { x: 1, y: 0 };
  }

  return { x: dir.x / len, y: dir.y / len };
}

function clampSpeed(
  ball: Ball,
  physics: BallPhysicsConfig
): void {
  const v = ball.velocity;
  const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

  if (speed > physics.maxSpeed && speed > 1e-6) {
    const scale = physics.maxSpeed / speed;
    v.x *= scale;
    v.y *= scale;
    v.z *= scale;
  }
}

// ═══════════════════════════════════════════════
// TOP OLUŞTURMA
// ═══════════════════════════════════════════════

export function createBall(pitch: PitchDimensions): Ball {
  return {
    position: {
      x: pitch.length / 2,
      y: pitch.width / 2,
      z: DEFAULT_BALL_PHYSICS.radius,
    },
    velocity: { x: 0, y: 0, z: 0 },
    targetPosition: null,
    ownerId: null,
    lastTouchId: null,
    lastTouchClubId: null,
    isMoving: false,
  };
}

// ═══════════════════════════════════════════════
// STEP — TEK TICK FİZİK
// ═══════════════════════════════════════════════
//
// KONTRAT:
//   • Eğer topun sahibi varsa, fizik uygulanmaz.
//     Top sahibin ayağındadır ve movement.ts tarafından taşınır.
//   • Sıra: gravity → air drag → position → collision → friction → clamp → stop
//   • RNG YOKTUR. Bu fonksiyon deterministiktir.
//
export function stepBall(
  ball: Ball,
  _pitch: PitchDimensions,
  physics: BallPhysicsConfig,
  tickDuration: number
): Ball {
  // Sahip varsa top ayakta — fizik yok
  if (ball.ownerId !== null) {
    ball.velocity = { x: 0, y: 0, z: 0 };
    ball.isMoving = false;
    return ball;
  }

  // 1) Yerçekimi
  ball.velocity.z += physics.gravity * tickDuration;

  // 2) Hava direnci (her zaman)
  ball.velocity.x *= physics.airDrag;
  ball.velocity.y *= physics.airDrag;
  ball.velocity.z *= physics.airDrag;

  // 3) Konum güncelle
  // Kontrollü pas hedefini geçemez. Eski davranışta pas hızı hedefi
  // aştıktan sonra devam ettiği için top kale çizgisine taşınabiliyordu.
  if (ball.targetPosition !== null) {
    const dx = ball.targetPosition.x - ball.position.x;
    const dy = ball.targetPosition.y - ball.position.y;
    const remaining = Math.hypot(dx, dy);
    const travel = Math.hypot(ball.velocity.x, ball.velocity.y) * tickDuration;

    if (remaining <= Math.max(travel, 1e-6)) {
      ball.position.x = ball.targetPosition.x;
      ball.position.y = ball.targetPosition.y;
      ball.velocity.x = 0;
      ball.velocity.y = 0;
      ball.targetPosition = null;
    } else {
      ball.position.x += ball.velocity.x * tickDuration;
      ball.position.y += ball.velocity.y * tickDuration;
    }
  } else {
    ball.position.x += ball.velocity.x * tickDuration;
    ball.position.y += ball.velocity.y * tickDuration;
  }

  ball.position.z += ball.velocity.z * tickDuration;

  // 4) Zemin çarpışması / sekme
  if (ball.position.z <= physics.radius) {
    ball.position.z = physics.radius;

    if (ball.velocity.z < 0) {
      ball.velocity.z = -ball.velocity.z * physics.bounceFactor;
    }

    if (Math.abs(ball.velocity.z) < 0.5) {
      ball.velocity.z = 0;
    }

    // 5) Zemin sürtünmesi (yalnızca yerdeyken)
    ball.velocity.x *= physics.groundFriction;
    ball.velocity.y *= physics.groundFriction;
  }

  // 6) Hız sınırı
  clampSpeed(ball, physics);

  // 7) Duran top kontrolü
  const speed =
    Math.abs(ball.velocity.x) +
    Math.abs(ball.velocity.y) +
    Math.abs(ball.velocity.z);

  const onGround = ball.position.z <= physics.radius + 0.01;

  if (speed < 0.1 && onGround) {
    ball.velocity = { x: 0, y: 0, z: 0 };
    ball.isMoving = false;
  } else {
    ball.isMoving = true;
  }

  return ball;
}

// ═══════════════════════════════════════════════
// TOP DOKUNMA FONKSİYONLARI
// ═══════════════════════════════════════════════
//
// KONTRAT:
//   • Bu fonksiyonlar hedefi HESAPLAMAZ. Hedef çağırandan gelir.
//   • RNG YOKTUR.
//   • Sadece topa hız verir ve sahipliği serbest bırakır.
//   • lastTouchId ve lastTouchClubId çağıran tarafından set edilmeli,
//     ancak kolaylık olsun diye opsiyonel bir player/club parametresi alır.
//

export function applyPass(
  ball: Ball,
  from: Vec3,
  to: Vec2,
  power: number,
  physics: BallPhysicsConfig,
  playerId?: string | null,
  clubId?: string | null
): Ball {
  const speed = speedForRange(BALL_SPEED.pass, power);
  const dir = directionTo(from, to);

  ball.ownerId = null;
  ball.targetPosition = { x: to.x, y: to.y };
  ball.lastTouchId = playerId ?? null;
  ball.lastTouchClubId = clubId ?? null;

  ball.position.x = from.x;
  ball.position.y = from.y;
  ball.position.z = physics.radius;

  ball.velocity.x = dir.x * speed;
  ball.velocity.y = dir.y * speed;
  ball.velocity.z = 0;

  ball.isMoving = true;

  return ball;
}

export function applyShot(
  ball: Ball,
  from: Vec3,
  to: Vec2,
  power: number,
  physics: BallPhysicsConfig,
  playerId?: string | null,
  clubId?: string | null
): Ball {
  const speed = speedForRange(BALL_SPEED.shot, power);
  const dir = directionTo(from, to);

  ball.ownerId = null;
  ball.targetPosition = null;
  ball.lastTouchId = playerId ?? null;
  ball.lastTouchClubId = clubId ?? null;

  ball.position.x = from.x;
  ball.position.y = from.y;
  ball.position.z = Math.max(from.z, physics.radius);

  ball.velocity.x = dir.x * speed;
  ball.velocity.y = dir.y * speed;

  // Yerden şut varsayılanı: vz = 0.
  // Çağıran isterse from.z > radius vererek havadan şut atabilir.
  ball.velocity.z = 0;

  ball.isMoving = true;

  return ball;
}

export function applyCross(
  ball: Ball,
  from: Vec3,
  to: Vec2,
  power: number,
  physics: BallPhysicsConfig,
  playerId?: string | null,
  clubId?: string | null
): Ball {
  const speed = speedForRange(BALL_SPEED.cross, power);
  const dir = directionTo(from, to);

  ball.ownerId = null;
  ball.targetPosition = null;
  ball.lastTouchId = playerId ?? null;
  ball.lastTouchClubId = clubId ?? null;

  ball.position.x = from.x;
  ball.position.y = from.y;
  ball.position.z = Math.max(from.z, physics.radius);

  ball.velocity.x = dir.x * speed;
  ball.velocity.y = dir.y * speed;

  // Cross her zaman havaya doğru başlar.
  // Vz, hıza orantılıdır: ~%30 yukarı bileşen.
  ball.velocity.z = speed * 0.3;

  ball.isMoving = true;

  return ball;
}

export function applyClearance(
  ball: Ball,
  from: Vec3,
  direction: Vec2,
  power: number,
  physics: BallPhysicsConfig,
  playerId?: string | null,
  clubId?: string | null
): Ball {
  const speed = speedForRange(BALL_SPEED.clearance, power);
  const dir = normalizeDirection(direction);

  ball.ownerId = null;
  ball.targetPosition = null;
  ball.lastTouchId = playerId ?? null;
  ball.lastTouchClubId = clubId ?? null;

  ball.position.x = from.x;
  ball.position.y = from.y;
  ball.position.z = Math.max(from.z, physics.radius);

  ball.velocity.x = dir.x * speed;
  ball.velocity.y = dir.y * speed;
  ball.velocity.z = speed * 0.4;

  ball.isMoving = true;

  return ball;
}

// ═══════════════════════════════════════════════
// TOP KONTROLÜ
// ═══════════════════════════════════════════════

export function canControl(
  ball: Ball,
  playerPos: Vec2,
  controlRadius: number
): boolean {
  // Top havadaysa kontrol zorlaşır.
  // Şimdilik basit eşik: z > 1.0 m ise kontrol edilemez.
  if (ball.position.z > 1.0) {
    return false;
  }

  const dx = ball.position.x - playerPos.x;
  const dy = ball.position.y - playerPos.y;
  const distSq = dx * dx + dy * dy;

  return distSq <= controlRadius * controlRadius;
}

export function controlBall(
  ball: Ball,
  playerId: string,
  clubId: string
): Ball {
  ball.ownerId = playerId;
  ball.targetPosition = null;
  ball.lastTouchId = playerId;
  ball.lastTouchClubId = clubId;
  ball.velocity = { x: 0, y: 0, z: 0 };
  ball.isMoving = false;

  return ball;
}

export function releaseBall(ball: Ball): Ball {
  ball.ownerId = null;
  ball.targetPosition = null;
  return ball;
}

/**
 * Sahibi olan topu, sahibin ayağının önüne taşır.
 * movement.ts tarafından her tick çağrılır.
 *
 * Bu fonksiyon topa hız vermez; sadece konumunu sahibe bağlar.
 */
export function attachBallToOwner(
  ball: Ball,
  ownerPosition: Vec2,
  ownerFacing: number,
  physics: BallPhysicsConfig
): Ball {
  if (ball.ownerId === null) return ball;

  // Ayak topu: sahibin 0.5 m önünde, yerde
  const footDistance = 0.5;
  const rad = (ownerFacing * Math.PI) / 180;

  ball.position.x = ownerPosition.x + Math.cos(rad) * footDistance;
  ball.position.y = ownerPosition.y + Math.sin(rad) * footDistance;
  ball.position.z = physics.radius;

  ball.velocity = { x: 0, y: 0, z: 0 };
  ball.isMoving = false;

  return ball;
}

// ═══════════════════════════════════════════════
// SORGULAR
// ═══════════════════════════════════════════════

export function ballSpeed(ball: Ball): number {
  const v = ball.velocity;
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function ballIsAirborne(
  ball: Ball,
  physics: BallPhysicsConfig
): boolean {
  return ball.position.z > physics.radius + 0.01;
}

export function ballDistanceTo(ball: Ball, point: Vec2): number {
  const dx = ball.position.x - point.x;
  const dy = ball.position.y - point.y;
  return Math.sqrt(dx * dx + dy * dy);
}