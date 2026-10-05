import type { DecisionIntent } from './decision';
import type { MatchState, PlayerState, Vec2 } from './state';

const PASS_SPEED = 8;
const SHOOT_SPEED = 24;
const DRIBBLE_SPEED = 2.5;
const DRIBBLE_DISTANCE = 0.8;

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function direction(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);

  return length === 0
    ? { x: 0, y: 0 }
    : { x: dx / length, y: dy / length };
}

function nearestTeammate(
  state: MatchState,
  player: PlayerState,
  targetId?: string,
): PlayerState | null {
  if (targetId !== undefined) {
    const target = state.players[targetId];
    if (!target || target.team !== player.team || target.id === player.id) {
      return null;
    }
    return target;
  }

  return Object.values(state.players)
    .filter((candidate) => candidate.team === player.team && candidate.id !== player.id)
    .sort((a, b) => {
      const distanceDifference =
        distance(a.position, player.position) -
        distance(b.position, player.position);

      return distanceDifference !== 0
        ? distanceDifference
        : a.id.localeCompare(b.id);
    })[0] ?? null;
}

function resolvePass(
  state: MatchState,
  playerId: string,
  targetId?: string,
): MatchState {
  const player = state.players[playerId];

  if (!player || state.ball.ownerId !== playerId) {
    return state;
  }

  const target = nearestTeammate(state, player, targetId);

  if (!target) {
    return state;
  }

  const unit = direction(state.ball.position, {
    x: target.position.x,
    y: target.position.y,
  });

  return {
    ...state,
    ball: {
      ...state.ball,
      velocity: {
        x: unit.x * PASS_SPEED,
        y: unit.y * PASS_SPEED,
        z: 0,
      },
      ownerId: null,
      lastTouchId: playerId,
      lastTouchSide: player.team,
    },
  };
}

function resolveShot(state: MatchState, playerId: string): MatchState {
  const player = state.players[playerId];

  if (!player || state.ball.ownerId !== playerId) {
    return state;
  }

  const goalX = player.team === 'HOME' ? state.pitch.length : 0;
  const unit = direction(state.ball.position, {
    x: goalX,
    y: state.pitch.width / 2,
  });

  return {
    ...state,
    ball: {
      ...state.ball,
      velocity: {
        x: unit.x * SHOOT_SPEED,
        y: unit.y * SHOOT_SPEED,
        z: 0,
      },
      ownerId: null,
      lastTouchId: playerId,
      lastTouchSide: player.team,
    },
  };
}

function resolveDribble(state: MatchState, playerId: string): MatchState {
  const player = state.players[playerId];

  if (!player || state.ball.ownerId !== playerId) {
    return state;
  }

  const forward = player.team === 'HOME' ? 1 : -1;

  return {
    ...state,
    ball: {
      ...state.ball,
      position: {
        x: player.position.x + forward * DRIBBLE_DISTANCE,
        y: player.position.y,
        z: Math.max(0, state.ball.position.z),
      },
      velocity: {
        x: forward * DRIBBLE_SPEED,
        y: 0,
        z: 0,
      },
      ownerId: playerId,
      lastTouchId: playerId,
      lastTouchSide: player.team,
    },
  };
}

/**
 * CHASE is a player movement intent. applyMovement resolves its displacement;
 * there is no ball action to apply here.
 */
function resolveChase(state: MatchState, _playerId: string): MatchState {
  return state;
}

/**
 * Resolves decision labels into concrete ball state changes.
 *
 * The function is pure and deterministic. It never mutates the input state
 * and deliberately does not consume RNG; seeded randomness belongs to E.
 */
export function resolveActions(
  state: MatchState,
  decisions: readonly DecisionIntent[],
): MatchState {
  let next = state;

  for (const decision of decisions) {
    switch (decision.action) {
      case 'PASS':
        next = resolvePass(next, decision.playerId);
        break;
      case 'SHOOT':
        next = resolveShot(next, decision.playerId);
        break;
      case 'DRIBBLE':
        next = resolveDribble(next, decision.playerId);
        break;
      case 'CHASE':
        next = resolveChase(next, decision.playerId);
        break;
      case 'POSITION':
        break;
    }
  }

  return next;
}
