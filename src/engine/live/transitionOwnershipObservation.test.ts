import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import type { LiveMatchState, LivePlayer } from '../types';
import { updateTransitionState } from './liveMatch';

function livePlayer(
  source: LivePlayer['player'],
  clubId: string,
  isHome: boolean,
  x: number,
  y: number,
): LivePlayer {
  return {
    player: source,
    clubId,
    position: { x, y },
    velocity: { x: 0, y: 0 },
    facing: isHome ? 0 : 180,
    nextDecisionTime: 0,
    currentDecision: null,
    currentIntent: 'idle',
    isBallOwner: false,
    isChasingBall: false,
    isMarking: null,
    isHome,
    role: source.position === 'GK' ? 'GK' : 'CM',
    homePosition: { x, y },
    maxSpeed: 7,
    acceleration: 20,
  };
}

describe('Transition ownership observation', () => {
  it('aynı tick içindeki ikinci inter-team ownership değişimini ayrı transition olarak kaydeder', () => {
    const data = generateGameData();
    const clubs = Object.values(data.clubs);

    const homeSource = Object.values(data.players).find(
      player => player.clubId === clubs[0].id && player.position !== 'GK'
    );
    const awaySource = Object.values(data.players).find(
      player => player.clubId === clubs[1].id && player.position !== 'GK'
    );

    expect(homeSource).toBeDefined();
    expect(awaySource).toBeDefined();

    const a = livePlayer(homeSource!, clubs[0].id, true, 45, 32);
    const b = livePlayer(awaySource!, clubs[1].id, false, 50, 32);
    const c = livePlayer(
      { ...homeSource!, id: homeSource!.id + '_C', name: homeSource!.name + ' C' },
      clubs[0].id,
      true,
      55,
      32,
    );

    const state = {
      time: 10,
      players: {
        [a.player.id]: a,
        [b.player.id]: b,
        [c.player.id]: c,
      },
      home: { club: clubs[0] },
      away: { club: clubs[1] },
      ball: { ownerId: b.player.id },
      transition: {
        counterPressClubId: null,
        counterPressPlayerId: null,
        breakClubId: null,
        startedAt: 0,
        expiresAt: 0,
        counterPressProbability: 0,
        breakQuality: 0,
        hasAttemptedCounterPress: false,
        isRecoveryContestActive: false,
        pendingLooseBallRecoveryClubId: null,
        pendingLooseBallRecoveryPlayerId: null,
      },
    } as unknown as LiveMatchState;

    // A -> B
    updateTransitionState(state, a.player.id);
    expect(state.transition.counterPressClubId).toBe(clubs[0].id);
    expect(state.transition.breakClubId).toBe(clubs[1].id);

    // B -> C: second ownership change must not be compared to A.
    state.ball.ownerId = c.player.id;
    updateTransitionState(state, b.player.id);

    expect(state.transition.counterPressClubId).toBe(clubs[1].id);
    expect(state.transition.breakClubId).toBe(clubs[0].id);
    expect(state.transition.counterPressPlayerId).toBe(b.player.id);
  });

  it('loose-ball recovery transition gerçek owner değişimlerinden türetilir', () => {
    const data = generateGameData();
    const clubs = Object.values(data.clubs);

    const homeSource = Object.values(data.players).find(
      player => player.clubId === clubs[0].id && player.position !== 'GK'
    );
    const awaySource = Object.values(data.players).find(
      player => player.clubId === clubs[1].id && player.position !== 'GK'
    );

    expect(homeSource).toBeDefined();
    expect(awaySource).toBeDefined();

    const a = livePlayer(homeSource!, clubs[0].id, true, 45, 32);
    const b = livePlayer(awaySource!, clubs[1].id, false, 50, 32);

    const state = {
      time: 10,
      players: {
        [a.player.id]: a,
        [b.player.id]: b,
      },
      home: { club: clubs[0] },
      away: { club: clubs[1] },
      ball: { ownerId: a.player.id },
      lastBallOwnerId: a.player.id,
      transition: {
        counterPressClubId: null,
        counterPressPlayerId: null,
        breakClubId: null,
        startedAt: 0,
        expiresAt: 100,
        counterPressProbability: 0,
        breakQuality: 0,
        hasAttemptedCounterPress: false,
        isRecoveryContestActive: false,
        pendingLooseBallRecoveryClubId: null,
        pendingLooseBallRecoveryPlayerId: null,
        pendingLooseBallTransitionOwnerId: null,
      },
    } as unknown as LiveMatchState;

    // A -> null: actual ownership loss is recorded as pending context.
    state.ball.ownerId = null;
    updateTransitionState(state, a.player.id);

    expect(state.transition.pendingLooseBallTransitionOwnerId).toBe(
      a.player.id,
    );
    expect(state.transition.counterPressClubId).toBeNull();

    // null -> B: recovery finalizes the transition using the pending
    // actual loss, not by reading historical lastBallOwnerId.
    state.ball.ownerId = b.player.id;
    updateTransitionState(state, null);

    expect(state.transition.counterPressClubId).toBe(clubs[0].id);
    expect(state.transition.breakClubId).toBe(clubs[1].id);
    expect(state.transition.pendingLooseBallTransitionOwnerId).toBeNull();
  });

  it('tick başlangıcı loose-ball ise historical lastBallOwnerId transition tetiklemez', () => {
    const data = generateGameData();
    const clubs = Object.values(data.clubs);

    const homeSource = Object.values(data.players).find(
      player => player.clubId === clubs[0].id && player.position !== 'GK'
    );
    const awaySource = Object.values(data.players).find(
      player => player.clubId === clubs[1].id && player.position !== 'GK'
    );

    expect(homeSource).toBeDefined();
    expect(awaySource).toBeDefined();

    const a = livePlayer(homeSource!, clubs[0].id, true, 45, 32);
    const b = livePlayer(awaySource!, clubs[1].id, false, 50, 32);

    const state = {
      time: 10,
      players: {
        [a.player.id]: a,
        [b.player.id]: b,
      },
      home: { club: clubs[0] },
      away: { club: clubs[1] },
      ball: { ownerId: null },
      lastBallOwnerId: a.player.id,
      transition: {
        counterPressClubId: null,
        counterPressPlayerId: null,
        breakClubId: null,
        startedAt: 0,
        expiresAt: 100,
        counterPressProbability: 0,
        breakQuality: 0,
        hasAttemptedCounterPress: false,
        isRecoveryContestActive: false,
        pendingLooseBallRecoveryClubId: null,
        pendingLooseBallRecoveryPlayerId: null,
        pendingLooseBallTransitionOwnerId: null,
      },
    } as unknown as LiveMatchState;

    // Historical A must not be treated as the actual previous owner of
    // the tick. Without an actual A -> null observation there is no
    // transition context to finalize when B recovers.
    state.ball.ownerId = b.player.id;
    updateTransitionState(state, null);

    expect(state.transition.counterPressClubId).toBeNull();
    expect(state.transition.breakClubId).toBeNull();
  });

});
