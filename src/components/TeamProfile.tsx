import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { calculateTeamUnits, compareUnits, unitRating } from '../engine/units/teamUnits';
import type { TeamUnits } from '../engine/types';

export function TeamProfile() {
  const state = useGameStore();
  const userClub = state.clubs[state.userClubId];
  const [selectedClubId, setSelectedClubId] = useState(state.userClubId);

  if (!userClub) return null;

  const selectedClub = state.clubs[selectedClubId];
  const units = calculateTeamUnits(selectedClub, state.players);

  // Sıradaki rakip
  const nextMatch = state.fixtures.find(
    m => m.week === state.currentWeek && !m.played &&
      (m.homeId === state.userClubId || m.awayId === state.userClubId)
  );
  const opponentId = nextMatch
    ? (nextMatch.homeId === state.userClubId ? nextMatch.awayId : nextMatch.homeId)
    : null;
  const opponent = opponentId ? state.clubs[opponentId] : null;

  const userUnits = calculateTeamUnits(userClub, state.players);
  const opponentUnits = opponent ? calculateTeamUnits(opponent, state.players) : null;
  const comparison = opponentUnits ? compareUnits(userUnits, opponentUnits) : null;

  const unitKeys: (keyof TeamUnits)[] = ['attack', 'midfield', 'defense', 'wings', 'transition', 'goalkeeper'];

  const unitLabels: Record<string, { label: string; icon: string }> = {
    attack: { label: 'Hücum', icon: '⚔️' },
    midfield: { label: 'Orta Saha', icon: '🎯' },
    defense: { label: 'Savunma', icon: '🛡️' },
    wings: { label: 'Kanatlar', icon: '🏃' },
    transition: { label: 'Geçiş', icon: '⚡' },
    goalkeeper: { label: 'Kaleci', icon: '🧤' },
    overall: { label: 'Genel', icon: '📊' },
  };

  return (
    <div className="space-y-6">
      {/* Kulüp seçici */}
      <div className="card">
        <h2 className="text-lg font-bold mb-3">📊 Takım Profili (6 Birim)</h2>
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            onClick={() => setSelectedClubId(state.userClubId)}
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              selectedClubId === state.userClubId
                ? 'bg-accent text-white'
                : 'bg-pitch-700 hover:bg-pitch-600 text-slate-300'
            }`}
          >
            🏠 {userClub.shortName} (Sen)
          </button>
          {opponent && (
            <button
              onClick={() => setSelectedClubId(opponent.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium ${
                selectedClubId === opponent.id
                  ? 'bg-accent text-white'
                  : 'bg-pitch-700 hover:bg-pitch-600 text-slate-300'
              }`}
            >
              ⚔️ {opponent.shortName} (Sıradaki Rakip)
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {selectedClub.name} • Formasyon: {selectedClub.tactic.formation} • Zihniyet: {selectedClub.tactic.mentality}
        </p>
      </div>

      {/* 6 birim kartı */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {unitKeys.map(key => {
          const value = units[key] as number;
          const info = unitLabels[key];
          const rating = unitRating(value);
          const pct = Math.min(100, value);

          return (
            <div key={key} className="card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{info.icon}</span>
                  <div className="font-bold text-sm">{info.label}</div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${rating.color}`}>{value.toFixed(1)}</div>
                  <div className="text-xs text-slate-500">{rating.label}</div>
                </div>
              </div>
              <div className="w-full bg-pitch-700 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${
                    value >= 80 ? 'bg-green-400' :
                    value >= 70 ? 'bg-green-500' :
                    value >= 60 ? 'bg-yellow-500' :
                    value >= 50 ? 'bg-orange-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold">📊 Genel Güç</h3>
            <p className="text-xs text-slate-400">6 birimin ortalaması</p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${unitRating(units.overall).color}`}>
              {units.overall.toFixed(1)}
            </div>
            <div className="text-xs text-slate-500">{unitRating(units.overall).label}</div>
          </div>
        </div>
      </div>

      {/* Rakip karşılaştırması */}
      {comparison && opponent && (
        <div className="card">
          <h2 className="text-lg font-bold mb-3">
            ⚔️ Rakip Analizi: {userClub.shortName} vs {opponent.shortName}
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Sigmoid formülü: fark +10 → %73 üstünlük, +5 → %62, 0 → %50
          </p>
          <div className="space-y-4">
            {comparison.map(c => {
              const homeWidth = Math.min(100, c.homeValue);
              const awayWidth = Math.min(100, c.awayValue);

              return (
                <div key={c.unit}>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className={c.favored === 'home' ? 'text-accent font-bold' : 'text-slate-300'}>
                      {c.homeValue.toFixed(1)}
                    </span>
                    <span className="text-slate-400">
                      {c.icon} {c.unit}
                    </span>
                    <span className={c.favored === 'away' ? 'text-red-400 font-bold' : 'text-slate-300'}>
                      {c.awayValue.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex gap-1 h-3 mb-1">
                    <div className="flex-1 bg-pitch-700 rounded-l overflow-hidden relative">
                      <div
                        className={`h-full absolute right-0 ${
                          c.favored === 'home' ? 'bg-accent' : 'bg-pitch-500'
                        }`}
                        style={{ width: `${homeWidth}%` }}
                      />
                    </div>
                    <div className="flex-1 bg-pitch-700 rounded-r overflow-hidden">
                      <div
                        className={`h-full ${
                          c.favored === 'away' ? 'bg-red-500' : 'bg-pitch-500'
                        }`}
                        style={{ width: `${awayWidth}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-center">
                    {c.favored === 'home' && (
                      <span className="text-accent">
                        ✅ {userClub.shortName} üstün — %{c.advantagePct.toFixed(1)}
                      </span>
                    )}
                    {c.favored === 'away' && (
                      <span className="text-red-400">
                        ⚠️ {opponent.shortName} üstün — %{(100 - c.advantagePct).toFixed(1)}
                      </span>
                    )}
                    {c.favored === 'neutral' && (
                      <span className="text-slate-500">➖ Dengeli</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!opponent && (
        <div className="card text-center text-slate-400 py-8">
          Bu hafta rakibin yok. Profilini inceleyebilirsin.
        </div>
      )}
    </div>
  );
}