// src/components/Settings.tsx

import { useGameStore } from '../store/gameStore';
import type { AssistantSettings } from '../engine/types';

const DEFAULT_ASSISTANT: AssistantSettings = {
  pressConference: true,
  training: false,
  lineupSuggestion: false,
  transferSuggestion: false,
  matchAnalysis: false,
};

export function Settings() {
  const assistant = useGameStore(s => s.assistant) ?? DEFAULT_ASSISTANT;
  const setAssistantSetting = useGameStore(s => s.setAssistantSetting);

  const tasks: {
    key: keyof AssistantSettings;
    icon: string;
    title: string;
    description: string;
  }[] = [
    {
      key: 'pressConference',
      icon: '🎙️',
      title: 'Basın Toplantıları',
      description: 'Yardımcı menajer basın toplantılarına katılsın (otomatik sonuç)',
    },
    {
      key: 'training',
      icon: '🏃',
      title: 'Antrenman Yönetimi',
      description: 'Yardımcı menajer antrenman odağını kadroya göre otomatik seçsin',
    },
    {
      key: 'lineupSuggestion',
      icon: '👥',
      title: 'Kadro Seçimi Önerisi',
      description: 'Yardımcı menajer en iyi 11 için öneri versin',
    },
    {
      key: 'transferSuggestion',
      icon: '📨',
      title: 'Transfer Önerisi',
      description: 'Yardımcı menajer zayıf mevkiler için transfer önersin',
    },
    {
      key: 'matchAnalysis',
      icon: '📊',
      title: 'Maç Analizi',
      description: 'Yardımcı menajer maç sonrası rapor versin',
    },
  ];

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="glass-panel rounded-xl p-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⚙️</span>
          <div>
            <h2 className="text-lg font-bold text-white">Ayarlar</h2>
            <p className="text-xs text-slate-400">
              Yardımcı menajer görevlerini yönet
            </p>
          </div>
        </div>
      </div>

      {/* YARDIMCI MENAJER */}
      <div className="glass-panel rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-pitch-700/50">
          <span className="text-xl">👔</span>
          <h3 className="text-base font-bold text-white">Yardımcı Menajer</h3>
        </div>

        <div className="space-y-3">
          {tasks.map(task => {
            const isActive = assistant[task.key] ?? false;

            return (
              <div
                key={task.key}
                className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-accent/10 border-accent/40'
                    : 'bg-pitch-800/50 border-pitch-700/50'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0">{task.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${isActive ? 'text-accent' : 'text-white'}`}>
                      {task.title}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {task.description}
                    </p>
                  </div>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => setAssistantSetting(task.key, !isActive)}
                  className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors ${
                    isActive ? 'bg-accent' : 'bg-pitch-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${
                      isActive ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* BİLGİ */}
      <div className="glass-panel rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">💡</span>
          <div>
            <p className="text-xs text-slate-300 font-bold mb-1">Nasıl Çalışır?</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Açık olan görevleri yardımcı menajer otomatik yapar. Kapalı olanları sen yönetirsin.
              Örneğin, "Basın Toplantıları" açıksa maç sonrası basın toplantısına yardımcı menajer gider,
              sen uğraşmazsın.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}