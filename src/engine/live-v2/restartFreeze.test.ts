import { describe, expect, it } from 'vitest';
import { runTick } from './tick';
import type { MatchState } from './state';
import fixture from './fixtures/freeze-at-188.json?raw';

const frozenState = JSON.parse(fixture) as MatchState;

describe('live-v2 restart freeze regression', () => {
  it('clears the pending restart and resumes live ball flow within 100 ticks', () => {
    let state = frozenState;

    for (let i = 0; i < 100; i += 1) {
      state = runTick(state);
    }

    expect(state.restart).toBeNull();
    expect(Math.abs(state.ball.velocity.x) + Math.abs(state.ball.velocity.y)).toBeGreaterThan(0);
  });
});
