import { describe, expect, it } from 'vitest';

import type { LiveMatchState, LivePlayer, TackleOutcome } from '../types';
import { applyTackleOutcomes } from './liveMatch';

function makePlayer(
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
    isHome: clubId === 'club_1',
    role: 'CM',
    homePosition: { x, y },
    maxSpeed: 1,
    acceleration: 1,
  };
}

function makeState(
  carrier: LivePlayer,
  tacklerA: LivePlayer,
  tacklerB: LivePlayer,
): LiveMatchState {
  return {
    players: {
      [carrier.player.id]: carrier,
      [tacklerA.player.id]: tacklerA,
      [tacklerB.player.id]: tacklerB,
    },
    ball: {
      position: { x: carrier.position.x, y: carrier.position.y, z: 0.11 },
      velocity: { x: 0, y: 0, z: 0 },
      ownerId: carrier.player.id,
      lastTouchId: carrier.player.id,
      lastTouchClubId: carrier.clubId,
      isMoving: false,
    },
  } as unknown as LiveMatchState;
}

function won(
  tacklerId: string,
  distance: number,
  newOwnerId: string,
): TackleOutcome & { type: 'won' } {
  return {
    type: 'won',
    tacklerId,
    ballCarrierId: 'C',
    newOwnerId,
    point: { x: 50, y: 32 },
    debug: {
      winChance: 0.5,
      cleanChance: 0.5,
      relativeSpeed: 1,
      distance,
    },
  };
}

describe('tackle outcome ordering', () => {
  it('aynı tickte outcomes dizisi sırasından bağımsız olarak en yakın contest uygulanır', () => {
    const carrier = makePlayer('C', 'club_2', 50, 32);
    const near = makePlayer('T2', 'club_1', 49.5, 32);
    const far = makePlayer('T1', 'club_1', 49, 32);
    const state = makeState(carrier, near, far);

    const changed = applyTackleOutcomes(
      [
        won('T1', 1.0, 'T1'),
        won('T2', 0.5, 'T2'),
      ],
      state,
      {}
    );

    expect(changed).toBe(true);
    expect(state.ball.ownerId).toBe('T2');
  });

  it('eşit mesafede tacklerId deterministik tie-break olarak kullanılır', () => {
    const carrier = makePlayer('C', 'club_2', 50, 32);
    const t1 = makePlayer('T1', 'club_1', 49.5, 32);
    const t2 = makePlayer('T2', 'club_1', 49.5, 32);
    const state = makeState(carrier, t1, t2);

    const changed = applyTackleOutcomes(
      [
        won('T2', 0.5, 'T2'),
        won('T1', 0.5, 'T1'),
      ],
      state,
      {}
    );

    expect(changed).toBe(true);
    expect(state.ball.ownerId).toBe('T1');
  });

  it('failed outcomes decisive contest sıralamasına girmez', () => {
    const carrier = makePlayer('C', 'club_2', 50, 32);
    const near = makePlayer('T2', 'club_1', 49.5, 32);
    const far = makePlayer('T1', 'club_1', 49, 32);
    const state = makeState(carrier, near, far);

    const failed: TackleOutcome = {
      type: 'failed',
      tacklerId: 'T2',
      ballCarrierId: 'C',
      debug: {
        winChance: 0.1,
        relativeSpeed: 1,
        distance: 0.1,
      },
    };

    const changed = applyTackleOutcomes(
      [
        failed,
        won('T1', 1.0, 'T1'),
      ],
      state,
      {}
    );

    expect(changed).toBe(true);
    expect(state.ball.ownerId).toBe('T1');
  });
});
