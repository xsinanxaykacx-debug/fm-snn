// src/components/Tactics.tsx

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type {
  Formation,
  Player,
  Position,
  SlotPosition,
} from '../engine/types';
import { getStartingXI, scorePlayer } from '../engine/data/generateData';
import { getFormationZoneMapping } from '../engine/formation/zones';
import { PlayerDetailModal } from './PlayerDetailModal';

// ═══════════════════════════════════════════════
// MAX SAHA OYUNCUSU
// ═══════════════════════════════════════════════

const MAX_PITCH_PLAYERS = 11;

// ═══════════════════════════════════════════════
// SABİT FORMASYONLAR
// ═══════════════════════════════════════════════

const FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'];

const POSITIONS_ON_PITCH: Record<string, { pos: SlotPosition; x: number; y: number }[]> = {
  '4-4-2': [
    { pos: 'GK', x: 50, y: 92 },
    { pos: 'DL', x: 15, y: 72 }, { pos: 'DC', x: 38, y: 75 }, { pos: 'DC', x: 62, y: 75 }, { pos: 'DR', x: 85, y: 72 },
    { pos: 'ML', x: 15, y: 48 }, { pos: 'MC', x: 38, y: 50 }, { pos: 'MC', x: 62, y: 50 }, { pos: 'MR', x: 85, y: 48 },
    { pos: 'ST', x: 38, y: 20 }, { pos: 'ST', x: 62, y: 20 },
  ],
  '4-3-3': [
    { pos: 'GK', x: 50, y: 92 },
    { pos: 'DL', x: 15, y: 72 }, { pos: 'DC', x: 38, y: 75 }, { pos: 'DC', x: 62, y: 75 }, { pos: 'DR', x: 85, y: 72 },
    { pos: 'MC', x: 30, y: 52 }, { pos: 'MC', x: 50, y: 55 }, { pos: 'MC', x: 70, y: 52 },
    { pos: 'AML', x: 20, y: 25 }, { pos: 'ST', x: 50, y: 15 }, { pos: 'AMR', x: 80, y: 25 },
  ],
  '3-5-2': [
    { pos: 'GK', x: 50, y: 92 },
    { pos: 'DC', x: 25, y: 75 }, { pos: 'DC', x: 50, y: 77 }, { pos: 'DC', x: 75, y: 75 },
    { pos: 'WBL', x: 10, y: 52 }, { pos: 'MC', x: 35, y: 55 }, { pos: 'MC', x: 50, y: 52 }, { pos: 'MC', x: 65, y: 55 }, { pos: 'WBR', x: 90, y: 52 },
    { pos: 'ST', x: 38, y: 20 }, { pos: 'ST', x: 62, y: 20 },
  ],
  '4-2-3-1': [
    { pos: 'GK', x: 50, y: 92 },
    { pos: 'DL', x: 15, y: 72 }, { pos: 'DC', x: 38, y: 75 }, { pos: 'DC', x: 62, y: 75 }, { pos: 'DR', x: 85, y: 72 },
    { pos: 'DMC', x: 38, y: 58 }, { pos: 'DMC', x: 62, y: 58 },
    { pos: 'AML', x: 20, y: 35 }, { pos: 'AMC', x: 50, y: 35 }, { pos: 'AMR', x: 80, y: 35 },
    { pos: 'ST', x: 50, y: 15 },
  ],
};

// ═══════════════════════════════════════════════
// 17 POZİSYON
// ═══════════════════════════════════════════════

const ALL_POSITIONS: { key: SlotPosition; label: string; group: string }[] = [
  { key: 'GK',  label: 'GK — Kaleci',              group: 'Kaleci' },
  { key: 'DL',  label: 'DL — Sol Defans',          group: 'Defans' },
  { key: 'DC',  label: 'DC — Orta Defans',         group: 'Defans' },
  { key: 'DR',  label: 'DR — Sağ Defans',          group: 'Defans' },
  { key: 'WBL', label: 'WBL — Kanat Bek Sol',      group: 'Kanat Defans' },
  { key: 'WBR', label: 'WBR — Kanat Bek Sağ',      group: 'Kanat Defans' },
  { key: 'DMC', label: 'DMC — Defansif Orta',      group: 'Orta Saha' },
  { key: 'ML',  label: 'ML — Orta Saha Sol',       group: 'Orta Saha' },
  { key: 'MC',  label: 'MC — Orta Saha Orta',      group: 'Orta Saha' },
  { key: 'MR',  label: 'MR — Orta Saha Sağ',       group: 'Orta Saha' },
  { key: 'AML', label: 'AML — Atak Orta Sol',      group: 'Atak Orta' },
  { key: 'AMC', label: 'AMC — Atak Orta Merkez',   group: 'Atak Orta' },
  { key: 'AMR', label: 'AMR — Atak Orta Sağ',      group: 'Atak Orta' },
  { key: 'KFL', label: 'KFL — Kanat Forvet Sol',   group: 'Forvet' },
  { key: 'GF',  label: 'GF — Gizli Forvet',        group: 'Forvet' },
  { key: 'KFR', label: 'KFR — Kanat Forvet Sağ',   group: 'Forvet' },
  { key: 'ST',  label: 'ST — Santrafor',           group: 'Forvet' },
];

const POSITION_GROUPS = ['Kaleci', 'Defans', 'Kanat Defans', 'Orta Saha', 'Atak Orta', 'Forvet'];

// ═══════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════

function getPosColor(position: string): { bg: string; text: string; border: string } {
  if (position === 'GK') return { bg: 'bg-yellow-500/30', text: 'text-yellow-300', border: 'border-yellow-500/60' };
  if (['DC', 'DL', 'DR'].includes(position)) return { bg: 'bg-blue-500/30', text: 'text-blue-300', border: 'border-blue-500/60' };
  if (['WBL', 'WBR'].includes(position)) return { bg: 'bg-cyan-500/30', text: 'text-cyan-300', border: 'border-cyan-500/60' };
  if (['DMC', 'MC', 'ML', 'MR'].includes(position)) return { bg: 'bg-green-500/30', text: 'text-green-300', border: 'border-green-500/60' };
  if (['AMC', 'AML', 'AMR'].includes(position)) return { bg: 'bg-purple-500/30', text: 'text-purple-300', border: 'border-purple-500/60' };
  if (['KFL', 'KFR', 'GF', 'ST'].includes(position)) return { bg: 'bg-red-500/30', text: 'text-red-300', border: 'border-red-500/60' };
  return { bg: 'bg-slate-500/30', text: 'text-slate-300', border: 'border-slate-500/60' };
}

function safeScore(p: Player): number {
  try {
    const s = scorePlayer(p);
    return Number.isFinite(s) ? s : 50;
  } catch {
    return 50;
  }
}

const POSITION_FILTERS: { key: Position | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Tümü' },
  { key: 'GK', label: 'GK' },
  { key: 'DC', label: 'DC' },
  { key: 'DL', label: 'DL' },
  { key: 'DR', label: 'DR' },
  { key: 'WBL', label: 'WBL' },
  { key: 'WBR', label: 'WBR' },
  { key: 'DMC', label: 'DMC' },
  { key: 'MC', label: 'MC' },
  { key: 'ML', label: 'ML' },
  { key: 'MR', label: 'MR' },
  { key: 'AMC', label: 'AMC' },
  { key: 'AML', label: 'AML' },
  { key: 'AMR', label: 'AMR' },
  { key: 'KFL', label: 'KFL' },
  { key: 'KFR', label: 'KFR' },
  { key: 'GF', label: 'GF' },
  { key: 'ST', label: 'ST' },
];

// ═══════════════════════════════════════════════
// OYUNCU CHIP
// ═══════════════════════════════════════════════

function PlayerChip({
  player,
  zoneId,
  onDragStart,
  onDragEnd,
  onDetail,
  isDragging = false,
}: {
  player: Player;
  zoneId?: string;
  onDragStart?: (e: React.DragEvent, playerId: string, zoneId?: string) => void;
  onDragEnd?: () => void;
  onDetail?: () => void;
  isDragging?: boolean;
}) {
  const posColor = getPosColor(player.position);
  const rating = safeScore(player);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, player.id, zoneId)}
      onDragEnd={onDragEnd}
      onDoubleClick={onDetail}
      className={`cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-40 scale-95' : 'hover:scale-105'
      }`}
      title={player.name}
    >
      <div className={`px-2 py-1 rounded-md border-2 ${posColor.border} ${posColor.bg} backdrop-blur-sm shadow-lg`}>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${posColor.bg} ${posColor.text}`}>
            {player.position}
          </span>
          <span className={`text-xs font-bold ${
            rating >= 70 ? 'text-green-300' :
            rating >= 60 ? 'text-yellow-300' : 'text-orange-300'
          }`}>
            {rating}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// BÖLGE HÜCRESİ
// ═══════════════════════════════════════════════

interface ZoneCellProps {
  zone: PitchZone;
  player: Player | undefined;
  isUserMode: boolean;
  isGK: boolean;
  canDrop: boolean;
  onDropOnZone: (fromZoneId: string | null, toZoneId: string, fromPlayerId: string) => void;
  onDragStart: (e: React.DragEvent, playerId: string, zoneId?: string) => void;
  onDragEnd: () => void;
  onClearZone: (zoneId: string) => void;
  onLabelClick: (zoneId: string) => void;
  onDetail: (p: Player) => void;
  draggingId: string | null;
}

function ZoneCell({
  zone,
  player,
  isUserMode,
  isGK,
  canDrop,
  onDropOnZone,
  onDragStart,
  onDragEnd,
  onClearZone,
  onLabelClick,
  onDetail,
  draggingId,
}: ZoneCellProps) {
  const [isOver, setIsOver] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const displayLabel = zone.customLabel ?? zone.suggestedPosition;
  const posColor = getPosColor(displayLabel);

  const handleDragOver = (e: React.DragEvent) => {
    if (!isUserMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Hedef boşsa ve max 11 doluysa → red göster
    if (!player && !canDrop) {
      setIsRejected(true);
      setIsOver(false);
    } else {
      setIsOver(true);
      setIsRejected(false);
    }
  };

  const handleDragLeave = () => {
    setIsOver(false);
    setIsRejected(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isUserMode) return;
    e.preventDefault();
    setIsOver(false);
    setIsRejected(false);

    const playerId = e.dataTransfer.getData('playerId');
    const fromZoneId = e.dataTransfer.getData('fromZoneId');

    if (playerId) {
      onDropOnZone(fromZoneId || null, zone.id, playerId);
    }
  };

  return (
    <div
      className={`relative rounded border transition-all flex flex-col items-center justify-center min-h-0 ${
        isGK ? 'h-full' : ''
      } ${
        isUserMode
          ? isRejected
            ? 'border-red-600 border-2 bg-red-500/20'
            : isOver
            ? 'border-accent border-2 bg-accent/30 scale-105'
            : player
            ? 'border-pitch-500 bg-pitch-800/70'
            : `border-dashed ${posColor.border} bg-pitch-900/40`
          : 'border-pitch-800 bg-pitch-900/20'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={isRejected ? '❌ Sahaya en fazla 11 oyuncu koyabilirsin!' : undefined}
    >
      {player ? (
        <div className="relative">
          <div
            draggable
            onDragStart={(e) => onDragStart(e, player.id, zone.id)}
            onDragEnd={onDragEnd}
            onDoubleClick={() => onDetail(player)}
            className={`cursor-grab active:cursor-grabbing transition-all ${
              draggingId === player.id ? 'opacity-40 scale-95' : 'hover:scale-105'
            }`}
            title={player.name}
          >
            <div className={`px-1.5 py-0.5 rounded border ${posColor.border} ${posColor.bg} backdrop-blur-sm shadow flex flex-col items-center`}>
              <span className={`text-[8px] font-bold ${posColor.text} leading-none`}>
                {player.position}
              </span>
              <span className={`text-[10px] font-bold leading-none ${
                safeScore(player) >= 70 ? 'text-green-300' :
                safeScore(player) >= 60 ? 'text-yellow-300' :
                safeScore(player) >= 50 ? 'text-orange-300' : 'text-red-300'
              }`}>
                {safeScore(player)}
              </span>
            </div>
          </div>

          {isUserMode && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClearZone(zone.id);
                }}
                className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-[8px] font-bold flex items-center justify-center shadow"
                title="Bölgeden çıkar"
              >
                ✕
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLabelClick(zone.id);
                }}
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[7px] px-1 rounded bg-pitch-700 border border-pitch-600 text-slate-300 hover:bg-pitch-600 whitespace-nowrap leading-none py-0.5"
                title="Pozisyon etiketini değiştir"
              >
                {displayLabel} ▾
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          onClick={() => isUserMode && onLabelClick(zone.id)}
          disabled={!isUserMode}
          className={`text-center ${isUserMode ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
        >
          <span className={`text-[9px] font-bold ${posColor.text} block leading-none`}>
            {displayLabel}
          </span>
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// ANA COMPONENT
// ═══════════════════════════════════════════════

export function Tactics() {
  const state = useGameStore();
  const setTactic = useGameStore(s => s.setTactic);
  const setLineup = useGameStore(s => s.setLineup);
  const resetLineup = useGameStore(s => s.resetLineup);

  const setZonePlayer = useGameStore(s => s.setZonePlayer);
  const swapZones = useGameStore(s => s.swapZones);
  const clearZone = useGameStore(s => s.clearZone);
  const setZoneLabel = useGameStore(s => s.setZoneLabel);
  const resetZoneFormation = useGameStore(s => s.resetZoneFormation);
  const autoFillZones = useGameStore(s => s.autoFillZones);
  const setFormationMode = useGameStore(s => s.setFormationMode);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>('ALL');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [labelEditingZone, setLabelEditingZone] = useState<string | null>(null);

  const userClub = state.clubs[state.userClubId];
  if (!userClub) return null;

  const tactic = userClub.tactic;
  const isCustomMode = tactic.formation === 'CUSTOM';
  const customFormation = userClub.customFormation;

  // ═══ SABİT FORMASYON ═══
  const posOnPitch = POSITIONS_ON_PITCH[tactic.formation] ?? POSITIONS_ON_PITCH['4-4-2'];
  const autoLineup = getStartingXI(userClub.id, state.players, tactic.formation).map(p => p.id);
  const effectiveLineup = state.userLineup.length === 11 ? state.userLineup : autoLineup;

  // ═══ ZONE-BASED ═══
  const zones = customFormation?.zones ?? [];
  const filledZones = zones.filter(z => z.playerId !== null);
  const filledCount = filledZones.length;
  const isZoneComplete = filledCount === 11;
  const isZoneOverfilled = filledCount > 11;

  // Zone grid: 7 satır × 5 sütun
  const zoneGrid: (PitchZone | null)[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 5 }, () => null)
  );
  zones.forEach(z => {
    if (z.row < 7 && z.col < 5) {
      zoneGrid[z.row][z.col] = z;
    }
  });

  // ═══ TÜM KADRO ═══
  const allSquad = Object.values(state.players)
    .filter(p => p.clubId === userClub.id && p.squadRole !== 'u21')
    .filter(p => posFilter === 'ALL' || p.position === posFilter)
    .sort((a, b) => {
      const pa = ALL_POSITIONS.findIndex(x => x.key === a.position);
      const pb = ALL_POSITIONS.findIndex(x => x.key === b.position);
      if (pa !== pb) return pa - pb;
      return safeScore(b) - safeScore(a);
    });

  const zonePlayerIds = new Set(
    zones.map(z => z.playerId).filter(Boolean) as string[]
  );

  // ═══ İSTATİSTİKLER ═══
  const lineupAvg = isCustomMode
    ? (filledZones.length > 0
        ? filledZones.reduce((s, z) => {
            const p = state.players[z.playerId!];
            return s + (p ? safeScore(p) : 0);
          }, 0) / filledZones.length
        : 0)
    : (effectiveLineup.length > 0
        ? effectiveLineup.reduce((s, id) => {
            const p = state.players[id];
            return s + (p ? safeScore(p) : 0);
          }, 0) / effectiveLineup.length
        : 0);

  const allSquadForAvg = Object.values(state.players).filter(p => p.clubId === userClub.id && p.squadRole !== 'u21');
  const squadAvg = allSquadForAvg.length > 0
    ? allSquadForAvg.reduce((s, p) => s + safeScore(p), 0) / allSquadForAvg.length
    : 0;

  // ═══ SÜRÜKLE-BIRAK ═══
  const handleDragStart = (e: React.DragEvent, playerId: string, zoneId?: string) => {
    e.dataTransfer.setData('playerId', playerId);
    if (zoneId) {
      e.dataTransfer.setData('fromZoneId', zoneId);
    }
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(playerId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  const handleZoneDrop = (fromZoneId: string | null, toZoneId: string, fromPlayerId: string) => {
    if (fromZoneId) {
      swapZones(fromZoneId, toZoneId);
    } else {
      setZonePlayer(toZoneId, fromPlayerId);
    }
    setDraggingId(null);
  };

  const applyLabelChange = (zoneId: string, label: SlotPosition) => {
    setZoneLabel(zoneId, label);
    setLabelEditingZone(null);
  };

  const renderButtonGroup = <T extends string>(
    label: string,
    options: { key: T; label: string }[],
    value: T,
    onChange: (v: T) => void
  ) => (
    <div>
      <label className="text-xs text-slate-400 block mb-1">{label}</label>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(o => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`py-1.5 rounded text-[10px] font-medium transition-colors ${
              value === o.key ? 'bg-accent text-white' : 'bg-pitch-700 hover:bg-pitch-600'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  // Satır etiketleri ve flex ağırlıkları
  const ROW_LABELS = ['ST', 'FORVET', 'ATAK ORTA', 'ORTA SAHA', 'DEFANSİF', 'DEFANS', 'KALECİ'];
  const ROW_FLEX = [0.9, 1, 1, 1, 1, 1, 0.8];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* SOL: TAKTİK */}
      <div className="lg:col-span-3 card">
        <h2 className="text-base font-bold mb-3">🎯 Taktik</h2>
        <div className="space-y-3">
          {/* Formasyon Modu */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Formasyon Modu</label>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => setFormationMode('fixed')}
                className={`py-2 rounded text-[10px] font-bold transition-colors ${
                  !isCustomMode ? 'bg-accent text-white' : 'bg-pitch-700 hover:bg-pitch-600'
                }`}
              >
                📋 Sabit
              </button>
              <button
                onClick={() => setFormationMode('custom')}
                className={`py-2 rounded text-[10px] font-bold transition-colors ${
                  isCustomMode ? 'bg-accent text-white' : 'bg-pitch-700 hover:bg-pitch-600'
                }`}
              >
                🎨 Serbest
              </button>
            </div>
          </div>

          {!isCustomMode && renderButtonGroup<Formation>(
            'Formasyon',
            FORMATIONS.map(f => ({ key: f, label: f })),
            tactic.formation,
            (v) => {
              setTactic({ formation: v });
              resetLineup();
            }
          )}

          {isCustomMode && (
            <div className={`rounded p-2 border ${
              isZoneOverfilled
                ? 'bg-red-500/10 border-red-500/40'
                : isZoneComplete
                ? 'bg-green-500/10 border-green-500/40'
                : 'bg-accent/10 border-accent/40'
            }`}>
              <p className={`text-[10px] font-bold mb-1 ${
                isZoneOverfilled
                  ? 'text-red-400'
                  : isZoneComplete
                  ? 'text-green-400'
                  : 'text-accent'
              }`}>
                🎨 Bölge Modu Aktif
              </p>
              <p className="text-[9px] text-slate-400">
                {filledCount} / {MAX_PITCH_PLAYERS} oyuncu
              </p>
              {isZoneComplete ? (
                <p className="text-[10px] text-green-400 font-bold mt-1">✅ Hazır</p>
              ) : isZoneOverfilled ? (
                <p className="text-[10px] text-red-400 font-bold mt-1">
                  ❌ {filledCount - MAX_PITCH_PLAYERS} oyuncu FAZLA! (Max {MAX_PITCH_PLAYERS})
                </p>
              ) : (
                <p className="text-[10px] text-yellow-400 font-bold mt-1">
                  ⚠️ {MAX_PITCH_PLAYERS - filledCount} oyuncu eksik
                </p>
              )}
            </div>
          )}

          {renderButtonGroup(
            'Zihniyet',
            [
              { key: 'defensive' as const, label: '🛡️' },
              { key: 'balanced' as const, label: '⚖️' },
              { key: 'attacking' as const, label: '⚔️' },
            ],
            tactic.mentality,
            (v) => setTactic({ mentality: v })
          )}
          {renderButtonGroup(
            'Pres',
            [
              { key: 'low' as const, label: 'Düşük' },
              { key: 'medium' as const, label: 'Orta' },
              { key: 'high' as const, label: 'Yüksek' },
            ],
            tactic.pressing,
            (v) => setTactic({ pressing: v })
          )}
          {renderButtonGroup(
            'Tempo',
            [
              { key: 'slow' as const, label: 'Yavaş' },
              { key: 'normal' as const, label: 'Normal' },
              { key: 'fast' as const, label: 'Hızlı' },
            ],
            tactic.tempo,
            (v) => setTactic({ tempo: v })
          )}
          {renderButtonGroup(
            'Genişlik',
            [
              { key: 'narrow' as const, label: 'Dar' },
              { key: 'normal' as const, label: 'Normal' },
              { key: 'wide' as const, label: 'Geniş' },
            ],
            tactic.width,
            (v) => setTactic({ width: v })
          )}
          {renderButtonGroup(
            'Pas',
            [
              { key: 'short' as const, label: 'Kısa' },
              { key: 'mixed' as const, label: 'Karışık' },
              { key: 'direct' as const, label: 'Direkt' },
            ],
            tactic.directness,
            (v) => setTactic({ directness: v })
          )}
          {renderButtonGroup(
            'Savunma',
            [
              { key: 'deep' as const, label: 'Derin' },
              { key: 'normal' as const, label: 'Normal' },
              { key: 'high' as const, label: 'Yüksek' },
            ],
            tactic.defensiveLine,
            (v) => setTactic({ defensiveLine: v })
          )}

          {isCustomMode && (
            <div className="space-y-2 pt-2 border-t border-pitch-700">
              <button
                onClick={() => {
                  if (confirm('En iyi 11 oyuncuyu otomatik yerleştirmek istediğine emin misin?')) {
                    const mode = prompt('Formasyon seç (4-4-2, 4-3-3, 3-5-2, 4-2-3-1):', '4-4-2');
                    if (mode && FORMATIONS.includes(mode as Formation)) {
                      autoFillZones(mode as Formation);
                    } else if (mode) {
                      alert('Geçersiz formasyon!');
                    }
                  }
                }}
                className="w-full py-2 rounded text-xs font-bold bg-accent hover:bg-accent-hover text-white"
              >
                ⚡ Otomatik Diz
              </button>
              <button
                onClick={() => {
                  if (confirm('Tüm bölgeleri boşaltmak istediğine emin misin?')) {
                    zones.forEach(z => clearZone(z.id));
                  }
                }}
                className="w-full py-2 rounded text-xs font-bold bg-pitch-700 hover:bg-pitch-600 text-slate-300"
              >
                🧹 Tümünü Boşalt
              </button>
              <button
                onClick={() => {
                  if (confirm('Sabit formasyona dönmek istediğine emin misin?')) {
                    resetZoneFormation();
                  }
                }}
                className="w-full py-2 rounded text-xs font-bold bg-pitch-700 hover:bg-red-900/50 text-slate-300 hover:text-red-300"
              >
                🔄 Sabit Formasyona Dön
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ORTA: SAHA */}
      <div className="lg:col-span-5 card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">⚽ İlk 11</h2>
          {!isCustomMode ? (
            <button
              onClick={() => { setLineup([]); setDraggingId(null); }}
              className="px-3 py-1 rounded text-[10px] font-bold bg-accent hover:bg-accent-hover text-white"
            >
              ⚡ Otomatik Seç
            </button>
          ) : (
            <span className="text-[10px] text-slate-400">Sürükle-bırak • Tıkla = etiket</span>
          )}
        </div>

        {isCustomMode ? (
          /* ZONE-BASED SAHA — 7 satır × 5 sütun */
          <div className={`relative bg-gradient-to-b from-green-800 to-green-900 rounded-lg overflow-hidden p-2 aspect-[3/4] flex flex-col ${
            isZoneOverfilled ? 'ring-2 ring-red-500/50' : ''
          }`}>
            {/* Saha çizgileri */}
            <div className="absolute inset-2 border border-white/20 rounded pointer-events-none"></div>
            <div className="absolute left-2 right-2 top-1/2 border-t border-white/20 pointer-events-none"></div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 border border-white/20 rounded-full pointer-events-none"></div>
            <div className="absolute left-1/2 -translate-x-1/2 top-2 w-14 h-6 border border-white/20 border-t-0 pointer-events-none"></div>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-14 h-6 border border-white/20 border-b-0 pointer-events-none"></div>

            {/* Zone grid */}
            <div className="relative flex-1 flex flex-col gap-0.5">
              {[0, 1, 2, 3, 4, 5, 6].map(rowIdx => {
                const rowZones = zoneGrid[rowIdx];
                const isGKRow = rowIdx === 6;

                return (
                  <div
                    key={rowIdx}
                    className="flex flex-col min-h-0"
                    style={{ flex: ROW_FLEX[rowIdx] }}
                  >
                    <div className="text-[7px] text-white/40 uppercase mb-0.5 px-1 leading-none">
                      {ROW_LABELS[rowIdx]}
                    </div>

                    {isGKRow ? (
                      /* GK satırı — tek slot, ORTA sütunda (col 2) */
                      <div className="grid grid-cols-5 gap-1 flex-1 min-h-0">
                        <div />
                        <div />
                        <div>
                          {rowZones[2] && (
                            <ZoneCell
                              zone={rowZones[2]}
                              player={rowZones[2].playerId ? state.players[rowZones[2].playerId] : undefined}
                              isUserMode={true}
                              isGK={true}
                              canDrop={true}
                              onDropOnZone={handleZoneDrop}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                              onClearZone={clearZone}
                              onLabelClick={setLabelEditingZone}
                              onDetail={setSelectedPlayer}
                              draggingId={draggingId}
                            />
                          )}
                        </div>
                        <div />
                        <div />
                      </div>
                    ) : (
                      /* Normal satır — 5 slot */
                      <div className="grid grid-cols-5 gap-1 flex-1 min-h-0">
                        {[0, 1, 2, 3, 4].map(colIdx => {
                          const zone = rowZones[colIdx];
                          if (!zone) {
                            return <div key={colIdx} />;
                          }

                          const player = zone.playerId ? state.players[zone.playerId] : undefined;
                          const canDropHere = player !== undefined || filledCount < MAX_PITCH_PLAYERS;

                          return (
                            <ZoneCell
                              key={zone.id}
                              zone={zone}
                              player={player}
                              isUserMode={true}
                              isGK={false}
                              canDrop={canDropHere}
                              onDropOnZone={handleZoneDrop}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                              onClearZone={clearZone}
                              onLabelClick={setLabelEditingZone}
                              onDetail={setSelectedPlayer}
                              draggingId={draggingId}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* SABİT FORMASYON */
          <div
            className="relative bg-gradient-to-b from-green-800 to-green-900 rounded-lg aspect-[3/4] overflow-hidden"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(255,255,255,0.03) 20px, rgba(255,255,255,0.03) 40px)',
            }}
          >
            <div className="absolute inset-3 border-2 border-white/30 rounded pointer-events-none"></div>
            <div className="absolute left-3 right-3 top-1/2 border-t-2 border-white/30 pointer-events-none"></div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-2 border-white/30 rounded-full pointer-events-none"></div>
            <div className="absolute left-1/2 -translate-x-1/2 top-3 w-24 h-10 border-2 border-white/30 border-t-0 pointer-events-none"></div>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-3 w-24 h-10 border-2 border-white/30 border-b-0 pointer-events-none"></div>

            {posOnPitch.map((slot, i) => {
              const player = effectiveLineup[i] ? state.players[effectiveLineup[i]] : undefined;
              const posColor = getPosColor(slot.pos);

              return (
                <div
                  key={i}
                  className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                >
                  {player ? (
                    <PlayerChip
                      player={player}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDetail={() => setSelectedPlayer(player)}
                      isDragging={draggingId === player.id}
                    />
                  ) : (
                    <div className={`w-12 h-12 rounded-full border-2 border-dashed ${posColor.border} ${posColor.bg} flex items-center justify-center`}>
                      <span className={`text-[10px] font-bold ${posColor.text}`}>
                        {slot.pos}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-between items-center mt-3 text-xs">
          <span className={
            isCustomMode && isZoneOverfilled
              ? 'text-red-400 font-bold'
              : 'text-slate-400'
          }>
            {isCustomMode
              ? isZoneOverfilled
                ? `❌ ${filledCount} / ${MAX_PITCH_PLAYERS} oyuncu — ${filledCount - MAX_PITCH_PLAYERS} FAZLA!`
                : `${filledCount} / ${MAX_PITCH_PLAYERS} oyuncu yerleştirildi`
              : 'İlk 11 Ort.'}
          </span>
          <span className={`font-bold text-base ${
            isCustomMode && isZoneOverfilled
              ? 'text-red-400'
              : isCustomMode && filledCount < MAX_PITCH_PLAYERS
              ? 'text-yellow-400'
              : 'text-accent'
          }`}>
            {lineupAvg.toFixed(1)}
          </span>
        </div>
      </div>

      {/* SAĞ: TÜM KADRO */}
      <div className="lg:col-span-4 card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">
            👥 Tüm Kadro ({allSquad.length})
          </h2>
          <span className="text-xs text-slate-400">Ort: {squadAvg.toFixed(1)}</span>
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {POSITION_FILTERS.map(pf => (
            <button
              key={pf.key}
              onClick={() => setPosFilter(pf.key)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                posFilter === pf.key
                  ? 'bg-accent text-white'
                  : 'bg-pitch-700 hover:bg-pitch-600 text-slate-300'
              }`}
            >
              {pf.label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
          {allSquad.map(player => {
            const isInFixedLineup = !isCustomMode && effectiveLineup.includes(player.id);
            const isInZone = isCustomMode && zonePlayerIds.has(player.id);
            const isInLineup = isInFixedLineup || isInZone;
            const posColor = getPosColor(player.position);
            const rating = safeScore(player);

            return (
              <div
                key={player.id}
                draggable
                onDragStart={(e) => handleDragStart(e, player.id)}
                onDragEnd={handleDragEnd}
                onClick={() => setSelectedPlayer(player)}
                className={`cursor-grab active:cursor-grabbing px-2 py-1.5 rounded-md border transition-all hover:scale-[1.02] ${
                  isInLineup
                    ? `${posColor.border} ${posColor.bg} ring-1 ring-accent/40`
                    : 'border-pitch-700 bg-pitch-800/50'
                } ${draggingId === player.id ? 'opacity-40' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${posColor.bg} ${posColor.text}`}>
                    {player.position}
                  </span>
                  <span className="flex-1 text-xs text-white truncate">
                    {player.name}
                  </span>
                  {isInLineup && (
                    <span className="text-[9px] text-accent font-bold">✓</span>
                  )}
                  <span className={`text-xs font-bold ${
                    rating >= 70 ? 'text-green-300' :
                    rating >= 60 ? 'text-yellow-300' :
                    rating >= 50 ? 'text-orange-300' : 'text-red-300'
                  }`}>
                    {rating}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[9px] text-slate-400">
                  <span>{player.age} yaş</span>
                  <span>•</span>
                  <span>{player.nationality}</span>
                  <span>•</span>
                  <span>Kond: {player.condition}</span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-slate-500 mt-3">
          💡 Sahaya sürükle → bölgeye yerleşir. Detay için tıkla.
        </p>
      </div>

      {/* ETİKET DEĞİŞTİRME MENÜSÜ */}
      {labelEditingZone && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          onClick={() => setLabelEditingZone(null)}
        >
          <div
            className="glass-modal w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-pitch-700/50 bg-gradient-to-r from-blue-500/20 via-transparent to-blue-500/20">
              <h2 className="text-lg font-black text-white">🎯 Pozisyon Etiketini Değiştir</h2>
              <p className="text-xs text-slate-400">
                Bu bölgenin pozisyon etiketini seç (oyuncu etkilenmez)
              </p>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {POSITION_GROUPS.map(group => (
                <div key={group} className="mb-4">
                  <h3 className="text-xs text-slate-400 uppercase font-bold mb-2">{group}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_POSITIONS.filter(p => p.group === group).map(p => {
                      const posColor = getPosColor(p.key);
                      return (
                        <button
                          key={p.key}
                          onClick={() => applyLabelChange(labelEditingZone, p.key)}
                          className={`p-3 rounded-lg border-2 ${posColor.border} ${posColor.bg} hover:scale-[1.02] transition-all text-left`}
                        >
                          <div className={`text-sm font-bold ${posColor.text}`}>
                            {p.key}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {p.label.split(' — ')[1]}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-3 border-t border-pitch-700/50 bg-pitch-800/50 flex justify-end">
              <button
                onClick={() => setLabelEditingZone(null)}
                className="bg-pitch-700 hover:bg-pitch-600 text-slate-300 text-sm font-bold px-4 py-2 rounded-lg"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OYUNCU DETAY MODAL */}
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