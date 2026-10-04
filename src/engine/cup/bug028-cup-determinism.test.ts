import { describe, expect, it } from 'vitest';

import type { Club } from '../types';
import { createCup, simulatePenalties } from './cupEngine';

function makeClubs(): Record<string, Club> {
  return Object.fromEntries(
    Array.from({ length: 16 }, (_, index) => [
      `club-${index + 1}`,
      { id: `club-${index + 1}`, name: `Club ${index + 1}` },
    ])
  ) as unknown as Record<string, Club>;
}

describe('BUG-028 cup determinism', () => {
  it('creates the same first-round draw for the same season and clubs', () => {
    const clubs = makeClubs();

    const first = createCup(1, clubs);
    const second = createCup(1, clubs);

    expect(first).toEqual(second);
    expect(first.rounds.round1).toHaveLength(8);
    expect(Object.values(first.matches)).toHaveLength(8);
  });

  it('creates the same penalty shootout for the same seed and strengths', () => {
    const first = simulatePenalties(15, 12, 123456789);
    const second = simulatePenalties(15, 12, 123456789);

    expect(first).toEqual(second);
    expect(first.home).not.toBeLessThan(0);
    expect(first.away).not.toBeLessThan(0);
  });
});
