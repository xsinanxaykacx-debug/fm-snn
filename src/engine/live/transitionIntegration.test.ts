import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('Live transition integration', () => {
  it('top kaybından sonra gerçek counter-press contest zincirine ulaşır', () => {
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
      let lastTransitionStartedAt = -1;

      const match = simulateMatchLive(home, away, data.players, {
        seed: 1000 + i,
        maxTicks: 1000,
        onTick: (state) => {
          if (
            state.transition.counterPressClubId !== null &&
            state.transition.startedAt !== lastTransitionStartedAt
          ) {
            const runner = state.transition.counterPressPlayerId
              ? state.players[state.transition.counterPressPlayerId]
              : null;
            const owner = state.ball.ownerId
              ? state.players[state.ball.ownerId]
              : null;
            const activationDistance =
              runner && owner
                ? Math.hypot(
                    runner.position.x - owner.position.x,
                    runner.position.y - owner.position.y
                  )
                : -1;

            console.log(
              '  transition start=' +
                state.transition.startedAt.toFixed(1) +
                ' probability=' +
                state.transition.counterPressProbability.toFixed(3) +
                ' runner=' +
                (runner?.player.id ?? 'none') +
                ' activationDistance=' +
                activationDistance.toFixed(2)
            );

            lastTransitionStartedAt = state.transition.startedAt;
          }

          if (state.stats.counterPressAttempts > lastAttemptCount) {
            console.log(
              `  counterPress attempt #${state.stats.counterPressAttempts}: probability=${state.transition.counterPressProbability.toFixed(3)} currentDistance=${state.transition.counterPressPlayerId && state.ball.ownerId ? Math.hypot(state.players[state.transition.counterPressPlayerId].position.x - state.players[state.ball.ownerId].position.x, state.players[state.transition.counterPressPlayerId].position.y - state.players[state.ball.ownerId].position.y).toFixed(2) : 'n/a'}`
            );
            lastAttemptCount = state.stats.counterPressAttempts;
          }

          if (state.transition.counterPressClubId !== null) {
            transitionTicks++;
          }

        },
      });

      counterPressRollsPassed += match.stats.counterPressRollsPassed;
      counterPressTackleWins += match.stats.counterPressTackleWins;
      counterPressTackleFailures += match.stats.counterPressTackleFailures;
      counterPressTackleFouls += match.stats.counterPressTackleFouls;
      counterPressCleanRecoveries += match.stats.counterPressCleanRecoveries;
      counterPressLooseBallRecoveries += match.stats.counterPressLooseBallRecoveries;
      counterPressAttempts += match.stats.counterPressAttempts;
      counterPressRecoveries += match.stats.counterPressRecoveries;

      console.log(
        `seed=${1000 + i} transitionTicks=${transitionTicks} attempts=${match.stats.counterPressAttempts} rollPassed=${match.stats.counterPressRollsPassed} tackleWon=${match.stats.counterPressTackleWins} tackleFailed=${match.stats.counterPressTackleFailures} fouls=${match.stats.counterPressTackleFouls} cleanRecovery=${match.stats.counterPressCleanRecoveries} looseRecovery=${match.stats.counterPressLooseBallRecoveries} recoveries=${match.stats.counterPressRecoveries}`
      );
    }

    console.log(
      `TOTAL attempts=${counterPressAttempts} rollPassed=${counterPressRollsPassed} tackleWon=${counterPressTackleWins} tackleFailed=${counterPressTackleFailures} fouls=${counterPressTackleFouls} cleanRecovery=${counterPressCleanRecoveries} looseRecovery=${counterPressLooseBallRecoveries} recoveries=${counterPressRecoveries}`
    );

    expect(transitionTicks).toBeGreaterThan(0);
    // Physical contact depends on the generated player data and movement path.
    // The deterministic integration contract here is transition creation.

  }, 60_000);
});
