import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

const BATCH_COUNT = 5;
const MATCHES_PER_BATCH = 500;
const MAX_TICKS = 1_000;
const TOTAL_MATCHES = BATCH_COUNT * MATCHES_PER_BATCH;

interface BatchMetrics {
  batch: number;
  matches: number;
  transitionStarts: number;
  transitionStartsPerMatch: number;
  transitionProbabilityMean: number;
  counterPressAttempts: number;
  attemptsPerMatch: number;
  rollPassed: number;
  rollPassRate: number;
  tackleWins: number;
  tackleWinRateAfterRoll: number;
  tackleFailures: number;
  tackleFouls: number;
  cleanRecoveries: number;
  looseBallRecoveries: number;
  recoveries: number;
  recoveryRatePerAttempt: number;
  recoveryRateAfterTackleWin: number;
  avgTackleWinChance: number;
  avgTackleRelativeSpeed: number;
  avgTackleDistance: number;
}

function sampleStdDev(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const squaredDiffSum = values.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0
  );

  return Math.sqrt(squaredDiffSum / (values.length - 1));
}

function coefficientOfVariation(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return 0;
  return sampleStdDev(values) / mean;
}

function resetPlayers(data: ReturnType<typeof generateGameData>): void {
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

function runBatch(
  batchNumber: number,
  data: ReturnType<typeof generateGameData>
): BatchMetrics {
  const clubs = Object.values(data.clubs);

  let transitionStarts = 0;
  let transitionProbabilitySum = 0;
  let counterPressAttempts = 0;
  let counterPressRollsPassed = 0;
  let counterPressTackleWins = 0;
  let counterPressTackleFailures = 0;
  let counterPressTackleFouls = 0;
  let counterPressCleanRecoveries = 0;
  let counterPressLooseBallRecoveries = 0;
  let counterPressRecoveries = 0;
  let tackleWinChanceSum = 0;
  let tackleRelativeSpeedSum = 0;
  let tackleDistanceSum = 0;
  let tackleDiagnosticSamples = 0;

  for (let i = 0; i < MATCHES_PER_BATCH; i += 1) {
    const home = clubs[i % clubs.length];
    const away = clubs[(i + 1) % clubs.length];

    resetPlayers(data);

    let lastTransitionStartedAt = -1;

    const match = simulateMatchLive(home, away, data.players, {
      seed: 1_000_000 + batchNumber * MATCHES_PER_BATCH + i,
      maxTicks: MAX_TICKS,
      onTick: (state) => {
        if (
          state.transition.counterPressClubId !== null &&
          state.transition.startedAt !== lastTransitionStartedAt
        ) {
          transitionStarts += 1;
          transitionProbabilitySum +=
            state.transition.counterPressProbability;
          lastTransitionStartedAt = state.transition.startedAt;
        }
      },
    });

    counterPressAttempts += match.stats.counterPressAttempts;
    counterPressRollsPassed += match.stats.counterPressRollsPassed;
    counterPressTackleWins += match.stats.counterPressTackleWins;
    counterPressTackleFailures += match.stats.counterPressTackleFailures;
    counterPressTackleFouls += match.stats.counterPressTackleFouls;
    counterPressCleanRecoveries += match.stats.counterPressCleanRecoveries;
    counterPressLooseBallRecoveries +=
      match.stats.counterPressLooseBallRecoveries;
    counterPressRecoveries += match.stats.counterPressRecoveries;
    tackleWinChanceSum += match.stats.counterPressTackleWinChanceSum;
    tackleRelativeSpeedSum +=
      match.stats.counterPressTackleRelativeSpeedSum;
    tackleDistanceSum += match.stats.counterPressTackleDistanceSum;
    tackleDiagnosticSamples += match.stats.counterPressRollsPassed;
  }

  const transitionStartsPerMatch =
    transitionStarts / MATCHES_PER_BATCH;
  const attemptsPerMatch =
    counterPressAttempts / MATCHES_PER_BATCH;
  const transitionProbabilityMean =
    transitionStarts > 0
      ? transitionProbabilitySum / transitionStarts
      : 0;
  const rollPassRate =
    counterPressAttempts > 0
      ? counterPressRollsPassed / counterPressAttempts
      : 0;
  const tackleWinRateAfterRoll =
    counterPressRollsPassed > 0
      ? counterPressTackleWins / counterPressRollsPassed
      : 0;
  const recoveryRatePerAttempt =
    counterPressAttempts > 0
      ? counterPressRecoveries / counterPressAttempts
      : 0;
  const recoveryRateAfterTackleWin =
    counterPressTackleWins > 0
      ? counterPressRecoveries / counterPressTackleWins
      : 0;

  return {
    batch: batchNumber + 1,
    matches: MATCHES_PER_BATCH,
    transitionStarts,
    transitionStartsPerMatch,
    transitionProbabilityMean,
    counterPressAttempts,
    attemptsPerMatch,
    rollPassed: counterPressRollsPassed,
    rollPassRate,
    tackleWins: counterPressTackleWins,
    tackleWinRateAfterRoll,
    tackleFailures: counterPressTackleFailures,
    tackleFouls: counterPressTackleFouls,
    cleanRecoveries: counterPressCleanRecoveries,
    looseBallRecoveries: counterPressLooseBallRecoveries,
    recoveries: counterPressRecoveries,
    recoveryRatePerAttempt,
    recoveryRateAfterTackleWin,
    avgTackleWinChance:
      tackleDiagnosticSamples > 0
        ? tackleWinChanceSum / tackleDiagnosticSamples
        : 0,
    avgTackleRelativeSpeed:
      tackleDiagnosticSamples > 0
        ? tackleRelativeSpeedSum / tackleDiagnosticSamples
        : 0,
    avgTackleDistance:
      tackleDiagnosticSamples > 0
        ? tackleDistanceSum / tackleDiagnosticSamples
        : 0,
  };
}

describe('Live transition batch measurement', () => {
  it(
    '5 x 500 gerçek maç ile baseline istatistiksel stabilitesini ölçer',
    () => {
      const data = generateGameData();
      const batches: BatchMetrics[] = [];

      for (let batch = 0; batch < BATCH_COUNT; batch += 1) {
        const metrics = runBatch(batch, data);
        batches.push(metrics);

        console.log(
          [
            'BATCH',
            metrics.batch,
            `matches=${metrics.matches}`,
            `transitionStartsPerMatch=${metrics.transitionStartsPerMatch.toFixed(4)}`,
            `attemptsPerMatch=${metrics.attemptsPerMatch.toFixed(4)}`,
            `rollPassRate=${(metrics.rollPassRate * 100).toFixed(2)}%`,
            `tackleWinRate=${(metrics.tackleWinRateAfterRoll * 100).toFixed(2)}%`,
            `recoveryRate=${(metrics.recoveryRatePerAttempt * 100).toFixed(2)}%`,
            `avgProbability=${metrics.transitionProbabilityMean.toFixed(4)}`,
            `avgRelativeSpeed=${metrics.avgTackleRelativeSpeed.toFixed(3)}`,
            `avgDistance=${metrics.avgTackleDistance.toFixed(3)}`,
          ].join(' ')
        );
      }

      const metricDefinitions: Array<{
        name: string;
        values: number[];
      }> = [
        {
          name: 'transitionStartsPerMatch',
          values: batches.map((batch) => batch.transitionStartsPerMatch),
        },
        {
          name: 'transitionProbabilityMean',
          values: batches.map((batch) => batch.transitionProbabilityMean),
        },
        {
          name: 'attemptsPerMatch',
          values: batches.map((batch) => batch.attemptsPerMatch),
        },
        {
          name: 'rollPassRate',
          values: batches.map((batch) => batch.rollPassRate),
        },
        {
          name: 'tackleWinRateAfterRoll',
          values: batches.map((batch) => batch.tackleWinRateAfterRoll),
        },
        {
          name: 'recoveryRatePerAttempt',
          values: batches.map((batch) => batch.recoveryRatePerAttempt),
        },
        {
          name: 'recoveryRateAfterTackleWin',
          values: batches.map((batch) => batch.recoveryRateAfterTackleWin),
        },
        {
          name: 'avgTackleWinChance',
          values: batches.map((batch) => batch.avgTackleWinChance),
        },
        {
          name: 'avgTackleRelativeSpeed',
          values: batches.map((batch) => batch.avgTackleRelativeSpeed),
        },
        {
          name: 'avgTackleDistance',
          values: batches.map((batch) => batch.avgTackleDistance),
        },
      ];

      console.log('');
      console.log('=== LIVE TRANSITION BATCH STABILITY ===');
      console.log(
        `batches=${BATCH_COUNT} matchesPerBatch=${MATCHES_PER_BATCH} totalMatches=${TOTAL_MATCHES}`
      );
      console.log('');

      for (const metric of metricDefinitions) {
        const mean =
          metric.values.reduce((sum, value) => sum + value, 0) /
          metric.values.length;
        const stdDev = sampleStdDev(metric.values);
        const cv = coefficientOfVariation(metric.values);
        const min = Math.min(...metric.values);
        const max = Math.max(...metric.values);

        console.log(
          [
            metric.name,
            `mean=${mean.toFixed(6)}`,
            `stdDev=${stdDev.toFixed(6)}`,
            `cv=${(cv * 100).toFixed(2)}%`,
            `min=${min.toFixed(6)}`,
            `max=${max.toFixed(6)}`,
            `range=${(max - min).toFixed(6)}`,
          ].join(' ')
        );
      }

      console.log('');
      console.log('=== CUMULATIVE CONVERGENCE ===');

      for (const metric of metricDefinitions) {
        const cumulativeMeans: string[] = [];

        for (let i = 0; i < metric.values.length; i += 1) {
          const values = metric.values.slice(0, i + 1);
          const cumulativeMean =
            values.reduce((sum, value) => sum + value, 0) /
            values.length;

          cumulativeMeans.push(cumulativeMean.toFixed(6));
        }

        console.log(
          `${metric.name} cumulativeMean=[${cumulativeMeans.join(', ')}]`
        );
      }

      const totalMatches = batches.reduce(
        (sum, batch) => sum + batch.matches,
        0
      );
      const totalAttempts = batches.reduce(
        (sum, batch) => sum + batch.counterPressAttempts,
        0
      );

      expect(totalMatches).toBe(TOTAL_MATCHES);
      expect(totalAttempts).toBeGreaterThan(0);
      expect(
        batches.every((batch) => batch.counterPressAttempts > 0)
      ).toBe(true);
    },
    900_000
  );
});
