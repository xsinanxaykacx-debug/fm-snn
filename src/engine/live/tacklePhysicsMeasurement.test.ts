import { describe, expect, it } from 'vitest';

import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';
import { calculateClosingSpeed } from './tackle';

describe('calculateClosingSpeed', () => {
  it('approaching players are positive', () => {
    expect(calculateClosingSpeed(
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 5, y: 0 }, { x: -3, y: 0 }
    )).toBeCloseTo(8, 10);
  });

  it('same direction chase uses the speed difference', () => {
    expect(calculateClosingSpeed(
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 5, y: 0 }, { x: 4, y: 0 }
    )).toBeCloseTo(1, 10);
  });

  it('same velocity gives zero', () => {
    expect(calculateClosingSpeed(
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 5, y: 0 }, { x: 5, y: 0 }
    )).toBeCloseTo(0, 10);
  });

  it('perpendicular carrier movement can still have positive radial closing', () => {
    expect(calculateClosingSpeed(
      { x: 0, y: 0 }, { x: 5, y: 0 },
      { x: 5, y: 0 }, { x: 0, y: 5 }
    )).toBeCloseTo(5, 10);
  });

  it('separating players are negative', () => {
    expect(calculateClosingSpeed(
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: -3, y: 0 }, { x: 5, y: 0 }
    )).toBeCloseTo(-8, 10);
  });

  it('offset movement measures the radial component, not total relative speed', () => {
    const closingSpeed = calculateClosingSpeed(
      { x: 0, y: 0 }, { x: 5, y: 1 },
      { x: 5, y: 0 }, { x: 0, y: 5 }
    );

    const relativeSpeed = Math.hypot(5, -5);

    expect(closingSpeed).toBeCloseTo(35 / Math.sqrt(26), 10);
    expect(Math.abs(closingSpeed)).toBeLessThan(relativeSpeed);
    expect(relativeSpeed).toBeCloseTo(Math.sqrt(50), 10);
  });

  it('coincident positions return zero', () => {
    expect(calculateClosingSpeed(
      { x: 10, y: 20 }, { x: 10, y: 20 },
      { x: 5, y: 0 }, { x: -5, y: 0 }
    )).toBe(0);
  });

  it('closing speed predicts the next distance change', () => {
    const tacklerPosition = { x: 0, y: 0 };
    const carrierPosition = { x: 10, y: 0 };
    const tacklerVelocity = { x: 2, y: 0 };
    const carrierVelocity = { x: -1, y: 0 };
    const dt = 0.01;

    const closingSpeed = calculateClosingSpeed(
      tacklerPosition,
      carrierPosition,
      tacklerVelocity,
      carrierVelocity
    );

    const currentDistance = Math.hypot(
      carrierPosition.x - tacklerPosition.x,
      carrierPosition.y - tacklerPosition.y
    );

    const nextDistance = Math.hypot(
      (carrierPosition.x + carrierVelocity.x * dt) -
        (tacklerPosition.x + tacklerVelocity.x * dt),
      (carrierPosition.y + carrierVelocity.y * dt) -
        (tacklerPosition.y + tacklerVelocity.y * dt)
    );

    const measuredClosingSpeed =
      (currentDistance - nextDistance) / dt;

    expect(closingSpeed).toBeCloseTo(measuredClosingSpeed, 6);
  });
});

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
