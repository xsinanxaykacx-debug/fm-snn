// src/engine/match/chance.ts

import type { Player, AttackSequence } from '../types';
import type { TeamMatchState } from './matchState';
import { eff } from './teamAnalysis';

export interface Chance {
  shooter: Player;
  distance: number;
  angle: number;
  pressure: number;
  type: 'open_play' | 'counter' | 'cross' | 'long_shot' | 'set_piece' | 'big_chance';
  xG: number;
  positionMultiplier: number;
  chanceQuality: number;
}

export function calculateChanceFromSequence(
  sequence: AttackSequence,
  shooter: Player,
  attackingTeam: TeamMatchState,
  defendingTeam: TeamMatchState
): Chance {
  const quality = Math.max(0, Math.min(100, sequence.chanceQuality));
  let distance = 25 - (quality / 100) * 19;

  if (sequence.finalZone === 'centerAttack') {
    distance = Math.max(6, distance - 3);
  } else if (sequence.finalZone === 'leftAttack' || sequence.finalZone === 'rightAttack') {
    distance = Math.max(8, distance);
  }

  distance = Math.max(5, Math.min(30, distance + (Math.random() - 0.5) * 4));

  let angle: number;
  if (sequence.finalZone === 'centerAttack') {
    angle = 45 + (quality / 100) * 60;
  } else {
    angle = 25 + (quality / 100) * 50;
  }
  angle = Math.max(15, Math.min(120, angle + (Math.random() - 0.5) * 15));

  const pressure = Math.max(10, Math.min(95, sequence.finalPressure));

  // eff() 20-95 döndürüyor (scaleToEngine sayesinde)
  const finishing = eff(shooter, 'finishing');
  const composure = eff(shooter, 'composure');
  const technique = eff(shooter, 'technique');

  let distanceFactor: number;
  if (distance <= 6) distanceFactor = 2.0;
  else if (distance <= 12) distanceFactor = 1.3;
  else if (distance <= 18) distanceFactor = 0.75;
  else if (distance <= 25) distanceFactor = 0.35;
  else distanceFactor = 0.15;

  // 🔧 FIX: xG tabanı 0.16 → 0.20 (xG/maç 2.20 → ~2.75 hedefi)
  let xg = 0.20 * distanceFactor;

  // eff() zaten 20-95 döndürüyor
  xg *= 0.7 + (finishing / 100) * 0.6;
  xg *= 0.8 + (composure / 100) * 0.4;
  xg *= 0.9 + (technique / 100) * 0.2;
  xg *= 1 - (pressure / 100) * 0.5;

  if (angle > 90) xg *= 0.7;
  else if (angle > 70) xg *= 0.9;
  else if (angle > 50) xg *= 1.0;
  else xg *= 1.15;

  let positionMultiplier = 1.0;
  let chanceType: Chance['type'] = 'open_play';

  if (sequence.finalZone === 'leftAttack' || sequence.finalZone === 'rightAttack') {
    positionMultiplier = 1.15;
    chanceType = 'cross';
  } else if (sequence.totalActions >= 4) {
    positionMultiplier = 1.2;
    chanceType = 'counter';
  } else if (distance > 20) {
    positionMultiplier = 0.7;
    chanceType = 'long_shot';
  }

  xg *= positionMultiplier;

  if (distance <= 10 && pressure < 50 && angle > 60) {
    xg *= 1.4;
    chanceType = 'big_chance';
  }

  return {
    shooter,
    distance: Math.round(distance * 10) / 10,
    angle: Math.round(angle),
    pressure: Math.round(pressure),
    type: chanceType,
    xG: Math.max(0.01, Math.min(0.95, xg)),
    positionMultiplier,
    chanceQuality: quality,
  };
}

export function applyGoalkeeper(
  gk: Player | null,
  xg: number
): { goalProb: number; saveProb: number } {
  if (!gk) {
    return {
      goalProb: xg * 1.15,
      saveProb: 1 - xg * 1.15,
    };
  }

  const reflexes = eff(gk, 'reflexes');
  const positioning = eff(gk, 'gkPositioning');
  const handling = eff(gk, 'handling');
  const oneOnOne = eff(gk, 'oneOnOne');

  // eff() 20-95 döndürüyor
  const gkRating =
    reflexes * 0.30 + positioning * 0.30 + handling * 0.20 + oneOnOne * 0.20;

  const gkFactor = 1.0 - (gkRating - 50) / 150;

  const adjustedXG = xg * gkFactor;

  return {
    goalProb: Math.max(0.01, Math.min(0.95, adjustedXG)),
    saveProb: 1 - Math.max(0.01, Math.min(0.95, adjustedXG)),
  };
}

export function onTargetProbability(shooter: Player, xg: number): number {
  const shooting = eff(shooter, 'shooting');
  const technique = eff(shooter, 'technique');
  const finishing = eff(shooter, 'finishing');

  // eff() 20-95 döndürüyor
  const quality = shooting * 0.4 + technique * 0.3 + finishing * 0.3;

  let prob = 0.48 + (quality - 50) / 280;
  prob += xg * 0.22;

  return Math.max(0.25, Math.min(0.88, prob));
}