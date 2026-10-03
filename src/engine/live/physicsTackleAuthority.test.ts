import { describe, expect, it } from 'vitest';

import {
  resolveCounterPressContest,
} from './liveMatch';
import { buildPhysicsSnapshot, pairKey } from './physics';
import { createRng } from './rng';
import type { LiveMatchState, LivePlayer, TackleOutcome } from '../types';

function makePlayer(
  id: string,
  clubId: string,
  x: number,
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
    position: { x, y: 0, z: 0 },
    velocity: { x: 5, y: 0, z: 0 },
    isBallOwner: id === 'owner',
    isHome: clubId === 'club_1',
  } as unknown as LivePlayer;
}

describe('physics snapshot → tackle authority', () => {
  it('counter-press tackle uses the tick PhysicsSnapshot relativeSpeed', () => {
    const runner = makePlayer('runner', 'club_1', 0);
    const owner = makePlayer('owner', 'club_2', 0.8);

    const state = {
      tick: 1,
      time: 0,
      players: {
        runner,
        owner,
      },
      ball: {
        position: { x: 0.8, y: 0, z: 0.11 },
        velocity: { x: 0, y: 0, z: 0 },
        ownerId: 'owner',
        lastTouchId: 'owner',
        lastTouchClubId: 'club_2',
        isMoving: false,
      },
      transition: {
        counterPressClubId: 'club_1',
        counterPressPlayerId: 'runner',
        counterPressProbability: 1,
        breakClubId: 'club_2',
        startedAt: 0,
        expiresAt: 5,
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
        counterPressTackleWinChanceSum: 0,
        counterPressTackleWinChanceMin: 1,
        counterPressTackleWinChanceMax: 0,
        counterPressTackleRelativeSpeedSum: 0,
        counterPressTackleDistanceSum: 0,
      },
      rng: createRng(123),
    } as unknown as LiveMatchState;

    const physics = buildPhysicsSnapshot(state, state.tick);
    const pair = physics.playerPairs.get(pairKey('runner', 'owner'));
    expect(pair).toBeDefined();

    // Deliberately make the snapshot differ from the live fallback value.
    pair!.relativeSpeed = 17;

    let resolved: TackleOutcome | null = null;

    const consumed = resolveCounterPressContest(
      state,
      owner,
      {
        runner: runner.player,
        owner: owner.player,
      },
      outcome => {
        resolved = outcome;
      },
      physics,
    );

    expect(consumed).toBe(true);
    expect(resolved).not.toBeNull();
    expect(resolved?.debug?.relativeSpeed).toBe(17);
    expect(state.stats.counterPressTackleRelativeSpeedSum).toBe(17);
  });
});
