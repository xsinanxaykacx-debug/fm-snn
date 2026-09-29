// src/components/ContractModal.tsx

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { Player } from '../engine/types';
import { getContractStatus } from '../engine/progression/contract';

interface Props {
  player: Player;
  onClose: () => void;
}

export function ContractModal({ player, onClose }: Props) {
  const renewContract = useGameStore(s => s.renewContract);

  const [offeredWage, setOfferedWage] = useState(player.wage);
  const [offeredYears, setOfferedYears] = useState(3);
  const [result, setResult] = useState<{ accepted: boolean; reason: string } | null>(null);

  const contract = getContractStatus(player);
  const wageInK = Math.round(offeredWage / 1_000);
  const currentWageInK = Math.round(player.wage / 1_000);

  // Beklenen maaş (piyasa değerine göre)
  const expectedWage = Math.round(player.value / 400);
  const expectedWageK = Math.round(expectedWage / 1_000);

  const handleRenew = () => {
    const evaluation = renewContract(player.id, offeredWage, offeredYears);
    setResult(evaluation);

    if (evaluation.accepted) {
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-backdrop-in"
      onClick={onClose}
    >
      <div
        className="glass-modal w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-modal-in"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-pitch-700/50 bg-gradient-to-r from-accent/20 via-transparent to-accent/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white">✍️ Sözleşme Yenileme</h2>
              <p className="text-xs text-slate-400">{player.name} • {player.age} yaş • {player.position}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-pitch-700 hover:bg-pitch-600 flex items-center justify-center text-slate-300 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* İÇERİK */}
        <div className="p-6 space-y-5">

          {/* Mevcut Durum */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card p-3 rounded-lg text-center">
              <p className="text-[10px] text-slate-400 uppercase">Mevcut Maaş</p>
              <p className="text-sm font-bold text-white">£{currentWageInK}K/hafta</p>
            </div>
            <div className="glass-card p-3 rounded-lg text-center">
              <p className="text-[10px] text-slate-400 uppercase">Sözleşme</p>
              <p className={`text-sm font-bold ${contract.color}`}>{contract.label}</p>
            </div>
            <div className="glass-card p-3 rounded-lg text-center">
              <p className="text-[10px] text-slate-400 uppercase">Beklenen Maaş</p>
              <p className="text-sm font-bold text-yellow-400">£{expectedWageK}K/hafta</p>
            </div>
          </div>

          {/* Maaş Teklifi */}
          <div>
            <label className="text-sm text-slate-300 block mb-2">
              💰 Haftalık Maaş Teklifi
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={Math.max(1_000, Math.round(player.wage * 0.5))}
                max={Math.round(player.wage * 3)}
                step={1_000}
                value={offeredWage}
                onChange={e => setOfferedWage(Number(e.target.value))}
                className="flex-1 accent-accent"
              />
              <div className="w-24 text-right">
                <p className="text-lg font-bold text-accent">£{wageInK}K</p>
                <p className="text-[10px] text-slate-500">/hafta</p>
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>Min</span>
              <span className={
                offeredWage >= expectedWage ? 'text-green-400' :
                offeredWage >= expectedWage * 0.8 ? 'text-yellow-400' :
                'text-red-400'
              }>
                {offeredWage >= expectedWage ? '✅ İyi teklif' :
                 offeredWage >= expectedWage * 0.8 ? '⚠️ Sınırda' :
                 '❌ Düşük teklif'}
              </span>
              <span>Max</span>
            </div>
          </div>

          {/* Yıl Teklifi */}
          <div>
            <label className="text-sm text-slate-300 block mb-2">
              📅 Sözleşme Süresi
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(y => (
                <button
                  key={y}
                  onClick={() => setOfferedYears(y)}
                  className={`py-2 rounded font-bold text-sm transition-colors ${
                    offeredYears === y
                      ? 'bg-accent text-white'
                      : 'bg-pitch-700 hover:bg-pitch-600 text-slate-300'
                  }`}
                >
                  {y} yıl
                </button>
              ))}
            </div>
          </div>

          {/* Değerlendirme Bilgisi */}
          <div className="glass-card p-3 rounded-lg text-xs text-slate-400 space-y-1">
            <p>💡 <strong>Bilgi:</strong></p>
            <p>• Oyuncular piyasa değerinin altında teklifleri reddeder</p>
            <p>• Genç oyuncular daha kolay kabul eder</p>
            <p>• 30+ yaş oyuncular daha zor ikna olur</p>
            <p>• Uzun sözleşme (3-5 yıl) genelde daha cazip</p>
          </div>

          {/* SONUÇ */}
          {result && (
            <div className={`p-4 rounded-xl border ${
              result.accepted
                ? 'bg-green-500/10 border-green-500/40'
                : 'bg-red-500/10 border-red-500/40'
            }`}>
              <p className={`font-bold ${result.accepted ? 'text-green-400' : 'text-red-400'}`}>
                {result.accepted ? '✅ Teklif Kabul Edildi!' : '❌ Teklif Reddedildi'}
              </p>
              <p className="text-xs text-slate-300 mt-1">{result.reason}</p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-pitch-700/50 bg-pitch-800/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-md font-bold text-slate-300 bg-pitch-700 hover:bg-pitch-600"
          >
            İptal
          </button>
          <button
            onClick={handleRenew}
            disabled={result?.accepted === true}
            className={`flex-1 py-2.5 rounded-md font-bold text-white transition-all ${
              result?.accepted === true
                ? 'bg-pitch-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-accent to-green-500 hover:scale-[1.02]'
            }`}
          >
            ✍️ Teklif Ver
          </button>
        </div>
      </div>
    </div>
  );
}