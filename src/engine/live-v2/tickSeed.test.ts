import { describe, expect, it } from 'vitest';
import { simulateMatchV2 } from './simulation';
import { runTick } from './tick';
import type { MatchState } from './state';
import type { RngState } from './rng';

function initialState(seed: RngState): MatchState {
  return {
    seed,
    clockSeconds: 0,
    tick: 0,
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
      position: { x: 50, y: 32, z: 0.11 },
      velocity: { x: 1, y: 0, z: 0 },
      ownerId: 'p1',
      lastTouchId: null,
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
        position: { x: 70, y: 32 },
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
      lastTick: 0,
      lastBallPosition: { x: 50, y: 32, z: 0.11 },
      lastBallVelocity: { x: 1, y: 0, z: 0 },
    },
  };
}

describe('live-v2 tick seed integration', () => {
  it('advances the seed when the owned player makes a decision', () => {
    const state = initialState({ seed: 123456 });

    const next = runTick(state);

    expect(next.seed).not.toEqual(state.seed);
  });

  it('same seed and same input produce the same tick result', () => {
    const a = runTick(initialState({ seed: 123456 }));
    const b = runTick(initialState({ seed: 123456 }));

    expect(a).toEqual(b);
  });

  it('different seeds can produce different decision results while preserving determinism', () => {
    const a = runTick(initialState({ seed: 123456 }));
    const b = runTick(initialState({ seed: 654321 }));

    expect(a.seed).not.toEqual(b.seed);
    expect(a.diagnostics.lastAction).not.toBe(b.diagnostics.lastAction);
  });

  it('MatchState seed is an RngState', () => {
    const state: MatchState = initialState({ seed: 123456 });

    expect(state.seed).toEqual({ seed: 123456 });
  });

  it('simulation consumes decision RNG deterministically', () => {
    const a = simulateMatchV2(initialState({ seed: 123456 }), 1);
    const b = simulateMatchV2(initialState({ seed: 123456 }), 1);

    expect(a).toEqual(b);
    expect(a.seed).not.toEqual({ seed: 123456 });
  });
});
