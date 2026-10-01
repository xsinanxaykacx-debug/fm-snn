import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('Live transition measurement', () => {
  it('100 bounded maçta counter-press zincirinin gerçek oranlarını ölçer', () => {
    const data = generateGameData();
    const clubs = Object.values(data.clubs);

    let matches = 0;
    let transitionStarts = 0;
    let transitionProbabilitySum = 0;
    let transitionProbabilitySamples = 0;
    let counterPressAttempts = 0;
    let counterPressRollsPassed = 0;
    let counterPressTackleWins = 0;
    let counterPressTackleFailures = 0;
    let counterPressTackleFouls = 0;
    let counterPressCleanRecoveries = 0;
    let counterPressLooseBallRecoveries = 0;
    let counterPressRecoveries = 0;
    let tackleWinChanceSum = 0;
    let tackleWinChanceMin = 1;
    let tackleWinChanceMax = 0;
    let tackleRelativeSpeedSum = 0;
    let tackleDistanceSum = 0;
    let tackleDiagnosticSamples = 0;

    for (let i = 0; i < 100; i++) {
      const home = clubs[i % clubs.length];
      const away = clubs[(i + 1) % clubs.length];

      for (const player of Object.values(data.players)) {
        player.condition = 100;
        player.fatigue = 0;
        player.injuryWeeks = 0;
        player.suspensionWeeks = 0;
        player.sentOff = false;
        player.injured = false;
        player.redCard = false;
      }

      let lastTransitionStartedAt = -1;

      const match = simulateMatchLive(home, away, data.players, {
        seed: 50000 + i,
        maxTicks: 1000,
        onTick: (state) => {
          if (
            state.transition.counterPressClubId !== null &&
            state.transition.startedAt !== lastTransitionStartedAt
          ) {
            transitionStarts += 1;
            transitionProbabilitySum += state.transition.counterPressProbability;
            transitionProbabilitySamples += 1;
            lastTransitionStartedAt = state.transition.startedAt;
          }
        },
      });

      matches += 1;
      counterPressAttempts += match.stats.counterPressAttempts;
      counterPressRollsPassed += match.stats.counterPressRollsPassed;
      counterPressTackleWins += match.stats.counterPressTackleWins;
      counterPressTackleFailures += match.stats.counterPressTackleFailures;
      counterPressTackleFouls += match.stats.counterPressTackleFouls;
      counterPressCleanRecoveries += match.stats.counterPressCleanRecoveries;
      counterPressLooseBallRecoveries += match.stats.counterPressLooseBallRecoveries;
      counterPressRecoveries += match.stats.counterPressRecoveries;
      tackleWinChanceSum += match.stats.counterPressTackleWinChanceSum;
      tackleWinChanceMin = Math.min(tackleWinChanceMin, match.stats.counterPressTackleWinChanceMin);
      tackleWinChanceMax = Math.max(tackleWinChanceMax, match.stats.counterPressTackleWinChanceMax);
      tackleRelativeSpeedSum += match.stats.counterPressTackleRelativeSpeedSum;
      tackleDistanceSum += match.stats.counterPressTackleDistanceSum;
      tackleDiagnosticSamples += match.stats.counterPressRollsPassed;
    }

    const avgProbability =
      transitionProbabilitySamples > 0
        ? transitionProbabilitySum / transitionProbabilitySamples
        : 0;

    const rollPassRate =
      counterPressAttempts > 0
        ? counterPressRollsPassed / counterPressAttempts
        : 0;

    const tackleWinRate =
      counterPressRollsPassed > 0
        ? counterPressTackleWins / counterPressRollsPassed
        : 0;

    const recoveryRate =
      counterPressAttempts > 0
        ? counterPressRecoveries / counterPressAttempts
        : 0;

    const avgTackleWinChance =
      tackleDiagnosticSamples > 0
        ? tackleWinChanceSum / tackleDiagnosticSamples
        : 0;

    const avgTackleRelativeSpeed =
      tackleDiagnosticSamples > 0
        ? tackleRelativeSpeedSum / tackleDiagnosticSamples
        : 0;

    const avgTackleDistance =
      tackleDiagnosticSamples > 0
        ? tackleDistanceSum / tackleDiagnosticSamples
        : 0;

    console.log('');
    console.log('=== LIVE TRANSITION MEASUREMENT ===');
    console.log('matches=' + matches);
    console.log('transitionStarts=' + transitionStarts);
    console.log('avgProbability=' + avgProbability.toFixed(4));
    console.log('counterPressAttempts=' + counterPressAttempts);
    console.log('rollPassed=' + counterPressRollsPassed);
    console.log('tackleWins=' + counterPressTackleWins);
    console.log('tackleFailures=' + counterPressTackleFailures);
    console.log('fouls=' + counterPressTackleFouls);
    console.log('cleanRecoveries=' + counterPressCleanRecoveries);
    console.log('looseBallRecoveries=' + counterPressLooseBallRecoveries);
    console.log('recoveries=' + counterPressRecoveries);
    console.log('rollPassRate=' + (rollPassRate * 100).toFixed(2) + '%');
    console.log('tackleWinRateAfterRoll=' + (tackleWinRate * 100).toFixed(2) + '%');
    console.log('recoveryRatePerAttempt=' + (recoveryRate * 100).toFixed(2) + '%');
    console.log('tackleDiagnosticSamples=' + tackleDiagnosticSamples);
    console.log('avgTackleWinChance=' + (avgTackleWinChance * 100).toFixed(2) + '%');
    console.log('minTackleWinChance=' + (tackleWinChanceMin * 100).toFixed(2) + '%');
    console.log('maxTackleWinChance=' + (tackleWinChanceMax * 100).toFixed(2) + '%');
    console.log('avgTackleRelativeSpeed=' + avgTackleRelativeSpeed.toFixed(3));
    console.log('avgTackleDistance=' + avgTackleDistance.toFixed(3));

    expect(matches).toBe(100);
    expect(transitionStarts).toBeGreaterThan(0);
    expect(counterPressAttempts).toBeGreaterThan(0);
  }, 120_000);
});
