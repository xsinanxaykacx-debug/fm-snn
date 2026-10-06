import { describe, expect, it } from 'vitest';
import { decide } from './decision';
import { perceive } from './perception';
import { applyMovement } from './movement';
import { runTick } from './tick';
import { simulateMatchV2 } from './simulation';
import type { MatchState, PlayerState, TeamSide } from './state';

const PITCH = {
  length: 104,
  width: 64,
  goalWidth: 7.32,
  goalHeight: 2.44,
  goalAreaDepth: 5.5,
};

function player(id: string, team: TeamSide, index: number): PlayerState {
  const row = index % 6;
  const band = Math.floor(index / 6);

  return {
    id,
    team,
    position: team === 'HOME'
      ? { x: 12 + band * 10, y: 5 + row * 10 }
      : { x: 92 - band * 10, y: 5 + row * 10 },
    velocity: { x: 0, y: 0 },
  };
}

function stateWithPlayerCount(playersPerSide: number): MatchState {
  const players: Record<string, PlayerState> = {};
  const homeIds: string[] = [];
  const awayIds: string[] = [];

  for (let i = 0; i < playersPerSide; i += 1) {
    const homeId = `h${i + 1}`;
    const awayId = `a${i + 1}`;
    players[homeId] = player(homeId, 'HOME', i);
    players[awayId] = player(awayId, 'AWAY', i);
    homeIds.push(homeId);
    awayIds.push(awayId);
  }

  return {
    seed: 123456,
    clockSeconds: 0,
    tick: 0,
    phase: 'first_half',
    pitch: PITCH,
    score: { home: 0, away: 0 },
    ball: {
      position: { x: 52, y: 32, z: 0.11 },
      velocity: { x: 0.5, y: 0.2, z: 0 },
      ownerId: null,
      lastTouchId: null,
      lastTouchSide: 'HOME',
    },
    players,
    teams: {
      HOME: { id: 'home', side: 'HOME', playerIds: homeIds },
      AWAY: { id: 'away', side: 'AWAY', playerIds: awayIds },
    },
    restart: null,
    events: [],
    diagnostics: {
      lastPhase: 'first_half',
      lastTick: 0,
      lastBallPosition: { x: 52, y: 32, z: 0.11 },
      lastBallVelocity: { x: 0.5, y: 0.2, z: 0 },
    },
  };
}

function assertFiniteState(state: MatchState): void {
  for (const p of Object.values(state.players)) {
    expect(Number.isFinite(p.position.x)).toBe(true);
    expect(Number.isFinite(p.position.y)).toBe(true);
    expect(Number.isFinite(p.velocity.x)).toBe(true);
    expect(Number.isFinite(p.velocity.y)).toBe(true);
  }

  expect(Number.isFinite(state.ball.position.x)).toBe(true);
  expect(Number.isFinite(state.ball.position.y)).toBe(true);
  expect(Number.isFinite(state.ball.position.z)).toBe(true);
  expect(Number.isFinite(state.ball.velocity.x)).toBe(true);
  expect(Number.isFinite(state.ball.velocity.y)).toBe(true);
  expect(Number.isFinite(state.ball.velocity.z)).toBe(true);
}

function assertPlayerCount(state: MatchState, expected: number): void {
  expect(Object.keys(state.players)).toHaveLength(expected);
  expect(state.teams.HOME.playerIds).toHaveLength(expected / 2);
  expect(state.teams.AWAY.playerIds).toHaveLength(expected / 2);
}

function assertPlayersBounded(state: MatchState): void {
  for (const p of Object.values(state.players)) {
    expect(p.position.x).toBeGreaterThanOrEqual(0);
    expect(p.position.x).toBeLessThanOrEqual(104);
    expect(p.position.y).toBeGreaterThanOrEqual(0);
    expect(p.position.y).toBeLessThanOrEqual(64);
  }
}

describe('live-v2 22-player runtime foundation', () => {
  it('creates a valid 22-player MatchState: 11 HOME + 11 AWAY', () => {
    const state = stateWithPlayerCount(11);

    assertPlayerCount(state, 22);
    expect(Object.values(state.players).filter((p) => p.team === 'HOME')).toHaveLength(11);
    expect(Object.values(state.players).filter((p) => p.team === 'AWAY')).toHaveLength(11);
  });

  it('runs one tick without throwing', () => {
    const next = runTick(stateWithPlayerCount(11));

    expect(next.tick).toBe(1);
    expect(next.clockSeconds).toBe(1);
    assertPlayerCount(next, 22);
  });

  it('produces exactly one decision for every player', () => {
    const state = stateWithPlayerCount(11);
    const perceptions = perceive(state);
    const decisions = decide(state, perceptions);

    expect(Object.keys(perceptions.players)).toHaveLength(22);
    expect(decisions).toHaveLength(22);
    expect(new Set(decisions.map((d) => d.playerId)).size).toBe(22);
  });

  it('runs 100 ticks without crash, NaN, or player loss', () => {
    let state = stateWithPlayerCount(11);

    for (let tick = 0; tick < 100; tick += 1) {
      state = runTick(state);
      assertPlayerCount(state, 22);
      assertFiniteState(state);
    }
  });

  it('runs 900 ticks (15 minutes) without crash', () => {
    const finalState = simulateMatchV2(stateWithPlayerCount(11), 900);

    expect(finalState.tick).toBe(900);
    expect(finalState.clockSeconds).toBe(900);
    assertPlayerCount(finalState, 22);
    assertFiniteState(finalState);
    assertPlayersBounded(finalState);
  });

  it('runs 5400 ticks (90 minutes) and reports runtime', () => {
    const start = performance.now();
    const finalState = simulateMatchV2(stateWithPlayerCount(11), 5400);
    const elapsedMs = performance.now() - start;

    const twoPlayerStart = performance.now();
    const twoPlayerFinal = simulateMatchV2(stateWithPlayerCount(1), 5400);
    const twoPlayerMs = performance.now() - twoPlayerStart;

    console.log(`F1_PERF_22_5400_MS=${elapsedMs.toFixed(2)}`);
    console.log(`F1_PERF_2_5400_MS=${twoPlayerMs.toFixed(2)}`);
    console.log(`F1_PERF_RATIO=${(elapsedMs / Math.max(twoPlayerMs, 0.001)).toFixed(2)}`);

    expect(twoPlayerFinal.tick).toBe(5400);
    expect(finalState.tick).toBe(5400);
    expect(finalState.clockSeconds).toBe(5400);
    expect(finalState.phase).toBe('full_time');
    assertPlayerCount(finalState, 22);
    assertFiniteState(finalState);
    assertPlayersBounded(finalState);
  });

  it('is deterministic: same seed + same input + 5400 ticks gives equal final state', () => {
    const input = stateWithPlayerCount(11);

    const a = simulateMatchV2(input, 5400);
    const b = simulateMatchV2(input, 5400);

    expect(a).toEqual(b);
  });

  it('preserves the 22-player count invariant after every tick', () => {
    let state = stateWithPlayerCount(11);

    for (let tick = 0; tick < 5400; tick += 1) {
      state = runTick(state);
      expect(Object.keys(state.players)).toHaveLength(22);
    }
  });

  it('keeps every player position and velocity finite after every tick', () => {
    let state = stateWithPlayerCount(11);

    for (let tick = 0; tick < 5400; tick += 1) {
      state = runTick(state);
      assertFiniteState(state);
    }
  });

  it('keeps every player inside the 104 x 64 pitch after every tick', () => {
    let state = stateWithPlayerCount(11);

    for (let tick = 0; tick < 5400; tick += 1) {
      state = runTick(state);
      assertPlayersBounded(state);
    }
  });

});
