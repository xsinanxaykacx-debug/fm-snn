import { describe, expect, it } from 'vitest';
import { perceive } from './perception';
import type { MatchState } from './state';

function state(): MatchState {
  return {
    seed: { seed: 123456 },
    clockSeconds: 0, tick: 0, phase: 'first_half',
    pitch: { length: 104, width: 64, goalWidth: 7.32, goalHeight: 2.44, goalAreaDepth: 5.5 },
    score: { home: 0, away: 0 },
    ball: { position: { x: 40, y: 20, z: 0.5 }, velocity: { x: 0, y: 0, z: 0 }, ownerId: null, lastTouchId: null, lastTouchSide: null },
    players: {
      h1: { id: 'h1', team: 'HOME', position: { x: 10, y: 10 }, velocity: { x: 0, y: 0 } },
      h2: { id: 'h2', team: 'HOME', position: { x: 12, y: 10 }, velocity: { x: 0, y: 0 } },
      h3: { id: 'h3', team: 'HOME', position: { x: 30, y: 30 }, velocity: { x: 0, y: 0 } },
      a1: { id: 'a1', team: 'AWAY', position: { x: 14, y: 10 }, velocity: { x: 0, y: 0 } },
      a2: { id: 'a2', team: 'AWAY', position: { x: 60, y: 40 }, velocity: { x: 0, y: 0 } },
    },
    teams: { HOME: { id: 'home', side: 'HOME', playerIds: ['h1','h2','h3'] }, AWAY: { id: 'away', side: 'AWAY', playerIds: ['a1','a2'] } },
    restart: null, events: [],
    diagnostics: { lastPhase: 'first_half', lastTick: 0, lastBallPosition: { x: 40, y: 20, z: 0.5 }, lastBallVelocity: { x: 0, y: 0, z: 0 } },
  };
}

describe('live-v2 perception', () => {
  it('finds nearest opponent and teammate', () => {
    const p = perceive(state());
    expect(p.players.h1?.nearestOpponentId).toBe('a1');
    expect(p.players.h1?.nearestTeammateId).toBe('h2');
  });
  it('exposes ball position', () => expect(perceive(state()).players.h3?.ballPosition).toEqual({ x: 40, y: 20 }));
  it('is deterministic', () => expect(perceive(state())).toEqual(perceive(state())));
  it('does not mutate input', () => { const s=state(); const before=structuredClone(s); perceive(s); expect(s).toEqual(before); });
});
