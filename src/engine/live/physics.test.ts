import { describe, expect, it } from 'vitest';
import {
  buildPhysicsSnapshot,
  computePairPhysics,
  pairKey,
} from './physics';
import type { LiveMatchState } from '../types';

function makePlayer(
  id: string,
  x: number,
  y: number,
  vx: number,
  vy: number,
) {
  return {
    player: { id },
    position: { x, y },
    velocity: { x: vx, y: vy },
  };
}

function makeWorld(
  players: ReturnType<typeof makePlayer>[],
): Pick<LiveMatchState, 'players' | 'ball'> {
  const playerMap = Object.fromEntries(
    players.map((player) => [player.player.id, player]),
  );

  return {
    players: playerMap,
    ball: {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    },
  } as Pick<LiveMatchState, 'players' | 'ball'>;
}

function makeWorldN(n: number) {
  const players = [];

  for (let i = 0; i < n; i++) {
    players.push(
      makePlayer(`P${i}`, i * 2, 0, 0, 0),
    );
  }

  return makeWorld(players);
}

// ─────────────────────────────────────────────────────────────
// Pair key
// ─────────────────────────────────────────────────────────────

describe('pairKey', () => {
  it('aynı çifti sıralamadan bağımsız tekilleştirir', () => {
    expect(pairKey('P1', 'P2')).toBe('P1:P2');
    expect(pairKey('P2', 'P1')).toBe('P1:P2');
  });
});

// ─────────────────────────────────────────────────────────────
// Invariant testleri
// ─────────────────────────────────────────────────────────────

describe('PhysicsSnapshot invariants', () => {
  it('22 oyuncu için 231 player pair üretir', () => {
    const snap = buildPhysicsSnapshot(makeWorldN(22), 0);
    expect(snap.playerPairs.size).toBe(231);
  });

  it('22 oyuncu + top için 22 ball pair üretir', () => {
    const snap = buildPhysicsSnapshot(makeWorldN(22), 0);
    expect(snap.ballPairs.size).toBe(22);
  });

  it('tek oyuncu için playerPairs boş, ballPairs 1', () => {
    const snap = buildPhysicsSnapshot(makeWorldN(1), 0);
    expect(snap.playerPairs.size).toBe(0);
    expect(snap.ballPairs.size).toBe(1);
  });

  it('self-pair yok', () => {
    const snap = buildPhysicsSnapshot(makeWorldN(22), 0);

    for (const key of snap.playerPairs.keys()) {
      const [a, b] = key.split(':');
      expect(a).not.toBe(b);
    }
  });

  it('her player pair için closingSpeedBA === -closingSpeedAB', () => {
    const snap = buildPhysicsSnapshot(makeWorldN(22), 0);

    for (const pair of snap.playerPairs.values()) {
      expect(pair.closingSpeedBA).toBeCloseTo(-pair.closingSpeedAB, 10);
    }
  });

  it('her ball pair için closingSpeedBA === -closingSpeedAB', () => {
    const snap = buildPhysicsSnapshot(makeWorldN(22), 0);

    for (const pair of snap.ballPairs.values()) {
      expect(pair.closingSpeedBA).toBeCloseTo(-pair.closingSpeedAB, 10);
    }
  });

  it('her çiftte |closingSpeed| <= relativeSpeed', () => {
    const world = makeWorld([
      makePlayer('P1', 0, 0, 5, 0),
      makePlayer('P2', 10, 0, -3, 0),
      makePlayer('P3', 5, 5, 0, 5),
    ]);

    const snap = buildPhysicsSnapshot(world, 0);

    for (const pair of [
      ...snap.playerPairs.values(),
      ...snap.ballPairs.values(),
    ]) {
      expect(Math.abs(pair.closingSpeedAB)).toBeLessThanOrEqual(
        pair.relativeSpeed + 1e-9,
      );
    }
  });

  it('distance >= 0 ve relativeSpeed >= 0', () => {
    const snap = buildPhysicsSnapshot(makeWorldN(22), 0);

    for (const pair of [
      ...snap.playerPairs.values(),
      ...snap.ballPairs.values(),
    ]) {
      expect(pair.distance).toBeGreaterThanOrEqual(0);
      expect(pair.relativeSpeed).toBeGreaterThanOrEqual(0);
    }
  });

  it('deterministik: aynı world → aynı snapshot', () => {
    const world = makeWorldN(22);
    const s1 = buildPhysicsSnapshot(world, 42);
    const s2 = buildPhysicsSnapshot(world, 42);

    expect(s1.tick).toBe(s2.tick);
    expect(s1.players).toEqual(s2.players);
    expect(s1.ball).toEqual(s2.ball);
    expect(s1.playerPairs).toEqual(s2.playerPairs);
    expect(s1.ballPairs).toEqual(s2.ballPairs);
  });

  it('ballPairs key doğrudan playerId olur', () => {
    const snap = buildPhysicsSnapshot(makeWorldN(3), 0);

    expect([...snap.ballPairs.keys()].sort()).toEqual([
      'P0',
      'P1',
      'P2',
    ]);
  });
});

// ─────────────────────────────────────────────────────────────
// Deterministik geometri testleri
// ─────────────────────────────────────────────────────────────

describe('computePairPhysics geometry', () => {
  it('head-on yaklaşma: closingSpeed = 8', () => {
    const pair = computePairPhysics(
      {
        position: { x: 0, y: 0 },
        velocity: { x: 5, y: 0 },
      },
      {
        position: { x: 10, y: 0 },
        velocity: { x: -3, y: 0 },
      },
    );

    expect(pair.distance).toBeCloseTo(10);
    expect(pair.relativeSpeed).toBeCloseTo(8);
    expect(pair.closingSpeedAB).toBeCloseTo(8);
    expect(pair.closingSpeedBA).toBeCloseTo(-8);
  });

  it('aynı yön, tackler hızlı: closingSpeed = 1', () => {
    const pair = computePairPhysics(
      {
        position: { x: 0, y: 0 },
        velocity: { x: 5, y: 0 },
      },
      {
        position: { x: 10, y: 0 },
        velocity: { x: 4, y: 0 },
      },
    );

    expect(pair.closingSpeedAB).toBeCloseTo(1);
    expect(pair.relativeSpeed).toBeCloseTo(1);
  });

  it('aynı hız, aynı yön: closingSpeed = 0', () => {
    const pair = computePairPhysics(
      {
        position: { x: 0, y: 0 },
        velocity: { x: 5, y: 0 },
      },
      {
        position: { x: 10, y: 0 },
        velocity: { x: 5, y: 0 },
      },
    );

    expect(pair.closingSpeedAB).toBeCloseTo(0);
    expect(pair.relativeSpeed).toBeCloseTo(0);
  });

  it('perpendicular geçiş: radyal bileşen var', () => {
    const pair = computePairPhysics(
      {
        position: { x: 0, y: 0 },
        velocity: { x: 5, y: 0 },
      },
      {
        position: { x: 5, y: 0 },
        velocity: { x: 0, y: 5 },
      },
    );

    expect(pair.closingSpeedAB).toBeCloseTo(5);
    expect(pair.relativeSpeed).toBeCloseTo(Math.hypot(5, 5));
  });

  it('uzaklaşma: closingSpeed negatif', () => {
    const pair = computePairPhysics(
      {
        position: { x: 0, y: 0 },
        velocity: { x: -3, y: 0 },
      },
      {
        position: { x: 10, y: 0 },
        velocity: { x: 5, y: 0 },
      },
    );

    expect(pair.closingSpeedAB).toBeCloseTo(-8);
    expect(pair.relativeSpeed).toBeCloseTo(8);
  });

  it('aynı konum: closingSpeed = 0, distance = 0', () => {
    const pair = computePairPhysics(
      {
        position: { x: 5, y: 5 },
        velocity: { x: 3, y: 0 },
      },
      {
        position: { x: 5, y: 5 },
        velocity: { x: 0, y: 3 },
      },
    );

    expect(pair.distance).toBe(0);
    expect(pair.closingSpeedAB).toBe(0);
    expect(pair.closingSpeedBA).toBe(0);
    expect(pair.relativeSpeed).toBeCloseTo(Math.hypot(3, -3));
  });
});
