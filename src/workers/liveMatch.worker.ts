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

type FramePlayer = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  isHome: boolean;
  role: string;
  facing: number;
  intent: string;
  isBallOwner: boolean;
  isChasingBall: boolean;
  isMarking: string | null;
  decisionReason: string | null;
  targetX: number | null;
  targetY: number | null;
  targetPlayerId: string | null;
};

type Frame = {
  time: number;
  tick: number;
  phase: string;
  score: { home: number; away: number };
  transition: {
    counterPressClubId: string | null;
    breakClubId: string | null;
    counterPressProbability: number;
    breakQuality: number;
    expiresAt: number;
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
  players: FramePlayer[];
};

type DebugRecording = {
  version: 2;
  sampleEveryTicks: number;
  maxSimulationSeconds: number;
  startedAt: number;
  frames: Frame[];
};

type WorkerScope = {
  onmessage: ((event: MessageEvent<StartMessage>) => void) | null;
  postMessage: (message: unknown) => void;
};

const scope = self as unknown as WorkerScope;

const DEBUG_SAMPLE_TICKS = 10;
const DEBUG_MAX_SECONDS = 300;

function compactFrame(state: LiveMatchState): Frame {
  return {
    time: state.time,
    tick: state.tick,
    phase: state.phase,
    score: { ...state.score },
    transition: {
      counterPressClubId: state.transition.counterPressClubId,
      breakClubId: state.transition.breakClubId,
      counterPressProbability: state.transition.counterPressProbability,
      breakQuality: state.transition.breakQuality,
      expiresAt: state.transition.expiresAt,
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
    players: Object.keys(state.players).sort().map(id => {
      const p = state.players[id];
      const decision = state.decisions[id]?.decision ?? p.currentDecision;

      return {
        id,
        x: p.position.x,
        y: p.position.y,
        vx: p.velocity.x,
        vy: p.velocity.y,
        homeX: p.homePosition.x,
        homeY: p.homePosition.y,
        isHome: p.isHome,
        role: p.role,
        facing: p.facing,
        intent: p.currentIntent,
        isBallOwner: p.isBallOwner,
        isChasingBall: p.isChasingBall,
        isMarking: p.isMarking,
        decisionReason: state.decisions[id]?.reason ?? decision?.reason ?? null,
        targetX: decision?.target?.x ?? null,
        targetY: decision?.target?.y ?? null,
        targetPlayerId: decision?.targetPlayerId ?? null,
      };
    }),
  };
}

function sendFrame(state: LiveMatchState): void {
  scope.postMessage({
    type: 'frame',
    ...compactFrame(state),
  });
}

scope.onmessage = (event) => {
  if (event.data.type !== 'start') return;
  const data = event.data;

  try {
    const debug: DebugRecording = {
      version: 2,
      sampleEveryTicks: DEBUG_SAMPLE_TICKS,
      maxSimulationSeconds: DEBUG_MAX_SECONDS,
      startedAt: Date.now(),
      frames: [],
    };

    const result = simulateMatchLive(data.home, data.away, data.players, {
      week: data.week,
      userLineup: data.userLineup,
      seed: data.seed,
      onTick: (state) => {
        if (state.tick % 5 === 0 || state.isFinished) {
          sendFrame(state);
        }

        if (
          state.tick % DEBUG_SAMPLE_TICKS === 0 &&
          state.time <= DEBUG_MAX_SECONDS
        ) {
          debug.frames.push(compactFrame(state));
        }
      },
    });

    scope.postMessage({
      type: 'complete',
      result,
      debug,
    } satisfies {
      type: 'complete';
      result: Match;
      debug: DebugRecording;
    });
  } catch (error) {
    scope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
