// src/components/PlayerStatusCard.tsx

import type { Player, Position } from '../engine/types';

interface Props {
  player: Player;
  selectedTacticalPosition?: Position;
}

function getPositionSuitability(player: Player, targetPos: Position): {
  label: string;
  icon: string;
  bg: string;
  text: string;
  border: string;
} {
  if (player.position === targetPos) {
    return {
      label: 'Doğal Mevki',
      icon: '🟢',
      bg: 'bg-green-500/20',
      text: 'text-green-400',
      border: 'border-green-500/40',
    };
  }
  if (player.secondaryPositions?.includes(targetPos)) {
    return {
      label: 'Alternatif',
      icon: '🟡',
      bg: 'bg-yellow-500/20',
      text: 'text-yellow-400',
      border: 'border-yellow-500/40',
    };
  }
  return {
    label: 'Uyumsuz',
    icon: '🔴',
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/40',
  };
}

function calculateInjuryRisk(player: Player): {
  level: string;
  color: string;
  score: number;
} {
  const ageFactor = player.age > 30 ? (player.age - 30) * 3 : 0;
  const staminaDeficit = (20 - (player.attributes.stamina / 5)) * 2;
  const fatigue = 100 - player.condition;

  const riskScore = fatigue * 0.5 + ageFactor + staminaDeficit;

  if (riskScore > 55) return { level: 'Yüksek Risk', color: 'text-red-400 bg-red-500/10 border-red-500/30', score: riskScore };
  if (riskScore > 30) return { level: 'Orta Risk', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', score: riskScore };
  return { level: 'Düşük Risk', color: 'text-green-400 bg-green-500/10 border-green-500/30', score: riskScore };
}

export function PlayerStatusCard({ player, selectedTacticalPosition }: Props) {
  const suitability = selectedTacticalPosition
    ? getPositionSuitability(player, selectedTacticalPosition)
    : null;

  const injuryRisk = calculateInjuryRisk(player);

  const recentRatings = player.recentRatings ?? [];
  const avgRating = recentRatings.length > 0
    ? recentRatings.reduce((a, b) => a + b, 0) / recentRatings.length
    : 0;

  return (
    <div className="glass-card p-4 rounded-xl space-y-4">

      {/* MEVKİ UYUMU + SAKATLIK RİSKİ */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pitch-700/50 pb-3">
        {suitability && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">🎯 Taktik Uyum:</span>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-bold ${suitability.bg} ${suitability.text} ${suitability.border}`}>
              {suitability.icon} {suitability.label} ({selectedTacticalPosition})
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">🏥 Sakatlık Riski:</span>
          <span className={`text-xs px-2.5 py-1 rounded-full border font-bold ${injuryRisk.color}`}>
            {injuryRisk.level}
          </span>
        </div>
      </div>

      {/* SON 5 MAÇ FORMU */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">📈</span>
            <span className="text-xs font-bold text-slate-300">Son 5 Maç Performansı</span>
          </div>
          {recentRatings.length > 0 && (
            <span className="text-xs text-slate-400">
              Ort: <strong className="text-accent">{avgRating.toFixed(2)}</strong>
            </span>
          )}
        </div>

        {recentRatings.length === 0 ? (
          <div className="h-20 bg-pitch-900/40 rounded-lg border border-pitch-700/50 flex items-center justify-center">
            <p className="text-xs text-slate-500">Henüz maç oynamadı</p>
          </div>
        ) : (
          <div className="flex items-end gap-2 h-20 bg-pitch-900/40 p-2 rounded-lg border border-pitch-700/50">
            {recentRatings.map((rating, index) => {
              const heightPercent = Math.max(15, Math.min(100, ((rating - 5) / 5) * 100));
              const barColor =
                rating >= 7.5 ? 'bg-green-500' :
                rating >= 6.5 ? 'bg-yellow-500' : 'bg-red-500';

              return (
                <div
                  key={index}
                  className="flex-1 flex flex-col items-center h-full justify-end gap-0.5 group relative"
                >
                  <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-pitch-800 text-[10px] py-0.5 px-1.5 rounded border border-pitch-700 whitespace-nowrap z-10">
                    Maç {recentRatings.length - index}: {rating.toFixed(1)}
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {rating.toFixed(1)}
                  </span>
                  <div
                    className={`w-full rounded-t transition-all duration-300 ${barColor}`}
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MEVKİ BİLGİSİ */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">Mevkiler:</span>
        <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/40 font-bold">
          {player.position}
        </span>
        {player.secondaryPositions?.map((p) => (
          <span
            key={p}
            className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 font-bold"
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}