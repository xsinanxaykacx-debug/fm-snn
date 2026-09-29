// src/App.tsx

import { useState, useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { useInboxStore } from './store/useInboxStore';
import { Dashboard } from './components/Dashboard';
import { Squad } from './components/Squad';
import { Tactics } from './components/Tactics';
import { Table } from './components/Table';
import { MatchDay } from './components/MatchDay';
import { Transfers } from './components/Transfers';
import { Training } from './components/Training';
import { Stats } from './components/Stats';
import { Settings } from './components/Settings';
import { SeasonEndModal } from './components/SeasonEndModal';
import { PressConferenceModal } from './components/PressConferenceModal';
import { InboxView } from './components/InboxView';

type Tab = 'dashboard' | 'squad' | 'tactics' | 'table' | 'match' | 'transfer' | 'training' | 'stats' | 'inbox' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [showSeasonEnd, setShowSeasonEnd] = useState(false);
  const [showPress, setShowPress] = useState(false);

  const newGame = useGameStore(s => s.newGame);
  const season = useGameStore(s => s.season);
  const week = useGameStore(s => s.currentWeek);
  const seasonOver = useGameStore(s => s.seasonOver);
  const userClub = useGameStore(s => s.clubs[s.userClubId]);
  const budget = userClub?.budget ?? 0;
  const pendingPressMatch = useGameStore(s => s.pendingPressMatch);
  const applyPressEffects = useGameStore(s => s.applyPressEffects);
  const clearPendingPress = useGameStore(s => s.clearPendingPress);
  const simulateAssistantPress = useGameStore(s => s.simulateAssistantPress);
  const assistant = useGameStore(s => s.assistant);

  const inboxMessages = useInboxStore(s => s.messages);
  const unreadCount = inboxMessages.filter(m => !m.isRead).length;

  useEffect(() => {
    if (pendingPressMatch && !showPress) {
      if (assistant?.pressConference) {
        // Asistan otomatik gider
        simulateAssistantPress();
      } else {
        // Manuel basın toplantısı
        setShowPress(true);
      }
    }
  }, [pendingPressMatch, showPress, assistant, simulateAssistantPress]);

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'dashboard', label: '📋 Ana Sayfa' },
    { key: 'match', label: '⚽ Maç' },
    { key: 'squad', label: '👥 Kadro' },
    { key: 'tactics', label: '🎯 Taktik' },
    { key: 'training', label: '🏃 Antrenman' },
    { key: 'table', label: '📊 Puan Durumu' },
    { key: 'stats', label: '🏆 İstatistikler' },
    { key: 'inbox', label: '📬 Gelen Kutusu', badge: unreadCount },
    { key: 'transfer', label: '💸 Transfer' },
    { key: 'settings', label: '⚙️ Ayarlar' },
  ];

  return (
    <div className="min-h-screen bg-pitch-900">
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

      <nav className="bg-pitch-800 border-b border-pitch-700 px-6">
        <div className="flex justify-center items-center gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <main className="p-6 max-w-7xl mx-auto">
        {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
        {tab === 'match' && <MatchDay />}
        {tab === 'squad' && <Squad />}
        {tab === 'tactics' && <Tactics />}
        {tab === 'training' && <Training />}
        {tab === 'table' && <Table />}
        {tab === 'stats' && <Stats />}
        {tab === 'inbox' && <InboxView />}
        {tab === 'transfer' && <Transfers />}
        {tab === 'settings' && <Settings />}
      </main>

      {showSeasonEnd && (
        <SeasonEndModal onClose={() => setShowSeasonEnd(false)} />
      )}

      {showPress && pendingPressMatch && (
        <PressConferenceModal
          matchResult={pendingPressMatch}
          onComplete={(effects) => {
            applyPressEffects(effects.moraleDelta, effects.boardDelta);
            setShowPress(false);
          }}
          onClose={() => {
            clearPendingPress();
            setShowPress(false);
          }}
        />
      )}
    </div>
  );
}