import { describe, expect, it } from 'vitest';
import { resolveActions } from './actionResolution';
import { nextRandom } from './rng';
import type { DecisionResult } from './decision';
import type { MatchState } from './state';

function state(seed = 123456): MatchState {
  return {
    seed: { seed },
    clockSeconds: 0,
    tick: 0,
    phase: 'first_half',
    pitch: {
      length: 104,
      width: 64,
      goalWidth: 7.32,
      goalHeight: 2.44,
      goalAreaDepth: 5.5,
    },
    score: { home: 0, away: 0 },
    ball: {
      position: { x: 50, y: 32, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      ownerId: 'h1',
      lastTouchId: 'h1',
      lastTouchSide: 'HOME',
    },
    players: {
      h1: {
        id: 'h1',
        team: 'HOME',
        position: { x: 50, y: 32 },
        velocity: { x: 0, y: 0 },
      },
      h2: {
        id: 'h2',
        team: 'HOME',
        position: { x: 70, y: 20 },
        velocity: { x: 0, y: 0 },
      },
      a1: {
        id: 'a1',
        team: 'AWAY',
        position: { x: 30, y: 32 },
        velocity: { x: 0, y: 0 },
      },
    },
    teams: {
      HOME: { id: 'home', side: 'HOME', playerIds: ['h1', 'h2'] },
      AWAY: { id: 'away', side: 'AWAY', playerIds: ['a1'] },
    },
    restart: null,
    events: [],
    diagnostics: {
      lastPhase: 'first_half',
      lastTick: 0,
      lastBallPosition: { x: 50, y: 32, z: 0 },
      lastBallVelocity: { x: 0, y: 0, z: 0 },
    },
  };
}

function decisions(
  action: 'PASS' | 'SHOOT' | 'DRIBBLE' | 'CHASE',
  seed: number,
): DecisionResult {
  const result = [{
    playerId: 'h1',
    displacement: { x: 0, y: 0 },
    action,
  }] as DecisionResult;

  Object.defineProperty(result, 'seed', {
    value: { seed },
    enumerable: true,
    writable: false,
  });

  return result;
}

describe('live-v2 action resolution RNG', () => {
  it('PASS: same seed produces the same target and velocity', () => {
    const a = resolveActions(state(123456), decisions('PASS', 123456));
    const b = resolveActions(state(123456), decisions('PASS', 123456));

    expect(a.ball.position).toEqual(b.ball.position);
    expect(a.ball.velocity).toEqual(b.ball.velocity);
  });

  it('PASS: different seeds can produce different velocity under a valid outcome range', () => {
    const a = resolveActions(state(123456), decisions('PASS', 123456));
    const b = resolveActions(state(123456), decisions('PASS', 1000000000));

    expect(b.ball.velocity).not.toEqual(a.ball.velocity);
  });

  it('SHOOT: same seed produces the same target and velocity', () => {
    const a = resolveActions(state(123456), decisions('SHOOT', 123456));
    const b = resolveActions(state(123456), decisions('SHOOT', 123456));

    expect(a.ball.position).toEqual(b.ball.position);
    expect(a.ball.velocity).toEqual(b.ball.velocity);
  });

  it('SHOOT: different seeds can produce different velocity under a valid outcome range', () => {
    const a = resolveActions(state(123456), decisions('SHOOT', 123456));
    const b = resolveActions(state(123456), decisions('SHOOT', 1000000000));

    expect(b.ball.velocity).not.toEqual(a.ball.velocity);
  });

  it('CHASE remains deterministic across different seeds', () => {
    const a = resolveActions(state(123456), decisions('CHASE', 123456));
    const b = resolveActions(state(654321), decisions('CHASE', 654321));

    expect(a.ball).toEqual(b.ball);
    expect(a.seed).toEqual({ seed: 123456 });
    expect(b.seed).toEqual({ seed: 654321 });
  });

  it('DRIBBLE preserves its deterministic geometry while consuming one RNG value', () => {
    const next = resolveActions(state(123456), decisions('DRIBBLE', 123456));

    expect(next.ball.position).toEqual({ x: 50.8, y: 32, z: 0 });
    expect(next.ball.velocity).toEqual({ x: 2.5, y: 0, z: 0 });
    expect(next.seed).not.toEqual({ seed: 123456 });
  });

  it('PASS/SHOOT consume RNG and advance the state seed', () => {
    const pass = resolveActions(state(123456), decisions('PASS', 123456));
    const shoot = resolveActions(state(123456), decisions('SHOOT', 123456));

    expect(pass.seed).not.toEqual({ seed: 123456 });
    expect(shoot.seed).not.toEqual({ seed: 123456 });
    expect(pass.seed).toEqual(shoot.seed);
  });

  it('RNG consumption is fixed at one value per PASS/SHOOT action', () => {
    const start = { seed: 123456 };
    const [, expectedStateOne] = nextRandom(start);
    const first = resolveActions(state(123456), decisions('PASS', 123456));

    const secondInput = {
      ...first,
      ball: {
        ...first.ball,
        ownerId: 'h1',
      },
    };
    const [, expectedAfterTwo] = nextRandom(expectedStateOne);

    const second = resolveActions(
      secondInput,
      decisions('SHOOT', first.seed.seed),
    );

    expect(first.seed.seed).toBe(expectedStateOne.seed);
    expect(second.seed.seed).toBe(expectedAfterTwo.seed);
  });

  it('DRIBBLE retain: same seed produces the same result', () => {
    const a = resolveActions(state(123456), decisions('DRIBBLE', 123456));
    const b = resolveActions(state(123456), decisions('DRIBBLE', 123456));

    expect(a).toEqual(b);
    expect(a.ball.ownerId).toBe('h1');
  });

  it('DRIBBLE lose: same seed produces the same result', () => {
    const a = resolveActions(state(1000000000), decisions('DRIBBLE', 1000000000));
    const b = resolveActions(state(1000000000), decisions('DRIBBLE', 1000000000));

    expect(a).toEqual(b);
    expect(a.ball.ownerId).toBeNull();
  });

  it('DRIBBLE different seeds can produce different retain/lose outcomes', () => {
    const retain = resolveActions(state(123456), decisions('DRIBBLE', 123456));
    const lose = resolveActions(state(1000000000), decisions('DRIBBLE', 1000000000));

    expect(retain.ball.ownerId).toBe('h1');
    expect(lose.ball.ownerId).toBeNull();
  });

  it('DRIBBLE advances the seed by exactly one RNG value', () => {
    const start = { seed: 123456 };
    const [, expected] = nextRandom(start);
    const next = resolveActions(state(123456), decisions('DRIBBLE', 123456));

    expect(next.seed).toEqual(expected);
  });

  it('DRIBBLE consumes exactly one RNG value per resolved action', () => {
    const start = { seed: 123456 };
    const [, expectedOne] = nextRandom(start);
    const [, expectedTwo] = nextRandom(expectedOne);

    const first = resolveActions(state(123456), decisions('DRIBBLE', 123456));
    const secondInput = {
      ...first,
      ball: {
        ...first.ball,
        ownerId: 'h1',
      },
    };
    const second = resolveActions(
      secondInput,
      decisions('DRIBBLE', first.seed.seed),
    );

    expect(first.seed).toEqual(expectedOne);
    expect(second.seed).toEqual(expectedTwo);
  });

  it('CHASE still consumes no RNG after E5', () => {
    const next = resolveActions(state(123456), decisions('CHASE', 123456));

    expect(next.seed).toEqual({ seed: 123456 });
  });

  it('PASS and SHOOT RNG behavior remains unchanged after E5', () => {
    const start = { seed: 123456 };
    const [, expected] = nextRandom(start);
    const pass = resolveActions(state(123456), decisions('PASS', 123456));
    const shoot = resolveActions(state(123456), decisions('SHOOT', 123456));

    expect(pass.seed).toEqual(expected);
    expect(shoot.seed).toEqual(expected);
  });

  it('DRIBBLE lose leaves the ball loose and preserves last-touch attribution', () => {
    const next = resolveActions(state(1000000000), decisions('DRIBBLE', 1000000000));

    expect(next.ball.ownerId).toBeNull();
    expect(next.ball.lastTouchId).toBe('h1');
    expect(next.ball.lastTouchSide).toBe('HOME');
    expect(next.ball.position).toEqual({ x: 50.8, y: 32, z: 0 });
    expect(next.ball.velocity).toEqual({ x: 2.5, y: 0, z: 0 });
  });

  it('an unresolved DRIBBLE consumes no RNG', () => {
    const before = state(123456);
    const next = resolveActions(
      {
        ...before,
        ball: {
          ...before.ball,
          ownerId: null,
        },
      },
      decisions('DRIBBLE', 123456),
    );

    expect(next).toEqual({
      ...before,
      ball: {
        ...before.ball,
        ownerId: null,
      },
    });
  });
});
