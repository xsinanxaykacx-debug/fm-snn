// src/engine/live/categoryCResolution.test.ts
//
// DIAGNOSTIC ONLY — C-transition v3.
//
// Kullanım:
//   git pull
//   $env:RUN_LIVE_DIAGNOSTIC="1"
//   npx vitest run src/engine/live/categoryCResolution.test.ts
//
// Production dosyalarına dokunulmaz.
// vi.mock yalnızca test scope'unda controlBall'ı sarar.

import { describe, expect, it, vi } from 'vitest';

// vi.mock hoisted olduğu için factory içinde trace modülünü dinamik
// import ediyoruz. Böylece test module initialization sırasına bağımlı
// kalmıyoruz.
vi.mock('./ball', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./ball')>();

  const { recordControlBallTrace } =
    await import('./diagnostics/controlBallTrace');

  return {
    ...actual,

    controlBall: (
      ball: Parameters<typeof actual.controlBall>[0],
      ownerId: Parameters<typeof actual.controlBall>[1],
      clubId: Parameters<typeof actual.controlBall>[2],
    ) => {
      const stack = new Error().stack ?? '';

      recordControlBallTrace(
        ownerId,
        clubId,
        ball.position.x,
        ball.position.y,
        ball.ownerId,
        stack,
      );

      // Kritik: davranış değişmez; gerçek implementation aynen çağrılır.
      return actual.controlBall(ball, ownerId, clubId);
    },
  };
});

import { generateGameData } from '../data/generateData';
import type { Club, Player } from '../types';
import { simulateMatchLive } from './liveMatch';

import {
  CTransitionDiagnosticV3,
  DEFAULT_MAX_TICKS,
} from './diagnostics/cTransitionDiagnosticV3';

import { traceBuffer } from './diagnostics/controlBallTrace';

const RUN = process.env.RUN_LIVE_DIAGNOSTIC === '1';

const SEEDS = [
  1000, 1001, 1002, 1003, 1004,
  1005, 1006, 1007, 1008, 1009,
];

const MAX_TICKS_PER_SEED = DEFAULT_MAX_TICKS;

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
      'C-transition diagnostic için en az iki kulüp gerekli.',
    );
  }

  return {
    home: clubs[0],
    away: clubs[1],
  };
}

describe.skipIf(!RUN)('C-transition diagnostic v3', () => {
  it(
    'runs ' + SEEDS.length + ' seeds x ' + MAX_TICKS_PER_SEED + ' ticks',
    () => {
      const baseline = generateGameData();

      const aggregate = {
        C1_loose_ball_resolver: 0,
        C2_boundary_set_piece: 0,
        C3_direct_action_resolution: 0,
        C4_kickoff: 0,
        C5_unexplained: 0,
      };

      const c5Aggregate = {
        LIKELY_LOOSE_BALL: 0,
        C5_UNEXPLAINED_UNCHANGED: 0,
        C5_UNEXPLAINED_CHANGED: 0,
        C5_UNEXPLAINED_LOST: 0,
      };

      const callerAggregate = {
        resolveLooseBallControl: 0,
        applyTackleWon: 0,
        updateSetPieceStatus: 0,
        handlePassAction: 0,
        kickoff: 0,
        other: 0,
        NONE: 0,
      };

      const callerBySubAggregate = {
        LIKELY_LOOSE_BALL: {
          resolveLooseBallControl: 0,
          applyTackleWon: 0,
          updateSetPieceStatus: 0,
          handlePassAction: 0,
          kickoff: 0,
          other: 0,
          NONE: 0,
        },
        C5_UNEXPLAINED_UNCHANGED: {
          resolveLooseBallControl: 0,
          applyTackleWon: 0,
          updateSetPieceStatus: 0,
          handlePassAction: 0,
          kickoff: 0,
          other: 0,
          NONE: 0,
        },
        C5_UNEXPLAINED_CHANGED: {
          resolveLooseBallControl: 0,
          applyTackleWon: 0,
          updateSetPieceStatus: 0,
          handlePassAction: 0,
          kickoff: 0,
          other: 0,
          NONE: 0,
        },
        C5_UNEXPLAINED_LOST: {
          resolveLooseBallControl: 0,
          applyTackleWon: 0,
          updateSetPieceStatus: 0,
          handlePassAction: 0,
          kickoff: 0,
          other: 0,
          NONE: 0,
        },
      };

      let totalC = 0;

      for (const seed of SEEDS) {
        traceBuffer.clear();

        const data = cloneData(baseline);
        resetPlayers(data.players);

        const { home, away } = getFixture(data);

        const diagnostic =
          new CTransitionDiagnosticV3(traceBuffer, MAX_TICKS_PER_SEED);

        simulateMatchLive(
          home,
          away,
          data.players,
          {
            seed,
            maxTicks: MAX_TICKS_PER_SEED,

            onTackleResolved: outcome => {
              diagnostic.onTackleResolved(outcome);
            },

            onTick: state => {
              diagnostic.onTick(state);
            },
          },
        );

        const report = diagnostic.report();

        totalC += report.totalC;

        for (const key of Object.keys(aggregate) as Array<keyof typeof aggregate>) {
          aggregate[key] += report.dist[key];
        }

        for (const key of Object.keys(c5Aggregate) as Array<keyof typeof c5Aggregate>) {
          c5Aggregate[key] += report.c5SubDist[key];
        }

        for (const key of Object.keys(callerAggregate) as Array<keyof typeof callerAggregate>) {
          callerAggregate[key] += report.callerDist[key];
        }

        for (const sub of Object.keys(callerBySubAggregate) as Array<keyof typeof callerBySubAggregate>) {
          for (const caller of Object.keys(callerBySubAggregate[sub]) as Array<keyof typeof callerBySubAggregate[typeof sub]>) {
            callerBySubAggregate[sub][caller] += report.callerBySub[sub][caller];
          }
        }
      }

      console.log('');
      console.log('=== AGGREGATE ACROSS 10 SEEDS ===');
      console.log('total C transitions: ' + totalC);
      console.table(aggregate);

      console.log('=== AGGREGATE C5 SUBCLASSIFICATION ===');
      console.table(c5Aggregate);

      console.log('=== AGGREGATE C5 CALLER ===');
      console.table(callerAggregate);

      console.log('=== AGGREGATE C5 SUBCLASS × CALLER ===');
      console.table(callerBySubAggregate);

      console.log('');
      console.log('=== KARAR NOKTASI ===');

      if (c5Aggregate.C5_UNEXPLAINED_UNCHANGED === 0) {
        console.log('C5 UNCHANGED = 0.');
      } else {
        const resolved =
          callerBySubAggregate.C5_UNEXPLAINED_UNCHANGED.resolveLooseBallControl;
        const total =
          c5Aggregate.C5_UNEXPLAINED_UNCHANGED;

        console.log(
          'UNCHANGED resolveLooseBallControl oranı: %' +
          ((resolved / total) * 100).toFixed(1),
        );
      }

      expect(totalC).toBeGreaterThanOrEqual(0);
    },
    10 * 60 * 1000,
  );
});
