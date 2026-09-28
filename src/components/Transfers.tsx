// src/components/Transfers.tsx

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { scorePlayer } from '../engine/data/generateData';
import type { Player, Position } from '../engine/types';
import { TeamBadge } from './TeamBadge';
import { PlayerDetailModal } from './PlayerDetailModal';

// ═══════════════════════════════════════════════
// MEVKİ RENKLERİ
// ═══════════════════════════════════════════════

function getPosColor(position: string): { bg: string; text: string; border: string } {
  if (position === 'GK') return { bg: 'bg-yellow-500/30', text: 'text-yellow-300', border: 'border-yellow-500/60' };
  if (['DC', 'DL', 'DR'].includes(position)) return { bg: 'bg-blue-500/30', text: 'text-blue-300', border: 'border-blue-500/60' };
  if (['DM', 'MC', 'ML', 'MR'].includes(position)) return { bg: 'bg-green-500/30', text: 'text-green-300', border: 'border-green-500/60' };
  if (['AMC', 'AML', 'AMR'].includes(position)) return { bg: 'bg-purple-500/30', text: 'text-purple-300', border: 'border-purple-500/60' };
  if (position === 'ST') return { bg: 'bg-red-500/30', text: 'text-red-300', border: 'border-red-500/60' };
  return { bg: 'bg-slate-500/30', text: 'text-slate-300', border: 'border-slate-500/60' };
}

function getRatingColor(rating: number): string {
  if (rating >= 80) return 'text-green-400';
  if (rating >= 70) return 'text-emerald-400';
  if (rating >= 60) return 'text-yellow-400';
  if (rating >= 50) return 'text-orange-400';
  return 'text-red-400';
}

const POSITIONS: (Position | 'ALL')[] = [
  'ALL', 'GK', 'DC', 'DL', 'DR', 'DM', 'MC', 'ML', 'MR', 'AMC', 'AML', 'AMR', 'ST',
];

const SORT_OPTIONS = [
  { key: 'rating', label: '⭐ Reyting' },
  { key: 'value', label: '💰 Değer' },
  { key: 'age', label: '🎂 Yaş' },
  { key: 'potential', label: '📈 Potansiyel' },
] as const;

type SortKey = typeof SORT_OPTIONS[number]['key'];

// ═══════════════════════════════════════════════
// OYUNCU KARTI
// ═══════════════════════════════════════════════

interface PlayerRowProps {
  player: Player;
  clubName: string;
  clubId: string;
  clubShort: string;
  canAfford: boolean;
  onBuy: () => void;
  onDetail: () => void;
}

function PlayerRow({ player, clubName, clubId, clubShort, canAfford, onBuy, onDetail }: PlayerRowProps) {
  const rating = scorePlayer(player);
  const posColor = getPosColor(player.position);

  return (
    <div className="glass-panel rounded-xl p-3 hover:bg-pitch-700/20 transition-colors">
      <div className="flex items-center gap-3 cursor-pointer" onClick={onDetail}>
        <div className={`w-12 h-12 rounded-lg ${posColor.bg} border-2 ${posColor.border} flex flex-col items-center justify-center flex-shrink-0`}>
          <span className={`text-[10px] font-bold ${posColor.text}`}>{player.position}</span>
          <span className={`text-lg font-bold ${getRatingColor(rating)}`}>{rating}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-bold text-sm truncate text-white">{player.name}</p>
            {player.injuryWeeks > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/60 text-red-300">
                🚑 {player.injuryWeeks}h
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <TeamBadge clubId={clubId} shortName={clubShort} size="xs" />
            <span className="truncate">{clubName}</span>
            <span>•</span>
            <span>{player.age} yaş</span>
            <span>•</span>
            <span>{player.nationality}</span>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-xs text-slate-400">Değer</p>
          <p className="font-bold text-sm text-accent">£{(player.value / 1_000_000).toFixed(2)}M</p>
          <p className="text-[10px] text-slate-500">
            Maaş: £{(player.wage / 1_000).toFixed(0)}K/hafta
          </p>
        </div>

        <div className="flex-shrink-0">
          <button
            disabled={!canAfford}
            onClick={(e) => { e.stopPropagation(); onBuy(); }}
            className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
              canAfford
                ? 'bg-accent hover:bg-accent-hover text-white'
                : 'bg-pitch-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {canAfford ? '💸 Satın Al' : '❌ Yetersiz'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2 mt-2 pt-2 border-t border-pitch-700/30">
        <MiniStat label="Hız" value={player.attributes.pace} />
        <MiniStat label="Şut" value={player.attributes.shooting} />
        <MiniStat label="Pas" value={player.attributes.passing} />
        <MiniStat label="Dri" value={player.attributes.dribbling} />
        <MiniStat label="Def" value={player.attributes.marking} />
        <MiniStat label="Fiz" value={player.attributes.strength} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80 ? 'text-green-400' :
    value >= 65 ? 'text-yellow-400' :
    value >= 50 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="text-center">
      <p className="text-[9px] text-slate-500">{label}</p>
      <p className={`text-xs font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ANA COMPONENT
// ═══════════════════════════════════════════════

export function Transfers() {
  const state = useGameStore();
  const buy = useGameStore(s => s.transferBuy);
  const userClub = state.clubs[state.userClubId];

  const [filterPos, setFilterPos] = useState<Position | 'ALL'>('ALL');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('rating');
  const [maxValue, setMaxValue] = useState<number>(100);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  let available = Object.values(state.players)
    .filter(p => p.clubId && p.clubId !== state.userClubId);

  if (filterPos !== 'ALL') {
    available = available.filter(p => p.position === filterPos);
  }

  if (searchText.trim()) {
    const q = searchText.toLowerCase();
    available = available.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (state.clubs[p.clubId!]?.name ?? '').toLowerCase().includes(q)
    );
  }

  available = available.filter(p => (p.value / 1_000_000) <= maxValue);

  available = available.sort((a, b) => {
    if (sortBy === 'rating') return scorePlayer(b) - scorePlayer(a);
    if (sortBy === 'value') return b.value - a.value;
    if (sortBy === 'age') return a.age - b.age;
    if (sortBy === 'potential') {
      const aScore = scorePlayer(a) * (35 - Math.min(a.age, 35));
      const bScore = scorePlayer(b) * (35 - Math.min(b.age, 35));
      return bScore - aScore;
    }
    return 0;
  });

  const displayed = available.slice(0, 50);

  const budget = userClub?.budget ?? 0;
  const budgetM = budget / 1_000_000;

  return (
    <div className="space-y-4">
      {/* BÜTÇE */}
      <div className="glass-panel rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-bold text-white">💰 Transfer Pazarı</h2>
            <p className="text-xs text-slate-400">
              {available.length} oyuncu mevcut
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Transfer Bütçesi</p>
            <p className="text-2xl font-bold text-accent">£{budgetM.toFixed(2)}M</p>
          </div>
        </div>

        <div className="w-full h-2 bg-pitch-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-green-400 transition-all duration-500"
            style={{ width: `${Math.min(100, (budgetM / 50) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
          <span>£0M</span>
          <span>£50M</span>
        </div>
      </div>

      {/* FİLTRELER */}
      <div className="glass-panel rounded-xl p-5 space-y-3">
        <input
          type="text"
          placeholder="🔍 Oyuncu veya kulüp ara..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="w-full bg-pitch-700 border border-pitch-600 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent"
        />

        <div className="flex flex-wrap gap-1">
          {POSITIONS.map(pos => (
            <button
              key={pos}
              onClick={() => setFilterPos(pos)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                filterPos === pos
                  ? 'bg-accent text-white'
                  : 'bg-pitch-700 hover:bg-pitch-600 text-slate-300'
              }`}
            >
              {pos === 'ALL' ? 'Tümü' : pos}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Sırala:</span>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`px-2 py-1 rounded text-[10px] font-medium ${
                  sortBy === opt.key
                    ? 'bg-accent text-white'
                    : 'bg-pitch-700 hover:bg-pitch-600 text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-400">Max Değer:</span>
            <input
              type="range"
              min={1}
              max={100}
              value={maxValue}
              onChange={e => setMaxValue(Number(e.target.value))}
              className="w-32 accent-accent"
            />
            <span className="text-xs font-bold text-accent w-12">£{maxValue}M</span>
          </div>
        </div>
      </div>

      {/* OYUNCU LİSTESİ */}
      {displayed.length === 0 ? (
        <div className="glass-panel rounded-xl p-5 text-center text-slate-400 py-12">
          <p className="text-lg mb-2">🔍 Sonuç bulunamadı</p>
          <p className="text-xs">Filtreleri değiştirmeyi dene</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(p => {
            const club = state.clubs[p.clubId!];
            const canAfford = budget >= p.value;
            return (
              <PlayerRow
                key={p.id}
                player={p}
                clubId={p.clubId!}
                clubName={club?.name ?? '???'}
                clubShort={club?.shortName ?? '???'}
                canAfford={canAfford}
                onBuy={() => {
                  if (confirm(`${p.name}'ı £${(p.value / 1_000_000).toFixed(2)}M karşılığında satın almak istediğine emin misin?`)) {
                    buy(p.id);
                  }
                }}
                onDetail={() => setSelectedPlayer(p)}
              />
            );
          })}
        </div>
      )}

      {available.length > 50 && (
        <p className="text-xs text-slate-500 text-center">
          İlk 50 oyuncu gösteriliyor. Filtreleri kullanarak daraltabilirsin.
        </p>
      )}

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