import { describe, expect, it } from 'vitest';
import { updatePossession } from './possession';
import type { MatchState } from './state';

function state(): MatchState {
  return {
    seed: 123, clockSeconds: 10, tick: 10, phase: 'first_half',
    pitch: { length: 104, width: 64, goalWidth: 7.32, goalHeight: 2.44, goalAreaDepth: 5.5 },
    score: { home: 0, away: 0 },
    ball: { position: { x: 50, y: 32, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, ownerId: null, lastTouchId: null, lastTouchSide: null },
    players: {
      h1: { id: 'h1', team: 'HOME', position: { x: 49, y: 32 }, velocity: { x: 0, y: 0 } },
      h2: { id: 'h2', team: 'HOME', position: { x: 70, y: 20 }, velocity: { x: 0, y: 0 } },
      a1: { id: 'a1', team: 'AWAY', position: { x: 60, y: 32 }, velocity: { x: 0, y: 0 } },
    },
    teams: { HOME: { id: 'home', side: 'HOME', playerIds: ['h1', 'h2'] }, AWAY: { id: 'away', side: 'AWAY', playerIds: ['a1'] } },
    restart: null, events: [],
    diagnostics: { lastPhase: 'first_half', lastTick: 10, lastBallPosition: { x: 50, y: 32, z: 0 }, lastBallVelocity: { x: 0, y: 0, z: 0 } },
  };
}

describe('live-v2 possession', () => {
  it('free ball -> nearest player', () => expect(updatePossession(state()).ball.ownerId).toBe('h1'));
  it('owned ball -> owner is preserved', () => {
    const owned = updatePossession(state());
    expect(updatePossession(owned).ball.ownerId).toBe('h1');
  });
  it('closer opponent steals', () => {
    const owned = updatePossession(state());
    const contested = { ...owned, players: { ...owned.players, a1: { ...owned.players.a1, position: { x: 49.2, y: 32 } } } };
    expect(updatePossession(contested).ball.ownerId).toBe('a1');
  });
  it('is deterministic', () => expect(updatePossession(state())).toEqual(updatePossession(state())));
  it('does not mutate input', () => {
    const s = state(); const before = structuredClone(s); updatePossession(s); expect(s).toEqual(before);
  });
});
