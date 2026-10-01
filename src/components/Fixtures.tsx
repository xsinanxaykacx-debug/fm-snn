// src/components/Fixtures.tsx

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { Match, MatchEvent } from '../engine/types';
import { calculateTeamUnits, compareUnits } from '../engine/units/teamUnits';
import { TeamBadge } from './TeamBadge';
import { getTeamColor } from '../utils/teamColors';

// ═══════════════════════════════════════════════
// EVENT RENKLERİ
// ═══════════════════════════════════════════════

function getEventStyle(type: string): { icon: string; color: string; bg: string } {
  switch (type) {
    case 'goal':
      return { icon: '⚽', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' };
    case 'save':
      return { icon: '🧤', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' };
    case 'miss':
      return { icon: '❌', color: 'text-slate-400', bg: 'bg-slate-500/5 border-slate-500/20' };
    case 'yellow':
      return { icon: '🟨', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' };
    case 'red':
      return { icon: '🟥', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/40' };
    case 'injury':
      return { icon: '🚑', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' };
    case 'substitution':
      return { icon: '🔄', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' };
    case 'kickoff':
      return { icon: '🏁', color: 'text-slate-300', bg: 'bg-pitch-700/30' };
    case 'fulltime':
      return { icon: '🏁', color: 'text-slate-300', bg: 'bg-pitch-700/30' };
    case 'halfTime':
      return { icon: '⏸️', color: 'text-slate-300', bg: 'bg-pitch-700/30' };
    default:
      return { icon: '•', color: 'text-slate-400', bg: 'bg-pitch-700/20' };
  }
}

// ═══════════════════════════════════════════════
// İSTATİSTİK SATIRI
// ═══════════════════════════════════════════════

interface StatRowProps {
  label: string;
  homeValue: number;
  awayValue: number;
  homeColor: string;
  awayColor: string;
  suffix?: string;
}

function StatRow({ label, homeValue, awayValue, homeColor, awayColor, suffix = '' }: StatRowProps) {
  const total = homeValue + awayValue;
  const homePct = total > 0 ? (homeValue / total) * 100 : 50;
  const awayPct = 100 - homePct;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-bold text-slate-200">{homeValue}{suffix}</span>
        <span className="text-slate-400">{label}</span>
        <span className="font-bold text-slate-200">{awayValue}{suffix}</span>
      </div>
      <div className="flex gap-1 h-1.5">
        <div className="flex-1 bg-pitch-700 rounded-l overflow-hidden flex justify-end">
          <div
            className="h-full rounded-l transition-all duration-500"
            style={{ width: `${homePct}%`, backgroundColor: homeColor }}
          />
        </div>
        <div className="flex-1 bg-pitch-700 rounded-r overflow-hidden">
          <div
            className="h-full rounded-r transition-all duration-500"
            style={{ width: `${awayPct}%`, backgroundColor: awayColor }}
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAÇ KARTI (Fikstür listesi)
// ═══════════════════════════════════════════════

interface MatchCardProps {
  match: Match;
  isUserMatch: boolean;
  isActiveWeek: boolean;
  onPlay?: () => void;
}

function MatchCard({ match, isUserMatch, isActiveWeek, onPlay }: MatchCardProps) {
  const state = useGameStore();
  const home = state.clubs[match.homeId!];
  const away = state.clubs[match.awayId!];
  const isPlayed = match.played;

  return (
    <div
      className={`p-2 rounded-md border transition-all ${
        isUserMatch
          ? isActiveWeek
            ? 'border-accent bg-accent/10 ring-1 ring-accent/40'
            : 'border-accent/60 bg-accent/5'
          : 'border-pitch-700 bg-pitch-800/40 hover:bg-pitch-700/30'
      }`}
    >
      <div className="flex justify-between items-center gap-2">
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          <span className={`text-sm font-medium truncate ${isUserMatch && match.homeId === state.userClubId ? 'text-accent font-bold' : 'text-slate-200'}`}>
            {home?.shortName}
          </span>
          <TeamBadge clubId={match.homeId!} shortName={home?.shortName ?? '???'} size="xs" />
        </div>

        <span className={`px-2 font-bold text-xs whitespace-nowrap ${isPlayed ? 'text-white' : 'text-slate-500'}`}>
          {isPlayed ? `${match.homeScore} - ${match.awayScore}` : 'vs'}
        </span>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <TeamBadge clubId={match.awayId!} shortName={away?.shortName ?? '???'} size="xs" />
          <span className={`text-sm font-medium truncate ${isUserMatch && match.awayId === state.userClubId ? 'text-accent font-bold' : 'text-slate-200'}`}>
            {away?.shortName}
          </span>
        </div>

        {isUserMatch && isActiveWeek && !isPlayed && onPlay && (
          <button
            onClick={onPlay}
            className="text-[10px] font-bold bg-accent hover:bg-accent-hover text-white px-2.5 py-1 rounded whitespace-nowrap flex-shrink-0"
          >
            ▶ MAÇA GİT
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// HAFTA BLOĞU
// ═══════════════════════════════════════════════

interface WeekBlockProps {
  week: number;
  matches: Match[];
  isActive: boolean;
  isPast: boolean;
  onPlay: () => void;
}

function WeekBlock({ week, matches, isActive, isPast, onPlay }: WeekBlockProps) {
  const state = useGameStore();
  const userMatch = matches.find(
    m => m.homeId === state.userClubId || m.awayId === state.userClubId
  );

  const allPlayed = matches.every(m => m.played);
  return (
    <div
      className={`rounded-lg border overflow-hidden ${
        isActive
          ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
          : 'border-pitch-700 bg-pitch-800/40'
      }`}
    >
      {/* Hafta başlığı */}
      <div
        className={`px-3 py-2 flex items-center justify-between border-b ${
          isActive
            ? 'border-accent/40 bg-accent/10'
            : 'border-pitch-700 bg-pitch-800/80'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${isActive ? 'text-accent' : 'text-slate-300'}`}>
            HAFTA {week}
          </span>
          {isActive && (
            <span className="text-[9px] bg-accent text-white px-1.5 py-0.5 rounded font-bold">
              🔥 BU HAFTA
            </span>
          )}
          {isPast && (
            <span className="text-[9px] text-slate-500">✅ Bitti</span>
          )}
        </div>

        <div className="text-[10px] text-slate-400">
          {matches.length} maç
          {allPlayed ? ' • Tümü oynandı' : ''}
        </div>
      </div>

      {/* Maçlar */}
      <div className="p-2 space-y-1">
        {matches.map(m => (
          <MatchCard
            key={m.id}
            match={m}
            isUserMatch={m.homeId === state.userClubId || m.awayId === state.userClubId}
            isActiveWeek={isActive}
            onPlay={onPlay}
          />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ANA COMPONENT
// ═══════════════════════════════════════════════

export function Fixtures() {
  const state = useGameStore();
  const playWeek = useGameStore(s => s.playWeek);
  const userClub = state.clubs[state.userClubId];

  const [showPast, setShowPast] = useState(true);

  // Aktif hafta maçları
  const thisWeekMatch = state.fixtures.find(
    m =>
      m.week === state.currentWeek &&
      (m.homeId === state.userClubId || m.awayId === state.userClubId)
  );

  // Son oynanan maç
  const lastPlayedMatch = [...state.fixtures]
    .filter(m => m.played && (m.homeId === state.userClubId || m.awayId === state.userClubId))
    .sort((a, b) => (b.week ?? 0) - (a.week ?? 0))[0];

  // Tüm haftalar (1 → max)
  const allWeeks = Array.from(
    new Set(state.fixtures.map(m => m.week ?? 0))
  ).sort((a, b) => a - b);

  // Maç önizleme
  const renderPreview = () => {
    if (!thisWeekMatch || thisWeekMatch.played) return null;

    const home = state.clubs[thisWeekMatch.homeId!];
    const away = state.clubs[thisWeekMatch.awayId!];
    const homeUnits = calculateTeamUnits(home, state.players);
    const awayUnits = calculateTeamUnits(away, state.players);
    const comparison = compareUnits(homeUnits, awayUnits);

    const homeColor = getTeamColor(home.id).bg;
    const awayColor = getTeamColor(away.id).bg;

    return (
      <div
        className="glass-panel rounded-xl p-5"
        style={{
          background: `linear-gradient(135deg, ${homeColor}10 0%, transparent 40%, transparent 60%, ${awayColor}10 100%)`,
        }}
      >
        <h2 className="text-lg font-bold mb-4 text-center text-white">
          🔮 Maç Önizleme — Hafta {thisWeekMatch.week}
        </h2>

        <div className="flex items-center justify-center gap-6 mb-6">
          <div className="flex flex-col items-center">
            <TeamBadge clubId={home.id} shortName={home.shortName} size="xl" />
            <p className="text-sm font-bold mt-2 text-white">{home.name}</p>
            <p className="text-xs text-slate-500">🏠 Ev Sahibi</p>
          </div>
          <div className="text-2xl font-bold text-slate-500">VS</div>
          <div className="flex flex-col items-center">
            <TeamBadge clubId={away.id} shortName={away.shortName} size="xl" />
            <p className="text-sm font-bold mt-2 text-white">{away.name}</p>
            <p className="text-xs text-slate-500">✈️ Deplasman</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {comparison.map(c => {
            const homeWidth = Math.min(100, c.homeValue);
            const awayWidth = Math.min(100, c.awayValue);
            return (
              <div key={c.unit}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={c.favored === 'home' ? 'text-accent font-bold' : 'text-slate-300'}>
                    {c.homeValue.toFixed(1)}
                  </span>
                  <span className="text-slate-400">{c.icon} {c.unit}</span>
                  <span className={c.favored === 'away' ? 'text-red-400 font-bold' : 'text-slate-300'}>
                    {c.awayValue.toFixed(1)}
                  </span>
                </div>
                <div className="flex gap-1 h-2">
                  <div className="flex-1 bg-pitch-700 rounded-l overflow-hidden relative">
                    <div
                      className="h-full absolute right-0 transition-all duration-500"
                      style={{
                        width: `${homeWidth}%`,
                        backgroundColor: c.favored === 'home' ? homeColor : '#4b5563',
                      }}
                    />
                  </div>
                  <div className="flex-1 bg-pitch-700 rounded-r overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${awayWidth}%`,
                        backgroundColor: c.favored === 'away' ? awayColor : '#4b5563',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs mb-6">
          <div
            className="p-3 rounded text-center border"
            style={{ borderColor: `${homeColor}40`, backgroundColor: `${homeColor}10` }}
          >
            <div className="text-slate-400">Genel Güç</div>
            <div className="text-2xl font-bold" style={{ color: homeColor }}>
              {homeUnits.overall.toFixed(1)}
            </div>
            <div className="text-xs text-slate-500">{home.shortName}</div>
          </div>
          <div
            className="p-3 rounded text-center border"
            style={{ borderColor: `${awayColor}40`, backgroundColor: `${awayColor}10` }}
          >
            <div className="text-slate-400">Genel Güç</div>
            <div className="text-2xl font-bold" style={{ color: awayColor }}>
              {awayUnits.overall.toFixed(1)}
            </div>
            <div className="text-xs text-slate-500">{away.shortName}</div>
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
          ▶ MAÇA GİT
        </button>
      </div>
    );
  };

  // Son maç detayı
  const renderMatchDetail = () => {
    const match = lastPlayedMatch;
    if (!match) return null;

    const home = state.clubs[match.homeId!];
    const away = state.clubs[match.awayId!];
    const isUserHome = match.homeId === state.userClubId;
    const ourScore = isUserHome ? match.homeScore : match.awayScore;
    const theirScore = isUserHome ? match.awayScore : match.homeScore;
    const result = ourScore > theirScore ? 'win' : ourScore < theirScore ? 'loss' : 'draw';

    const resultConfig = {
      win:  { color: 'text-green-400', label: '🏆 Kazandık',  bg: 'bg-green-500/10 border-green-500/30' },
      loss: { color: 'text-red-400',   label: '😞 Kaybettik', bg: 'bg-red-500/10 border-red-500/30' },
      draw: { color: 'text-yellow-400', label: '🤝 Beraberlik', bg: 'bg-yellow-500/10 border-yellow-500/30' },
    }[result];

    const homeColor = getTeamColor(home.id).bg;
    const awayColor = getTeamColor(away.id).bg;

    const stats = match.stats as any;
    const homePossession = stats.possession?.home ?? 50;
    const awayPossession = stats.possession?.away ?? 50;
    const homeShots = stats.shots?.home ?? 0;
    const awayShots = stats.shots?.away ?? 0;
    const homeOnTarget = stats.onTarget?.home ?? 0;
    const awayOnTarget = stats.onTarget?.away ?? 0;
    const homeXG = stats.xG?.home ?? 0;
    const awayXG = stats.xG?.away ?? 0;

    return (
      <div className="glass-panel rounded-xl p-5 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">📺 Son Maç — Hafta {match.week}</h2>
          <span className={`text-sm font-bold px-3 py-1 rounded border ${resultConfig.bg} ${resultConfig.color}`}>
            {resultConfig.label}
          </span>
        </div>

        <div className="flex items-center justify-center gap-6 py-4">
          <div className="flex flex-col items-center flex-1">
            <TeamBadge clubId={home.id} shortName={home.shortName} size="xl" />
            <p className="text-sm font-bold mt-2 text-white">{home.name}</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-5xl font-bold tabular-nums">
              <span style={{ color: homeColor }}>{match.homeScore}</span>
              <span className="text-slate-600 mx-2">-</span>
              <span style={{ color: awayColor }}>{match.awayScore}</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">MAÇ SONUCU</p>
          </div>
          <div className="flex flex-col items-center flex-1">
            <TeamBadge clubId={away.id} shortName={away.shortName} size="xl" />
            <p className="text-sm font-bold mt-2 text-white">{away.name}</p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-pitch-700">
          <h3 className="text-sm font-bold text-slate-400">📊 MAÇ İSTATİSTİKLERİ</h3>

          <StatRow label="Topla Oynama" homeValue={homePossession} awayValue={awayPossession} homeColor={homeColor} awayColor={awayColor} suffix="%" />
          <StatRow label="Şut" homeValue={homeShots} awayValue={awayShots} homeColor={homeColor} awayColor={awayColor} />
          <StatRow label="İsabetli Şut" homeValue={homeOnTarget} awayValue={awayOnTarget} homeColor={homeColor} awayColor={awayColor} />
          <StatRow label="xG (Gol Beklentisi)" homeValue={Number(homeXG.toFixed(2))} awayValue={Number(awayXG.toFixed(2))} homeColor={homeColor} awayColor={awayColor} />
        </div>

        <div className="pt-4 border-t border-pitch-700">
          <h3 className="text-sm font-bold text-slate-400 mb-3">📅 DAKİKA DAKİKA</h3>

          {match.events.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">Bu maçta hiç olay olmadı.</p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-2">
              {match.events.map((e: MatchEvent, i: number) => {
                const style = getEventStyle(e.type);
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-3 py-2 rounded border-l-2 text-sm animate-fade-in-up ${style.bg}`}
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    <span className="w-8 text-xs font-bold text-slate-400 tabular-nums">
                      {e.minute}'
                    </span>
                    <span className="text-lg">{style.icon}</span>
                    <span className={`flex-1 ${style.color}`}>{e.description}</span>
                    {e.xG !== undefined && (
                      <span className="text-xs text-slate-500 tabular-nums">
                        xG: {e.xG.toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* BAŞLIK */}
      <div className="glass-panel rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">📅 Fikstür — Sezon {state.season}</h2>
            <p className="text-sm text-slate-400">
              {userClub?.name} • Hafta {state.currentWeek} / {allWeeks.length}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowPast(!showPast)}
              className={`text-xs px-3 py-1.5 rounded font-medium ${
                showPast
                  ? 'bg-accent text-white'
                  : 'bg-pitch-700 hover:bg-pitch-600 text-slate-300'
              }`}
            >
              {showPast ? '👁️ Geçmişi Gizle' : '👁️ Geçmişi Göster'}
            </button>
          </div>
        </div>
      </div>

      {/* MAÇ ÖNİZLEME (BU HAFTA) */}
      {renderPreview()}

      {/* FİKSTÜR LİSTESİ */}
      <div className="space-y-3">
        {/* Geçmiş haftalar */}
        {showPast &&
          allWeeks
            .filter(w => w < state.currentWeek)
            .map(w => (
              <WeekBlock
                key={w}
                week={w}
                matches={state.fixtures.filter(m => m.week === w)}
                isActive={false}
                isPast={true}
                onPlay={playWeek}
              />
            ))}

        {/* Aktif hafta */}
        {allWeeks.includes(state.currentWeek) && (
          <WeekBlock
            week={state.currentWeek}
            matches={state.fixtures.filter(m => m.week === state.currentWeek)}
            isActive={true}
            isPast={false}
            onPlay={playWeek}
          />
        )}

        {/* Gelecek haftalar */}
        {allWeeks
          .filter(w => w > state.currentWeek)
          .map(w => (
            <WeekBlock
              key={w}
              week={w}
              matches={state.fixtures.filter(m => m.week === w)}
              isActive={false}
              isPast={false}
              onPlay={playWeek}
            />
          ))}
      </div>

      {/* SON MAÇ DETAYI */}
      {renderMatchDetail()}
    </div>
  );
}