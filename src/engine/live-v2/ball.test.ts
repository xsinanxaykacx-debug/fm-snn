import { describe, expect, it } from 'vitest';
import { stepBall } from './ball';
import type { MatchState } from './state';

const state: MatchState = {
  clockSeconds: 0, tick: 0, phase: 'first_half',
  pitch: { length: 104, width: 64, goalWidth: 7.32, goalHeight: 2.44, goalAreaDepth: 5.5 },
  score: { home: 0, away: 0 },
  ball: { position: { x: 50, y: 32, z: 1 }, velocity: { x: 10, y: 0, z: 10 }, ownerId: null, lastTouchId: null, lastTouchSide: null },
  players: {},
  teams: { HOME: { id: 'home', side: 'HOME', playerIds: [] }, AWAY: { id: 'away', side: 'AWAY', playerIds: [] } },
  restart: null, events: [],
  diagnostics: { lastPhase: 'first_half', lastTick: 0, lastBallPosition: { x: 50, y: 32, z: 1 }, lastBallVelocity: { x: 10, y: 0, z: 10 } },
};

describe('live-v2 ball physics', () => {
  it('moves according to velocity', () => {
    const next = stepBall(state, { dt: 1, friction: 0, gravity: 0, stopSpeed: 0 });
    expect(next.ball.position).toEqual({ x: 60, y: 32, z: 11 });
  });
  it('applies friction', () => {
    const next = stepBall(state, { dt: 1, friction: 0.2, gravity: 0, stopSpeed: 0 });
    expect(next.ball.velocity.x).toBe(8);
    expect(next.ball.position.x).toBe(58);
  });
  it('applies gravity', () => {
    const next = stepBall(state, { dt: 1, friction: 0, gravity: 9.81, stopSpeed: 0 });
    expect(next.ball.velocity.z).toBeCloseTo(0.19);
    expect(next.ball.position.z).toBeCloseTo(1.19);
  });
  it('allows the ball outside the pitch for boundary resolution', () => {
    const next = stepBall({ ...state, ball: { ...state.ball, position: { x: 103, y: 32, z: 0.1 }, velocity: { x: 10, y: 0, z: 0 } } }, { dt: 1, friction: 0, gravity: 0, stopSpeed: 0 });
    expect(next.ball.position.x).toBe(113);
  });
  it('is deterministic', () => expect(stepBall(state)).toEqual(stepBall(state)));
});
