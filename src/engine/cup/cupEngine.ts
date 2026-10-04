// src/engine/cup/cupEngine.ts

import type { CupState, CupMatch, CupRound, Match, Club } from '../types';
import { createMatchSeed, createRng, nextBool, shuffleInPlace } from '../live';

// ═══════════════════════════════════════════════
// KUPA HAFTA TAKVİMİ
// ═══════════════════════════════════════════════

export const CUP_WEEKS: Record<CupRound, number> = {
  round1: 5,
  quarter: 11,
  semi: 17,
  final: 23,
};

export const CUP_ROUND_NAMES: Record<CupRound, string> = {
  round1: '1. Tur',
  quarter: 'Çeyrek Final',
  semi: 'Yarı Final',
  final: 'Final',
};

// ═══════════════════════════════════════════════
// KUPA OLUŞTUR
// ═══════════════════════════════════════════════

/**
 * Yeni sezon için kupa oluşturur.
 * 16 takımı rastgele eşler → 1. Tur
 */
export function createCup(
  season: number,
  clubs: Record<string, Club>
): CupState {
  const clubIds = Object.keys(clubs);

  if (clubIds.length < 16) {
    // 16'dan az takım varsa hata
    return {
      season,
      matches: {},
      currentRound: null,
      champion: null,
      rounds: { round1: [], quarter: [], semi: [], final: [] },
    };
  }

  // Seeded kura: aynı sezon + aynı kulüp kümesi → aynı eşleşmeler.
  const rng = createRng(createMatchSeed(`cup:${season}`, season));
  const participants = [...clubIds];
  shuffleInPlace(rng, participants);
  participants.length = 16;

  // 1. Tur eşleşmeleri (8 maç)
  const matches: Record<string, CupMatch> = {};
  const round1Ids: string[] = [];

  for (let i = 0; i < 8; i++) {
    const homeId = participants[i * 2];
    const awayId = participants[i * 2 + 1];

    const matchId = `cup_s${season}_r1_m${i}`;
    const cupMatch: CupMatch = {
      id: matchId,
      round: 'round1',
      homeId,
      awayId,
      match: null,
      winnerId: null,
    };

    matches[matchId] = cupMatch;
    round1Ids.push(matchId);
  }

  return {
    season,
    matches,
    currentRound: 'round1',
    champion: null,
    rounds: {
      round1: round1Ids,
      quarter: [],
      semi: [],
      final: [],
    },
  };
}

// ═══════════════════════════════════════════════
// KUPA MAÇI SONUCU KAYDET
// ═══════════════════════════════════════════════

/**
 * Oynanmış bir kupa maçının sonucunu kaydeder.
 */
export function saveCupMatchResult(
  cup: CupState,
  matchId: string,
  match: Match
): CupState {
  const cupMatch = cup.matches[matchId];
  if (!cupMatch) return cup;

  // Kazananı belirle
  let winnerId: string | null = null;
  if (match.penalties) {
    winnerId = match.penalties.home > match.penalties.away
      ? cupMatch.homeId
      : cupMatch.awayId;
  } else if (match.homeScore > match.awayScore) {
    winnerId = cupMatch.homeId;
  } else if (match.homeScore < match.awayScore) {
    winnerId = cupMatch.awayId;
  }

  const updatedMatch: CupMatch = {
    ...cupMatch,
    match: {
      ...match,
      isCup: true,
      cupRound: cupMatch.round,
      winnerId: winnerId ?? undefined,
    },
    winnerId,
  };

  return {
    ...cup,
    matches: {
      ...cup.matches,
      [matchId]: updatedMatch,
    },
  };
}

// ═══════════════════════════════════════════════
// SONRAKİ TURU OLUŞTUR
// ═══════════════════════════════════════════════

/**
 * Bir tur tamamlandığında sonraki turu oluşturur.
 * round1 → quarter
 * quarter → semi
 * semi → final
 * final → champion
 */
export function advanceCupRound(cup: CupState): CupState {
  const currentRound = cup.currentRound;
  if (!currentRound) return cup;

  // Mevcut turdaki maçları kontrol et
  const currentMatchIds = cup.rounds[currentRound];
  const currentMatches = currentMatchIds.map(id => cup.matches[id]).filter(Boolean);

  // Tüm maçlar oynandı mı?
  const allPlayed = currentMatches.every(m => m.winnerId !== null);
  if (!allPlayed) return cup;

  // Kazananları topla
  const winners = currentMatches.map(m => m.winnerId!).filter(Boolean);

  // Final ise → şampiyon belirle
  if (currentRound === 'final') {
    return {
      ...cup,
      champion: winners[0] ?? null,
      currentRound: null,
    };
  }

  // Sonraki tur
  const nextRound: CupRound =
    currentRound === 'round1' ? 'quarter' :
    currentRound === 'quarter' ? 'semi' :
    'final';

  const nextMatches: Record<string, CupMatch> = { ...cup.matches };
  const nextMatchIds: string[] = [];

  // Eşleştir (2'li gruplar)
  for (let i = 0; i < winners.length; i += 2) {
    const homeId = winners[i];
    const awayId = winners[i + 1];
    if (!homeId || !awayId) continue;

    const matchId = `cup_s${cup.season}_${nextRound}_m${i / 2}`;
    nextMatches[matchId] = {
      id: matchId,
      round: nextRound,
      homeId,
      awayId,
      match: null,
      winnerId: null,
    };
    nextMatchIds.push(matchId);
  }

  return {
    ...cup,
    matches: nextMatches,
    currentRound: nextRound,
    rounds: {
      ...cup.rounds,
      [nextRound]: nextMatchIds,
    },
  };
}

// ═══════════════════════════════════════════════
// PENALTI ATIŞLARI (Beraberlik için)
// ═══════════════════════════════════════════════

export function simulatePenalties(
  homeStrength: number,
  awayStrength: number,
  seed = createMatchSeed(`penalties:${homeStrength}:${awayStrength}`, 0)
): { home: number; away: number } {
  // 5'er penaltı
  const rng = createRng(seed);
  let home = 0;
  let away = 0;

  // Ev sahibi avantajı
  const homeAdv = 0.05;

  for (let i = 0; i < 5; i++) {
    const homeProb = 0.75 + homeAdv;
    const awayProb = 0.75;

    if (nextBool(rng, homeProb)) home++;
    if (nextBool(rng, awayProb)) away++;
  }

  // Beraberlik → sudden death
  let round = 0;
  while (home === away && round < 10) {
    const homeScored = nextBool(rng, 0.75 + homeAdv);
    const awayScored = nextBool(rng, 0.75);

    if (homeScored) home++;
    if (awayScored) away++;

    // İkisi de kaçırdıysa devam
    if (!homeScored && !awayScored) continue;

    round++;
  }

  // Hâlâ berabere → güce göre
  if (home === away) {
    if (homeStrength > awayStrength) home++;
    else away++;
  }

  return { home, away };
}

// ═══════════════════════════════════════════════
// KUPA ÖZET
// ═══════════════════════════════════════════════

export interface CupSummary {
  season: number;
  currentRound: CupRound | null;
  champion: string | null;
  totalMatches: number;
  playedMatches: number;
  userAlive: boolean;
  userNextMatch: CupMatch | null;
}

export function getCupSummary(
  cup: CupState,
  userClubId: string
): CupSummary {
  const allMatches = Object.values(cup.matches);
  const played = allMatches.filter(m => m.winnerId !== null);

  // Kullanıcı hâlâ kupada mı?
  const userAlive = allMatches.some(
    m => m.winnerId === userClubId ||
      (m.winnerId === null && (m.homeId === userClubId || m.awayId === userClubId))
  );

  // Kullanıcının sıradaki maçı
  const userNextMatch = allMatches.find(
    m =>
      m.winnerId === null &&
      (m.homeId === userClubId || m.awayId === userClubId)
  ) ?? null;

  return {
    season: cup.season,
    currentRound: cup.currentRound,
    champion: cup.champion,
    totalMatches: allMatches.length,
    playedMatches: played.length,
    userAlive,
    userNextMatch,
  };
}