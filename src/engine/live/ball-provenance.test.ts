import { describe, expect, it } from 'vitest';

import { applyClearance, applyShot, controlBall, createBall, DEFAULT_BALL_PHYSICS } from './ball';
import { DEFAULT_PITCH_DIMENSIONS } from './pitch';

describe('ball action provenance', () => {
  it('clears shot provenance when a shot is controlled', () => {
    const ball = createBall(DEFAULT_PITCH_DIMENSIONS);

    applyShot(
      ball,
      { x: 70, y: 34, z: DEFAULT_BALL_PHYSICS.radius },
      { x: 105, y: 34 },
      0.8,
      DEFAULT_BALL_PHYSICS,
      'shooter',
      'home',
    );

    expect(ball.lastAction).toBe('shot');

    controlBall(ball, 'receiver', 'away');

    expect(ball.lastAction).toBe('control');
    expect(ball.lastTouchId).toBe('receiver');
  });

  it('clears shot provenance when a clearance launches the ball', () => {
    const ball = createBall(DEFAULT_PITCH_DIMENSIONS);

    applyShot(
      ball,
      { x: 70, y: 34, z: DEFAULT_BALL_PHYSICS.radius },
      { x: 105, y: 34 },
      0.8,
      DEFAULT_BALL_PHYSICS,
      'shooter',
      'home',
    );

    expect(ball.lastAction).toBe('shot');

    applyClearance(
      ball,
      { x: 90, y: 34, z: DEFAULT_BALL_PHYSICS.radius },
      { x: -1, y: 0 },
      0.8,
      DEFAULT_BALL_PHYSICS,
      'defender',
      'away',
    );

    expect(ball.lastAction).toBe('clearance');
    expect(ball.lastTouchId).toBe('defender');
  });
});
