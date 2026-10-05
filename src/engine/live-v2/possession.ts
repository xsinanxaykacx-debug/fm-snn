import type { MatchState, PlayerState, TeamSide, Vec2 } from './state';

export type PossessionConfig = { controlDistance: number; stealDistance: number };
export const DEFAULT_POSSESSION: PossessionConfig = { controlDistance: 1.5, stealDistance: 1.0 };

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearest(players: PlayerState[], position: Vec2, maxDistance: number): PlayerState | null {
  let best: PlayerState | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const player of players.sort((a, b) => a.id.localeCompare(b.id))) {
    const d = distance(player.position, position);
    if (d <= maxDistance && (d < bestDistance || (d === bestDistance && (!best || player.id < best.id)))) {
      best = player;
      bestDistance = d;
    }
  }
  return best;
}

function withOwner(state: MatchState, player: PlayerState): MatchState {
  return {
    ...state,
    ball: { ...state.ball, ownerId: player.id, lastTouchId: player.id, lastTouchSide: player.team },
  };
}

/** Pure possession resolver. Pass/shot are decisions; possession only changes when control/steal is resolved. */
export function updatePossession(
  state: MatchState,
  config: PossessionConfig = DEFAULT_POSSESSION,
): MatchState {
  if (!Number.isFinite(config.controlDistance) || config.controlDistance < 0) throw new Error('live-v2 possession: invalid controlDistance');
  if (!Number.isFinite(config.stealDistance) || config.stealDistance < 0) throw new Error('live-v2 possession: invalid stealDistance');

  const players = Object.values(state.players);
  const owner = state.ball.ownerId === null ? null : state.players[state.ball.ownerId];

  if (!owner) {
    const player = nearest(players, state.ball.position, config.controlDistance);
    return player ? withOwner(state, player) : state;
  }

  const stealer = nearest(players.filter((p) => p.team !== owner.team), state.ball.position, config.stealDistance);
  if (!stealer) return state;

  return distance(stealer.position, state.ball.position) < distance(owner.position, state.ball.position)
    ? withOwner(state, stealer)
    : state;
}

export function possessionSide(state: MatchState): TeamSide | null {
  const owner = state.ball.ownerId === null ? null : state.players[state.ball.ownerId];
  return owner?.team ?? null;
}
