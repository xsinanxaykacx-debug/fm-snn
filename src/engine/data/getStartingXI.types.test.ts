import { describe, expect, it } from 'vitest';

import { getStartingXI } from './generateData';
import type { CustomFormation, Player } from '../types';

describe('getStartingXI custom formation typing', () => {
  it('accepts the typed CustomFormation zones model', () => {
    const customFormation: CustomFormation = {
      id: 'custom-1',
      name: 'Test',
      zones: [],
    };

    const result = getStartingXI('club-1', {}, 'CUSTOM', undefined, customFormation);

    expect(result).toEqual([]);
  });
});
