import { createMatchState, type MatchLineup } from '../engine/live-v2/adapters/matchStateFactory';
import { createV2MatchSeed } from '../engine/live-v2/adapters/matchSeed';
import { toLiveFrame } from '../engine/live-v2/adapters/liveFrame';
import { shouldEmitFrame, ticksPerFrame } from '../engine/live-v2/adapters/tickLoopScheduler';
import { runTick } from '../engine/live-v2/tick';
import type { RngState } from '../engine/live-v2/rng';
import type { Pitch, MatchState } from '../engine/live-v2/state';
import type { Match, MatchEvent as MatchResultEvent } from '../engine/types';

type StartMessage = {
  type: 'start';
  home: { id: string; lineup?: string[] };
  away: { id: string; lineup?: string[] };
  players: Record<string, { id: string; clubId: string | null }>;
  userClubId: string;
  userLineup?: string[];
  season: number;
  week: number;
  fixture: string;
  seed?: RngState;
  pitch: Pitch;
};

type DebugRecording = {
  version: 1;
  sampleEveryTicks: number;
  maxSimulationSeconds: number;
  startedAt: number;
  frames: ReturnType<typeof toLiveFrame>[];
};

type WorkerScope = {
  onmessage: ((event: MessageEvent<StartMessage>) => void) | null;
  postMessage: (message: unknown) => void;
};

const scope = self as unknown as WorkerScope;
const TICKS_PER_FRAME = 6;
const FRAME_INTERVAL_MS = 100;
const MAX_TICKS = 5400;

function resolvePlayerIds(
  clubId: string,
  configuredLineup: string[] | undefined,
  userClubId: string,
  userLineup: string[] | undefined,
  players: StartMessage['players'],
): string[] {
  const preferred = clubId === userClubId ? userLineup : configuredLineup;
  const fallback = Object.values(players)
    .filter((player) => player.clubId === clubId)
    .map((player) => player.id)
    .sort();

  const ids = preferred && preferred.length > 0 ? preferred : fallback;

  if (ids.length < 11) {
    throw new Error(`live-v2 worker: club ${clubId} has fewer than 11 players`);
  }

  return ids;
}

function buildLineup(
  club: { id: string; lineup?: string[] },
  userClubId: string,
  userLineup: string[] | undefined,
  players: StartMessage['players'],
): MatchLineup {
  const ids=resolvePlayerIds(club.id,club.lineup,userClubId,userLineup,players);
  return {clubId:club.id,players:ids.slice(0,14).map((id)=>({id}))};
}

function eventToMatchEvent(
  event: MatchState['events'][number],
  state: MatchState,
): MatchResultEvent {
  const minute = Math.floor(state.clockSeconds / 60);

  if (event.type === 'goal') {
    return {
      minute,
      type: 'goal',
      team: event.scorerSide === 'HOME' ? 'home' : 'away',
      description: `${event.scorerSide === 'HOME' ? 'HOME' : 'AWAY'} gol`,
    };
  }

  return {
    minute,
    type: event.type,
    team: event.type === 'goal_kick' || event.type === 'corner' || event.type === 'throw_in'
      ? event.side === 'HOME' ? 'home' : 'away'
      : undefined,
    description: event.type,
  };
}

function toTemporaryMatchResult(
  state: MatchState,
  homeId: string,
  awayId: string,
): Match {
  return {
    homeId,
    awayId,
    homeScore: state.score.home,
    awayScore: state.score.away,
    events: state.events.map((event) => eventToMatchEvent(event, state)),
    stats: {
      possession: { home: 50, away: 50 },
      shots: { home: 0, away: 0 },
      onTarget: { home: 0, away: 0 },
      chances: { home: 0, away: 0 },
    },
    played: true,
    engine: 'live-v2',
  };
}

scope.onmessage = (event) => {
  if (event.data.type !== 'start') return;

  let intervalId: ReturnType<typeof setInterval> | null = null;

  try {
    const data = event.data;
    const seed = data.seed ?? createV2MatchSeed(data.season, data.fixture, data.week);
    const state = createMatchState(
      buildLineup(data.home, data.userClubId, data.userLineup, data.players),
      buildLineup(data.away, data.userClubId, data.userLineup, data.players),
      seed,
      data.pitch,
    );

    const debug: DebugRecording = {
      version: 1,
      sampleEveryTicks: TICKS_PER_FRAME,
      maxSimulationSeconds: MAX_TICKS,
      startedAt: Date.now(),
      frames: [],
    };

    let current = state;

    intervalId = setInterval(() => {
      try {
        for (let i = 0; i < ticksPerFrame(TICKS_PER_FRAME); i += 1) {
          if (current.tick >= MAX_TICKS) break;
          current = runTick(current);
        }

        if (shouldEmitFrame(current.tick, TICKS_PER_FRAME) || current.phase === 'full_time') {
          const frame = toLiveFrame(current, current.tick, current.clockSeconds);
          scope.postMessage(frame);

          if (current.clockSeconds <= 300) {
            debug.frames.push(frame);
          }
        }

        if (current.tick >= MAX_TICKS || current.phase === 'full_time') {
          if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
          }

          scope.postMessage({
            type: 'complete',
            result: toTemporaryMatchResult(current, data.home.id, data.away.id),
            debug,
          });
        }
      } catch (error) {
        if (intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }

        scope.postMessage({
          type: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }, FRAME_INTERVAL_MS);
  } catch (error) {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }

    scope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
