import { describe, expect, it } from 'vitest';

import type { LiveMatchState, LivePlayer } from '../types';
import {
  resolveLooseBallControl,
  resolvePendingLooseBallRecovery,
} from './liveMatch';

function player(
  id: string,
  clubId: string,
  x: number,
  y: number,
): LivePlayer {
  return {
    player: {
      id,
      name: id,
      attributes: {} as any,
    },
    clubId,
    position: { x, y },
    velocity: { x: 0, y: 0 },
    facing: 0,
    nextDecisionTime: 0,
    currentDecision: null,
    currentIntent: 'idle',
    isBallOwner: false,
    isChasingBall: false,
    isMarking: null,
    isHome: clubId === 'HOME',
    role: 'CM',
    homePosition: { x, y },
    maxSpeed: 7,
    acceleration: 20,
  };
}

function state(): LiveMatchState {
  const taker = player('T1', 'HOME', 50, 32);

  return {
    players: { [taker.player.id]: taker },
    ball: {
      position: { x: 50, y: 32, z: 0.11 },
      velocity: { x: 0, y: 0, z: 0 },
      ownerId: null,
      lastTouchId: 'P0',
      lastTouchClubId: 'AWAY',
      isMoving: false,
    },
    setPiece: {
      type: 'free_kick',
      teamSide: 'HOME',
      takerId: 'T1',
      ballPosition: { x: 50, y: 32 },
      targetPositions: { T1: { x: 50, y: 32 } },
      requiredPlayerIds: ['T1'],
      status: 'positioning',
      elapsed: 0,
    },
    transition: {
      counterPressClubId: 'AWAY',
      counterPressPlayerId: 'P0',
      breakClubId: 'HOME',
      startedAt: 10,
      expiresAt: 16,
      counterPressProbability: 1,
      breakQuality: 1,
      hasAttemptedCounterPress: false,
      isRecoveryContestActive: false,
      pendingLooseBallRecoveryClubId: 'AWAY',
      pendingLooseBallRecoveryPlayerId: 'P0',
    },
  } as unknown as LiveMatchState;
}

describe('Loose-ball / set-piece ownership boundary', () => {
  it('set-piece positioning sırasında loose-ball resolver topu sahiplenemez', () => {
    const s = state();

    resolveLooseBallControl(s);

    expect(s.ball.ownerId).toBeNull();
  });

  it('set-piece positioning sırasında pending recovery tüketilemez', () => {
    const s = state();

    resolvePendingLooseBallRecovery(s);

    expect(s.transition.pendingLooseBallRecoveryClubId).toBe('AWAY');
    expect(s.transition.pendingLooseBallRecoveryPlayerId).toBe('P0');
    expect(s.stats?.counterPressLooseBallRecoveries ?? 0).toBe(0);
  });
});
