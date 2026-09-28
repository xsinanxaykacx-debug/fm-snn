// src/App.tsx

import { useState } from 'react';
import { useGameStore } from './store/gameStore';
import { Dashboard } from './components/Dashboard';
import { Squad } from './components/Squad';
import { Tactics } from './components/Tactics';
import { Table } from './components/Table';
import { MatchDay } from './components/MatchDay';
import { Transfers } from './components/Transfers';
import { Training } from './components/Training';
import { Stats } from './components/Stats';
import { SeasonEndModal } from './components/SeasonEndModal';

type Tab = 'dashboard' | 'squad' | 'tactics' | 'table' | 'match' | 'transfer' | 'training' | 'stats';

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [showSeasonEnd, setShowSeasonEnd] = useState(false);
  const newGame = useGameStore(s => s.newGame);
  const season = useGameStore(s => s.season);
  const week = useGameStore(s => s.currentWeek);
  const seasonOver = useGameStore(s => s.seasonOver);
  const userClub = useGameStore(s => s.clubs[s.userClubId]);
  const budget = userClub?.budget ?? 0;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: '📋 Ana Sayfa' },
    { key: 'match', label: '⚽ Maç' },
    { key: 'squad', label: '👥 Kadro' },
    { key: 'tactics', label: '🎯 Taktik' },
    { key: 'training', label: '🏃 Antrenman' },
    { key: 'table', label: '📊 Puan Durumu' },
    { key: 'stats', label: '🏆 İstatistikler' },
    { key: 'transfer', label: '💸 Transfer' },
  ];

  return (
    <div className="min-h-screen bg-pitch-900">
      {/* HEADER */}
      <header className="bg-pitch-800 border-b border-pitch-700 px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-accent">⚽ FM Clone</h1>
            <p className="text-xs text-slate-400 truncate">
              {userClub?.name} • Sezon {season} • Hafta {week} • Bütçe: £{(budget / 1_000_000).toFixed(1)}M
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {seasonOver && (
              <button
                onClick={() => setShowSeasonEnd(true)}
                className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-900 font-bold px-4 py-2 rounded text-sm animate-pulse"
              >
                🏆 Sezon Sonu
              </button>
            )}
            <button
              onClick={() => { if (confirm('Yeni oyun başlatılsın mı? Mevcut kayıt silinir.')) newGame(); }}
              className="btn-secondary text-sm"
            >
              🔄 Yeni Oyun
            </button>
          </div>
        </div>
      </header>

      {/* NAVİGASYON — ORTALI */}
      <nav className="bg-pitch-800 border-b border-pitch-700 px-6">
        <div className="flex justify-center items-center gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* İÇERİK */}
      <main className="p-6 max-w-7xl mx-auto">
        {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
        {tab === 'match' && <MatchDay />}
        {tab === 'squad' && <Squad />}
        {tab === 'tactics' && <Tactics />}
        {tab === 'training' && <Training />}
        {tab === 'table' && <Table />}
        {tab === 'stats' && <Stats />}
        {tab === 'transfer' && <Transfers />}
      </main>

      {/* SEZON SONU MODAL */}
      {showSeasonEnd && (
        <SeasonEndModal onClose={() => setShowSeasonEnd(false)} />
      )}
    </div>
  );
}