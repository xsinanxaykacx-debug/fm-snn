// src/components/Academy.tsx

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

// ═══════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════

function getStarsColor(stars: number): string {
  if (stars >= 4.5) return 'text-purple-400';
  if (stars >= 4.0) return 'text-yellow-400';
  if (stars >= 3.5) return 'text-green-400';
  if (stars >= 3.0) return 'text-blue-400';
  if (stars >= 2.0) return 'text-orange-400';
  return 'text-slate-400';
}

function getPotentialColor(potential: number): string {
  if (potential >= 180) return 'text-purple-400';
  if (potential >= 160) return 'text-yellow-400';
  if (potential >= 140) return 'text-green-400';
  if (potential >= 120) return 'text-blue-400';
  if (potential >= 100) return 'text-orange-400';
  return 'text-slate-400';
}

function getPosColor(position: string): { bg: string; text: string; border: string } {
  if (position === 'GK') return { bg: 'bg-yellow-500/30', text: 'text-yellow-300', border: 'border-yellow-500/60' };
  if (['DC', 'DL', 'DR'].includes(position)) return { bg: 'bg-blue-500/30', text: 'text-blue-300', border: 'border-blue-500/60' };
  if (['DM', 'MC', 'ML', 'MR'].includes(position)) return { bg: 'bg-green-500/30', text: 'text-green-300', border: 'border-green-500/60' };
  if (['AMC', 'AML', 'AMR'].includes(position)) return { bg: 'bg-purple-500/30', text: 'text-purple-300', border: 'border-purple-500/60' };
  if (position === 'ST') return { bg: 'bg-red-500/30', text: 'text-red-300', border: 'border-red-500/60' };
  return { bg: 'bg-slate-500/30', text: 'text-slate-300', border: 'border-slate-500/60' };
}

function Stars({ count }: { count: number }) {
  const fullStars = Math.floor(count);
  const hasHalf = count % 1 >= 0.5;
  const emptyStars = Math.max(0, 5 - fullStars - (hasHalf ? 1 : 0));

  return (
    <span className={`text-xs ${getStarsColor(count)}`}>
      {'⭐'.repeat(fullStars)}
      {hasHalf && '✨'}
      {'☆'.repeat(emptyStars)}
    </span>
  );
}

// ═══════════════════════════════════════════════
// ANA COMPONENT
// ═══════════════════════════════════════════════

export function Academy() {
  const state = useGameStore();
  const promoteAll = useGameStore(s => s.promoteAllSelected);
  const release = useGameStore(s => s.releaseFromAcademy);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>('ALL');

  const userAcademy = Object.values(state.academy?.players ?? {})
    .filter(p => p.clubId === state.userClubId)
    .filter(p => filter === 'ALL' || p.position === filter)
    .sort((a, b) => b.potential - a.potential);

  const totalCount = Object.values(state.academy?.players ?? {}).filter(
    p => p.clubId === state.userClubId
  ).length;

  const highPotential = Object.values(state.academy?.players ?? {})
    .filter(p => p.clubId === state.userClubId && p.potential >= 160)
    .length;

  const avgAge = totalCount > 0
    ? (Object.values(state.academy?.players ?? {})
        .filter(p => p.clubId === state.userClubId)
        .reduce((a, b) => a + b.age, 0) / totalCount
      ).toFixed(1)
    : '0';

  const toggleSelect = (id: string) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelected(newSet);
  };

  const selectAll = () => {
    if (selected.size === userAcademy.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(userAcademy.map(p => p.id)));
    }
  };

  const handlePromoteSelected = () => {
    if (selected.size === 0) return;
    if (confirm(`${selected.size} oyuncuyu A takıma yükseltmek istediğine emin misin?`)) {
      promoteAll(Array.from(selected));
      setSelected(new Set());
    }
  };

  const handleRelease = (id: string, name: string) => {
    if (confirm(`${name}'ı akademiden serbest bırakmak istediğine emin misin?`)) {
      release(id);
      const newSet = new Set(selected);
      newSet.delete(id);
      setSelected(newSet);
    }
  };

  return (
    <div className="space-y-4">
      {/* BAŞLIK */}
      <div className="glass-panel rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎓</span>
            <div>
              <h2 className="text-lg font-bold text-white">Gençlik Akademisi</h2>
              <p className="text-xs text-slate-400">
                {totalCount} genç oyuncu • {highPotential} yüksek potansiyelli • Ort. yaş: {avgAge}
              </p>
            </div>
          </div>

          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{selected.size} seçili</span>
              <button
                onClick={handlePromoteSelected}
                className="bg-accent hover:bg-accent-hover text-white text-sm font-bold px-4 py-2 rounded-lg"
              >
                ⬆️ A Takıma Yükselt
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FİLTRELER */}
      <div className="glass-panel rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={selectAll}
            disabled={userAcademy.length === 0}
            className="text-xs bg-pitch-700 hover:bg-pitch-600 disabled:opacity-50 text-slate-300 px-3 py-1.5 rounded font-medium"
          >
            {selected.size === userAcademy.length && userAcademy.length > 0
              ? '✅ Tümünü Kaldır'
              : '☑️ Tümünü Seç'}
          </button>

          <div className="flex flex-wrap gap-1 ml-auto">
            {['ALL', 'GK', 'DC', 'DL', 'DR', 'DM', 'MC', 'ML', 'MR', 'AMC', 'AML', 'AMR', 'ST'].map(pos => (
              <button
                key={pos}
                onClick={() => setFilter(pos)}
                className={`px-2 py-1 rounded text-[10px] font-medium ${
                  filter === pos
                    ? 'bg-accent text-white'
                    : 'bg-pitch-700 hover:bg-pitch-600 text-slate-300'
                }`}
              >
                {pos === 'ALL' ? 'Tümü' : pos}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* OYUNCU LİSTESİ */}
      {userAcademy.length === 0 ? (
        <div className="glass-panel rounded-xl p-5 text-center text-slate-400 py-16">
          <p className="text-5xl mb-4">🎓</p>
          <p className="text-lg mb-2">Akademide oyuncu yok</p>
          <p className="text-xs">Her sezon başında yeni genç yetenekler gelir</p>
        </div>
      ) : (
        <div className="space-y-2">
          {userAcademy.map(player => {
            const isSelected = selected.has(player.id);
            const posColor = getPosColor(player.position);

            return (
              <div
                key={player.id}
                className={`glass-panel rounded-xl p-4 transition-all ${
                  isSelected ? 'ring-2 ring-accent' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleSelect(player.id)}
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-accent border-accent text-white'
                        : 'border-pitch-600 hover:border-accent'
                    }`}
                  >
                    {isSelected && '✓'}
                  </button>

                  <div className={`w-12 h-12 rounded-lg ${posColor.bg} border-2 ${posColor.border} flex flex-col items-center justify-center flex-shrink-0`}>
                    <span className={`text-[10px] font-bold ${posColor.text}`}>{player.position}</span>
                    <span className="text-xs font-bold text-white">{player.age}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-sm text-white truncate">{player.name}</p>
                      <Stars count={player.potentialStars} />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>{player.age} yaş</span>
                      <span>•</span>
                      <span>{player.nationality}</span>
                      <span>•</span>
                      <span className={getPotentialColor(player.potential)}>
                        {player.scoutRating}
                      </span>
                      <span>•</span>
                      <span className={getPotentialColor(player.potential)}>
                        Potansiyel: {player.potential}
                      </span>
                      <span>•</span>
                      <span>Overall: <strong className="text-slate-200">{player.overall}</strong></span>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        promoteAll([player.id]);
                        setSelected(prev => {
                          const s = new Set(prev);
                          s.delete(player.id);
                          return s;
                        });
                      }}
                      className="text-xs bg-accent hover:bg-accent-hover text-white px-3 py-1.5 rounded font-medium"
                    >
                      ⬆️ Yükselt
                    </button>
                    <button
                      onClick={() => handleRelease(player.id, player.name)}
                      className="text-xs bg-pitch-700 hover:bg-red-900/50 text-slate-400 hover:text-red-300 px-3 py-1.5 rounded font-medium"
                    >
                      ❌
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BİLGİ */}
      <div className="glass-panel rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="text-[11px] text-slate-400 leading-relaxed space-y-1">
            <p className="font-bold text-slate-300">Akademi Nasıl Çalışır?</p>
            <p>• Her sezon başında 3-6 yeni genç oyuncu (15-19 yaş) akademiye katılır</p>
            <p>• <strong className="text-slate-300">Potansiyel (1-200):</strong> 180+ dünya klası, 160+ yıldız adayı, 140+ iyi</p>
            <p>• Yüksek potansiyelli oyuncuları A takıma yükseltip geliştirin</p>
            <p>• Düşük potansiyellileri serbest bırakabilirsiniz</p>
          </div>
        </div>
      </div>
    </div>
  );
}