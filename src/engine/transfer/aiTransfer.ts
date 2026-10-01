// src/engine/transfer/aiTransfer.ts

import type { Club, Player, Position } from '../types';
import { scorePlayer } from '../data/generateData';

// ═══════════════════════════════════════════════
// AI TRANSFER WINDOW
// ═══════════════════════════════════════════════

interface TransferResult {
  players: Record<string, Player>;
  clubs: Record<string, Club>;
  log: string[];
}

/**
 * Her sezon başında AI takımlar arası transfer yapar.
 * AI takımlar zayıf mevkilerini güçlendirir.
 */
export function aiTransferWindow(
  clubs: Record<string, Club>,
  players: Record<string, Player>,
  userClubId: string
): TransferResult {
  const newPlayers = { ...players };
  const newClubs = { ...clubs };
  const log: string[] = [];

  // AI takımları al (kullanıcı hariç)
  const aiClubs = Object.values(newClubs).filter(c => c.id !== userClubId);

  // Her AI takım için 1-2 transfer yap
  for (const club of aiClubs) {
    const transfers = Math.random() < 0.5 ? 1 : Math.random() < 0.8 ? 2 : 0;
    if (transfers === 0) continue;

    const clubBudget = newClubs[club.id].budget;

    for (let i = 0; i < transfers; i++) {
      // Takımın zayıf mevkisini bul
      const weakPosition = findWeakestPosition(club, newPlayers);

      // Transfer hedefi bul
      const target = findTransferTarget(
        weakPosition,
        club.id,
        newPlayers,
        newClubs,
        clubBudget
      );

      if (!target) continue;

      // Bütçe kontrolü
      if (target.player.value > clubBudget) continue;

      // Transfer yap
      const sellerClubId = target.player.clubId;
      if (!sellerClubId) continue;

      // Oyuncuyu satıcıdan al, alıcıya ver
      newPlayers[target.player.id] = {
        ...target.player,
        clubId: club.id,
      };

      // Bütçeleri güncelle
      newClubs[club.id] = {
        ...newClubs[club.id],
        budget: newClubs[club.id].budget - target.player.value,
      };
      if (newClubs[sellerClubId]) {
        newClubs[sellerClubId] = {
          ...newClubs[sellerClubId],
          budget: newClubs[sellerClubId].budget + Math.round(target.player.value * 0.9),
        };
      }

      log.push(
        `${club.shortName}, ${target.player.name} (${target.player.position}) transfer etti — £${(target.player.value / 1_000_000).toFixed(2)}M`
      );
    }
  }

  return { players: newPlayers, clubs: newClubs, log };
}

// ═══════════════════════════════════════════════
// ZAYIF MEVKİ BUL
// ═══════════════════════════════════════════════

function findWeakestPosition(
  club: Club,
  players: Record<string, Player>
): Position {
  const squad = Object.values(players).filter(p => p.clubId === club.id);

  // Mevki grupları
  const groups: Record<string, { positions: Position[]; players: Player[] }> = {
    'GK': { positions: ['GK'], players: squad.filter(p => p.position === 'GK') },
    'DEF': { positions: ['DC', 'DL', 'DR'], players: squad.filter(p => ['DC', 'DL', 'DR'].includes(p.position)) },
    'MID': { positions: ['DMC', 'MC', 'ML', 'MR'], players: squad.filter(p => ['DMC', 'MC', 'ML', 'MR'].includes(p.position)) },
    'ATT': { positions: ['AMC', 'AML', 'AMR', 'ST'], players: squad.filter(p => ['AMC', 'AML', 'AMR', 'ST'].includes(p.position)) },
  };

  // Her grubun ortalama reytingini hesapla
  const groupScores: { group: string; avg: number; count: number }[] = [];

  for (const [groupName, group] of Object.entries(groups)) {
    if (group.players.length === 0) {
      groupScores.push({ group: groupName, avg: 0, count: 0 });
      continue;
    }

    const avg = group.players.reduce((sum, p) => sum + scorePlayer(p), 0) / group.players.length;
    groupScores.push({ group: groupName, avg, count: group.players.length });
  }

  // En zayıf grubu bul (count ve avg'a göre)
  groupScores.sort((a, b) => {
    // Önce oyuncu sayısı az olan (kadro eksik)
    if (a.count !== b.count) return a.count - b.count;
    // Sonra ortalama düşük olan
    return a.avg - b.avg;
  });

  const weakestGroup = groupScores[0].group;

  // Grubun en zayıf mevkisini bul
  const groupPositions = groups[weakestGroup].positions;

  // Kadrodaki her pozisyonun sayısını hesapla
  const posCounts: Record<string, number> = {};
  groupPositions.forEach(pos => {
    posCounts[pos] = squad.filter(p => p.position === pos).length;
  });

  // En az oyuncu olan mevkiyi seç
  const sorted = Object.entries(posCounts).sort((a, b) => a[1] - b[1]);
  return sorted[0][0] as Position;
}

// ═══════════════════════════════════════════════
// TRANSFER HEDEFİ BUL
// ═══════════════════════════════════════════════

function findTransferTarget(
  position: Position,
  buyerClubId: string,
  players: Record<string, Player>,
  clubs: Record<string, Club>,
  maxBudget: number
): { player: Player; seller: Club } | null {
  // Aynı mevkide, başka takımda, bütçeye uygun oyuncuları filtrele
  const candidates = Object.values(players).filter(p =>
    p.clubId !== null &&
    p.clubId !== buyerClubId &&
    p.position === position &&
    p.value <= maxBudget &&
    p.injuryWeeks === 0 &&
    p.suspensionWeeks === 0
  );

  if (candidates.length === 0) {
    // Tam mevki bulunamazsa, benzer mevkilerden ara
    const relatedPositions: Record<Position, Position[]> = {
      'GK': ['GK'],
      'DC': ['DC', 'DMC'],
      'DL': ['DL', 'ML'],
      'DR': ['DR', 'MR'],
      'DMC': ['DMC', 'MC'],
      'MC': ['MC', 'DMC', 'AMC'],
      'ML': ['ML', 'AML'],
      'MR': ['MR', 'AMR'],
      'AMC': ['AMC', 'MC', 'ST'],
      'AML': ['AML', 'ML', 'ST'],
      'AMR': ['AMR', 'MR', 'ST'],
      'ST': ['ST', 'AMC'],
    };

    const related = relatedPositions[position] ?? [position];
    const fallback = Object.values(players).filter(p =>
      p.clubId !== null &&
      p.clubId !== buyerClubId &&
      related.includes(p.position) &&
      p.value <= maxBudget &&
      p.injuryWeeks === 0 &&
      p.suspensionWeeks === 0
    );

    if (fallback.length === 0) return null;

    // En iyi 5 adaydan rastgele seç
    const sorted = fallback.sort((a, b) => scorePlayer(b) - scorePlayer(a)).slice(0, 5);
    const chosen = sorted[Math.floor(Math.random() * sorted.length)];
    const seller = clubs[chosen.clubId!];
    if (!seller) return null;

    return { player: chosen, seller };
  }

  // En iyi 5 adaydan rastgele seç
  const sorted = candidates.sort((a, b) => scorePlayer(b) - scorePlayer(a)).slice(0, 5);
  const chosen = sorted[Math.floor(Math.random() * sorted.length)];
  const seller = clubs[chosen.clubId!];
  if (!seller) return null;

  return { player: chosen, seller };
}