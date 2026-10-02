// src/engine/live/passLifecycleTrace.test.ts
//
// PASS -> LOOSE-BALL -> CONTROL LIFECYCLE TRACE — DIAGNOSTIC-ONLY
// =================================================================
//
// Amaç:
//   Gerçek bir pass sonrasında topun tekrar kontrol edilmesine kadar
//   geçen süreyi tick tick ölçmek.
//
// ÖNEMLİ:
//   Bu diagnostic üretim koduna dokunmaz.
//   Eligibility, production resolveLooseBallControl ile aynı kontrata göre
//   ölçülür:
//     - XY speed <= BALL_CONTROL_MAX_SPEED
//     - XY distance <= ballControlRadius
//   Production resolver ball.position.z için ayrıca filtre uygulamıyor.
//   Bu nedenle z yalnızca gözlem alanıdır.
//
// KULLANIM:
//   $env:RUN_LIVE_DIAGNOSTIC="1"
//   npx vitest run src/engine/live/passLifecycleTrace.test.ts
//

import { describe, it } from 'vitest';
import { simulateMatchLive } from './liveMatch';
import { generateGameData } from '../data/generateData';
import {
  BALL_CONTROL_MAX_SPEED,
  DEFAULT_LIVE_ENGINE_CONFIG,
} from './config';

const RUN = process.env.RUN_LIVE_DIAGNOSTIC === '1';
const SEED = 1008;

// İlk ownership-cycle içindeki gerçek pass'leri yakalamak için.
// 44417 / 44487 / 44575 civarındaki olayları kapsar.
const PASS_WINDOW_START = 44400;
const PASS_WINDOW_END = 44700;

// İlk üç lifecycle'ın tam tick tablosunu yaz.
const DETAIL_COUNT = 3;

// 300 tick = 30 saniye. 200 tick de yeterli olurdu; burada
// gereksiz truncation riskini kaldırıyoruz.
const MAX_LIFECYCLE_TICKS = 300;

const CONTROL_RADIUS =
  DEFAULT_LIVE_ENGINE_CONFIG.playerPhysics.ballControlRadius;

interface PassTick {
  tick: number;
  ownerId: string | null;
  ballX: number;
  ballY: number;
  ballZ: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  isMoving: boolean;

  nearestPlayerId: string | null;
  nearestDistance: number;

  speedOk: boolean;
  distanceOk: boolean;
  eligible: boolean;

  rngCounter: number;
}

interface PassLifecycle {
  passTick: number;
  passOwnerId: string | null;
  passEvent: string;
  initialSpeed: number;

  ticks: PassTick[];

  controlTick: number | null;
  newOwnerId: string | null;
  elapsedTicks: number | null;
  timeout: boolean;
}

describe.skipIf(!RUN)('Pass lifecycle trace — single pass walkthrough', () => {
  it(
    `seed ${SEED} için pass->control zincirini tick tick çıkarır`,
    () => {
      const data = generateGameData();
      const clubs = Object.values(data.clubs);
      const home = clubs[0];
      const away = clubs[1];

      // V4/V5 diagnostic kontratıyla aynı oyuncu reseti.
      for (const player of Object.values(data.players)) {
        player.condition = 100;
        player.fatigue = 0;
        player.injuryWeeks = 0;
        player.suspensionWeeks = 0;
        player.sentOff = false;
        player.injured = false;
        player.redCard = false;
      }

      const lifecycles: PassLifecycle[] = [];

      let activeLifecycle: PassLifecycle | null = null;
      let previousObservedOwnerId: string | null = null;
      let observedEventCount = 0;

      simulateMatchLive(home, away, data.players, {
        seed: SEED,
        onTick: (state) => {
          const ownerId = state.ball.ownerId;
          const ball = state.ball;

          const speed = Math.hypot(
            ball.velocity.x,
            ball.velocity.y,
          );

          // Event'in daha önce görülmüş mü yoksa bu tick'te mi üretildiğini
          // event length üzerinden ayırıyoruz. Sadece "son event aynı dakika"
          // kontrolü bilinçli olarak kullanılmıyor; aksi halde aynı dakika
          // boyunca aynı pass event'i tekrar tekrar tespit edilebilir.
          const hasNewEvent =
            state.events.length > observedEventCount;

          if (hasNewEvent) {
            const newEvents = state.events.slice(observedEventCount);

            for (const event of newEvents) {
              const isPassEvent =
                event.type === 'pass' || event.type === 'cross';

              if (
                isPassEvent &&
                state.tick >= PASS_WINDOW_START &&
                state.tick <= PASS_WINDOW_END &&
                activeLifecycle === null
              ) {
                // Gerçek pass sonrası topun hâlâ boş olması beklenir.
                // Eğer aynı tick'te interception olduysa owner null değildir;
                // bunu loose-ball lifecycle olarak başlatmıyoruz.
                if (ownerId === null) {
                  activeLifecycle = {
                    passTick: state.tick,
                    passOwnerId: previousObservedOwnerId,
                    passEvent: event.type,
                    initialSpeed: speed,
                    ticks: [],
                    controlTick: null,
                    newOwnerId: null,
                    elapsedTicks: null,
                    timeout: false,
                  };
                }
              }
            }

            observedEventCount = state.events.length;
          }

          if (activeLifecycle !== null) {
            let nearestId: string | null = null;
            let nearestDistance = Infinity;

            for (const id of Object.keys(state.players).sort()) {
              const player = state.players[id];

              const dx = ball.position.x - player.position.x;
              const dy = ball.position.y - player.position.y;
              const distance = Math.hypot(dx, dy);

              if (
                distance < nearestDistance ||
                (
                  distance === nearestDistance &&
                  (nearestId === null || id < nearestId)
                )
              ) {
                nearestDistance = distance;
                nearestId = id;
              }
            }

            const speedOk = speed <= BALL_CONTROL_MAX_SPEED;
            const distanceOk = nearestDistance <= CONTROL_RADIUS;

            activeLifecycle.ticks.push({
              tick: state.tick,
              ownerId,
              ballX: ball.position.x,
              ballY: ball.position.y,
              ballZ: ball.position.z,
              vx: ball.velocity.x,
              vy: ball.velocity.y,
              vz: ball.velocity.z,
              speed,
              isMoving: ball.isMoving,
              nearestPlayerId: nearestId,
              nearestDistance,
              speedOk,
              distanceOk,
              eligible: speedOk && distanceOk,
              rngCounter: state.rng.counter,
            });

            // onTick runTick'in EN SONUNDA çağrılır. Dolayısıyla burada
            // ownerId != null görülmesi, production loose-ball control'ün
            // zaten bu tick içinde gerçekleştiğini gösterir.
            if (ownerId !== null) {
              activeLifecycle.controlTick = state.tick;
              activeLifecycle.newOwnerId = ownerId;
              activeLifecycle.elapsedTicks =
                state.tick - activeLifecycle.passTick;

              lifecycles.push(activeLifecycle);
              activeLifecycle = null;
            } else if (
              state.tick - activeLifecycle.passTick >=
              MAX_LIFECYCLE_TICKS
            ) {
              activeLifecycle.elapsedTicks = null;
              activeLifecycle.timeout = true;
              lifecycles.push(activeLifecycle);
              activeLifecycle = null;
            }
          }

          previousObservedOwnerId = ownerId;
        },
      });

      if (activeLifecycle !== null) {
        lifecycles.push(activeLifecycle);
      }

      console.log('\n=====================================================');
      console.log('PASS LIFECYCLE TRACE');
      console.log('=====================================================\n');

      console.log('seed:                   ', SEED);
      console.log('BALL_CONTROL_MAX_SPEED: ', BALL_CONTROL_MAX_SPEED);
      console.log('controlRadius:          ', CONTROL_RADIUS);
      console.log('pass window:            ', PASS_WINDOW_START, '-', PASS_WINDOW_END);
      console.log('max lifecycle ticks:    ', MAX_LIFECYCLE_TICKS);
      console.log('detected lifecycles:    ', lifecycles.length);

      console.log('\n--- LIFECYCLE ÖZET ---');
      console.table(
        lifecycles.map((lc) => ({
          passTick: lc.passTick,
          event: lc.passEvent,
          passOwner: lc.passOwnerId?.slice(-5) ?? '—',
          controlTick: lc.controlTick,
          newOwner: lc.newOwnerId?.slice(-5) ?? '—',
          elapsed: lc.elapsedTicks,
          saniye:
            lc.elapsedTicks !== null
              ? (lc.elapsedTicks * 0.1).toFixed(2)
              : null,
          initialSpeed: lc.initialSpeed.toFixed(2),
          finalSpeed:
            lc.ticks.length > 0
              ? lc.ticks[lc.ticks.length - 1].speed.toFixed(2)
              : null,
          timeout: lc.timeout,
          totalTicks: lc.ticks.length,
        })),
      );

      for (let i = 0; i < Math.min(DETAIL_COUNT, lifecycles.length); i++) {
        const lc = lifecycles[i];

        console.log(
          '\n═══════════════════════════════════════════════════════',
        );
        console.log(
          `LIFECYCLE #${i + 1} — ${lc.passEvent} passTick=${lc.passTick} -> controlTick=${lc.controlTick} (${lc.elapsedTicks} tick)`,
        );
        console.log(
          '═══════════════════════════════════════════════════════\n',
        );

        console.table(
          lc.ticks.map((t) => ({
            tick: t.tick,
            ballX: Number(t.ballX.toFixed(2)),
            ballY: Number(t.ballY.toFixed(2)),
            ballZ: Number(t.ballZ.toFixed(2)),
            vx: Number(t.vx.toFixed(2)),
            vy: Number(t.vy.toFixed(2)),
            speed: Number(t.speed.toFixed(2)),
            moving: t.isMoving ? '✓' : '',
            nearest: t.nearestPlayerId?.slice(-5) ?? '—',
            nearestD: Number(t.nearestDistance.toFixed(2)),
            speedOk: t.speedOk ? '✓' : '',
            distOk: t.distanceOk ? '✓' : '',
            elig: t.eligible ? '★' : '',
            rng: t.rngCounter,
          })),
        );
      }

      const withControl = lifecycles.filter(
        (lc) => lc.controlTick !== null,
      );

      console.log('\n--- İSTATİSTİK ---');
      console.log('control ile biten: ', withControl.length, '/', lifecycles.length);

      if (withControl.length > 0) {
        const elapsedValues = withControl.map((lc) => lc.elapsedTicks!);
        const avgElapsed =
          elapsedValues.reduce((a, b) => a + b, 0) /
          elapsedValues.length;
        const minElapsed = Math.min(...elapsedValues);
        const maxElapsed = Math.max(...elapsedValues);

        console.log(
          'ortalama süre:     ',
          avgElapsed.toFixed(1),
          'tick =',
          (avgElapsed * 0.1).toFixed(1),
          'sn',
        );
        console.log('min süre:          ', minElapsed, 'tick');
        console.log('max süre:          ', maxElapsed, 'tick');

        const firstSpeedOk = withControl.map((lc) => {
          const index = lc.ticks.findIndex((t) => t.speedOk);
          return {
            passTick: lc.passTick,
            controlTick: lc.controlTick,
            firstSpeedOk:
              index >= 0 ? lc.ticks[index].tick : null,
            speedDelta:
              index >= 0 ? index : null,
          };
        });

        const firstDistanceOk = withControl.map((lc) => {
          const index = lc.ticks.findIndex((t) => t.distanceOk);
          return {
            passTick: lc.passTick,
            controlTick: lc.controlTick,
            firstDistanceOk:
              index >= 0 ? lc.ticks[index].tick : null,
            distanceDelta:
              index >= 0 ? index : null,
          };
        });

        const firstEligible = withControl.map((lc) => {
          const index = lc.ticks.findIndex((t) => t.eligible);
          return {
            passTick: lc.passTick,
            controlTick: lc.controlTick,
            firstEligible:
              index >= 0 ? lc.ticks[index].tick : null,
            eligibleDelta:
              index >= 0 ? index : null,
          };
        });

        console.log('\n--- İLK SPEED-ELIGIBLE TICK ---');
        console.table(firstSpeedOk);

        console.log('\n--- İLK DISTANCE-ELIGIBLE TICK ---');
        console.table(firstDistanceOk);

        console.log('\n--- İLK PRODUCTION-ELIGIBLE TICK ---');
        console.table(firstEligible);

        // En kritik sınıflandırma:
        // eligible gözlenip owner hâlâ null ise, callback'te production
        // control gerçekleşmemiş demektir. Bu başka bir filtre/akış sorusuna
        // işaret eder.
        const eligibleBeforeControl = withControl.filter((lc) => {
          const controlIndex = lc.ticks.findIndex(
            (t) => t.tick === lc.controlTick,
          );

          if (controlIndex <= 0) return false;

          return lc.ticks
            .slice(0, controlIndex)
            .some((t) => t.eligible);
        });

        console.log(
          '\neligible olup sonraki ticklerde owner olmayan lifecycle:',
          eligibleBeforeControl.length,
          '/',
          withControl.length,
        );
      }

      if (lifecycles.length > 0) {
        const firstLc = lifecycles[0];
        const speeds = firstLc.ticks.map((t) => t.speed);

        console.log('\n--- İLK LIFECYCLE FİZİK ÖZETİ ---');
        console.log(
          'initial speed: ',
          speeds[0]?.toFixed(2) ?? '—',
        );
        console.log(
          'final speed:   ',
          speeds[speeds.length - 1]?.toFixed(2) ?? '—',
        );
        console.log(
          'min speed:     ',
          Math.min(...speeds).toFixed(2),
        );
        console.log(
          'max speed:     ',
          Math.max(...speeds).toFixed(2),
        );

        const speedThresholdTick = firstLc.ticks.find(
          (t) => t.speedOk,
        );

        const distThresholdTick = firstLc.ticks.find(
          (t) => t.distanceOk,
        );

        const eligibleTick = firstLc.ticks.find(
          (t) => t.eligible,
        );

        console.log(
          'speed ilk <= 1.5:       ',
          speedThresholdTick
            ? `tick ${speedThresholdTick.tick} (+${speedThresholdTick.tick - firstLc.passTick})`
            : 'yok',
        );

        console.log(
          'nearest ilk <= 0.6:     ',
          distThresholdTick
            ? `tick ${distThresholdTick.tick} (+${distThresholdTick.tick - firstLc.passTick})`
            : 'yok',
        );

        console.log(
          'ilk production eligible:',
          eligibleTick
            ? `tick ${eligibleTick.tick} (+${eligibleTick.tick - firstLc.passTick})`
            : 'yok',
        );

        console.log(
          'control tick:            ',
          firstLc.controlTick ?? 'yok',
        );
      }

      console.log('\n=== SON ===\n');
    },
    60 * 60 * 1000,
  );
});
