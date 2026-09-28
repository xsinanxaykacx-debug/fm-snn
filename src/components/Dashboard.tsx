// src/components/Dashboard.tsx

import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { sortedTable } from '../engine/league/table';
import { TeamBadge } from './TeamBadge';
import { FormBadge } from './FormBadge';
import { getTeamColor } from '../utils/teamColors';

declare global {
  interface Window {
    Chart: any;
  }
}

interface Props {
  onNavigate: (tab: any) => void;
}

// ═══════════════════════════════════════════════
// FORM GRAFİĞİ (xG trendi)
// ═══════════════════════════════════════════════

function FormChart({ clubId }: { clubId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const state = useGameStore();

  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;

    if (chartRef.current) chartRef.current.destroy();

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Son 8 maçı al
    const last8 = [...state.fixtures]
      .filter(m => m.played && (m.homeId === clubId || m.awayId === clubId))
      .sort((a, b) => (a.week ?? 0) - (b.week ?? 0))
      .slice(-8);

    const labels = last8.map(m => `H${m.week}`);
    const xGFor: number[] = [];
    const xGAgainst: number[] = [];
    const goalsFor: number[] = [];
    const goalsAgainst: number[] = [];

    last8.forEach(m => {
      const isHome = m.homeId === clubId;
      const stats = m.stats as any;
      xGFor.push(isHome ? (stats.xG?.home ?? 0) : (stats.xG?.away ?? 0));
      xGAgainst.push(isHome ? (stats.xG?.away ?? 0) : (stats.xG?.home ?? 0));
      goalsFor.push(isHome ? m.homeScore : m.awayScore);
      goalsAgainst.push(isHome ? m.awayScore : m.homeScore);
    });

    chartRef.current = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'xG (Biz)',
            data: xGFor,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
          },
          {
            label: 'xG (Rakip)',
            data: xGAgainst,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
          },
          {
            label: 'Gol (Biz)',
            data: goalsFor,
            borderColor: '#06b6d4',
            borderDash: [5, 5],
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 2,
          },
          {
            label: 'Gol (Rakip)',
            data: goalsAgainst,
            borderColor: '#f59e0b',
            borderDash: [5, 5],
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 2,
          },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { size: 10 } },
          },
        },
        scales: {
          x: {
            ticks: { color: '#64748b', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
          y: {
            ticks: { color: '#64748b', font: { size: 10 } },
            grid: { color: 'rgba(255,255,255,0.05)' },
            beginAtZero: true,
          },
        },
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [clubId, state.fixtures]);

  if (!state.fixtures.some(m => m.played && (m.homeId === clubId || m.awayId === clubId))) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-500 text-xs">
        Henüz oynanmış maç yok
      </div>
    );
  }

  return (
    <div className="relative w-full h-48">
      <canvas ref={canvasRef} />
    </div>
  );
}

// ═══════════════════════════════════════════════
// ANA COMPONENT
// ═══════════════════════════════════════════════

export function Dashboard({ onNavigate }: Props) {
  const state = useGameStore();
  const userClub = state.clubs[state.userClubId];
  const table = sortedTable(state.table);
  const userPos = table.findIndex(r => r.clubId === state.userClubId) + 1;
  const userRow = table.find(r => r.clubId === state.userClubId);

  const nextMatch = state.fixtures.find(
    m => m.week === state.currentWeek && !m.played &&
      (m.homeId === state.userClubId || m.awayId === state.userClubId)
  );
  const opponent = nextMatch
    ? state.clubs[nextMatch.homeId === state.userClubId ? nextMatch.awayId : nextMatch.homeId]
    : null;
  const isHome = nextMatch?.homeId === state.userClubId;

  const last5 = [...state.fixtures]
    .filter(m => m.played && (m.homeId === state.userClubId || m.awayId === state.userClubId))
    .sort((a, b) => (b.week ?? 0) - (a.week ?? 0))
    .slice(0, 5)
    .map(m => {
      const isUserHome = m.homeId === state.userClubId;
      const ourScore = isUserHome ? m.homeScore : m.awayScore;
      const theirScore = isUserHome ? m.awayScore : m.homeScore;
      const result: 'W' | 'D' | 'L' =
        ourScore > theirScore ? 'W' :
        ourScore < theirScore ? 'L' : 'D';
      const oppId = isUserHome ? m.awayId : m.homeId;
      return {
        match: m,
        result,
        opponent: state.clubs[oppId!],
        ourScore,
        theirScore,
        isHome: isUserHome,
      };
    });

  const injured = Object.values(state.players)
    .filter(p => p.clubId === state.userClubId && p.injuryWeeks > 0)
    .slice(0, 3);

  const suspended = Object.values(state.players)
    .filter(p => p.clubId === state.userClubId && p.suspensionWeeks > 0)
    .slice(0, 3);

  const userColor = getTeamColor(state.userClubId);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div
        className="glass-panel rounded-xl p-5 flex items-center gap-4"
        style={{
          background: `linear-gradient(135deg, ${userColor.bg}20 0%, ${userColor.bg}05 100%)`,
          borderColor: `${userColor.bg}40`,
        }}
      >
        <TeamBadge clubId={state.userClubId} shortName={userClub?.shortName ?? '???'} size="xl" />
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white">{userClub?.name}</h2>
          <p className="text-sm text-slate-400">
            Sezon {state.season} • Hafta {state.currentWeek}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-400">Lig Sıralaması</div>
          <div className="text-3xl font-bold" style={{ color: userColor.bg }}>
            {userPos}.
          </div>
          <div className="text-xs text-slate-500">{userRow?.points ?? 0} puan</div>
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {opponent && nextMatch ? (
          <div
            className="glass-panel rounded-xl p-5"
            style={{
              background: `linear-gradient(135deg, ${getTeamColor(opponent.id).bg}20 0%, transparent 100%)`,
              borderColor: `${getTeamColor(opponent.id).bg}50`,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">⚽ Sıradaki Maç</h3>
              <span className="text-xs text-slate-400">
                {isHome ? '🏠 Ev Sahibi' : '✈️ Deplasman'}
              </span>
            </div>

            <div className="flex items-center justify-center gap-6 py-4">
              <div className="text-center">
                <TeamBadge clubId={state.userClubId} shortName={userClub?.shortName ?? '???'} size="lg" />
                <p className="text-xs text-slate-400 mt-2">{userClub?.shortName}</p>
              </div>
              <div className="text-3xl font-bold text-slate-500">vs</div>
              <div className="text-center">
                <TeamBadge clubId={opponent.id} shortName={opponent.shortName} size="lg" />
                <p className="text-xs text-slate-400 mt-2">{opponent.shortName}</p>
              </div>
            </div>

            <div className="text-center text-xs text-slate-500 mb-4">
              Hafta {nextMatch.week} • Stadyum: {userClub?.stadiumCapacity.toLocaleString()} kişi
            </div>

            <button
              onClick={() => onNavigate('match')}
              className="w-full py-3 rounded-md font-bold text-white transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: '#22c55e',
                boxShadow: '0 0 20px rgba(34,197,94,0.4)',
              }}
            >
              ▶ Haftayı Oyna
            </button>
          </div>
        ) : (
          <div className="glass-panel rounded-xl p-5 flex items-center justify-center text-slate-500 py-12">
            Bu hafta maçın yok.
          </div>
        )}

        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-white">📊 Lig Durumu</h3>
            <button
              onClick={() => onNavigate('table')}
              className="text-xs text-accent hover:underline"
            >
              Tümünü Gör →
            </button>
          </div>

          <div className="space-y-1">
            {table.slice(0, 5).map((row, i) => {
              const club = state.clubs[row.clubId];
              const isUser = row.clubId === state.userClubId;
              return (
                <div
                  key={row.clubId}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                    isUser ? 'bg-accent/10 border border-accent/30' : ''
                  }`}
                >
                  <span className="w-5 text-slate-500 text-xs">{i + 1}.</span>
                  <TeamBadge clubId={row.clubId} shortName={club?.shortName ?? '???'} size="xs" />
                  <span className="flex-1 truncate text-slate-200">{club?.shortName}</span>
                  <span className="text-xs text-slate-400">{row.played} maç</span>
                  <span className="font-bold text-xs w-8 text-right text-white">{row.points}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FORM GRAFİĞİ */}
      <div className="glass-panel rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-white">📈 Form Grafiği (Son 8 Maç)</h3>
          <div className="text-[10px] text-slate-500 flex gap-3">
            <span>🟢 xG (Biz)</span>
            <span>🔴 xG (Rakip)</span>
            <span>🔵 Gol (Biz)</span>
            <span>🟠 Gol (Rakip)</span>
          </div>
        </div>
        <FormChart clubId={state.userClubId} />
      </div>

      {/* SON 5 MAÇ */}
      {last5.length > 0 && (
        <div className="glass-panel rounded-xl p-5">
          <h3 className="text-lg font-bold mb-3 text-white">📈 Son Maçlar</h3>
          <div className="space-y-2">
            {last5.map(({ match, result, opponent: opp, ourScore, theirScore, isHome }) => (
              <div
                key={match.id}
                className="flex items-center gap-3 px-3 py-2 rounded hover:bg-pitch-700/30 transition-colors"
              >
                <span className="text-xs text-slate-500 w-10">H{match.week}</span>
                <FormBadge result={result} size="sm" />
                <span className="text-xs text-slate-500 w-6">
                  {isHome ? '🏠' : '✈️'}
                </span>
                <TeamBadge clubId={opp?.id ?? ''} shortName={opp?.shortName ?? '???'} size="xs" />
                <span className="flex-1 text-sm truncate text-slate-200">{opp?.name}</span>
                <span className="font-bold text-sm text-white">
                  {ourScore} - {theirScore}
                </span>
                <span className="text-xs text-slate-500 w-20 text-right">
                  xG: {(match.stats as any)?.xG?.home?.toFixed(1) ?? '?'} - {(match.stats as any)?.xG?.away?.toFixed(1) ?? '?'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SAKATLAR + CEZALILAR + FİNANS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel rounded-xl p-5">
          <h3 className="text-sm font-bold mb-2 text-white">🏥 Sakatlar</h3>
          {injured.length === 0 ? (
            <p className="text-xs text-slate-500">✅ Sakat oyuncu yok</p>
          ) : (
            <div className="space-y-1">
              {injured.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate text-slate-300">{p.name}</span>
                  <span className="text-red-400">🚑 {p.injuryWeeks}h</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel rounded-xl p-5">
          <h3 className="text-sm font-bold mb-2 text-white">🟨 Cezalılar</h3>
          {suspended.length === 0 ? (
            <p className="text-xs text-slate-500">✅ Cezalı oyuncu yok</p>
          ) : (
            <div className="space-y-1">
              {suspended.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate text-slate-300">{p.name}</span>
                  <span className="text-yellow-400">🟨 {p.suspensionWeeks}h</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel rounded-xl p-5">
          <h3 className="text-sm font-bold mb-2 text-white">💰 Finans</h3>
          <div className="stat-row">
            <span className="text-xs text-slate-400">Transfer</span>
            <span className="font-bold text-accent text-sm">
              £{((userClub?.budget ?? 0) / 1_000_000).toFixed(2)}M
            </span>
          </div>
          <div className="stat-row">
            <span className="text-xs text-slate-400">Maaş</span>
            <span className="text-sm text-slate-200">£{((userClub?.wageBudget ?? 0) / 1_000).toFixed(0)}K</span>
          </div>
        </div>
      </div>

      {/* HABERLER */}
      <div className="glass-panel rounded-xl p-5">
        <h3 className="text-lg font-bold mb-3 text-white">📰 Son Haberler</h3>
        <ul className="space-y-2">
          {state.news.slice(0, 6).map((n, i) => (
            <li
              key={i}
              className="text-sm text-slate-300 border-l-2 border-pitch-600 pl-3 py-1"
            >
              {n}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}