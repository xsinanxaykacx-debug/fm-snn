import type { BallState, MatchEvent, Pitch, TeamSide, Vec2, Vec3 } from './state';

const EPSILON = 1e-9;

type BoundarySide = 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';

export type BoundaryCrossing = {
  side: BoundarySide;
  point: Vec2;
  z: number;
  recovered: boolean;
};

export type BoundaryResult = {
  event: MatchEvent | null;
  crossing: BoundaryCrossing | null;
};

function finite(point: Vec3): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z)
  );
}

function inside(pitch: Pitch, point: Vec3): boolean {
  return (
    point.x >= -EPSILON &&
    point.x <= pitch.length + EPSILON &&
    point.y >= -EPSILON &&
    point.y <= pitch.width + EPSILON
  );
}

function inGoalMouth(pitch: Pitch, y: number): boolean {
  const halfGoalWidth = pitch.goalWidth / 2;

  return (
    y >= pitch.width / 2 - halfGoalWidth - EPSILON &&
    y <= pitch.width / 2 + halfGoalWidth + EPSILON
  );
}

function clampPoint(pitch: Pitch, point: Vec3): Vec2 {
  return {
    x: Math.max(0, Math.min(pitch.length, point.x)),
    y: Math.max(0, Math.min(pitch.width, point.y)),
  };
}

function nearestViolatedSide(
  pitch: Pitch,
  point: Vec3,
): BoundarySide | null {
  const candidates: Array<{
    side: BoundarySide;
    distance: number;
  }> = [];

  if (point.x < 0) {
    candidates.push({ side: 'LEFT', distance: -point.x });
  }

  if (point.x > pitch.length) {
    candidates.push({
      side: 'RIGHT',
      distance: point.x - pitch.length,
    });
  }

  if (point.y < 0) {
    candidates.push({ side: 'TOP', distance: -point.y });
  }

  if (point.y > pitch.width) {
    candidates.push({
      side: 'BOTTOM',
      distance: point.y - pitch.width,
    });
  }

  candidates.sort(
    (a, b) => a.distance - b.distance || a.side.localeCompare(b.side),
  );

  return candidates[0]?.side ?? null;
}

function segmentCrossing(
  pitch: Pitch,
  previous: Vec3,
  next: Vec3,
): BoundaryCrossing | null {
  const candidates: Array<{
    t: number;
    side: BoundarySide;
  }> = [];

  const dx = next.x - previous.x;
  const dy = next.y - previous.y;

  if (Math.abs(dx) > EPSILON) {
    const leftT = (0 - previous.x) / dx;
    const rightT = (pitch.length - previous.x) / dx;

    if (leftT >= -EPSILON && leftT <= 1 + EPSILON) {
      candidates.push({ t: leftT, side: 'LEFT' });
    }

    if (rightT >= -EPSILON && rightT <= 1 + EPSILON) {
      candidates.push({ t: rightT, side: 'RIGHT' });
    }
  }

  if (Math.abs(dy) > EPSILON) {
    const topT = (0 - previous.y) / dy;
    const bottomT = (pitch.width - previous.y) / dy;

    if (topT >= -EPSILON && topT <= 1 + EPSILON) {
      candidates.push({ t: topT, side: 'TOP' });
    }

    if (bottomT >= -EPSILON && bottomT <= 1 + EPSILON) {
      candidates.push({ t: bottomT, side: 'BOTTOM' });
    }
  }

  candidates.sort(
    (a, b) => a.t - b.t || a.side.localeCompare(b.side),
  );

  const candidate = candidates[0];

  if (!candidate) {
    return null;
  }

  const t = Math.max(0, Math.min(1, candidate.t));

  return {
    side: candidate.side,
    point: {
      x: previous.x + dx * t,
      y: previous.y + dy * t,
    },
    z: previous.z + (next.z - previous.z) * t,
    recovered: false,
  };
}

function outsideCrossing(
  pitch: Pitch,
  next: Vec3,
): BoundaryCrossing | null {
  const side = nearestViolatedSide(pitch, next);

  if (!side) {
    return null;
  }

  return {
    side,
    point: clampPoint(pitch, next),
    z: next.z,
    recovered: true,
  };
}

function opposite(side: TeamSide): TeamSide {
  return side === 'HOME' ? 'AWAY' : 'HOME';
}

function defendingSide(side: BoundarySide): TeamSide {
  return side === 'LEFT' ? 'HOME' : 'AWAY';
}

function restartPoint(pitch: Pitch, side: TeamSide): Vec2 {
  return {
    x:
      side === 'HOME'
        ? pitch.goalAreaDepth / 2
        : pitch.length - pitch.goalAreaDepth / 2,
    y: pitch.width / 2,
  };
}

function resolveCrossing(
  pitch: Pitch,
  crossing: BoundaryCrossing,
  ball: BallState,
): MatchEvent {
  if (crossing.side === 'TOP' || crossing.side === 'BOTTOM') {
    return {
      type: 'throw_in',
      side:
        ball.lastTouchSide === null
          ? 'HOME'
          : opposite(ball.lastTouchSide),
      point: crossing.point,
    };
  }

  const defending = defendingSide(crossing.side);
  const attacking =
    ball.lastTouchSide === null
      ? opposite(defending)
      : ball.lastTouchSide;

  if (
    inGoalMouth(pitch, crossing.point.y) &&
    crossing.z >= 0 &&
    crossing.z < pitch.goalHeight
  ) {
    return {
      type: 'goal',
      scorerSide: attacking,
      point: crossing.point,
    };
  }

  if (ball.lastTouchSide === defending) {
    return {
      type: 'corner',
      side: attacking,
      point: crossing.point,
    };
  }

  return {
    type: 'goal_kick',
    side: defending,
    point: restartPoint(pitch, defending),
  };
}

/**
 * Total and pure boundary resolver.
 *
 * It accepts both normal inside-to-outside crossings and states where the
 * ball is already outside the field. The caller never needs a second
 * "recovery" function.
 *
 * The function:
 * - never mutates the supplied ball or pitch;
 * - uses no RNG;
 * - derives the crossing from the current input pair;
 * - produces a deterministic result for identical inputs.
 */
export function resolveBoundary(
  pitch: Pitch,
  previousBallPosition: Vec3,
  nextBallPosition: Vec3,
  ball: BallState,
): BoundaryResult {
  if (!finite(previousBallPosition) || !finite(nextBallPosition)) {
    throw new Error('live-v2 boundary: non-finite ball position');
  }

  if (
    inside(pitch, previousBallPosition) &&
    inside(pitch, nextBallPosition)
  ) {
    return {
      event: null,
      crossing: null,
    };
  }

  const crossing =
    segmentCrossing(
      pitch,
      previousBallPosition,
      nextBallPosition,
    ) ?? outsideCrossing(pitch, nextBallPosition);

  if (!crossing) {
    return {
      event: null,
      crossing: null,
    };
  }

  return {
    event: resolveCrossing(pitch, crossing, ball),
    crossing,
  };
}
