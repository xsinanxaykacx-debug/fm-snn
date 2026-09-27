import { useGameStore } from '../store/gameStore';
import type { Match } from '../engine/types';

export function MatchDay() {
  const state = useGameStore();
  const playWeek = useGameStore(s => s.playWeek);
  const advanceSeason = useGameStore(s => s.advanceSeason);
  const userClub = state.clubs[state.userClubId];

  const thisWeek = state.fixtures.filter(m => m.week === state.currentWeek);
  const userMatch = thisWeek.find(
    m => m.homeId === state.userClubId || m.awayId === state.userClubId
  );

  const renderMatch = (m: Match) => {
    const home = state.clubs[m.homeId];
    const away = state.clubs[m.awayId];
    const isUser = m.homeId === state.userClubId || m.awayId === state.userClubId;
    return (
      <div key={m.id} className={`p-3 rounded-md border ${isUser ? 'border-accent bg-pitch-700/50' : 'border-pitch-700 bg-pitch-800'}`}>
        <div className="flex justify-between items-center text-sm">
          <span className="flex-1 text-right">{home?.shortName}</span>
          <span className="px-4 font-bold">
            {m.played ? `${m.homeScore} - ${m.awayScore}` : 'vs'}
          </span>
          <span className="flex-1">{away?.shortName}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Hafta {state.currentWeek} / {state.season}</h2>
            <p className="text-sm text-slate-400">{userClub?.name}</p>
          </div>
          {!state.seasonOver ? (
            <button onClick={playWeek} className="btn-primary">
              ▶ Haftayı Oyna
            </button>
          ) : (
            <button onClick={advanceSeason} className="btn-primary">
              🏁 Yeni Sezona Geç
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {thisWeek.map(renderMatch)}
        </div>
      </div>

      {userMatch && userMatch.played && (
        <div className="card">
          <h2 className="text-lg font-bold mb-3">📺 Maç Detayı</h2>
          <div className="grid grid-cols-3 gap-4 mb-4 text-center">
            <div>
              <p className="text-2xl font-bold">{userMatch.stats.possession.home}%</p>
              <p className="text-xs text-slate-400">Topla Oynama</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-accent">
                {userMatch.homeScore} - {userMatch.awayScore}
              </p>
              <p className="text-xs text-slate-400">Skor</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{userMatch.stats.possession.away}%</p>
              <p className="text-xs text-slate-400">Topla Oynama</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4 text-center text-sm">
            <div>
              <p>{userMatch.stats.shots.home} / {userMatch.stats.onTarget.home}</p>
              <p className="text-xs text-slate-400">Şut / İsabetli</p>
            </div>
            <div className="text-slate-500">—</div>
            <div>
              <p>{userMatch.stats.shots.away} / {userMatch.stats.onTarget.away}</p>
              <p className="text-xs text-slate-400">Şut / İsabetli</p>
            </div>
          </div>

          <h3 className="font-bold mb-2 text-sm text-slate-400">DAKİKA DAKİKA</h3>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {userMatch.events.map((e, i) => (
              <div key={i} className="flex gap-3 text-sm py-1 border-b border-pitch-700/50">
                <span className="w-10 text-slate-500">{e.minute}'</span>
                <span>{e.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}