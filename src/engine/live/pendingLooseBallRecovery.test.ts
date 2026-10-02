import { describe, it, expect } from 'vitest';
import {
  resolveCounterPressContest,
  resolveLooseBallControl,
  resolvePendingLooseBallRecovery,
} from './liveMatch';
import { createRng } from './rng';
import {
  BALL_CONTROL_MAX_SPEED,
} from './config';
import type { LiveMatchState, LivePlayer, Player } from '../types';

function makePlayer(
  id: string,
  clubId: string,
  pos: { x: number; y: number },
  vel: { x: number; y: number } = { x: 0, y: 0 },
): LivePlayer {
  return {
    player: {
      id,
      name: id,
      attributes: {
        tackling: 20,
        aggression: 10,
        bravery: 10,
        dribbling: 10,
        agility: 10,
        balance: 10,
      },
    },
    clubId,
    position: { x: pos.x, y: pos.y, z: 0 },
    velocity: { x: vel.x, y: vel.y, z: 0 },
    isBallOwner: false,
    isHome: clubId === 'club_1',
  } as unknown as LivePlayer;
}

function makeCounterPressState(
  overrides: {
    runnerPos?: { x: number; y: number };
    ownerPos?: { x: number; y: number };
    runnerClubId?: string;
    ownerClubId?: string;
    counterPressProbability?: number;
    expiresAt?: number;
    time?: number;
  } = {},
): {
  state: LiveMatchState;
  runner: LivePlayer;
  owner: LivePlayer;
  players: Record<string, Player>;
} {
  const runner = makePlayer(
    'runner',
    overrides.runnerClubId ?? 'club_1',
    overrides.runnerPos ?? { x: 0, y: 0 },
    { x: 5, y: 0 },
  );
  const owner = makePlayer(
    'owner',
    overrides.ownerClubId ?? 'club_2',
    overrides.ownerPos ?? { x: 0.8, y: 0 },
  );

  const state = {
    players: { runner, owner },
    ball: {
      position: { x: 0.8, y: 0, z: 0.11 },
      velocity: { x: 0, y: 0, z: 0 },
      ownerId: owner.player.id,
      lastTouchId: owner.player.id,
      lastTouchClubId: owner.clubId,
      isMoving: false,
    },
    transition: {
      counterPressClubId: runner.clubId,
      counterPressPlayerId: runner.player.id,
      counterPressProbability: overrides.counterPressProbability ?? 1,
      breakClubId: owner.clubId,
      startedAt: 0,
      expiresAt: overrides.expiresAt ?? 6,
      isRecoveryContestActive: true,
      hasAttemptedCounterPress: false,
      pendingLooseBallRecoveryClubId: null,
      pendingLooseBallRecoveryPlayerId: null,
    },
    stats: {
      counterPressAttempts: 0,
      counterPressRollsPassed: 0,
      counterPressTackleWins: 0,
      counterPressTackleFailures: 0,
      counterPressTackleFouls: 0,
      counterPressCleanRecoveries: 0,
      counterPressLooseBallRecoveries: 0,
      counterPressRecoveries: 0,
    },
    rng: createRng(12345),
    time: overrides.time ?? 0,
  } as unknown as LiveMatchState;

  const players: Record<string, Player> = {
    runner: runner.player,
    owner: owner.player,
  };

  return { state, runner, owner, players };
}

describe('pendingLooseBallRecovery lifecycle', () => {
  it('counter-press dirty tackle → pending recovery set edilir', () => {
    const { state, runner, owner, players } = makeCounterPressState({
      counterPressProbability: 1,
    });

    const consumed = resolveCounterPressContest(state, owner, players);

    expect(consumed).toBe(true);
    expect(state.ball.ownerId).toBeNull();
    expect(state.transition.pendingLooseBallRecoveryClubId).toBe(
      runner.clubId,
    );
    expect(state.transition.pendingLooseBallRecoveryPlayerId).toBe(
      runner.player.id,
    );

    const ballSpeed = Math.hypot(
      state.ball.velocity.x,
      state.ball.velocity.y,
    );
    expect(ballSpeed).toBeGreaterThan(BALL_CONTROL_MAX_SPEED);
  });

  it('pending → aynı kulüpten oyuncu topu alırsa looseRec artar', () => {
    const { state, runner } = makeCounterPressState();

    state.ball.ownerId = null;
    state.ball.velocity = { x: 0, y: 0, z: 0 };
    state.ball.isMoving = false;
    state.ball.position = { x: 0, y: 0, z: 0.11 };
    state.transition.pendingLooseBallRecoveryClubId = runner.clubId;
    state.transition.pendingLooseBallRecoveryPlayerId = runner.player.id;
    runner.position = { x: 0, y: 0, z: 0 };

    resolveLooseBallControl(state);

    expect(state.ball.ownerId).toBe(runner.player.id);

    resolvePendingLooseBallRecovery(state);

    expect(state.stats.counterPressLooseBallRecoveries).toBe(1);
    expect(state.stats.counterPressRecoveries).toBe(1);
    expect(state.transition.pendingLooseBallRecoveryClubId).toBeNull();
    expect(state.transition.pendingLooseBallRecoveryPlayerId).toBeNull();
  });

  it('pending → rakip oyuncu topu alırsa looseRec artmaz', () => {
    const { state, runner } = makeCounterPressState();

    const opponent = makePlayer('opponent', 'club_3', { x: 0, y: 0 });
    state.players.opponent = opponent;

    state.ball.ownerId = null;
    state.ball.velocity = { x: 0, y: 0, z: 0 };
    state.ball.isMoving = false;
    state.ball.position = { x: 0, y: 0, z: 0.11 };
    state.transition.pendingLooseBallRecoveryClubId = runner.clubId;
    state.transition.pendingLooseBallRecoveryPlayerId = runner.player.id;

    runner.position = { x: 5, y: 0, z: 0 };
    opponent.position = { x: 0, y: 0, z: 0 };

    resolveLooseBallControl(state);

    expect(state.ball.ownerId).toBe(opponent.player.id);

    resolvePendingLooseBallRecovery(state);

    expect(state.stats.counterPressLooseBallRecoveries).toBe(0);
    expect(state.stats.counterPressRecoveries).toBe(0);
    expect(state.transition.pendingLooseBallRecoveryClubId).toBeNull();
    expect(state.transition.pendingLooseBallRecoveryPlayerId).toBeNull();
  });

  it('pending → transition expiry sonrası temizlenir', () => {
    const { state, runner } = makeCounterPressState({
      expiresAt: 5,
      time: 6,
    });

    state.ball.ownerId = null;
    state.transition.pendingLooseBallRecoveryClubId = runner.clubId;
    state.transition.pendingLooseBallRecoveryPlayerId = runner.player.id;

    resolvePendingLooseBallRecovery(state);

    expect(state.transition.pendingLooseBallRecoveryClubId).toBeNull();
    expect(state.transition.pendingLooseBallRecoveryPlayerId).toBeNull();
    expect(state.stats.counterPressLooseBallRecoveries).toBe(0);
  });
});
