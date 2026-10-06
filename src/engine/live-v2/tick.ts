import type { MatchState } from './state';
import { perceive } from './perception';
import { decide } from './decision';
import { resolveActions } from './actionResolution';
import { updatePossession } from './possession';
import { applyMovement, type MovementIntent } from './movement';
import { stepBall } from './ball';
import { resolveBoundary } from './boundary';
import { applyRestart, consumeRestart, playRestart } from './restart';

function phaseAt(clockSeconds: number): MatchState['phase'] {
  if (clockSeconds >= 5400) return 'full_time';
  if (clockSeconds === 2700) return 'halftime';
  if (clockSeconds > 2700) return 'second_half';
  return 'first_half';
}

/** Executes exactly one deterministic v2 simulation tick. */
export function runTick(state: MatchState): MatchState {
  // A pending restart is a one-tick transition, not a persistent simulation
  // mode. Resolve it before perception/decision so no live subsystem can
  // repeatedly steal/control a stationary restart ball.
  const liveState = playRestart(state);

  const perceptions = perceive(liveState);
  const decisions = decide(liveState, perceptions);
  const withActions = resolveActions(liveState, decisions);
  const previousBallPosition = { ...liveState.ball.position };
  // decisions already conform to MovementIntent (DecisionIntent extends MovementIntent)
  const intents: MovementIntent[] = decisions;

  const moved = applyMovement(withActions, intents);
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
  } else {
    next = updatePossession(next);
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
      restartState: next.restart,
      lastBoundaryEvent: boundary.event,
    },
  };
}
