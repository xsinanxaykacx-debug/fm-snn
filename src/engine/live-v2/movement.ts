import type { MatchState, Vec2 } from './state';

/**
 * A movement intent is a requested displacement for one player during one
 * simulation tick.
 *
 * The intent may point outside the pitch. The movement module is responsible
 * for enforcing the player-position invariant before the new state is
 * committed.
 */
export type MovementIntent = {
  playerId: string;
  displacement: Vec2;
};

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function assertFiniteVector(vector: Vec2, label: string): void {
  if (!finite(vector.x) || !finite(vector.y)) {
    throw new Error(`live-v2 movement: non-finite ${label}`);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Applies movement intents without mutating the supplied MatchState.
 *
 * Invariant after this function returns:
 *   0 <= player.position.x <= state.pitch.length
 *   0 <= player.position.y <= state.pitch.width
 *
 * Unknown player ids are rejected rather than silently ignored because a
 * missing player would otherwise hide a simulation-state consistency error.
 */
export function applyMovement(
  state: MatchState,
  intents: readonly MovementIntent[],
): MatchState {
  if (!Number.isFinite(state.pitch.length) || state.pitch.length < 0) {
    throw new Error('live-v2 movement: invalid pitch length');
  }

  if (!Number.isFinite(state.pitch.width) || state.pitch.width < 0) {
    throw new Error('live-v2 movement: invalid pitch width');
  }

  const players = { ...state.players };

  for (const intent of intents) {
    if (!intent.playerId) {
      throw new Error('live-v2 movement: empty player id');
    }

    const player = players[intent.playerId];
    if (!player) {
      throw new Error(`live-v2 movement: unknown player ${intent.playerId}`);
    }

    assertFiniteVector(player.position, 'player position');
    assertFiniteVector(intent.displacement, 'movement displacement');

    players[intent.playerId] = {
      ...player,
      position: {
        x: clamp(
          player.position.x + intent.displacement.x,
          0,
          state.pitch.length,
        ),
        y: clamp(
          player.position.y + intent.displacement.y,
          0,
          state.pitch.width,
        ),
      },
    };
  }

  return {
    ...state,
    players,
  };
}

/**
 * Explicit invariant checker used by unit/integration tests and diagnostics.
 *
 * It is pure: it never changes the supplied state.
 */
export function assertPlayerPositionsBounded(state: MatchState): void {
  for (const player of Object.values(state.players)) {
    assertFiniteVector(player.position, `player ${player.id} position`);

    if (
      player.position.x < 0 ||
      player.position.x > state.pitch.length ||
      player.position.y < 0 ||
      player.position.y > state.pitch.width
    ) {
      throw new Error(
        `live-v2 movement: player ${player.id} outside pitch at (${player.position.x}, ${player.position.y})`,
      );
    }
  }
}
