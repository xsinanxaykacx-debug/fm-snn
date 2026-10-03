// src/engine/league/awards.ts

import type { GameState, Player, Club } from '../types';

export interface Award {
  id: string;
  icon: string;
  label: string;
  description: string;
  winnerId: string | null;
  winnerName: string;
  clubId: string | null;
  clubName: string;
  value: number;
  valueLabel: string;
}

// ═══════════════════════════════════════════════
// SEZON SONU ÖDÜLLERİ
// ═══════════════════════════════════════════════

export function calculateSeasonAwards(state: GameState): Award[] {
  const awards: Award[] = [];
  const allPlayers = Object.values(state.players).filter(p => p.clubId !== null);

  // Yardımcı: kulüp adı
  const clubName = (clubId: string | null): string => {
    if (!clubId) return '—';
    return state.clubs[clubId]?.name ?? '—';
  };

  // ═══ 1. ALTIN KRAMPON — En çok gol ═══
  const topScorer = allPlayers
    .filter(p => (p.careerStats?.seasonGoals ?? 0) > 0)
    .sort((a, b) => (b.careerStats?.seasonGoals ?? 0) - (a.careerStats?.seasonGoals ?? 0))[0];

  awards.push({
    id: 'golden_boot',
    icon: '🥇',
    label: 'Altın Krampon',
    description: 'Sezonun en çok gol atan oyuncusu',
    winnerId: topScorer?.id ?? null,
    winnerName: topScorer?.name ?? '—',
    clubId: topScorer?.clubId ?? null,
    clubName: clubName(topScorer?.clubId ?? null),
    value: topScorer?.careerStats?.seasonGoals ?? 0,
    valueLabel: 'gol',
  });

  // ═══ 2. EN ÇOK ASİST ═══
  const topAssister = allPlayers
    .filter(p => (p.careerStats?.seasonAssists ?? 0) > 0)
    .sort((a, b) => (b.careerStats?.seasonAssists ?? 0) - (a.careerStats?.seasonAssists ?? 0))[0];

  awards.push({
    id: 'top_assist',
    icon: '🎯',
    label: 'En Çok Asist',
    description: 'Sezonun en çok asist yapan oyuncusu',
    winnerId: topAssister?.id ?? null,
    winnerName: topAssister?.name ?? '—',
    clubId: topAssister?.clubId ?? null,
    clubName: clubName(topAssister?.clubId ?? null),
    value: topAssister?.careerStats?.seasonAssists ?? 0,
    valueLabel: 'asist',
  });

  // ═══ 3. SEZONUN OYUNCUSU — En yüksek MVP ═══
  const topMVP = allPlayers
    .filter(p => (p.careerStats?.seasonMotm ?? 0) > 0)
    .sort((a, b) => (b.careerStats?.seasonMotm ?? 0) - (a.careerStats?.seasonMotm ?? 0))[0];

  awards.push({
    id: 'mvp',
    icon: '🏆',
    label: 'Sezonun Oyuncusu',
    description: 'Sezonun en çok maçın adamı seçilen oyuncusu',
    winnerId: topMVP?.id ?? null,
    winnerName: topMVP?.name ?? '—',
    clubId: topMVP?.clubId ?? null,
    clubName: clubName(topMVP?.clubId ?? null),
    value: topMVP?.careerStats?.seasonMotm ?? 0,
    valueLabel: 'MVP',
  });

  // ═══ 4. EN İYİ REYTİNG — En yüksek ortalama (min 10 maç) ═══
  const topRated = allPlayers
    .filter(p =>
      (p.careerStats?.seasonAppearances ?? 0) >= 10 &&
      (p.careerStats?.seasonAvgRating ?? 0) > 0
    )
    .sort((a, b) => (b.careerStats?.seasonAvgRating ?? 0) - (a.careerStats?.seasonAvgRating ?? 0))[0];

  awards.push({
    id: 'best_rating',
    icon: '⭐',
    label: 'En İyi Reyting',
    description: 'Sezonun en yüksek ortalama reytinge sahip oyuncusu',
    winnerId: topRated?.id ?? null,
    winnerName: topRated?.name ?? '—',
    clubId: topRated?.clubId ?? null,
    clubName: clubName(topRated?.clubId ?? null),
    value: topRated?.careerStats?.seasonAvgRating ?? 0,
    valueLabel: 'ortalama',
  });

  // ═══ 5. EN İYİ GENÇ — 23 yaş altı, en az 3 maç ═══
  const bestYoung = allPlayers
    .filter(p =>
      p.age <= 23 &&
      (p.careerStats?.seasonAppearances ?? 0) >= 3 &&
      (p.careerStats?.seasonAvgRating ?? 0) > 0
    )
  .sort((a, b) => {
    // Önce reyting, sonra yaş (genç olan önce)
    const ratingDiff = (b.careerStats?.seasonAvgRating ?? 0) - (a.careerStats?.seasonAvgRating ?? 0);
    if (Math.abs(ratingDiff) > 0.1) return ratingDiff;
    return a.age - b.age;
  })[0];
awards.push({
  id: 'best_young',
  icon: '🌟',
  label: 'En İyi Genç',
  description: '23 yaş altı en iyi performans gösteren oyuncu',
  winnerId: bestYoung?.id ?? null,
  winnerName: bestYoung?.name ?? '—',
  clubId: bestYoung?.clubId ?? null,
  clubName: clubName(bestYoung?.clubId ?? null),
  value: bestYoung?.careerStats?.seasonAvgRating ?? 0,
  valueLabel: 'ortalama',
});

  // ═══ 6. ALTIN ELDİVEN — En iyi kaleci (reyting bazlı) ═══
  const bestGK = allPlayers
    .filter(p =>
      p.position === 'GK' &&
      (p.careerStats?.seasonAppearances ?? 0) >= 10 &&
      (p.careerStats?.seasonAvgRating ?? 0) > 0
    )
    .sort((a, b) => (b.careerStats?.seasonAvgRating ?? 0) - (a.careerStats?.seasonAvgRating ?? 0))[0];

  awards.push({
    id: 'golden_glove',
    icon: '🧤',
    label: 'Altın Eldiven',
    description: 'Sezonun en iyi performans gösteren kalecisi',
    winnerId: bestGK?.id ?? null,
    winnerName: bestGK?.name ?? '—',
    clubId: bestGK?.clubId ?? null,
    clubName: clubName(bestGK?.clubId ?? null),
    value: bestGK?.careerStats?.seasonAvgRating ?? 0,
    valueLabel: 'ortalama',
  });

  // ═══ 7. YILIN MENAJERİ — En yüksek puanlı takımın menajeri ═══
  // (Kullanıcı takımı en yüksek puanlıysa o kazanır)
  const sortedTable = Object.values(state.table).sort((a, b) => b.points - a.points);
  const champion = sortedTable[0];
  const championClub = champion ? state.clubs[champion.clubId] : null;

  awards.push({
    id: 'manager_of_the_year',
    icon: '👔',
    label: 'Yılın Menajeri',
    description: 'Sezonun en başarılı takımının menajeri',
    winnerId: championClub?.isUser ? state.userClubId : champion?.clubId ?? null,
    winnerName: championClub?.name ?? '—',
    clubId: champion?.clubId ?? null,
    clubName: championClub?.name ?? '—',
    value: champion?.points ?? 0,
    valueLabel: 'puan',
  });

  return awards;
}

// ═══════════════════════════════════════════════
// ŞAMPİYON BİLGİSİ
// ═══════════════════════════════════════════════

export interface SeasonSummary {
  season: number;
  champion: Club | null;
  championPoints: number;
  userPosition: number;
  userPoints: number;
  userIsChampion: boolean;
  topScorer: Player | null;
  relegation: Club[];
}

export function calculateSeasonSummary(state: GameState): SeasonSummary {
  const sortedTable = Object.values(state.table).sort((a, b) => b.points - a.points);
  const championRow = sortedTable[0];
  const champion = championRow ? state.clubs[championRow.clubId] : null;

  const userPos = sortedTable.findIndex(r => r.clubId === state.userClubId) + 1;
  const userRow = sortedTable.find(r => r.clubId === state.userClubId);

  const allPlayers = Object.values(state.players);
  const topScorer = allPlayers
    .filter(p => (p.careerStats?.seasonGoals ?? 0) > 0)
    .sort((a, b) => (b.careerStats?.seasonGoals ?? 0) - (a.careerStats?.seasonGoals ?? 0))[0] ?? null;

  // Son 3 takım düşme
  const relegation = sortedTable.slice(-3).map(r => state.clubs[r.clubId]).filter(Boolean);

  return {
    season: state.season,
    champion,
    championPoints: championRow?.points ?? 0,
    userPosition: userPos,
    userPoints: userRow?.points ?? 0,
    userIsChampion: championRow?.clubId === state.userClubId,
    topScorer,
    relegation,
  };
}