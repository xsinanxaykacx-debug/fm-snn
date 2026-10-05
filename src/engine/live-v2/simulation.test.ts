import { describe, expect, it } from 'vitest';
import { simulateMatchV2 } from './simulation';
import { assertPlayerPositionsBounded } from './movement';
import type { MatchState } from './state';

function initialState(): MatchState {
  return {
    clockSeconds: 0, tick: 0, phase: 'first_half',
    pitch: { length: 104, width: 64, goalWidth: 7.32, goalHeight: 2.44, goalAreaDepth: 5.5 },
    score: { home: 0, away: 0 },
    ball: { position: { x: 52, y: 32, z: 0.11 }, velocity: { x: 0.5, y: 0.2, z: 0 }, ownerId: null, lastTouchId: null, lastTouchSide: 'HOME' },
    players: {
      h1: { id: 'h1', team: 'HOME', position: { x: 10, y: 10 }, velocity: { x: 0, y: 0 } },
      a1: { id: 'a1', team: 'AWAY', position: { x: 94, y: 54 }, velocity: { x: 0, y: 0 } },
    },
    teams: {
      HOME: { id: 'home', side: 'HOME', playerIds: ['h1'] },
      AWAY: { id: 'away', side: 'AWAY', playerIds: ['a1'] },
    },
    restart: null, events: [],
    diagnostics: { lastPhase: 'first_half', lastTick: 0, lastBallPosition: { x: 52, y: 32, z: 0.11 }, lastBallVelocity: { x: 0.5, y: 0.2, z: 0 } },
  };
}

describe('live-v2 short simulation', () => {
  for (const seconds of [10, 60, 300]) {
    it(`runs ${seconds} seconds without throwing`, () => {
      const finalState = simulateMatchV2(initialState(), seconds);
      expect(finalState.clockSeconds).toBe(seconds);
      expect(finalState.tick).toBe(seconds);
      expect(() => assertPlayerPositionsBounded(finalState)).not.toThrow();
    });
  }

  it('turns an out-of-bounds ball into a restart event', () => {
    const s = initialState();
    const finalState = simulateMatchV2({
      ...s,
      ball: {
        ...s.ball,
        position: { x: 103.5, y: 32, z: 0.11 },
        velocity: { x: 2, y: 0, z: 0 },
        lastTouchSide: 'AWAY',
      },
    }, 1);

    expect(finalState.events).toHaveLength(1);
    expect(finalState.events[0]?.type).toBe('goal');
    expect(finalState.score.away).toBe(1);
    expect(finalState.restart).toBeNull();
  });

  it('is deterministic for identical seeded input state', () => {
    const a = simulateMatchV2(initialState(), 300);
    const b = simulateMatchV2(initialState(), 300);
    expect(a).toEqual(b);
  });
});
