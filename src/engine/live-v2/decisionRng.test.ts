import { describe, expect, it } from 'vitest';
import { decide, type DecisionResult } from './decision';
import { perceive } from './perception';
import { nextRandom } from './rng';
import type { MatchState } from './state';

function state(seed = 123456): MatchState {
  return {
    seed: { seed },
    clockSeconds: 0,
    tick: 0,
    phase: 'first_half',
    pitch: { length: 104, width: 64, goalWidth: 7.32, goalHeight: 2.44, goalAreaDepth: 5.5 },
    score: { home: 0, away: 0 },
    ball: {
      position: { x: 50, y: 32, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      ownerId: 'h1',
      lastTouchId: 'h1',
      lastTouchSide: 'HOME',
    },
    players: {
      h1: { id: 'h1', team: 'HOME', position: { x: 50, y: 32 }, velocity: { x: 0, y: 0 } },
      h2: { id: 'h2', team: 'HOME', position: { x: 70, y: 20 }, velocity: { x: 0, y: 0 } },
      a1: { id: 'a1', team: 'AWAY', position: { x: 65, y: 32 }, velocity: { x: 0, y: 0 } },
    },
    teams: {
      HOME: { id: 'home', side: 'HOME', playerIds: ['h1', 'h2'] },
      AWAY: { id: 'away', side: 'AWAY', playerIds: ['a1'] },
    },
    restart: null,
    events: [],
    diagnostics: {
      lastPhase: 'first_half',
      lastTick: 0,
      lastBallPosition: { x: 50, y: 32, z: 0 },
      lastBallVelocity: { x: 0, y: 0, z: 0 },
    },
    restart: null,
    events: [],
  };
}

function ownerDecision(result: DecisionResult) {
  return result.find((decision) => decision.playerId === 'h1')?.action;
}

describe('live-v2 decision RNG', () => {
  it('same seed and same input produce the same action', () => {
    const a = decide(state(123456), perceive(state(123456)));
    const b = decide(state(123456), perceive(state(123456)));

    expect(a).toEqual(b);
    expect(ownerDecision(a)).toBe(ownerDecision(b));
  });

  it('different seeds can produce different actions when multiple actions are valid', () => {
    const actions = new Set<number | string>();
    for (const seed of [123456, 1000000000]) {
      actions.add(ownerDecision(decide(state(seed), perceive(state(seed)))) ?? 'NONE');
    }

    expect(actions.size).toBeGreaterThan(1);
  });

  it('keeps equal-distance player ordering deterministic by player id', () => {
    const s = state(123456);
    const tied = {
      ...s,
      ball: { ...s.ball, ownerId: null },
      players: {
        ...s.players,
        h2: { ...s.players.h2, position: { x: 60, y: 32 } },
        a1: { ...s.players.a1, position: { x: 40, y: 32 } },
      },
    };

    const result = decide(tied, perceive(tied));

    expect(result.map((decision) => decision.playerId)).toEqual(['a1', 'h1', 'h2']);
  });

  it('keeps CHASE deterministic and independent of RNG seed', () => {
    const a = state(1);
    const b = state(987654321);
    a.ball.ownerId = null;
    b.ball.ownerId = null;

    const resultA = decide(a, perceive(a));
    const resultB = decide(b, perceive(b));

    expect(resultA.find((decision) => decision.playerId === 'h1')).toEqual(
      resultB.find((decision) => decision.playerId === 'h1'),
    );
    expect(resultA.seed).toEqual({ seed: 1 });
    expect(resultB.seed).toEqual({ seed: 987654321 });
  });

  it('advances the seed when an owned-ball decision consumes RNG', () => {
    const result = decide(state(123456), perceive(state(123456)));

    expect(result.seed.seed).not.toBe(123456);
  });

  it('consumes exactly one RNG value for one owned-ball decision', () => {
    const start = state(123456);
    const result = decide(start, perceive(start));
    const [, expectedSeed] = nextRandom(start.seed);

    expect(result.seed).toEqual(expectedSeed);
  });
});
