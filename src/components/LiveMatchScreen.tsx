import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { createMatchSeed } from '../engine/live';
import type { Match } from '../engine/types';

type FramePlayer = {
  id: string;
  x: number;
  y: number;
  isHome: boolean;
  facing: number;
  intent: string;
};

type LiveFrame = {
  type: 'frame';
  time: number;
  tick: number;
  phase: string;
  score: { home: number; away: number };
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

type DebugFrame = Omit<LiveFrame, 'type'> & {
  players: Array<{
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
  }>;
};

type DebugRecording = {
  version: 1;
  sampleEveryTicks: number;
  maxSimulationSeconds: number;
  startedAt: number;
  frames: DebugFrame[];
};

type WorkerMessage =
  | LiveFrame
  | { type: 'complete'; result: Match; debug: DebugRecording }
  | { type: 'error'; message: string };

declare global {
  interface Window {
    __LIVE_MATCH_DEBUG__?: DebugRecording;
    dumpLiveMatchDebug?: () => DebugRecording | null;
    copyLiveMatchDebug?: () => Promise<void>;
    downloadLiveMatchDebug?: () => void;
  }
}

const PITCH_W = 104;
const PITCH_H = 64;

function formatClock(seconds: number): string {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

function installDebugConsole(): void {
  window.dumpLiveMatchDebug = () => {
    const debug = window.__LIVE_MATCH_DEBUG__ ?? null;

    if (!debug) {
      console.warn('Henüz canlı maç debug kaydı yok. Önce bir canlı maç tamamla.');
      return null;
    }

    console.log('LIVE MATCH DEBUG', debug);
    console.table(
      debug.frames.map(frame => ({
        time: frame.time,
        tick: frame.tick,
        phase: frame.phase,
        score: `${frame.score.home}-${frame.score.away}`,
        ballX: Number(frame.ball.x.toFixed(2)),
        ballY: Number(frame.ball.y.toFixed(2)),
        owner: frame.ball.ownerId,
      }))
    );

    return debug;
  };

  window.copyLiveMatchDebug = async () => {
    const debug = window.__LIVE_MATCH_DEBUG__;

    if (!debug) {
      console.warn('Henüz canlı maç debug kaydı yok.');
      return;
    }

    const json = JSON.stringify(debug, null, 2);
    await navigator.clipboard.writeText(json);
    console.log(
      `LIVE MATCH DEBUG panoya kopyalandı. ${debug.frames.length} frame.`
    );
  };

  window.downloadLiveMatchDebug = () => {
    const debug = window.__LIVE_MATCH_DEBUG__;

    if (!debug) {
      console.warn('Henüz canlı maç debug kaydı yok.');
      return;
    }

    const blob = new Blob(
      [JSON.stringify(debug, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `live-match-debug-${Date.now()}.json`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);

    console.log(
      `LIVE MATCH DEBUG indirildi. ${debug.frames.length} frame.`
    );
  };
}

export function bindLiveMatchToFixture(result: Match, fixture: Match): Match {
  return {
    ...result,
    id: fixture.id,
    week: fixture.week,
    homeId: fixture.homeId,
    awayId: fixture.awayId,
  };
}

export function LiveMatchScreen() {
  const state = useGameStore();
  const applyLiveMatchResult = useGameStore(s => s.applyLiveMatchResult);
  const [frame, setFrame] = useState<LiveFrame | null>(null);
  const [result, setResult] = useState<Match | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const fixture = useMemo(() => state.fixtures.find(m =>
    m.week === state.currentWeek &&
    !m.played &&
    (m.homeId === state.userClubId || m.awayId === state.userClubId)
  ), [state.fixtures, state.currentWeek, state.userClubId]);

  const home = fixture ? state.clubs[fixture.homeId!] : null;
  const away = fixture ? state.clubs[fixture.awayId!] : null;

  useEffect(() => {
    installDebugConsole();

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  function startMatch() {
    if (!fixture || !home || !away || running) return;

    workerRef.current?.terminate();

    setFrame(null);
    setResult(null);
    setError(null);
    setRunning(true);

    window.__LIVE_MATCH_DEBUG__ = undefined;

    const worker = new Worker(
      new URL('../workers/liveMatch.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      if (message.type === 'frame') {
        setFrame(message);
        return;
      }

      if (message.type === 'complete') {
        window.__LIVE_MATCH_DEBUG__ = message.debug;

        console.log(
          `LIVE MATCH DEBUG hazır: ${message.debug.frames.length} frame, ilk ${message.debug.maxSimulationSeconds} saniye.`
        );

        setResult(message.result);
        setRunning(false);
        return;
      }

      if (message.type === 'error') {
        setError(message.message);
        setRunning(false);
      }
    };

    worker.onerror = event => {
      setError(event.message || 'Canlı maç worker hatası');
      setRunning(false);
    };

    worker.postMessage({
      type: 'start',
      home,
      away,
      players: state.players,
      week: state.currentWeek,
      userLineup: state.userLineup,
      seed: createMatchSeed(
        `${state.season}:${fixture.id ?? `${fixture.week}:${fixture.homeId}:${fixture.awayId}`}`,
        fixture.week ?? state.currentWeek
      ),
    });
  }

  function saveResult() {
    if (!result || !fixture) return;

    // The live engine creates its own result id. The fixture store must retain
    // the original fixture identity so the completed match replaces that row.
    applyLiveMatchResult(bindLiveMatchToFixture(result, fixture));
    setResult(null);
    setRunning(false);
  }

  if (!fixture || !home || !away) {
    return (
      <div className="glass-panel rounded-xl p-10 text-center">
        <div className="text-4xl mb-3">⚽</div>
        <h2 className="text-xl font-bold text-white">Canlı Maç</h2>
        <p className="text-slate-400 mt-2">Bu hafta oynanacak bir lig maçı bulunmuyor.</p>
      </div>
    );
  }

  const displayScore = result
    ? `${result.homeScore} - ${result.awayScore}`
    : `${frame?.score.home ?? 0} - ${frame?.score.away ?? 0}`;

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500">Canlı Maç • Hafta {state.currentWeek}</div>
            <div className="text-xl font-bold text-white mt-1">{home.name} <span className="text-slate-500">vs</span> {away.name}</div>
          </div>

          <div className="text-center min-w-[150px]">
            <div className="text-3xl font-black text-white tabular-nums">{displayScore}</div>
            <div className="text-xs text-accent mt-1">{formatClock(frame?.time ?? 0)} • {frame?.phase ?? 'kickoff'}</div>
          </div>

          {!running && !result && (
            <button onClick={startMatch} className="btn-primary px-5 py-3 font-bold">
              ▶ MAÇI BAŞLAT
            </button>
          )}

          {running && (
            <div className="px-4 py-2 rounded bg-green-500/10 border border-green-500/30 text-green-400 font-bold">
              ● CANLI
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <div className="glass-panel rounded-xl p-3">
          <div className="relative w-full aspect-[104/64] overflow-hidden rounded-lg bg-[#197548] border-4 border-white/20">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-y-0 left-1/2 border-l border-white/60" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[17.6%] aspect-square rounded-full border border-white/60" />
              <div className="absolute left-0 top-[18.5%] w-[15.9%] h-[63%] border-r border-y border-white/60" />
              <div className="absolute right-0 top-[18.5%] w-[15.9%] h-[63%] border-l border-y border-white/60" />
              <div className="absolute left-0 top-[31.25%] w-[5.3%] h-[37.5%] border-r border-y border-white/60" />
              <div className="absolute right-0 top-[31.25%] w-[5.3%] h-[37.5%] border-l border-y border-white/60" />
              <div className="absolute inset-0 border border-white/50" />
            </div>

            {frame?.players.map(p => (
              <div
                key={p.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full border-2 border-white shadow-lg text-[8px] font-black text-white"
                style={{
                  left: `${(p.x / PITCH_W) * 100}%`,
                  top: `${(p.y / PITCH_H) * 100}%`,
                  width: '2.8%',
                  aspectRatio: '1',
                  background: p.isHome ? '#2563eb' : '#dc2626',
                  transition: 'left 80ms linear, top 80ms linear',
                }}
                title={`${state.players[p.id]?.name ?? p.id} • ${p.intent}`}
              >
                {state.players[p.id]?.id ? p.id.slice(-2) : ''}
              </div>
            ))}

            {frame && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 border-slate-700 shadow-xl"
                style={{
                  left: `${(frame.ball.x / PITCH_W) * 100}%`,
                  top: `${(frame.ball.y / PITCH_H) * 100}%`,
                  width: frame.ball.z > 0.5 ? '1.2%' : '1%',
                  aspectRatio: '1',
                  transition: 'left 80ms linear, top 80ms linear',
                }}
              />
            )}
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4 space-y-4">
          <div>
            <div className="text-xs text-slate-500 uppercase">Motor</div>
            <div className="text-white font-bold mt-1">LIVE ENGINE 1.0</div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-pitch-800 rounded p-3">
              <div className="text-slate-500">Skor</div>
              <div className="text-white text-lg font-bold">{displayScore}</div>
            </div>

            <div className="bg-pitch-800 rounded p-3">
              <div className="text-slate-500">Top sahibi</div>
              <div className="text-white text-lg font-bold">
                {frame?.ball.ownerId ? frame.ball.ownerId.slice(-2) : '—'}
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Oyuncu noktaları gerçek motor koordinatlarından çiziliyor: 104 × 64 m.
          </div>

          {error && (
            <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div className="p-3 rounded bg-green-500/10 border border-green-500/30 text-green-300 text-sm">
                Maç tamamlandı: {result.homeScore}-{result.awayScore}
              </div>

              <button
                onClick={saveResult}
                className="w-full py-3 rounded bg-accent text-slate-950 font-bold"
              >
                ✓ SONUCU FİKSTÜRE İŞLE
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
