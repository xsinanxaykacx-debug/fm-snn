import { useGameStore } from '../store/gameStore';
import { scorePlayer } from '../engine/data/generateData';

export function Transfers() {
  const state = useGameStore();
  const buy = useGameStore(s => s.transferBuy);
  const userClub = state.clubs[state.userClubId];

  const available = Object.values(state.players)
    .filter(p => p.clubId && p.clubId !== state.userClubId)
    .sort((a, b) => scorePlayer(b) - scorePlayer(a))
    .slice(0, 30);

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="text-lg font-bold mb-1">💸 Transfer Pazarı</h2>
        <p className="text-sm text-slate-400">
          Bütçen: <span className="text-accent font-bold">£{((userClub?.budget ?? 0) / 1_000_000).toFixed(2)}M</span>
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-pitch-700">
              <th className="py-2">İsim</th>
              <th>Kulüp</th>
              <th>Poz</th>
              <th>Yaş</th>
              <th>Genel</th>
              <th>Değer</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {available.map(p => {
              const club = state.clubs[p.clubId!];
              const canAfford = (userClub?.budget ?? 0) >= p.value;
              return (
                <tr key={p.id} className="border-b border-pitch-700/50 hover:bg-pitch-700/30">
                  <td className="py-2 font-medium">{p.name}</td>
                  <td className="text-slate-400">{club?.shortName}</td>
                  <td><span className="text-xs px-2 py-0.5 rounded bg-pitch-700">{p.position}</span></td>
                  <td>{p.age}</td>
                  <td className="text-accent">{scorePlayer(p).toFixed(1)}</td>
                  <td>£{(p.value / 1_000_000).toFixed(2)}M</td>
                  <td>
                    <button
                      disabled={!canAfford}
                      onClick={() => buy(p.id)}
                      className={`text-xs px-3 py-1 rounded ${
                        canAfford
                          ? 'bg-accent hover:bg-accent-hover text-white'
                          : 'bg-pitch-700 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {canAfford ? 'Satın Al' : 'Bütçe Yetersiz'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}