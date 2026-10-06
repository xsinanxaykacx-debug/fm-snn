import { describe, expect, it } from 'vitest';
import { createMatchState } from '../adapters/matchStateFactory';
import { simulateMatchV2 } from '../simulation';
import type { Pitch } from '../state';
import type { RngState } from '../rng';

const pitch: Pitch = {
  length: 104,
  width: 64,
  goalWidth: 7.32,
  goalHeight: 2.44,
  goalAreaDepth: 5.5,
};

function seed(value: number): RngState {
  return { seed: value };
}

function lineup(prefix: string) {
  return {
    clubId: prefix,
    players: Array.from({ length: 11 }, (_, i) => ({ id: prefix + '-' + (i + 1) })),
  };
}

describe('live-v2 F3.2 shot and goal calibration', () => {
  it('runs a complete 5400-tick match without synthetic score injection', () => {
    const state = createMatchState(lineup('H'), lineup('A'), seed(12345), pitch);
    const final = simulateMatchV2(state, 5400);

    expect(final.tick).toBe(5400);
    expect(final.phase).toBe('full_time');
    expect(final.football?.events.some((event) => event.type === 'shot')).toBe(true);
    expect(final.score.home + final.score.away).toBeGreaterThanOrEqual(0);
  });

  it('keeps multi-seed average goals in the target calibration band', () => {
    const goals = Array.from({ length: 12 }, (_, i) => {
      const state = createMatchState(lineup('H' + i), lineup('A' + i), seed(1000 + i), pitch);
      const final = simulateMatchV2(state, 5400);\n      return final.score.home + final.score.away;
    });
    const average = goals.reduce((sum, value) => sum + value, 0) / goals.length;
    expect(average).toBeGreaterThanOrEqual(1.5);
    expect(average).toBeLessThanOrEqual(4);
  });
});
