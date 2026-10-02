// src/engine/live/pendingRecoveryOwnershipDiagnostic.test.ts
//
// PENDING RECOVERY + OWNERSHIP LIFECYCLE DIAGNOSTIC
// =================================================
//
// Amaç:
//   1) Pending recovery'nin onTick öncesinde oluşup aynı tick'te temizlenip
//      temizlenmediğini istatistiklerden kontrol etmek.
//   2) Seed 1008'de 44360-45930 arasındaki 86-tick ownership pattern'inin
//      kaynağını gözlemlemek.
//   3) Ownership değişiminde intent/reason, lastTouch, velocity ve RNG
//      durumunu aynı snapshot'ta görmek.
//
// KONTRAT:
//   • Production koduna dokunulmaz.
//   • Sadece mevcut simulateMatchLive/onTick gözlem kanalı kullanılır.
//   • resolveLooseBallControl devre dışı bırakılmaz.
//   • Sonuçtan önce production patch yapılmaz.
//
// KULLANIM:
//   $env:RUN_LIVE_DIAGNOSTIC="1"
//   npx vitest run src/engine/live/pendingRecoveryOwnershipDiagnostic.test.ts
//

import { describe, it } from 'vitest';
import { simulateMatchLive } from './liveMatch';
import { generateGameData } from '../data/generateData';

const RUN = process.env.RUN_LIVE_DIAGNOSTIC === '1';
const SEED = 1008;

const WINDOW_START = 44360;
const WINDOW_END = 45930;

describe.skipIf(!RUN)('Pending recovery + ownership lifecycle diagnostic', () => {
  it('seed 1008 lifecycle ve ownership kaynağını gözlemler', () => {
    const data = generateGameData();
    const clubs = Object.values(data.clubs);
    const home = clubs[0];
    const away = clubs[1];

    // V4/V5 diagnostics ile aynı başlangıç koşulu.
    for (const player of Object.values(data.players)) {
      player.condition = 100;
      player.fatigue = 0;
      player.injuryWeeks = 0;
      player.suspensionWeeks = 0;
      player.sentOff = false;
      player.injured = false;
      player.redCard = false;
    }

    let previousOwnerId: string | null = null;

    let previousCounterPressRecoveries = 0;
    let previousLooseBallRecoveries = 0;
    let previousCleanRecoveries = 0;
    let previousCounterPressAttempts = 0;

    const ownershipChanges: Array<{
      tick: number;
      previousOwner: string | null;
      owner: string | null;
      rng: number;
      intent: string | null;
      reason: string | null;
      lastTouch: string | null;
      lastTouchClub: string | null;
      isMoving: boolean;
      vx: number;
      vy: number;
      speed: number;
    }> = [];

    const recoveryStatChanges: Array<{
      tick: number;
      counterPressRecoveries: number;
      looseBallRecoveries: number;
      cleanRecoveries: number;
      attempts: number;
      owner: string | null;
      pendingPlayer: string | null;
      pendingClub: string | null;
    }> = [];

    simulateMatchLive(home, away, data.players, {
      seed: SEED,
      onTick: (state) => {
        const stats = state.stats;

        if (
          stats.counterPressRecoveries !== previousCounterPressRecoveries ||
          stats.counterPressLooseBallRecoveries !== previousLooseBallRecoveries ||
          stats.counterPressCleanRecoveries !== previousCleanRecoveries ||
          stats.counterPressAttempts !== previousCounterPressAttempts
        ) {
          recoveryStatChanges.push({
            tick: state.tick,
            counterPressRecoveries: stats.counterPressRecoveries,
            looseBallRecoveries: stats.counterPressLooseBallRecoveries,
            cleanRecoveries: stats.counterPressCleanRecoveries,
            attempts: stats.counterPressAttempts,
            owner: state.ball.ownerId,
            pendingPlayer:
              state.transition.pendingLooseBallRecoveryPlayerId,
            pendingClub:
              state.transition.pendingLooseBallRecoveryClubId,
          });

          previousCounterPressRecoveries = stats.counterPressRecoveries;
          previousLooseBallRecoveries = stats.counterPressLooseBallRecoveries;
          previousCleanRecoveries = stats.counterPressCleanRecoveries;
          previousCounterPressAttempts = stats.counterPressAttempts;
        }

        const ownerId = state.ball.ownerId;

        if (
          state.tick >= WINDOW_START &&
          state.tick <= WINDOW_END &&
          ownerId !== previousOwnerId
        ) {
          const owner = ownerId ? state.players[ownerId] : null;
          const decision = owner?.currentDecision ?? null;
          const speed = Math.hypot(
            state.ball.velocity.x,
            state.ball.velocity.y,
          );

          ownershipChanges.push({
            tick: state.tick,
            previousOwner: previousOwnerId,
            owner: ownerId,
            rng: state.rng.counter,
            intent: decision?.intent ?? owner?.currentIntent ?? null,
            reason: decision?.reason ?? null,
            lastTouch: state.ball.lastTouchId,
            lastTouchClub: state.ball.lastTouchClubId,
            isMoving: state.ball.isMoving,
            vx: state.ball.velocity.x,
            vy: state.ball.velocity.y,
            speed,
          });

          console.log(
            '[OWNERSHIP-WINDOW]' +
              ' tick=' + state.tick +
              ' prev=' + (previousOwnerId ?? 'null') +
              ' owner=' + (ownerId ?? 'null') +
              ' rng=' + state.rng.counter +
              ' intent=' + (decision?.intent ?? owner?.currentIntent ?? 'null') +
              ' reason=' + (decision?.reason ?? 'null') +
              ' lastTouch=' + (state.ball.lastTouchId ?? 'null') +
              ' lastTouchClub=' + (state.ball.lastTouchClubId ?? 'null') +
              ' moving=' + state.ball.isMoving +
              ' speed=' + speed.toFixed(3),
          );
        }

        previousOwnerId = ownerId;
      },
    });

    const finalStats = {
      counterPressAttempts: 0,
      counterPressRecoveries: 0,
      counterPressCleanRecoveries: 0,
      counterPressLooseBallRecoveries: 0,
    };

    // Match sonrası simulateMatchLive state'i dışarı vermiyor; recovery
    // değişimleri onTick üzerinden zaten yakalandı. Son gözlenen değerleri
    // güvenilir biçimde özetle.
    for (const change of recoveryStatChanges) {
      finalStats.counterPressAttempts = change.attempts;
      finalStats.counterPressRecoveries = change.counterPressRecoveries;
      finalStats.counterPressCleanRecoveries = change.cleanRecoveries;
      finalStats.counterPressLooseBallRecoveries = change.looseBallRecoveries;
    }

    console.log('\n=== PENDING RECOVERY + OWNERSHIP DIAGNOSTIC ===\n');

    console.log('--- RECOVERY STAT LIFECYCLE ---');
    console.log('recovery stat change count: ' + recoveryStatChanges.length);
    console.log('counterPressAttempts:       ' + finalStats.counterPressAttempts);
    console.log('counterPressRecoveries:     ' + finalStats.counterPressRecoveries);
    console.log('counterPressCleanRecoveries:' + finalStats.counterPressCleanRecoveries);
    console.log('counterPressLooseBallRec:   ' + finalStats.counterPressLooseBallRecoveries);

    if (recoveryStatChanges.length > 0) {
      console.log('\nRecovery stat değişimleri:');
      console.table(recoveryStatChanges);
    } else {
      console.log('Recovery statlarında hiç değişim olmadı.');
    }

    console.log('\n--- OWNERSHIP WINDOW ---');
    console.log('window: ' + WINDOW_START + ' - ' + WINDOW_END);
    console.log('ownership changes: ' + ownershipChanges.length);

    if (ownershipChanges.length > 0) {
      console.table(ownershipChanges);
    }

    const alternatingPairs: string[] = [];
    for (let i = 1; i < ownershipChanges.length; i++) {
      const a = ownershipChanges[i - 1];
      const b = ownershipChanges[i];

      if (
        a.owner !== null &&
        b.owner !== null &&
        a.owner !== b.owner
      ) {
        alternatingPairs.push(
          a.tick + '->' + b.tick +
          ' (' + (b.tick - a.tick) + ' tick)'
        );
      }
    }

    console.log('\n--- OWNERSHIP INTERVALS ---');
    console.log('interval count: ' + alternatingPairs.length);
    console.log(alternatingPairs.join('\n'));

    const zeroRngOwnerships = ownershipChanges.filter(
      (entry, index) => {
        if (index === 0) return false;
        const previous = ownershipChanges[index - 1];
        return entry.rng === previous.rng;
      },
    );

    console.log('\n--- RNG-FREE OWNERSHIP CHANGES ---');
    console.log('count: ' + zeroRngOwnerships.length);
    if (zeroRngOwnerships.length > 0) {
      console.table(zeroRngOwnerships);
    }

    console.log('\n=== END ===\n');

    expect(ownershipChanges.length).toBeGreaterThanOrEqual(0);
  });
});
