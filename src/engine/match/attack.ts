// src/engine/match/attack.ts

import type { Player, Attributes } from '../types';
import type { TeamMatchState } from './matchState';
import { eff } from './teamAnalysis';

// ═══════════════════════════════════════════════
// HÜCUM KARARI
// ═══════════════════════════════════════════════

export type AttackAction = 'pass' | 'dribble' | 'cross' | 'longShot' | 'counter' | 'hold';

export function chooseAction(
  attackingTeam: TeamMatchState,
  zone: string,
  player: Player
): AttackAction {
  const isWing = zone === 'leftAttack' || zone === 'rightAttack';
  const isCenter = zone === 'centerAttack';
  const isMidfield = zone.includes('Midfield');

  const directness = attackingTeam.directness;
  const width = attackingTeam.width;
  const tempo = attackingTeam.tempo;
  const mentality = attackingTeam.mentality;

  let weights = {
    pass: 0,
    dribble: 0,
    cross: 0,
    longShot: 0,
    counter: 0,
    hold: 0,
  };

  if (isWing) {
    weights.cross = 0.35;
    weights.dribble = 0.30;
    weights.pass = 0.20;
    weights.longShot = 0.05;
    weights.hold = 0.10;
  } else if (isCenter) {
    weights.pass = 0.35;
    weights.dribble = 0.25;
    weights.longShot = 0.20;
    weights.cross = 0.05;
    weights.hold = 0.15;
  } else if (isMidfield) {
    weights.pass = 0.55;
    weights.dribble = 0.20;
    weights.longShot = 0.05;
    weights.cross = 0.05;
    weights.hold = 0.15;
  }

  if (directness === 'direct') {
    weights.longShot += 0.10;
    weights.cross += 0.10;
    weights.pass -= 0.10;
  } else if (directness === 'short') {
    weights.pass += 0.10;
    weights.dribble += 0.05;
    weights.longShot -= 0.10;
  }

  if (width === 'wide') {
    weights.cross += 0.15;
    weights.dribble += 0.05;
    weights.pass -= 0.10;
  } else if (width === 'narrow') {
    weights.pass += 0.10;
    weights.dribble += 0.05;
    weights.cross -= 0.10;
  }

  if (tempo === 'fast') {
    weights.counter += 0.15;
    weights.dribble += 0.05;
    weights.hold -= 0.10;
  } else if (tempo === 'slow') {
    weights.pass += 0.10;
    weights.hold += 0.10;
    weights.counter -= 0.10;
  }

  if (mentality === 'attacking') {
    weights.longShot += 0.05;
    weights.cross += 0.05;
    weights.dribble += 0.05;
    weights.pass -= 0.10;
  } else if (mentality === 'defensive') {
    weights.pass += 0.15;
    weights.hold += 0.10;
    weights.longShot -= 0.10;
  }

  const playerCrossing = eff(player, 'crossing');
  const playerDribbling = eff(player, 'dribbling');
  const playerPassing = eff(player, 'passing');
  const playerShooting = eff(player, 'shooting');

  weights.cross *= (0.5 + playerCrossing / 100);
  weights.dribble *= (0.5 + playerDribbling / 100);
  weights.pass *= (0.5 + playerPassing / 100);
  weights.longShot *= (0.5 + playerShooting / 100);

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  const actions: AttackAction[] = ['pass', 'dribble', 'cross', 'longShot', 'counter', 'hold'];
  for (const action of actions) {
    r -= weights[action];
    if (r <= 0) return action;
  }
  return 'pass';
}

// ═══════════════════════════════════════════════
// AKSİYON BAŞARI OLASILIKLARI
// ═══════════════════════════════════════════════

export function passSuccessChance(
  passer: Player,
  defender: Player | null,
  zone: string,
  tempo: string
): number {
  const passing = eff(passer, 'passing');
  const vision = eff(passer, 'vision');
  const decisions = eff(passer, 'decisions');
  const technique = eff(passer, 'technique');
  const composure = eff(passer, 'composure');

  const defenderPress = defender ? eff(defender, 'tackling') : 40;
  const defenderAnticipation = defender ? eff(defender, 'anticipation') : 40;

  let base = 0.75;
  base += (passing - 50) * 0.003;
  base += (vision - 50) * 0.002;
  base += (decisions - 50) * 0.002;
  base += (technique - 50) * 0.001;
  base += (composure - 50) * 0.001;
  base -= (defenderPress - 50) * 0.003;
  base -= (defenderAnticipation - 50) * 0.002;

  if (tempo === 'fast') base -= 0.05;
  if (tempo === 'slow') base += 0.03;

  if (zone.includes('Attack')) base -= 0.05;
  if (zone.includes('Midfield')) base += 0.05;

  return clamp(base, 0.20, 0.95);
}

export function dribbleSuccessChance(
  dribbler: Player,
  defender: Player | null
): number {
  const dribbling = eff(dribbler, 'dribbling');
  const pace = eff(dribbler, 'pace');
  const agility = eff(dribbler, 'agility');
  const technique = eff(dribbler, 'technique');
  const balance = eff(dribbler, 'balance');

  const defenderMarking = defender ? eff(defender, 'marking') : 40;
  const defenderTackling = defender ? eff(defender, 'tackling') : 40;
  const defenderPace = defender ? eff(defender, 'pace') : 40;

  let attackPower = dribbling * 0.3 + pace * 0.2 + agility * 0.2 + technique * 0.2 + balance * 0.1;
  let defensePower = defenderMarking * 0.4 + defenderTackling * 0.4 + defenderPace * 0.2;

  let probability = 0.45 + (attackPower - defensePower) / 200;
  return clamp(probability, 0.15, 0.80);
}

export function crossSuccessChance(
  crosser: Player,
  defender: Player | null
): number {
  const crossing = eff(crosser, 'crossing');
  const technique = eff(crosser, 'technique');
  const vision = eff(crosser, 'vision');
  const decisions = eff(crosser, 'decisions');

  const defenderDefense = defender ? (eff(defender, 'marking') + eff(defender, 'heading')) / 2 : 40;

  const quality = crossing * 0.4 + technique * 0.25 + vision * 0.2 + decisions * 0.15;
  let probability = 0.40 + (quality - defenderDefense) / 220;
  return clamp(probability, 0.20, 0.75);
}

// ═══════════════════════════════════════════════
// OYUNCU SEÇİMİ
// ═══════════════════════════════════════════════

export function pickPasser(xi: Player[]): Player | null {
  const candidates = xi.filter(p =>
    ['MC', 'DMC', 'AMC', 'ML', 'MR'].includes(p.position)
  );
  if (candidates.length === 0) return xi[0] || null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function pickDribbler(xi: Player[], zone: string): Player | null {
  let positions: string[];
  if (zone === 'leftAttack') positions = ['AML', 'ML', 'ST', 'KFL'];
  else if (zone === 'rightAttack') positions = ['AMR', 'MR', 'ST', 'KFR'];
  else if (zone === 'centerAttack') positions = ['ST', 'AMC', 'GF'];
  else positions = ['AML', 'AMR', 'AMC', 'MC', 'KFL', 'KFR'];

  const candidates = xi.filter(p =>
    positions.includes(p.position) && p.position !== 'GK'
  );
  if (candidates.length === 0) {
    const nonGK = xi.filter(p => p.position !== 'GK');
    return nonGK[0] || null;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * 🎯 ŞUT ÇEKECEK OYUNCUYU SEÇ
 * - GK hariç
 * - Zone'a göre ağırlıklı + atribute bazlı
 */
export function pickShooter(xi: Player[], zone: string): Player | null {
  // 🎯 GK ASLA ŞUT ÇEKEMEZ
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
    zonePriority = {
      'MC': 5, 'AMC': 4, 'ML': 3, 'MR': 3, 'DMC': 2,
      'ST': 2, 'KFL': 2, 'KFR': 2, 'GF': 2,
    };
  }

  const candidates = outfieldPlayers.map(p => {
    const zoneWeight = zonePriority[p.position] ?? 0.3;

    const finishing = eff(p, 'finishing');
    const shooting = eff(p, 'shooting');
    const technique = eff(p, 'technique');
    const composure = eff(p, 'composure');

    const attrWeight =
      finishing * 0.45 +
      shooting * 0.25 +
      technique * 0.15 +
      composure * 0.15;

    const totalWeight = zoneWeight * (attrWeight / 50);

    return { player: p, weight: Math.max(0.05, totalWeight) };
  });

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
 */
export function pickScorer(xi: Player[], zone: string, shooter: Player): Player {
  // 🎯 GK ASLA GOL ATAMAZ
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

export function pickDefender(defendingXI: Player[], zone: string): Player | null {
  let positions: string[];
  if (zone === 'leftAttack') positions = ['DR', 'DC', 'DMC', 'WBR'];
  else if (zone === 'rightAttack') positions = ['DL', 'DC', 'DMC', 'WBL'];
  else positions = ['DC', 'DMC'];

  const candidates = defendingXI.filter(p => positions.includes(p.position));
  if (candidates.length === 0) return defendingXI[0] || null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}