import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('Live transition measurement', () => {
  it(
    '25 bounded live simulations preserve the transition and counter-press chain',
    () => {
      const data = generateGameData();
      const clubs = Object.values(data.clubs);

      let matches = 0;
      let transitionStarts = 0;
      let counterPressAttempts = 0;
      let counterPressRollsPassed = 0;
      let counterPressTackleWins = 0;
      let counterPressRecoveries = 0;

      for (let i = 0; i < 25; i += 1) {
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
          seed: 1_000_000 + i,
          maxTicks: 1_000,
          onTick: (state) => {
            if (
              state.transition.counterPressClubId !== null &&
              state.transition.startedAt !== lastTransitionStartedAt
            ) {
              transitionStarts += 1;
              lastTransitionStartedAt = state.transition.startedAt;
            }
          },
        });

        matches += 1;
        counterPressAttempts += match.stats.counterPressAttempts;
        counterPressRollsPassed += match.stats.counterPressRollsPassed;
        counterPressTackleWins += match.stats.counterPressTackleWins;
        counterPressRecoveries += match.stats.counterPressRecoveries;
      }

      console.log(
        [
          'LIVE TRANSITION MEASUREMENT',
          `matches=${matches}`,
          `transitionStarts=${transitionStarts}`,
          `attempts=${counterPressAttempts}`,
          `rollPassed=${counterPressRollsPassed}`,
          `tackleWins=${counterPressTackleWins}`,
          `recoveries=${counterPressRecoveries}`,
        ].join(' ')
      );

      expect(matches).toBe(25);
      expect(transitionStarts).toBeGreaterThan(0);
      expect(counterPressAttempts).toBeGreaterThanOrEqual(0);
      expect(counterPressRollsPassed).toBeLessThanOrEqual(counterPressAttempts);
      expect(counterPressTackleWins).toBeLessThanOrEqual(counterPressRollsPassed);
      expect(counterPressRecoveries).toBeLessThanOrEqual(counterPressTackleWins);
    },
    120_000
  );
});
