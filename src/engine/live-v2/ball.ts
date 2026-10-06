import type { MatchState, Vec3 } from './state';

export type BallPhysicsConfig = {
  dt: number;
  friction: number;
  gravity: number;
  stopSpeed: number;
};

export const DEFAULT_BALL_PHYSICS: BallPhysicsConfig = {
  dt: 1,
  friction: 0.15,
  gravity: 9.81,
  stopSpeed: 0.001,
};

function finiteVector(value: Vec3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

export function stepBall(
  state: MatchState,
  config: BallPhysicsConfig = DEFAULT_BALL_PHYSICS,
): MatchState {
  if (!Number.isFinite(config.dt) || config.dt <= 0) {
    throw new Error('live-v2 ball: invalid dt');
  }
  if (
    !Number.isFinite(config.friction) ||
    config.friction < 0 ||
    config.friction > 1
  ) {
    throw new Error('live-v2 ball: invalid friction');
  }
  if (!Number.isFinite(config.gravity) || config.gravity < 0) {
    throw new Error('live-v2 ball: invalid gravity');
  }
  if (!Number.isFinite(config.stopSpeed) || config.stopSpeed < 0) {
    throw new Error('live-v2 ball: invalid stopSpeed');
  }
  if (!finiteVector(state.ball.velocity)) {
    throw new Error(
      'live-v2 ball: non-finite velocity ' + JSON.stringify(state.ball.velocity),
    );
  }

  // Some live-v2 callers provide a ground-level ball as a 2D position.
  // Physics owns the vertical component, so an omitted z coordinate is the
  // ground plane rather than a non-finite physics value.
  const p = {
    x: state.ball.position.x,
    y: state.ball.position.y,
    z: state.ball.position.z ?? 0,
  };
  const { velocity: v } = state.ball;

  if (!finiteVector(p)) {
    throw new Error(
      'live-v2 ball: non-finite position ' + JSON.stringify(state.ball.position),
    );
  }

  const horizontalFactor = Math.max(
    0,
    1 - config.friction * config.dt,
  );

  const nextVelocity = {
    x: v.x * horizontalFactor,
    y: v.y * horizontalFactor,
    z: v.z - config.gravity * config.dt,
  };

  const nextPosition = {
    x: p.x + nextVelocity.x * config.dt,
    y: p.y + nextVelocity.y * config.dt,
    z: p.z + nextVelocity.z * config.dt,
  };

  /*
   * The football is not allowed to fall through the ground plane.
   * Boundary handling is intentionally separate: x/y may still leave the
   * pitch so boundary.ts can resolve the football event in the same tick.
   */
  if (nextPosition.z <= 0) {
    nextPosition.z = 0;
    nextVelocity.z = 0;
  }

  // Friction is continuous: do not hard-stop a live ball at a numeric
  // speed threshold. A hard zero here can create a permanent freeze when
  // no player owns the ball and all decisions are CHASE.
  const velocity = nextVelocity;

  return {
    ...state,
    ball: {
      ...state.ball,
      position: nextPosition,
      velocity,
    },
  };
}
