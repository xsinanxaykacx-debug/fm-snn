// src/engine/live/looseBallVsSetPieceDiagnostic.test.ts
//
// DIAGNOSTIC ONLY — production davranışına dokunmaz.
//
// Amaç:
//   null -> owner geçişlerini iki gerçek mekanizmaya ayırmak:
//   A) loose-ball recovery (resolveLooseBallControl)
//   B) boundary -> set-piece -> restart
//   C) diğer / belirsiz.
//
// Not:
//   onTick callback'i runTick'in sonunda çalıştığı için set-piece'in
//   "ready" ara durumu callback'te görünmez; production aynı tick içinde
//   ready -> taker owner -> played -> null temizliğini tamamlar.
//   Bu nedenle ready/restart tick'i aynı fiziksel possession geçişi olarak
//   gözlemlenir ve positioningDurationTicks = restartTick - startTick
//   üzerinden türetilir.
//
// Kullanım:
//   $env:RUN_LIVE_DIAGNOSTIC="1"
//   npx vitest run src/engine/live/looseBallVsSetPieceDiagnostic.test.ts

import { describe, expect, it } from 'vitest';
import { simulateMatchLive } from './liveMatch';
import { generateGameData } from '../data/generateData';
import { TICK_DURATION, BALL_CONTROL_MAX_SPEED, DEFAULT_LIVE_ENGINE_CONFIG } from './config';
import type {
  Club,
  LiveMatchState,
  Player,
  SetPieceState,
} from '../types';

const RUN = process.env.RUN_LIVE_DIAGNOSTIC === '1';

const SEEDS = [
  1000, 1001, 1002, 1003, 1004,
  1005, 1006, 1007, 1008, 1009,
];

const MAX_TICKS = 12_000;

type Category = 'A' | 'B' | 'C';

type BoundaryType = 'throw_in' | 'corner' | 'goal_kick';

type SetPieceSnapshot = {
  type: SetPieceState['type'];
  startTick: number;
  elapsed: number;
  takerId: string | null;
  ballX: number;
  ballY: number;
  takerStartDistanceToTarget: number | null;
  takerWasAlreadyInPosition: boolean | null;
};

type BoundarySnapshot = {
  type: BoundaryType;
  tick: number;
  x: number;
  y: number;
};

type TransitionRecord = {
  seed: number;
  transitionTick: number;
  previousOwnerTick: number;
  nullDurationTicks: number;
  category: Category;

  boundaryType: BoundaryType | null;
  boundaryTick: number | null;
  setPieceStartTick: number | null;
  setPieceReadyTick: number | null;
  restartTick: number | null;
  takerId: string | null;

  newOwnerId: string;
  newOwnerClubId: string | null;

  restartDistanceFromBoundary: number | null;
  ballSpeedAtTransition: number;

  nearestDistanceAtEligible: number | null;
  eligibleTick: number | null;
  eligibleToOwnerDelta: number | null;
  wasResolvedByLooseBallControl: boolean;

  positioningDurationTicks: number | null;
  timeoutUsed: boolean | null;
  takerWasAlreadyInPosition: boolean | null;

  note: string;
};

type TickBall = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  speed: number;
};

function distanceXY(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  return Math.hypot(ax - bx, ay - by);
}

function resetPlayers(players: Record<string, Player>): void {
  for (const player of Object.values(players)) {
    player.condition = 100;
    player.fatigue = 0;
    player.injuryWeeks = 0;
    player.suspensionWeeks = 0;
    player.sentOff = false;
    player.injured = false;
    player.redCard = false;
  }
}

function cloneData<T>(value: T): T {
  return structuredClone(value);
}

function getFixture(data: {
  clubs: Record<string, Club>;
}): { home: Club; away: Club } {
  const clubs = Object.values(data.clubs);

  if (clubs.length < 2) {
    throw new Error(
      'Loose-ball/set-piece diagnostic için en az iki kulüp gerekli.',
    );
  }

  return {
    home: clubs[0],
    away: clubs[1],
  };
}

function snapshotBall(state: LiveMatchState): TickBall {
  const vx = state.ball.velocity.x;
  const vy = state.ball.velocity.y;

  return {
    x: state.ball.position.x,
    y: state.ball.position.y,
    z: state.ball.position.z,
    vx,
    vy,
    speed: Math.hypot(vx, vy),
  };
}

function nearestPlayer(
  state: LiveMatchState,
): { id: string; distance: number } | null {
  if (Object.keys(state.players).length === 0) {
    return null;
  }

  let bestId: string | null = null;
  let bestDistance = Infinity;

  for (const id of Object.keys(state.players).sort()) {
    const player = state.players[id];
    const distance = distanceXY(
      state.ball.position.x,
      state.ball.position.y,
      player.position.x,
      player.position.y,
    );

    if (
      distance < bestDistance ||
      (distance === bestDistance && (bestId === null || id < bestId))
    ) {
      bestDistance = distance;
      bestId = id;
    }
  }

  return bestId === null
    ? null
    : { id: bestId, distance: bestDistance };
}

function isBoundaryType(
  value: string | undefined,
): value is BoundaryType {
  return (
    value === 'throw_in' ||
    value === 'corner' ||
    value === 'goal_kick'
  );
}

function isProductionEligible(state: LiveMatchState): boolean {
  const ballSpeed = Math.hypot(
    state.ball.velocity.x,
    state.ball.velocity.y,
  );

  if (ballSpeed > BALL_CONTROL_MAX_SPEED) {
    return false;
  }

  const radius =
    DEFAULT_LIVE_ENGINE_CONFIG.playerPhysics.ballControlRadius;

  const nearest = nearestPlayer(state);

  return nearest !== null && nearest.distance <= radius;
}

function makeSetPieceSnapshot(
  state: LiveMatchState,
): SetPieceSnapshot | null {
  if (state.setPiece === null) {
    return null;
  }

  const setPiece = state.setPiece;
  const takerId = setPiece.takerId;
  const taker = takerId ? state.players[takerId] : null;
  const target = takerId
    ? setPiece.targetPositions[takerId]
    : undefined;

  const takerDistance =
    taker && target
      ? distanceXY(
          taker.position.x,
          taker.position.y,
          target.x,
          target.y,
        )
      : null;

  const tolerance = 0.5;

  return {
    type: setPiece.type,
    startTick: state.tick,
    elapsed: setPiece.elapsed,
    takerId,
    ballX: setPiece.ballPosition.x,
    ballY: setPiece.ballPosition.y,
    takerStartDistanceToTarget: takerDistance,
    takerWasAlreadyInPosition:
      takerDistance === null
        ? null
        : takerDistance <= tolerance,
  };
}

function findNewBoundaryEvent(
  state: LiveMatchState,
  previousEventCount: number,
): BoundarySnapshot | null {
  for (let i = previousEventCount; i < state.events.length; i++) {
    const event = state.events[i];

    if (!isBoundaryType(event.type)) {
      continue;
    }

    // Boundary noktasını MatchEvent'ten değil, aynı tick'te oluşan
    // setPiece.ballPosition'dan alıyoruz. Böylece production state'teki
    // gerçek restart noktasını ölçüyoruz.
    if (state.setPiece !== null) {
      return {
        type: event.type,
        tick: state.tick,
        x: state.setPiece.ballPosition.x,
        y: state.setPiece.ballPosition.y,
      };
    }

    // Defensive fallback: boundary event'i var ama setPiece görünmüyorsa
    // topun mevcut noktasını kullan. Bu durum ayrıca C/diagnostic notunda
    // görünür; B'ye otomatik olarak yazılmaz.
    return {
      type: event.type,
      tick: state.tick,
      x: state.ball.position.x,
      y: state.ball.position.y,
    };
  }

  return null;
}

describe.skipIf(!RUN)('Loose-ball vs set-piece possession diagnostic', () => {
  it(
    'null -> owner geçişlerini A/B/C olarak ayırır',
    () => {
      const baseline = generateGameData();
      const allTransitions: TransitionRecord[] = [];

      for (const seed of SEEDS) {
        const data = cloneData(baseline);
        resetPlayers(data.players);

        const { home, away } = getFixture(data);

        let previousOwnerId: string | null = null;
        let previousTick = 0;
        let previousEventCount = 0;
        let previousSetPiece: SetPieceSnapshot | null = null;

        let nullStartTick: number | null = null;
        let nullStartBall: TickBall | null = null;

        let activeBoundary: BoundarySnapshot | null = null;
        let activeSetPiece: SetPieceSnapshot | null = null;

        let firstEligibleTick: number | null = null;
        let firstEligibleDistance: number | null = null;

        simulateMatchLive(home, away, data.players, {
          seed,
          maxTicks: MAX_TICKS,

          onTick: (state: LiveMatchState): void => {
            const ownerId = state.ball.ownerId;
            const ball = snapshotBall(state);
            const nearest = nearestPlayer(state);
            const currentSetPiece = makeSetPieceSnapshot(state);
            const newBoundary = findNewBoundaryEvent(
              state,
              previousEventCount,
            );

            if (newBoundary !== null) {
              activeBoundary = newBoundary;
            }

            // Set-piece callback'te positioning olarak görünür.
            // İlk görüldüğü tick = diagnostic start tick.
            if (
              currentSetPiece !== null &&
              activeSetPiece === null
            ) {
              activeSetPiece = currentSetPiece;
            }

            if (
              ownerId === null &&
              previousOwnerId !== null
            ) {
              nullStartTick = state.tick;
              nullStartBall = ball;
              firstEligibleTick = null;
              firstEligibleDistance = null;

              // owner null'a düştüğü tick'te boundary/set-piece oluşmuş
              // olabilir; current callback'te setPiece zaten görünür.
              if (
                activeBoundary === null &&
                currentSetPiece !== null &&
                isBoundaryType(currentSetPiece.type)
              ) {
                activeBoundary = {
                  type: currentSetPiece.type,
                  tick: state.tick,
                  x: currentSetPiece.ballX,
                  y: currentSetPiece.ballY,
                };
              }
            }

            if (
              ownerId === null &&
              nullStartTick !== null &&
              isProductionEligible(state)
            ) {
              if (firstEligibleTick === null) {
                firstEligibleTick = state.tick;
                firstEligibleDistance =
                  nearest?.distance ?? null;
              }
            }

            // null -> owner:
            // 1) active boundary + boundary set-piece => B
            // 2) boundary dışı set-piece => C
            // 3) başka source görünmüyorsa production'daki tek kalan
            //    null -> owner yolu resolveLooseBallControl => A
            if (
              previousOwnerId === null &&
              ownerId !== null &&
              nullStartTick !== null
            ) {
              const hasBoundaryRestart =
                activeBoundary !== null &&
                activeSetPiece !== null &&
                isBoundaryType(activeSetPiece.type) &&
                activeBoundary.type === activeSetPiece.type;

              const hasAnySetPieceRestart =
                activeSetPiece !== null &&
                previousSetPiece !== null;

              let category: Category;
              let note: string;

              if (hasBoundaryRestart) {
                category = 'B';
                note =
                  'boundary -> set-piece -> taker restart';
              } else if (hasAnySetPieceRestart) {
                category = 'C';
                note =
                  'set-piece restart var; boundary türü A/B sözleşmesi dışında';
              } else {
                category = 'A';
                note =
                  'boundary/set-piece yok; runTick içindeki null->owner yolu resolveLooseBallControl';
              }

              const boundaryPoint =
                activeBoundary !== null
                  ? activeBoundary
                  : null;

              const restartDistance =
                boundaryPoint === null
                  ? null
                  : distanceXY(
                      state.ball.position.x,
                      state.ball.position.y,
                      boundaryPoint.x,
                      boundaryPoint.y,
                    );

              const positioningDuration =
                activeSetPiece !== null
                  ? state.tick - activeSetPiece.startTick
                  : null;

              const timeoutUsed =
                positioningDuration === null
                  ? null
                  : positioningDuration * TICK_DURATION >=
                    8.0 - 1e-9;

              let eligibleTick = firstEligibleTick;
              let eligibleDistance = firstEligibleDistance;

              // onTick tick-sonu gözlemidir. Resolver aynı tick'te kontrol
              // edip owner'ı atadıysa eligible ara-state callback'te görünmez.
              // Bu durumda geçiş tick'ini "observable eligibility" olarak
              // kaydediyoruz; mesafe 0'dır çünkü top kontrol sahibine
              // bağlanmıştır. Bu alan source sınıflandırmasından bağımsızdır.
              if (
                category === 'A' &&
                eligibleTick === null
              ) {
                eligibleTick = state.tick;
                eligibleDistance = 0;
              }

              allTransitions.push({
                seed,
                transitionTick: state.tick,
                previousOwnerTick: nullStartTick,
                nullDurationTicks:
                  state.tick - nullStartTick,
                category,

                boundaryType:
                  category === 'B'
                    ? activeBoundary?.type ?? null
                    : null,
                boundaryTick:
                  category === 'B'
                    ? activeBoundary?.tick ?? null
                    : null,
                setPieceStartTick:
                  category === 'B'
                    ? activeSetPiece?.startTick ?? null
                    : null,
                setPieceReadyTick:
                  category === 'B'
                    ? state.tick
                    : null,
                restartTick:
                  category === 'B'
                    ? state.tick
                    : null,
                takerId:
                  category === 'B'
                    ? activeSetPiece?.takerId ?? null
                    : null,

                newOwnerId: ownerId,
                newOwnerClubId:
                  state.players[ownerId]?.clubId ?? null,

                restartDistanceFromBoundary:
                  category === 'B'
                    ? restartDistance
                    : null,
                ballSpeedAtTransition: ball.speed,

                nearestDistanceAtEligible: eligibleDistance,
                eligibleTick,
                eligibleToOwnerDelta:
                  eligibleTick === null
                    ? null
                    : state.tick - eligibleTick,
                wasResolvedByLooseBallControl:
                  category === 'A',

                positioningDurationTicks:
                  category === 'B'
                    ? positioningDuration
                    : null,
                timeoutUsed:
                  category === 'B'
                    ? timeoutUsed
                    : null,
                takerWasAlreadyInPosition:
                  category === 'B'
                    ? activeSetPiece?.takerWasAlreadyInPosition ?? null
                    : null,

                note,
              });

              // Lifecycle consumed.
              nullStartTick = null;
              nullStartBall = null;
              activeBoundary = null;
              activeSetPiece = null;
              firstEligibleTick = null;
              firstEligibleDistance = null;
            }

            previousOwnerId = ownerId;
            previousTick = state.tick;
            previousEventCount = state.events.length;
            previousSetPiece = currentSetPiece;
          },
        });
      }

      const a = allTransitions.filter(event => event.category === 'A');
      const b = allTransitions.filter(event => event.category === 'B');
      const c = allTransitions.filter(event => event.category === 'C');

      const mean = (values: number[]): number =>
        values.length === 0
          ? 0
          : values.reduce((sum, value) => sum + value, 0) /
            values.length;

      const statsFor = (events: TransitionRecord[]) => {
        const durations = events.map(event => event.nullDurationTicks);

        return {
          count: events.length,
          averageTicks: mean(durations),
          averageSeconds: mean(durations) * TICK_DURATION,
          minTicks:
            durations.length > 0 ? Math.min(...durations) : null,
          maxTicks:
            durations.length > 0 ? Math.max(...durations) : null,
        };
      };

      console.log(
        '\n=== POSSESSION TRANSITION ÖZETİ ===',
      );
      console.table([
        {
          category: 'A) Loose-ball recovery',
          count: a.length,
          averageTicks: Number(statsFor(a).averageTicks.toFixed(2)),
          averageSeconds: Number(
            statsFor(a).averageSeconds.toFixed(2),
          ),
          minTicks: statsFor(a).minTicks,
          maxTicks: statsFor(a).maxTicks,
        },
        {
          category: 'B) Boundary / set-piece restart',
          count: b.length,
          averageTicks: Number(statsFor(b).averageTicks.toFixed(2)),
          averageSeconds: Number(
            statsFor(b).averageSeconds.toFixed(2),
          ),
          minTicks: statsFor(b).minTicks,
          maxTicks: statsFor(b).maxTicks,
        },
        {
          category: 'C) Unknown / other',
          count: c.length,
          averageTicks: Number(statsFor(c).averageTicks.toFixed(2)),
          averageSeconds: Number(
            statsFor(c).averageSeconds.toFixed(2),
          ),
          minTicks: statsFor(c).minTicks,
          maxTicks: statsFor(c).maxTicks,
        },
      ]);

      console.log(
        '\n=== TOPLAM ===',
      );
      console.log('toplam null -> owner:', allTransitions.length);
      console.log('A loose-ball recovery:', a.length);
      console.log('B set-piece restart:', b.length);
      console.log('C unknown/other:', c.length);
      console.log(
        'tick duration:',
        TICK_DURATION,
        'control max speed:',
        BALL_CONTROL_MAX_SPEED,
      );

      console.log(
        '\n=== TEK TEK NULL -> OWNER OLAYLARI ===',
      );
      console.table(
        allTransitions.map((event, index) => ({
          '#': index + 1,
          seed: event.seed,
          cat: event.category,
          prevTick: event.previousOwnerTick,
          nullTick: event.previousOwnerTick,
          newOwnerTick: event.transitionTick,
          duration: event.nullDurationTicks,
          boundary: event.boundaryType ?? '-',
          setPieceStart: event.setPieceStartTick ?? '-',
          ready: event.setPieceReadyTick ?? '-',
          restart: event.restartTick ?? '-',
          taker: event.takerId ?? '-',
          newOwner: event.newOwnerId,
          note: event.note,
        })),
      );

      console.log(
        '\n=== A — LOOSE-BALL DETAY ===',
      );
      console.table(
        a.map((event, index) => ({
          '#': index + 1,
          seed: event.seed,
          prevTick: event.previousOwnerTick,
          ownerTick: event.transitionTick,
          duration: event.nullDurationTicks,
          eligibleTick: event.eligibleTick,
          nearestDistanceAtEligible:
            event.nearestDistanceAtEligible,
          eligibleToOwnerDelta:
            event.eligibleToOwnerDelta,
          resolvedByLooseBallControl:
            event.wasResolvedByLooseBallControl,
          owner: event.newOwnerId,
        })),
      );

      console.log(
        '\n=== B — SET-PIECE DETAY ===',
      );
      console.table(
        b.map((event, index) => ({
          '#': index + 1,
          seed: event.seed,
          boundary: event.boundaryType,
          boundaryTick: event.boundaryTick,
          startTick: event.setPieceStartTick,
          readyTick: event.setPieceReadyTick,
          restartTick: event.restartTick,
          positioningTicks: event.positioningDurationTicks,
          positioningSeconds:
            event.positioningDurationTicks === null
              ? null
              : Number(
                  (
                    event.positioningDurationTicks *
                    TICK_DURATION
                  ).toFixed(2),
                ),
          timeoutUsed: event.timeoutUsed,
          taker: event.takerId,
          takerAlreadyInPosition:
            event.takerWasAlreadyInPosition,
          restartDistanceFromBoundary:
            event.restartDistanceFromBoundary === null
              ? null
              : Number(
                  event.restartDistanceFromBoundary.toFixed(3),
                ),
          newOwner: event.newOwnerId,
        })),
      );

      console.log(
        '\n=== KATEGORİ DAĞILIMI / SEED ===',
      );
      const bySeed = SEEDS.map(seed => {
        const events = allTransitions.filter(
          event => event.seed === seed,
        );

        return {
          seed,
          total: events.length,
          A: events.filter(event => event.category === 'A').length,
          B: events.filter(event => event.category === 'B').length,
          C: events.filter(event => event.category === 'C').length,
        };
      });
      console.table(bySeed);

      console.log(
        '\n=== 80 TICK KONTROLÜ ===',
      );
      const eighty = b.filter(
        event => event.nullDurationTicks === 80,
      );
      console.log(
        'B olaylarında 80 tick:',
        eighty.length,
        '/',
        b.length,
      );
      console.table(
        eighty.map(event => ({
          seed: event.seed,
          boundary: event.boundaryType,
          boundaryTick: event.boundaryTick,
          startTick: event.setPieceStartTick,
          readyTick: event.setPieceReadyTick,
          restartTick: event.restartTick,
          duration: event.positioningDurationTicks,
          timeout: event.timeoutUsed,
          taker: event.takerId,
          owner: event.newOwnerId,
        })),
      );

      console.log(
        '\n=== DIAGNOSTIC KARARI ===',
      );

      if (a.length > 0 && b.length > 0) {
        console.log(
          'A + B birlikte gözlendi: iki possession recovery mekanizması ayrı ayrı doğrulandı.',
        );
      } else if (a.length === 0 && b.length > 0) {
        console.log(
          'Yalnızca B gözlendi: gözlenen null -> owner geçişleri boundary/set-piece restart kaynaklı.',
        );
      } else if (a.length > 0 && b.length === 0) {
        console.log(
          'Yalnızca A gözlendi: gözlenen null -> owner geçişleri loose-ball recovery kaynaklı.',
        );
      } else {
        console.log(
          'A ve B gözlenmedi: geçişlerin tamamı C veya hiç null -> owner oluşmadı.',
        );
      }

      expect(allTransitions.every(event =>
        event.category === 'A' ||
        event.category === 'B' ||
        event.category === 'C',
      )).toBe(true);
    },
    60 * 60 * 1000,
  );
});
