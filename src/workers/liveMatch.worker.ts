import { simulateMatchLive } from '../engine/live';
import type { Club, Match, Player, LiveMatchState } from '../engine/types';

type StartMessage = {
  type: 'start';
  home: Club;
  away: Club;
  players: Record<string, Player>;
  week: number;
  userLineup?: string[];
  seed: number;
};

type FramePlayer = { id: string; x: number; y: number; isHome: boolean; facing: number; intent: string };
type Frame = {
  type: 'frame';
  time: number;
  phase: string;
  score: { home: number; away: number };
  ball: { x: number; y: number; z: number; ownerId: string | null };
  players: FramePlayer[];
};

type WorkerScope = {
  onmessage: ((event: MessageEvent<StartMessage>) => void) | null;
  postMessage: (message: unknown) => void;
};

const scope = self as unknown as WorkerScope;

function sendFrame(state: LiveMatchState): void {
  scope.postMessage({
    type: 'frame',
    time: state.time,
    phase: state.phase,
    score: { ...state.score },
    ball: {
      x: state.ball.position.x,
      y: state.ball.position.y,
      z: state.ball.position.z,
      ownerId: state.ball.ownerId,
    },
    players: Object.keys(state.players).sort().map(id => {
      const p = state.players[id];
      return {
        id,
        x: p.position.x,
        y: p.position.y,
        isHome: p.isHome,
        facing: p.facing,
        intent: p.currentIntent,
      };
    }),
  } satisfies Frame);
}

scope.onmessage = (event) => {
  if (event.data.type !== 'start') return;
  const data = event.data;

  try {
    const result = simulateMatchLive(data.home, data.away, data.players, {
      week: data.week,
      userLineup: data.userLineup,
      seed: data.seed,
      onTick: (state) => {
        if (state.tick % 5 === 0 || state.isFinished) sendFrame(state);
      },
    });

    scope.postMessage({ type: 'complete', result } satisfies { type: 'complete'; result: Match });
  } catch (error) {
    scope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
