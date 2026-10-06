import { describe, expect, it } from 'vitest';
import { createV2MatchSeed } from './matchSeed';

describe('live-v2 match seed', () => {
  it('returns the same seed for the same input', () => {
    expect(createV2MatchSeed(2026, 'fixture-17', 12))
      .toEqual(createV2MatchSeed(2026, 'fixture-17', 12));
  });

  it('returns different seeds for different input', () => {
    const base = createV2MatchSeed(2026, 'fixture-17', 12).seed;
    expect(createV2MatchSeed(2026, 'fixture-18', 12).seed).not.toBe(base);
    expect(createV2MatchSeed(2026, 'fixture-17', 13).seed).not.toBe(base);
  });

  it('returns an unsigned 32-bit seed', () => {
    const seed = createV2MatchSeed(2026, 'fixture-17', 12).seed;
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });
});
