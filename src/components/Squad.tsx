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
  if (['WBL', 'WBR'].includes(position)) return { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/40' };
  if (['DMC', 'MC', 'ML', 'MR'].includes(position)) return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40' };
  if (['AMC', 'AML', 'AMR'].includes(position)) return { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40' };
  if (['KFL', 'KFR', 'GF', 'ST'].includes(position)) return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' };
  return { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/40' };
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

// ═══════════════════════════════════════════════
// SIRALAMA
// ═══════════════════════════════════════════════

type SortKey =
  | 'name' | 'position' | 'age' | 'overall' | 'role' | 'contract'
  | 'form' | 'condition' | 'morale'
  | 'pace' | 'shooting' | 'passing' | 'dribbling' | 'marking' | 'strength'
  | 'value' | 'wage';

type SortDir = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  dir: SortDir;
}

// 17 Pozisyon Sırası
const POSITION_ORDER: Position[] = [
  'GK',
  'DL', 'DC', 'DR',
  'WBL', 'WBR',
  'DMC',
  'ML', 'MC', 'MR',
  'AML', 'AMC', 'AMR',
  'KFL', 'GF', 'KFR',
  'ST',
];

const ROLE_ORDER = ['first', 'rotation', 'backup', 'u21'];

function getSortValue(p: Player, key: SortKey): number | string {
  const overall = scorePlayer(p);
  switch (key) {
    case 'name':        return p.name;
    case 'position':    return POSITION_ORDER.indexOf(p.position);
    case 'age':         return p.age;
    case 'overall':     return overall;
    case 'role':        return ROLE_ORDER.indexOf(p.squadRole);
    case 'contract':    return p.contractYears ?? 0;
    case 'form':        return p.form;
    case 'condition':   return p.condition;
    case 'morale':      return p.morale;
    case 'pace':        return p.attributes.pace;
    case 'shooting':    return p.attributes.shooting;
    case 'passing':     return p.attributes.passing;
    case 'dribbling':   return p.attributes.dribbling;
    case 'marking':     return p.attributes.marking;
    case 'strength':    return p.attributes.strength;
    case 'value':       return p.value;
    case 'wage':        return p.wage;
    default:            return 0;
  }
}

// ═══════════════════════════════════════════════
// 17 POZİSYON FİLTRELERİ
// ═══════════════════════════════════════════════

const POSITION_FILTERS: { key: Position | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Tümü' },
  { key: 'GK',  label: 'GK' },
  { key: 'DL',  label: 'DL' },
  { key: 'DC',  label: 'DC' },
  { key: 'DR',  label: 'DR' },
  { key: 'WBL', label: 'WBL' },
  { key: 'WBR', label: 'WBR' },
  { key: 'DMC', label: 'DMC' },
  { key: 'ML',  label: 'ML' },
  { key: 'MC',  label: 'MC' },
  { key: 'MR',  label: 'MR' },
  { key: 'AML', label: 'AML' },
  { key: 'AMC', label: 'AMC' },
  { key: 'AMR', label: 'AMR' },
  { key: 'KFL', label: 'KFL' },
  { key: 'GF',  label: 'GF' },
  { key: 'KFR', label: 'KFR' },
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

// ═══════════════════════════════════════════════
// SORTABLE HEADER
// ═══════════════════════════════════════════════

function SortHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  className = '',
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortConfig;
  onSort: (key: SortKey) => void;
  className?: string;
  align?: 'left' | 'center' | 'right';
}) {
  const isActive = currentSort.key === sortKey;

  const alignClass =
    align === 'center' ? 'text-center' :
    align === 'right' ? 'text-right' :
    'text-left';

  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`py-2 px-2 cursor-pointer select-none hover:text-accent transition-colors ${alignClass} ${className}`}
      title={`${label} sırala`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <span className="text-accent">
            {currentSort.dir === 'desc' ? '▼' : '▲'}
          </span>
        )}
      </span>
    </th>
  );
}

// ═══════════════════════════════════════════════
// ANA COMPONENT
// ═══════════════════════════════════════════════

export function Squad() {
  const state = useGameStore();
  const sellPlayer = useGameStore(s => s.transferSell);
  const sendToReserves = useGameStore(s => s.sendToReserves);
  const sendAllSelectedToReserves = useGameStore(s => s.sendAllSelectedToReserves);
  const promoteFromReserves = useGameStore(s => s.promoteFromReserves);

  const [squadView, setSquadView] = useState<SquadView>('all');
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>('ALL');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [checkedPlayers, setCheckedPlayers] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortConfig>({ key: 'overall', dir: 'desc' });

  const allSquad = Object.values(state.players)
    .filter(p => p.clubId === state.userClubId);

  const squad = allSquad
    .filter(p => squadView === 'all' || p.squadRole === squadView)
    .filter(p => posFilter === 'ALL' || p.position === posFilter)
    .sort((a, b) => {
      const aVal = getSortValue(a, sort.key);
      const bVal = getSortValue(b, sort.key);

      let cmp = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else {
        cmp = (aVal as number) - (bVal as number);
      }

      return sort.dir === 'asc' ? cmp : -cmp;
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

  const handleSort = (key: SortKey) => {
    setSort(prev => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' };
      }
      return { key, dir: 'desc' };
    });
  };

  const toggleCheck = (id: string) => {
    const newSet = new Set(checkedPlayers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setCheckedPlayers(newSet);
  };

  const toggleAll = () => {
    if (checkedPlayers.size === squad.length && squad.length > 0) {
      setCheckedPlayers(new Set());
    } else {
      setCheckedPlayers(new Set(squad.map(p => p.id)));
    }
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

      {/* FİLTRE */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
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

          <div className="text-xs text-slate-500">
            {squad.length} oyuncu • Sıralama: <span className="text-accent font-bold">{sort.key}</span> {sort.dir === 'desc' ? '▼' : '▲'}
          </div>
        </div>
      </div>

      {/* TABLO */}
      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-400 border-b border-pitch-700">
              <th className="py-2 px-2 w-8">
                <input
                  type="checkbox"
                  checked={checkedPlayers.size === squad.length && squad.length > 0}
                  onChange={toggleAll}
                  className="w-4 h-4 cursor-pointer accent-green-500"
                />
              </th>
              <SortHeader label="İsim" sortKey="name" currentSort={sort} onSort={handleSort} />
              <SortHeader label="Poz" sortKey="position" currentSort={sort} onSort={handleSort} align="center" />
              <SortHeader label="Yaş" sortKey="age" currentSort={sort} onSort={handleSort} align="center" />
              <SortHeader label="Gen" sortKey="overall" currentSort={sort} onSort={handleSort} align="center" />
              <SortHeader label="Rol" sortKey="role" currentSort={sort} onSort={handleSort} />
              <SortHeader label="Sözleşme" sortKey="contract" currentSort={sort} onSort={handleSort} align="center" />
              <SortHeader label="Form" sortKey="form" currentSort={sort} onSort={handleSort} align="center" />
              <SortHeader label="Kond" sortKey="condition" currentSort={sort} onSort={handleSort} align="center" />
              <SortHeader label="Moral" sortKey="morale" currentSort={sort} onSort={handleSort} align="center" />
              <SortHeader label="Hız" sortKey="pace" currentSort={sort} onSort={handleSort} align="center" />
              <SortHeader label="Şut" sortKey="shooting" currentSort={sort} onSort={handleSort} align="center" />
              <SortHeader label="Pas" sortKey="passing" currentSort={sort} onSort={handleSort} align="center" />
              <SortHeader label="Dri" sortKey="dribbling" currentSort={sort} onSort={handleSort} align="center" />
              <SortHeader label="Def" sortKey="marking" currentSort={sort} onSort={handleSort} align="center" />
              <SortHeader label="Fiz" sortKey="strength" currentSort={sort} onSort={handleSort} align="center" />
              <SortHeader label="Değer" sortKey="value" currentSort={sort} onSort={handleSort} align="right" />
              <SortHeader label="Maaş" sortKey="wage" currentSort={sort} onSort={handleSort} align="right" />
              <th className="py-2 px-2 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {squad.map((p: Player) => {
              const overall = scorePlayer(p);
              const posColor = getPositionColor(p.position);
              const contract = getContractStatus(p);
              const role = getSquadRoleLabel(p.squadRole);
              const isChecked = checkedPlayers.has(p.id);
              const a = p.attributes;

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
                  <td
                    className="py-1.5 px-2 font-medium whitespace-nowrap"
                    onClick={() => setSelectedPlayer(p)}
                  >
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
                  <td className="px-2 text-center" onClick={() => setSelectedPlayer(p)}>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${posColor.bg} ${posColor.text}`}>
                      {p.position}
                    </span>
                  </td>
                  <td className="px-2 text-center" onClick={() => setSelectedPlayer(p)}>{p.age}</td>
                  <td className={`px-2 text-center font-bold tabular-nums ${getOverallColor(overall)}`} onClick={() => setSelectedPlayer(p)}>
                    {overall}
                  </td>
                  <td className="px-2" onClick={() => setSelectedPlayer(p)}>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${role.color}`}>
                      {role.icon} {role.label}
                    </span>
                  </td>
                  <td className="px-2 text-center" onClick={() => setSelectedPlayer(p)}>
                    <span className={`text-[10px] font-bold whitespace-nowrap ${contract.color}`}>
                      📋 {contract.label}
                    </span>
                  </td>
                  <td className="px-2 text-center" onClick={() => setSelectedPlayer(p)}>{p.form}</td>
                  <td className="px-2 text-center" onClick={() => setSelectedPlayer(p)}>{p.condition}</td>
                  <td className="px-2 text-center" onClick={() => setSelectedPlayer(p)}>{p.morale}</td>
                  <td className={`px-2 text-center tabular-nums ${getAttrColor(a.pace)}`} onClick={() => setSelectedPlayer(p)}>{a.pace}</td>
                  <td className={`px-2 text-center tabular-nums ${getAttrColor(a.shooting)}`} onClick={() => setSelectedPlayer(p)}>{a.shooting}</td>
                  <td className={`px-2 text-center tabular-nums ${getAttrColor(a.passing)}`} onClick={() => setSelectedPlayer(p)}>{a.passing}</td>
                  <td className={`px-2 text-center tabular-nums ${getAttrColor(a.dribbling)}`} onClick={() => setSelectedPlayer(p)}>{a.dribbling}</td>
                  <td className={`px-2 text-center tabular-nums ${getAttrColor(a.marking)}`} onClick={() => setSelectedPlayer(p)}>{a.marking}</td>
                  <td className={`px-2 text-center tabular-nums ${getAttrColor(a.strength)}`} onClick={() => setSelectedPlayer(p)}>{a.strength}</td>
                  <td className="px-2 text-right whitespace-nowrap text-accent font-bold" onClick={() => setSelectedPlayer(p)}>
                    £{(p.value / 1_000_000).toFixed(2)}M
                  </td>
                  <td className="px-2 text-right whitespace-nowrap text-slate-400" onClick={() => setSelectedPlayer(p)}>
                    £{(p.wage / 1_000).toFixed(0)}K
                  </td>
                  <td className="pr-2">
                    <div className="flex gap-1 justify-end">
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
                        className="text-[10px] text-red-400 hover:text-red-300 px-1"
                        title="Sat"
                      >
                        💸
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {squad.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm">Bu filtreye uygun oyuncu yok</p>
          </div>
        )}
      </div>

      {/* BİLGİ */}
      <div className="glass-panel rounded-xl p-3">
        <p className="text-[10px] text-slate-500">
          💡 <strong className="text-slate-400">İpucu:</strong> Kolon başlıklarına tıklayarak sıralayabilirsin.
          Detay için oyuncuya tıkla. Toplu göndermek için checkbox kullan.
        </p>
      </div>

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