import type { MatchState, PlayerState, Vec2 } from './state';

export type PlayerPerception = {
  playerId: string;
  nearestOpponentId: string | null;
  nearestTeammateId: string | null;
  ballPosition: Vec2;
};
export type PerceptionSnapshot = { players: Record<string, PlayerPerception> };

function distance(a: Vec2, b: Vec2): number { return Math.hypot(a.x - b.x, a.y - b.y); }

function nearest(candidates: PlayerState[], origin: Vec2): PlayerState | null {
  return candidates.reduce<PlayerState | null>((best, candidate) => {
    if (!best) return candidate;
    const a = distance(candidate.position, origin), b = distance(best.position, origin);
    return a < b || (a === b && candidate.id < best.id) ? candidate : best;
  }, null);
}

export function perceive(state: MatchState): PerceptionSnapshot {
  const all = Object.values(state.players).sort((a, b) => a.id.localeCompare(b.id));
  const players: Record<string, PlayerPerception> = {};
  for (const player of all) {
    players[player.id] = {
      playerId: player.id,
      nearestOpponentId: nearest(all.filter((p) => p.team !== player.team), player.position)?.id ?? null,
      nearestTeammateId: nearest(all.filter((p) => p.id !== player.id && p.team === player.team), player.position)?.id ?? null,
      ballPosition: { x: state.ball.position.x, y: state.ball.position.y },
    };
  }
  return { players };
}
