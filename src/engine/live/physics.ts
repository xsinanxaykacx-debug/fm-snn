// src/engine/live/physics.ts

import type { Ball, LiveMatchState, LivePlayer } from '../types';

// ─────────────────────────────────────────────────────────────
// Types (kilitli sözleşme — docs/LIVE_ENGINE_ARCHITECTURE_V1.md)
// ─────────────────────────────────────────────────────────────

export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerPhysicsState {
  id: string;
  position: Vector2;
  velocity: Vector2;
  // V2: acceleration — velocity(t) - velocity(t-1) / Δt'den türetilecek
}

export interface BallPhysicsState {
  position: Vector2;
  velocity: Vector2;
}

export interface PairPhysics {
  distance: number;
  relativeSpeed: number;

  /** A'nın B'ye göre kapanma hızı. Pozitif = yaklaşıyor. */
  closingSpeedAB: number;

  /** = -closingSpeedAB. Yapısal invariant, tekrar hesaplanmaz. */
  closingSpeedBA: number;
}

export interface PhysicsSnapshot {
  tick: number;
  players: PlayerPhysicsState[];
  ball: BallPhysicsState;
  playerPairs: Map<string, PairPhysics>;
  /**
   * Key = playerId. Top tek bir varlık olduğu için pairKey kullanılmaz.
   * Her oyuncunun top ile tam olarak bir fiziksel ilişkisi vardır.
   */
  ballPairs: Map<string, PairPhysics>;
}

// ─────────────────────────────────────────────────────────────
// Pair key — simetrik, tekilleştirilmiş
// ─────────────────────────────────────────────────────────────

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

// ─────────────────────────────────────────────────────────────
// Core physics: tek çift için
// ─────────────────────────────────────────────────────────────

const EPSILON = 1e-9;

/**
 * A ve B arasındaki fiziksel ilişkiyi hesaplar.
 *
 * closingSpeedAB tanımı:
 *   birim vektör n = (B.position - A.position) / |B.position - A.position|
 *   relV = A.velocity - B.velocity
 *   closingSpeedAB = relV · n
 *
 * Pozitif → mesafe azalıyor. Negatif → mesafe artıyor.
 *
 * Aynı konumdaki iki varlık için closingSpeed = 0.
 */
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

  // Aynı konum: yön tanımsız → closingSpeed = 0.
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

  // -0 → +0 normalizasyonu.
  // V1 invariant'ı sayısal işaret biti seviyesinde de kararlı tutar.
  const closingSpeedAB = rawClosingSpeedAB === 0 ? 0 : rawClosingSpeedAB;

  return {
    distance,
    relativeSpeed,
    closingSpeedAB,
    // Yapısal invariant: ters yön yeniden hesaplanmıyor.
    closingSpeedBA: -closingSpeedAB,
  };
}

// ─────────────────────────────────────────────────────────────
// Snapshot read API
// ─────────────────────────────────────────────────────────────

/**
 * Snapshot içindeki player pair'den, fromId → toId yönündeki
 * kapanma hızını okur.
 *
 * Yön semantiği korunur: getClosingSpeed(s, A, B)
 * === -getClosingSpeed(s, B, A).
 * Pair mevcut değilse undefined döner; 0 ile karıştırılmaz.
 */
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

// ─────────────────────────────────────────────────────────────
// World → physics projection
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Snapshot builder — her simulation tick'inde
// ─────────────────────────────────────────────────────────────

/**
 * LiveMatchState'ten PhysicsSnapshot üretir.
 *
 * Sözleşme:
 *   - n oyuncu → C(n, 2) player pair
 *   - n oyuncu + top → n ball pair
 *   - Deterministik: aynı world → aynı snapshot
 *   - Hiçbir türetilmiş sorgu (nearestOpponent vb.) yok
 *
 * V1'de physics yalnızca mevcut authoritative position/velocity
 * state'ini okur; world state'i mutate etmez.
 */
export function buildPhysicsSnapshot(
  world: Pick<LiveMatchState, 'players' | 'ball'>,
  tick: number,
): PhysicsSnapshot {
  const players = Object.values(world.players)
    .map(toPlayerPhysicsState);

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
    // Top tek olduğu için key doğrudan playerId'dir.
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
