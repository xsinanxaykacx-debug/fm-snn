import type { MatchState } from './state';
import { perceive } from './perception';
import { decide } from './decision';
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

function phaseAt(clockSeconds: number): MatchState['phase'] {
  if (clockSeconds >= 5400) return 'full_time';
  if (clockSeconds === 2700) return 'halftime';
  if (clockSeconds > 2700) return 'second_half';
  return 'first_half';
}

/** Executes exactly one deterministic v2 simulation tick. */
export function runTick(state: MatchState): MatchState {
  const perceptions = perceive(state);
  const decisions = decide(state, perceptions);
  const previousBallPosition = { ...state.ball.position };
  const perceivedState = state;
  const intents = noDecisionMovement(perceivedState);
  const moved = applyMovement(perceivedState, intents);
  const ballStepped = stepBall(moved);

  const boundary = resolveBoundary(
    moved.pitch,
    previousBallPosition,
    ballStepped.ball.position,
    ballStepped.ball,
    moved.players,
  );

  let next = ballStepped;

  if (boundary.event) {
    next = applyRestart(next, boundary.event);
    next = { ...next, events: [...next.events, boundary.event] };
    next = consumeRestart(next);
  }

  const nextClock = next.clockSeconds + 1;
  const nextPhase = phaseAt(nextClock);
  const lastDecisionAction = decisions[0]?.action;

  return {
    ...next,
    clockSeconds: nextClock,
    tick: next.tick + 1,
    phase: nextPhase,
    diagnostics: {
      lastPhase: nextPhase,
      lastTick: next.tick + 1,
      lastBallPosition: { ...next.ball.position },
      lastBallVelocity: { ...next.ball.velocity },
      lastDecisionAction,
      perceivedPlayerCount: Object.keys(perceptions.players).length,
    },
  };
}
