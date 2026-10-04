// src/engine/match/attack.ts

import type { Player } from '../types';
import { eff } from './teamAnalysis';
import type { MatchRng } from './rng';

// ═══════════════════════════════════════════════
// SAVUNMACI SEÇİMİ
// ═══════════════════════════════════════════════

export function pickDefender(defendXI: Player[], zone: string, rng: MatchRng = Math.random): Player | null {
  let positions: string[];

  if (zone.includes('Defense')) {
    positions = ['ST', 'GF', 'KFL', 'KFR', 'AMC', 'AML', 'AMR'];
  } else if (zone.includes('Midfield')) {
    if (zone === 'centerMidfield') positions = ['MC', 'DMC', 'AMC'];
    else if (zone === 'leftMidfield') positions = ['MC', 'ML', 'MR', 'DMC'];
    else positions = ['MC', 'MR', 'ML', 'DMC'];
  } else if (zone === 'centerAttack') {
    positions = ['DC', 'DMC', 'DL', 'DR'];
  } else if (zone === 'leftAttack') {
    positions = ['DC', 'DL', 'DMC', 'DR'];
  } else {
    positions = ['DC', 'DR', 'DMC', 'DL'];
  }

  const candidates = defendXI.filter(p => positions.includes(p.position));
  if (candidates.length === 0) {
    return defendXI.length > 0 ? defendXI[Math.floor(rng() * defendXI.length)] : null;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ═══════════════════════════════════════════════
// ŞUTÖR SEÇİMİ
// ═══════════════════════════════════════════════

export function pickShooter(attackXI: Player[], zone: string, rng: MatchRng = Math.random): Player | null {
  let positions: string[];

  if (zone.includes('Attack')) {
    positions = ['ST', 'GF', 'KFL', 'KFR', 'AMC', 'AML', 'AMR'];
  } else if (zone.includes('Midfield')) {
    positions = ['AMC', 'MC', 'AML', 'AMR', 'ST'];
  } else {
    positions = ['ST', 'AMC', 'MC'];
  }

  const candidates = attackXI.filter(p => positions.includes(p.position));
  if (candidates.length === 0) return null;

  // Forvetler daha olası şut çeker
  const weighted = candidates.map(p => {
    const isStriker = ['ST', 'GF', 'KFL', 'KFR'].includes(p.position);
    const isAm = ['AMC', 'AML', 'AMR'].includes(p.position);
    const isMid = ['MC', 'ML', 'MR'].includes(p.position);
    const base = isStriker ? 3 : isAm ? 2 : isMid ? 1 : 0.5;
    const finishing = eff(p, 'finishing');
    return base * (0.5 + finishing / 100);
  });

  const total = weighted.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weighted[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// ═══════════════════════════════════════════════
// GOLCÜ SEÇİMİ
// ═══════════════════════════════════════════════

export function pickScorer(attackXI: Player[], _zone: string, shooter: Player, rng: MatchRng = Math.random): Player {
  // Şutör zaten en olası golcü
  if (Math.random() < 0.6) return shooter;

  const candidates = attackXI.filter(p =>
    p.id !== shooter.id &&
    p.position !== 'GK' &&
    ['ST', 'GF', 'KFL', 'KFR', 'AMC', 'AML', 'AMR', 'MC'].includes(p.position)
  );

  if (candidates.length === 0) return shooter;

  const weighted = candidates.map(p => {
    const finishing = eff(p, 'finishing');
    const offTheBall = eff(p, 'offTheBall');
    const isStriker = ['ST', 'GF', 'KFL', 'KFR'].includes(p.position);
    const base = isStriker ? 2 : 1;
    return base * (finishing * 0.5 + offTheBall * 0.5) / 50;
  });

  const total = weighted.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weighted[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}