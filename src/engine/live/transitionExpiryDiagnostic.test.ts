import { describe, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';
import {
  BALL_CONTROL_MAX_SPEED,
  DEFAULT_LIVE_ENGINE_CONFIG,
} from './config';

const RUN = process.env.RUN_LIVE_DIAGNOSTIC === '1';
const MATCH_COUNT = 50;
const SEED_START = 1000;

type Diagnosis =
  | 'FİZİK'
  | 'ERİŞİM'
  | 'BUG?'
  | 'OWNER_VAR';

interface ExpiryRecord {
  seed: number;
  expiryTick: number;
  startTick: number;
  elapsedTicks: number;

  pendingClub: string;
  pendingPlayer: string | null;

  ballPosition: {
    x: number;
    y: number;
    z: number;
  };

  ballVelocity: {
    x: number;
    y: number;
    z: number;
  };

  ballSpeed: number;

  ownerIsNull: boolean;

  nearestPlayerId: string | null;
  nearestPlayerClubId: string | null;
  nearestDistance: number;

  controlRadius: number;
  ballControlMaxSpeed: number;

  diagnosis: Diagnosis;
}

function resetPlayers(
  data: ReturnType<typeof generateGameData>,
): void {
  for (const player of Object.values(data.players)) {
    player.condition = 100;
    player.fatigue = 0;
    player.injuryWeeks = 0;
    player.suspensionWeeks = 0;
    player.sentOff = false;
    player.injured = false;
    player.redCard = false;
  }
}

describe.skipIf(!RUN)(
  'Transition expiry diagnostic',
  () => {
    it(
      MATCH_COUNT +
        ' tam maçta expiry vakalarını teşhis eder',
      () => {
        const allExpiries: ExpiryRecord[] = [];

        const controlRadius =
          DEFAULT_LIVE_ENGINE_CONFIG.playerPhysics
            .ballControlRadius;

        const data = generateGameData();
        const clubs = Object.values(data.clubs);
        const home = clubs[0];
        const away = clubs[1];

        for (
          let seed = SEED_START;
          seed < SEED_START + MATCH_COUNT;
          seed += 1
        ) {
          resetPlayers(data);

          let previousPendingClub: string | null = null;
          let previousPendingPlayer: string | null = null;
          let previousPendingExpiresAt = 0;
          let pendingStartTick: number | null = null;

          let previousBallPosition = {
            x: 0,
            y: 0,
            z: 0,
          };

          let previousBallVelocity = {
            x: 0,
            y: 0,
            z: 0,
          };

          let previousOwnerIsNull = false;

          simulateMatchLive(
            home,
            away,
            data.players,
            {
              seed,

              onTick: (state) => {
                const pendingClub =
                  state.transition
                    .pendingLooseBallRecoveryClubId;

                const pendingPlayer =
                  state.transition
                    .pendingLooseBallRecoveryPlayerId;

                const pendingExpiresAt =
                  state.transition.expiresAt;

                // Pending ilk kez gözlendi.
                if (
                  pendingClub !== null &&
                  previousPendingClub === null
                ) {
                  pendingStartTick = state.tick;
                }

                // Önceki tick'te pending vardı,
                // bu tick sonunda artık yok.
                if (
                  previousPendingClub !== null &&
                  pendingClub === null
                ) {
                  const isExpiry =
                    state.time >=
                    previousPendingExpiresAt;

                  if (isExpiry) {
                    let nearestPlayerId:
                      string | null = null;

                    let nearestPlayerClubId:
                      string | null = null;

                    let nearestDistance = Infinity;

                    // Production loose-ball control ile aynı
                    // oyuncu uzayı: XY mesafesi, tüm oyuncular.
                    for (
                      const id of Object.keys(
                        state.players,
                      ).sort()
                    ) {
                      const player =
                        state.players[id];

                      const dx =
                        previousBallPosition.x -
                        player.position.x;

                      const dy =
                        previousBallPosition.y -
                        player.position.y;

                      const distance = Math.hypot(
                        dx,
                        dy,
                      );

                      if (
                        distance <
                        nearestDistance
                      ) {
                        nearestDistance =
                          distance;

                        nearestPlayerId = id;
                        nearestPlayerClubId =
                          player.clubId;
                      }
                    }

                    // Production resolveLooseBallControl
                    // ile birebir aynı: yalnızca XY hız.
                    const ballSpeed =
                      Math.hypot(
                        previousBallVelocity.x,
                        previousBallVelocity.y,
                      );

                    let diagnosis: Diagnosis;

                    if (!previousOwnerIsNull) {
                      diagnosis = 'OWNER_VAR';
                    } else if (
                      ballSpeed >
                      BALL_CONTROL_MAX_SPEED
                    ) {
                      diagnosis = 'FİZİK';
                    } else if (
                      nearestDistance >
                      controlRadius
                    ) {
                      diagnosis = 'ERİŞİM';
                    } else {
                      diagnosis = 'BUG?';
                    }

                    allExpiries.push({
                      seed,

                      expiryTick:
                        state.tick - 1,

                      startTick:
                        pendingStartTick ??
                        state.tick,

                      elapsedTicks:
                        (state.tick - 1) -
                        (pendingStartTick ??
                          state.tick),

                      pendingClub:
                        previousPendingClub,

                      pendingPlayer:
                        previousPendingPlayer,

                      ballPosition: {
                        ...previousBallPosition,
                      },

                      ballVelocity: {
                        ...previousBallVelocity,
                      },

                      ballSpeed,

                      ownerIsNull:
                        previousOwnerIsNull,

                      nearestPlayerId,

                      nearestPlayerClubId,

                      nearestDistance,

                      controlRadius,

                      ballControlMaxSpeed:
                        BALL_CONTROL_MAX_SPEED,

                      diagnosis,
                    });

                    pendingStartTick = null;
                  }
                }

                previousPendingClub =
                  pendingClub;

                previousPendingPlayer =
                  pendingPlayer;

                previousPendingExpiresAt =
                  pendingExpiresAt;

                previousBallPosition = {
                  ...state.ball.position,
                };

                previousBallVelocity = {
                  ...state.ball.velocity,
                };

                previousOwnerIsNull =
                  state.ball.ownerId === null;
              },
            },
          );
        }

        console.log('');
        console.log(
          '=== EXPIRY DIAGNOSTIC ===',
        );
        console.log('');

        console.log(
          'Toplam expiry: ' +
            allExpiries.length,
        );

        console.log(
          'controlRadius: ' +
            controlRadius,
        );

        console.log(
          'BALL_CONTROL_MAX_SPEED: ' +
            BALL_CONTROL_MAX_SPEED,
        );

        const byDiagnosis: Record<
          Diagnosis,
          number
        > = {
          'FİZİK': 0,
          'ERİŞİM': 0,
          'BUG?': 0,
          'OWNER_VAR': 0,
        };

        for (const expiry of allExpiries) {
          byDiagnosis[
            expiry.diagnosis
          ] += 1;
        }

        console.log('');
        console.log(
          'Teşhis dağılımı:',
        );

        console.log(
          '  FİZİK:      ' +
            byDiagnosis['FİZİK'],
        );

        console.log(
          '  ERİŞİM:     ' +
            byDiagnosis['ERİŞİM'],
        );

        console.log(
          '  BUG?:       ' +
            byDiagnosis['BUG?'],
        );

        console.log(
          '  OWNER_VAR:  ' +
            byDiagnosis['OWNER_VAR'],
        );

        if (allExpiries.length > 0) {
          console.log('');
          console.log(
            'Detaylı kayıtlar:',
          );
          console.table(allExpiries);
        }

        console.log('');
        console.log('=== SON ===');
        console.log('');
      },
      60 * 60 * 1000,
    );
  },
);
