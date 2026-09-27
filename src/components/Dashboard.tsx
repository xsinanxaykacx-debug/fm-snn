import { useGameStore } from '../store/gameStore';
import { sortedTable } from '../engine/league/table';

interface Props {
  onNavigate: (tab: any) => void;
}

export function Dashboard({ onNavigate }: Props) {
  const state = useGameStore();
  const userClub = state.clubs[state.userClubId];
  const table = sortedTable(state.table);
  const userPos = table.findIndex(r => r.clubId === state.userClubId) + 1;
  const userRow = table.find(r => r.clubId === state.userClubId);

  const nextMatch = state.fixtures.find(
    m => m.week === state.currentWeek && !m.played &&
      (m.homeId === state.userClubId || m.awayId === state.userClubId)
  );
  const opponent = nextMatch
    ? state.clubs[nextMatch.homeId === state.userClubId ? nextMatch.awayId : nextMatch.homeId]
    : null;
  const isHome = nextMatch?.homeId === state.userClubId;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="card">
          <h2 className="text-lg font-bold mb-3">📋 Son Haberler</h2>
          <ul className="space-y-2">
            {state.news.slice(0, 8).map((n, i) => (
              <li key={i} className="text-sm text-slate-300 border-l-2 border-pitch-600 pl-3 py-1">
                {n}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2 className="text-lg font-bold mb-3">⚽ Sıradaki Maç</h2>
          {opponent && nextMatch ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{isHome ? '🏠 Ev Sahibi' : '✈️ Deplasman'}</p>
                <p className="text-xl font-bold mt-1">vs {opponent.name}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Hafta {nextMatch.week} • Stadyum: {userClub?.stadiumCapacity.toLocaleString()} kişi
                </p>
              </div>
              <button onClick={() => onNavigate('match')} className="btn-primary">
                Maça Git →
              </button>
            </div>
          ) : (
            <p className="text-slate-400">Bu hafta maçın yok.</p>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="card">
          <h2 className="text-lg font-bold mb-3">📊 Lig Durumu</h2>
          {userRow && (
            <div className="space-y-2">
              <div className="stat-row"><span>Sıralama</span><span className="font-bold text-accent">{userPos}.</span></div>
              <div className="stat-row"><span>Puan</span><span className="font-bold">{userRow.points}</span></div>
              <div className="stat-row"><span>Oynanan</span><span>{userRow.played}</span></div>
              <div className="stat-row"><span>G / B / M</span><span>{userRow.won} / {userRow.drawn} / {userRow.lost}</span></div>
              <div className="stat-row"><span>Gol (A/Y)</span><span>{userRow.gf} / {userRow.ga}</span></div>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-bold mb-3">💰 Finans</h2>
          <div className="space-y-2">
            <div className="stat-row">
              <span>Transfer Bütçesi</span>
              <span className="font-bold text-accent">
                £{((userClub?.budget ?? 0) / 1_000_000).toFixed(2)}M
              </span>
            </div>
            <div className="stat-row">
              <span>Maaş Bütçesi</span>
              <span>£{((userClub?.wageBudget ?? 0) / 1_000).toFixed(0)}K</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}