// src/components/Training.tsx

import { useGameStore } from '../store/gameStore';
import { FOCUS_INFO, INTENSITY_INFO } from '../engine/progression/trainingSystem';
import type { TrainingFocus } from '../engine/types';
import { scorePlayer } from '../engine/data/generateData';

const FOCUSES: TrainingFocus[] = ['attack', 'defense', 'physical', 'tactical', 'balanced'];
const INTENSITIES: ('light' | 'normal' | 'intense')[] = ['light', 'normal', 'intense'];

export function Training() {
  const state = useGameStore();
  const setFocus = useGameStore(s => s.setTrainingFocus);
  const setIntensity = useGameStore(s => s.setTrainingIntensity);

  const squad = Object.values(state.players)
    .filter(p => p.clubId === state.userClubId)
    .sort((a, b) => scorePlayer(b) - scorePlayer(a));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <div className="card">
          <h2 className="text-lg font-bold mb-4">🏃 Antrenman Odakı</h2>
          <div className="space-y-2">
            {FOCUSES.map(f => {
              const info = FOCUS_INFO[f];
              const active = state.training.focus === f;
              return (
                <button
                  key={f}
                  onClick={() => setFocus(f)}
                  className={`w-full text-left p-3 rounded-md transition-colors ${
                    active ? 'bg-accent text-white' : 'bg-pitch-700 hover:bg-pitch-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{info.icon}</span>
                    <div>
                      <div className="font-bold">{info.label}</div>
                      <div className={`text-xs ${active ? 'text-white/80' : 'text-slate-400'}`}>
                        {info.desc}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-bold mb-4">💪 Yoğunluk</h2>
          <div className="space-y-2">
            {INTENSITIES.map(i => {
              const info = INTENSITY_INFO[i];
              const active = state.training.intensity === i;
              return (
                <button
                  key={i}
                  onClick={() => setIntensity(i)}
                  className={`w-full text-left p-3 rounded-md transition-colors ${
                    active ? 'bg-accent text-white' : 'bg-pitch-700 hover:bg-pitch-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{info.icon}</span>
                    <div>
                      <div className="font-bold">{info.label}</div>
                      <div className={`text-xs ${active ? 'text-white/80' : 'text-slate-400'}`}>
                        {info.desc}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-2 text-sm text-slate-400">📊 BU HAFTA</h3>
          <div className="stat-row"><span>Odak</span><span className="font-bold">{FOCUS_INFO[state.training.focus].label}</span></div>
          <div className="stat-row"><span>Yoğunluk</span><span className="font-bold">{INTENSITY_INFO[state.training.intensity].label}</span></div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="card">
          <h2 className="text-lg font-bold mb-3">👥 Oyuncu Gelişim Potansiyeli</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-pitch-700">
                <th className="py-2">İsim</th>
                <th>Poz</th>
                <th>Yaş</th>
                <th>Genel</th>
                <th>Değer</th>
                <th>Gelişim</th>
              </tr>
            </thead>
            <tbody>
              {squad.slice(0, 20).map(p => {
                const ageGroup =
                  p.age <= 20 ? { label: '🌟 Yıldız Adayı', cls: 'text-green-400' } :
                  p.age <= 23 ? { label: '📈 Yükselen', cls: 'text-green-400' } :
                  p.age <= 26 ? { label: '✅ Olgun', cls: 'text-yellow-400' } :
                  p.age <= 29 ? { label: '⚠️ Zirvede', cls: 'text-orange-400' } :
                  p.age <= 32 ? { label: '📉 Düşüşte', cls: 'text-red-400' } :
                                { label: '🔻 Geriliyor', cls: 'text-red-500' };
                return (
                  <tr key={p.id} className="border-b border-pitch-700/50">
                    <td className="py-2">{p.name}</td>
                    <td><span className="text-xs px-2 py-0.5 rounded bg-pitch-700">{p.position}</span></td>
                    <td>{p.age}</td>
                    <td className="text-accent font-bold">{p.overall}</td>
                    <td className="text-xs text-slate-400">
                      {(p.value / 1_000_000).toFixed(1)}M €
                    </td>
                    <td className={ageGroup.cls}>{ageGroup.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}