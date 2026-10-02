// src/engine/live/categoryCResolution.test.ts
//
// DIAGNOSTIC ONLY — C-transition v4.
// Production dosyalarına dokunulmaz.
//
// Kullanım:
//   git pull --ff-only
//   $env:RUN_LIVE_DIAGNOSTIC="1"
//   npx vitest run src/engine/live/categoryCResolution.test.ts

import { describe, expect, it, vi } from 'vitest';

vi.mock('./ball', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ball')>();
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
      return actual.controlBall(ball, ownerId, clubId);
    },
  };
});

import { generateGameData } from '../data/generateData';
import type { Club, Player } from '../types';
import { simulateMatchLive } from './liveMatch';
import {
  CTransitionDiagnosticV4,
  DEFAULT_MAX_TICKS,
} from './diagnostics/cTransitionDiagnosticV4';
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

  return { home: clubs[0], away: clubs[1] };
}

describe.skipIf(!RUN)('C-transition diagnostic v4', () => {
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

      const setPieceAggregate: Record<string, number> = {};
      let totalC = 0;

      for (const seed of SEEDS) {
        traceBuffer.clear();

        const data = cloneData(baseline);
        resetPlayers(data.players);
        const { home, away } = getFixture(data);

        const diagnostic =
          new CTransitionDiagnosticV4(
            traceBuffer,
            MAX_TICKS_PER_SEED,
          );

        simulateMatchLive(home, away, data.players, {
          seed,
          maxTicks: MAX_TICKS_PER_SEED,
          onTackleResolved: outcome => {
            diagnostic.onTackleResolved(outcome);
          },
          onTick: state => {
            diagnostic.onTick(state);
          },
        });

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

        for (const [type, count] of Object.entries(report.setPieceMutationTypes)) {
          setPieceAggregate[type] = (setPieceAggregate[type] ?? 0) + count;
        }
      }

      console.log('');
      console.log('=== AGGREGATE ACROSS 10 SEEDS ===');
      console.log('total C transitions: ' + totalC);
      console.table(aggregate);

      console.log('=== AGGREGATE C5 LIFECYCLE (rapor; karar kanıtı değil) ===');
      console.table(c5Aggregate);

      console.log('=== AGGREGATE CONTROL-BALL CALLER ===');
      console.table(callerAggregate);

      console.log('=== AGGREGATE updateSetPieceStatus × T-1 setPieceType ===');
      console.table(setPieceAggregate);

      console.log('=== KARAR NOKTASI ===');
      console.log(
        'Mutation trace birincil kanıt. Geometri yalnızca yardımcı bilgi.',
      );
      console.log(
        'Final C5: ' + aggregate.C5_unexplained,
      );

      expect(totalC).toBeGreaterThanOrEqual(0);
    },
    10 * 60 * 1000,
  );
});
