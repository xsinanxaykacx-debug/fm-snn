import type { MatchState } from '../state';

export type LiveFramePlayer = {
  id: string;
  x: number;
  y: number;
  isHome: boolean;
  facing: number;
  intent: string;
};

export type LiveFrame = {
  type: 'frame';
  time: number;
  tick: number;
  phase: string;
  score: {
    home: number;
    away: number;
  };
  ball: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    ownerId: string | null;
    lastTouchId: string | null;
  };
  players: LiveFramePlayer[];
};

/**
 * Convert immutable live-v2 MatchState into the frame shape expected by the
 * existing live-match UI boundary.
 *
 * This adapter is deliberately standalone: it does not import UI modules,
 * workers, or the legacy engine.
 */
export function toLiveFrame(
  state: MatchState,
  tick: number,
  time: number,
): LiveFrame {
  const players = Object.values(state.players)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((player) => ({
      id: player.id,
      x: player.position.x,
      y: player.position.y,
      isHome: player.team === 'HOME',
      facing: Math.atan2(player.velocity.y, player.velocity.x),
      intent: 'UNKNOWN',
    }));

  return {
    type: 'frame',
    time,
    tick,
    phase: state.phase,
    score: {
      home: state.score.home,
      away: state.score.away,
    },
    ball: {
      x: state.ball.position.x,
      y: state.ball.position.y,
      z: state.ball.position.z,
      vx: state.ball.velocity.x,
      vy: state.ball.velocity.y,
      ownerId: state.ball.ownerId,
      lastTouchId: state.ball.lastTouchId,
    },
    players,
  };
}
