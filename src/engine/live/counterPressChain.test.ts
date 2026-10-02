// src/engine/live/counterPressChain.test.ts
//
// Counter-press chain diagnostic testi — B (aggregate).
//
// Kullanım:
//   git pull --ff-only
//   $env:RUN_LIVE_DIAGNOSTIC="1"
//   npx vitest run src/engine/live/counterPressChain.test.ts
//
// Production koduna dokunmaz.

import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import type { Club, Player } from '../types';
import { simulateMatchLive } from './liveMatch';
import {
  CounterPressDiagnostic,
  type CounterPressStatsSnapshot,
} from './diagnostics/counterPressDiagnostic';

const SEEDS = [
  1000, 1001, 1002, 1003, 1004,
  1005, 1006, 1007, 1008, 1009,
];

const MAX_TICKS_PER_SEED = 12_000;

const RUN =
  typeof process !== 'undefined' &&
  process.env.RUN_LIVE_DIAGNOSTIC === '1';

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
      'Counter-press diagnostic için en az iki kulüp gerekli.',
    );
  }

  return {
    home: clubs[0],
    away: clubs[1],
  };
}

function addSnapshots(
  target: CounterPressStatsSnapshot,
  source: CounterPressStatsSnapshot,
): void {
  target.counterPressAttempts += source.counterPressAttempts;
  target.counterPressRollsPassed += source.counterPressRollsPassed;
  target.counterPressTackleWins += source.counterPressTackleWins;
  target.counterPressTackleFailures +=
    source.counterPressTackleFailures;
  target.counterPressTackleFouls += source.counterPressTackleFouls;
  target.counterPressRecoveries += source.counterPressRecoveries;
  target.counterPressCleanRecoveries +=
    source.counterPressCleanRecoveries;
  target.counterPressLooseBallRecoveries +=
    source.counterPressLooseBallRecoveries;

  target.counterPressTackleWinChanceSum +=
    source.counterPressTackleWinChanceSum;

  target.counterPressTackleWinChanceMin = Math.min(
    target.counterPressTackleWinChanceMin,
    source.counterPressTackleWinChanceMin,
  );

  target.counterPressTackleWinChanceMax = Math.max(
    target.counterPressTackleWinChanceMax,
    source.counterPressTackleWinChanceMax,
  );

  target.counterPressTackleRelativeSpeedSum +=
    source.counterPressTackleRelativeSpeedSum;
  target.counterPressTackleDistanceSum +=
    source.counterPressTackleDistanceSum;
}

function createAggregateSnapshot(): CounterPressStatsSnapshot {
  return {
    counterPressAttempts: 0,
    counterPressRollsPassed: 0,
    counterPressTackleWins: 0,
    counterPressTackleFailures: 0,
    counterPressTackleFouls: 0,
    counterPressRecoveries: 0,
    counterPressCleanRecoveries: 0,
    counterPressLooseBallRecoveries: 0,

    counterPressTackleWinChanceSum: 0,
    counterPressTackleWinChanceMin: Number.POSITIVE_INFINITY,
    counterPressTackleWinChanceMax: Number.NEGATIVE_INFINITY,
    counterPressTackleRelativeSpeedSum: 0,
    counterPressTackleDistanceSum: 0,
  };
}

describe.skipIf(!RUN)('counter-press chain diagnostic', () => {
  it(
    `runs ${SEEDS.length} seeds x ${MAX_TICKS_PER_SEED} ticks`,
    () => {
      const baseline = generateGameData();
      const aggregate = createAggregateSnapshot();
      let totalResolved = 0;
      let totalWonOutcomes = 0;
      let totalFailedOutcomes = 0;
      let totalFoulOutcomes = 0;

      for (const seed of SEEDS) {
        const data = cloneData(baseline);
        resetPlayers(data.players);

        const { home, away } = getFixture(data);
        const diagnostic = new CounterPressDiagnostic();

        simulateMatchLive(
          home,
          away,
          data.players,
          {
            seed,
            maxTicks: MAX_TICKS_PER_SEED,
            onTick: state => diagnostic.onTick(state),
            onTackleResolved: outcome =>
              diagnostic.onTackleResolved(outcome),
          },
        );

        const report = diagnostic.report();

        addSnapshots(aggregate, report.final);
        totalResolved += report.tackleOutcomes.length;
        totalWonOutcomes += report.tackleOutcomes.filter(
          outcome => outcome.type === 'won',
        ).length;
        totalFailedOutcomes += report.tackleOutcomes.filter(
          outcome => outcome.type === 'failed',
        ).length;
        totalFoulOutcomes += report.tackleOutcomes.filter(
          outcome => outcome.type === 'foul',
        ).length;
      }

      console.log('');
      console.log('=== AGGREGATE ACROSS 10 SEEDS ===');
      console.table({
        attempts: aggregate.counterPressAttempts,
        rollsPassed: aggregate.counterPressRollsPassed,
        tackleWins: aggregate.counterPressTackleWins,
        tackleFailures: aggregate.counterPressTackleFailures,
        tackleFouls: aggregate.counterPressTackleFouls,
        recoveries: aggregate.counterPressRecoveries,
        cleanRecoveries: aggregate.counterPressCleanRecoveries,
        looseBallRecoveries:
          aggregate.counterPressLooseBallRecoveries,
        resolvedOutcomes: totalResolved,
      });

      if (totalResolved > 0) {
        console.log(
          '=== AGGREGATE DEBUG (resolved tackle başına) ===',
        );
        console.table({
          winChanceAvg:
            aggregate.counterPressTackleWinChanceSum /
            totalResolved,
          winChanceMin:
            aggregate.counterPressTackleWinChanceMin,
          winChanceMax:
            aggregate.counterPressTackleWinChanceMax,
          relativeSpeedAvg:
            aggregate.counterPressTackleRelativeSpeedSum /
            totalResolved,
          distanceAvg:
            aggregate.counterPressTackleDistanceSum /
            totalResolved,
        });
      }

      console.log('=== AGGREGATE OUTCOMES ===');
      console.table({
        won: totalWonOutcomes,
        failed: totalFailedOutcomes,
        foul: totalFoulOutcomes,
      });

      console.log('=== AGGREGATE KARAR NOKTASI ===');

      if (aggregate.counterPressAttempts === 0) {
        console.log(
          'A) Attempt = 0 → test/oyun koşulu problemi',
        );
      } else if (aggregate.counterPressRollsPassed === 0) {
        console.log(
          'B) Attempt > 0, rollPassed = 0 → probability zinciri',
        );
      } else if (aggregate.counterPressTackleWins === 0) {
        console.log(
          'C) rollPassed > 0, tackleWins = 0 → resolveTackle/winChance',
        );
      } else if (aggregate.counterPressRecoveries === 0) {
        console.log(
          'D) tackleWins > 0, recoveries = 0 → applyTackleWon/knock',
        );
      } else {
        console.log(
          'Zincir tutarlı: attempt → roll → tackleWin → recovery',
        );
      }

      expect(aggregate.counterPressAttempts).toBeGreaterThanOrEqual(0);
    },
    10 * 60 * 1000,
  );
});
