import type { MatchState } from './state';
import { perceive } from './perception';
import { decide } from './decision';
import { resolveActions } from './actionResolution';
import { updatePossession } from './possession';
import { applyMovement, type MovementIntent } from './movement';
import { stepBall } from './ball';
import { resolveBoundary } from './boundary';
import { applyRestart, playRestart } from './restart';

function phaseAt(clockSeconds: number): MatchState['phase'] {
  if (clockSeconds >= 5400) return 'full_time';
  if (clockSeconds === 2700) return 'halftime';
  if (clockSeconds > 2700) return 'second_half';
  return 'first_half';
}

/** Executes exactly one deterministic v2 simulation tick. */
export function runTick(state: MatchState): MatchState {
  // A pending restart is a one-tick transition, not a persistent simulation
  // mode. Resolve it before any live subsystem sees the stationary restart ball.
  const liveState = playRestart(state);

  // Ball physics is authoritative for the current tick. Perception/decision
  // must observe this updated position, otherwise chase intents are always one
  // tick behind the ball.
  const previousBallPosition = {
    ...liveState.ball.position,
    z: liveState.ball.position.z ?? 0,
  };
  const ballStepped = stepBall(liveState);

  const boundary = resolveBoundary(
    liveState.pitch,
    previousBallPosition,
    ballStepped.ball.position,
    ballStepped.ball,
    liveState.players,
  );

  let liveForDecision = ballStepped;
  let restartActivated = false;

  if (boundary.event) {
    liveForDecision = playRestart({
      ...applyRestart(ballStepped, boundary.event),
      events: [...ballStepped.events, boundary.event],
    });
    restartActivated = true;
  }

  const perceptions = perceive(liveForDecision);
  const decisions: ReturnType<typeof decide> = decide(liveForDecision, perceptions);
  const withActions = resolveActions(liveForDecision, decisions);
  // decisions already conform to MovementIntent (DecisionIntent extends MovementIntent)
  const intents: MovementIntent[] = decisions;

  const moved = applyMovement(withActions, intents);
  // A freshly kicked restart must not be immediately re-owned at its restart
  // point. The next tick's physics moves the ball before possession is resolved.
  const next = restartActivated ? moved : updatePossession(moved);

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
      perceivedPlayerCount: Object.keys(liveState.players).length,
      restartState: next.restart,
      lastBoundaryEvent: boundary.event,
    },
  };
}
