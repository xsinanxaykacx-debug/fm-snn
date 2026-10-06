import type { DecisionIntent, DecisionResult } from './decision';
import { nextRandom, type RngState } from './rng';
import type { MatchState, PlayerState, Vec2 } from './state';

const PASS_SPEED = 8;
const SHOOT_SPEED = 24;
const DRIBBLE_SPEED = 2.5;
const DRIBBLE_DISTANCE = 0.8;
const PASS_MAX_DEVIATION_RADIANS = 0.18;
const SHOOT_MAX_DEVIATION_RADIANS = 0.10;

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

function deviatedDirection(
  from: Vec2,
  to: Vec2,
  randomValue: number,
  maxDeviationRadians: number,
): Vec2 {
  const base = direction(from, to);
  const angle = Math.atan2(base.y, base.x);
  const deviation = (randomValue - 0.5) * 2 * maxDeviationRadians;
  const adjusted = angle + deviation;

  return {
    x: Math.cos(adjusted),
    y: Math.sin(adjusted),
  };
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
  targetId: string | undefined,
  randomValue: number,
): MatchState {
  const player = state.players[playerId];

  if (!player || state.ball.ownerId !== playerId) {
    return state;
  }

  const target = nearestTeammate(state, player, targetId);

  if (!target) {
    return state;
  }

  const unit = deviatedDirection(
    state.ball.position,
    {
      x: target.position.x,
      y: target.position.y,
    },
    randomValue,
    PASS_MAX_DEVIATION_RADIANS,
  );

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

function resolveShot(
  state: MatchState,
  playerId: string,
  randomValue: number,
): MatchState {
  const player = state.players[playerId];

  if (!player || state.ball.ownerId !== playerId) {
    return state;
  }

  const goalX = player.team === 'HOME' ? state.pitch.length : 0;
  const unit = deviatedDirection(
    state.ball.position,
    {
      x: goalX,
      y: state.pitch.width / 2,
    },
    randomValue,
    SHOOT_MAX_DEVIATION_RADIANS,
  );

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

function resolveDribble(
  state: MatchState,
  playerId: string,
  randomValue: number,
): MatchState {
  const player = state.players[playerId];

  if (!player || state.ball.ownerId !== playerId) {
    return state;
  }

  const forward = player.team === 'HOME' ? 1 : -1;
  const retainsBall = randomValue < 0.5;

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
      ownerId: retainsBall ? playerId : null,
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
 * PASS and SHOOT consume exactly one seeded RNG value when the action is
 * actually resolved. The decision stage has already consumed its own values,
 * so action resolution starts from decisions.seed and returns the advanced
 * state seed. CHASE consumes no RNG; DRIBBLE consumes one RNG value only when resolved.
 */
export function resolveActions(
  state: MatchState,
  decisions: readonly DecisionIntent[],
): MatchState {
  let next = state;
  let rngState: RngState =
    'seed' in decisions && decisions.seed !== undefined
      ? (decisions as DecisionResult).seed
      : state.seed;

  for (const decision of decisions) {
    switch (decision.action) {
      case 'PASS': {
        const player = next.players[decision.playerId];
        const target = player ? nearestTeammate(next, player) : null;

        if (!player || next.ball.ownerId !== decision.playerId || !target) {
          break;
        }

        const [randomValue, nextSeed] = nextRandom(rngState);
        rngState = nextSeed;
        next = resolvePass(next, decision.playerId, undefined, randomValue);
        break;
      }
      case 'SHOOT': {
        if (!next.players[decision.playerId] || next.ball.ownerId !== decision.playerId) {
          break;
        }

        const [randomValue, nextSeed] = nextRandom(rngState);
        rngState = nextSeed;
        next = resolveShot(next, decision.playerId, randomValue);
        break;
      }
      case 'DRIBBLE': {
        const player = next.players[decision.playerId];

        if (!player || next.ball.ownerId !== decision.playerId) {
          break;
        }

        const [randomValue, nextSeed] = nextRandom(rngState);
        rngState = nextSeed;
        next = resolveDribble(next, decision.playerId, randomValue);
        break;
      }
      case 'CHASE':
        next = resolveChase(next, decision.playerId);
        break;
      case 'POSITION':
        break;
    }
  }

  return {
    ...next,
    seed: rngState,
  };
}
