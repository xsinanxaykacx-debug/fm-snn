import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BALL_PHYSICS,
  applyPass,
  applyShot,
  createBall,
} from './ball';

const pitch = {
  length: 105,
  width: 68,
  goalWidth: 7.32,
  goalHeight: 2.44,
  penaltyAreaDepth: 16.5,
  penaltyAreaWidth: 40.32,
  goalAreaDepth: 5.5,
  goalAreaWidth: 18.32,
  penaltySpotDistance: 11,
  centerCircleRadius: 9.15,
  cornerArcRadius: 1,
};

describe('BUG-020 shot causality', () => {
  it('keeps shot provenance only until the ball receives a new action', () => {
    const ball = createBall(pitch);

    applyShot(
      ball,
      { x: 80, y: 34, z: DEFAULT_BALL_PHYSICS.radius },
      { x: 105, y: 34 },
      0.7,
      DEFAULT_BALL_PHYSICS,
      'shooter-1',
      'home'
    );

    expect(ball.lastAction).toBe('shot');
    expect(ball.lastTouchId).toBe('shooter-1');

    applyPass(
      ball,
      { x: 80, y: 34, z: DEFAULT_BALL_PHYSICS.radius },
      { x: 85, y: 34 },
      0.5,
      DEFAULT_BALL_PHYSICS,
      'shooter-1',
      'home'
    );

    expect(ball.lastAction).toBe('pass');
    expect(ball.lastTouchId).toBe('shooter-1');
  });
});
