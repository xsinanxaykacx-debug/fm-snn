import { describe, expect, it } from 'vitest';
import { runTick } from './tick';
import type { MatchState } from './state';
import fixture from './fixtures/freeze-at-188.json?raw';

const frozenState = JSON.parse(fixture) as MatchState;

function horizontalSpeed(state: MatchState): number {
  return Math.hypot(state.ball.velocity.x, state.ball.velocity.y);
}

describe('live-v2 restart freeze diagnostics', () => {
  it('identifies every tick that reaches zero horizontal ball velocity', () => {
    let state = frozenState;
    const zeroVelocityTicks: Array<{
      tick: number;
      action: MatchState['diagnostics']['lastAction'];
      passTarget: MatchState['diagnostics']['lastPassTarget'];
      velocityBefore: MatchState['diagnostics']['lastBallVelocityBefore'];
      velocityAfter: MatchState['diagnostics']['lastBallVelocityAfter'];
      source: MatchState['diagnostics']['lastZeroVelocitySource'];
    }> = [];

    for (let i = 0; i < 100; i += 1) {
      state = runTick(state);
      if (horizontalSpeed(state) === 0) {
        zeroVelocityTicks.push({
          tick: state.tick,
          action: state.diagnostics.lastAction,
          passTarget: state.diagnostics.lastPassTarget,
          velocityBefore: state.diagnostics.lastBallVelocityBefore,
          velocityAfter: state.diagnostics.lastBallVelocityAfter,
          source: state.diagnostics.lastZeroVelocitySource,
        });
      }
    }

    expect(
      zeroVelocityTicks,
      JSON.stringify(zeroVelocityTicks, null, 2),
    ).toHaveLength(0);
  });
});
