import type { MatchState, Vec2 } from './state';
import type { MovementIntent } from './movement';
import type { PerceptionSnapshot } from './perception';

export type DecisionAction = 'PASS' | 'SHOOT' | 'DRIBBLE' | 'CHASE' | 'POSITION';
export type DecisionIntent = MovementIntent & { action: DecisionAction };

function direction(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    length = Math.hypot(dx, dy);
  return length === 0 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length };
}

/**
 * Top sahibinin (owner) hangi aksiyonu seçeceğini belirler.
 *
 * Öncelik sırası:
 * 1. Baskı altında ise PASS.
 * 2. Kaleye yeterince yakınsa SHOOT.
 * 3. Aksi takdirde DRIBBLE.
 */
function chooseBallAction(state: MatchState, playerId: string): DecisionAction {
  const player = state.players[playerId];
  if (!player) throw new Error('live-v2 decision: unknown player ' + playerId);

  // 1️⃣ Baskı kontrolü (rakip oyuncuların mesafesi)
  const pressure = Object.values(state.players)
    .filter((p) => p.team !== player.team)
    .map((p) => Math.hypot(p.position.x - player.position.x, p.position.y - player.position.y))
    .sort((a, b) => a - b)[0];

  if (pressure !== undefined && pressure < 5) {
    return 'PASS';
  }

  // 2️⃣ Kaleye yakınlık kontrolü
  const goalX = player.team === 'HOME' ? state.pitch.length : 0;
  if (Math.abs(goalX - player.position.x) <= 18) {
    return 'SHOOT';
  }

  // 3️⃣ Diğer durumlarda sürükle (dribble)
  return 'DRIBBLE';
}

export function decide(state: MatchState, perception: PerceptionSnapshot): DecisionIntent[] {
  return Object.values(state.players)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((player) => {
      if (state.ball.ownerId === player.id) {
        return {
          playerId: player.id,
          displacement: { x: 0, y: 0 },
          action: chooseBallAction(state, player.id),
        };
      }
      const target = perception.players[player.id]?.ballPosition;
      return {
        playerId: player.id,
        displacement: target ? direction(player.position, target) : { x: 0, y: 0 },
        action: target ? 'CHASE' : 'POSITION',
      };
    });
}
