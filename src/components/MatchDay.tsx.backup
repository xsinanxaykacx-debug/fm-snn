import { useGameStore } from '../store/gameStore';
import type { Match } from '../engine/types';
import { calculateTeamUnits, compareUnits } from '../engine/units/teamUnits';

export function MatchDay() {
  const state = useGameStore();
  const playWeek = useGameStore(s => s.playWeek);
  const advanceSeason = useGameStore(s => s.advanceSeason);
  const userClub = state.clubs[state.userClubId];

  // Bu haftanın maçları
  const thisWeek = state.fixtures.filter(m => m.week === state.currentWeek);

  // Bu hafta kullanıcının maçı (oynanmamış)
  const thisWeekMatch = state.fixtures.find(
    m => m.week === state.currentWeek &&
      (m.homeId === state.userClubId || m.awayId === state.userClubId)
  );

  // Kullanıcının SON OYNADIĞI maç
  const lastPlayedMatch = [...state.fixtures]
    .filter(m => m.played && (m.homeId === state.userClubId || m.awayId === state.userClubId))
    .sort((a, b) => b.week - a.week)[0];

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

  // 🔮 MAÇ ÖNİZLEME (bu haftanın maçı oynanmamışsa)
  const renderPreview = () => {
    if (!thisWeekMatch || thisWeekMatch.played) return null;

    const home = state.clubs[thisWeekMatch.homeId];
    const away = state.clubs[thisWeekMatch.awayId];
    const homeUnits = calculateTeamUnits(home, state.players);
    const awayUnits = calculateTeamUnits(away, state.players);
    const comparison = compareUnits(homeUnits, awayUnits);

    return (
      <div className="card">
        <h2 className="text-lg font-bold mb-3">🔮 Maç Önizleme — Hafta {thisWeekMatch.week}</h2>
        <div className="text-center mb-4">
          <div className="text-2xl font-bold">
            {home.name} <span className="text-slate-500 mx-3">vs</span> {away.name}
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {comparison.map(c => {
            const homeWidth = Math.min(100, c.homeValue);
            const awayWidth = Math.min(100, c.awayValue);
            return (
              <div key={c.unit}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={c.favored === 'home' ? 'text-accent font-bold' : 'text-slate-300'}>
                    {c.homeValue.toFixed(1)}
                  </span>
                  <span className="text-slate-400">{c.icon} {c.unit}</span>
                  <span className={c.favored === 'away' ? 'text-red-400 font-bold' : 'text-slate-300'}>
                    {c.awayValue.toFixed(1)}
                  </span>
                </div>
                <div className="flex gap-1 h-2">
                  <div className="flex-1 bg-pitch-700 rounded-l overflow-hidden relative">
                    <div
                      className={`h-full absolute right-0 ${c.favored === 'home' ? 'bg-accent' : 'bg-pitch-500'}`}
                      style={{ width: `${homeWidth}%` }}
                    />
                  </div>
                  <div className="flex-1 bg-pitch-700 rounded-r overflow-hidden">
                    <div
                      className={`h-full ${c.favored === 'away' ? 'bg-red-500' : 'bg-pitch-500'}`}
                      style={{ width: `${awayWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-pitch-700/50 p-2 rounded text-center">
            <div className="text-slate-400">Genel Güç</div>
            <div className={`text-xl font-bold ${homeUnits.overall > awayUnits.overall ? 'text-accent' : 'text-slate-300'}`}>
              {homeUnits.overall.toFixed(1)}
            </div>
            <div className="text-xs text-slate-500">{home.shortName}</div>
          </div>
          <div className="bg-pitch-700/50 p-2 rounded text-center">
            <div className="text-slate-400">Genel Güç</div>
            <div className={`text-xl font-bold ${awayUnits.overall > homeUnits.overall ? 'text-red-400' : 'text-slate-300'}`}>
              {awayUnits.overall.toFixed(1)}
            </div>
            <div className="text-xs text-slate-500">{away.shortName}</div>
          </div>
        </div>
      </div>
    );
  };

  // 📺 MAÇ DETAYI (son oynanan maç)
  const renderMatchDetail = () => {
    const match = lastPlayedMatch;
    if (!match) return null;

    const home = state.clubs[match.homeId];
    const away = state.clubs[match.awayId];
    const isUserHome = match.homeId === state.userClubId;
    const ourScore = isUserHome ? match.homeScore : match.awayScore;
    const theirScore = isUserHome ? match.awayScore : match.homeScore;
    const result = ourScore > theirScore ? 'win' : ourScore < theirScore ? 'loss' : 'draw';
    const resultColor = result === 'win' ? 'text-accent' : result === 'loss' ? 'text-red-400' : 'text-yellow-400';
    const resultLabel = result === 'win' ? '🏆 Kazandık' : result === 'loss' ? '😞 Kaybettik' : '🤝 Berabere';

    return (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">📺 Son Maç — Hafta {match.week}</h2>
          <span className={`text-sm font-bold ${resultColor}`}>{resultLabel}</span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4 text-center">
          <div>
            <p className="text-sm text-slate-400">{home?.shortName}</p>
            <p className="text-2xl font-bold">{match.stats.possession.home}%</p>
            <p className="text-xs text-slate-500">Topla Oynama</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-accent">
              {match.homeScore} - {match.awayScore}
            </p>
            <p className="text-xs text-slate-400 mt-1">SKOR</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">{away?.shortName}</p>
            <p className="text-2xl font-bold">{match.stats.possession.away}%</p>
            <p className="text-xs text-slate-500">Topla Oynama</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4 text-center text-sm">
          <div>
            <p className="font-bold">{match.stats.shots.home}</p>
            <p className="text-xs text-slate-400">Şut</p>
          </div>
          <div className="text-slate-500">vs</div>
          <div>
            <p className="font-bold">{match.stats.shots.away}</p>
            <p className="text-xs text-slate-400">Şut</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 text-center text-sm">
          <div>
            <p className="font-bold">{match.stats.onTarget.home}</p>
            <p className="text-xs text-slate-400">İsabetli</p>
          </div>
          <div className="text-slate-500">vs</div>
          <div>
            <p className="font-bold">{match.stats.onTarget.away}</p>
            <p className="text-xs text-slate-400">İsabetli</p>
          </div>
        </div>

        <h3 className="font-bold mb-2 text-sm text-slate-400">DAKİKA DAKİKA</h3>
        {match.events.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">Bu maçta hiç olay olmadı.</p>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {match.events.map((e, i) => (
              <div key={i} className="flex gap-3 text-sm py-1 border-b border-pitch-700/50">
                <span className="w-10 text-slate-500">{e.minute}'</span>
                <span>{e.description}</span>
              </div>
            ))}
          </div>
        )}
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

      {renderPreview()}
      {renderMatchDetail()}
    </div>
  );
}