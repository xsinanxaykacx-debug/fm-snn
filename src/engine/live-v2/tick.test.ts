import { describe, expect, it } from 'vitest';
import { runTick } from './tick';
import type { MatchState } from './state';

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
      position: { x: 50, y: 32, z: 0.11 },
      velocity: { x: 1, y: 0, z: 0 },
      ownerId: null,
      lastTouchId: null,
      lastTouchSide: 'HOME',
    },
    players: {
      p1: {
        id: 'p1',
        team: 'HOME',
        position: { x: 52, y: 32 },
        velocity: { x: 0, y: 0 },
      },
      p2: {
        id: 'p2',
        team: 'AWAY',
        position: { x: 70, y: 32 },
        velocity: { x: 0, y: 0 },
      },
    },
    teams: {
      HOME: {
        id: 'home',
        side: 'HOME',
        playerIds: ['p1'],
      },
      AWAY: {
        id: 'away',
        side: 'AWAY',
        playerIds: ['p2'],
      },
    },
    restart: null,
    events: [],
    diagnostics: {
      lastPhase: 'first_half',
      lastTick: 0,
      lastBallPosition: { x: 50, y: 32, z: 0.11 },
      lastBallVelocity: { x: 1, y: 0, z: 0 },
    },
  };
}

describe('live-v2 tick', () => {
  it('advances exactly one tick and one second', () => {
    const next = runTick(state());

    expect(next.tick).toBe(1);
    expect(next.clockSeconds).toBe(1);
  });

  it('moves the ball through the physics phase', () => {
    const next = runTick(state());

    expect(next.ball.position.x).not.toBe(50);
  });

  it('emits and applies a boundary event in the same tick', () => {
    const s = state();

    const next = runTick({
      ...s,
      ball: {
        ...s.ball,
        position: { x: 103.9, y: 32, z: 0.11 },
        velocity: { x: 10, y: 0, z: 0 },
        lastTouchSide: 'AWAY',
      },
    });

    expect(next.events).toHaveLength(1);
    expect(next.events[0]?.type).toBe('goal');
    expect(next.score.away).toBe(1);
    expect(next.restart).toBeNull();
  });

  it('keeps players inside the pitch after decision-driven movement', () => {
    const s = state();

    const next = runTick({
      ...s,
      players: {
        p1: {
          ...s.players.p1,
          position: { x: 104, y: 64 },
        },
        p2: s.players.p2,
      },
    });

    const p1 = next.players.p1.position;
    expect(p1.x).toBeGreaterThanOrEqual(0);
    expect(p1.x).toBeLessThanOrEqual(next.pitch.length);
    expect(p1.y).toBeGreaterThanOrEqual(0);
    expect(p1.y).toBeLessThanOrEqual(next.pitch.width);
  });

  it('applies decision-driven movement to players', () => {
    const next = runTick(state());

    // Diagnostics capture perception/decision state
    expect(next.diagnostics.perceivedPlayerCount).toBe(2);
    expect(next.diagnostics.lastDecisionAction).toBe('CHASE');

    // p1 (HOME) chases the ball; its position changes by at most 1 unit
    const p1Before = { x: 52, y: 32 };
    const p1After = next.players.p1.position;
    const dx = Math.abs(p1After.x - p1Before.x);
    const dy = Math.abs(p1After.y - p1Before.y);

    expect(dx + dy).toBeGreaterThan(0);
    expect(dx).toBeLessThanOrEqual(1);
    expect(dy).toBeLessThanOrEqual(1);

    // p2 (AWAY) also moves toward the ball; both stay bounded
    expect(next.players.p2.position.x).toBeGreaterThanOrEqual(0);
    expect(next.players.p2.position.x).toBeLessThanOrEqual(next.pitch.length);
    expect(next.players.p2.position.y).toBeGreaterThanOrEqual(0);
    expect(next.players.p2.position.y).toBeLessThanOrEqual(next.pitch.width);
  });

  it('keeps perception and decision deterministic for the same state and seed', () => {
    const a = runTick(state());
    const b = runTick(state());

    expect(a.diagnostics).toEqual(b.diagnostics);
    expect(a.diagnostics.lastDecisionAction)
      .toBe(b.diagnostics.lastDecisionAction);
    expect(a.diagnostics.perceivedPlayerCount)
      .toBe(b.diagnostics.perceivedPlayerCount);

    // Determinism extends to movement
    expect(a.players.p1.position).toEqual(b.players.p1.position);
    expect(a.players.p2.position).toEqual(b.players.p2.position);
  });

  it('preserves the existing tick behavior apart from additive diagnostics', () => {
    const s = state();
    const next = runTick(s);

    expect(next.tick).toBe(1);
    expect(next.clockSeconds).toBe(1);
    expect(next.score).toEqual({ home: 0, away: 0 });
    expect(next.events).toEqual([]);
    expect(next.restart).toBeNull();
  });
});