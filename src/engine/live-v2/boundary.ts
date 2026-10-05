import type { BallState, MatchEvent, Pitch, TeamSide, Vec2, Vec3 } from './types';

const EPSILON = 1e-9;

type BoundarySide = 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';

export type BoundaryCrossing = { side: BoundarySide; point: Vec2; z: number; recovered: boolean };

export type BoundaryResult = { event: MatchEvent | null; crossing: BoundaryCrossing | null };

function finite(p: Vec3): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
}

function inside(pitch: Pitch, p: Vec3): boolean {
  return p.x >= -EPSILON && p.x <= pitch.length + EPSILON && p.y >= -EPSILON && p.y <= pitch.width + EPSILON;
}

function inGoalMouth(pitch: Pitch, y: number): boolean {
  const half = pitch.goalWidth / 2;
  return y >= pitch.width / 2 - half - EPSILON && y <= pitch.width / 2 + half + EPSILON;
}

function clampPoint(pitch: Pitch, p: Vec3): Vec2 {
  return { x: Math.max(0, Math.min(pitch.length, p.x)), y: Math.max(0, Math.min(pitch.width, p.y)) };
}

function nearestViolatedSide(pitch: Pitch, p: Vec3): BoundarySide | null {
  const candidates: Array<{ side: BoundarySide; distance: number }> = [];
  if (p.x < 0) candidates.push({ side: 'LEFT', distance: -p.x });
  if (p.x > pitch.length) candidates.push({ side: 'RIGHT', distance: p.x - pitch.length });
  if (p.y < 0) candidates.push({ side: 'TOP', distance: -p.y });
  if (p.y > pitch.width) candidates.push({ side: 'BOTTOM', distance: p.y - pitch.width });
  candidates.sort((a, b) => a.distance - b.distance || a.side.localeCompare(b.side));
  return candidates[0]?.side ?? null;
}

function segmentCrossing(pitch: Pitch, prev: Vec3, next: Vec3): BoundaryCrossing | null {
  const candidates: Array<{ t: number; side: BoundarySide }> = [];
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;

  if (Math.abs(dx) > EPSILON) {
    const left = (0 - prev.x) / dx;
    const right = (pitch.length - prev.x) / dx;
    if (left >= -EPSILON && left <= 1 + EPSILON) candidates.push({ t: left, side: 'LEFT' });
    if (right >= -EPSILON && right <= 1 + EPSILON) candidates.push({ t: right, side: 'RIGHT' });
  }

  if (Math.abs(dy) > EPSILON) {
    const top = (0 - prev.y) / dy;
    const bottom = (pitch.width - prev.y) / dy;
    if (top >= -EPSILON && top <= 1 + EPSILON) candidates.push({ t: top, side: 'TOP' });
    if (bottom >= -EPSILON && bottom <= 1 + EPSILON) candidates.push({ t: bottom, side: 'BOTTOM' });
  }

  candidates.sort((a, b) => a.t - b.t || a.side.localeCompare(b.side));
  const candidate = candidates[0];
  if (!candidate) return null;

  const t = Math.max(0, Math.min(1, candidate.t));
  return {
    side: candidate.side,
    point: { x: prev.x + dx * t, y: prev.y + dy * t },
    z: prev.z + (next.z - prev.z) * t,
    recovered: false,
  };
}

function outsideCrossing(pitch: Pitch, next: Vec3): BoundaryCrossing | null {
  const side = nearestViolatedSide(pitch, next);
  if (!side) return null;
  return { side, point: clampPoint(pitch, next), z: next.z, recovered: true };
}

function opposite(side: TeamSide): TeamSide {
  return side === 'HOME' ? 'AWAY' : 'HOME';
}

function defendingSide(side: BoundarySide): TeamSide {
  return side === 'LEFT' ? 'HOME' : 'AWAY';
}

function restartPoint(pitch: Pitch, side: TeamSide): Vec2 {
  return { x: side === 'HOME' ? pitch.goalAreaDepth / 2 : pitch.length - pitch.goalAreaDepth / 2, y: pitch.width / 2 };
}

function resolveCrossing(pitch: Pitch, crossing: BoundaryCrossing, ball: BallState): MatchEvent {
  if (crossing.side === 'TOP' || crossing.side === 'BOTTOM') {
    return { type: 'throw_in', side: ball.lastTouchSide === null ? 'HOME' : opposite(ball.lastTouchSide), point: crossing.point };
  }

  const defending = defendingSide(crossing.side);
  const attacking = ball.lastTouchSide === null ? opposite(defending) : ball.lastTouchSide;

  if (inGoalMouth(pitch, crossing.point.y) && crossing.z < pitch.goalHeight) {
    return { type: 'goal', scorerSide: attacking, point: crossing.point };
  }

  if (ball.lastTouchSide === defending) {
    return { type: 'corner', side: attacking, point: crossing.point };
  }

  return { type: 'goal_kick', side: defending, point: restartPoint(pitch, defending) };
}

/**
 * Total and pure boundary resolver.
 *
 * It handles normal segment crossings and balls that are already outside.
 * There is deliberately no caller-side recovery API.
 */
export function resolveBoundary(pitch: Pitch, prevBallPos: Vec3, nextBallPos: Vec3, ball: BallState): BoundaryResult {
  if (!finite(prevBallPos) || !finite(nextBallPos)) {
    throw new Error('live-v2 boundary: non-finite ball position');
  }

  if (inside(pitch, prevBallPos) && inside(pitch, nextBallPos)) {
    return { event: null, crossing: null };
  }

  const crossing = segmentCrossing(pitch, prevBallPos, nextBallPos) ?? outsideCrossing(pitch, nextBallPos);
  if (!crossing) return { event: null, crossing: null };

  return { event: resolveCrossing(pitch, crossing, ball), crossing };
}