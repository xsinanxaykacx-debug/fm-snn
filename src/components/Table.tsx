import { useGameStore } from '../store/gameStore';
import { sortedTable } from '../engine/league/table';

export function Table() {
  const state = useGameStore();
  const rows = sortedTable(state.table);

  return (
    <div className="card overflow-x-auto">
      <h2 className="text-lg font-bold mb-3">📊 Puan Durumu — Sezon {state.season}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b border-pitch-700">
            <th className="py-2 w-8">#</th>
            <th>Takım</th>
            <th className="text-center">O</th>
            <th className="text-center">G</th>
            <th className="text-center">B</th>
            <th className="text-center">M</th>
            <th className="text-center">A</th>
            <th className="text-center">Y</th>
            <th className="text-center">AV</th>
            <th className="text-center font-bold">P</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const club = state.clubs[r.clubId];
            const isUser = r.clubId === state.userClubId;
            return (
              <tr
                key={r.clubId}
                className={`border-b border-pitch-700/50 ${
                  isUser ? 'bg-accent/10' : i < 4 ? 'bg-green-900/20' : i >= rows.length - 3 ? 'bg-red-900/20' : ''
                }`}
              >
                <td className="py-2 text-slate-400">{i + 1}</td>
                <td className={`font-medium ${isUser ? 'text-accent' : ''}`}>{club?.name}</td>
                <td className="text-center">{r.played}</td>
                <td className="text-center">{r.won}</td>
                <td className="text-center">{r.drawn}</td>
                <td className="text-center">{r.lost}</td>
                <td className="text-center">{r.gf}</td>
                <td className="text-center">{r.ga}</td>
                <td className="text-center">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td>
                <td className="text-center font-bold">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-slate-500 mt-3">
        🟢 Şampiyonlar Ligi • 🔴 Düşme hattı
      </p>
    </div>
  );
}