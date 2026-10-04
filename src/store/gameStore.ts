// src/store/gameStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  GameState,
  Player,
  Club,
  TrainingFocus,
  AssistantSettings,
  AcademyState,
  AcademyPlayer,
  CustomFormation,
  PitchZone,
  SlotPosition,
  CupState,
  Match,
  Formation,
} from '../engine/types';
import { generateGameData, replaceRetiredPlayers } from '../engine/data/generateData';
import { generateFixtures } from '../engine/league/fixtures';
import { initTable, updateTable } from '../engine/league/table';
import { simulateMatch } from '../engine/match/simulate';
import { simulateMatchLive, createMatchSeed } from '../engine/live';
import { developPlayers } from '../engine/progression/training';
import { applyTrainingToSquad } from '../engine/progression/trainingSystem';
import { decrementContracts, evaluateContractOffer, applyContractRenewal } from '../engine/progression/contract';
import { aiTransferWindow } from '../engine/transfer/aiTransfer';
import { suggestTrainingFocus, analyzeMatch } from '../engine/Assistant/assistantAI';
import { generateAllIntakes } from '../engine/academy/academy';
import { createEmptyZones, getFormationZoneMapping, findZoneByPosition } from '../engine/formation/zones';
import {
  createCup,
  saveCupMatchResult,
  advanceCupRound,
  simulatePenalties,
  CUP_WEEKS,
} from '../engine/cup/cupEngine';
import { useInboxStore } from './useInboxStore';

// ═══════════════════════════════════════════════
// SABİT
// ═══════════════════════════════════════════════

const MAX_PITCH_PLAYERS = 11;

const SUMMER_WINDOW_START = 1;
const SUMMER_WINDOW_END = 4;
const WINTER_WINDOW_START = 15;
const WINTER_WINDOW_END = 18;

function isTransferWindowOpen(week: number): boolean {
  return (
    (week >= SUMMER_WINDOW_START && week <= SUMMER_WINDOW_END) ||
    (week >= WINTER_WINDOW_START && week <= WINTER_WINDOW_END)
  );
}

function getTransferWindowName(week: number): string {
  if (week >= SUMMER_WINDOW_START && week <= SUMMER_WINDOW_END) return '☀️ Yaz Transfer Dönemi';
  if (week >= WINTER_WINDOW_START && week <= WINTER_WINDOW_END) return '❄️ Kış Transfer Dönemi';
  return 'Transfer Dönemi Kapalı';
}

const DEFAULT_ASSISTANT: AssistantSettings = {
  pressConference: true,
  training: false,
  lineupSuggestion: false,
  transferSuggestion: false,
  matchAnalysis: false,
};

const DEFAULT_ACADEMY: AcademyState = {
  players: {},
  lastIntakeSeason: 0,
};

function createEmptyCustomFormation(): CustomFormation {
  return {
    id: `custom_${Date.now()}`,
    name: 'Serbest Diziliş',
    zones: createEmptyZones(),
  };
}

function createEmptyCup(): CupState {
  return {
    season: 0,
    matches: {},
    currentRound: null,
    champion: null,
    rounds: { round1: [], quarter: [], semi: [], final: [] },
  };
}

// ═══════════════════════════════════════════════
// STORE INTERFACE
// ═══════════════════════════════════════════════

interface Store extends GameState {
  useLiveEngine: boolean;
  setUseLiveEngine: (value: boolean) => void;

  newGame: () => void;
  playWeek: () => void;
  applyLiveMatchResult: (match: Match) => void;
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
  simulateAssistantPress: () => void;

  setAssistantSetting: (key: keyof AssistantSettings, value: boolean) => void;

  pendingPressMatch: {
    homeScore: number;
    awayScore: number;
    opponentName: string;
    opponentId: string;
    isHome: boolean;
  } | null;
  clearPendingPress: () => void;

  promoteToFirstTeam: (playerId: string) => void;
  promoteAllSelected: (playerIds: string[]) => void;
  releaseFromAcademy: (playerId: string) => void;

  sendToReserves: (playerId: string) => void;
  sendAllSelectedToReserves: (playerIds: string[]) => void;
  promoteFromReserves: (playerId: string) => void;

  renewContract: (playerId: string, offeredWage: number, offeredYears: number) => {
    accepted: boolean;
    reason: string;
  };

  setZonePlayer: (zoneId: string, playerId: string | null) => void;
  swapZones: (zoneIdA: string, zoneIdB: string) => void;
  clearZone: (zoneId: string) => void;
  setZoneLabel: (zoneId: string, label: SlotPosition) => void;
  resetZoneFormation: () => void;
  autoFillZones: (formation: Formation) => void;
  setFormationMode: (mode: 'fixed' | 'custom') => void;

  playCupRound: () => void;
  simulateCupMatch: (matchId: string) => Match | null;
}

// ═══════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════

function createInitialState(): GameState & { useLiveEngine: boolean } {
  const { clubs, players } = generateGameData();
  const userClubId = Object.keys(clubs)[0];
  clubs[userClubId].isUser = true;

  const fixtures = generateFixtures(clubs, 1);
  const table = initTable(Object.keys(clubs));
  const cup = createCup(1, clubs);

  return {
    season: 1,
    currentWeek: 1,
    userClubId,
    clubs,
    players,
    fixtures,
    table,
    transferList: [],
    news: ['Yeni sezon başladı! Başarılar dileriz.', '🏆 Kupa başladı!'],
    seasonOver: false,
    training: { focus: 'balanced', intensity: 'normal' },
    userLineup: [],
    assistant: { ...DEFAULT_ASSISTANT },
    academy: { ...DEFAULT_ACADEMY },
    cup,
    useLiveEngine: false,
  };
}

// ═══════════════════════════════════════════════
export function getPersistedGameState(state: Store) {
  return {
    season: state.season,
    currentWeek: state.currentWeek,
    userClubId: state.userClubId,
    clubs: state.clubs,
    players: state.players,
    fixtures: state.fixtures.map(f => ({
      id: f.id,
      week: f.week,
      homeId: f.homeId,
      awayId: f.awayId,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      events: f.events,
      stats: f.stats,
      played: f.played,
      possession: f.possession,
      isCup: f.isCup,
      cupRound: f.cupRound,
      penalties: f.penalties,
      winnerId: f.winnerId,
    })),
    table: state.table,
    transferList: state.transferList,
    news: state.news,
    seasonOver: state.seasonOver,
    training: state.training,
    userLineup: state.userLineup,
    assistant: state.assistant,
    academy: state.academy,
    cup: state.cup,
    useLiveEngine: state.useLiveEngine,
  };
}

// INBOX YARDIMCILARI
// ═══════════════════════════════════════════════

function hasActiveInjuryMessage(playerName: string): boolean {
  const inbox = useInboxStore.getState();
  return inbox.messages.some(
    m =>
      m.category === 'INJURY' &&
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
  if (!isTransferWindowOpen(week)) return;
  if (Math.random() > 0.15) return;

  const inbox = useInboxStore.getState();

  const userSquad = Object.values(players).filter(
    p =>
      p.clubId === userClubId &&
      p.injuryWeeks === 0 &&
      p.suspensionWeeks === 0 &&
      p.squadRole !== 'u21'
  );

  const candidates = userSquad.filter(p => p.value > 500_000);
  if (candidates.length === 0) return;

  const target = candidates[Math.floor(Math.random() * candidates.length)];
  const otherClubs = Object.values(clubs).filter(c => c.id !== userClubId);
  if (otherClubs.length === 0) return;

  const biddingClub = otherClubs[Math.floor(Math.random() * otherClubs.length)];
  const offerAmount = Math.round(target.value * (1.1 + Math.random() * 0.5));

  const existingOffer = inbox.messages.some(
    m =>
      m.category === 'TRANSFER' &&
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

  const sorted = Object.values(table).sort(
    (a: any, b: any) => b.points - a.points
  );
  const userPos =
    sorted.findIndex((r: any) => r.clubId === userClubId) + 1;

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

      // ═══════════════════════════════════════════════
      // LIVE ENGINE FLAG
      // ═══════════════════════════════════════════════

      setUseLiveEngine: (value) => {
        set({ useLiveEngine: value });
      },

      newGame: () => {
        useInboxStore.getState().clearAll();
        set({ ...createInitialState(), pendingPressMatch: null });
      },

      setTactic: partial => {
        const state = get();
        const userClub = state.clubs[state.userClubId];
        if (!userClub) return;
        const updated: Club = {
          ...userClub,
          tactic: { ...userClub.tactic, ...partial },
        };
        if (partial.formation) updated.formation = partial.formation;
        set({
          clubs: { ...state.clubs, [state.userClubId]: updated },
        });
      },

      setLineup: lineup => set({ userLineup: lineup }),

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

      setAssistantSetting: (key, value) => {
        const state = get();
        const current = state.assistant ?? DEFAULT_ASSISTANT;
        set({
          assistant: { ...current, [key]: value },
        });
      },

      applyPressEffects: (moraleDelta, boardDelta) => {
        const state = get();
        const userClub = state.clubs[state.userClubId];
        if (!userClub) return;

        const newPlayers = { ...state.players };
        for (const id in newPlayers) {
          if (newPlayers[id].clubId === state.userClubId) {
            newPlayers[id] = {
              ...newPlayers[id],
              morale: Math.max(
                10,
                Math.min(100, newPlayers[id].morale + moraleDelta)
              ),
            };
          }
        }

        const newReputation = Math.max(
          1,
          Math.min(20, userClub.reputation + Math.floor(boardDelta / 2))
        );

        const news = [...state.news];
        if (moraleDelta > 0) {
          news.unshift(
            `🎙️ Basın toplantısı sonrası takım morali arttı (+${moraleDelta})`
          );
        } else if (moraleDelta < 0) {
          news.unshift(
            `🎙️ Basın toplantısı sonrası takım morali düştü (${moraleDelta})`
          );
        }

        set({
          players: newPlayers,
          clubs: {
            ...state.clubs,
            [state.userClubId]: {
              ...userClub,
              reputation: newReputation,
            },
          },
          news: news.slice(0, 30),
          pendingPressMatch: null,
        });
      },

      simulateAssistantPress: () => {
        const state = get();
        const moraleDelta = Math.floor((Math.random() - 0.5) * 6);
        const boardDelta = Math.floor((Math.random() - 0.5) * 3);

        get().applyPressEffects(moraleDelta, boardDelta);

        useInboxStore.getState().addMessage({
          season: state.season,
          week: state.currentWeek,
          sender: '👔 Yardımcı Menajer',
          title: 'Basın toplantısı raporu',
          content: `Basın toplantısına katıldım. Sonuç: ${
            moraleDelta > 0 ? '+' : ''
          }${moraleDelta} moral, ${boardDelta > 0 ? '+' : ''}${boardDelta} yönetim güveni.`,
          category: 'BOARD',
        });
      },

      clearPendingPress: () => set({ pendingPressMatch: null }),

      applyLiveMatchResult: (match) => {
        const state = get();
        if (match.played !== true) return;

        const fixtureIndex = state.fixtures.findIndex(m => m.id === match.id);
        if (fixtureIndex === -1) return;
        if (state.fixtures[fixtureIndex].played) return;

        const fixtures = [...state.fixtures];
        fixtures[fixtureIndex] = match;

        const table = { ...state.table };
        updateTable(table, match);

        const isUserMatch =
          match.homeId === state.userClubId ||
          match.awayId === state.userClubId;

        const news = [...state.news];
        if (isUserMatch) {
          const isHome = match.homeId === state.userClubId;
          const our = isHome ? match.homeScore : match.awayScore;
          const their = isHome ? match.awayScore : match.homeScore;
          const opponentId = isHome ? match.awayId : match.homeId;
          const opponent = opponentId ? state.clubs[opponentId] : undefined;
          const verdict = our > their ? 'Kazandık' : our < their ? 'Kaybettik' : 'Berabere';
          news.unshift(
            `Hafta ${match.week}: ${opponent?.shortName ?? 'Rakip'} karşısında ${our}-${their} — ${verdict}`
          );
        }

        set({
          fixtures,
          table,
          news: news.slice(0, 30),
        });

        // A manually completed live match closes the current week for the
        // user. Simulate the remaining fixtures and advance the game state
        // through the same canonical weekly transition used by Play Week.
        get().playWeek();
      },

      // ═══════════════════════════════════════════════
      // HAFTA OYNA
      // ═══════════════════════════════════════════════
      playWeek: () => {
        const state = get();
        if (state.seasonOver) return;

        const useLive = state.useLiveEngine;

        const isCupWeek = Object.values(CUP_WEEKS).includes(state.currentWeek);

        const newFixtures = [...state.fixtures];
        const newTable = { ...state.table };
        let newPlayers = { ...state.players };
        const news = [...state.news];
        let newCup = { ...state.cup };

        let userMatch: any = null;

        // ═══ LİG MAÇLARI ═══
        const weekMatches = state.fixtures.filter(
          m => m.week === state.currentWeek && !m.played
        );

        for (const m of weekMatches) {
          const home = state.clubs[m.homeId!];
          const away = state.clubs[m.awayId!];

          const lineup =
            m.homeId === state.userClubId || m.awayId === state.userClubId
              ? state.userLineup
              : undefined;

          const result = useLive
            ? simulateMatchLive(home, away, newPlayers, {
                week: m.week,
                userLineup: lineup,
                seed: createMatchSeed(
                  `${state.season}:${m.id ?? `${m.week}:${m.homeId}:${m.awayId}`}`,
                  m.week ?? state.currentWeek
                ),
              })
            : simulateMatch(
                home,
                away,
                newPlayers,
                m.week!,
                lineup
              );

          const idx = newFixtures.findIndex(x => x.id === m.id);
          newFixtures[idx] = result;
          updateTable(newTable, result);

          if (
            result.homeId === state.userClubId ||
            result.awayId === state.userClubId
          ) {
            const isHome = result.homeId === state.userClubId;
            const our = isHome ? result.homeScore : result.awayScore;
            const their = isHome ? result.awayScore : result.homeScore;
            const opponent = isHome ? away.shortName : home.shortName;
            const scoreStr = `${our}-${their}`;
            const verdict =
              our > their
                ? '🏆 Kazandık'
                : our < their
                ? '😞 Kaybettik'
                : '🤝 Berabere';
            news.unshift(
              `Hafta ${state.currentWeek}: ${opponent} karşısında ${scoreStr} — ${verdict}`
            );

            userMatch = {
              homeScore: result.homeScore,
              awayScore: result.awayScore,
              opponentName: isHome ? away.name : home.name,
              opponentId: isHome ? away.id : home.id,
              isHome,
            };

            const currentAssistant = state.assistant ?? DEFAULT_ASSISTANT;
            if (currentAssistant.matchAnalysis) {
              const analysis = analyzeMatch(
                result,
                state.userClubId,
                newPlayers
              );
              const analysisText = [
                analysis.summary,
                analysis.strengths.length > 0
                  ? `Güçlü: ${analysis.strengths.join(', ')}`
                  : '',
                analysis.weaknesses.length > 0
                  ? `Zayıf: ${analysis.weaknesses.join(', ')}`
                  : '',
              ]
                .filter(Boolean)
                .join('\n');

              useInboxStore.getState().addMessage({
                season: state.season,
                week: state.currentWeek,
                sender: '👔 Yardımcı Menajer',
                title: 'Maç Analizi',
                content: analysisText,
                category: 'MATCH',
              });
            }
          }
        }

        // ═══ KUPA MAÇLARI ═══
        if (isCupWeek && newCup.currentRound) {
          const round = newCup.currentRound;
          const roundMatchIds = newCup.rounds[round];
          const roundMatches = roundMatchIds
            .map(id => newCup.matches[id])
            .filter(Boolean)
            .filter(m => m.winnerId === null);

          for (const cupMatch of roundMatches) {
            const home = state.clubs[cupMatch.homeId];
            const away = state.clubs[cupMatch.awayId];

            const isUserMatch =
              cupMatch.homeId === state.userClubId ||
              cupMatch.awayId === state.userClubId;

            const lineup = isUserMatch ? state.userLineup : undefined;

            const result = useLive
              ? simulateMatchLive(home, away, newPlayers, {
                  week: state.currentWeek,
                  userLineup: lineup,
                  seed: createMatchSeed(
                `${state.season}:${cupMatch.id}`,
                state.currentWeek
              ),
                })
              : simulateMatch(
                  home,
                  away,
                  newPlayers,
                  state.currentWeek,
                  lineup
                );

            if (result.homeScore === result.awayScore) {
              const homeUnits = home.reputation;
              const awayUnits = away.reputation;
              const penalties = simulatePenalties(homeUnits, awayUnits);
              result.penalties = penalties;

              const winnerId = penalties.home > penalties.away
                ? cupMatch.homeId
                : cupMatch.awayId;

              news.unshift(
                `🏆 Kupa: ${home.shortName} ${result.homeScore}-${result.awayScore} ${away.shortName} (Pen: ${penalties.home}-${penalties.away}) → ${state.clubs[winnerId]?.shortName} tur atladı`
              );

              if (isUserMatch) {
                if (winnerId === state.userClubId) {
                  news.unshift(`🎉 Kupa'da tur atladın!`);
                } else {
                  news.unshift(`😞 Kupa'dan elendin.`);
                }
              }
            } else {
              const winnerId = result.homeScore > result.awayScore
                ? cupMatch.homeId
                : cupMatch.awayId;

              news.unshift(
                `🏆 Kupa: ${home.shortName} ${result.homeScore}-${result.awayScore} ${away.shortName} → ${state.clubs[winnerId]?.shortName} tur atladı`
              );

              if (isUserMatch) {
                if (winnerId === state.userClubId) {
                  news.unshift(`🎉 Kupa'da tur atladın!`);
                } else {
                  news.unshift(`😞 Kupa'dan elendin.`);
                }
              }
            }

            newCup = saveCupMatchResult(newCup, cupMatch.id, result);
          }

          newCup = advanceCupRound(newCup);

          if (newCup.champion) {
            const champion = state.clubs[newCup.champion];
            news.unshift(`🏆 ${champion?.name} KUPA ŞAMPİYONU!`);

            useInboxStore.getState().addMessage({
              season: state.season,
              week: state.currentWeek,
              sender: '🏆 Kupa Organizasyonu',
              title: `${champion?.name} Kupa Şampiyonu!`,
              content: `${champion?.name} bu sezonun kupa şampiyonu oldu! Tebrikler!`,
              category: 'AWARD',
            });
          }
        }

        // ═══ OYUNCU DURUMU ═══
        for (const id in newPlayers) {
          const p = { ...newPlayers[id] };
          p.condition = Math.max(
            40,
            p.condition - Math.floor(Math.random() * 15)
          );
          p.form = Math.max(
            20,
            Math.min(
              100,
              p.form + Math.round((Math.random() - 0.5) * 8)
            )
          );

          if (p.injuryWeeks > 0) {
            p.injuryWeeks = Math.max(0, p.injuryWeeks - 1);
            if (p.injuryWeeks === 0) {
              p.injuryType = null;
              p.injured = false;
              if (p.clubId === state.userClubId) {
                news.unshift(`💚 ${p.name} iyileşti, tekrar oynayabilir!`);
              }
            }
          }

          if (p.suspensionWeeks > 0) {
            p.suspensionWeeks = Math.max(0, p.suspensionWeeks - 1);
            if (p.suspensionWeeks === 0) {
              p.sentOff = false;
              p.redCard = false;
              if (p.clubId === state.userClubId) {
                news.unshift(`✅ ${p.name} cezasını tamamladı!`);
              }
            }
          }

          newPlayers[id] = p;
        }

        const currentAssistant = state.assistant ?? DEFAULT_ASSISTANT;
        let trainingToApply = state.training;

        if (currentAssistant.training) {
          const autoFocus = suggestTrainingFocus(
            newPlayers,
            state.userClubId
          );
          trainingToApply = { ...state.training, focus: autoFocus };
        }

        newPlayers = applyTrainingToSquad(
          newPlayers,
          state.userClubId,
          trainingToApply
        );

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
          cup: newCup,
        });

        addInjuryMessages(
          newPlayers,
          state.userClubId,
          state.season,
          state.currentWeek
        );
        maybeAddTransferOffer(
          newPlayers,
          state.clubs,
          state.userClubId,
          state.season,
          state.currentWeek
        );
        maybeAddBoardMessage(
          newTable,
          state.userClubId,
          state.season,
          state.currentWeek
        );
      },

      // ═══════════════════════════════════════════════
      // SEZON GEÇİŞİ
      // ═══════════════════════════════════════════════
      advanceSeason: () => {
        const state = get();

        let newPlayers = developPlayers(state.players);
        const contractResult = decrementContracts(newPlayers, state.userClubId);
        newPlayers = contractResult.updatedPlayers;
        newPlayers = replaceRetiredPlayers(newPlayers, state.clubs);

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
              cupAppearances: 0,
              cupGoals: 0,
              cupAssists: 0,
            };
          }
          newPlayers[id] = p;
        }

        const transferResult = aiTransferWindow(
          state.clubs,
          newPlayers,
          state.userClubId
        );
        newPlayers = transferResult.players;
        const newClubs = transferResult.clubs;

        const newAcademyIntakes = generateAllIntakes(newClubs);
        const newAcademy: AcademyState = {
          players: {
            ...state.academy.players,
            ...newAcademyIntakes,
          },
          lastIntakeSeason: state.season + 1,
        };

        const academyToRelease: AcademyPlayer[] = [];
        for (const id in newAcademy.players) {
          const p = newAcademy.players[id];
          const newAge = p.age + 1;

          if (newAge >= 20) {
            academyToRelease.push({ ...p, age: newAge });
            delete newAcademy.players[id];
          } else {
            newAcademy.players[id] = { ...p, age: newAge };
          }
        }

        const season = state.season + 1;
        const fixtures = generateFixtures(newClubs, season);
        const table = initTable(Object.keys(newClubs));
        const cup = createCup(season, newClubs);

        const news = [`🏆 Sezon ${season} başladı!`, ...state.news];

        if (contractResult.released.length > 0) {
          const userReleased = contractResult.released.filter(
            p => p.clubId === null
          );
          if (userReleased.length > 0) {
            news.unshift(
              `📋 ${userReleased.length} oyuncunun sözleşmesi bitti ve serbest kaldı`
            );
          }
        }

        if (contractResult.expiring.length > 0) {
          news.unshift(
            `⚠️ ${contractResult.expiring.length} oyuncunun sözleşmesi bu sezon bitiyor!`
          );
        }

        if (transferResult.log.length > 0) {
          news.unshift(
            `📨 Transfer sezonu: ${transferResult.log.length} transfer gerçekleşti`
          );
        }

        const userIntakeCount = Object.values(newAcademyIntakes).filter(
          p => p.clubId === state.userClubId
        ).length;

        if (userIntakeCount > 0) {
          news.unshift(`🎓 Akademiye ${userIntakeCount} yeni genç oyuncu katıldı`);
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
          academy: newAcademy,
          cup,
          pendingPressMatch: null,
        });

        useInboxStore.getState().addMessage({
          season,
          week: 1,
          sender: '📋 Lig Yönetimi',
          title: `🏆 Sezon ${season} Başladı!`,
          content: `Yeni sezon başladı. Başarılar dileriz!`,
          category: 'BOARD',
        });
      },

      // ═══════════════════════════════════════════════
      // TRANSFER AL
      // ═══════════════════════════════════════════════
      transferBuy: playerId => {
        const state = get();

        if (!isTransferWindowOpen(state.currentWeek)) {
          set({
            news: [
              `❌ Transfer dönemi kapalı! (${getTransferWindowName(
                state.currentWeek
              )})`,
              ...state.news,
            ].slice(0, 30),
          });
          return;
        }

        const player = state.players[playerId];
        const userClub = state.clubs[state.userClubId];
        if (!player || !userClub) return;

        if (userClub.budget < player.value) {
          set({
            news: ['❌ Bütçe yetersiz!', ...state.news].slice(0, 30),
          });
          return;
        }

        const updatedPlayer: Player = {
          ...player,
          clubId: state.userClubId,
          contractYears: 3,
          squadRole: player.overall >= 14 ? 'first' : player.overall >= 11 ? 'rotation' : 'backup',
        };
        const updatedClub: Club = {
          ...userClub,
          budget: userClub.budget - player.value,
        };

        set({
          players: { ...state.players, [playerId]: updatedPlayer },
          clubs: { ...state.clubs, [state.userClubId]: updatedClub },
          transferList: state.transferList.filter(id => id !== playerId),
          news: [
            `✅ ${player.name} transfer edildi!`,
            ...state.news,
          ].slice(0, 30),
        });

        useInboxStore.getState().addMessage({
          season: state.season,
          week: state.currentWeek,
          sender: '💰 Transfer Ofisi',
          title: `${player.name} transfer edildi`,
          content: `${player.name} £${(
            player.value / 1_000_000
          ).toFixed(2)}M karşılığında kadroya katıldı.`,
          category: 'TRANSFER',
        });
      },

      // ═══════════════════════════════════════════════
      // TRANSFER SAT
      // ═══════════════════════════════════════════════
      transferSell: (playerId, buyerClubId) => {
        const state = get();

        if (!isTransferWindowOpen(state.currentWeek)) {
          set({
            news: [
              `❌ Transfer dönemi kapalı! (${getTransferWindowName(
                state.currentWeek
              )})`,
              ...state.news,
            ].slice(0, 30),
          });
          return;
        }

        const player = state.players[playerId];
        const userClub = state.clubs[state.userClubId];
        if (
          !player ||
          player.clubId !== state.userClubId ||
          !userClub
        )
          return;

        let finalBuyerId: string | null = null;

        if (buyerClubId && state.clubs[buyerClubId]) {
          finalBuyerId = buyerClubId;
        } else {
          const otherClubs = Object.values(state.clubs).filter(
            c => c.id !== state.userClubId
          );
          if (otherClubs.length > 0) {
            const buyer =
              otherClubs[Math.floor(Math.random() * otherClubs.length)];
            finalBuyerId = buyer.id;
          }
        }

        if (!finalBuyerId) return;

        const buyerClubForValidation = state.clubs[finalBuyerId];
        if (!buyerClubForValidation || buyerClubForValidation.budget < player.value) {
          set({
            news: [
              '❌ Transfer gerçekleşmedi: alıcı kulübün bütçesi yetersiz.',
              ...state.news,
            ].slice(0, 30),
          });
          return;
        }

        const updatedPlayer: Player = {
          ...player,
          clubId: finalBuyerId,
        };

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
          news: [
            `💸 ${player.name} satıldı → ${
              buyerClub?.shortName ?? '???'
            } (+£${((player.value * 0.9) / 1_000_000).toFixed(2)}M)`,
            ...state.news,
          ].slice(0, 30),
        });

        useInboxStore.getState().addMessage({
          season: state.season,
          week: state.currentWeek,
          sender: '💰 Finans Departmanı',
          title: `${player.name} satıldı`,
          content: `${player.name} £${((player.value * 0.9) / 1_000_000).toFixed(
            2
          )}M karşılığında ${
            buyerClub?.name ?? 'başka bir kulübe'
          } satıldı. Bütçe güncellendi.`,
          category: 'FINANCE',
        });
      },

      // ═══════════════════════════════════════════════
      // ANTRENMAN
      // ═══════════════════════════════════════════════
      setTrainingFocus: focus => {
        const state = get();
        set({ training: { ...state.training, focus } });
      },

      setTrainingIntensity: intensity => {
        const state = get();
        set({ training: { ...state.training, intensity } });
      },

      // ═══════════════════════════════════════════════
      // AKADEMİ
      // ═══════════════════════════════════════════════

      promoteToFirstTeam: (playerId) => {
        const state = get();
        const academyPlayer = state.academy.players[playerId];
        if (!academyPlayer) return;

        const promoted: Player = {
          ...academyPlayer,
          clubId: state.userClubId,
          contractYears: 3,
          squadRole: academyPlayer.age <= 20 ? 'u21' : 'backup',
        };

        const newAcademyPlayers = { ...state.academy.players };
        delete newAcademyPlayers[playerId];

        set({
          players: { ...state.players, [promoted.id]: promoted },
          academy: {
            ...state.academy,
            players: newAcademyPlayers,
          },
          news: [
            `🌟 ${promoted.name} A takıma yükseltildi!`,
            ...state.news,
          ].slice(0, 30),
        });

        useInboxStore.getState().addMessage({
          season: state.season,
          week: state.currentWeek,
          sender: '🎓 Akademi',
          title: `${promoted.name} A takıma yükseltildi`,
          content: `${promoted.name} (${promoted.age} yaş, ${promoted.position}) akademiden A takıma yükseltildi. Potansiyel: ${academyPlayer.potentialStars}⭐`,
          category: 'BOARD',
        });
      },

      promoteAllSelected: (playerIds) => {
        const state = get();
        const newPlayers = { ...state.players };
        const newAcademyPlayers = { ...state.academy.players };
        const promoted: string[] = [];

        for (const id of playerIds) {
          const academyPlayer = newAcademyPlayers[id];
          if (!academyPlayer) continue;

          newPlayers[id] = {
            ...academyPlayer,
            clubId: state.userClubId,
            contractYears: 3,
            squadRole: academyPlayer.age <= 20 ? 'u21' : 'backup',
          };
          delete newAcademyPlayers[id];
          promoted.push(academyPlayer.name);
        }

        if (promoted.length === 0) return;

        set({
          players: newPlayers,
          academy: { ...state.academy, players: newAcademyPlayers },
          news: [
            `🌟 ${promoted.length} genç oyuncu A takıma yükseltildi`,
            ...state.news,
          ].slice(0, 30),
        });

        useInboxStore.getState().addMessage({
          season: state.season,
          week: state.currentWeek,
          sender: '🎓 Akademi',
          title: `${promoted.length} genç oyuncu A takıma alındı`,
          content: promoted.join(', '),
          category: 'BOARD',
        });
      },

      releaseFromAcademy: (playerId) => {
        const state = get();
        const academyPlayer = state.academy.players[playerId];
        if (!academyPlayer) return;

        const newAcademyPlayers = { ...state.academy.players };
        delete newAcademyPlayers[playerId];

        set({
          academy: { ...state.academy, players: newAcademyPlayers },
          news: [
            `❌ ${academyPlayer.name} akademiden serbest bırakıldı`,
            ...state.news,
          ].slice(0, 30),
        });
      },

      // ═══════════════════════════════════════════════
      // KADRO DIŞI (U21)
      // ═══════════════════════════════════════════════

      sendToReserves: (playerId) => {
        const state = get();
        const player = state.players[playerId];
        if (!player || player.clubId !== state.userClubId) return;

        set({
          players: {
            ...state.players,
            [playerId]: { ...player, squadRole: 'u21' },
          },
          news: [
            `📤 ${player.name} U21 takıma gönderildi`,
            ...state.news,
          ].slice(0, 30),
        });
      },

      sendAllSelectedToReserves: (playerIds) => {
        const state = get();
        const newPlayers = { ...state.players };
        const sent: string[] = [];

        for (const id of playerIds) {
          const player = newPlayers[id];
          if (!player || player.clubId !== state.userClubId) continue;

          newPlayers[id] = { ...player, squadRole: 'u21' };
          sent.push(player.name);
        }

        if (sent.length === 0) return;

        set({
          players: newPlayers,
          news: [
            `📤 ${sent.length} oyuncu U21 takıma gönderildi`,
            ...state.news,
          ].slice(0, 30),
        });
      },

      promoteFromReserves: (playerId) => {
        const state = get();
        const player = state.players[playerId];
        if (!player || player.clubId !== state.userClubId) return;

        set({
          players: {
            ...state.players,
            [playerId]: {
              ...player,
              squadRole: player.overall >= 14 ? 'first' : player.overall >= 11 ? 'rotation' : 'backup',
            },
          },
          news: [
            `📥 ${player.name} A takıma geri alındı`,
            ...state.news,
          ].slice(0, 30),
        });
      },

      // ═══════════════════════════════════════════════
      // SÖZLEŞME
      // ═══════════════════════════════════════════════

      renewContract: (playerId, offeredWage, offeredYears) => {
        const state = get();
        const player = state.players[playerId];
        if (!player) return { accepted: false, reason: 'Oyuncu bulunamadı' };

        const evaluation = evaluateContractOffer(player, offeredWage, offeredYears);

        if (evaluation.accepted) {
          const updated = applyContractRenewal(player, offeredWage, offeredYears);

          set({
            players: { ...state.players, [playerId]: updated },
            news: [
              `✍️ ${player.name} sözleşmesini yeniledi (${offeredYears} yıl, £${(offeredWage / 1_000).toFixed(0)}K/hafta)`,
              ...state.news,
            ].slice(0, 30),
          });

          useInboxStore.getState().addMessage({
            season: state.season,
            week: state.currentWeek,
            sender: '✍️ Sözleşme Departmanı',
            title: `${player.name} sözleşmesini yeniledi`,
            content: `${player.name} ${offeredYears} yıllık yeni sözleşmeye imza attı. Yeni maaş: £${(offeredWage / 1_000).toFixed(0)}K/hafta`,
            category: 'FINANCE',
          });
        } else {
          useInboxStore.getState().addMessage({
            season: state.season,
            week: state.currentWeek,
            sender: '✍️ Sözleşme Departmanı',
            title: `${player.name} teklifi reddetti`,
            content: `${player.name} sözleşme yenileme teklifini reddetti. Sebep: ${evaluation.reason}`,
            category: 'FINANCE',
          });
        }

        return evaluation;
      },

      // ═══════════════════════════════════════════════
      // ZONE-BASED
      // ═══════════════════════════════════════════════

      setZonePlayer: (zoneId, playerId) => {
        const state = get();
        const userClub = state.clubs[state.userClubId];
        if (!userClub) return;

        const custom = userClub.customFormation ?? createEmptyCustomFormation();

        if (playerId !== null) {
          const targetZone = custom.zones.find(z => z.id === zoneId);
          const isTargetEmpty = targetZone?.playerId === null;
          const filledCount = custom.zones.filter(z => z.playerId !== null).length;

          if (isTargetEmpty && filledCount >= MAX_PITCH_PLAYERS) {
            console.warn(`❌ Sahaya en fazla ${MAX_PITCH_PLAYERS} oyuncu koyabilirsin!`);
            return;
          }
        }

        let updatedZones = custom.zones.map(z => {
          if (playerId && z.playerId === playerId) {
            return { ...z, playerId: null };
          }
          return z;
        });

        updatedZones = updatedZones.map(z =>
          z.id === zoneId ? { ...z, playerId } : z
        );

        set({
          clubs: {
            ...state.clubs,
            [state.userClubId]: {
              ...userClub,
              formation: 'CUSTOM',
              tactic: { ...userClub.tactic, formation: 'CUSTOM' },
              customFormation: {
                ...custom,
                zones: updatedZones,
              },
            },
          },
        });
      },

      swapZones: (zoneIdA, zoneIdB) => {
        const state = get();
        const userClub = state.clubs[state.userClubId];
        if (!userClub || !userClub.customFormation) return;

        const zones = userClub.customFormation.zones;
        const zoneA = zones.find(z => z.id === zoneIdA);
        const zoneB = zones.find(z => z.id === zoneIdB);
        if (!zoneA || !zoneB) return;

        const updatedZones = zones.map(z => {
          if (z.id === zoneIdA) return { ...z, playerId: zoneB.playerId };
          if (z.id === zoneIdB) return { ...z, playerId: zoneA.playerId };
          return z;
        });

        set({
          clubs: {
            ...state.clubs,
            [state.userClubId]: {
              ...userClub,
              customFormation: {
                ...userClub.customFormation,
                zones: updatedZones,
              },
            },
          },
        });
      },

      clearZone: (zoneId) => {
        const state = get();
        const userClub = state.clubs[state.userClubId];
        if (!userClub || !userClub.customFormation) return;

        const updatedZones = userClub.customFormation.zones.map(z =>
          z.id === zoneId ? { ...z, playerId: null } : z
        );

        set({
          clubs: {
            ...state.clubs,
            [state.userClubId]: {
              ...userClub,
              customFormation: {
                ...userClub.customFormation,
                zones: updatedZones,
              },
            },
          },
        });
      },

      setZoneLabel: (zoneId, label) => {
        const state = get();
        const userClub = state.clubs[state.userClubId];
        if (!userClub || !userClub.customFormation) return;

        const updatedZones = userClub.customFormation.zones.map(z =>
          z.id === zoneId ? { ...z, customLabel: label } : z
        );

        set({
          clubs: {
            ...state.clubs,
            [state.userClubId]: {
              ...userClub,
              customFormation: {
                ...userClub.customFormation,
                zones: updatedZones,
              },
            },
          },
        });
      },

      resetZoneFormation: () => {
        const state = get();
        const userClub = state.clubs[state.userClubId];
        if (!userClub) return;

        set({
          clubs: {
            ...state.clubs,
            [state.userClubId]: {
              ...userClub,
              customFormation: undefined,
              formation: '4-4-2',
              tactic: { ...userClub.tactic, formation: '4-4-2' },
            },
          },
        });
      },

      autoFillZones: (formation) => {
        const state = get();
        const userClub = state.clubs[state.userClubId];
        if (!userClub) return;

        const custom = userClub.customFormation ?? createEmptyCustomFormation();

        let zones: PitchZone[] = custom.zones.map(z => ({ ...z, playerId: null }));

        const squad = Object.values(state.players).filter(
          p =>
            p.clubId === state.userClubId &&
            p.squadRole !== 'u21' &&
            p.injuryWeeks === 0 &&
            p.suspensionWeeks === 0
        );

        const mapping = getFormationZoneMapping(formation);
        const usedIds = new Set<string>();
        const usedZoneIds = new Set<string>();

        for (let i = 0; i < mapping.length && i < MAX_PITCH_PLAYERS; i++) {
          const { row, col } = mapping[i];
          const zone = findZoneByPosition(zones, row, col, usedZoneIds);
          if (!zone) continue;

          const zonePos = zone.suggestedPosition;

          let candidate = squad
            .filter(p => !usedIds.has(p.id))
            .filter(p => p.position === zonePos)
            .sort((a, b) => b.overall - a.overall)[0];

          if (!candidate) {
            candidate = squad
              .filter(p => !usedIds.has(p.id))
              .filter(p => p.secondaryPositions?.includes(zonePos))
              .sort((a, b) => b.overall - a.overall)[0];
          }

          if (!candidate) {
            candidate = squad
              .filter(p => !usedIds.has(p.id))
              .sort((a, b) => b.overall - a.overall)[0];
          }

          if (candidate) {
            zones = zones.map(z =>
              z.id === zone.id ? { ...z, playerId: candidate.id } : z
            );
            usedIds.add(candidate.id);
            usedZoneIds.add(zone.id);
          }
        }

        set({
          clubs: {
            ...state.clubs,
            [state.userClubId]: {
              ...userClub,
              formation: 'CUSTOM',
              tactic: { ...userClub.tactic, formation: 'CUSTOM' },
              customFormation: {
                ...custom,
                zones,
              },
            },
          },
        });
      },

      setFormationMode: (mode) => {
        const state = get();
        const userClub = state.clubs[state.userClubId];
        if (!userClub) return;

        if (mode === 'custom') {
          let custom = userClub.customFormation;

          if (!custom) {
            custom = createEmptyCustomFormation();
          }

          set({
            clubs: {
              ...state.clubs,
              [state.userClubId]: {
                ...userClub,
                formation: 'CUSTOM',
                tactic: { ...userClub.tactic, formation: 'CUSTOM' },
                customFormation: custom,
              },
            },
          });
        } else {
          set({
            clubs: {
              ...state.clubs,
              [state.userClubId]: {
                ...userClub,
                formation: '4-4-2',
                tactic: { ...userClub.tactic, formation: '4-4-2' },
              },
            },
          });
        }
      },

      // ═══════════════════════════════════════════════
      // KUPA
      // ═══════════════════════════════════════════════

      playCupRound: () => {
        const state = get();
        const isCupWeek = Object.values(CUP_WEEKS).includes(state.currentWeek);
        if (!isCupWeek) {
          console.warn('Bu hafta kupa maçı yok!');
          return;
        }
        get().playWeek();
      },

      simulateCupMatch: (matchId) => {
        const state = get();
        const cupMatch = state.cup.matches[matchId];
        if (!cupMatch || cupMatch.winnerId !== null) return null;

        const home = state.clubs[cupMatch.homeId];
        const away = state.clubs[cupMatch.awayId];
        if (!home || !away) return null;

        const playersCopy = { ...state.players };

        const isUserMatch =
          cupMatch.homeId === state.userClubId ||
          cupMatch.awayId === state.userClubId;

        const lineup = isUserMatch ? state.userLineup : undefined;

        const result = state.useLiveEngine
          ? simulateMatchLive(home, away, playersCopy, {
              week: state.currentWeek,
              userLineup: lineup,
              seed: createMatchSeed(
              `${state.season}:${cupMatch.id}`,
              state.currentWeek
            ),
            })
          : simulateMatch(
              home,
              away,
              playersCopy,
              state.currentWeek,
              lineup
            );

        if (result.homeScore === result.awayScore) {
          const homeUnits = home.reputation;
          const awayUnits = away.reputation;
          result.penalties = simulatePenalties(
            homeUnits,
            awayUnits,
            createMatchSeed(`cup:${state.season}:${cupMatch.id}`, state.currentWeek)
          );
        }

        const newCup = saveCupMatchResult(state.cup, matchId, result);

        set({
          players: playersCopy,
          cup: newCup,
        });

        return result;
      },
    }),
    {
      name: 'fm-clone-save',

      partialize: getPersistedGameState,

      merge: (persistedState: any, currentState: Store) => {
        const merged = { ...currentState, ...persistedState };

        if (!merged.assistant) {
          merged.assistant = { ...DEFAULT_ASSISTANT };
        }

        if (!merged.userLineup) {
          merged.userLineup = [];
        }

        if (!merged.training) {
          merged.training = { focus: 'balanced', intensity: 'normal' };
        }

        if (!merged.academy) {
          merged.academy = { ...DEFAULT_ACADEMY };
        }

        if (!merged.cup) {
          merged.cup = createEmptyCup();
        }

        if (merged.useLiveEngine === undefined) {
          merged.useLiveEngine = false;
        }

        for (const id in merged.players) {
          const p = merged.players[id];
          if (p.contractYears === undefined) {
            merged.players[id] = {
              ...p,
              contractYears: 1 + Math.floor(Math.random() * 4),
              squadRole: p.overall >= 14 ? 'first' : p.overall >= 11 ? 'rotation' : 'backup',
            };
          }
          if (p.careerStats && p.careerStats.cupAppearances === undefined) {
            merged.players[id] = {
              ...merged.players[id],
              careerStats: {
                ...p.careerStats,
                cupAppearances: 0,
                cupGoals: 0,
                cupAssists: 0,
              },
            };
          }
        }

        return merged;
      },
    }
  )
);