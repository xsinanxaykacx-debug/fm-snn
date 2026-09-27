import { useGameStore } from '../store/gameStore';
import { scorePlayer } from '../engine/data/generateData';
import type { Player } from '../engine/types';

export function Squad() {
  const state = useGameStore();
  const sellPlayer = useGameStore(s => s.transferSell);
  const squad = Object.values(state.players)
    .filter(p => p.clubId === state.userClubId)
    .sort((a, b) => {
      const posOrder = ['GK', 'DC', 'DL', 'DR', 'MC', 'ML', 'MR', 'ST'];
      const pa = posOrder.indexOf(a.position);
      const pb = posOrder.indexOf(b.position);
      if (pa !== pb) return pa - pb;
      return scorePlayer(b) - scorePlayer(a);
    });

  const attrColor = (v: number) =>
    v >= 16 ? 'text-green-400' :
    v >= 13 ? 'text-yellow-400' :
    v >= 10 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="card overflow-x-auto">
      <h2 className="text-lg font-bold mb-3">👥 Kadro ({squad.length} oyuncu)</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b border-pitch-700">
            <th className="py-2">İsim</th>
            <th>Poz</th>
            <th>Yaş</th>
            <th>Durum</th>
            <th>Hız</th>
            <th>Pas</th>
            <th>Şut</th>
            <th>Def</th>
            <th>Fiz</th>
            <th>Men</th>
            <th>Kale</th>
            <th>Form</th>
            <th>Kond</th>
            <th>Değer</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {squad.map((p: Player) => (
            <tr key={p.id} className={`border-b border-pitch-700/50 ${
              p.injuryWeeks > 0 ? 'bg-red-900/20' :
              p.suspensionWeeks > 0 ? 'bg-yellow-900/20' : ''
            }`}>
              <td className="py-2 font-medium">
                {p.name}
                {p.injuryWeeks > 0 && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-red-900/60 text-red-300">
                    🚑 {p.injuryType} ({p.injuryWeeks}h)
                  </span>
                )}
                {p.suspensionWeeks > 0 && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-yellow-900/60 text-yellow-300">
                    🟨 Ceza ({p.suspensionWeeks}h)
                  </span>
                )}
              </td>
              <td><span className="text-xs px-2 py-0.5 rounded bg-pitch-700">{p.position}</span></td>
              <td>{p.age}</td>
              <td>
                {p.injuryWeeks > 0 ? (
                  <span className="text-red-400 text-xs">🚑 Sakat</span>
                ) : p.suspensionWeeks > 0 ? (
                  <span className="text-yellow-400 text-xs">🟨 Cezalı</span>
                ) : (
                  <span className="text-green-400 text-xs">✅ Sağlam</span>
                )}
              </td>
              <td className={attrColor(p.attributes.pace)}>{p.attributes.pace}</td>
              <td className={attrColor(p.attributes.passing)}>{p.attributes.passing}</td>
              <td className={attrColor(p.attributes.shooting)}>{p.attributes.shooting}</td>
              <td className={attrColor(p.attributes.defending)}>{p.attributes.defending}</td>
              <td className={attrColor(p.attributes.physical)}>{p.attributes.physical}</td>
              <td className={attrColor(p.attributes.mental)}>{p.attributes.mental}</td>
              <td className={attrColor(p.attributes.goalkeeping)}>{p.attributes.goalkeeping}</td>
              <td>{p.form}</td>
              <td>{p.condition}</td>
              <td>£{(p.value / 1_000_000).toFixed(2)}M</td>
              <td>
                <button
                  onClick={() => sellPlayer(p.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Sat
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}