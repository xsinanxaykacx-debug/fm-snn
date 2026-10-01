// src/engine/live/physics.ts

import type { Ball, LiveMatchState, LivePlayer } from '../types';

export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerPhysicsState {
  id: string;
  position: Vector2;
  velocity: Vector2;
}

export interface BallPhysicsState {
  position: Vector2;
  velocity: Vector2;
}

export interface PairPhysics {
  distance: number;
  relativeSpeed: number;
  /** Signed rate at which the pair distance closes. Positive = approaching. */
  closingSpeedAB: number;
  /** Same physical pair value; closing speed is symmetric under A/B access order. */
  closingSpeedBA: number;
}

export interface PhysicsSnapshot {
  tick: number;
  players: PlayerPhysicsState[];
  ball: BallPhysicsState;
  playerPairs: Map<string, PairPhysics>;
  ballPairs: Map<string, PairPhysics>;
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

const EPSILON = 1e-9;

export function computePairPhysics(
  a: { position: Vector2; velocity: Vector2 },
  b: { position: Vector2; velocity: Vector2 },
): PairPhysics {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const distance = Math.hypot(dx, dy);

  const relVx = a.velocity.x - b.velocity.x;
  const relVy = a.velocity.y - b.velocity.y;
  const relativeSpeed = Math.hypot(relVx, relVy);

  if (distance < EPSILON) {
    return {
      distance: 0,
      relativeSpeed,
      closingSpeedAB: 0,
      closingSpeedBA: 0,
    };
  }

  const nx = dx / distance;
  const ny = dy / distance;
  const rawClosingSpeedAB = relVx * nx + relVy * ny;
  const closingSpeedAB = rawClosingSpeedAB === 0 ? 0 : rawClosingSpeedAB;

  return {
    distance,
    relativeSpeed,
    closingSpeedAB,
    closingSpeedBA: closingSpeedAB,
  };
}

export function getClosingSpeed(
  snapshot: PhysicsSnapshot,
  fromId: string,
  toId: string,
): number | undefined {
  const pair = snapshot.playerPairs.get(pairKey(fromId, toId));

  if (!pair) {
    return undefined;
  }

  return fromId < toId
    ? pair.closingSpeedAB
    : pair.closingSpeedBA;
}

function toPlayerPhysicsState(player: LivePlayer): PlayerPhysicsState {
  return {
    id: player.player.id,
    position: {
      x: player.position.x,
      y: player.position.y,
    },
    velocity: {
      x: player.velocity.x,
      y: player.velocity.y,
    },
  };
}

function toBallPhysicsState(ball: Ball): BallPhysicsState {
  return {
    position: {
      x: ball.position.x,
      y: ball.position.y,
    },
    velocity: {
      x: ball.velocity.x,
      y: ball.velocity.y,
    },
  };
}

export function buildPhysicsSnapshot(
  world: Pick<LiveMatchState, 'players' | 'ball'>,
  tick: number,
): PhysicsSnapshot {
  const players = Object.values(world.players).map(toPlayerPhysicsState);
  const ball = toBallPhysicsState(world.ball);

  const playerPairs = new Map<string, PairPhysics>();
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const p1 = players[i];
      const p2 = players[j];
      const a = p1.id < p2.id ? p1 : p2;
      const b = p1.id < p2.id ? p2 : p1;

      playerPairs.set(
        pairKey(a.id, b.id),
        computePairPhysics(a, b),
      );
    }
  }

  const ballPairs = new Map<string, PairPhysics>();
  for (const player of players) {
    ballPairs.set(
      player.id,
      computePairPhysics(player, ball),
    );
  }

  return {
    tick,
    players,
    ball,
    playerPairs,
    ballPairs,
  };
}
