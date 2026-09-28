// src/store/useInboxStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ═══════════════════════════════════════════════
// TİPLER
// ═══════════════════════════════════════════════

export type MessageCategory =
  | 'TRANSFER'
  | 'FINANCE'
  | 'INJURY'
  | 'BOARD'
  | 'AWARD'
  | 'MATCH';

export interface TransferOffer {
  id: string;
  playerId: string;
  playerName: string;
  playerPosition: string;
  playerAge: number;
  playerValue: number;
  biddingClubId: string;
  biddingClubName: string;
  offerAmount: number;
  type: 'BUY' | 'LOAN';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface InboxMessage {
  id: string;
  season: number;
  week: number;
  sender: string;
  title: string;
  content: string;
  isRead: boolean;
  category: MessageCategory;
  transferOffer?: TransferOffer;
}

// ═══════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════

interface InboxState {
  messages: InboxMessage[];
  selectedMessageId: string | null;

  selectMessage: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteMessage: (id: string) => void;
  clearAll: () => void;

  respondToOffer: (messageId: string, response: 'ACCEPT' | 'REJECT') => void;

  addMessage: (msg: Omit<InboxMessage, 'id' | 'isRead'>) => void;
}

export const useInboxStore = create<InboxState>()(
  persist(
    (set, get) => ({
      messages: [],
      selectedMessageId: null,

      selectMessage: (id) => {
        set({ selectedMessageId: id });
        get().markAsRead(id);
      },

      markAsRead: (id) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, isRead: true } : m
          ),
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          messages: state.messages.map((m) => ({ ...m, isRead: true })),
        }));
      },

      deleteMessage: (id) => {
        set((state) => ({
          messages: state.messages.filter((m) => m.id !== id),
          selectedMessageId:
            state.selectedMessageId === id ? null : state.selectedMessageId,
        }));
      },

      clearAll: () => set({ messages: [], selectedMessageId: null }),

      respondToOffer: (messageId, response) => {
        set((state) => ({
          messages: state.messages.map((msg) => {
            if (msg.id === messageId && msg.transferOffer) {
              return {
                ...msg,
                transferOffer: {
                  ...msg.transferOffer,
                  status: response === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
                },
              };
            }
            return msg;
          }),
        }));
      },

      addMessage: (msg) => {
        const newMsg: InboxMessage = {
          ...msg,
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          isRead: false,
        };
        set((state) => ({
          messages: [newMsg, ...state.messages].slice(0, 50),
        }));
      },
    }),
    { name: 'fmsnn-inbox-storage' }
  )
);

// ═══════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════

export function getUnreadCount(): number {
  return useInboxStore.getState().messages.filter((m) => !m.isRead).length;
}