// src/components/Squad.tsx

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { scorePlayer } from '../engine/data/generateData';
import type { Player, Position } from '../engine/types';
import { PlayerDetailModal } from './PlayerDetailModal';

// ═══════════════════════════════════════════════
// MEVKİ RENKLERİ
// ═══════════════════════════════════════════════

function getPositionColor(position: string): { bg: string; text: string; border: string } {
  if (position === 'GK') return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40' };
  if (['DC', 'DL', 'DR'].includes(position)) return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40' };
  if (['DM', 'MC', 'ML', 'MR'].includes(position)) return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40' };
  if (['AMC', 'AML', 'AMR'].includes(position)) return { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40' };
  if (position === 'ST') return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' };
  return { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/40' };
}

function getRatingColor(rating: number): string {
  if (rating >= 80) return 'text-green-400';
  if (rating >= 70) return 'text-emerald-400';
  if (rating >= 60) return 'text-yellow-400';
  if (rating >= 50) return 'text-orange-400';
  return 'text-red-400';
}

function getConditionColor(value: number): string {
  if (value >= 80) return 'bg-green-500';
  if (value >= 60) return 'bg-yellow-500';
  if (value >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function Bar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="w-full h-1 bg-pitch-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// OYUNCU KARTI
// ═══════════════════════════════════════════════

function PlayerCard({ player, onClick }: { player: Player; onClick: () => void }) {
  const overall = scorePlayer(player);
  const posColor = getPositionColor(player.position);

  return (
    <div
      onClick={onClick}
      className={`card cursor-pointer hover:scale-[1.02] transition-all border ${posColor.border} ${posColor.bg} relative`}
    >
      {player.injuryWeeks > 0 && (
        <div className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded bg-red-900/80 text-red-200">
          🚑 {player.injuryWeeks}h
        </div>
      )}
      {player.suspensionWeeks > 0 && (
        <div className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded bg-yellow-900/80 text-yellow-200">
          🟨 {player.suspensionWeeks}h
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className={`text-xs font-bold px-2 py-1 rounded ${posColor.bg} ${posColor.text} border ${posColor.border}`}>
          {player.position}
        </div>
        <div className={`text-3xl font-bold ${getRatingColor(overall)}`}>
          {overall.toFixed(0)}
        </div>
      </div>

      <div className="mb-3">
        <p className="text-sm font-bold truncate">{player.name}</p>
        <p className="text-xs text-slate-400">{player.age} yaş • {player.nationality}</p>
      </div>

      <div className="space-y-2 mb-3">
        <Bar value={player.condition} color={getConditionColor(player.condition)} label="Kondisyon" />
        <Bar value={player.form} color={getConditionColor(player.form)} label="Form" />
        <Bar value={player.morale} color={getConditionColor(player.morale)} label="Moral" />
      </div>

      <div className="flex items-center justify-between text-xs pt-2 border-t border-pitch-700/50">
        <span className="text-slate-400">Değer</span>
        <span className="font-bold text-accent">£{(player.value / 1_000_000).toFixed(2)}M</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ANA COMPONENT
// ═══════════════════════════════════════════════

const POSITION_FILTERS: { key: Position | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Tümü' },
  { key: 'GK',  label: 'GK' },
  { key: 'DC',  label: 'DC' },
  { key: 'DL',  label: 'DL' },
  { key: 'DR',  label: 'DR' },
  { key: 'DM',  label: 'DM' },
  { key: 'MC',  label: 'MC' },
  { key: 'ML',  label: 'ML' },
  { key: 'MR',  label: 'MR' },
  { key: 'AMC', label: 'AMC' },
  { key: 'AML', label: 'AML' },
  { key: 'AMR', label: 'AMR' },
  { key: 'ST',  label: 'ST' },
];

export function Squad() {
  const state = useGameStore();
  const sellPlayer = useGameStore(s => s.transferSell);

  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>('ALL');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const allSquad = Object.values(state.players)
    .filter(p => p.clubId === state.userClubId);

  const squad = allSquad
    .filter(p => posFilter === 'ALL' || p.position === posFilter)
    .sort((a, b) => {
      const posOrder = ['GK', 'DC', 'DL', 'DR', 'DM', 'MC', 'ML', 'MR', 'AMC', 'AML', 'AMR', 'ST'];
      const pa = posOrder.indexOf(a.position);
      const pb = posOrder.indexOf(b.position);
      if (pa !== pb) return pa - pb;
      return scorePlayer(b) - scorePlayer(a);
    });

  const totalValue = allSquad.reduce((s, p) => s + p.value, 0);
  const avgAge = allSquad.reduce((s, p) => s + p.age, 0) / allSquad.length;
  const avgRating = allSquad.reduce((s, p) => s + scorePlayer(p), 0) / allSquad.length;

  const attrColor = (v: number) =>
    v >= 80 ? 'text-green-400' :
    v >= 65 ? 'text-yellow-400' :
    v >= 50 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="space-y-4">
      {/* ÖZET */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-xs text-slate-400">Oyuncu Sayısı</p>
          <p className="text-2xl font-bold">{allSquad.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Toplam Değer</p>
          <p className="text-2xl font-bold text-accent">£{(totalValue / 1_000_000).toFixed(1)}M</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Ortalama Yaş</p>
          <p className="text-2xl font-bold">{avgAge.toFixed(1)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Ortalama Reyting</p>
          <p className={`text-2xl font-bold ${getRatingColor(avgRating)}`}>
            {avgRating.toFixed(1)}
          </p>
        </div>
      </div>

      {/* FİLTRE + GÖRÜNÜM */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setView('cards')}
              className={`px-3 py-1.5 rounded text-xs font-medium ${
                view === 'cards' ? 'bg-accent text-white' : 'bg-pitch-700 hover:bg-pitch-600'
              }`}
            >
              📇 Kart Görünümü
            </button>
            <button
              onClick={() => setView('table')}
              className={`px-3 py-1.5 rounded text-xs font-medium ${
                view === 'table' ? 'bg-accent text-white' : 'bg-pitch-700 hover:bg-pitch-600'
              }`}
            >
              📊 Tablo Görünümü
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            {POSITION_FILTERS.map(pf => (
              <button
                key={pf.key}
                onClick={() => setPosFilter(pf.key)}
                className={`px-2 py-1 rounded text-[10px] font-medium ${
                  posFilter === pf.key
                    ? 'bg-accent text-white'
                    : 'bg-pitch-700 hover:bg-pitch-600 text-slate-300'
                }`}
              >
                {pf.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-500">
          {squad.length} oyuncu gösteriliyor
        </p>
      </div>

      {/* KART GÖRÜNÜMÜ */}
      {view === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {squad.map(player => (
            <PlayerCard
              key={player.id}
              player={player}
              onClick={() => setSelectedPlayer(player)}
            />
          ))}
        </div>
      )}

      {/* TABLO GÖRÜNÜMÜ */}
      {view === 'table' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 border-b border-pitch-700">
                <th className="py-2">İsim</th>
                <th>Poz</th>
                <th>Yaş</th>
                <th title="Genel">Gen</th>
                <th title="Pas">Pas</th>
                <th title="Dripling">Dri</th>
                <th title="Şut">Şut</th>
                <th title="Bitiricilik">Bit</th>
                <th title="Hız">Hız</th>
                <th title="Dayanıklılık">Day</th>
                <th title="Markaj">Mar</th>
                <th title="Karar">Kar</th>
                <th title="Vizyon">Viz</th>
                <th>Form</th>
                <th>Kond</th>
                <th>Değer</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {squad.map((p: Player) => {
                const a = p.attributes;
                const overall = scorePlayer(p);
                const posColor = getPositionColor(p.position);
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-pitch-700/50 hover:bg-pitch-700/30 cursor-pointer ${
                      p.injuryWeeks > 0 ? 'bg-red-900/20' :
                      p.suspensionWeeks > 0 ? 'bg-yellow-900/20' : ''
                    }`}
                    onClick={() => setSelectedPlayer(p)}
                  >
                    <td className="py-1.5 font-medium whitespace-nowrap">
                      {p.name}
                      {p.injuryWeeks > 0 && (
                        <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-red-900/60 text-red-300">
                          🚑 {p.injuryWeeks}h
                        </span>
                      )}
                      {p.suspensionWeeks > 0 && (
                        <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-yellow-900/60 text-yellow-300">
                          🟨 {p.suspensionWeeks}h
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${posColor.bg} ${posColor.text}`}>
                        {p.position}
                      </span>
                    </td>
                    <td>{p.age}</td>
                    <td className={`font-bold ${getRatingColor(overall)}`}>{overall.toFixed(0)}</td>
                    <td className={attrColor(a.passing)}>{a.passing}</td>
                    <td className={attrColor(a.dribbling)}>{a.dribbling}</td>
                    <td className={attrColor(a.shooting)}>{a.shooting}</td>
                    <td className={attrColor(a.finishing)}>{a.finishing}</td>
                    <td className={attrColor(a.pace)}>{a.pace}</td>
                    <td className={attrColor(a.stamina)}>{a.stamina}</td>
                    <td className={attrColor(a.marking)}>{a.marking}</td>
                    <td className={attrColor(a.decisions)}>{a.decisions}</td>
                    <td className={attrColor(a.vision)}>{a.vision}</td>
                    <td>{p.form}</td>
                    <td>{p.condition}</td>
                    <td className="whitespace-nowrap text-accent">£{(p.value / 1_000_000).toFixed(2)}M</td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`${p.name}'ı satmak istediğine emin misin?`)) {
                            sellPlayer(p.id);
                          }
                        }}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        Sat
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL */}
      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          clubId={state.userClubId}
          clubName={state.clubs[state.userClubId]?.name ?? ''}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}