import { describe, expect, it } from 'vitest';
import { applyMovement, assertPlayerPositionsBounded } from './movement';
import type { MatchState } from './state';

const baseState: MatchState = {
  clockSeconds: 10,
  tick: 10,
  phase: 'first_half',
  pitch: {
    length: 104,
    width: 64,
    goalWidth: 7.32,
    goalHeight: 2.44,
    goalAreaDepth: 5.5,
  },
  score: { home: 0, away: 0 },
  ball: {
    position: { x: 52, y: 32, z: 0.11 },
    velocity: { x: 0, y: 0, z: 0 },
    ownerId: 'p1',
    lastTouchId: 'p1',
    lastTouchSide: 'HOME',
  },
  players: {
    p1: {
      id: 'p1',
      team: 'HOME',
      position: { x: 52, y: 32 },
      velocity: { x: 0, y: 0 },
    },
    p2: {
      id: 'p2',
      team: 'AWAY',
      position: { x: 10, y: 20 },
      velocity: { x: 0, y: 0 },
    },
  },
  teams: {
    HOME: { id: 'home', side: 'HOME', playerIds: ['p1'] },
    AWAY: { id: 'away', side: 'AWAY', playerIds: ['p2'] },
  },
  restart: null,
  events: [],
  diagnostics: {
    lastPhase: 'first_half',
    lastTick: 10,
    lastBallPosition: { x: 52, y: 32, z: 0.11 },
    lastBallVelocity: { x: 0, y: 0, z: 0 },
  },
};

describe('live-v2 movement', () => {
  it('moves a player by the requested displacement', () => {
    const next = applyMovement(baseState, [
      { playerId: 'p1', displacement: { x: 2, y: -3 } },
    ]);

    expect(next.players.p1.position).toEqual({ x: 54, y: 29 });
  });

  it('clamps movement at the left and top boundaries', () => {
    const next = applyMovement(baseState, [
      { playerId: 'p1', displacement: { x: -100, y: -100 } },
    ]);

    expect(next.players.p1.position).toEqual({ x: 0, y: 0 });
    expect(() => assertPlayerPositionsBounded(next)).not.toThrow();
  });

  it('clamps movement at the right and bottom boundaries', () => {
    const next = applyMovement(baseState, [
      { playerId: 'p1', displacement: { x: 100, y: 100 } },
    ]);

    expect(next.players.p1.position).toEqual({ x: 104, y: 64 });
    expect(() => assertPlayerPositionsBounded(next)).not.toThrow();
  });

  it('does not mutate the input MatchState', () => {
    const next = applyMovement(baseState, [
      { playerId: 'p1', displacement: { x: 5, y: 5 } },
    ]);

    expect(baseState.players.p1.position).toEqual({ x: 52, y: 32 });
    expect(next).not.toBe(baseState);
    expect(next.players).not.toBe(baseState.players);
  });

  it('leaves players without an intent unchanged', () => {
    const next = applyMovement(baseState, [
      { playerId: 'p1', displacement: { x: 1, y: 1 } },
    ]);

    expect(next.players.p2.position).toEqual({ x: 10, y: 20 });
  });

  it('rejects an unknown player id', () => {
    expect(() =>
      applyMovement(baseState, [
        { playerId: 'missing', displacement: { x: 1, y: 1 } },
      ]),
    ).toThrow('unknown player missing');
  });

  it('rejects non-finite movement input', () => {
    expect(() =>
      applyMovement(baseState, [
        { playerId: 'p1', displacement: { x: Number.NaN, y: 1 } },
      ]),
    ).toThrow('non-finite movement displacement');
  });

  it('is deterministic for identical inputs', () => {
    const intents = [
      { playerId: 'p1', displacement: { x: 7, y: -9 } },
      { playerId: 'p2', displacement: { x: -50, y: 80 } },
    ] as const;

    expect(applyMovement(baseState, intents)).toEqual(
      applyMovement(baseState, intents),
    );
  });
});
