// src/components/Cup.tsx

import { useGameStore } from '../store/gameStore';
import { TeamBadge } from './TeamBadge';
import { getTeamColor } from '../utils/teamColors';
import {
  CUP_ROUND_NAMES,
  CUP_WEEKS,
  getCupSummary,
} from '../engine/cup/cupEngine';
import type { CupRound, CupMatch } from '../engine/types';

// ═══════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════

const ROUND_ORDER: CupRound[] = ['round1', 'quarter', 'semi', 'final'];

const ROUND_ICONS: Record<CupRound, string> = {
  round1: '🎯',
  quarter: '🔥',
  semi: '⚡',
  final: '🏆',
};

function getRoundColor(round: CupRound): string {
  switch (round) {
    case 'round1': return 'text-blue-400';
    case 'quarter': return 'text-purple-400';
    case 'semi': return 'text-orange-400';
    case 'final': return 'text-yellow-400';
  }
}

// ═══════════════════════════════════════════════
// KUPA MAÇ KARTI
// ═══════════════════════════════════════════════

interface CupMatchCardProps {
  cupMatch: CupMatch;
  isUserMatch: boolean;
  isActiveWeek: boolean;
  onPlay: () => void;
}

function CupMatchCard({ cupMatch, isUserMatch, isActiveWeek, onPlay }: CupMatchCardProps) {
  const state = useGameStore();
  const home = state.clubs[cupMatch.homeId];
  const away = state.clubs[cupMatch.awayId];
  const match = cupMatch.match;
  const isPlayed = cupMatch.winnerId !== null;

  const homeColor = getTeamColor(cupMatch.homeId).bg;
  const awayColor = getTeamColor(cupMatch.awayId).bg;

  return (
    <div
      className={`rounded-lg border transition-all p-3 ${
        isUserMatch
          ? isActiveWeek && !isPlayed
            ? 'border-accent bg-accent/10 ring-1 ring-accent/40'
            : 'border-accent/60 bg-accent/5'
          : 'border-pitch-700 bg-pitch-800/50'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* EV SAHİBİ */}
        <div className="flex-1 flex items-center gap-2 justify-end">
          <span
            className={`text-sm font-medium truncate ${
              cupMatch.winnerId === cupMatch.homeId
                ? 'text-accent font-bold'
                : cupMatch.winnerId === cupMatch.awayId
                ? 'text-slate-500 line-through'
                : 'text-slate-200'
            }`}
          >
            {home?.shortName}
          </span>
          <TeamBadge clubId={cupMatch.homeId} shortName={home?.shortName ?? '???'} size="sm" />
        </div>

        {/* SKOR */}
        <div className="flex flex-col items-center min-w-[70px]">
          {isPlayed && match ? (
            <>
              <div className="flex items-center gap-1">
                <span
                  className="text-lg font-bold tabular-nums"
                  style={{ color: homeColor }}
                >
                  {match.homeScore}
                </span>
                <span className="text-slate-500">-</span>
                <span
                  className="text-lg font-bold tabular-nums"
                  style={{ color: awayColor }}
                >
                  {match.awayScore}
                </span>
              </div>
              {match.penalties && (
                <span className="text-[9px] text-yellow-400 font-bold">
                  Pen: {match.penalties.home}-{match.penalties.away}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-500 text-sm font-bold">vs</span>
          )}
        </div>

        {/* DEPLASMAN */}
        <div className="flex-1 flex items-center gap-2">
          <TeamBadge clubId={cupMatch.awayId} shortName={away?.shortName ?? '???'} size="sm" />
          <span
            className={`text-sm font-medium truncate ${
              cupMatch.winnerId === cupMatch.awayId
                ? 'text-accent font-bold'
                : cupMatch.winnerId === cupMatch.homeId
                ? 'text-slate-500 line-through'
                : 'text-slate-200'
            }`}
          >
            {away?.shortName}
          </span>
        </div>

        {/* MAÇA GİT */}
        {isUserMatch && isActiveWeek && !isPlayed && (
          <button
            onClick={onPlay}
            className="text-[10px] font-bold bg-accent hover:bg-accent-hover text-white px-3 py-1.5 rounded whitespace-nowrap"
          >
            ▶ MAÇA GİT
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ANA COMPONENT
// ═══════════════════════════════════════════════

export function Cup() {
  const state = useGameStore();
  const playWeek = useGameStore(s => s.playWeek);
  const cup = state.cup;

  const summary = getCupSummary(cup, state.userClubId);
  const isCupWeek = Object.values(CUP_WEEKS).includes(state.currentWeek);

  // 🏆 KUPA ŞAMPİYONU
  if (cup.champion) {
    const champion = state.clubs[cup.champion];
    const isUserChampion = cup.champion === state.userClubId;

    return (
      <div className="space-y-4">
        <div
          className="glass-panel rounded-xl p-8 text-center"
          style={{
            background: isUserChampion
              ? 'linear-gradient(135deg, rgba(250,204,21,0.2) 0%, rgba(250,204,21,0.05) 100%)'
              : 'linear-gradient(135deg, rgba(250,204,21,0.1) 0%, transparent 100%)',
            borderColor: 'rgba(250,204,21,0.4)',
          }}
        >
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-3xl font-black text-yellow-400 mb-2">
            {isUserChampion ? 'ŞAMPİYON SEN!' : 'KUPA ŞAMPİYONU'}
          </h2>
          <div className="flex items-center justify-center gap-3 mb-4">
            <TeamBadge
              clubId={cup.champion}
              shortName={champion?.shortName ?? '???'}
              size="xl"
            />
            <span className="text-2xl font-bold text-white">{champion?.name}</span>
          </div>
          <p className="text-sm text-slate-400">
            Sezon {cup.season} Kupa Şampiyonu
          </p>
          {isUserChampion && (
            <p className="text-lg text-yellow-300 font-bold mt-4">
              🎉 Tebrikler! Bu sezon kupayı kazandın!
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* BAŞLIK */}
      <div className="glass-panel rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div>
              <h2 className="text-lg font-bold text-white">
                Türkiye Kupası
              </h2>
              <p className="text-xs text-slate-400">
                Sezon {cup.season} • {summary.totalMatches} maç • {summary.playedMatches} oynandı
              </p>
            </div>
          </div>

          {summary.currentRound && (
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase">Aktif Tur</p>
              <p className={`text-lg font-bold ${getRoundColor(summary.currentRound)}`}>
                {ROUND_ICONS[summary.currentRound]} {CUP_ROUND_NAMES[summary.currentRound]}
              </p>
            </div>
          )}

          {!summary.userAlive && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">
              <p className="text-xs text-red-400 font-bold">😞 Kupadan Elendin</p>
            </div>
          )}
        </div>
      </div>

      {/* KUPA TAKVİMİ */}
      <div className="glass-panel rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-3">📅 Kupa Takvimi</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {ROUND_ORDER.map(round => {
            const week = CUP_WEEKS[round];
            const isPast = state.currentWeek > week;
            const isActive = state.currentWeek === week;
            const isFuture = state.currentWeek < week;

            return (
              <div
                key={round}
                className={`p-3 rounded-lg border text-center ${
                  isActive
                    ? 'border-accent bg-accent/10'
                    : isPast
                    ? 'border-pitch-700 bg-pitch-800/30'
                    : 'border-pitch-700 bg-pitch-800/50'
                }`}
              >
                <p className="text-[10px] text-slate-500 uppercase">Hafta {week}</p>
                <p className={`text-sm font-bold ${getRoundColor(round)}`}>
                  {ROUND_ICONS[round]} {CUP_ROUND_NAMES[round]}
                </p>
                {isActive && (
                  <p className="text-[9px] text-accent font-bold mt-1">🔥 BU HAFTA</p>
                )}
                {isPast && (
                  <p className="text-[9px] text-slate-500 mt-1">✅ Bitti</p>
                )}
                {isFuture && (
                  <p className="text-[9px] text-slate-500 mt-1">⏳ Bekliyor</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* KULLANICI MAÇI */}
      {summary.userNextMatch && isCupWeek && (
        <div
          className="glass-panel rounded-xl p-5"
          style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, transparent 100%)',
            borderColor: 'rgba(34,197,94,0.4)',
          }}
        >
          <h3 className="text-base font-bold text-white mb-3">
            ⚽ Sıradaki Kupa Maçın
          </h3>

          <div className="flex items-center justify-center gap-6 py-4">
            <div className="text-center">
              <TeamBadge
                clubId={summary.userNextMatch.homeId}
                shortName={state.clubs[summary.userNextMatch.homeId]?.shortName ?? '???'}
                size="lg"
              />
              <p className="text-xs text-slate-400 mt-2">
                {state.clubs[summary.userNextMatch.homeId]?.shortName}
              </p>
            </div>
            <div className="text-2xl font-bold text-slate-500">VS</div>
            <div className="text-center">
              <TeamBadge
                clubId={summary.userNextMatch.awayId}
                shortName={state.clubs[summary.userNextMatch.awayId]?.shortName ?? '???'}
                size="lg"
              />
              <p className="text-xs text-slate-400 mt-2">
                {state.clubs[summary.userNextMatch.awayId]?.shortName}
              </p>
            </div>
          </div>

          <button
            onClick={playWeek}
            className="w-full py-4 rounded-md font-bold text-white text-lg transition-all hover:scale-[1.02] animate-pulse-glow"
            style={{
              backgroundColor: '#22c55e',
              boxShadow: '0 0 24px rgba(34,197,94,0.4)',
            }}
          >
            ▶ KUPA MAÇINA GİT
          </button>
        </div>
      )}

      {/* TUR TUR MAÇLAR */}
      {ROUND_ORDER.map(round => {
        const matchIds = cup.rounds[round];
        if (matchIds.length === 0) return null;

        const matches = matchIds
          .map(id => cup.matches[id])
          .filter(Boolean);

        if (matches.length === 0) return null;

        const isActiveRound = summary.currentRound === round;

        return (
          <div key={round} className="glass-panel rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-base font-bold flex items-center gap-2 ${getRoundColor(round)}`}>
                {ROUND_ICONS[round]} {CUP_ROUND_NAMES[round]}
              </h3>
              <span className="text-xs text-slate-400">
                {matches.length} maç
              </span>
            </div>

            <div className="space-y-2">
              {matches.map(cupMatch => (
                <CupMatchCard
                  key={cupMatch.id}
                  cupMatch={cupMatch}
                  isUserMatch={
                    cupMatch.homeId === state.userClubId ||
                    cupMatch.awayId === state.userClubId
                  }
                  isActiveWeek={isActiveRound && isCupWeek}
                  onPlay={playWeek}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* BİLGİ */}
      <div className="glass-panel rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="text-[11px] text-slate-400 leading-relaxed">
            <p className="font-bold text-slate-300 mb-1">Kupa Nasıl Çalışır?</p>
            <p>• 16 takım, tek maç eleme</p>
            <p>• Beraberlik → <strong>penaltılar</strong></p>
            <p>• Kupa maçları <strong>hafta 5, 11, 17, 23</strong>'te oynanır</p>
            <p>• Şampiyon olan takım <strong>sezon sonu ödülü</strong> alır</p>
            <p>• Maçlar <strong>lig maçlarından bağımsız</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}