// src/components/Table.tsx

import { useGameStore } from '../store/gameStore';
import { sortedTable } from '../engine/league/table';
import { TeamBadge } from './TeamBadge';
import { getTeamColor } from '../utils/teamColors';

function getFormForClub(clubId: string, fixtures: any[]): ('W' | 'D' | 'L')[] {
  const played = fixtures
    .filter(m => m.played && (m.homeId === clubId || m.awayId === clubId))
    .sort((a, b) => (b.week ?? 0) - (a.week ?? 0))
    .slice(0, 5);

  return played.map(m => {
    const isHome = m.homeId === clubId;
    const ourScore = isHome ? m.homeScore : m.awayScore;
    const theirScore = isHome ? m.awayScore : m.homeScore;
    if (ourScore > theirScore) return 'W';
    if (ourScore < theirScore) return 'L';
    return 'D';
  });
}

function FormDot({ result }: { result: 'W' | 'D' | 'L' }) {
  const config = {
    W: { bg: '#22c55e', label: 'G' },
    D: { bg: '#eab308', label: 'B' },
    L: { bg: '#ef4444', label: 'M' },
  }[result];

  return (
    <div
      className="w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center"
      style={{ backgroundColor: config.bg, color: '#fff' }}
      title={
        result === 'W' ? 'Galibiyet' :
        result === 'D' ? 'Beraberlik' : 'Mağlubiyet'
      }
    >
      {config.label}
    </div>
  );
}

export function Table() {
  const state = useGameStore();
  const rows = sortedTable(state.table);
  const totalTeams = rows.length;

  const getRowBg = (index: number, isUser: boolean) => {
    if (isUser) return 'bg-accent/10 border-l-4 border-accent';
    if (index < 4) return 'bg-green-500/5';
    if (index < 6) return 'bg-blue-500/5';
    if (index >= totalTeams - 3) return 'bg-red-500/5';
    return '';
  };

  const getPositionColor = (index: number) => {
    if (index < 4) return 'text-green-400';
    if (index < 6) return 'text-blue-400';
    if (index >= totalTeams - 3) return 'text-red-400';
    return 'text-slate-400';
  };

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      {/* Başlık */}
      <div className="p-5 flex items-center justify-between border-b border-pitch-700/50">
        <div>
          <h2 className="text-lg font-bold text-white">📊 Puan Durumu</h2>
          <p className="text-xs text-slate-400">
            Sezon {state.season} • Hafta {state.currentWeek} • {totalTeams} takım
          </p>
        </div>
        <div className="text-xs text-slate-500 flex gap-3">
          <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"></span>Şampiyonlar Ligi</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"></span>Avrupa Ligi</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"></span>Düşme</span>
        </div>
      </div>

      {/* Tablo */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-pitch-700">
              <th className="py-2 w-8 text-center px-5">#</th>
              <th className="w-10"></th>
              <th>Takım</th>
              <th className="text-center w-10">O</th>
              <th className="text-center w-10">G</th>
              <th className="text-center w-10">B</th>
              <th className="text-center w-10">M</th>
              <th className="text-center w-12">A</th>
              <th className="text-center w-12">Y</th>
              <th className="text-center w-12">AV</th>
              <th className="text-center w-12 font-bold">P</th>
              <th className="text-center w-32 pr-5">Form</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const club = state.clubs[r.clubId];
              const isUser = r.clubId === state.userClubId;
              const goalDiff = r.gf - r.ga;
              const form = getFormForClub(r.clubId, state.fixtures);

              return (
                <tr
                  key={r.clubId}
                  className={`border-b border-pitch-700/30 hover:bg-pitch-700/30 transition-colors ${getRowBg(i, isUser)}`}
                >
                  <td className={`py-2 text-center font-bold px-5 ${getPositionColor(i)}`}>
                    {i + 1}
                  </td>

                  <td className="py-2">
                    <TeamBadge
                      clubId={r.clubId}
                      shortName={club?.shortName ?? '???'}
                      size="xs"
                    />
                  </td>

                  <td className={`font-medium ${isUser ? 'text-accent' : 'text-slate-200'}`}>
                    {club?.name ?? '???'}
                    {isUser && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-bold">
                        SEN
                      </span>
                    )}
                  </td>

                  <td className="text-center text-slate-300">{r.played}</td>
                  <td className="text-center text-green-400 font-medium">{r.won}</td>
                  <td className="text-center text-yellow-400 font-medium">{r.drawn}</td>
                  <td className="text-center text-red-400 font-medium">{r.lost}</td>
                  <td className="text-center text-slate-300">{r.gf}</td>
                  <td className="text-center text-slate-300">{r.ga}</td>

                  <td
                    className={`text-center font-bold ${
                      goalDiff > 0 ? 'text-green-400' :
                      goalDiff < 0 ? 'text-red-400' :
                      'text-slate-400'
                    }`}
                  >
                    {goalDiff > 0 ? '+' : ''}{goalDiff}
                  </td>

                  <td className="text-center font-bold text-base text-white">{r.points}</td>

                  <td className="text-center pr-5">
                    <div className="flex gap-1 justify-center">
                      {form.length === 0 ? (
                        <span className="text-xs text-slate-500">—</span>
                      ) : (
                        form.map((res, idx) => <FormDot key={idx} result={res} />)
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Alt bilgi */}
      <div className="p-5 pt-3 border-t border-pitch-700/50 text-xs text-slate-500 flex justify-between">
        <span>
          🟢 İlk 4: Şampiyonlar Ligi • 🔵 5-6: Avrupa Ligi • 🔴 Son 3: Düşme
        </span>
        <span>
          Form: son 5 maç (G=Galibiyet, B=Beraberlik, M=Mağlubiyet)
        </span>
      </div>
    </div>
  );
}