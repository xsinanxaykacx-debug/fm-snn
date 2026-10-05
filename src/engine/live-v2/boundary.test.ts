import { describe, expect, it } from 'vitest';
import { resolveBoundary } from './boundary';
import type { BallState, Pitch, PlayerState } from './state';

const pitch: Pitch = {
  length: 104,
  width: 64,
  goalWidth: 7.32,
  goalHeight: 2.44,
  goalAreaDepth: 5.5,
};

const players: Record<string, PlayerState> = {
  home1: {
    id: 'home1',
    team: 'HOME',
    position: { x: 20, y: 20 },
    velocity: { x: 0, y: 0 },
  },
  away1: {
    id: 'away1',
    team: 'AWAY',
    position: { x: 84, y: 44 },
    velocity: { x: 0, y: 0 },
  },
};

function ball(
  lastTouchSide: BallState['lastTouchSide'],
  lastTouchId: BallState['lastTouchId'] = null,
): BallState {
  return {
    position: { x: 0, y: 32, z: 0.11 },
    velocity: { x: 0, y: 0, z: 0 },
    ownerId: null,
    lastTouchId,
    lastTouchSide,
  };
}

function resolve(
  previous: { x: number; y: number; z: number },
  next: { x: number; y: number; z: number },
  state: BallState,
): ReturnType<typeof resolveBoundary> {
  return resolveBoundary(pitch, previous, next, state, players);
}

describe('live-v2 boundary', () => {
  it('returns no event while the ball remains inside', () => {
    const result = resolve(
      { x: 10, y: 32, z: 0.11 },
      { x: 11, y: 32, z: 0.11 },
      ball('AWAY'),
    );

    expect(result.event).toBeNull();
    expect(result.crossing).toBeNull();
  });

  it('detects a normal inside-to-outside goal crossing', () => {
    const result = resolve(
      { x: 0.8, y: 32, z: 0.11 },
      { x: -0.8, y: 32, z: 0.11 },
      ball('AWAY'),
    );

    expect(result.event).toEqual({
      type: 'goal',
      scorerSide: 'AWAY',
      point: { x: 0, y: 32 },
    });
    expect(result.crossing?.recovered).toBe(false);
  });

  it('detects a goal when both points are already outside', () => {
    const result = resolve(
      { x: -0.2, y: 32, z: 0.11 },
      { x: -2, y: 32, z: 0.11 },
      ball('AWAY'),
    );

    expect(result.event).toMatchObject({
      type: 'goal',
      scorerSide: 'AWAY',
    });
    expect(result.crossing?.recovered).toBe(true);
  });

  it('rejects a goal when the ball crosses the goal line outside the goal mouth', () => {
    const result = resolve(
      { x: 0.8, y: 10, z: 0.11 },
      { x: -0.8, y: 10, z: 0.11 },
      ball('AWAY'),
    );

    expect(result.event).toEqual({
      type: 'goal_kick',
      side: 'HOME',
      point: { x: 2.75, y: 32 },
    });
  });

  it('rejects a goal when a high ball crosses the goal mouth above the crossbar', () => {
    const result = resolve(
      { x: 0.8, y: 32, z: 3 },
      { x: -0.8, y: 32, z: 3 },
      ball('AWAY'),
    );

    expect(result.event).toEqual({
      type: 'goal_kick',
      side: 'HOME',
      point: { x: 2.75, y: 32 },
    });
  });

  it.each([
    ['left-bottom', 'LEFT', 20, { x: 0, y: 0 }],
    ['left-top', 'LEFT', 48, { x: 0, y: 64 }],
    ['right-bottom', 'RIGHT', 20, { x: 104, y: 0 }],
    ['right-top', 'RIGHT', 48, { x: 104, y: 64 }],
  ] as const)(
    'places %s corner at the correct corner arc point',
    (_name, _side, y, expected) => {
      const lastTouchSide = _side === 'LEFT' ? 'HOME' : 'AWAY';

      const result = resolve(
        _side === 'LEFT'
          ? { x: 10, y, z: 0.11 }
          : { x: 94, y, z: 0.11 },
        _side === 'LEFT'
          ? { x: -2, y, z: 0.11 }
          : { x: 106, y, z: 0.11 },
        ball(lastTouchSide),
      );

      expect(result.event).toEqual({
        type: 'corner',
        side: _side === 'LEFT' ? 'AWAY' : 'HOME',
        point: expected,
      });
    },
  );

  it('places a top touchline throw-in at the exact exit x and y = 0', () => {
    const result = resolve(
      { x: 37, y: 10, z: 0.11 },
      { x: 37, y: -2, z: 0.11 },
      ball('HOME'),
    );

    expect(result.event).toEqual({
      type: 'throw_in',
      side: 'AWAY',
      point: { x: 37, y: 0 },
    });
  });

  it('places a bottom touchline throw-in at the exact exit x and y = width', () => {
    const result = resolve(
      { x: 71, y: 54, z: 0.11 },
      { x: 71, y: 66, z: 0.11 },
      ball('AWAY'),
    );

    expect(result.event).toEqual({
      type: 'throw_in',
      side: 'HOME',
      point: { x: 71, y: 64 },
    });
  });

  it('places a left aut restart inside the left goal area', () => {
    const result = resolve(
      { x: 10, y: 20, z: 0.11 },
      { x: -2, y: 20, z: 0.11 },
      ball('AWAY'),
    );

    expect(result.event).toEqual({
      type: 'goal_kick',
      side: 'HOME',
      point: { x: 2.75, y: 32 },
    });
  });

  it('places a right aut restart inside the right goal area', () => {
    const result = resolve(
      { x: 94, y: 44, z: 0.11 },
      { x: 106, y: 44, z: 0.11 },
      ball('HOME'),
    );

    expect(result.event).toEqual({
      type: 'goal_kick',
      side: 'AWAY',
      point: { x: 101.25, y: 32 },
    });
  });

  it('uses lastTouchId team when lastTouchSide is null for a goal', () => {
    const result = resolve(
      { x: 0.8, y: 32, z: 0.11 },
      { x: -0.8, y: 32, z: 0.11 },
      ball(null, 'away1'),
    );

    expect(result.event).toEqual({
      type: 'goal',
      scorerSide: 'AWAY',
      point: { x: 0, y: 32 },
    });
  });

  it('uses lastTouchId team when lastTouchSide is null for a touchline restart', () => {
    const result = resolve(
      { x: 37, y: 10, z: 0.11 },
      { x: 37, y: -2, z: 0.11 },
      ball(null, 'home1'),
    );

    expect(result.event).toEqual({
      type: 'throw_in',
      side: 'AWAY',
      point: { x: 37, y: 0 },
    });
  });

  it('does not use an arbitrary side when both touch-side and touch-id are null', () => {
    expect(() =>
      resolve(
        { x: 37, y: 10, z: 0.11 },
        { x: 37, y: -2, z: 0.11 },
        ball(null, null),
      ),
    ).toThrow('null lastTouchSide requires lastTouchId');
  });

  it('does not use an unknown lastTouchId as a fallback side', () => {
    expect(() =>
      resolve(
        { x: 37, y: 10, z: 0.11 },
        { x: 37, y: -2, z: 0.11 },
        ball(null, 'missing'),
      ),
    ).toThrow('lastTouchId missing not found in players');
  });

  it('is deterministic for identical inputs', () => {
    const args = [
      { x: 0.8, y: 32, z: 0.11 },
      { x: -0.8, y: 32, z: 0.11 },
      ball('AWAY'),
    ] as const;

    expect(resolve(...args)).toEqual(resolve(...args));
  });

  it('rejects non-finite positions', () => {
    expect(() =>
      resolve(
        { x: Number.NaN, y: 32, z: 0.11 },
        { x: -1, y: 32, z: 0.11 },
        ball('AWAY'),
      ),
    ).toThrow('non-finite ball position');
  });

  it('handles a segment that starts outside and re-enters the pitch', () => {
    const result = resolve(
      { x: -2, y: 32, z: 0.11 },
      { x: 2, y: 32, z: 0.11 },
      ball('AWAY'),
    );

    expect(result.event).toEqual({
      type: 'goal',
      scorerSide: 'AWAY',
      point: { x: 0, y: 32 },
    });
    expect(result.crossing?.recovered).toBe(false);
  });
});
