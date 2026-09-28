// src/components/Stats.tsx

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { scorePlayer } from '../engine/data/generateData';
import { TeamBadge } from './TeamBadge';
import { PlayerDetailModal } from './PlayerDetailModal';
import type { Player } from '../engine/types';

// ═══════════════════════════════════════════════
// MEVKİ RENKLERİ
// ═══════════════════════════════════════════════

function getPosColor(position: string): { bg: string; text: string; border: string } {
  if (position === 'GK') return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40' };
  if (['DC', 'DL', 'DR'].includes(position)) return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40' };
  if (['DM', 'MC', 'ML', 'MR'].includes(position)) return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40' };
  if (['AMC', 'AML', 'AMR'].includes(position)) return { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40' };
  if (position === 'ST') return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' };
  return { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/40' };
}

// ═══════════════════════════════════════════════
// LEADERBOARD TIPLERI
// ═══════════════════════════════════════════════

type LeaderboardType = 'goals' | 'assists' | 'rating' | 'motm';
type StatsMode = 'season' | 'career';

const LEADERBOARD_TABS: { key: LeaderboardType; label: string; icon: string }[] = [
  { key: 'goals',   label: 'Gol Krallığı',    icon: '⚽' },
  { key: 'assists', label: 'Asist Krallığı',  icon: '🎯' },
  { key: 'rating',  label: 'En İyi Reyting',  icon: '⭐' },
  { key: 'motm',    label: 'En Çok MVP',      icon: '🏆' },
];

// ═══════════════════════════════════════════════
// ANA COMPONENT
// ═══════════════════════════════════════════════

export function Stats() {
  const state = useGameStore();
  const [activeTab, setActiveTab] = useState<LeaderboardType>('goals');
  const [mode, setMode] = useState<StatsMode>('season');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const allPlayers = Object.values(state.players).filter(p => p.clubId !== null);

  // ═══ MOD'A GÖRE DEĞER ALMA ═══
  const getGoals = (p: Player) =>
    mode === 'season' ? (p.careerStats?.seasonGoals ?? 0) : (p.careerStats?.goals ?? 0);

  const getAssists = (p: Player) =>
    mode === 'season' ? (p.careerStats?.seasonAssists ?? 0) : (p.careerStats?.assists ?? 0);

  const getRating = (p: Player) =>
    mode === 'season' ? (p.careerStats?.seasonAvgRating ?? 0) : (p.careerStats?.avgRating ?? 0);

  const getMotm = (p: Player) =>
    mode === 'season' ? (p.careerStats?.seasonMotm ?? 0) : (p.careerStats?.motm ?? 0);

  const getApps = (p: Player) =>
    mode === 'season' ? (p.careerStats?.seasonAppearances ?? 0) : (p.careerStats?.appearances ?? 0);

  // ═══ LİSTELERİ HESAPLA ═══
  const topScorers = allPlayers
    .filter(p => getGoals(p) > 0)
    .sort((a, b) => getGoals(b) - getGoals(a))
    .slice(0, 10);

  const topAssisters = allPlayers
    .filter(p => getAssists(p) > 0)
    .sort((a, b) => getAssists(b) - getAssists(a))
    .slice(0, 10);

  const topRated = allPlayers
    .filter(p => getApps(p) >= (mode === 'season' ? 5 : 5) && getRating(p) > 0)
    .sort((a, b) => getRating(b) - getRating(a))
    .slice(0, 10);

  const topMVP = allPlayers
    .filter(p => getMotm(p) > 0)
    .sort((a, b) => getMotm(b) - getMotm(a))
    .slice(0, 10);

  const currentList =
    activeTab === 'goals' ? topScorers :
    activeTab === 'assists' ? topAssisters :
    activeTab === 'rating' ? topRated :
    topMVP;

  const getStatValue = (p: Player): number => {
    if (activeTab === 'goals') return getGoals(p);
    if (activeTab === 'assists') return getAssists(p);
    if (activeTab === 'rating') return getRating(p);
    if (activeTab === 'motm') return getMotm(p);
    return 0;
  };

  const formatValue = (p: Player): string => {
    const v = getStatValue(p);
    if (activeTab === 'rating') return v.toFixed(2);
    return String(v);
  };

  const maxValue = currentList.length > 0
    ? Math.max(...currentList.map(p => getStatValue(p)), 1)
    : 1;

  // ═══ ÖZET İSTATİSTİKLER ═══
  const totalGoals = allPlayers.reduce((s, p) =>
    s + (mode === 'season' ? (p.careerStats?.seasonGoals ?? 0) : (p.careerStats?.goals ?? 0)), 0);

  const totalAssists = allPlayers.reduce((s, p) =>
    s + (mode === 'season' ? (p.careerStats?.seasonAssists ?? 0) : (p.careerStats?.assists ?? 0)), 0);

  const totalApps = allPlayers.reduce((s, p) =>
    s + (mode === 'season' ? (p.careerStats?.seasonAppearances ?? 0) : (p.careerStats?.appearances ?? 0)), 0);

  const userSquadCount = allPlayers.filter(p => p.clubId === state.userClubId).length;

  return (
    <div className="space-y-4">
      {/* ═══ BAŞLIK ═══ */}
      <div className="glass-panel rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">
              🏆 {mode === 'season' ? `Sezon ${state.season} İstatistikleri` : 'Kariyer İstatistikleri'}
            </h2>
            <p className="text-xs text-slate-400">
              {mode === 'season'
                ? `Bu sezonun liderleri • Hafta ${state.currentWeek}`
                : `Tüm zamanların liderleri • ${state.season} sezon`}
            </p>
          </div>

          {/* MOD SEÇİCİ */}
          <div className="flex gap-2 bg-pitch-900 rounded-lg p-1">
            <button
              onClick={() => setMode('season')}
              className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${
                mode === 'season'
                  ? 'bg-accent text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📅 Bu Sezon
            </button>
            <button
              onClick={() => setMode('career')}
              className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${
                mode === 'career'
                  ? 'bg-accent text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🏆 Kariyer
            </button>
          </div>
        </div>
      </div>

      {/* ═══ TAB SEÇİCİ ═══ */}
      <div className="glass-panel rounded-xl p-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {LEADERBOARD_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-accent text-white shadow-lg shadow-accent/30'
                  : 'bg-pitch-700 hover:bg-pitch-600 text-slate-300'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ LİDERLİK TABLOSU ═══ */}
      <div className="glass-panel rounded-xl p-5">
        {currentList.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg mb-2">📊 Henüz veri yok</p>
            <p className="text-xs text-slate-500">
              {mode === 'season'
                ? 'Bu sezon henüz maç oynanmadı'
                : 'Henüz kariyer verisi yok'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentList.map((player, index) => {
              const club = state.clubs[player.clubId!];
              const posColor = getPosColor(player.position);
              const value = getStatValue(player);
              const barWidth = (value / maxValue) * 100;

              const medalBg =
                index === 0 ? 'bg-yellow-500/20 border-yellow-500/40' :
                index === 1 ? 'bg-slate-400/20 border-slate-400/40' :
                index === 2 ? 'bg-amber-700/20 border-amber-700/40' :
                'bg-pitch-700/30 border-pitch-700/50';

              const medalIcon =
                index === 0 ? '🥇' :
                index === 1 ? '🥈' :
                index === 2 ? '🥉' :
                `#${index + 1}`;

              return (
                <div
                  key={player.id}
                  onClick={() => setSelectedPlayer(player)}
                  className={`relative overflow-hidden rounded-lg border cursor-pointer hover:scale-[1.01] transition-all ${medalBg}`}
                >
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-accent/20 to-transparent transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />

                  <div className="relative p-3 flex items-center gap-3">
                    <div className="w-10 text-center font-bold text-base">
                      {medalIcon}
                    </div>

                    <TeamBadge
                      clubId={player.clubId!}
                      shortName={club?.shortName ?? '???'}
                      size="sm"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white truncate">
                          {player.name}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${posColor.bg} ${posColor.text}`}>
                          {player.position}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span>{club?.name ?? '???'}</span>
                        <span>•</span>
                        <span>{player.age} yaş</span>
                        <span>•</span>
                        <span>{getApps(player)} maç</span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-2xl font-black text-accent tabular-nums">
                        {formatValue(player)}
                      </div>
                      <div className="text-[9px] text-slate-500 uppercase">
                        {activeTab === 'goals' ? 'gol' :
                         activeTab === 'assists' ? 'asist' :
                         activeTab === 'rating' ? 'ortalama' :
                         'MVP'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ ÖZET KARTLARI ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <TeamStatCard
          label="Senin Takımın"
          value={userSquadCount}
          icon="👥"
          suffix="oyuncu"
        />
        <TeamStatCard
          label={mode === 'season' ? 'Bu Sezon Gol' : 'Toplam Gol'}
          value={totalGoals}
          icon="⚽"
          suffix="gol"
          color="text-green-400"
        />
        <TeamStatCard
          label={mode === 'season' ? 'Bu Sezon Asist' : 'Toplam Asist'}
          value={totalAssists}
          icon="🎯"
          suffix="asist"
          color="text-blue-400"
        />
        <TeamStatCard
          label={mode === 'season' ? 'Bu Sezon Maç' : 'Toplam Maç'}
          value={totalApps}
          icon="🏟️"
          suffix="maç"
          color="text-purple-400"
        />
      </div>

      {/* ═══ SENİN TAKIMININ İSTATİSTİKLERİ ═══ */}
      <div className="glass-panel rounded-xl p-5">
        <h3 className="text-base font-bold text-white mb-3">
          🎯 {state.clubs[state.userClubId]?.name} — {mode === 'season' ? 'Bu Sezon' : 'Kariyer'}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 border-b border-pitch-700">
                <th className="py-2">Oyuncu</th>
                <th className="text-center">Poz</th>
                <th className="text-center">Yaş</th>
                <th className="text-center">Maç</th>
                <th className="text-center">Gol</th>
                <th className="text-center">Asist</th>
                <th className="text-center">Sarı</th>
                <th className="text-center">Kırmızı</th>
                <th className="text-center">MVP</th>
                <th className="text-center">Ort.</th>
                <th className="text-center">Reyting</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(state.players)
                .filter(p => p.clubId === state.userClubId)
                .sort((a, b) => {
                  const aGoals = mode === 'season'
                    ? (a.careerStats?.seasonGoals ?? 0)
                    : (a.careerStats?.goals ?? 0);
                  const bGoals = mode === 'season'
                    ? (b.careerStats?.seasonGoals ?? 0)
                    : (b.careerStats?.goals ?? 0);
                  return bGoals - aGoals;
                })
                .map(p => {
                  const stats = p.careerStats;
                  const posColor = getPosColor(p.position);

                  const apps = mode === 'season' ? (stats?.seasonAppearances ?? 0) : (stats?.appearances ?? 0);
                  const goals = mode === 'season' ? (stats?.seasonGoals ?? 0) : (stats?.goals ?? 0);
                  const assists = mode === 'season' ? (stats?.seasonAssists ?? 0) : (stats?.assists ?? 0);
                  const yellow = mode === 'season' ? (stats?.seasonYellowCards ?? 0) : (stats?.yellowCards ?? 0);
                  const red = mode === 'season' ? (stats?.seasonRedCards ?? 0) : (stats?.redCards ?? 0);
                  const motm = mode === 'season' ? (stats?.seasonMotm ?? 0) : (stats?.motm ?? 0);
                  const rating = mode === 'season' ? (stats?.seasonAvgRating ?? 0) : (stats?.avgRating ?? 0);

                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedPlayer(p)}
                      className="border-b border-pitch-700/30 hover:bg-pitch-700/30 cursor-pointer"
                    >
                      <td className="py-1.5 font-medium text-slate-200">{p.name}</td>
                      <td className="text-center">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${posColor.bg} ${posColor.text}`}>
                          {p.position}
                        </span>
                      </td>
                      <td className="text-center text-slate-400">{p.age}</td>
                      <td className="text-center text-slate-300">{apps}</td>
                      <td className="text-center text-green-400 font-bold">{goals}</td>
                      <td className="text-center text-blue-400 font-bold">{assists}</td>
                      <td className="text-center text-yellow-400">{yellow}</td>
                      <td className="text-center text-red-400">{red}</td>
                      <td className="text-center text-purple-400">{motm}</td>
                      <td className="text-center text-accent font-bold">
                        {rating > 0 ? rating.toFixed(2) : '---'}
                      </td>
                      <td className="text-center">
                        <span className="bg-pitch-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          {scorePlayer(p)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          clubId={selectedPlayer.clubId ?? ''}
          clubName={state.clubs[selectedPlayer.clubId ?? '']?.name ?? ''}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// YARDIMCI COMPONENT
// ═══════════════════════════════════════════════

function TeamStatCard({
  label,
  value,
  icon,
  suffix,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  suffix: string;
  color?: string;
}) {
  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-[10px] text-slate-400 uppercase">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color ?? 'text-slate-200'}`}>
        {value.toLocaleString()}
        <span className="text-xs text-slate-500 ml-1 font-normal">{suffix}</span>
      </div>
    </div>
  );
}