// src/components/PlayerDetailModal.tsx

import { useEffect, useRef } from 'react';
import type { Player } from '../engine/types';
import { scorePlayer } from '../engine/data/generateData';
import { getTeamColor } from '../utils/teamColors';
import { PlayerStatusCard } from './PlayerStatusCard';

declare global {
  interface Window {
    Chart: any;
  }
}

interface Props {
  player: Player | null;
  clubId: string;
  clubName: string;
  onClose: () => void;
}

function getPosColor(position: string): { bg: string; text: string; border: string } {
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

function attrColor(v: number): string {
  if (v >= 80) return 'text-green-400';
  if (v >= 65) return 'text-yellow-400';
  if (v >= 50) return 'text-orange-400';
  return 'text-red-400';
}

function PlayerRadar({ player }: { player: Player }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const a = player.attributes;

  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    let labels: string[];
    let data: number[];

    if (player.position === 'GK') {
      labels = ['Refleks', 'Pozisyon', 'Top Tutma', 'Birebir', 'Hava Topu', 'Ayak'];
      data = [a.reflexes, a.gkPositioning, a.handling, a.oneOnOne, a.aerialReach, a.passing];
    } else if (['DC', 'DL', 'DR'].includes(player.position)) {
      labels = ['Markaj', 'Müdahale', 'Pozisyon', 'Öngörü', 'Güç', 'Hız'];
      data = [a.marking, a.tackling, a.defensivePositioning, a.anticipation, a.strength, a.pace];
    } else if (['DM', 'MC'].includes(player.position)) {
      labels = ['Pas', 'Vizyon', 'Karar', 'Teknik', 'Dayanıklılık', 'Top Kapma'];
      data = [a.passing, a.vision, a.decisions, a.technique, a.stamina, a.ballWinning];
    } else if (['ML', 'MR', 'AML', 'AMR'].includes(player.position)) {
      labels = ['Hız', 'Dripling', 'Orta', 'Teknik', 'Bitiricilik', 'Topsuz Alan'];
      data = [a.pace, a.dribbling, a.crossing, a.technique, a.finishing, a.offTheBall];
    } else {
      labels = ['Bitiricilik', 'Şut', 'Topsuz Alan', 'Soğukkanlılık', 'Teknik', 'Hız'];
      data = [a.finishing, a.shooting, a.offTheBall, a.composure, a.technique, a.pace];
    }

    chartRef.current = new window.Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          label: 'Oyuncu Profili',
          data,
          backgroundColor: 'rgba(34, 197, 94, 0.2)',
          borderColor: '#22c55e',
          pointBackgroundColor: '#22c55e',
          pointBorderColor: '#fff',
          borderWidth: 2,
          pointRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            pointLabels: {
              color: '#94a3b8',
              font: { size: 10, weight: 'bold' as const },
            },
            ticks: { display: false, backdropColor: 'transparent' },
            suggestedMin: 0,
            suggestedMax: 100,
          }
        },
        plugins: {
          legend: { display: false },
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [player]);

  return (
    <div className="radar-container">
      <canvas ref={canvasRef} />
    </div>
  );
}

function InfoBox({ label, value, valueColor, highlight }: { label: string; value: string; valueColor?: string; highlight?: boolean }) {
  return (
    <div className={`glass-card p-3 rounded-xl border ${highlight ? 'border-accent/40' : 'border-pitch-700/50'}`}>
      <p className="text-[10px] text-slate-400 uppercase">{label}</p>
      <p className={`text-sm font-bold mt-1 ${highlight ? 'text-accent' : (valueColor ?? 'text-slate-200')}`}>
        {value}
      </p>
    </div>
  );
}

function AttrRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex justify-between">
      <span className="text-slate-400 truncate">{label}</span>
      <span className={`font-bold ml-2 ${attrColor(value)}`}>{value}</span>
    </li>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
        <span>{label}</span>
        <span className="font-bold">{value}%</span>
      </div>
      <div className="w-full h-2 bg-pitch-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

function getBarColor(value: number): string {
  if (value >= 80) return 'bg-green-500';
  if (value >= 60) return 'bg-yellow-500';
  if (value >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function CareerStat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="text-center bg-pitch-800/40 rounded-lg p-2">
      <p className="text-[9px] text-slate-500 uppercase">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${color ?? 'text-slate-200'}`}>{value}</p>
    </div>
  );
}

export function PlayerDetailModal({ player, clubId, clubName, onClose }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!player) return null;

  const rating = scorePlayer(player);
  const posColor = getPosColor(player.position);
  const clubColor = getTeamColor(clubId);
  const a = player.attributes;
  const initials = player.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  const stats = player.careerStats ?? {
    appearances: 0,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    avgRating: 0,
    minutesPlayed: 0,
    motm: 0,
    seasonAppearances: 0,
    seasonGoals: 0,
    seasonAssists: 0,
    seasonYellowCards: 0,
    seasonRedCards: 0,
    seasonAvgRating: 0,
    seasonMinutesPlayed: 0,
    seasonMotm: 0,
  };

  const hasCareer = stats.appearances > 0;
  const hasSeason = stats.seasonAppearances > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-backdrop-in"
      onClick={onClose}
    >
      <div
        className="glass-modal w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-modal-in"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div
          className="px-6 py-4 border-b border-pitch-700/50 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${clubColor.bg}20 0%, transparent 100%)` }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center font-black text-2xl shadow-lg"
              style={{
                backgroundColor: clubColor.bg,
                color: clubColor.fg,
                boxShadow: `0 0 20px ${clubColor.bg}60`,
              }}
            >
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-black text-white">{player.name}</h2>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded font-bold ${posColor.bg} ${posColor.text} border ${posColor.border}`}>
                  {player.position}
                </span>
                <span>{player.age} yaş</span>
                <span>•</span>
                <span>{player.nationality}</span>
                <span>•</span>
                <span className="font-bold">{clubName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase">Genel Reyting</p>
              <p className={`text-4xl font-black ${getRatingColor(rating)}`}>{rating}</p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-pitch-700 hover:bg-pitch-600 flex items-center justify-center text-slate-300 hover:text-white transition text-lg"
            >
              ✕
            </button>
          </div>
        </div>

        {/* İÇERİK */}
        <div className="overflow-y-auto p-6 space-y-5">

          {/* 1. Temel bilgiler */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoBox label="Piyasa Değeri" value={`£${(player.value / 1_000_000).toFixed(2)}M`} highlight />
            <InfoBox label="Haftalık Maaş" value={`£${(player.wage / 1_000).toFixed(0)}K`} />
            <InfoBox label="Kondisyon" value={`${player.condition}%`} valueColor={player.condition >= 80 ? 'text-green-400' : player.condition >= 60 ? 'text-yellow-400' : 'text-red-400'} />
            <InfoBox label="Form" value={`${player.form}%`} valueColor={player.form >= 70 ? 'text-green-400' : player.form >= 50 ? 'text-yellow-400' : 'text-red-400'} />
          </div>

          {/* 2. PLAYER STATUS CARD — Mevki Uyumu + Sakatlık Riski + Son 5 Maç */}
          <PlayerStatusCard
            player={player}
            selectedTacticalPosition={player.position}
          />

          {/* 3. KARİYER + SEZON İSTATİSTİKLERİ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* KARİYER */}
            <div className="glass-card p-4 rounded-xl">
              <h4 className="text-xs font-bold text-slate-300 uppercase mb-3">🏆 Kariyer</h4>
              {!hasCareer ? (
                <div className="text-center py-4">
                  <p className="text-xs text-slate-500">Henüz profesyonel maç oynamadı</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <CareerStat label="Maç" value={stats.appearances} />
                    <CareerStat label="Gol" value={stats.goals} color={stats.goals > 0 ? 'text-green-400' : undefined} />
                    <CareerStat label="Asist" value={stats.assists} color={stats.assists > 0 ? 'text-blue-400' : undefined} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <CareerStat label="Sarı" value={stats.yellowCards} color={stats.yellowCards > 0 ? 'text-yellow-400' : undefined} />
                    <CareerStat label="Kırmızı" value={stats.redCards} color={stats.redCards > 0 ? 'text-red-400' : undefined} />
                    <CareerStat label="MVP" value={stats.motm} color={stats.motm > 0 ? 'text-purple-400' : undefined} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <CareerStat
                      label="Ort. Reyting"
                      value={stats.avgRating > 0 ? stats.avgRating.toFixed(2) : '---'}
                      color={stats.avgRating > 0 ? 'text-accent' : 'text-slate-500'}
                    />
                    <CareerStat label="Dakika" value={stats.minutesPlayed.toLocaleString()} />
                  </div>
                </>
              )}
            </div>

            {/* BU SEZON */}
            <div className="glass-card p-4 rounded-xl">
              <h4 className="text-xs font-bold text-slate-300 uppercase mb-3">📅 Bu Sezon</h4>
              {!hasSeason ? (
                <div className="text-center py-4">
                  <p className="text-xs text-slate-500">Bu sezon henüz maç oynamadı</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <CareerStat label="Maç" value={stats.seasonAppearances} />
                    <CareerStat label="Gol" value={stats.seasonGoals} color={stats.seasonGoals > 0 ? 'text-green-400' : undefined} />
                    <CareerStat label="Asist" value={stats.seasonAssists} color={stats.seasonAssists > 0 ? 'text-blue-400' : undefined} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <CareerStat label="Sarı" value={stats.seasonYellowCards} color={stats.seasonYellowCards > 0 ? 'text-yellow-400' : undefined} />
                    <CareerStat label="Kırmızı" value={stats.seasonRedCards} color={stats.seasonRedCards > 0 ? 'text-red-400' : undefined} />
                    <CareerStat label="MVP" value={stats.seasonMotm} color={stats.seasonMotm > 0 ? 'text-purple-400' : undefined} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <CareerStat
                      label="Ort. Reyting"
                      value={stats.seasonAvgRating > 0 ? stats.seasonAvgRating.toFixed(2) : '---'}
                      color={stats.seasonAvgRating > 0 ? 'text-accent' : 'text-slate-500'}
                    />
                    <CareerStat label="Dakika" value={stats.seasonMinutesPlayed.toLocaleString()} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 4. Radar + Attribute tablosu */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="glass-card p-4 rounded-xl">
              <h4 className="text-xs font-bold text-slate-300 uppercase mb-3 text-center">
                📊 Özellik Poligonu
              </h4>
              <PlayerRadar player={player} />
            </div>

            <div className="glass-card p-4 rounded-xl">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <h5 className="font-bold text-cyan-400 border-b border-pitch-700 pb-1 mb-2 text-[10px] uppercase">
                    Teknik
                  </h5>
                  <ul className="space-y-1.5 text-[11px]">
                    <AttrRow label="Pas" value={a.passing} />
                    <AttrRow label="İlk Dokunuş" value={a.firstTouch} />
                    <AttrRow label="Dripling" value={a.dribbling} />
                    <AttrRow label="Orta" value={a.crossing} />
                    <AttrRow label="Şut" value={a.shooting} />
                    <AttrRow label="Bitiricilik" value={a.finishing} />
                    <AttrRow label="Teknik" value={a.technique} />
                    <AttrRow label="Kafa" value={a.heading} />
                  </ul>
                </div>

                <div>
                  <h5 className="font-bold text-green-400 border-b border-pitch-700 pb-1 mb-2 text-[10px] uppercase">
                    Zihinsel
                  </h5>
                  <ul className="space-y-1.5 text-[11px]">
                    <AttrRow label="Karar" value={a.decisions} />
                    <AttrRow label="Vizyon" value={a.vision} />
                    <AttrRow label="Öngörü" value={a.anticipation} />
                    <AttrRow label="Pozisyon" value={a.positioning} />
                    <AttrRow label="Soğukkan." value={a.composure} />
                    <AttrRow label="Konsantras." value={a.concentration} />
                    <AttrRow label="Çalışkanlık" value={a.workRate} />
                    <AttrRow label="Liderlik" value={a.bravery} />
                  </ul>
                </div>

                <div>
                  <h5 className="font-bold text-amber-400 border-b border-pitch-700 pb-1 mb-2 text-[10px] uppercase">
                    Fiziksel
                  </h5>
                  <ul className="space-y-1.5 text-[11px]">
                    <AttrRow label="Hız" value={a.pace} />
                    <AttrRow label="Hızlanma" value={a.acceleration} />
                    <AttrRow label="Çeviklik" value={a.agility} />
                    <AttrRow label="Dayanıkl." value={a.stamina} />
                    <AttrRow label="Güç" value={a.strength} />
                    <AttrRow label="Denge" value={a.balance} />
                    {player.position === 'GK' && (
                      <>
                        <AttrRow label="Refleks" value={a.reflexes} />
                        <AttrRow label="Top Tutma" value={a.handling} />
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Form/Moral/Kondisyon barları */}
          <div className="glass-card p-4 rounded-xl">
            <h4 className="text-xs font-bold text-slate-300 uppercase mb-3">📈 Durum</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Bar label="Kondisyon" value={player.condition} color={getBarColor(player.condition)} />
              <Bar label="Form" value={player.form} color={getBarColor(player.form)} />
              <Bar label="Moral" value={player.morale} color={getBarColor(player.morale)} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}