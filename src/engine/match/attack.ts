// src/engine/match/attack.ts

import type { Player, Attributes } from '../types';
import type { TeamMatchState } from './matchState';
import { eff } from './teamAnalysis';

// ═══════════════════════════════════════════════
// OYUNCU SEÇİMİ
// ═══════════════════════════════════════════════

/**
 * 🎯 ŞUT ÇEKECEK OYUNCUYU SEÇ
 * - GK hariç
 * - Zone'a göre ağırlıklı + atribute bazlı
 */
export function pickShooter(xi: Player[], zone: string): Player | null {
  // GK ASLA ŞUT ÇEKEMEZ
  const outfieldPlayers = xi.filter(p => p.position !== 'GK');
  if (outfieldPlayers.length === 0) return null;

  // Zone'a göre hangi pozisyonlar öncelikli
  let zonePriority: Record<string, number> = {};

  if (zone === 'leftAttack') {
    zonePriority = {
      'KFL': 10, 'ST': 8, 'GF': 7, 'AML': 6, 'AMC': 4,
      'ML': 3, 'MC': 2, 'MR': 1, 'WBL': 1,
    };
  } else if (zone === 'rightAttack') {
    zonePriority = {
      'KFR': 10, 'ST': 8, 'GF': 7, 'AMR': 6, 'AMC': 4,
      'MR': 3, 'MC': 2, 'ML': 1, 'WBR': 1,
    };
  } else if (zone === 'centerAttack') {
    zonePriority = {
      'ST': 10, 'GF': 9, 'AMC': 6, 'KFL': 5, 'KFR': 5,
      'MC': 3, 'ML': 2, 'MR': 2, 'DMC': 1, 'DC': 0.5,
    };
  } else {
    // midfield zones
    zonePriority = {
      'MC': 5, 'AMC': 4, 'ML': 3, 'MR': 3, 'DMC': 2,
      'ST': 2, 'KFL': 2, 'KFR': 2, 'GF': 2,
    };
  }

  // Kadrodaki oyuncuları ağırlıklandır
  const candidates = outfieldPlayers.map(p => {
    const zoneWeight = zonePriority[p.position] ?? 0.3;

    // Atribut bazlı ağırlık
    const finishing = eff(p, 'finishing');
    const shooting = eff(p, 'shooting');
    const technique = eff(p, 'technique');
    const composure = eff(p, 'composure');

    const attrWeight =
      finishing * 0.45 +
      shooting * 0.25 +
      technique * 0.15 +
      composure * 0.15;

    // Toplam ağırlık
    const totalWeight = zoneWeight * (attrWeight / 50);

    return { player: p, weight: Math.max(0.05, totalWeight) };
  });

  // Ağırlıklı rastgele seçim
  const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
  if (totalWeight <= 0) return candidates[0].player;

  let r = Math.random() * totalWeight;

  for (const c of candidates) {
    r -= c.weight;
    if (r <= 0) return c.player;
  }

  return candidates[candidates.length - 1].player;
}

/**
 * 🎯 GOL ATAN OYUNCUYU SEÇ
 * - GK hariç
 * - %70 ihtimalle şut çeken zaten golcü
 * - %30 ihtimalle kafa golü / deflection
 */
export function pickScorer(xi: Player[], zone: string, shooter: Player): Player {
  // GK ASLA GOL ATAMAZ
  const outfieldPlayers = xi.filter(p => p.position !== 'GK');
  if (outfieldPlayers.length === 0) return shooter;

  // %70 ihtimalle şut çeken zaten golcü
  if (Math.random() < 0.70) return shooter;

  // %30 ihtimalle başka biri (kafa golü, deflection vs.)
  let scorerPositions: string[] = [];

  if (zone === 'leftAttack' || zone === 'rightAttack') {
    scorerPositions = ['ST', 'GF', 'KFL', 'KFR', 'AMC', 'DC'];
  } else {
    scorerPositions = ['ST', 'GF', 'AMC', 'KFL', 'KFR'];
  }

  const candidates = outfieldPlayers.filter(
    p =>
      scorerPositions.includes(p.position) &&
      p.id !== shooter.id
  );

  if (candidates.length === 0) return shooter;

  const weights = candidates.map(p => {
    const finishing = eff(p, 'finishing');
    const heading = eff(p, 'heading');
    const offTheBall = eff(p, 'offTheBall');
    return Math.max(1, finishing * 0.5 + heading * 0.3 + offTheBall * 0.2);
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }

  return candidates[candidates.length - 1];
}

/**
 * 🎯 SAVUNMA OYUNCUSU SEÇ (attackSequence kullanıyor)
 */
export function pickDefender(defendingXI: Player[], zone: string): Player | null {
  let positions: string[];
  if (zone === 'leftAttack') positions = ['DR', 'DC', 'DMC', 'WBR'];
  else if (zone === 'rightAttack') positions = ['DL', 'DC', 'DMC', 'WBL'];
  else positions = ['DC', 'DMC'];

  const candidates = defendingXI.filter(p => positions.includes(p.position));
  if (candidates.length === 0) return defendingXI[0] || null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}