import { describe, expect, it } from 'vitest';

import { generateGameData } from './generateData';

describe('generateGameData seed', () => {
  it('produces identical data for the same seed and different data for another seed', () => {
    const first = generateGameData(123456);
    const second = generateGameData(123456);
    const different = generateGameData(123457);

    expect(first).toEqual(second);
    expect(different).not.toEqual(first);
  });
});
