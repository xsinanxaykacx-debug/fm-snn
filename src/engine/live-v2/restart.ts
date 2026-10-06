import type { MatchEvent, MatchState, RestartState, TeamSide, Vec2 } from './state';

function opposite(side: TeamSide): TeamSide {
  return side === 'HOME' ? 'AWAY' : 'HOME';
}

function kickoffPoint(state: MatchState): Vec2 {
  return { x: state.pitch.length / 2, y: state.pitch.width / 2 };
}

function goalKickPoint(state: MatchState, side: TeamSide): Vec2 {
  return {
    x: side === 'HOME'
      ? state.pitch.goalAreaDepth / 2
      : state.pitch.length - state.pitch.goalAreaDepth / 2,
    y: state.pitch.width / 2,
  };
}

function cornerPoint(state: MatchState, event: Extract<MatchEvent, { type: 'corner' }>): Vec2 {
  return {
    x: event.point.x <= state.pitch.length / 2 ? 0 : state.pitch.length,
    y: event.point.y <= state.pitch.width / 2 ? 0 : state.pitch.width,
  };
}

function throwInPoint(state: MatchState, event: Extract<MatchEvent, { type: 'throw_in' }>): Vec2 {
  return {
    x: Math.max(0, Math.min(state.pitch.length, event.point.x)),
    y: event.point.y <= state.pitch.width / 2 ? 0 : state.pitch.width,
  };
}

export function eventToRestart(state: MatchState, event: MatchEvent): RestartState {
  switch (event.type) {
    case 'goal':
      return { type: 'kickoff', side: opposite(event.scorerSide), point: kickoffPoint(state) };
    case 'goal_kick':
      return { type: 'goal_kick', side: event.side, point: goalKickPoint(state, event.side) };
    case 'corner':
      return { type: 'corner', side: event.side, point: cornerPoint(state, event) };
    case 'throw_in':
      return { type: 'throw_in', side: event.side, point: throwInPoint(state, event) };
  }
}

export function applyRestart(state: MatchState, event: MatchEvent): MatchState {
  const restart = eventToRestart(state, event);

  if (restart === null) {
    throw new Error('live-v2 restart: event did not produce a restart');
  }

  const score =
    event.type === 'goal'
      ? event.scorerSide === 'HOME'
        ? { home: state.score.home + 1, away: state.score.away }
        : { home: state.score.home, away: state.score.away + 1 }
      : state.score;

  return {
    ...state,
    score,
    ball: {
      ...state.ball,
      position: { x: restart.point.x, y: restart.point.y, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      ownerId: null,
    },
    restart,
  };
}

const RESTART_KICK_SPEED = 8;

function restartDirection(side: TeamSide): Vec2 {
  return {
    x: side === 'HOME' ? 1 : -1,
    y: 0,
  };
}

/**
 * Plays one pending restart and immediately returns the match to live play.
 *
 * A restart is a one-shot transition: once the ball is placed by
 * applyRestart(), the next tick must consume the pending restart and release
 * the ball into normal simulation. No movement, physics, or possession
 * module
 * is allowed to own the restart lifecycle.
 */
export function playRestart(state: MatchState): MatchState {
  if (state.restart === null) return state;

  const direction = restartDirection(state.restart.side);

  return {
    ...state,
    ball: {
      ...state.ball,
      velocity: {
        x: direction.x * RESTART_KICK_SPEED,
        y: direction.y * RESTART_KICK_SPEED,
        z: 0,
      },
      ownerId: null,
      lastTouchSide: state.restart.side,
    },
    restart: null,
  };
}

export function consumeRestart(state: MatchState): MatchState {
  if (state.restart === null) return state;
  return { ...state, restart: null };
}
