import { describe, expect, it } from 'vitest';
import { toLiveFrame } from './liveFrame';
import type { MatchState } from '../state';

const PITCH = {
  length: 104,
  width: 64,
  goalWidth: 7.32,
  goalHeight: 2.44,
  goalAreaDepth: 5.5,
};

function makeState(): MatchState {
  const players = {
    h1: {
      id: 'h1',
      team: 'HOME' as const,
      position: { x: 12, y: 20 },
      velocity: { x: 3, y: 4 },
    },
    h2: {
      id: 'h2',
      team: 'HOME' as const,
      position: { x: 20, y: 30 },
      velocity: { x: 0, y: 0 },
    },
    a1: {
      id: 'a1',
      team: 'AWAY' as const,
      position: { x: 92, y: 40 },
      velocity: { x: -2, y: 0 },
    },
  };

  return {
    seed: { seed: 123456 },
    clockSeconds: 42,
    tick: 42,
    phase: 'first_half',
    pitch: PITCH,
    score: { home: 2, away: 1 },
    ball: {
      position: { x: 52, y: 31, z: 0.2 },
      velocity: { x: 1.5, y: -0.5, z: 0 },
      ownerId: 'h1',
      lastTouchId: 'a1',
      lastTouchSide: 'AWAY',
    },
    players,
    teams: {
      HOME: { id: 'home', side: 'HOME', playerIds: ['h1', 'h2'] },
      AWAY: { id: 'away', side: 'AWAY', playerIds: ['a1'] },
    },
    restart: null,
    events: [],
    diagnostics: {
      lastPhase: 'first_half',
      lastTick: 42,
      lastBallPosition: { x: 52, y: 31, z: 0.2 },
      lastBallVelocity: { x: 1.5, y: -0.5, z: 0 },
    },
  };
}

function make22PlayerState(): MatchState {
  const state = makeState();
  const players = { ...state.players };

  for (let i = 3; i <= 11; i += 1) {
    const id = `h${i}`;
    players[id] = {
      id,
      team: 'HOME',
      position: { x: 10 + i, y: 10 + i },
      velocity: { x: i, y: -i },
    };
  }

  for (let i = 2; i <= 11; i += 1) {
    const id = `a${i}`;
    players[id] = {
      id,
      team: 'AWAY',
      position: { x: 94 - i, y: 50 - i },
      velocity: { x: -i, y: i },
    };
  }

  return {
    ...state,
    players,
    teams: {
      HOME: {
        ...state.teams.HOME,
        playerIds: Object.keys(players).filter((id) => players[id].team === 'HOME'),
      },
      AWAY: {
        ...state.teams.AWAY,
        playerIds: Object.keys(players).filter((id) => players[id].team === 'AWAY'),
      },
    },
  };
}

describe('live-v2 UI frame adapter', () => {
  it('maps 22 players to 22 frame players', () => {
    const frame = toLiveFrame(make22PlayerState(), 42, 42);

    expect(frame.players).toHaveLength(22);
  });

  it('maps HOME/AWAY correctly', () => {
    const state = make22PlayerState();
    const frame = toLiveFrame(state, state.tick, state.clockSeconds);

    for (const player of frame.players) {
      expect(player.isHome).toBe(state.players[player.id].team === 'HOME');
    }
  });

  it('maps player coordinates exactly', () => {
    const state = make22PlayerState();
    const frame = toLiveFrame(state, state.tick, state.clockSeconds);

    for (const player of frame.players) {
      expect(player.x).toBe(state.players[player.id].position.x);
      expect(player.y).toBe(state.players[player.id].position.y);
    }
  });

  it('maps ball position, velocity, owner, and last touch', () => {
    const state = makeState();
    const frame = toLiveFrame(state, state.tick, state.clockSeconds);

    expect(frame.ball.x).toBe(state.ball.position.x);
    expect(frame.ball.y).toBe(state.ball.position.y);
    expect(frame.ball.z).toBe(state.ball.position.z);
    expect(frame.ball.vx).toBe(state.ball.velocity.x);
    expect(frame.ball.vy).toBe(state.ball.velocity.y);
    expect(frame.ball.ownerId).toBe(state.ball.ownerId);
    expect(frame.ball.lastTouchId).toBe(state.ball.lastTouchId);
  });

  it('maps score and time/tick', () => {
    const state = makeState();
    const frame = toLiveFrame(state, state.tick, state.clockSeconds);

    expect(frame.score.home).toBe(state.score.home);
    expect(frame.score.away).toBe(state.score.away);
    expect(frame.time).toBe(state.clockSeconds);
    expect(frame.tick).toBe(state.tick);
  });

  it('is deterministic for the same state', () => {
    const state = make22PlayerState();

    expect(toLiveFrame(state, state.tick, state.clockSeconds))
      .toEqual(toLiveFrame(state, state.tick, state.clockSeconds));
  });

  it('does not mutate the input state', () => {
    const state = make22PlayerState();
    const before = structuredClone(state);

    toLiveFrame(state, state.tick, state.clockSeconds);

    expect(state).toEqual(before);
  });

  it('derives facing from player velocity', () => {
    const state = makeState();
    const frame = toLiveFrame(state, state.tick, state.clockSeconds);
    const h1 = frame.players.find((player) => player.id === 'h1');
    const h2 = frame.players.find((player) => player.id === 'h2');

    expect(h1?.facing).toBeCloseTo(Math.atan2(4, 3));
    expect(h2?.facing).toBe(0);
  });

  it('uses explicit UNKNOWN intent because MatchState does not retain per-player decisions', () => {
    const state = makeState();
    const frame = toLiveFrame(state, state.tick, state.clockSeconds);

    expect(frame.players.every((player) => player.intent === 'UNKNOWN')).toBe(true);
  });
});
