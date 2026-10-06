// src/App.tsx

import { useState, useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { useInboxStore } from './store/useInboxStore';
import { Dashboard } from './components/Dashboard';
import { Squad } from './components/Squad';
import { Tactics } from './components/Tactics';
import { Table } from './components/Table';
import { Fixtures } from './components/Fixtures';
import { Cup } from './components/Cup';
import { Transfers } from './components/Transfers';
import { Training } from './components/Training';
import { Academy } from './components/Academy';
import { Stats } from './components/Stats';
import { Settings } from './components/Settings';
import { SeasonEndModal } from './components/SeasonEndModal';
import { PressConferenceModal } from './components/PressConferenceModal';
import { InboxView } from './components/InboxView';
import { LiveMatchScreen } from './components/LiveMatchScreen';
import { TeamBadge } from './components/TeamBadge';

type Tab =
  | 'dashboard'
  | 'squad'
  | 'tactics'
  | 'table'
  | 'fixtures'
  | 'liveMatch'
  | 'cup'
  | 'transfer'
  | 'training'
  | 'academy'
  | 'stats'
  | 'inbox'
  | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [showSeasonEnd, setShowSeasonEnd] = useState(false);
  const [showPress, setShowPress] = useState(false);

  const newGame = useGameStore(s => s.newGame);
  const season = useGameStore(s => s.season);
  const week = useGameStore(s => s.currentWeek);
  const seasonOver = useGameStore(s => s.seasonOver);
  const userClub = useGameStore(s => s.clubs[s.userClubId]);
  const pendingPressMatch = useGameStore(s => s.pendingPressMatch);
  const applyPressEffects = useGameStore(s => s.applyPressEffects);
  const clearPendingPress = useGameStore(s => s.clearPendingPress);
  const simulateAssistantPress = useGameStore(s => s.simulateAssistantPress);
  const assistant = useGameStore(s => s.assistant);

  const inboxMessages = useInboxStore(s => s.messages);
  const unreadCount = inboxMessages.filter(m => !m.isRead).length;
  const playWeek = useGameStore(s => s.playWeek);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const sidebarItems: { key: Tab; icon: string; label: string }[] = [
    { key: 'dashboard', icon: '🏠', label: 'Ana Sayfa' },
    { key: 'squad', icon: '👥', label: 'Kadro' },
    { key: 'tactics', icon: '🎯', label: 'Taktik' },
    { key: 'fixtures', icon: '📅', label: 'Fikstür' },
    { key: 'table', icon: '📊', label: 'Puan Durumu' },
    { key: 'cup', icon: '🏆', label: 'Kupa' },
    { key: 'stats', icon: '📈', label: 'İstatistikler' },
    { key: 'inbox', icon: '📬', label: 'Gelen Kutusu' },
    { key: 'transfer', icon: '💸', label: 'Transfer' },
    { key: 'training', icon: '🏃', label: 'Antrenman' },
    { key: 'academy', icon: '🎓', label: 'Akademi' },
    { key: 'liveMatch', icon: '⚽', label: 'Canlı Maç' },
    { key: 'settings', icon: '⚙️', label: 'Ayarlar' },
  ];

  useEffect(() => {
    if (pendingPressMatch && !showPress) {
      if (assistant?.pressConference) {
        simulateAssistantPress();
      } else {
        setShowPress(true);
      }
    }
  }, [pendingPressMatch, showPress, assistant, simulateAssistantPress]);

  useEffect(() => {
    const handleOpenSeasonEnd = () => setShowSeasonEnd(true);
    window.addEventListener('openSeasonEnd', handleOpenSeasonEnd);
    return () => window.removeEventListener('openSeasonEnd', handleOpenSeasonEnd);
  }, []);

  useEffect(() => {
    if (seasonOver) {
      window.dispatchEvent(new Event('openSeasonEnd'));
    }
  }, [seasonOver]);

  return (
    <div className="min-h-screen bg-pitch-900 text-slate-200">
      <aside className={`fixed inset-y-0 left-0 z-30 bg-fm-sidebar border-r border-fm-border transition-[width] duration-200 ${sidebarCollapsed ? 'w-16' : 'w-[220px]'}`}>
        <div className="flex h-full flex-col">
          <div className="flex h-24 items-center border-b border-fm-border px-4">
            <TeamBadge clubId={userClub?.id ?? ''} shortName={userClub?.shortName ?? userClub?.name ?? 'FM'} size="md" />
            {!sidebarCollapsed && <div className="ml-3 min-w-0"><div className="truncate text-sm font-bold text-slate-100">{userClub?.name ?? 'Takım'}</div><div className="text-xs text-fm-muted">FM Clone</div></div>}
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-2">
            {sidebarItems.map(item => {
              const active = tab === item.key;
              const badge = item.key === 'inbox' ? unreadCount : 0;
              return <button key={item.key} type="button" title={sidebarCollapsed ? item.label : undefined} onClick={() => setTab(item.key)}
                className={`relative flex w-full items-center rounded-r px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-pitch-700 text-fm-gold border-l-2 border-fm-gold' : 'border-l-2 border-transparent text-fm-muted hover:bg-pitch-700 hover:text-slate-200'} ${sidebarCollapsed ? 'justify-center px-2' : 'gap-3'}`}>
                <span className="w-5 shrink-0 text-center text-base">{item.icon}</span>
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                {!sidebarCollapsed && badge > 0 && <span className="ml-auto min-w-[18px] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[9px] font-bold text-white">{badge}</span>}
              </button>;
            })}
          </nav>
          <div className="border-t border-fm-border p-2">
            <button type="button" onClick={() => setSidebarCollapsed(value => !value)} title={sidebarCollapsed ? 'Sidebarı genişlet' : 'Sidebarı daralt'} aria-label={sidebarCollapsed ? 'Sidebarı genişlet' : 'Sidebarı daralt'} className="flex w-full items-center justify-center rounded px-3 py-2 text-sm text-fm-muted hover:bg-pitch-700 hover:text-slate-200">
              {sidebarCollapsed ? '»' : '«'}
            </button>
          </div>
        </div>
      </aside>
      <div className={`min-h-screen transition-[margin] duration-200 ${sidebarCollapsed ? 'ml-16' : 'ml-[220px]'}`}>
        <header className="sticky top-0 z-20 h-14 bg-fm-sidebar border-b border-fm-border px-4 sm:px-6">
          <div className="flex h-full items-center gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <TeamBadge clubId={userClub?.id ?? ''} shortName={userClub?.shortName ?? userClub?.name ?? 'FM'} size="sm" />
              <span className="truncate text-sm font-semibold text-slate-100">{userClub?.name ?? 'Takım'}</span>
            </div>
            <div className="hidden shrink-0 text-sm font-semibold text-slate-300 sm:block">Sezon {season} • Hafta {week}</div>
            <div className="flex shrink-0 items-center gap-2">
              {seasonOver && <button type="button" onClick={() => setShowSeasonEnd(true)} className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-900 font-bold px-3 py-2 rounded text-xs animate-pulse">🏆 Sezon Sonu</button>}
              <button type="button" onClick={playWeek} disabled={seasonOver} className="btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-50">▶ Devam</button>
              <button type="button" onClick={() => { if (confirm('Yeni oyun başlatılsın mı? Mevcut kayıt silinir.')) newGame(); }} className="btn-secondary hidden text-sm lg:inline-flex">🔄 Yeni Oyun</button>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
          {tab === 'fixtures' && <Fixtures />}
          {tab === 'liveMatch' && <LiveMatchScreen />}
          {tab === 'cup' && <Cup />}
          {tab === 'squad' && <Squad />}
          {tab === 'tactics' && <Tactics />}
          {tab === 'training' && <Training />}
          {tab === 'academy' && <Academy />}
          {tab === 'table' && <Table />}
          {tab === 'stats' && <Stats />}
          {tab === 'inbox' && <InboxView />}
          {tab === 'transfer' && <Transfers />}
          {tab === 'settings' && <Settings />}
        </main>
      </div>
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