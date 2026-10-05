import { describe, expect, it } from 'vitest';
import { applyRestart, consumeRestart, eventToRestart } from './restart';
import type { MatchEvent, MatchState } from './state';

const state: MatchState = {
  clockSeconds: 20, tick: 20, phase: 'first_half',
  pitch: { length: 104, width: 64, goalWidth: 7.32, goalHeight: 2.44, goalAreaDepth: 5.5 },
  score: { home: 1, away: 2 },
  ball: { position: { x: 30, y: 20, z: 1 }, velocity: { x: 5, y: 2, z: 3 }, ownerId: 'p1', lastTouchId: 'p1', lastTouchSide: 'HOME' },
  players: { p1: { id: 'p1', team: 'HOME', position: { x: 30, y: 20 }, velocity: { x: 0, y: 0 } } },
  teams: { HOME: { id: 'home', side: 'HOME', playerIds: ['p1'] }, AWAY: { id: 'away', side: 'AWAY', playerIds: [] } },
  restart: null, events: [],
  diagnostics: { lastPhase: 'first_half', lastTick: 20, lastBallPosition: { x: 30, y: 20, z: 1 }, lastBallVelocity: { x: 5, y: 2, z: 3 } },
};

const events: MatchEvent[] = [
  { type: 'goal', scorerSide: 'HOME', point: { x: 0, y: 32 } },
  { type: 'goal_kick', side: 'HOME', point: { x: 2, y: 32 } },
  { type: 'corner', side: 'AWAY', point: { x: 104, y: 0 } },
  { type: 'throw_in', side: 'HOME', point: { x: 40, y: 64 } },
];

describe('live-v2 restart', () => {
  it('goal -> opponent kickoff', () => expect(eventToRestart(state, events[0])).toEqual({ type: 'kickoff', side: 'AWAY', point: { x: 52, y: 32 } }));
  it('goal kick -> correct point', () => expect(eventToRestart(state, events[1])).toEqual({ type: 'goal_kick', side: 'HOME', point: { x: 2.75, y: 32 } }));
  it('corner -> correct corner', () => expect(eventToRestart(state, events[2])).toEqual({ type: 'corner', side: 'AWAY', point: { x: 104, y: 0 } }));
  it('throw-in -> touchline point', () => expect(eventToRestart(state, events[3])).toEqual({ type: 'throw_in', side: 'HOME', point: { x: 40, y: 64 } }));
  it('moves ball, clears possession and stops velocity', () => {
    const next = applyRestart(state, events[0]);
    expect(next.ball.position).toEqual({ x: 52, y: 32, z: 0 });
    expect(next.ball.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(next.ball.ownerId).toBeNull();
    expect(next.score).toEqual({ home: 2, away: 2 });
  });
  it('consumes restart without mutating source', () => {
    const withRestart = applyRestart(state, events[0]);
    const live = consumeRestart(withRestart);
    expect(withRestart.restart?.type).toBe('kickoff');
    expect(live.restart).toBeNull();
  });
  it('is deterministic', () => expect(applyRestart(state, events[2])).toEqual(applyRestart(state, events[2])));
});
