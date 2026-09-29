// src/components/Squad.tsx

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { scorePlayer } from '../engine/data/generateData';
import { getContractStatus } from '../engine/progression/contract';
import type { Player, Position } from '../engine/types';
import { PlayerDetailModal } from './PlayerDetailModal';
import { getAttrColor, getOverallColor } from '../utils/attributeColor';

// ═══════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════

function getPositionColor(position: string): { bg: string; text: string; border: string } {
  if (position === 'GK') return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40' };
  if (['DC', 'DL', 'DR'].includes(position)) return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40' };
  if (['DM', 'MC', 'ML', 'MR'].includes(position)) return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40' };
  if (['AMC', 'AML', 'AMR'].includes(position)) return { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40' };
  if (position === 'ST') return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' };
  return { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/40' };
}

function getConditionColor(value: number): string {
  if (value >= 80) return 'bg-green-500';
  if (value >= 60) return 'bg-yellow-500';
  if (value >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function getSquadRoleLabel(role: string): { icon: string; label: string; color: string } {
  switch (role) {
    case 'first':    return { icon: '⭐', label: 'İlk 11',     color: 'bg-green-500/20 text-green-400 border-green-500/40' };
    case 'rotation': return { icon: '🔄', label: 'Rotasyon',   color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' };
    case 'backup':   return { icon: '🪑', label: 'Yedek',      color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' };
    case 'u21':      return { icon: '📤', label: 'U21',        color: 'bg-slate-500/20 text-slate-400 border-slate-500/40' };
    default:         return { icon: '•',  label: '-',          color: 'bg-slate-500/20 text-slate-400 border-slate-500/40' };
  }
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

function PlayerCard({ player, onClick }: { player: Player; onClick: () => void }) {
  const overall = scorePlayer(player);
  const posColor = getPositionColor(player.position);
  const contract = getContractStatus(player);
  const role = getSquadRoleLabel(player.squadRole);

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
        <div className={`text-3xl font-bold tabular-nums ${getOverallColor(overall)}`}>
          {overall}
        </div>
      </div>

      <div className="mb-3">
        <p className="text-sm font-bold truncate">{player.name}</p>
        <p className="text-xs text-slate-400">{player.age} yaş • {player.nationality}</p>
      </div>

      <div className="flex items-center gap-1 mb-3 flex-wrap">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${role.color}`}>
          {role.icon} {role.label}
        </span>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border bg-pitch-700/50 ${contract.color}`}>
          📋 {contract.label}
        </span>
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

type SquadView = 'all' | 'first' | 'rotation' | 'backup' | 'u21';

const SQUAD_VIEWS: { key: SquadView; label: string; icon: string }[] = [
  { key: 'all',      label: 'Tüm Kadro',  icon: '👥' },
  { key: 'first',    label: 'İlk 11',     icon: '⭐' },
  { key: 'rotation', label: 'Rotasyon',   icon: '🔄' },
  { key: 'backup',   label: 'Yedekler',   icon: '🪑' },
  { key: 'u21',      label: 'U21 Takım',  icon: '📤' },
];

export function Squad() {
  const state = useGameStore();
  const sellPlayer = useGameStore(s => s.transferSell);
  const sendToReserves = useGameStore(s => s.sendToReserves);
  const sendAllSelectedToReserves = useGameStore(s => s.sendAllSelectedToReserves);
  const promoteFromReserves = useGameStore(s => s.promoteFromReserves);

  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [squadView, setSquadView] = useState<SquadView>('all');
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>('ALL');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [checkedPlayers, setCheckedPlayers] = useState<Set<string>>(new Set());

  const allSquad = Object.values(state.players)
    .filter(p => p.clubId === state.userClubId);

  const squad = allSquad
    .filter(p => squadView === 'all' || p.squadRole === squadView)
    .filter(p => posFilter === 'ALL' || p.position === posFilter)
    .sort((a, b) => {
      const posOrder = ['GK', 'DC', 'DL', 'DR', 'DM', 'MC', 'ML', 'MR', 'AMC', 'AML', 'AMR', 'ST'];
      const pa = posOrder.indexOf(a.position);
      const pb = posOrder.indexOf(b.position);
      if (pa !== pb) return pa - pb;
      return scorePlayer(b) - scorePlayer(a);
    });

  // İstatistikler
  const firstTeam = allSquad.filter(p => p.squadRole !== 'u21');
  const u21Team = allSquad.filter(p => p.squadRole === 'u21');
  const totalValue = allSquad.reduce((s, p) => s + p.value, 0);
  const avgAge = allSquad.length > 0
    ? allSquad.reduce((s, p) => s + p.age, 0) / allSquad.length
    : 0;
  const avgRating = allSquad.length > 0
    ? allSquad.reduce((s, p) => s + scorePlayer(p), 0) / allSquad.length
    : 0;

  const toggleCheck = (id: string) => {
    const newSet = new Set(checkedPlayers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setCheckedPlayers(newSet);
  };

  const handleSendSelectedToReserves = () => {
    if (checkedPlayers.size === 0) return;
    if (confirm(`${checkedPlayers.size} oyuncuyu U21 takıma göndermek istediğine emin misin?`)) {
      sendAllSelectedToReserves(Array.from(checkedPlayers));
      setCheckedPlayers(new Set());
    }
  };

  return (
    <div className="space-y-4">
      {/* ÖZET */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card">
          <p className="text-xs text-slate-400">A Takım</p>
          <p className="text-2xl font-bold">{firstTeam.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">U21 Takım</p>
          <p className="text-2xl font-bold text-slate-400">{u21Team.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Toplam Değer</p>
          <p className="text-2xl font-bold text-accent">£{(totalValue / 1_000_000).toFixed(1)}M</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Ort. Yaş</p>
          <p className="text-2xl font-bold">{avgAge.toFixed(1)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-400">Ort. Reyting</p>
          <p className={`text-2xl font-bold tabular-nums ${getOverallColor(avgRating)}`}>
            {avgRating.toFixed(1)}
          </p>
        </div>
      </div>

      {/* TAKIM GÖRÜNÜMÜ */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {SQUAD_VIEWS.map(v => {
            const count = v.key === 'all'
              ? allSquad.length
              : allSquad.filter(p => p.squadRole === v.key).length;
            return (
              <button
                key={v.key}
                onClick={() => {
                  setSquadView(v.key);
                  setCheckedPlayers(new Set());
                }}
                className={`px-3 py-2 rounded text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  squadView === v.key
                    ? 'bg-accent text-white'
                    : 'bg-pitch-700 hover:bg-pitch-600 text-slate-300'
                }`}
              >
                <span>{v.icon}</span>
                <span>{v.label}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* SEÇİLİ AKSİYONLAR */}
        {checkedPlayers.size > 0 && (
          <div className="bg-accent/10 border border-accent/40 rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-accent font-bold">
              {checkedPlayers.size} oyuncu seçili
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleSendSelectedToReserves}
                className="text-xs bg-pitch-700 hover:bg-pitch-600 text-slate-200 px-3 py-1.5 rounded font-medium"
              >
                📤 U21'e Gönder
              </button>
              <button
                onClick={() => setCheckedPlayers(new Set())}
                className="text-xs bg-pitch-700 hover:bg-pitch-600 text-slate-400 px-3 py-1.5 rounded font-medium"
              >
                ✖️ İptal
              </button>
            </div>
          </div>
        )}
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
                <th className="py-2 w-8"></th>
                <th>İsim</th>
                <th>Poz</th>
                <th>Yaş</th>
                <th title="Genel">Gen</th>
                <th>Rol</th>
                <th>Sözleşme</th>
                <th>Form</th>
                <th>Kond</th>
                <th>Değer</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {squad.map((p: Player) => {
                const overall = scorePlayer(p);
                const posColor = getPositionColor(p.position);
                const contract = getContractStatus(p);
                const role = getSquadRoleLabel(p.squadRole);
                const isChecked = checkedPlayers.has(p.id);

                return (
                  <tr
                    key={p.id}
                    className={`border-b border-pitch-700/50 hover:bg-pitch-700/30 cursor-pointer ${
                      p.injuryWeeks > 0 ? 'bg-red-900/20' :
                      p.suspensionWeeks > 0 ? 'bg-yellow-900/20' :
                      p.squadRole === 'u21' ? 'bg-slate-700/20' : ''
                    } ${isChecked ? 'bg-accent/10' : ''}`}
                  >
                    <td className="py-1.5 px-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleCheck(p.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 cursor-pointer accent-green-500"
                      />
                    </td>
                    <td className="py-1.5 font-medium whitespace-nowrap" onClick={() => setSelectedPlayer(p)}>
                      {p.name}
                      {p.injuryWeeks > 0 && (
                        <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-red-900/60 text-red-300">
                          🚑 {p.injuryWeeks}h
                        </span>
                      )}
                    </td>
                    <td onClick={() => setSelectedPlayer(p)}>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${posColor.bg} ${posColor.text}`}>
                        {p.position}
                      </span>
                    </td>
                    <td onClick={() => setSelectedPlayer(p)}>{p.age}</td>
                    <td onClick={() => setSelectedPlayer(p)} className={`font-bold tabular-nums ${getOverallColor(overall)}`}>{overall}</td>
                    <td onClick={() => setSelectedPlayer(p)}>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${role.color}`}>
                        {role.icon} {role.label}
                      </span>
                    </td>
                    <td onClick={() => setSelectedPlayer(p)}>
                      <span className={`text-[10px] font-bold ${contract.color}`}>
                        📋 {contract.label}
                      </span>
                    </td>
                    <td onClick={() => setSelectedPlayer(p)}>{p.form}</td>
                    <td onClick={() => setSelectedPlayer(p)}>{p.condition}</td>
                    <td onClick={() => setSelectedPlayer(p)} className="whitespace-nowrap text-accent">£{(p.value / 1_000_000).toFixed(2)}M</td>
                    <td className="pr-2">
                      <div className="flex gap-1">
                        {p.squadRole === 'u21' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              promoteFromReserves(p.id);
                            }}
                            className="text-[10px] bg-green-600 hover:bg-green-500 text-white px-2 py-0.5 rounded"
                            title="A takıma al"
                          >
                            📥 Al
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              sendToReserves(p.id);
                            }}
                            className="text-[10px] bg-pitch-600 hover:bg-pitch-500 text-slate-200 px-2 py-0.5 rounded"
                            title="U21'e gönder"
                          >
                            📤
                          </button>
                        )}
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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