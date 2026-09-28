import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameState, Player, Club, TrainingFocus } from '../engine/types';
import { generateGameData } from '../engine/data/generateData';
import { generateFixtures } from '../engine/league/fixtures';
import { initTable, updateTable } from '../engine/league/table';
import { simulateMatch } from '../engine/match/simulate';
import { developPlayers } from '../engine/progression/training';
import { applyTrainingToSquad } from '../engine/progression/trainingSystem';

interface Store extends GameState {
  newGame: () => void;
  playWeek: () => void;
  setTactic: (tactic: Partial<Club['tactic']>) => void;
  advanceSeason: () => void;
  transferBuy: (playerId: string) => void;
  transferSell: (playerId: string) => void;
  setTrainingFocus: (focus: TrainingFocus) => void;
  setTrainingIntensity: (intensity: 'light' | 'normal' | 'intense') => void;

  setLineup: (lineup: string[]) => void;
  swapPlayers: (idA: string, idB: string) => void;
  resetLineup: () => void;
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

export const useGameStore = create<Store>()(
  persist(
    (set, get) => ({
      ...createInitialState(),

      newGame: () => set(createInitialState()),

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

      playWeek: () => {
        const state = get();
        if (state.seasonOver) return;

        const weekMatches = state.fixtures.filter(m => m.week === state.currentWeek && !m.played);
        const newFixtures = [...state.fixtures];
        const newTable = { ...state.table };
        let newPlayers = { ...state.players };
        const news = [...state.news];

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
        });
      },

      // ═══════════════════════════════════════════════
      // SEZON GEÇİŞİ — SEZON İSTATİSTİKLERİNİ SIFIRLA
      // ═══════════════════════════════════════════════
      advanceSeason: () => {
        const state = get();

        // Oyuncuları geliştir (yaşlanma, gelişim)
        let newPlayers = developPlayers(state.players);

        // ═══ SEZON İSTATİSTİKLERİNİ SIFIRLA (kariyer korunur) ═══
        for (const id in newPlayers) {
          const p = { ...newPlayers[id] };
          if (p.careerStats) {
            p.careerStats = {
              ...p.careerStats,
              // Kariyer aynen kalır
              // Sezon sıfırlanır
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

        const season = state.season + 1;
        const fixtures = generateFixtures(state.clubs, season);
        const table = initTable(Object.keys(state.clubs));

        set({
          season,
          currentWeek: 1,
          fixtures,
          table,
          players: newPlayers,
          seasonOver: false,
          news: [`🏆 Sezon ${season} başladı! Kariyer istatistikleri korundu, sezon istatistikleri sıfırlandı.`, ...state.news].slice(0, 30),
        });
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
      },

      transferSell: (playerId) => {
        const state = get();
        const player = state.players[playerId];
        const userClub = state.clubs[state.userClubId];
        if (!player || player.clubId !== state.userClubId || !userClub) return;
        const updatedPlayer: Player = { ...player, clubId: null };
        const updatedClub: Club = {
          ...userClub,
          budget: userClub.budget + Math.round(player.value * 0.9),
        };
        set({
          players: { ...state.players, [playerId]: updatedPlayer },
          clubs: { ...state.clubs, [state.userClubId]: updatedClub },
          news: [`💸 ${player.name} satıldı (+£${((player.value * 0.9) / 1_000_000).toFixed(2)}M)`, ...state.news].slice(0, 30),
        });
      },

      setTrainingFocus: (focus) => {
        const state = get();
        set({
          training: { ...state.training, focus },
        });
      },

      setTrainingIntensity: (intensity) => {
        const state = get();
        set({
          training: { ...state.training, intensity },
        });
      },
    }),
    { name: 'fm-clone-save' }
  )
);