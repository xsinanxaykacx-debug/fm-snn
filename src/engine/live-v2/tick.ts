import type { MatchState } from './state';
import { applyMovement, type MovementIntent } from './movement';
import { stepBall } from './ball';
import { resolveBoundary } from './boundary';
import { applyRestart, consumeRestart } from './restart';

function noDecisionMovement(state: MatchState): MovementIntent[] {
  return Object.keys(state.players).map((playerId) => ({
    playerId,
    displacement: { x: 0, y: 0 },
  }));
}

/**
 * Executes exactly one deterministic v2 simulation tick.
 *
 * Perception and decision are intentionally no-op foundations at this stage:
 * the pipeline is explicit now, so later modules can replace those phases
 * without changing ordering or ownership of state.
 */
export function runTick(state: MatchState): MatchState {
  const previousBallPosition = { ...state.ball.position };

  // 1. perception: read-only foundation; no mutation
  const perceivedState = state;

  // 2. decision: deterministic foundation; no random action yet
  const intents = noDecisionMovement(perceivedState);

  // 3. movement: immutable + bounded
  const moved = applyMovement(perceivedState, intents);

  // 4. ball physics
  const ballStepped = stepBall(moved);

  // 5. boundary resolution
  const boundary = resolveBoundary(
    moved.pitch,
    previousBallPosition,
    ballStepped.ball.position,
    ballStepped.ball,
  );

  let next = ballStepped;

  // 6. restart application + 7. event emission
  if (boundary.event) {
    next = applyRestart(next, boundary.event);
    next = {
      ...next,
      events: [...next.events, boundary.event],
    };
    next = consumeRestart(next);
  }

  // 8. diagnostics + clock/tick progression
  return {
    ...next,
    clockSeconds: next.clockSeconds + 1,
    tick: next.tick + 1,
    phase:
      next.clockSeconds + 1 >= 90
        ? 'full_time'
        : next.phase,
    diagnostics: {
      lastPhase: next.phase,
      lastTick: next.tick + 1,
      lastBallPosition: { ...next.ball.position },
      lastBallVelocity: { ...next.ball.velocity },
    },
  };
}
