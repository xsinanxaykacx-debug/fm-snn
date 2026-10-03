import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive, runTick } from './liveMatch';

describe('Counter-press loose-ball recovery lifecycle', () => {
  it('Test 2b: loose ball sonraki tickte counter-press runner tarafından alınır ve recovery olarak sayılır', () => {
    const data = generateGameData();
    const clubs = Object.values(data.clubs);

    const home = clubs[0];
    const away = clubs[1];

    for (const player of Object.values(data.players)) {
      player.condition = 100;
      player.fatigue = 0;
      player.injuryWeeks = 0;
      player.suspensionWeeks = 0;
      player.sentOff = false;
      player.injured = false;
      player.redCard = false;
    }

    let capturedState: Parameters<typeof runTick>[0] | null = null;

    simulateMatchLive(home, away, data.players, {
      seed: 20261001,
      maxTicks: 1,
      onTick: (state) => {
        capturedState = state;
      },
    });

    expect(capturedState).not.toBeNull();

    const state = capturedState!;
    const runner = Object.values(state.players).find(
      (player) => player.clubId === home.id
    );
    const opponent = Object.values(state.players).find(
      (player) => player.clubId === away.id
    );

    expect(runner).toBeDefined();
    expect(opponent).toBeDefined();

    const ballPosition = { x: 50, y: 32 };

    // Deterministik başlangıç:
    // - top loose
    // - top kontrol edilebilir hızda
    // - counter-press transition hâlâ aktif
    // - runner topun kontrol yarıçapında
    // - önceki owner artık yok
    state.ball.position = {
      x: ballPosition.x,
      y: ballPosition.y,
      z: 0.11,
    };
    state.ball.velocity = {
      x: 1,
      y: 0,
      z: 0,
    };
    state.ball.ownerId = null;
    state.ball.isMoving = true;

    // The captured state can still carry the kickoff set-piece from the
    // one-tick bootstrap. This scenario explicitly models a real loose ball,
    // so set-piece positioning must not participate in the recovery test.
    state.setPiece = null;

    runner!.position = { ...ballPosition };
    runner!.velocity = { x: 0, y: 0 };

    // Diğer oyuncuların loose-ball kontrolünü yarışa sokmaması için
    // hepsini topun kontrol yarıçapının dışına taşı.
    for (const player of Object.values(state.players)) {
      if (
        player.player.id !== runner!.player.id &&
        player.player.id !== opponent!.player.id
      ) {
        player.position = { x: 10, y: 10 };
        player.velocity = { x: 0, y: 0 };
      }
    }

    opponent!.position = { x: 80, y: 50 };
    opponent!.velocity = { x: 0, y: 0 };

    state.lastBallOwnerId = null;

    state.transition = {
      counterPressClubId: runner!.clubId,
      counterPressPlayerId: runner!.player.id,
      breakClubId: opponent!.clubId,
      startedAt: state.time - 0.5,
      expiresAt: state.time + 3,
      counterPressProbability: 1,
      breakQuality: 1,
      hasAttemptedCounterPress: false,
      isRecoveryContestActive: false,
      pendingLooseBallRecoveryClubId: runner!.clubId,
      pendingLooseBallRecoveryPlayerId: runner!.player.id,
      pendingLooseBallTransitionOwnerId: null,
    };

    const recoveriesBefore = state.stats.counterPressLooseBallRecoveries;

    // Gerçek tick zinciri:
    // movement → stepBall → resolveLooseBallControl → transition → actions
    runTick(state, data.players);

    expect(state.ball.ownerId).toBe(runner!.player.id);

    // BUG CONTRACT:
    // Loose-ball recovery delayed olduğu için recovery attribution burada
    // kaybolmamalı.
    expect(state.stats.counterPressLooseBallRecoveries).toBe(
      recoveriesBefore + 1
    );
    expect(state.stats.counterPressRecoveries).toBeGreaterThanOrEqual(
      recoveriesBefore + 1
    );

    expect(state.transition.pendingLooseBallRecoveryClubId).toBeNull();
    expect(state.transition.pendingLooseBallRecoveryPlayerId).toBeNull();
  });
});
