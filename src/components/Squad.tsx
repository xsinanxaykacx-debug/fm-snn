import { useGameStore } from '../store/gameStore';
import { scorePlayer } from '../engine/data/generateData';
import type { Player } from '../engine/types';

export function Squad() {
  const state = useGameStore();
  const sellPlayer = useGameStore(s => s.transferSell);

  const squad = Object.values(state.players)
    .filter(p => p.clubId === state.userClubId)
    .sort((a, b) => {
      const posOrder = ['GK', 'DC', 'DL', 'DR', 'DM', 'MC', 'ML', 'MR', 'AMC', 'AML', 'AMR', 'ST'];
      const pa = posOrder.indexOf(a.position);
      const pb = posOrder.indexOf(b.position);
      if (pa !== pb) return pa - pb;
      return scorePlayer(b) - scorePlayer(a);
    });

  const attrColor = (v: number) =>
    v >= 80 ? 'text-green-400' :
    v >= 65 ? 'text-yellow-400' :
    v >= 50 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="card overflow-x-auto">
      <h2 className="text-lg font-bold mb-3">👥 Kadro ({squad.length} oyuncu)</h2>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400 border-b border-pitch-700">
            <th className="py-2">İsim</th>
            <th>Poz</th>
            <th>Yaş</th>
            <th>Durum</th>
            <th title="Genel">Gen</th>
            <th title="Pas">Pas</th>
            <th title="İlk Kontrol">İK</th>
            <th title="Dripling">Dri</th>
            <th title="Şut">Şut</th>
            <th title="Bitiricilik">Bit</th>
            <th title="Hız">Hız</th>
            <th title="Hızlanma">İvm</th>
            <th title="Dayanıklılık">Day</th>
            <th title="Güç">Güç</th>
            <th title="Markaj">Mar</th>
            <th title="Müdahale">Müd</th>
            <th title="Karar">Kar</th>
            <th title="Vizyon">Viz</th>
            <th title="Pozisyon">Poz</th>
            <th title="Form">Form</th>
            <th title="Kondisyon">Kond</th>
            <th>Değer</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {squad.map((p: Player) => {
            const a = p.attributes;
            const overall = scorePlayer(p);
            return (
              <tr
                key={p.id}
                className={`border-b border-pitch-700/50 ${
                  p.injuryWeeks > 0 ? 'bg-red-900/20' :
                  p.suspensionWeeks > 0 ? 'bg-yellow-900/20' : ''
                }`}
              >
                <td className="py-1.5 font-medium whitespace-nowrap">
                  {p.name}
                  {p.injuryWeeks > 0 && (
                    <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-red-900/60 text-red-300">
                      🚑 {p.injuryWeeks}h
                    </span>
                  )}
                  {p.suspensionWeeks > 0 && (
                    <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-yellow-900/60 text-yellow-300">
                      🟨 {p.suspensionWeeks}h
                    </span>
                  )}
                </td>
                <td>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-pitch-700">{p.position}</span>
                </td>
                <td>{p.age}</td>
                <td>
                  {p.injuryWeeks > 0 ? (
                    <span className="text-red-400">🚑</span>
                  ) : p.suspensionWeeks > 0 ? (
                    <span className="text-yellow-400">🟨</span>
                  ) : (
                    <span className="text-green-400">✅</span>
                  )}
                </td>
                <td className={`font-bold ${attrColor(overall)}`}>{overall.toFixed(0)}</td>
                <td className={attrColor(a.passing)}>{a.passing}</td>
                <td className={attrColor(a.firstTouch)}>{a.firstTouch}</td>
                <td className={attrColor(a.dribbling)}>{a.dribbling}</td>
                <td className={attrColor(a.shooting)}>{a.shooting}</td>
                <td className={attrColor(a.finishing)}>{a.finishing}</td>
                <td className={attrColor(a.pace)}>{a.pace}</td>
                <td className={attrColor(a.acceleration)}>{a.acceleration}</td>
                <td className={attrColor(a.stamina)}>{a.stamina}</td>
                <td className={attrColor(a.strength)}>{a.strength}</td>
                <td className={attrColor(a.marking)}>{a.marking}</td>
                <td className={attrColor(a.tackling)}>{a.tackling}</td>
                <td className={attrColor(a.decisions)}>{a.decisions}</td>
                <td className={attrColor(a.vision)}>{a.vision}</td>
                <td className={attrColor(a.positioning)}>{a.positioning}</td>
                <td>{p.form}</td>
                <td>{p.condition}</td>
                <td className="whitespace-nowrap">£{(p.value / 1_000_000).toFixed(2)}M</td>
                <td>
                  <button
                    onClick={() => sellPlayer(p.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Sat
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}