import { describe, expect, it } from 'vitest';

import type { LivePlayer } from '../types';
import { createRng } from './rng';
import { resolveFoulDiscipline } from './discipline';
import { shouldDecide } from './decision';

function player(overrides: Partial<{
  yellowCards: number;
  aggression: number;
  bravery: number;
  strength: number;
  sentOff: boolean;
  injured: boolean;
}> = {}): LivePlayer {
  return {
    player: {
      id: 'p1',
      name: 'Test Player',
      yellowCards: overrides.yellowCards ?? 0,
      sentOff: overrides.sentOff ?? false,
      injured: overrides.injured ?? false,
      attributes: {
        aggression: overrides.aggression ?? 10,
        bravery: overrides.bravery ?? 10,
        strength: overrides.strength ?? 10,
      },
    },
    nextDecisionTime: 0,
  } as LivePlayer;
}

describe('BUG-023 live discipline', () => {
  it('produces cards and injuries from seeded foul severity without Math.random', () => {
    const tackler = player({ aggression: 20, bravery: 20 });
    const victim = player({ strength: 1 });

    let yellow = 0;
    let red = 0;
    let injured = 0;

    for (let seed = 1; seed <= 1000; seed += 1) {
      const outcome = resolveFoulDiscipline(
        tackler,
        victim,
        'severe',
        createRng(seed)
      );

      if (outcome.card === 'yellow') yellow += 1;
      if (outcome.card === 'red') red += 1;
      if (outcome.injuryWeeks > 0) injured += 1;
    }

    expect(yellow + red).toBeGreaterThan(0);
    expect(red).toBeGreaterThan(0);
    expect(injured).toBeGreaterThan(0);
  });

  it('turns a second yellow into a red card deterministically', () => {
    const tackler = player({
      yellowCards: 1,
      aggression: 20,
      bravery: 10,
    });
    const victim = player({ strength: 20 });

    let found = false;

    for (let seed = 1; seed <= 1000; seed += 1) {
      const outcome = resolveFoulDiscipline(
        tackler,
        victim,
        'medium',
        createRng(seed)
      );

      if (outcome.card === 'red' && outcome.secondYellow) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });

  it('does not schedule decisions for sent-off or injured players', () => {
    const sentOff = player({ sentOff: true });
    const injured = player({ injured: true });
    const active = player();

    expect(shouldDecide(sentOff, 10)).toBe(false);
    expect(shouldDecide(injured, 10)).toBe(false);
    expect(shouldDecide(active, 10)).toBe(true);
  });
});
