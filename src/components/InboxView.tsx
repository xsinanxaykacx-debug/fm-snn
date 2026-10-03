// src/components/InboxView.tsx

import { useState } from 'react';
import { useInboxStore } from '../store/useInboxStore';
import type { InboxMessage, MessageCategory } from '../store/useInboxStore';
import { useGameStore } from '../store/gameStore';

function getCategoryStyle(cat: MessageCategory): {
  icon: string;
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  switch (cat) {
    case 'TRANSFER':
      return { icon: '📨', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', label: 'Transfer' };
    case 'FINANCE':
      return { icon: '💰', bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40', label: 'Finans' };
    case 'INJURY':
      return { icon: '🏥', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40', label: 'Sakatlık' };
    case 'BOARD':
      return { icon: '👔', bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40', label: 'Yönetim' };
    case 'AWARD':
      return { icon: '🏆', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40', label: 'Ödül' };
    case 'MATCH':
      return { icon: '⚽', bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/40', label: 'Maç' };
    default:
      return { icon: '📧', bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/40', label: 'Diğer' };
  }
}

function formatMoney(val: number): string {
  return `£${(val / 1_000_000).toFixed(2)}M`;
}

export function selectFilteredMessage(
  messages: InboxMessage[],
  selectedMessageId: string | null,
  filter: MessageCategory | 'ALL'
): InboxMessage | undefined {
  const filtered =
    filter === 'ALL'
      ? messages
      : messages.filter(message => message.category === filter);

  return (
    filtered.find(message => message.id === selectedMessageId) ??
    filtered[0]
  );
}

export function InboxView() {
  const messages = useInboxStore(s => s.messages);
  const selectedMessageId = useInboxStore(s => s.selectedMessageId);
  const selectMessage = useInboxStore(s => s.selectMessage);
  const respondToOffer = useInboxStore(s => s.respondToOffer);
  const deleteMessage = useInboxStore(s => s.deleteMessage);
  const markAllAsRead = useInboxStore(s => s.markAllAsRead);

  const state = useGameStore();
  const transferSell = useGameStore(s => s.transferSell);

  const [filter, setFilter] = useState<MessageCategory | 'ALL'>('ALL');

  const unreadCount = messages.filter((m) => !m.isRead).length;

  const filtered = filter === 'ALL'
    ? messages
    : messages.filter((m) => m.category === filter);

  const selectedMessage = selectFilteredMessage(
    messages,
    selectedMessageId,
    filter
  );

  const handleAcceptOffer = (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg?.transferOffer) return;

    const offer = msg.transferOffer;
    // Alıcı kulübe gönder
    transferSell(offer.playerId, offer.biddingClubId);
    respondToOffer(messageId, 'ACCEPT');
  };

  const handleRejectOffer = (messageId: string) => {
    respondToOffer(messageId, 'REJECT');
  };

  const categories: { key: MessageCategory | 'ALL'; label: string; icon: string }[] = [
    { key: 'ALL', label: 'Tümü', icon: '📬' },
    { key: 'TRANSFER', label: 'Transfer', icon: '📨' },
    { key: 'INJURY', label: 'Sakatlık', icon: '🏥' },
    { key: 'FINANCE', label: 'Finans', icon: '💰' },
    { key: 'BOARD', label: 'Yönetim', icon: '👔' },
    { key: 'MATCH', label: 'Maç', icon: '⚽' },
  ];

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              📬 Gelen Kutusu
              {unreadCount > 0 && (
                <span className="text-xs bg-accent text-white px-2 py-0.5 rounded-full font-bold">
                  {unreadCount} yeni
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              {messages.length} mesaj • Sezon {state.season} • Hafta {state.currentWeek}
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs bg-pitch-700 hover:bg-pitch-600 text-slate-300 px-3 py-1.5 rounded font-medium"
            >
              ✅ Tümünü Okundu İşaretle
            </button>
          )}
        </div>
      </div>

      <div className="glass-panel rounded-xl p-3">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setFilter(cat.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filter === cat.key
                  ? 'bg-accent text-white shadow-md'
                  : 'bg-pitch-700 hover:bg-pitch-600 text-slate-300'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[500px]">
        <div className="lg:col-span-1 glass-panel rounded-xl overflow-hidden flex flex-col max-h-[600px]">
          <div className="p-3 border-b border-pitch-700/50">
            <p className="text-xs text-slate-400 font-bold uppercase">
              Mesajlar ({filtered.length})
            </p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-pitch-700/30">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                <p className="text-3xl mb-2">📭</p>
                <p>Mesaj yok</p>
              </div>
            ) : (
              filtered.map((msg) => {
                const cat = getCategoryStyle(msg.category);
                const isSelected = selectedMessageId === msg.id;

                return (
                  <button
                    key={msg.id}
                    onClick={() => selectMessage(msg.id)}
                    className={`w-full text-left p-3 transition-all relative ${
                      isSelected ? 'bg-pitch-700/60' : 'hover:bg-pitch-700/30'
                    }`}
                  >
                    {!msg.isRead && (
                      <span className="absolute left-1.5 top-4 w-2 h-2 bg-accent rounded-full animate-pulse" />
                    )}

                    <div className="flex items-start gap-2">
                      <div className="text-xl flex-shrink-0 w-8 text-center">{cat.icon}</div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-[10px] font-bold uppercase ${cat.text}`}>
                            {cat.label}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            S{msg.season} H{msg.week}
                          </span>
                        </div>
                        <p className={`text-xs font-bold truncate ${!msg.isRead ? 'text-white' : 'text-slate-300'}`}>
                          {msg.title}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {msg.sender}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-2 glass-panel rounded-xl p-5 overflow-y-auto max-h-[600px]">
          {selectedMessage ? (
            <MessageDetail
              message={selectedMessage}
              onAccept={() => handleAcceptOffer(selectedMessage.id)}
              onReject={() => handleRejectOffer(selectedMessage.id)}
              onDelete={() => deleteMessage(selectedMessage.id)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              <div className="text-center">
                <p className="text-4xl mb-2">📭</p>
                <p>Mesaj seçin</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageDetail({
  message,
  onAccept,
  onReject,
  onDelete,
}: {
  message: InboxMessage;
  onAccept: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  const cat = getCategoryStyle(message.category);
  const offer = message.transferOffer;

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-xl border ${cat.bg} ${cat.border}`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{cat.icon}</span>
          <div className="flex-1">
            <p className={`text-[10px] font-bold uppercase ${cat.text}`}>
              {cat.label}
            </p>
            <h3 className="text-lg font-black text-white mt-0.5">
              {message.title}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Gönderen: <strong className="text-slate-300">{message.sender}</strong>
              {' • '}
              Sezon {message.season}, Hafta {message.week}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-pitch-900/60 border border-pitch-700/40 rounded-xl p-4">
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
          {message.content}
        </p>
      </div>

      {offer && (
        <div className="glass-card border border-blue-500/30 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-pitch-700/50 pb-3">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">
                {offer.type === 'BUY' ? '💰 Bonservis Teklifi' : '🔄 Kiralama Teklifi'}
              </p>
              <p className="text-base font-black text-white mt-0.5">
                {offer.playerName}
              </p>
              <p className="text-xs text-slate-400">
                {offer.playerPosition} • {offer.playerAge} yaş • Değer: {formatMoney(offer.playerValue)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-pitch-800/60 rounded-lg p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase">Teklif Yapan</p>
              <p className="text-sm font-bold text-white mt-1">
                {offer.biddingClubName}
              </p>
            </div>
            <div className="bg-pitch-800/60 rounded-lg p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase">Teklif Tutarı</p>
              <p className="text-lg font-black text-accent mt-1">
                {formatMoney(offer.offerAmount)}
              </p>
            </div>
          </div>

          <div className="text-center text-xs">
            <span className={`font-bold ${
              offer.offerAmount > offer.playerValue ? 'text-green-400' : 'text-orange-400'
            }`}>
              {offer.offerAmount > offer.playerValue
                ? `+${formatMoney(offer.offerAmount - offer.playerValue)} üzeri teklif`
                : `${formatMoney(offer.playerValue - offer.offerAmount)} düşük teklif`}
            </span>
          </div>

          {offer.status === 'PENDING' ? (
            <div className="flex gap-3 pt-2">
              <button
                onClick={onAccept}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-bold py-2.5 rounded-lg transition-all text-sm"
              >
                ✅ Teklifi Kabul Et
              </button>
              <button
                onClick={onReject}
                className="flex-1 bg-pitch-700 hover:bg-pitch-600 text-slate-300 font-bold py-2.5 rounded-lg transition-all text-sm border border-red-500/30"
              >
                ❌ Reddet
              </button>
            </div>
          ) : (
            <div className={`p-3 rounded-lg text-center text-sm font-bold ${
              offer.status === 'ACCEPTED'
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {offer.status === 'ACCEPTED'
                ? '✅ Teklif kabul edildi — oyuncu satıldı'
                : '❌ Teklif reddedildi'}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={onDelete}
          className="text-xs text-slate-500 hover:text-red-400 transition-colors"
        >
          🗑️ Mesajı Sil
        </button>
      </div>
    </div>
  );
}