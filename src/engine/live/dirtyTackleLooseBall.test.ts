import { describe, it, expect } from 'vitest';

import type { LivePlayer, LiveMatchState, TackleOutcome } from '../types';
import { applyTackleWon } from './liveMatch';

function makePlayer(
  id: string,
  clubId: string,
  pos: { x: number; y: number },
  vel: { x: number; y: number } = { x: 0, y: 0 },
): LivePlayer {
  return {
    player: { id, name: id, attributes: {} as any },
    clubId,
    position: { x: pos.x, y: pos.y },
    velocity: { x: vel.x, y: vel.y },
    facing: 0,
    nextDecisionTime: 0,
    currentDecision: null,
    currentIntent: 'idle',
    isBallOwner: false,
    isChasingBall: false,
    isMarking: null,
    isHome: clubId === 'club_1',
    role: 'CM',
    homePosition: { x: pos.x, y: pos.y },
    maxSpeed: 1,
    acceleration: 1,
  };
}

function makeState(
  tackler: LivePlayer,
  carrier: LivePlayer,
): LiveMatchState {
  return {
    players: {
      [tackler.player.id]: tackler,
      [carrier.player.id]: carrier,
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

function makeDirtyWonOutcome(
  tacklerId: string,
  carrierId: string,
  point: { x: number; y: number },
): TackleOutcome & { type: 'won' } {
  return {
    type: 'won',
    tacklerId,
    ballCarrierId: carrierId,
    newOwnerId: null,
    point,
    debug: {
      winChance: 1,
      cleanChance: 0,
      relativeSpeed: 4.0,
      distance: 0.5,
    },
  };
}

describe('Dirty tackle loose-ball contract', () => {
  it('top dirty tackle sonrası hız kazanır, isMoving = true olur', () => {
    const tackler = makePlayer('T1', 'club_1', { x: 0, y: 0 }, { x: 5, y: 0 });
    const carrier = makePlayer('C1', 'club_2', { x: 1, y: 0 });
    const state = makeState(tackler, carrier);

    applyTackleWon(
      makeDirtyWonOutcome('T1', 'C1', { x: 1, y: 0 }),
      state
    );

    expect(state.ball.ownerId).toBeNull();
    expect(state.ball.isMoving).toBe(true);
    expect(Math.hypot(state.ball.velocity.x, state.ball.velocity.y)).toBeCloseTo(4, 9);
    expect(state.ball.lastTouchId).toBe('T1');
    expect(state.ball.lastTouchClubId).toBe('club_1');
  });

  it('knockSpeed clamp aralığında kalır', () => {
    const tackler = makePlayer('T1', 'club_1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const carrier = makePlayer('C1', 'club_2', { x: 1, y: 0 });
    const state = makeState(tackler, carrier);

    applyTackleWon(
      makeDirtyWonOutcome('T1', 'C1', { x: 1, y: 0 }),
      state
    );

    const speed = Math.hypot(state.ball.velocity.x, state.ball.velocity.y);
    expect(speed).toBeLessThanOrEqual(5.0 + 1e-9);
    expect(speed).toBeGreaterThanOrEqual(2.0 - 1e-9);
  });

  it('tackler velocity sıfırsa fallback tackler → carrier yönü kullanılır', () => {
    const tackler = makePlayer('T1', 'club_1', { x: 0, y: 0 });
    const carrier = makePlayer('C1', 'club_2', { x: 1, y: 0 });
    const state = makeState(tackler, carrier);

    applyTackleWon(
      makeDirtyWonOutcome('T1', 'C1', { x: 1, y: 0 }),
      state
    );

    expect(state.ball.velocity.y).toBeCloseTo(0, 9);
    expect(state.ball.velocity.x).toBeGreaterThan(0);
  });

  it('dirty tackle sonrası top kontrol eşiğinin üzerinde hareket eder', () => {
    const tackler = makePlayer('T1', 'club_1', { x: 0, y: 0 }, { x: 5, y: 0 });
    const carrier = makePlayer('C1', 'club_2', { x: 1, y: 0 });
    const state = makeState(tackler, carrier);

    applyTackleWon(
      makeDirtyWonOutcome('T1', 'C1', { x: 1, y: 0 }),
      state
    );

    const speed = Math.hypot(state.ball.velocity.x, state.ball.velocity.y);
    expect(speed).toBeGreaterThan(1.5);
  });
});
