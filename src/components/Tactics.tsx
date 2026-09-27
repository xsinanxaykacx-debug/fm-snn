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
      { pos: 'ML', x: 20, y: 25 }, { pos: 'ST', x: 50, y: 15 }, { pos: 'MR', x: 80, y: 25 },
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
      { pos: 'MC', x: 38, y: 58 }, { pos: 'MC', x: 62, y: 58 },
      { pos: 'ML', x: 20, y: 35 }, { pos: 'MC', x: 50, y: 35 }, { pos: 'MR', x: 80, y: 35 },
      { pos: 'ST', x: 50, y: 15 },
    ],
  };

  const posOnPitch = positionsOnPitch[tactic.formation];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card">
        <h2 className="text-lg font-bold mb-4">🎯 Taktik Ayarları</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 block mb-2">Formasyon</label>
            <div className="grid grid-cols-2 gap-2">
              {FORMATIONS.map(f => (
                <button
                  key={f}
                  onClick={() => setTactic({ formation: f })}
                  className={`py-2 rounded-md text-sm font-medium transition-colors ${
                    tactic.formation === f ? 'bg-accent text-white' : 'bg-pitch-700 hover:bg-pitch-600'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-2">Zihniyet</label>
            <div className="grid grid-cols-3 gap-2">
              {(['defensive', 'balanced', 'attacking'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setTactic({ mentality: m })}
                  className={`py-2 rounded-md text-sm transition-colors ${
                    tactic.mentality === m ? 'bg-accent text-white' : 'bg-pitch-700 hover:bg-pitch-600'
                  }`}
                >
                  {m === 'defensive' ? '🛡️ Defansif' : m === 'balanced' ? '⚖️ Dengeli' : '⚔️ Hücum'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-2">Pres</label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setTactic({ pressing: m })}
                  className={`py-2 rounded-md text-sm transition-colors ${
                    tactic.pressing === m ? 'bg-accent text-white' : 'bg-pitch-700 hover:bg-pitch-600'
                  }`}
                >
                  {m === 'low' ? 'Düşük' : m === 'medium' ? 'Orta' : 'Yüksek'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-400 block mb-2">Tempo</label>
            <div className="grid grid-cols-3 gap-2">
              {(['slow', 'normal', 'fast'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setTactic({ tempo: m })}
                  className={`py-2 rounded-md text-sm transition-colors ${
                    tactic.tempo === m ? 'bg-accent text-white' : 'bg-pitch-700 hover:bg-pitch-600'
                  }`}
                >
                  {m === 'slow' ? 'Yavaş' : m === 'normal' ? 'Normal' : 'Hızlı'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold mb-4">⚽ İlk 11</h2>
        <div className="relative bg-gradient-to-b from-green-800 to-green-900 rounded-lg aspect-[3/4] max-w-md mx-auto overflow-hidden">
          {/* Saha çizgileri */}
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