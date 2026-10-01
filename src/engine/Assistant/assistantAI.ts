// src/engine/assistant/assistantAI.ts

import type { Player, TrainingFocus, Club } from '../types';
import { scorePlayer, getStartingXI } from '../data/generateData';

// ═══════════════════════════════════════════════
// ANTRENMAN ODAĞI ÖNERİSİ
// ═══════════════════════════════════════════════

/**
 * Kadroya göre en uygun antrenman odağını seçer.
 */
export function suggestTrainingFocus(
  players: Record<string, Player>,
  clubId: string
): TrainingFocus {
  const squad = Object.values(players).filter(
    p => p.clubId === clubId
  );

  if (squad.length === 0) return 'balanced';

  // Genç oyuncular (gelişim için)
  const youngPlayers = squad.filter(p => p.age <= 23);

  // Ortalama yaş
  const avgAge = squad.reduce((s, p) => s + p.age, 0) / squad.length;

  // Genç kadro → fiziksel (hız, dayanıklılık)
  if (avgAge < 23 || youngPlayers.length > squad.length * 0.5) {
    return 'physical';
  }

  // Yaşlı kadro → taktik (karar, vizyon)
  if (avgAge > 28) {
    return 'tactical';
  }

  // Dengeli → hücum/savunma arasında seç
  const attackPlayers = squad.filter(p =>
    ['ST', 'AMC', 'AML', 'AMR', 'ML', 'MR'].includes(p.position)
  );
  const defensePlayers = squad.filter(p =>
    ['DC', 'DL', 'DR', 'DMC'].includes(p.position)
  );

  // Hücumda daha çok genç varsa → hücum
  if (attackPlayers.length > defensePlayers.length) {
    return 'attack';
  }

  // Savunmada daha çok genç varsa → savunma
  if (defensePlayers.length > attackPlayers.length) {
    return 'defense';
  }

  return 'balanced';
}

// ═══════════════════════════════════════════════
// KADRO ÖNERİSİ
// ═══════════════════════════════════════════════

/**
 * En iyi 11'i önerir (formation'a göre).
 */
export function suggestLineup(
  club: Club,
  players: Record<string, Player>
): string[] {
  const xi = getStartingXI(
    club.id,
    players,
    club.tactic.formation
  );
  return xi.map(p => p.id);
}

// ═══════════════════════════════════════════════
// TRANSFER ÖNERİSİ
// ═══════════════════════════════════════════════

export interface TransferSuggestion {
  position: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Zayıf mevkileri analiz eder, transfer önerir.
 */
export function suggestTransfers(
  club: Club,
  players: Record<string, Player>
): TransferSuggestion[] {
  const squad = Object.values(players).filter(
    p => p.clubId === club.id
  );

  const suggestions: TransferSuggestion[] = [];

  const groups: {
    name: string;
    positions: string[];
    idealCount: number;
  }[] = [
    { name: 'Kaleci', positions: ['GK'], idealCount: 2 },
    { name: 'Stoper', positions: ['DC'], idealCount: 3 },
    { name: 'Bek', positions: ['DL', 'DR'], idealCount: 4 },
    { name: 'Defansif Orta Saha', positions: ['DMC'], idealCount: 2 },
    { name: 'Merkez Orta Saha', positions: ['MC'], idealCount: 3 },
    {
      name: 'Kanat',
      positions: ['ML', 'MR', 'AML', 'AMR'],
      idealCount: 4,
    },
    { name: 'Forvet', positions: ['ST'], idealCount: 2 },
  ];

  for (const group of groups) {
    const groupPlayers = squad.filter(p =>
      group.positions.includes(p.position)
    );

    // Oyuncu sayısı yetersiz
    if (groupPlayers.length < group.idealCount) {
      suggestions.push({
        position: group.name,
        reason: `${groupPlayers.length}/${group.idealCount} oyuncu — kadro eksik`,
        priority: groupPlayers.length === 0 ? 'high' : 'medium',
      });
      continue;
    }

    // Ortalama kalite düşük
    const avgScore =
      groupPlayers.reduce((s, p) => s + scorePlayer(p), 0) /
      groupPlayers.length;

    if (avgScore < 9) {
      suggestions.push({
        position: group.name,
        reason: `Ortalama reyting düşük (${avgScore.toFixed(1)}/20)`,
        priority: avgScore < 7 ? 'high' : 'medium',
      });
    }
  }

  // Öncelik sırasına göre sırala
  return suggestions.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });
}

// ═══════════════════════════════════════════════
// MAÇ ANALİZİ
// ═══════════════════════════════════════════════

export interface MatchAnalysis {
  summary: string;
  strengths: string[];
  weaknesses: string[];
}

/**
 * Maç sonrası analiz yapar.
 */
export function analyzeMatch(
  match: any,
  userClubId: string,
  _players: Record<string, Player>
): MatchAnalysis {
  const isHome = match.homeId === userClubId;
  const ourScore = isHome ? match.homeScore : match.awayScore;
  const theirScore = isHome ? match.awayScore : match.homeScore;

  const ourXG = isHome
    ? match.stats?.xG?.home
    : match.stats?.xG?.away;
  const theirXG = isHome
    ? match.stats?.xG?.away
    : match.stats?.xG?.home;

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  const result =
    ourScore > theirScore
      ? 'win'
      : ourScore < theirScore
      ? 'loss'
      : 'draw';

  let summary = '';
  if (result === 'win') summary = '🏆 Maçı kazandık!';
  else if (result === 'loss') summary = '😞 Maçı kaybettik.';
  else summary = '🤝 Berabere kaldık.';

  // xG analizi
  if (ourXG !== undefined && theirXG !== undefined) {
    if (ourXG > theirXG + 1) {
      strengths.push(
        `xG üstünlüğü (+${(ourXG - theirXG).toFixed(2)})`
      );
    } else if (theirXG > ourXG + 1) {
      weaknesses.push(
        `xG dezavantajı (${(theirXG - ourXG).toFixed(2)})`
      );
    }
  }

  // Topla oynama
  const ourPoss = isHome
    ? match.stats?.possession?.home
    : match.stats?.possession?.away;

  if (ourPoss !== undefined) {
    if (ourPoss > 60) strengths.push('Topa sahip olma üstünlüğü');
    if (ourPoss < 40) weaknesses.push('Topa sahip olma eksikliği');
  }

  // Şut verimliliği
  const ourShots = isHome
    ? match.stats?.shots?.home
    : match.stats?.shots?.away;
  const ourOnTarget = isHome
    ? match.stats?.onTarget?.home
    : match.stats?.onTarget?.away;

  if (
    ourShots !== undefined &&
    ourOnTarget !== undefined &&
    ourShots > 0
  ) {
    const conversion = ourOnTarget / ourShots;
    if (conversion > 0.5)
      strengths.push('İsabetli şut oranı yüksek');
    if (conversion < 0.25)
      weaknesses.push('İsabetli şut oranı düşük');
  }

  return { summary, strengths, weaknesses };
}