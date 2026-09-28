// src/components/SeasonEndModal.tsx

import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { calculateSeasonAwards, calculateSeasonSummary } from '../engine/league/awards';
import { TeamBadge } from './TeamBadge';

interface Props {
  onClose: () => void;
}

export function SeasonEndModal({ onClose }: Props) {
  const state = useGameStore();
  const advanceSeason = useGameStore(s => s.advanceSeason);

  const [revealedCount, setRevealedCount] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  const awards = calculateSeasonAwards(state);
  const summary = calculateSeasonSummary(state);

  // Sadece geçerli ödülleri filtrele (boş olanları çıkar)
  const validAwards = awards.filter(a => a.winnerId !== null);

  // Ödülleri sırayla aç
  useEffect(() => {
    if (revealedCount < validAwards.length) {
      const timer = setTimeout(() => {
        setRevealedCount(revealedCount + 1);
      }, 200);
      return () => clearTimeout(timer);
    } else if (!showSummary) {
      const timer = setTimeout(() => {
        setShowSummary(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [revealedCount, validAwards.length, showSummary]);

  const handleNextSeason = () => {
    advanceSeason();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-slate-950/90 backdrop-blur-lg animate-backdrop-in">
      <div className="glass-modal w-full max-w-3xl rounded-xl overflow-hidden shadow-2xl animate-modal-in flex flex-col max-h-[95vh]">

        {/* HEADER */}
        <div className="px-4 py-3 border-b border-pitch-700/50 bg-gradient-to-r from-yellow-500/20 via-transparent to-yellow-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🏆</span>
            <div>
              <h1 className="text-lg font-black text-white">
                Sezon {summary.season} Sona Erdi
              </h1>
              <p className="text-[10px] text-slate-400">Ödüller ve sezon özeti</p>
            </div>
          </div>

          {showSummary && summary.champion && (
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5">
              <span className="text-xs text-yellow-400 font-bold uppercase">
                🥇 Şampiyon
              </span>
              <TeamBadge
                clubId={summary.champion.id}
                shortName={summary.champion.shortName}
                size="xs"
              />
              <span className="text-xs font-bold text-white">
                {summary.champion.shortName}
              </span>
              <span className="text-[10px] text-slate-400">
                {summary.championPoints}p
              </span>
            </div>
          )}
        </div>

        {/* İÇERİK */}
        <div className="p-3 space-y-1.5 overflow-y-auto flex-1">

          {/* ÖDÜLLER */}
          {validAwards.map((award, index) => {
            if (index >= revealedCount) return null;

            const isUserAward = award.clubId === state.userClubId;

            return (
              <div
                key={award.id}
                className={`glass-card rounded-lg border p-2 animate-fade-in-up ${
                  isUserAward
                    ? 'border-accent/60 bg-accent/5'
                    : 'border-pitch-700/50'
                }`}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl flex-shrink-0 w-10 text-center">{award.icon}</div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                      {award.label}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm font-black text-white truncate">
                        {award.winnerName}
                      </p>
                      {award.clubId && (
                        <TeamBadge
                          clubId={award.clubId}
                          shortName={state.clubs[award.clubId]?.shortName ?? '???'}
                          size="xs"
                        />
                      )}
                      {isUserAward && (
                        <span className="text-[8px] text-accent font-bold bg-accent/20 px-1.5 py-0.5 rounded">
                          ⭐ SENİN
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className={`text-lg font-black tabular-nums ${
                      isUserAward ? 'text-accent' : 'text-yellow-400'
                    }`}>
                      {award.id === 'best_rating' || award.id === 'best_young' || award.id === 'golden_glove'
                        ? award.value.toFixed(2)
                        : award.value}
                    </span>
                    <span className="text-[9px] text-slate-500 ml-1 uppercase">
                      {award.valueLabel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* SENİN SEZONUN */}
          {showSummary && (
            <div className="glass-card rounded-lg border border-pitch-700/50 p-3 animate-fade-in-up">
              <div className="flex items-center gap-3">
                <span className="text-lg">📊</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold">
                  Senin Sezonun
                </span>
                <div className="flex-1 grid grid-cols-4 gap-2">
                  <div className="text-center">
                    <p className="text-[9px] text-slate-500 uppercase">Sıra</p>
                    <p className={`text-base font-bold ${
                      summary.userPosition === 1 ? 'text-yellow-400' :
                      summary.userPosition <= 4 ? 'text-green-400' :
                      summary.userPosition <= 6 ? 'text-blue-400' :
                      summary.userPosition >= 14 ? 'text-red-400' :
                      'text-slate-200'
                    }`}>
                      {summary.userPosition}.
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-slate-500 uppercase">Puan</p>
                    <p className="text-base font-bold text-accent">{summary.userPoints}</p>
                  </div>
                  <div className="text-center col-span-2">
                    <p className="text-[9px] text-slate-500 uppercase">Durum</p>
                    <p className={`text-xs font-bold ${
                      summary.userPosition === 1 ? 'text-yellow-400' :
                      summary.userPosition <= 4 ? 'text-green-400' :
                      summary.userPosition <= 6 ? 'text-blue-400' :
                      summary.userPosition >= 14 ? 'text-red-400' :
                      'text-slate-300'
                    }`}>
                      {summary.userPosition === 1 ? '🏆 ŞAMPİYON' :
                       summary.userPosition <= 4 ? '🟢 ŞL' :
                       summary.userPosition <= 6 ? '🔵 AL' :
                       summary.userPosition >= 14 ? '🔴 Düşme' :
                       '⚪ Orta'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-4 py-2.5 border-t border-pitch-700/50 bg-pitch-800/50">
          <button
            onClick={handleNextSeason}
            disabled={revealedCount < validAwards.length || !showSummary}
            className={`w-full py-2 rounded-md font-bold text-white text-sm transition-all ${
              revealedCount < validAwards.length || !showSummary
                ? 'bg-pitch-700 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-accent to-green-500 hover:scale-[1.01]'
            }`}
          >
            {revealedCount < validAwards.length || !showSummary
              ? '⏳ Ödüller açıklanıyor...'
              : '🏁 Yeni Sezona Geç'}
          </button>
        </div>
      </div>
    </div>
  );
}