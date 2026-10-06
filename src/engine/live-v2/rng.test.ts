import { describe, expect, it } from 'vitest';
import { nextRandom, randomSequence } from './rng';

describe('live-v2 rng', () => {
  it('same seed produces the same sequence', () => {
    expect(randomSequence({ seed: 123456 }, 8)[0])
      .toEqual(randomSequence({ seed: 123456 }, 8)[0]);
  });

  it('different seeds produce different sequences', () => {
    expect(randomSequence({ seed: 1 }, 8)[0])
      .not.toEqual(randomSequence({ seed: 2 }, 8)[0]);
  });

  it('is deterministic and immutable', () => {
    const state = { seed: 987654321 };
    const before = { ...state };

    const [a, next] = nextRandom(state);
    const [b, nextAgain] = nextRandom(state);

    expect(a).toBe(b);
    expect(next).toEqual(nextAgain);
    expect(state).toEqual(before);
  });

  it('returns values in [0,1)', () => {
    expect(randomSequence({ seed: 42 }, 1000)[0]
      .every((value) => value >= 0 && value < 1))
      .toBe(true);
  });

  it('uses nextRandom as the canonical one-step API', () => {
    const start = { seed: 24681357 };
    const [first, state1] = nextRandom(start);
    const [second, state2] = nextRandom(state1);
    const [sequence, finalState] = randomSequence(start, 2);

    expect(sequence).toEqual([first, second]);
    expect(finalState).toEqual(state2);
  });

  it('advances the seed once per consumed nextRandom value', () => {
    const start = { seed: 123456 };
    const [, afterOne] = nextRandom(start);
    const [, afterTwo] = nextRandom(afterOne);

    expect(afterOne.seed).not.toBe(start.seed);
    expect(afterTwo.seed).not.toBe(afterOne.seed);
    expect(afterTwo).toEqual(randomSequence(start, 2)[1]);
  });
});
