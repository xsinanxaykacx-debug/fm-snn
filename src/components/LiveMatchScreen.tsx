import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
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

export function LiveMatchScreen() {
  const state = useGameStore();
  const applyLiveMatchResult = useGameStore(s => s.applyLiveMatchResult);
  const [frame, setFrame] = useState<LiveFrame | null>(null);
  const [result, setResult] = useState<Match | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveFrame['latestEvent'][]>([]);
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
    setLiveEvents([]);
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
        if (message.latestEvent) {
          setLiveEvents(previous => {
            const last = previous[previous.length - 1];
            if (last?.minute === message.latestEvent?.minute && last?.description === message.latestEvent?.description) return previous;
            return [...previous, message.latestEvent].slice(-14);
          });
        }
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
      seed: Date.now(),
    });
  }

  function saveResult() {
    if (!result) return;

    applyLiveMatchResult(result);
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

        <div className="space-y-4">
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-widest">Maç Akışı</div>
                <div className="text-white font-bold mt-1">Canlı yorum</div>
              </div>
              <div className="text-xs text-slate-500">{liveEvents.length} olay</div>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {liveEvents.length === 0 && <div className="text-sm text-slate-500 py-6 text-center">Başlama vuruşu bekleniyor...</div>}
              {[...liveEvents].reverse().map((event, index) => (
                <div key={event?.minute + '-' + event?.description + '-' + index} className="flex gap-3 p-2 rounded-lg bg-pitch-800/80 border border-pitch-700">
                  <div className="text-accent font-black text-xs tabular-nums w-9">{event?.minute}'</div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-300 uppercase">{event?.type?.replace('_', ' ')}</div>
                    <div className="text-sm text-white leading-snug">{event?.description}</div>
                    {event?.xG !== undefined && <div className="text-[10px] text-slate-500 mt-1">xG {event.xG.toFixed(2)}</div>}
                  </div>
                </div>
              ))}
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

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-pitch-800 rounded p-3"><div className="text-slate-500">Faz</div><div className="text-white font-bold mt-1">{frame?.phase ?? 'kickoff'}</div></div>
            <div className="bg-pitch-800 rounded p-3"><div className="text-slate-500">Motor</div><div className="text-white font-bold mt-1">10 Hz</div></div>
          </div>
          <div className="text-xs text-slate-500">104 × 64 m gerçek saha koordinatları • oyuncu ve top hareketi doğrudan canlı motordan gelir.</div>

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
      {result && (
        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-accent">Maç Sonu</div>
              <div className="text-2xl font-black text-white mt-1">{home.name} {result.homeScore} — {result.awayScore} {away.name}</div>
            </div>
            <button onClick={saveResult} className="btn-primary px-5 py-3 font-bold">✓ SONUCU KAYDET</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            {[
              ['Şut', result.stats.shots.home, result.stats.shots.away],
              ['İsabet', result.stats.onTarget.home, result.stats.onTarget.away],
              ['xG', result.stats.xG?.home ?? 0, result.stats.xG?.away ?? 0],
              ['Pas', result.stats.passes?.home ?? 0, result.stats.passes?.away ?? 0],
              ['Başarılı Pas', result.stats.passesCompleted?.home ?? 0, result.stats.passesCompleted?.away ?? 0],
              ['Çalım', result.stats.dribbles?.home ?? 0, result.stats.dribbles?.away ?? 0],
              ['Korner', result.stats.corners?.home ?? 0, result.stats.corners?.away ?? 0],
              ['Faul', result.stats.fouls?.home ?? 0, result.stats.fouls?.away ?? 0],
            ].map(([label, h, a]) => (
              <div key={String(label)} className="bg-pitch-800 rounded-lg p-3 text-center">
                <div className="text-[10px] text-slate-500 uppercase">{label}</div>
                <div className="text-white font-black mt-1">{typeof h === 'number' ? h.toFixed(label === 'xG' ? 2 : 0) : h} <span className="text-slate-600">—</span> {typeof a === 'number' ? a.toFixed(label === 'xG' ? 2 : 0) : a}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid lg:grid-cols-2 gap-3">
            <div className="bg-pitch-800 rounded-lg p-3">
              <div className="text-xs text-slate-500 uppercase mb-2">Maç raporu</div>
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {result.events.slice(-18).reverse().map((event, index) => (
                  <div key={event.minute + '-' + event.type + '-' + index} className="text-sm text-slate-300"><span className="text-accent font-bold">{event.minute}'</span> {event.description}</div>
                ))}
              </div>
            </div>
            <div className="bg-pitch-800 rounded-lg p-3">
              <div className="text-xs text-slate-500 uppercase mb-2">Pas verimliliği</div>
              <div className="text-3xl font-black text-white">
                {(result.stats.passes?.home ?? 0) + (result.stats.passes?.away ?? 0) > 0
                  ? (((result.stats.passesCompleted?.home ?? 0) + (result.stats.passesCompleted?.away ?? 0)) / ((result.stats.passes?.home ?? 0) + (result.stats.passes?.away ?? 0)) * 100).toFixed(1)
                  : '0.0'}%
              </div>
              <div className="text-xs text-slate-500 mt-1">toplam başarılı pas / toplam pas</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
