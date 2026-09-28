// src/store/gameStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameState, Player, Club, TrainingFocus } from '../engine/types';
import { generateGameData } from '../engine/data/generateData';
import { generateFixtures } from '../engine/league/fixtures';
import { initTable, updateTable } from '../engine/league/table';
import { simulateMatch } from '../engine/match/simulate';
import { developPlayers } from '../engine/progression/training';
import { applyTrainingToSquad } from '../engine/progression/trainingSystem';
import { aiTransferWindow } from '../engine/transfer/aiTransfer';
import { useInboxStore } from './useInboxStore';

interface Store extends GameState {
  newGame: () => void;
  playWeek: () => void;
  setTactic: (tactic: Partial<Club['tactic']>) => void;
  advanceSeason: () => void;
  transferBuy: (playerId: string) => void;
  transferSell: (playerId: string, buyerClubId?: string) => void;
  setTrainingFocus: (focus: TrainingFocus) => void;
  setTrainingIntensity: (intensity: 'light' | 'normal' | 'intense') => void;

  setLineup: (lineup: string[]) => void;
  swapPlayers: (idA: string, idB: string) => void;
  resetLineup: () => void;

  applyPressEffects: (moraleDelta: number, boardDelta: number) => void;

  pendingPressMatch: {
    homeScore: number;
    awayScore: number;
    opponentName: string;
    opponentId: string;
    isHome: boolean;
  } | null;
  clearPendingPress: () => void;
}

function createInitialState(): GameState {
  const { clubs, players } = generateGameData();
  const userClubId = Object.keys(clubs)[0];
  clubs[userClubId].isUser = true;

  const fixtures = generateFixtures(clubs, 1);
  const table = initTable(Object.keys(clubs));

  return {
    season: 1,
    currentWeek: 1,
    userClubId,
    clubs,
    players,
    fixtures,
    table,
    transferList: [],
    news: ['Yeni sezon başladı! Başarılar dileriz.'],
    seasonOver: false,
    training: { focus: 'balanced', intensity: 'normal' },
    userLineup: [],
  };
}

// ═══════════════════════════════════════════════
// INBOX MESAJ YARDIMCILARI
// ═══════════════════════════════════════════════

function hasActiveInjuryMessage(playerName: string): boolean {
  const inbox = useInboxStore.getState();
  return inbox.messages.some(
    m => m.category === 'INJURY' &&
         m.title.includes(playerName) &&
         m.content.includes('sakatlandı')
  );
}

function addInjuryMessages(
  players: Record<string, Player>,
  userClubId: string,
  season: number,
  week: number
): void {
  const inbox = useInboxStore.getState();

  const injuredPlayers = Object.values(players).filter(
    p => p.clubId === userClubId && p.injuryWeeks > 0
  );

  injuredPlayers.forEach(p => {
    if (!hasActiveInjuryMessage(p.name)) {
      inbox.addMessage({
        season,
        week,
        sender: '🏥 Sağlık Heyeti',
        title: `Sakatlık Raporu: ${p.name}`,
        content: `${p.name} sakatlandı. Tahmini iyileşme süresi: ${p.injuryWeeks} hafta.`,
        category: 'INJURY',
      });
    }
  });
}

function maybeAddTransferOffer(
  players: Record<string, Player>,
  clubs: Record<string, Club>,
  userClubId: string,
  season: number,
  week: number
): void {
  if (Math.random() > 0.15) return;

  const inbox = useInboxStore.getState();

  const userSquad = Object.values(players).filter(
    p => p.clubId === userClubId && p.injuryWeeks === 0 && p.suspensionWeeks === 0
  );

  const candidates = userSquad.filter(p => p.value > 500_000);
  if (candidates.length === 0) return;

  const target = candidates[Math.floor(Math.random() * candidates.length)];
  const otherClubs = Object.values(clubs).filter(c => c.id !== userClubId);
  if (otherClubs.length === 0) return;

  const biddingClub = otherClubs[Math.floor(Math.random() * otherClubs.length)];
  const offerAmount = Math.round(target.value * (1.1 + Math.random() * 0.5));

  const existingOffer = inbox.messages.some(
    m => m.category === 'TRANSFER' &&
         m.transferOffer?.playerId === target.id &&
         m.transferOffer?.status === 'PENDING'
  );
  if (existingOffer) return;

  inbox.addMessage({
    season,
    week,
    sender: `📨 ${biddingClub.name} Yönetim Kurulu`,
    title: `${target.name} için transfer teklifi`,
    content: `${biddingClub.name}, ${target.name} için resmi bonservis teklifinde bulundu. Teklifi değerlendirmek ister misiniz?`,
    category: 'TRANSFER',
    transferOffer: {
      id: `off-${Date.now()}`,
      playerId: target.id,
      playerName: target.name,
      playerPosition: target.position,
      playerAge: target.age,
      playerValue: target.value,
      biddingClubId: biddingClub.id,
      biddingClubName: biddingClub.name,
      offerAmount,
      type: 'BUY',
      status: 'PENDING',
    },
  });
}

function maybeAddBoardMessage(
  table: Record<string, any>,
  userClubId: string,
  season: number,
  week: number
): void {
  if (week % 10 !== 0) return;

  const inbox = useInboxStore.getState();

  const existing = inbox.messages.some(
    m => m.category === 'BOARD' && m.week === week && m.season === season
  );
  if (existing) return;

  const sorted = Object.values(table).sort((a: any, b: any) => b.points - a.points);
  const userPos = sorted.findIndex((r: any) => r.clubId === userClubId) + 1;

  let title = '';
  let content = '';

  if (userPos <= 4) {
    title = '🏆 Yönetim: Harika gidiyorsunuz!';
    content = `Ligde ${userPos}. sıradasınız. Yönetim kurulu performansınızdan çok memnun. Böyle devam edin!`;
  } else if (userPos <= 8) {
    title = '👔 Yönetim: Orta sıra hedefi';
    content = `Ligde ${userPos}. sıradasınız. Avrupa kupaları için mücadeleye devam.`;
  } else if (userPos <= 12) {
    title = '⚠️ Yönetim: Daha fazlasını bekliyoruz';
    content = `Ligde ${userPos}. sıradasınız. Yönetim kurulu daha iyi performans bekliyor.`;
  } else {
    title = '🔴 Yönetim: Acil toparlanma lazım';
    content = `Ligde ${userPos}. sıradasınız. Yönetim kurulu ciddi endişeli. Sonuçları iyileştirmelisiniz.`;
  }

  inbox.addMessage({
    season,
    week,
    sender: '👔 Yönetim Kurulu',
    title,
    content,
    category: 'BOARD',
  });
}

// ═══════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════

export const useGameStore = create<Store>()(
  persist(
    (set, get) => ({
      ...createInitialState(),
      pendingPressMatch: null,

      newGame: () => {
        useInboxStore.getState().clearAll();
        set({ ...createInitialState(), pendingPressMatch: null });
      },

      setTactic: (partial) => {
        const state = get();
        const userClub = state.clubs[state.userClubId];
        if (!userClub) return;
        const updated: Club = { ...userClub, tactic: { ...userClub.tactic, ...partial } };
        if (partial.formation) updated.formation = partial.formation;
        set({
          clubs: { ...state.clubs, [state.userClubId]: updated },
        });
      },

      setLineup: (lineup) => set({ userLineup: lineup }),

      swapPlayers: (idA, idB) => {
        const state = get();
        const lineup = [...state.userLineup];
        const idxA = lineup.indexOf(idA);
        const idxB = lineup.indexOf(idB);

        if (idxA === -1 && idxB === -1) return;

        if (idxA === -1) {
          lineup[idxB] = idA;
        } else if (idxB === -1) {
          lineup[idxA] = idB;
        } else {
          [lineup[idxA], lineup[idxB]] = [lineup[idxB], lineup[idxA]];
        }

        set({ userLineup: lineup });
      },

      resetLineup: () => set({ userLineup: [] }),

      applyPressEffects: (moraleDelta, boardDelta) => {
        const state = get();
        const userClub = state.clubs[state.userClubId];
        if (!userClub) return;

        const newPlayers = { ...state.players };
        for (const id in newPlayers) {
          if (newPlayers[id].clubId === state.userClubId) {
            newPlayers[id] = {
              ...newPlayers[id],
              morale: Math.max(10, Math.min(100, newPlayers[id].morale + moraleDelta)),
            };
          }
        }

        const newReputation = Math.max(1, Math.min(20, userClub.reputation + Math.floor(boardDelta / 2)));

        const news = [...state.news];
        if (moraleDelta > 0) {
          news.unshift(`🎙️ Basın toplantısı sonrası takım morali arttı (+${moraleDelta})`);
        } else if (moraleDelta < 0) {
          news.unshift(`🎙️ Basın toplantısı sonrası takım morali düştü (${moraleDelta})`);
        }

        set({
          players: newPlayers,
          clubs: { ...state.clubs, [state.userClubId]: { ...userClub, reputation: newReputation } },
          news: news.slice(0, 30),
          pendingPressMatch: null,
        });
      },

      clearPendingPress: () => set({ pendingPressMatch: null }),

      playWeek: () => {
        const state = get();
        if (state.seasonOver) return;

        const weekMatches = state.fixtures.filter(m => m.week === state.currentWeek && !m.played);
        const newFixtures = [...state.fixtures];
        const newTable = { ...state.table };
        let newPlayers = { ...state.players };
        const news = [...state.news];

        let userMatch: any = null;

        for (const m of weekMatches) {
          const home = state.clubs[m.homeId!];
          const away = state.clubs[m.awayId!];

          const lineup = (m.homeId === state.userClubId || m.awayId === state.userClubId)
            ? state.userLineup
            : undefined;

          const result = simulateMatch(home, away, newPlayers, m.week!, lineup);
          const idx = newFixtures.findIndex(x => x.id === m.id);
          newFixtures[idx] = result;
          updateTable(newTable, result);

          if (result.homeId === state.userClubId || result.awayId === state.userClubId) {
            const isHome = result.homeId === state.userClubId;
            const our = isHome ? result.homeScore : result.awayScore;
            const their = isHome ? result.awayScore : result.homeScore;
            const opponent = isHome ? away.shortName : home.shortName;
            const scoreStr = `${our}-${their}`;
            const verdict = our > their ? '🏆 Kazandık' : our < their ? '😞 Kaybettik' : '🤝 Berabere';
            news.unshift(`Hafta ${state.currentWeek}: ${opponent} karşısında ${scoreStr} — ${verdict}`);

            userMatch = {
              homeScore: result.homeScore,
              awayScore: result.awayScore,
              opponentName: isHome ? away.name : home.name,
              opponentId: isHome ? away.id : home.id,
              isHome,
            };
          }
        }

        for (const id in newPlayers) {
          const p = { ...newPlayers[id] };
          p.condition = Math.max(40, p.condition - Math.floor(Math.random() * 15));
          p.form = Math.max(20, Math.min(100, p.form + Math.round((Math.random() - 0.5) * 8)));

          if (p.injuryWeeks > 0) {
            p.injuryWeeks = Math.max(0, p.injuryWeeks - 1);
            if (p.injuryWeeks === 0) {
              p.injuryType = null;
              if (p.clubId === state.userClubId) {
                news.unshift(`💚 ${p.name} iyileşti, tekrar oynayabilir!`);
              }
            }
          }

          if (p.suspensionWeeks > 0) {
            p.suspensionWeeks = Math.max(0, p.suspensionWeeks - 1);
            if (p.suspensionWeeks === 0 && p.clubId === state.userClubId) {
              news.unshift(`✅ ${p.name} cezasını tamamladı!`);
            }
          }

          newPlayers[id] = p;
        }

        newPlayers = applyTrainingToSquad(newPlayers, state.userClubId, state.training);

        const nextWeek = state.currentWeek + 1;
        const maxWeek = Math.max(...newFixtures.map(m => m.week!));
        const seasonOver = nextWeek > maxWeek;

        set({
          fixtures: newFixtures,
          table: newTable,
          players: newPlayers,
          currentWeek: seasonOver ? state.currentWeek : nextWeek,
          news: news.slice(0, 30),
          seasonOver,
          pendingPressMatch: userMatch,
        });

        addInjuryMessages(newPlayers, state.userClubId, state.season, state.currentWeek);
        maybeAddTransferOffer(newPlayers, state.clubs, state.userClubId, state.season, state.currentWeek);
        maybeAddBoardMessage(newTable, state.userClubId, state.season, state.currentWeek);
      },

      advanceSeason: () => {
        const state = get();

        let newPlayers = developPlayers(state.players);

        for (const id in newPlayers) {
          const p = { ...newPlayers[id] };
          if (p.careerStats) {
            p.careerStats = {
              ...p.careerStats,
              seasonAppearances: 0,
              seasonGoals: 0,
              seasonAssists: 0,
              seasonYellowCards: 0,
              seasonRedCards: 0,
              seasonAvgRating: 0,
              seasonMinutesPlayed: 0,
              seasonMotm: 0,
            };
          }
          newPlayers[id] = p;
        }

        // AI TRANSFER WINDOW
        const transferResult = aiTransferWindow(
          state.clubs,
          newPlayers,
          state.userClubId
        );
        newPlayers = transferResult.players;
        const newClubs = transferResult.clubs;

        const season = state.season + 1;
        const fixtures = generateFixtures(newClubs, season);
        const table = initTable(Object.keys(newClubs));

        const news = [`🏆 Sezon ${season} başladı!`, ...state.news];

        if (transferResult.log.length > 0) {
          news.unshift(`📨 Transfer sezonu: ${transferResult.log.length} transfer gerçekleşti`);
          transferResult.log.slice(0, 3).forEach(msg => {
            news.push(`• ${msg}`);
          });
        }

        set({
          season,
          currentWeek: 1,
          fixtures,
          table,
          players: newPlayers,
          clubs: newClubs,
          seasonOver: false,
          news: news.slice(0, 30),
        });

        useInboxStore.getState().addMessage({
          season,
          week: 1,
          sender: '📋 Lig Yönetimi',
          title: `Sezon ${season} başladı!`,
          content: `Yeni sezon başladı. Transfer dönemi açık, hedeflerinizi belirleyin. Başarılar!`,
          category: 'BOARD',
        });

        if (transferResult.log.length > 0) {
          useInboxStore.getState().addMessage({
            season,
            week: 1,
            sender: '📨 Transfer Ofisi',
            title: `Transfer dönemi kapandı`,
            content: `Bu sezon ${transferResult.log.length} transfer gerçekleşti.\n\n${transferResult.log.slice(0, 5).join('\n')}`,
            category: 'TRANSFER',
          });
        }
      },

      transferBuy: (playerId) => {
        const state = get();
        const player = state.players[playerId];
        const userClub = state.clubs[state.userClubId];
        if (!player || !userClub) return;
        if (userClub.budget < player.value) {
          set({ news: ['❌ Bütçe yetersiz!', ...state.news].slice(0, 30) });
          return;
        }
        const updatedPlayer: Player = { ...player, clubId: state.userClubId };
        const updatedClub: Club = {
          ...userClub,
          budget: userClub.budget - player.value,
        };
        set({
          players: { ...state.players, [playerId]: updatedPlayer },
          clubs: { ...state.clubs, [state.userClubId]: updatedClub },
          transferList: state.transferList.filter(id => id !== playerId),
          news: [`✅ ${player.name} transfer edildi!`, ...state.news].slice(0, 30),
        });

        useInboxStore.getState().addMessage({
          season: state.season,
          week: state.currentWeek,
          sender: '💰 Transfer Ofisi',
          title: `${player.name} transfer edildi`,
          content: `${player.name} £${(player.value / 1_000_000).toFixed(2)}M karşılığında kadroya katıldı.`,
          category: 'TRANSFER',
        });
      },

      // ═══════════════════════════════════════════════
      // TRANSFER SELL — ALICI KULÜBE GİDER
      // ═══════════════════════════════════════════════
      transferSell: (playerId, buyerClubId) => {
        const state = get();
        const player = state.players[playerId];
        const userClub = state.clubs[state.userClubId];
        if (!player || player.clubId !== state.userClubId || !userClub) return;

        // Alıcı kulüp belirle
        let finalBuyerId: string | null = null;

        if (buyerClubId && state.clubs[buyerClubId]) {
          finalBuyerId = buyerClubId;
        } else {
          // Rastgele bir alıcı seç (kullanıcı hariç)
          const otherClubs = Object.values(state.clubs).filter(c => c.id !== state.userClubId);
          if (otherClubs.length > 0) {
            const buyer = otherClubs[Math.floor(Math.random() * otherClubs.length)];
            finalBuyerId = buyer.id;
          }
        }

        if (!finalBuyerId) return;

        const updatedPlayer: Player = { ...player, clubId: finalBuyerId };

        // Bütçeleri güncelle
        const newClubs = { ...state.clubs };
        newClubs[state.userClubId] = {
          ...userClub,
          budget: userClub.budget + Math.round(player.value * 0.9),
        };

        const buyerClub = newClubs[finalBuyerId];
        if (buyerClub && buyerClub.budget >= player.value) {
          newClubs[finalBuyerId] = {
            ...buyerClub,
            budget: buyerClub.budget - player.value,
          };
        }

        set({
          players: { ...state.players, [playerId]: updatedPlayer },
          clubs: newClubs,
          news: [`💸 ${player.name} satıldı → ${buyerClub?.shortName ?? '???'} (+£${((player.value * 0.9) / 1_000_000).toFixed(2)}M)`, ...state.news].slice(0, 30),
        });

        useInboxStore.getState().addMessage({
          season: state.season,
          week: state.currentWeek,
          sender: '💰 Finans Departmanı',
          title: `${player.name} satıldı`,
          content: `${player.name} £${((player.value * 0.9) / 1_000_000).toFixed(2)}M karşılığında ${buyerClub?.name ?? 'başka bir kulübe'} satıldı. Bütçe güncellendi.`,
          category: 'FINANCE',
        });
      },

      setTrainingFocus: (focus) => {
        const state = get();
        set({ training: { ...state.training, focus } });
      },

      setTrainingIntensity: (intensity) => {
        const state = get();
        set({ training: { ...state.training, intensity } });
      },
    }),
    { name: 'fm-clone-save' }
  )
);