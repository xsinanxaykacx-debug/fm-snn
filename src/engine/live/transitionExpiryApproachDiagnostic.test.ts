import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';
import {
  BALL_CONTROL_MAX_SPEED,
  DEFAULT_LIVE_ENGINE_CONFIG,
} from './config';
import type { LiveMatchState } from './types';

const RUN = process.env.RUN_LIVE_DIAGNOSTIC === '1';
const MATCH_COUNT = 50;
const SEED_START = 1000;

type ApproachTick = {
  seed: number;
  tick: number;
  elapsedTicks: number;
  pendingPlayer: string;
  pendingClub: string;
  ballX: number;
  ballY: number;
  ballZ: number;
  ballSpeedXY: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  distance: number;
};

type ExpirySummary = {
  seed: number;
  startTick: number;
  expiryTick: number;
  elapsedTicks: number;
  pendingPlayer: string;
  pendingClub: string;
  startDistance: number;
  minDistance: number;
  minDistanceTick: number;
  expiryDistance: number;
  startBallSpeedXY: number;
  meanBallSpeedXY: number;
  expiryBallSpeedXY: number;
  playerStartX: number;
  playerStartY: number;
  playerEndX: number;
  playerEndY: number;
  ballStartX: number;
  ballStartY: number;
  ballEndX: number;
  ballEndY: number;
};

type PendingSession = {
  seed: number;
  startTick: number;
  pendingPlayer: string;
  pendingClub: string;
  ticks: ApproachTick[];
};

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

function ballSpeedXY(state: LiveMatchState): number {
  return Math.hypot(state.ball.velocity.x, state.ball.velocity.y);
}

function distanceXY(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  return Math.hypot(ax - bx, ay - by);
}

function recordTick(
  session: PendingSession,
  state: LiveMatchState,
  elapsedTicks: number,
): void {
  const player = state.players[session.pendingPlayer];
  if (!player) return;

  session.ticks.push({
    seed: session.seed,
    tick: state.tick,
    elapsedTicks,
    pendingPlayer: session.pendingPlayer,
    pendingClub: session.pendingClub,
    ballX: state.ball.position.x,
    ballY: state.ball.position.y,
    ballZ: state.ball.position.z,
    ballSpeedXY: ballSpeedXY(state),
    playerX: player.position.x,
    playerY: player.position.y,
    playerZ: player.position.z,
    distance: distanceXY(
      player.position.x,
      player.position.y,
      state.ball.position.x,
      state.ball.position.y,
    ),
  });
}

function buildSummary(session: PendingSession): ExpirySummary {
  const first = session.ticks[0];
  const last = session.ticks[session.ticks.length - 1];

  if (!first || !last) {
    throw new Error(
      `v4: boş pending session: seed=${session.seed}`,
    );
  }

  let minDistance = first.distance;
  let minDistanceTick = first.tick;
  let sumBallSpeed = 0;

  for (const tick of session.ticks) {
    if (tick.distance < minDistance) {
      minDistance = tick.distance;
      minDistanceTick = tick.tick;
    }
    sumBallSpeed += tick.ballSpeedXY;
  }

  return {
    seed: session.seed,
    startTick: session.startTick,
    expiryTick: last.tick,
    elapsedTicks: last.elapsedTicks,
    pendingPlayer: session.pendingPlayer,
    pendingClub: session.pendingClub,

    startDistance: first.distance,
    minDistance,
    minDistanceTick,
    expiryDistance: last.distance,

    startBallSpeedXY: first.ballSpeedXY,
    meanBallSpeedXY:
      sumBallSpeed / session.ticks.length,
    expiryBallSpeedXY: last.ballSpeedXY,

    playerStartX: first.playerX,
    playerStartY: first.playerY,
    playerEndX: last.playerX,
    playerEndY: last.playerY,

    ballStartX: first.ballX,
    ballStartY: first.ballY,
    ballEndX: last.ballX,
    ballEndY: last.ballY,
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

describe.skipIf(!RUN)(
  'Transition expiry approach diagnostic (v4)',
  () => {
    it(
      `${MATCH_COUNT} tam maçta expiry vakalarının yaklaşma yörüngesini izler`,
      () => {
        const data = generateGameData();
        const clubs = Object.values(data.clubs);
        const home = clubs[0];
        const away = clubs[1];

        if (!home || !away) {
          throw new Error(
            'v4: generateGameData iki kulüp üretmedi.',
          );
        }

        const summaries: ExpirySummary[] = [];
        const tickTables: ApproachTick[][] = [];

        const controlRadius =
          DEFAULT_LIVE_ENGINE_CONFIG.playerPhysics.ballControlRadius;

        let totalExpiry = 0;
        let totalRecovery = 0;

        for (
          let seed = SEED_START;
          seed < SEED_START + MATCH_COUNT;
          seed += 1
        ) {
          resetPlayers(data);

          let session: PendingSession | null = null;
          let previousPendingClub: string | null = null;
          let previousPendingPlayer: string | null = null;
          let previousPendingExpiresAt = 0;

          simulateMatchLive(
            home,
            away,
            data.players,
            {
              seed,
              onTick: (state) => {
                const pendingClub =
                  state.transition.pendingLooseBallRecoveryClubId;
                const pendingPlayer =
                  state.transition.pendingLooseBallRecoveryPlayerId;
                const pendingExpiresAt =
                  state.transition.expiresAt;

                // Pending ilk kez gözlendi.
                if (
                  previousPendingPlayer === null &&
                  pendingPlayer !== null
                ) {
                  const player = state.players[pendingPlayer];

                  if (player) {
                    session = {
                      seed,
                      startTick: state.tick,
                      pendingPlayer,
                      pendingClub:
                        pendingClub ?? player.clubId,
                      ticks: [],
                    };

                    recordTick(session, state, 0);
                  }
                }
                // Pending devam ediyor.
                else if (
                  previousPendingPlayer !== null &&
                  pendingPlayer !== null &&
                  session !== null &&
                  session.pendingPlayer === pendingPlayer
                ) {
                  recordTick(
                    session,
                    state,
                    state.tick - session.startTick,
                  );
                }
                // Pending kapandı.
                else if (
                  previousPendingPlayer !== null &&
                  pendingPlayer === null &&
                  session !== null
                ) {
                  const ownerId = state.ball.ownerId;

                  if (ownerId !== null) {
                    const owner = state.players[ownerId];

                    if (
                      owner?.clubId === session.pendingClub
                    ) {
                      totalRecovery += 1;
                    } else if (owner) {
                      totalRecovery += 1;
                    } else {
                      totalExpiry += 1;
                      const summary = buildSummary(session);
                      summaries.push(summary);
                      tickTables.push(session.ticks);
                    }
                  } else if (
                    state.time >= previousPendingExpiresAt
                  ) {
                    totalExpiry += 1;
                    const summary = buildSummary(session);
                    summaries.push(summary);
                    tickTables.push(session.ticks);
                  } else {
                    // Pending, owner olmadan ve expiry olmadan kapandı.
                    // Bu beklenmeyen lifecycle durumunu expiry saymıyoruz.
                  }

                  session = null;
                }

                previousPendingClub = pendingClub;
                previousPendingPlayer = pendingPlayer;
                previousPendingExpiresAt = pendingExpiresAt;
              },
            },
          );

          // Maç biterken teorik olarak açık session kalabilir; expiry
          // saymıyoruz çünkü lifecycle kapanışı gerçekleşmemiştir.
          session = null;
        }

        console.log('\n=== EXPIRY APPROACH DIAGNOSTIC (v4) ===\n');
        console.log(`Toplam expiry:   ${totalExpiry}`);
        console.log(`Toplam recovery: ${totalRecovery}`);
        console.log(`controlRadius:   ${controlRadius}`);
        console.log(
          `BALL_CONTROL_MAX_SPEED: ${BALL_CONTROL_MAX_SPEED}\n`,
        );

        if (summaries.length > 0) {
          console.log('--- ÖZET TABLO ---');
          console.table(
            summaries.map((summary) => ({
              seed: summary.seed,
              startTick: summary.startTick,
              expiryTick: summary.expiryTick,
              elapsedTicks: summary.elapsedTicks,
              pendingPlayer: summary.pendingPlayer,
              pendingClub: summary.pendingClub,
              startDistance: round3(summary.startDistance),
              minDistance: round3(summary.minDistance),
              minDistanceTick: summary.minDistanceTick,
              expiryDistance: round3(summary.expiryDistance),
              startBallSpeedXY: round3(
                summary.startBallSpeedXY,
              ),
              meanBallSpeedXY: round3(
                summary.meanBallSpeedXY,
              ),
              expiryBallSpeedXY: round3(
                summary.expiryBallSpeedXY,
              ),
              playerStartX: round3(summary.playerStartX),
              playerStartY: round3(summary.playerStartY),
              playerEndX: round3(summary.playerEndX),
              playerEndY: round3(summary.playerEndY),
              ballStartX: round3(summary.ballStartX),
              ballStartY: round3(summary.ballStartY),
              ballEndX: round3(summary.ballEndX),
              ballEndY: round3(summary.ballEndY),
            })),
          );
        } else {
          console.log('Özet tablo boş: expiry vakası yok.');
        }

        if (tickTables.length > 0) {
          console.log(
            '\n--- TICK TABLOSU (yalnızca expiry vakaları) ---',
          );

          const flat = tickTables.flatMap((ticks) =>
            ticks.map((tick) => ({
              seed: tick.seed,
              tick: tick.tick,
              elapsedTicks: tick.elapsedTicks,
              pendingPlayer: tick.pendingPlayer,
              pendingClub: tick.pendingClub,
              ballX: round3(tick.ballX),
              ballY: round3(tick.ballY),
              ballZ: round3(tick.ballZ),
              ballSpeedXY: round3(tick.ballSpeedXY),
              playerX: round3(tick.playerX),
              playerY: round3(tick.playerY),
              playerZ: round3(tick.playerZ),
              distance: round3(tick.distance),
            })),
          );

          console.table(flat);
        } else {
          console.log(
            'Tick tablosu boş: expiry vakası yok.',
          );
        }

        console.log('\n=== SON ===\n');

        expect(totalExpiry).toBe(summaries.length);
        expect(summaries.length).toBe(tickTables.length);
      },
    );
  },
);
