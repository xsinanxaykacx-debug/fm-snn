import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { scorePlayer } from '../engine/data/generateData';
import type { Position } from '../engine/types';

const POSITIONS: (Position | 'ALL')[] = ['ALL', 'GK', 'DC', 'DL', 'DR', 'DM', 'MC', 'ML', 'MR', 'AMC', 'AML', 'AMR', 'ST'];

export function Transfers() {
  const state = useGameStore();
  const buy = useGameStore(s => s.transferBuy);
  const userClub = state.clubs[state.userClubId];
  const [filterPos, setFilterPos] = useState<Position | 'ALL'>('ALL');
  const [searchText, setSearchText] = useState('');

  let available = Object.values(state.players)
    .filter(p => p.clubId && p.clubId !== state.userClubId);

  if (filterPos !== 'ALL') {
    available = available.filter(p => p.position === filterPos);
  }

  if (searchText.trim()) {
    const q = searchText.toLowerCase();
    available = available.filter(p => p.name.toLowerCase().includes(q));
  }

  available = available
    .sort((a, b) => scorePlayer(b) - scorePlayer(a))
    .slice(0, 50);

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="text-lg font-bold mb-1">💸 Transfer Pazarı</h2>
        <p className="text-sm text-slate-400">
          Bütçen: <span className="text-accent font-bold">£{((userClub?.budget ?? 0) / 1_000_000).toFixed(2)}M</span>
        </p>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-2 mb-3">
          {POSITIONS.map(pos => (
            <button
              key={pos}
              onClick={() => setFilterPos(pos)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                filterPos === pos
                  ? 'bg-accent text-white'
                  : 'bg-pitch-700 hover:bg-pitch-600 text-slate-300'
              }`}
            >
              {pos === 'ALL' ? 'Tümü' : pos}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="🔍 Oyuncu ara..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="w-full bg-pitch-700 border border-pitch-600 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent"
        />
      </div>

      <div className="card overflow-x-auto">
        <p className="text-xs text-slate-500 mb-2">
          {available.length} oyuncu gösteriliyor
        </p>
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
                  <td className="text-accent">{scorePlayer(p).toFixed(0)}</td>
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