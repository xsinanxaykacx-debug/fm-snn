import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('Live transition integration', () => {
  it('top kaybından sonra gerçek counter-press contest ve fiziksel recovery zincirini çalıştırır', () => {
    const data = generateGameData();
    const clubs = Object.values(data.clubs);

    let transitionTicks = 0;
    let counterPressAttempts = 0;
    let counterPressRecoveries = 0;
    let counterPressRollsPassed = 0;
    let counterPressTackleWins = 0;
    let counterPressTackleFailures = 0;
    let counterPressTackleFouls = 0;
    let counterPressCleanRecoveries = 0;
    let counterPressLooseBallRecoveries = 0;

    for (let i = 0; i < 2; i++) {
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

      let lastAttemptCount = 0;

      const match = simulateMatchLive(home, away, data.players, {
        seed: 1000 + i,
        maxTicks: 1000,
        onTick: (state) => {
          if (state.stats.counterPressAttempts > lastAttemptCount) {
            console.log(
              `  counterPress attempt #${state.stats.counterPressAttempts}: probability=${state.transition.counterPressProbability.toFixed(3)} quality=${state.transition.counterPressProbability > 0 ? state.transition.breakQuality.toFixed(3) : '0.000'}`
            );
            lastAttemptCount = state.stats.counterPressAttempts;
          }

          if (state.transition.counterPressClubId !== null) {
            transitionTicks++;
          }

          counterPressAttempts = Math.max(
            counterPressAttempts,
            state.stats.counterPressAttempts
          );
          counterPressRecoveries = Math.max(
            counterPressRecoveries,
            state.stats.counterPressRecoveries
          );
        },
      });

      counterPressRollsPassed += match.stats.counterPressRollsPassed;
      counterPressTackleWins += match.stats.counterPressTackleWins;
      counterPressTackleFailures += match.stats.counterPressTackleFailures;
      counterPressTackleFouls += match.stats.counterPressTackleFouls;
      counterPressCleanRecoveries += match.stats.counterPressCleanRecoveries;
      counterPressLooseBallRecoveries += match.stats.counterPressLooseBallRecoveries;

      console.log(
        `seed=${1000 + i} transitionTicks=${transitionTicks} attempts=${match.stats.counterPressAttempts} rollPassed=${match.stats.counterPressRollsPassed} tackleWon=${match.stats.counterPressTackleWins} tackleFailed=${match.stats.counterPressTackleFailures} fouls=${match.stats.counterPressTackleFouls} cleanRecovery=${match.stats.counterPressCleanRecoveries} looseRecovery=${match.stats.counterPressLooseBallRecoveries} recoveries=${match.stats.counterPressRecoveries}`
      );
    }

    console.log(
      `TOTAL attempts=${counterPressAttempts} rollPassed=${counterPressRollsPassed} tackleWon=${counterPressTackleWins} tackleFailed=${counterPressTackleFailures} fouls=${counterPressTackleFouls} cleanRecovery=${counterPressCleanRecoveries} looseRecovery=${counterPressLooseBallRecoveries} recoveries=${counterPressRecoveries}`
    );

    expect(transitionTicks).toBeGreaterThan(0);
    expect(counterPressAttempts).toBeGreaterThan(0);
    expect(counterPressRecoveries).toBeGreaterThan(0);
  }, 60_000);
});
