import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { Formation, Player, Position } from '../engine/types';
import { getStartingXI, scorePlayer } from '../engine/data/generateData';

const FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'];

// ═══════════════════════════════════════════════
// MEVKİ RENKLERİ
// ═══════════════════════════════════════════════

function getPosColor(position: string): { bg: string; text: string; border: string } {
  if (position === 'GK') return { bg: 'bg-yellow-500/30', text: 'text-yellow-300', border: 'border-yellow-500/60' };
  if (['DC', 'DL', 'DR'].includes(position)) return { bg: 'bg-blue-500/30', text: 'text-blue-300', border: 'border-blue-500/60' };
  if (['DM', 'MC', 'ML', 'MR'].includes(position)) return { bg: 'bg-green-500/30', text: 'text-green-300', border: 'border-green-500/60' };
  if (['AMC', 'AML', 'AMR'].includes(position)) return { bg: 'bg-purple-500/30', text: 'text-purple-300', border: 'border-purple-500/60' };
  if (position === 'ST') return { bg: 'bg-red-500/30', text: 'text-red-300', border: 'border-red-500/60' };
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

// ═══════════════════════════════════════════════
// SAHA POZİSYONLARI
// ═══════════════════════════════════════════════

const POSITIONS_ON_PITCH: Record<Formation, { pos: string; x: number; y: number }[]> = {
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
    { pos: 'DL', x: 10, y: 52 }, { pos: 'MC', x: 35, y: 55 }, { pos: 'MC', x: 50, y: 52 }, { pos: 'MC', x: 65, y: 55 }, { pos: 'DR', x: 90, y: 52 },
    { pos: 'ST', x: 38, y: 20 }, { pos: 'ST', x: 62, y: 20 },
  ],
  '4-2-3-1': [
    { pos: 'GK', x: 50, y: 92 },
    { pos: 'DL', x: 15, y: 72 }, { pos: 'DC', x: 38, y: 75 }, { pos: 'DC', x: 62, y: 75 }, { pos: 'DR', x: 85, y: 72 },
    { pos: 'DM', x: 38, y: 58 }, { pos: 'DM', x: 62, y: 58 },
    { pos: 'AML', x: 20, y: 35 }, { pos: 'AMC', x: 50, y: 35 }, { pos: 'AMR', x: 80, y: 35 },
    { pos: 'ST', x: 50, y: 15 },
  ],
};

// ═══════════════════════════════════════════════
// OYUNCU KARTI
// ═══════════════════════════════════════════════

interface PlayerChipProps {
  player: Player;
  compact?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, playerId: string, slotIndex?: number) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  slotIndex?: number;
}

function PlayerChip({
  player,
  compact = false,
  draggable = true,
  onDragStart,
  onDragEnd,
  isDragging = false,
  slotIndex,
}: PlayerChipProps) {
  const posColor = getPosColor(player.position);
  const rating = safeScore(player);

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, player.id, slotIndex)}
      onDragEnd={onDragEnd}
      className={`cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-40 scale-95' : draggable ? 'hover:scale-105' : ''
      }`}
    >
      <div
        className={`${compact ? 'px-2 py-1' : 'px-2 py-1.5'} rounded-md border-2 ${posColor.border} ${posColor.bg} backdrop-blur-sm shadow-lg`}
      >
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${posColor.bg} ${posColor.text}`}>
            {player.position}
          </span>
          {!compact && (
            <span className="text-[10px] font-medium text-white truncate max-w-[70px]">
              {player.name.split(' ').pop()}
            </span>
          )}
          <span className={`text-[10px] font-bold ${
            rating >= 70 ? 'text-green-300' :
            rating >= 60 ? 'text-yellow-300' :
            rating >= 50 ? 'text-orange-300' : 'text-red-300'
          }`}>
            {rating}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// DROP SLOT (Saha)
// ═══════════════════════════════════════════════

interface DropSlotProps {
  slotIndex: number;
  player: Player | undefined;
  posLabel: string;
  x: number;
  y: number;
  onDrop: (fromSlot: number | null, toSlot: number, fromPlayerId: string) => void;
  onDragStart: (e: React.DragEvent, playerId: string, slotIndex?: number) => void;
  onDragEnd: () => void;
  draggingId: string | null;
}

function DropSlot({
  slotIndex,
  player,
  posLabel,
  x,
  y,
  onDrop,
  onDragStart,
  onDragEnd,
  draggingId,
}: DropSlotProps) {
  const [isOver, setIsOver] = useState(false);
  const posColor = getPosColor(posLabel);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);

    const playerId = e.dataTransfer.getData('playerId');
    const fromSlotStr = e.dataTransfer.getData('slotIndex');
    const fromSlot = fromSlotStr ? parseInt(fromSlotStr, 10) : null;

    if (playerId) {
      onDrop(fromSlot, slotIndex, playerId);
    }
  };

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
      style={{ left: `${x}%`, top: `${y}%` }}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
    >
      <div className={`transition-all ${isOver ? 'scale-125 ring-4 ring-accent/50 rounded-full' : ''}`}>
        {player ? (
          <PlayerChip
            player={player}
            compact
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragging={draggingId === player.id}
            slotIndex={slotIndex}
          />
        ) : (
          <div className={`w-12 h-12 rounded-full border-2 border-dashed ${posColor.border} ${posColor.bg} flex items-center justify-center`}>
            <span className={`text-[10px] font-bold ${posColor.text}`}>
              {posLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ANA COMPONENT
// ═══════════════════════════════════════════════

const POSITION_FILTERS: { key: Position | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Tümü' },
  { key: 'GK', label: 'GK' },
  { key: 'DC', label: 'DC' },
  { key: 'DL', label: 'DL' },
  { key: 'DR', label: 'DR' },
  { key: 'DM', label: 'DM' },
  { key: 'MC', label: 'MC' },
  { key: 'ML', label: 'ML' },
  { key: 'MR', label: 'MR' },
  { key: 'AMC', label: 'AMC' },
  { key: 'AML', label: 'AML' },
  { key: 'AMR', label: 'AMR' },
  { key: 'ST', label: 'ST' },
];

const POSITION_ORDER = ['GK', 'DC', 'DL', 'DR', 'DM', 'MC', 'ML', 'MR', 'AMC', 'AML', 'AMR', 'ST'];

export function Tactics() {
  const state = useGameStore();
  const setTactic = useGameStore(s => s.setTactic);
  const setLineup = useGameStore(s => s.setLineup);
  const resetLineup = useGameStore(s => s.resetLineup);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>('ALL');

  const userClub = state.clubs[state.userClubId];

  if (!userClub) return null;

  const tactic = userClub.tactic;
  const posOnPitch = POSITIONS_ON_PITCH[tactic.formation];

  // Geçerli lineup
  const autoLineup = getStartingXI(userClub.id, state.players, tactic.formation).map(p => p.id);
  const effectiveLineup = state.userLineup.length === 11 ? state.userLineup : autoLineup;

  const lineupPlayers = effectiveLineup
    .map(id => state.players[id])
    .filter((p): p is Player => p !== undefined);

  // TÜM kadro (sahadakiler + yedekler)
  const allSquad = Object.values(state.players)
    .filter(p => p.clubId === userClub.id)
    .filter(p => posFilter === 'ALL' || p.position === posFilter)
    .sort((a, b) => {
      const pa = POSITION_ORDER.indexOf(a.position);
      const pb = POSITION_ORDER.indexOf(b.position);
      if (pa !== pb) return pa - pb;
      return safeScore(b) - safeScore(a);
    });

  // Reyting ortalamaları
  const lineupAvg = lineupPlayers.length > 0
    ? lineupPlayers.reduce((s, p) => s + safeScore(p), 0) / lineupPlayers.length
    : 0;

  const allSquadForAvg = Object.values(state.players).filter(p => p.clubId === userClub.id);
  const squadAvg = allSquadForAvg.length > 0
    ? allSquadForAvg.reduce((s, p) => s + safeScore(p), 0) / allSquadForAvg.length
    : 0;

  // Sürükle-bırak
  const handleDragStart = (e: React.DragEvent, playerId: string, slotIndex?: number) => {
    e.dataTransfer.setData('playerId', playerId);
    if (slotIndex !== undefined) {
      e.dataTransfer.setData('slotIndex', String(slotIndex));
    }
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(playerId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  const handleDrop = (fromSlot: number | null, toSlot: number, fromPlayerId: string) => {
    const currentLineup = [...effectiveLineup];

    if (fromSlot === null) {
      // Yedekten/kadrodan geliyor
      // Zaten sahada mı?
      const existingIdx = currentLineup.indexOf(fromPlayerId);
      if (existingIdx !== -1) {
        // Sahadaki oyuncu başka slota bırakıldı
        const temp = currentLineup[toSlot];
        currentLineup[toSlot] = fromPlayerId;
        currentLineup[existingIdx] = temp;
      } else {
        // Yedekten geliyor — mevcut oyuncuyu yedeğe gönder
        currentLineup[toSlot] = fromPlayerId;
      }
    } else {
      // Sahadan sahaya
      if (fromSlot === toSlot) return;
      const temp = currentLineup[toSlot];
      currentLineup[toSlot] = fromPlayerId;
      currentLineup[fromSlot] = temp;
    }

    setLineup(currentLineup);
    setDraggingId(null);
  };

  const handleAutoSelect = () => {
    setLineup([]); // otomatik seçime dön
    setDraggingId(null);
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* ═══ SOL: TAKTİK ═══ */}
      <div className="lg:col-span-3 card">
        <h2 className="text-base font-bold mb-3">🎯 Taktik</h2>
        <div className="space-y-3">
          {renderButtonGroup<Formation>(
            'Formasyon',
            FORMATIONS.map(f => ({ key: f, label: f })),
            tactic.formation,
            (v) => {
              setTactic({ formation: v });
              resetLineup();
            }
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
        </div>
      </div>

      {/* ═══ ORTA: SAHA ═══ */}
      <div className="lg:col-span-5 card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">⚽ İlk 11</h2>
          <button
            onClick={handleAutoSelect}
            className="px-3 py-1 rounded text-[10px] font-bold bg-accent hover:bg-accent-hover text-white"
          >
            ⚡ Otomatik Seç
          </button>
        </div>

        <div
          className="relative bg-gradient-to-b from-green-800 to-green-900 rounded-lg aspect-[3/4] overflow-hidden"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(255,255,255,0.03) 20px, rgba(255,255,255,0.03) 40px)',
          }}
        >
          <div className="absolute inset-3 border-2 border-white/30 rounded"></div>
          <div className="absolute left-3 right-3 top-1/2 border-t-2 border-white/30"></div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-2 border-white/30 rounded-full"></div>
          <div className="absolute left-1/2 -translate-x-1/2 top-3 w-24 h-10 border-2 border-white/30 border-t-0"></div>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-3 w-24 h-10 border-2 border-white/30 border-b-0"></div>

          {posOnPitch.map((slot, i) => (
            <DropSlot
              key={i}
              slotIndex={i}
              player={lineupPlayers[i]}
              posLabel={slot.pos}
              x={slot.x}
              y={slot.y}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              draggingId={draggingId}
            />
          ))}
        </div>

        <div className="flex justify-between items-center mt-3 text-xs">
          <span className="text-slate-400">İlk 11 Ort.</span>
          <span className="font-bold text-accent text-base">{lineupAvg.toFixed(1)}</span>
        </div>
      </div>

      {/* ═══ SAĞ: TÜM KADRO ═══ */}
      <div className="lg:col-span-4 card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">
            👥 Tüm Kadro ({allSquad.length})
          </h2>
          <span className="text-xs text-slate-400">Ort: {squadAvg.toFixed(1)}</span>
        </div>

        {/* Mevki filtresi */}
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

        {/* Oyuncu listesi */}
        <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
          {allSquad.map(player => {
            const isInLineup = effectiveLineup.includes(player.id);
            const posColor = getPosColor(player.position);
            const rating = safeScore(player);

            return (
              <div
                key={player.id}
                draggable
                onDragStart={(e) => handleDragStart(e, player.id)}
                onDragEnd={handleDragEnd}
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
                  <span>•</span>
                  <span>Form: {player.form}</span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-slate-500 mt-3">
          💡 Sahaya sürükle → oyuncu değişir. Sahadan buraya sürükle → yedeğe döner.
        </p>
      </div>
    </div>
  );
}