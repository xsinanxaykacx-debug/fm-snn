import { describe, expect, it } from 'vitest';
import { resolveActions } from './actionResolution';
import type { MatchState } from './state';
import type { DecisionIntent } from './decision';

function state(): MatchState {
  return {
    seed: 123456,
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

function decision(action: DecisionIntent['action']): DecisionIntent {
  return {
    playerId: 'h1',
    displacement: { x: 0, y: 0 },
    action,
  };
}

describe('live-v2 action resolution', () => {
  it('resolves PASS toward the nearest teammate', () => {
    const next = resolveActions(state(), [decision('PASS')]);

    const dx = 70 - 50;
    const dy = 20 - 32;
    const length = Math.hypot(dx, dy);
    expect(next.ball.velocity.x).toBeCloseTo((dx / length) * 8);
    expect(next.ball.velocity.y).toBeCloseTo((dy / length) * 8);
    expect(next.ball.velocity.z).toBe(0);
  });

  it('resolves SHOOT toward the opponent goal center', () => {
    const next = resolveActions(state(), [decision('SHOOT')]);

    expect(next.ball.velocity.x).toBe(24);
    expect(next.ball.velocity.y).toBe(0);
    expect(next.ball.velocity.z).toBe(0);
  });

  it('resolves DRIBBLE by putting the ball in front of the player', () => {
    const next = resolveActions(state(), [decision('DRIBBLE')]);

    expect(next.ball.position).toEqual({ x: 50.8, y: 32, z: 0 });
    expect(next.ball.velocity).toEqual({ x: 2.5, y: 0, z: 0 });
  });

  it('resolves CHASE without changing the ball', () => {
    const before = state();
    const next = resolveActions(before, [decision('CHASE')]);

    expect(next.ball).toEqual(before.ball);
  });

  it('does not resolve an action for a player who does not own the ball', () => {
    const before = state();
    const next = resolveActions(before, [{
      ...decision('SHOOT'),
      playerId: 'h2',
    }]);

    expect(next.ball).toEqual(before.ball);
  });

  it('is deterministic for the same state and decisions', () => {
    const a = resolveActions(state(), [decision('PASS')]);
    const b = resolveActions(state(), [decision('PASS')]);

    expect(a).toEqual(b);
  });

  it('does not mutate the input state', () => {
    const before = state();
    const snapshot = structuredClone(before);

    resolveActions(before, [decision('DRIBBLE')]);

    expect(before).toEqual(snapshot);
  });

  it('leaves POSITION unchanged', () => {
    const before = state();
    const next = resolveActions(before, [decision('POSITION')]);

    expect(next.ball).toEqual(before.ball);
  });
});
