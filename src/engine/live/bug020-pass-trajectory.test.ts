import { describe, expect, it } from 'vitest';
import type { PitchDimensions } from '../types';
import {
  DEFAULT_BALL_PHYSICS,
  applyPass,
  createBall,
  stepBall,
} from './ball';

const PITCH: PitchDimensions = {
  length: 105,
  width: 68,
  goalWidth: 7.32,
  goalHeight: 2.44,
  postRadius: 0.06,
  penaltyAreaDepth: 16.5,
  penaltyAreaWidth: 40.3,
  goalAreaDepth: 5.5,
  goalAreaWidth: 18.32,
  penaltySpotDistance: 11,
  centerCircleRadius: 9.15,
  cornerArcRadius: 1,
};

describe('BUG-020 pass trajectory regression', () => {
  it('stops a ground pass at its intended target instead of crossing the goal line', () => {
    const ball = createBall(PITCH);

    applyPass(
      ball,
      { x: 12, y: 34, z: DEFAULT_BALL_PHYSICS.radius },
      { x: 18, y: 34 },
      1,
      DEFAULT_BALL_PHYSICS,
      'passer',
      'club'
    );

    for (let tick = 0; tick < 100; tick += 1) {
      stepBall(ball, PITCH, DEFAULT_BALL_PHYSICS, 0.1);
      if (!ball.isMoving) break;
    }

    expect(ball.position.x).toBe(18);
    expect(ball.position.y).toBe(34);
    expect(ball.isMoving).toBe(false);
    expect(ball.targetPosition).toBeUndefined();
  });
});
