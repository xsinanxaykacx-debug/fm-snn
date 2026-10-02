// src/engine/live/categoryCResolution.test.ts
//
// DIAGNOSTIC ONLY.
//
// Kullanım:
//   git pull
//   $env:RUN_LIVE_DIAGNOSTIC="1"
//   npx vitest run src/engine/live/categoryCResolution.test.ts
//
// Production dosyalarına dokunmaz.

import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

import {
  CTransitionDiagnostic,
  DEFAULT_MAX_TICKS,
  type CClass,
  type C5SubClassification,
} from './diagnostics/cTransitionDiagnostic';

import type {
  Club,
  Player,
} from '../types';

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

describe.skipIf(!RUN)('C-transition diagnostic', () => {
  it(
    'runs ' + SEEDS.length + ' seeds x ' + MAX_TICKS_PER_SEED + ' ticks',
    () => {
      // generateGameData() kendi içinde Math.random() kullandığı için
      // baseline yalnızca bir kez üretilir. Her seed bağımsız clone ile
      // başlar; önceki determinism diagnostic sözleşmesiyle aynıdır.
      const baseline = generateGameData();

      const aggregate: Record<CClass, number> = {
        C1_loose_ball_resolver: 0,
        C2_boundary_set_piece: 0,
        C3_direct_action_resolution: 0,
        C4_kickoff: 0,
        C5_unexplained: 0,
      };

      let totalC = 0;

      const c5SubAggregate: Record<C5SubClassification, number> = {
        LIKELY_LOOSE_BALL: 0,
        C5_UNEXPLAINED_UNCHANGED: 0,
        C5_UNEXPLAINED_CHANGED: 0,
        C5_UNEXPLAINED_LOST: 0,
      };

      let c5UpperBoundWithinRadius = 0;
      let c5UpperBoundOutsideRadius = 0;

      for (const seed of SEEDS) {
        const data = cloneData(baseline);
        resetPlayers(data.players);

        const { home, away } = getFixture(data);

        const diagnostic =
          new CTransitionDiagnostic(MAX_TICKS_PER_SEED);

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

        for (const key of Object.keys(aggregate) as CClass[]) {
          aggregate[key] += report.dist[key];
        }

        for (const key of Object.keys(c5SubAggregate) as C5SubClassification[]) {
          c5SubAggregate[key] += report.c5SubDist[key];
        }

        c5UpperBoundWithinRadius +=
          report.c5DistanceStats.withinRadiusByUpperBound;
        c5UpperBoundOutsideRadius +=
          report.c5DistanceStats.outsideRadiusByUpperBound;
      }

      console.log('');
      console.log('=== AGGREGATE ACROSS 10 SEEDS ===');
      console.log('total C transitions: ' + totalC);
      console.table(aggregate);

      console.log('=== AGGREGATE C5 SUBCLASSIFICATION ===');
      console.table(c5SubAggregate);
      console.log(
        'C5 upperBound<=ballControlRadius: ' +
        c5UpperBoundWithinRadius +
        ' | >radius: ' +
        c5UpperBoundOutsideRadius,
      );

      const c5 = aggregate.C5_unexplained;

      console.log('');
      console.log('=== KARAR NOKTASI ===');

      if (c5 === 0) {
        console.log(
          'C5 = 0: gözlenen C geçişlerinin tamamı mevcut lifecycle kanıtlarıyla açıklandı.',
        );
      } else {
        console.log(
          'C5 = ' + c5 +
          ': production patch YOK. C5 örnekleri T-1/T/T+1 lifecycle diagnostic gerektiriyor.',
        );
      }

      expect(totalC).toBeGreaterThanOrEqual(0);
    },
    10 * 60 * 1000,
  );
});
