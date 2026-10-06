import type { MatchState, Vec2 } from './state';
import type { MovementIntent } from './movement';
import type { PerceptionSnapshot } from './perception';
import type { RngState } from './rng';
import { nextRandom } from './rng';

export type DecisionAction = 'PASS' | 'SHOOT' | 'DRIBBLE' | 'CHASE' | 'POSITION';
export type DecisionIntent = MovementIntent & { action: DecisionAction };
export type DecisionResult = DecisionIntent[] & { seed: RngState };

function direction(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    length = Math.hypot(dx, dy);
  return length === 0 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length };
}

/**
 * Top sahibinin (owner) hangi aksiyonu seçeceğini belirler.
 *
 * Context narrows the valid actions first; RNG only breaks the remaining
 * action choice. CHASE/POSITION remain deterministic and consume no RNG.
 */
function chooseBallAction(
  state: MatchState,
  playerId: string,
  randomValue: number,
): DecisionAction {
  const player = state.players[playerId];
  if (!player) throw new Error('live-v2 decision: unknown player ' + playerId);

  const pressure = Object.values(state.players)
    .filter((p) => p.team !== player.team)
    .map((p) => Math.hypot(p.position.x - player.position.x, p.position.y - player.position.y))
    .sort((a, b) => a - b)[0];

  const goalX = player.team === 'HOME' ? state.pitch.length : 0;
  const nearGoal = Math.abs(goalX - player.position.x) <= 18;

  const actions: DecisionAction[] = pressure !== undefined && pressure < 5
    ? ['PASS', 'DRIBBLE']
    : nearGoal
      ? ['SHOOT', 'PASS', 'DRIBBLE']
      : ['DRIBBLE', 'PASS'];

  return actions[Math.min(actions.length - 1, Math.floor(randomValue * actions.length))];
}

export function decide(state: MatchState, perception: PerceptionSnapshot): DecisionResult {
  let rngState = state.seed;
  const decisions = Object.values(state.players)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((player) => {
      if (state.ball.ownerId === player.id) {
        const [randomValue, nextState] = nextRandom(rngState);
        rngState = nextState;
        return {
          playerId: player.id,
          displacement: { x: 0, y: 0 },
          action: chooseBallAction(state, player.id, randomValue),
        };
      }

      const target = perception.players[player.id]?.ballPosition;
      return {
        playerId: player.id,
        displacement: target ? direction(player.position, target) : { x: 0, y: 0 },
        action: target ? 'CHASE' : 'POSITION',
      };
    }) as DecisionResult;

  Object.defineProperty(decisions, 'seed', {
    value: rngState,
    enumerable: true,
    writable: false,
  });

  return decisions;
}
