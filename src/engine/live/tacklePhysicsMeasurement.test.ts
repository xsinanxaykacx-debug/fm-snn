import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';
import { calculateClosingSpeed } from './tackle';

describe('Tackle physics measurement', () => {
  it('transition tackle penceresinde closing speed ile ham relative speed farkını ölçer', () => {
    const data = generateGameData();
    const clubs = Object.values(data.clubs);

    let samples = 0;
    let relativeSpeedSum = 0;
    let closingSpeedSum = 0;
    let positiveClosingSamples = 0;
    let negativeClosingSamples = 0;
    let nearZeroClosingSamples = 0;

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

      simulateMatchLive(home, away, data.players, {
        seed: 70000 + i,
        maxTicks: 1000,
        onTick: (state) => {
          const tacklerId = state.transition.counterPressPlayerId;
          const carrierId = state.ball.ownerId;

          if (
            tacklerId === null ||
            carrierId === null ||
            state.transition.counterPressClubId === null ||
            state.transition.breakClubId === null ||
            state.transition.counterPressClubId === state.transition.breakClubId
          ) {
            return;
          }

          const tackler = state.players[tacklerId];
          const carrier = state.players[carrierId];

          if (!tackler || !carrier) return;

          const dx = carrier.position.x - tackler.position.x;
          const dy = carrier.position.y - tackler.position.y;
          const distance = Math.hypot(dx, dy);

          if (distance <= 0 || distance > 22) return;

          const relativeVx = tackler.velocity.x - carrier.velocity.x;
          const relativeVy = tackler.velocity.y - carrier.velocity.y;
          const relativeSpeed = Math.hypot(relativeVx, relativeVy);
          const closingSpeed = calculateClosingSpeed(
            tackler.position,
            carrier.position,
            tackler.velocity,
            carrier.velocity
          );

          samples += 1;
          relativeSpeedSum += relativeSpeed;
          closingSpeedSum += closingSpeed;

          if (closingSpeed > 0.1) positiveClosingSamples += 1;
          else if (closingSpeed < -0.1) negativeClosingSamples += 1;
          else nearZeroClosingSamples += 1;
        },
      });
    }

    const avgRelativeSpeed =
      samples > 0 ? relativeSpeedSum / samples : 0;
    const avgClosingSpeed =
      samples > 0 ? closingSpeedSum / samples : 0;
    const positiveRate =
      samples > 0 ? positiveClosingSamples / samples : 0;
    const negativeRate =
      samples > 0 ? negativeClosingSamples / samples : 0;
    const nearZeroRate =
      samples > 0 ? nearZeroClosingSamples / samples : 0;

    console.log('');
    console.log('=== TACKLE PHYSICS MEASUREMENT ===');
    console.log('samples=' + samples);
    console.log('avgRelativeSpeed=' + avgRelativeSpeed.toFixed(3));
    console.log('avgClosingSpeed=' + avgClosingSpeed.toFixed(3));
    console.log('positiveClosingRate=' + (positiveRate * 100).toFixed(2) + '%');
    console.log('negativeClosingRate=' + (negativeRate * 100).toFixed(2) + '%');
    console.log('nearZeroClosingRate=' + (nearZeroRate * 100).toFixed(2) + '%');

    expect(samples).toBeGreaterThan(0);
  }, 120_000);
});
