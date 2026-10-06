import { describe, expect, it } from 'vitest';
import { nextRandom, randomSequence } from './rng';

describe('live-v2 rng', () => {
  it('same seed produces the same first value and next state', () => {
    expect(nextRandom({ seed: 42 }))
      .toEqual(nextRandom({ seed: 42 }));
  });

  it('same seed produces the same sequence', () => {
    expect(randomSequence({ seed: 42 }, 10))
      .toEqual(randomSequence({ seed: 42 }, 10));
  });

  it('advances the seed on every call', () => {
    const start = { seed: 42 };
    const [, afterOne] = nextRandom(start);
    const [, afterTwo] = nextRandom(afterOne);

    expect(afterOne.seed).not.toBe(start.seed);
    expect(afterTwo.seed).not.toBe(afterOne.seed);
  });

  it('different seeds produce different sequences', () => {
    const [sequence42] = randomSequence({ seed: 42 }, 10);
    const [sequence43] = randomSequence({ seed: 43 }, 10);

    expect(sequence42).not.toEqual(sequence43);
  });

  it('returns values in [0, 1)', () => {
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

  it('accepts uint32 boundary seeds and rejects invalid seeds', () => {
    expect(() => nextRandom({ seed: 0 })).not.toThrow();
    expect(() => nextRandom({ seed: 0xffffffff })).not.toThrow();
    expect(() => nextRandom({ seed: -1 })).toThrow();
    expect(() => nextRandom({ seed: 1.5 })).toThrow();
  });

  it('does not mutate the input state and returns a new state object', () => {
    const state = { seed: 42 };
    const before = { ...state };

    const [, nextState] = nextRandom(state);

    expect(state).toEqual(before);
    expect(nextState).not.toBe(state);
  });
});
