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
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Tüm oyuncuları al (kulübü olan)
  const allPlayers = Object.values(state.players).filter(p => p.clubId !== null);

  // Gol krallığı — en çok gol atanlar (en az 1 maç oynamış)
  const topScorers = allPlayers
    .filter(p => (p.careerStats?.goals ?? 0) > 0)
    .sort((a, b) => (b.careerStats?.goals ?? 0) - (a.careerStats?.goals ?? 0))
    .slice(0, 10);

  // Asist krallığı
  const topAssisters = allPlayers
    .filter(p => (p.careerStats?.assists ?? 0) > 0)
    .sort((a, b) => (b.careerStats?.assists ?? 0) - (a.careerStats?.assists ?? 0))
    .slice(0, 10);

  // En iyi reyting — en az 5 maç oynamış, ortalama reyting yüksek
  const topRated = allPlayers
    .filter(p => (p.careerStats?.appearances ?? 0) >= 5 && (p.careerStats?.avgRating ?? 0) > 0)
    .sort((a, b) => (b.careerStats?.avgRating ?? 0) - (a.careerStats?.avgRating ?? 0))
    .slice(0, 10);

  // En çok MVP
  const topMVP = allPlayers
    .filter(p => (p.careerStats?.motm ?? 0) > 0)
    .sort((a, b) => (b.careerStats?.motm ?? 0) - (a.careerStats?.motm ?? 0))
    .slice(0, 10);

  // Aktif listeyi seç
  const currentList =
    activeTab === 'goals' ? topScorers :
    activeTab === 'assists' ? topAssisters :
    activeTab === 'rating' ? topRated :
    topMVP;

  // İstatistik değeri al
  const getStatValue = (p: Player): number => {
    if (activeTab === 'goals') return p.careerStats?.goals ?? 0;
    if (activeTab === 'assists') return p.careerStats?.assists ?? 0;
    if (activeTab === 'rating') return p.careerStats?.avgRating ?? 0;
    if (activeTab === 'motm') return p.careerStats?.motm ?? 0;
    return 0;
  };

  const getStatSuffix = (): string => {
    if (activeTab === 'rating') return '';
    return '';
  };

  const formatValue = (p: Player): string => {
    const v = getStatValue(p);
    if (activeTab === 'rating') return v.toFixed(2);
    return String(v);
  };

  // En yüksek değer (bar genişliği için)
  const maxValue = currentList.length > 0
    ? Math.max(...currentList.map(p => getStatValue(p)), 1)
    : 1;

  return (
    <div className="space-y-4">
      {/* ═══ BAŞLIK ═══ */}
      <div className="glass-panel rounded-xl p-5">
        <h2 className="text-lg font-bold text-white">🏆 Lig İstatistikleri</h2>
        <p className="text-xs text-slate-400">
          Sezon {state.season} • Hafta {state.currentWeek} • {allPlayers.length} oyuncu
        </p>
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
            <p className="text-xs text-slate-500">Maç oynandıkça istatistikler burada görünecek</p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentList.map((player, index) => {
              const club = state.clubs[player.clubId!];
              const posColor = getPosColor(player.position);
              const value = getStatValue(player);
              const barWidth = (value / maxValue) * 100;

              // İlk 3 için özel renk
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
                  {/* Bar arka planı */}
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-accent/20 to-transparent transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />

                  {/* İçerik */}
                  <div className="relative p-3 flex items-center gap-3">
                    {/* Sıra / Madalya */}
                    <div className="w-10 text-center font-bold text-base">
                      {medalIcon}
                    </div>

                    {/* Takım rozeti */}
                    <TeamBadge
                      clubId={player.clubId!}
                      shortName={club?.shortName ?? '???'}
                      size="sm"
                    />

                    {/* İsim + kulüp */}
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
                        {player.careerStats && (
                          <>
                            <span>•</span>
                            <span>{player.careerStats.appearances} maç</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Değer */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-2xl font-black text-accent tabular-nums">
                        {formatValue(player)}
                        <span className="text-sm ml-0.5">{getStatSuffix()}</span>
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

      {/* ═══ TAKIM İSTATİSTİKLERİ ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <TeamStatCard
          label="Senin Takımın"
          value={allPlayers.filter(p => p.clubId === state.userClubId).length}
          icon="👥"
          suffix="oyuncu"
        />
        <TeamStatCard
          label="Toplam Gol"
          value={allPlayers.reduce((s, p) => s + (p.careerStats?.goals ?? 0), 0)}
          icon="⚽"
          suffix="gol"
          color="text-green-400"
        />
        <TeamStatCard
          label="Toplam Asist"
          value={allPlayers.reduce((s, p) => s + (p.careerStats?.assists ?? 0), 0)}
          icon="🎯"
          suffix="asist"
          color="text-blue-400"
        />
        <TeamStatCard
          label="Toplam Maç"
          value={allPlayers.reduce((s, p) => s + (p.careerStats?.appearances ?? 0), 0)}
          icon="🏟️"
          suffix="maç"
          color="text-purple-400"
        />
      </div>

      {/* ═══ SENİN TAKIMININ İSTATİSTİKLERİ ═══ */}
      <div className="glass-panel rounded-xl p-5">
        <h3 className="text-base font-bold text-white mb-3">
          🎯 {state.clubs[state.userClubId]?.name} — Oyuncu İstatistikleri
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
                .sort((a, b) => (b.careerStats?.goals ?? 0) - (a.careerStats?.goals ?? 0))
                .map(p => {
                  const stats = p.careerStats;
                  const posColor = getPosColor(p.position);
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
                      <td className="text-center text-slate-300">{stats?.appearances ?? 0}</td>
                      <td className="text-center text-green-400 font-bold">{stats?.goals ?? 0}</td>
                      <td className="text-center text-blue-400 font-bold">{stats?.assists ?? 0}</td>
                      <td className="text-center text-yellow-400">{stats?.yellowCards ?? 0}</td>
                      <td className="text-center text-red-400">{stats?.redCards ?? 0}</td>
                      <td className="text-center text-purple-400">{stats?.motm ?? 0}</td>
                      <td className="text-center text-accent font-bold">
                        {stats?.avgRating && stats.avgRating > 0 ? stats.avgRating.toFixed(2) : '---'}
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