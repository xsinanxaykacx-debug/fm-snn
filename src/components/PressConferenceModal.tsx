// src/components/PressConferenceModal.tsx

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { TeamBadge } from './TeamBadge';

interface Question {
  id: number;
  reporter: string;
  mediaOutlet: string;
  text: string;
  options: {
    text: string;
    moraleEffect: 'positive' | 'neutral' | 'negative';
    boardEffect: number;
  }[];
}

interface Props {
  matchResult: {
    homeScore: number;
    awayScore: number;
    opponentName: string;
    opponentId: string;
    isHome: boolean;
  };
  onComplete: (effects: { moraleDelta: number; boardDelta: number }) => void;
  onClose: () => void;
}

export function PressConferenceModal({ matchResult, onComplete, onClose }: Props) {
  const state = useGameStore();
  const userClub = state.clubs[state.userClubId];

  const [currentStep, setCurrentStep] = useState(0);
  const [totalMorale, setTotalMorale] = useState(0);
  const [totalBoard, setTotalBoard] = useState(0);

  const ourScore = matchResult.isHome ? matchResult.homeScore : matchResult.awayScore;
  const theirScore = matchResult.isHome ? matchResult.awayScore : matchResult.homeScore;
  const result = ourScore > theirScore ? 'win' : ourScore < theirScore ? 'loss' : 'draw';

  const resultLabel =
    result === 'win' ? 'galibiyet' :
    result === 'loss' ? 'mağlubiyet' : 'beraberlik';

  // ═══ SORULAR (sonuca göre) ═══
  const questions: Question[] = [
    {
      id: 1,
      reporter: 'Ahmet Yılmaz',
      mediaOutlet: 'Futbol Gazetesi',
      text: `${matchResult.opponentName} karşısında alınan ${ourScore}-${theirScore} ${resultLabel}ini nasıl değerlendiriyorsunuz?`,
      options:
        result === 'win' ? [
          { text: 'Oyuncularımın sahaya koyduğu karakterden gurur duyuyorum.', moraleEffect: 'positive', boardEffect: 1 },
          { text: 'İyi bir galibiyet ama hâlâ geliştirmemiz gereken detaylar var.', moraleEffect: 'neutral', boardEffect: 0 },
          { text: 'Kazanmak güzel ama bu seviye bizi tatmin etmez.', moraleEffect: 'negative', boardEffect: -1 },
        ] :
        result === 'loss' ? [
          { text: 'Bu mağlubiyetin sorumluluğunu tamamen üstleniyorum.', moraleEffect: 'neutral', boardEffect: 1 },
          { text: 'Oyuncularım elinden geleni yaptı, şans bizden yanaydı değildi.', moraleEffect: 'positive', boardEffect: 0 },
          { text: 'Bu performans kabul edilemez, bazı oyuncular kendine çeki düzen vermeli.', moraleEffect: 'negative', boardEffect: -1 },
        ] : [
          { text: 'Bir puan da puan, yola devam ediyoruz.', moraleEffect: 'neutral', boardEffect: 0 },
          { text: 'Rakip iyi mücadele etti, ama biz kazanmayı hak ettik.', moraleEffect: 'positive', boardEffect: 1 },
          { text: 'Bu tür maçları kazanmalıydık, kaybettiğimiz 2 puan canımızı yakacak.', moraleEffect: 'negative', boardEffect: -1 },
        ],
    },
    {
      id: 2,
      reporter: 'Mehmet Demir',
      mediaOutlet: 'Spor TV',
      text: 'Önümüzdeki kritik fikstür öncesi takımın fiziksel durumunu yeterli buluyor musunuz?',
      options: [
        { text: 'Kadro derinliğimize güveniyorum, rotasyonla üstesinden geleceğiz.', moraleEffect: 'positive', boardEffect: 1 },
        { text: 'Maç yoğunluğu tüm takımları zorluyor, bakıp göreceğiz.', moraleEffect: 'neutral', boardEffect: 0 },
        { text: 'Kadromuz biraz yorgun, bu bir sorun olabilir.', moraleEffect: 'negative', boardEffect: -1 },
      ],
    },
    {
      id: 3,
      reporter: 'Ayşe Kaya',
      mediaOutlet: 'Spor Arena',
      text: 'Taraftarlarınıza bu performans için ne söylemek istersiniz?',
      options: [
        { text: 'Bizi destekleyen taraftarlarımıza çok teşekkür ederim.', moraleEffect: 'positive', boardEffect: 1 },
        { text: 'Onların desteğini her zaman arkamızda hissediyoruz.', moraleEffect: 'positive', boardEffect: 0 },
        { text: 'Taraftarımıza karşı mahcubuz, bir sonraki maçta telafi edeceğiz.', moraleEffect: 'neutral', boardEffect: 0 },
      ],
    },
  ];

  const handleSelectOption = (option: Question['options'][0]) => {
    const moraleAdd =
      option.moraleEffect === 'positive' ? 3 :
      option.moraleEffect === 'negative' ? -3 : 0;

    const newMorale = totalMorale + moraleAdd;
    const newBoard = totalBoard + option.boardEffect;

    setTotalMorale(newMorale);
    setTotalBoard(newBoard);

    if (currentStep + 1 < questions.length) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete({ moraleDelta: newMorale, boardDelta: newBoard });
    }
  };

  const q = questions[currentStep];

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-4 z-50 animate-backdrop-in">
      <div className="glass-modal w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl animate-modal-in">

        {/* ═══ HEADER ═══ */}
        <div className="px-6 py-4 border-b border-pitch-700/50 bg-gradient-to-r from-indigo-500/20 via-transparent to-indigo-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎙️</span>
              <div>
                <h3 className="text-lg font-bold text-white">Maç Sonu Basın Toplantısı</h3>
                <p className="text-[10px] text-slate-400">
                  {userClub?.name} • {matchResult.opponentName} maçı
                </p>
              </div>
            </div>
            <span className="text-xs bg-pitch-800 text-slate-400 px-3 py-1 rounded-full border border-pitch-700">
              Soru {currentStep + 1} / {questions.length}
            </span>
          </div>
        </div>

        {/* ═══ MAÇ SONUCU ═══ */}
        <div className="px-6 py-3 border-b border-pitch-700/30 flex items-center justify-center gap-4">
          <TeamBadge clubId={state.userClubId} shortName={userClub?.shortName ?? '???'} size="sm" />
          <div className="text-center">
            <span className={`text-2xl font-black ${
              result === 'win' ? 'text-green-400' :
              result === 'loss' ? 'text-red-400' : 'text-yellow-400'
            }`}>
              {ourScore} - {theirScore}
            </span>
          </div>
          <TeamBadge clubId={matchResult.opponentId} shortName={matchResult.opponentName.split(' ')[0]} size="sm" />
        </div>

        {/* ═══ SORU ═══ */}
        <div className="p-6 space-y-4">
          <div className="bg-pitch-900/60 border border-pitch-700/50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-400">{q.reporter}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                {q.mediaOutlet}
              </span>
            </div>
            <p className="text-sm text-slate-200 font-medium">"{q.text}"</p>
          </div>

          {/* ═══ YANITLAR ═══ */}
          <div className="space-y-2">
            {q.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectOption(opt)}
                className="w-full text-left p-3 rounded-xl border border-pitch-700/50 bg-pitch-800/50 hover:bg-pitch-700/50 hover:border-accent/50 transition-all text-xs text-slate-300 hover:text-white flex items-center justify-between group"
              >
                <span>{opt.text}</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-accent font-bold">
                  Yanıtla →
                </span>
              </button>
            ))}
          </div>

          {/* ═══ AKTİF ETKİ ═══ */}
          {(totalMorale !== 0 || totalBoard !== 0) && (
            <div className="flex items-center gap-4 text-[10px] text-slate-400 pt-2 border-t border-pitch-700/30">
              <span>
                Takım Morali:{' '}
                <strong className={totalMorale > 0 ? 'text-green-400' : totalMorale < 0 ? 'text-red-400' : ''}>
                  {totalMorale > 0 ? '+' : ''}{totalMorale}
                </strong>
              </span>
              <span>
                Yönetim Güveni:{' '}
                <strong className={totalBoard > 0 ? 'text-green-400' : totalBoard < 0 ? 'text-red-400' : ''}>
                  {totalBoard > 0 ? '+' : ''}{totalBoard}
                </strong>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}