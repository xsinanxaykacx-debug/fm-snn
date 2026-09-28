import { useGameStore } from '../store/gameStore';
import type { Formation } from '../engine/types';
import { getStartingXI } from '../engine/data/generateData';

const FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'];

export function Tactics() {
  const state = useGameStore();
  const setTactic = useGameStore(s => s.setTactic);
  const userClub = state.clubs[state.userClubId];
  if (!userClub) return null;
  const tactic = userClub.tactic;
  const xi = getStartingXI(userClub.id, state.players, tactic.formation);

  const positionsOnPitch: Record<Formation, { pos: string; x: number; y: number }[]> = {
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

  const posOnPitch = positionsOnPitch[tactic.formation];

  const renderButtonGroup = <T extends string>(
    label: string,
    options: { key: T; label: string }[],
    value: T,
    onChange: (v: T) => void
  ) => (
    <div>
      <label className="text-sm text-slate-400 block mb-2">{label}</label>
      <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(o => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`py-2 rounded-md text-xs font-medium transition-colors ${
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card">
        <h2 className="text-lg font-bold mb-4">🎯 Taktik Ayarları</h2>

        <div className="space-y-4">
          {renderButtonGroup<Formation>(
            'Formasyon',
            FORMATIONS.map(f => ({ key: f, label: f })),
            tactic.formation,
            (v) => setTactic({ formation: v })
          )}

          {renderButtonGroup(
            'Zihniyet',
            [
              { key: 'defensive' as const, label: '🛡️ Defansif' },
              { key: 'balanced' as const, label: '⚖️ Dengeli' },
              { key: 'attacking' as const, label: '⚔️ Hücum' },
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
            'Pas Tarzı',
            [
              { key: 'short' as const, label: 'Kısa' },
              { key: 'mixed' as const, label: 'Karışık' },
              { key: 'direct' as const, label: 'Direkt' },
            ],
            tactic.directness,
            (v) => setTactic({ directness: v })
          )}

          {renderButtonGroup(
            'Savunma Hattı',
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

      <div className="card">
        <h2 className="text-lg font-bold mb-4">⚽ İlk 11</h2>
        <div className="relative bg-gradient-to-b from-green-800 to-green-900 rounded-lg aspect-[3/4] max-w-md mx-auto overflow-hidden">
          <div className="absolute inset-3 border-2 border-white/30 rounded"></div>
          <div className="absolute left-3 right-3 top-1/2 border-t-2 border-white/30"></div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-2 border-white/30 rounded-full"></div>
          <div className="absolute left-1/2 -translate-x-1/2 top-3 w-24 h-10 border-2 border-white/30 border-t-0"></div>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-3 w-24 h-10 border-2 border-white/30 border-b-0"></div>

          {posOnPitch.map((slot, i) => {
            const player = xi[i];
            return (
              <div
                key={i}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              >
                <div className="w-9 h-9 mx-auto rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white shadow-lg">
                  {slot.pos}
                </div>
                <p className="text-[9px] mt-0.5 text-white bg-black/50 px-1 rounded whitespace-nowrap max-w-[80px] truncate">
                  {player?.name.split(' ').pop() ?? '—'}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}