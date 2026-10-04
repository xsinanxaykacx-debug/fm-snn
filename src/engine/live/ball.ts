// src/engine/live/ball.ts

import type { Ball, PitchDimensions, Vec2, Vec3 } from '../types';

// ═══════════════════════════════════════════════
// FİZİK CONFIG
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

  if (len < 1e-6) return { x: 1, y: 0 };

  return { x: dx / len, y: dy / len };
}

function normalizeDirection(dir: Vec2): Vec2 {
  const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);

  if (len < 1e-6) return { x: 1, y: 0 };

  return { x: dir.x / len, y: dir.y / len };
}

function clampSpeed(ball: Ball, physics: BallPhysicsConfig): void {
  const v = ball.velocity;
  const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

  if (speed > physics.maxSpeed && speed > 1e-6) {
    const scale = physics.maxSpeed / speed;
    v.x *= scale;
    v.y *= scale;
    v.z *= scale;
  }
}

export function createBall(pitch: PitchDimensions): Ball {
  return {
    position: {
      x: pitch.length / 2,
      y: pitch.width / 2,
      z: DEFAULT_BALL_PHYSICS.radius,
    },
    velocity: { x: 0, y: 0, z: 0 },
    ownerId: null,
    lastTouchId: null,
    lastTouchClubId: null,
    lastAction: null,
    isMoving: false,
  };
}

export function stepBall(
  ball: Ball,
  _pitch: PitchDimensions,
  physics: BallPhysicsConfig,
  tickDuration: number
): Ball {
  if (ball.ownerId !== null) {
    ball.velocity = { x: 0, y: 0, z: 0 };
    ball.isMoving = false;
    return ball;
  }

  ball.velocity.z += physics.gravity * tickDuration;
  ball.velocity.x *= physics.airDrag;
  ball.velocity.y *= physics.airDrag;
  ball.velocity.z *= physics.airDrag;

  ball.position.x += ball.velocity.x * tickDuration;
  ball.position.y += ball.velocity.y * tickDuration;
  ball.position.z += ball.velocity.z * tickDuration;

  if (ball.position.z <= physics.radius) {
    ball.position.z = physics.radius;

    if (ball.velocity.z < 0) {
      ball.velocity.z = -ball.velocity.z * physics.bounceFactor;
    }

    if (Math.abs(ball.velocity.z) < 0.5) {
      ball.velocity.z = 0;
    }

    ball.velocity.x *= physics.groundFriction;
    ball.velocity.y *= physics.groundFriction;
  }

  clampSpeed(ball, physics);

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
  ball.lastTouchId = playerId ?? null;
  ball.lastTouchClubId = clubId ?? null;
  ball.lastAction = 'pass';

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
  ball.lastTouchId = playerId ?? null;
  ball.lastTouchClubId = clubId ?? null;
  ball.lastAction = 'shot';

  ball.position.x = from.x;
  ball.position.y = from.y;
  ball.position.z = Math.max(from.z, physics.radius);

  ball.velocity.x = dir.x * speed;
  ball.velocity.y = dir.y * speed;
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
  ball.lastTouchId = playerId ?? null;
  ball.lastTouchClubId = clubId ?? null;
  ball.lastAction = 'cross';

  ball.position.x = from.x;
  ball.position.y = from.y;
  ball.position.z = Math.max(from.z, physics.radius);

  ball.velocity.x = dir.x * speed;
  ball.velocity.y = dir.y * speed;
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
  ball.lastTouchId = playerId ?? null;
  ball.lastTouchClubId = clubId ?? null;
  ball.lastAction = 'clearance';

  ball.position.x = from.x;
  ball.position.y = from.y;
  ball.position.z = Math.max(from.z, physics.radius);

  ball.velocity.x = dir.x * speed;
  ball.velocity.y = dir.y * speed;
  ball.velocity.z = speed * 0.4;
  ball.isMoving = true;

  return ball;
}

export function canControl(
  ball: Ball,
  playerPos: Vec2,
  controlRadius: number
): boolean {
  if (ball.position.z > 1.0) return false;

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
  ball.lastTouchId = playerId;
  ball.lastTouchClubId = clubId;
  ball.lastAction = 'control';
  ball.velocity = { x: 0, y: 0, z: 0 };
  ball.isMoving = false;

  return ball;
}

export function releaseBall(ball: Ball): Ball {
  ball.ownerId = null;
  return ball;
}

export function attachBallToOwner(
  ball: Ball,
  ownerPosition: Vec2,
  ownerFacing: number,
  physics: BallPhysicsConfig
): Ball {
  if (ball.ownerId === null) return ball;

  const footDistance = 0.5;
  const rad = (ownerFacing * Math.PI) / 180;

  ball.position.x = ownerPosition.x + Math.cos(rad) * footDistance;
  ball.position.y = ownerPosition.y + Math.sin(rad) * footDistance;
  ball.position.z = physics.radius;

  ball.velocity = { x: 0, y: 0, z: 0 };
  ball.isMoving = false;

  return ball;
}

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
