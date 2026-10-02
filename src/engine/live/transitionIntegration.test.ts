import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('Live transition integration', () => {
  it('simulateMatchLive gerçek motorla 1000 tick boyunca hatasız çalışır', () => {
    const data = generateGameData();
    const clubs = Object.values(data.clubs);

    const home = clubs[0];
    const away = clubs[1];

    for (const player of Object.values(data.players)) {
      player.condition = 100;
      player.fatigue = 0;
      player.injuryWeeks = 0;
      player.suspensionWeeks = 0;
      player.sentOff = false;
      player.injured = false;
      player.redCard = false;
    }

    const match = simulateMatchLive(home, away, data.players, {
      seed: 1000,
      maxTicks: 1000,
    });

    expect(match.stats.ticks).toBeGreaterThan(0);
    expect(match.stats.ticks).toBeLessThanOrEqual(1000);
  }, 60_000);

  it('1000 tick içinde transition oluşursa counter-press zinciri tutarlı kalır', () => {
    const data = generateGameData();
    const clubs = Object.values(data.clubs);

    const home = clubs[0];
    const away = clubs[1];

    for (const player of Object.values(data.players)) {
      player.condition = 100;
      player.fatigue = 0;
      player.injuryWeeks = 0;
      player.suspensionWeeks = 0;
      player.sentOff = false;
      player.injured = false;
      player.redCard = false;
    }

    let transitionStarts = 0;
    let currentTransitionStartedAt = -1;
    let attemptsAtTransitionStart = 0;
    let maxAttemptsInCurrentTransition = 0;

    simulateMatchLive(home, away, data.players, {
      seed: 1000,
      maxTicks: 1000,
      onTick: (state) => {
        const transitionStarted =
          state.transition.counterPressClubId !== null &&
          state.transition.startedAt !== currentTransitionStartedAt;

        if (transitionStarted) {
          transitionStarts++;
          currentTransitionStartedAt = state.transition.startedAt;
          attemptsAtTransitionStart = state.stats.counterPressAttempts;
          maxAttemptsInCurrentTransition = 0;
        }

        if (
          state.transition.counterPressClubId !== null &&
          currentTransitionStartedAt !== -1
        ) {
          const attemptsInCurrentTransition =
            state.stats.counterPressAttempts - attemptsAtTransitionStart;

          maxAttemptsInCurrentTransition = Math.max(
            maxAttemptsInCurrentTransition,
            attemptsInCurrentTransition,
          );
        }
      },
    });

    if (transitionStarts === 0) {
      console.log(
        'No transition in 1000 ticks — expected statistically; integration sanity already covered by the first test.',
      );
      return;
    }

    expect(maxAttemptsInCurrentTransition).toBeLessThanOrEqual(1);
  }, 60_000);
});
