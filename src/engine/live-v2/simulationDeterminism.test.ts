import { describe, expect, it } from 'vitest';
import { simulateMatchV2 } from './simulation';
import type { MatchState } from './state';

function initialState(seed = 123456): MatchState {
  return {
    seed: { seed },
    clockSeconds: 0,
    tick: 0,
    phase: 'first_half',
    pitch: { length: 104, width: 64, goalWidth: 7.32, goalHeight: 2.44, goalAreaDepth: 5.5 },
    score: { home: 0, away: 0 },
    ball: {
      position: { x: 10, y: 10, z: 0.11 },
      velocity: { x: 0, y: 0, z: 0 },
      ownerId: 'h1',
      lastTouchId: 'h1',
      lastTouchSide: 'HOME',
    },
    players: {
      h1: { id: 'h1', team: 'HOME', position: { x: 10, y: 10 }, velocity: { x: 0, y: 0 } },
      a1: { id: 'a1', team: 'AWAY', position: { x: 94, y: 54 }, velocity: { x: 0, y: 0 } },
    },
    teams: {
      HOME: { id: 'home', side: 'HOME', playerIds: ['h1'] },
      AWAY: { id: 'away', side: 'AWAY', playerIds: ['a1'] },
    },
    restart: null,
    events: [],
    diagnostics: {
      lastPhase: 'first_half',
      lastTick: 0,
      lastBallPosition: { x: 10, y: 10, z: 0.11 },
      lastBallVelocity: { x: 0, y: 0, z: 0 },
    },
  };
}

describe('live-v2 simulation determinism acceptance', () => {
  it.each([1, 100, 1000, 5400])(
    'same seed + same input produces exactly the same MatchState after %s ticks',
    (ticks) => {
      const a = simulateMatchV2(initialState(), ticks);
      const b = simulateMatchV2(initialState(), ticks);

      expect(a).toEqual(b);
    },
  );

  it('different seeds can produce different final state when RNG is consumed', () => {
    const a = simulateMatchV2(initialState(123456), 1);
    const b = simulateMatchV2(initialState(1000000000), 1);

    expect(a).not.toEqual(b);
    expect(a.seed).not.toEqual(b.seed);
  });

  it('same seed produces deterministic seed progression after N ticks', () => {
    const a = simulateMatchV2(initialState(123456), 1000);
    const b = simulateMatchV2(initialState(123456), 1000);

    expect(a.seed).toEqual(b.seed);
  });
});
