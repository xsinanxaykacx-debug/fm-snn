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

    expect(matches).toBe(100);
    expect(transitionStarts).toBeGreaterThan(0);
    expect(counterPressAttempts).toBeGreaterThan(0);
  }, 120_000);
});
