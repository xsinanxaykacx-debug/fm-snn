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

    for (let i = 0; i < 10; i++) {
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

      simulateMatchLive(home, away, data.players, {
        seed: 1000 + i,
        onTick: (state) => {
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
    }

    expect(transitionTicks).toBeGreaterThan(0);
    expect(counterPressAttempts).toBeGreaterThan(0);
    expect(counterPressRecoveries).toBeGreaterThan(0);
  });
});
