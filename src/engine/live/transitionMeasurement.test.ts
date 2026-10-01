import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('Live transition measurement', () => {
  it('500 bounded maçta counter-press zincirinin gerçek oranlarını ölçer', () => {
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

    // Measurement-only telemetry: production stats/state remain untouched.
    let looseBallAfterTackleWins = 0;
    let looseBallRecoveredBySameClub = 0;
    let looseBallRecoveredByOpponent = 0;
    let looseBallUnresolved = 0;
    let delayedCounterPressRunnerRecoveries = 0;

    for (let i = 0; i < 500; i++) {
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
      let observedTackleWins = 0;
      let pendingLooseTackle: {
        clubId: string;
        playerId: string | null;
        expiresAt: number;
      } | null = null;

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

          // First resolve any previously observed loose-ball tackle win.
          if (pendingLooseTackle !== null) {
            const ownerId = state.ball.ownerId;

            if (ownerId !== null) {
              const owner = state.players[ownerId];

              if (owner) {
                if (owner.clubId === pendingLooseTackle.clubId) {
                  looseBallRecoveredBySameClub += 1;
                  if (owner.player.id === pendingLooseTackle.playerId) {
                    delayedCounterPressRunnerRecoveries += 1;
                  }
                } else {
                  looseBallRecoveredByOpponent += 1;
                }
                pendingLooseTackle = null;
              }
            } else if (state.time >= pendingLooseTackle.expiresAt) {
              looseBallUnresolved += 1;
              pendingLooseTackle = null;
            }
          }

          // Detect tackle wins independently from the production recovery counters.
          if (state.stats.counterPressTackleWins > observedTackleWins) {
            const newWins = state.stats.counterPressTackleWins - observedTackleWins;
            observedTackleWins = state.stats.counterPressTackleWins;

            for (let win = 0; win < newWins; win += 1) {
              if (state.ball.ownerId !== null) continue;

              looseBallAfterTackleWins += 1;
              pendingLooseTackle = {
                clubId: state.transition.counterPressClubId ?? '',
                playerId: state.transition.counterPressPlayerId,
                expiresAt: state.time + 6,
              };
            }
          }
        },
      });

      if (pendingLooseTackle !== null) {
        looseBallUnresolved += 1;
        pendingLooseTackle = null;
      }

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
    console.log('looseBallAfterTackleWins=' + looseBallAfterTackleWins);
    console.log('looseBallRecoveredBySameClub=' + looseBallRecoveredBySameClub);
    console.log('looseBallRecoveredByOpponent=' + looseBallRecoveredByOpponent);
    console.log('delayedCounterPressRunnerRecoveries=' + delayedCounterPressRunnerRecoveries);
    console.log('looseBallUnresolved=' + looseBallUnresolved);
    console.log('rollPassRate=' + (rollPassRate * 100).toFixed(2) + '%');
    console.log('tackleWinRateAfterRoll=' + (tackleWinRate * 100).toFixed(2) + '%');
    console.log('recoveryRatePerAttempt=' + (recoveryRate * 100).toFixed(2) + '%');
    console.log('tackleDiagnosticSamples=' + tackleDiagnosticSamples);
    console.log('avgTackleWinChance=' + (avgTackleWinChance * 100).toFixed(2) + '%');
    console.log('minTackleWinChance=' + (tackleWinChanceMin * 100).toFixed(2) + '%');
    console.log('maxTackleWinChance=' + (tackleWinChanceMax * 100).toFixed(2) + '%');
    console.log('avgTackleRelativeSpeed=' + avgTackleRelativeSpeed.toFixed(3));
    console.log('avgTackleDistance=' + avgTackleDistance.toFixed(3));

    expect(matches).toBe(500);
    expect(transitionStarts).toBeGreaterThan(0);
    expect(counterPressAttempts).toBeGreaterThan(0);
  }, 600_000);
});
