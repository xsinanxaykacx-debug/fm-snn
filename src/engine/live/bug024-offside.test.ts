import { describe, expect, it } from 'vitest';

import { DEFAULT_PITCH_DIMENSIONS } from './pitch';
import { detectOffside } from './events';

describe('BUG-024 live offside', () => {
  const pitch = DEFAULT_PITCH_DIMENSIONS;

  it('flags a receiver beyond the second-last defender and the ball', () => {
    const outcome = detectOffside(
      pitch,
      1,
      'away',
      { x: 70, y: 32 },
      { x: 85, y: 32 },
      [
        { clubId: 'away', position: { x: 72, y: 30 } },
        { clubId: 'away', position: { x: 78, y: 34 } },
        { clubId: 'away', position: { x: 92, y: 32 } },
      ]
    );

    expect(outcome.type).toBe('offside');

    if (outcome.type === 'offside') {
      expect(outcome.side).toBe('AWAY');
      expect(outcome.freeKickPoint.x).toBe(70);
    }
  });

  it('allows a receiver level with or behind the second-last defender', () => {
    const outcome = detectOffside(
      pitch,
      1,
      'away',
      { x: 70, y: 32 },
      { x: 77, y: 32 },
      [
        { clubId: 'away', position: { x: 72, y: 30 } },
        { clubId: 'away', position: { x: 78, y: 34 } },
        { clubId: 'away', position: { x: 92, y: 32 } },
      ]
    );

    expect(outcome.type).toBe('none');
  });

  it('uses the opposite direction for the away attack', () => {
    const outcome = detectOffside(
      pitch,
      -1,
      'home',
      { x: 34, y: 32 },
      { x: 18, y: 32 },
      [
        { clubId: 'home', position: { x: 32, y: 30 } },
        { clubId: 'home', position: { x: 26, y: 34 } },
        { clubId: 'home', position: { x: 12, y: 32 } },
      ]
    );

    expect(outcome.type).toBe('offside');
    if (outcome.type === 'offside') {
      expect(outcome.side).toBe('HOME');
    }
  });
});
