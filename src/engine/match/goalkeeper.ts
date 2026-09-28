import type { Player } from '../types';
import type { Chance } from './chance';
import { applyGoalkeeper, onTargetProbability } from './chance';
import { eff } from './teamAnalysis';

export interface ShotResult {
  outcome: 'goal' | 'save' | 'miss' | 'blocked';
  onTarget: boolean;
  xG: number;
  description: string;
}

export function resolveShot(
  chance: Chance,
  goalkeeper: Player | null,
  defendingTeam: any
): ShotResult {
  const shooter = chance.shooter;

  // 1. KALEYİ BULMA
  const onTargetProb = onTargetProbability(shooter, chance.xG);
  const onTarget = Math.random() < onTargetProb;

  if (!onTarget) {
    return {
      outcome: 'miss',
      onTarget: false,
      xG: chance.xG,
      description: `${shooter.name} şutu auta gitti`,
    };
  }

  // 2. KALECİ (kaleci xG'yi etkiler)
  const { goalProb: baseGoalProb } = applyGoalkeeper(goalkeeper, chance.xG);

  // 3. DÜZELTME: Toplam gol olasılığı = xG olmalı
  // Kaleyi bulma olasılığı düşükse, kaleyi bulduktan sonra gol olasılığı yüksek olmalı
  // Formül: adjustedGoal = xG / onTargetProb (min 0.05, max 0.95)
  let adjustedGoalProb = chance.xG / onTargetProb;

  // Kaleci etkisini de ekle (baseGoalProb / xG oranı)
  const gkEffect = baseGoalProb / chance.xG;
  adjustedGoalProb = adjustedGoalProb * gkEffect;

  adjustedGoalProb = Math.max(0.05, Math.min(0.95, adjustedGoalProb));

  // 4. SONUÇ
  const roll = Math.random();

  if (roll < adjustedGoalProb) {
    return {
      outcome: 'goal',
      onTarget: true,
      xG: chance.xG,
      description: `GOL! ${shooter.name}`,
    };
  } else if (roll < adjustedGoalProb + (1 - adjustedGoalProb) * 0.7) {
    return {
      outcome: 'save',
      onTarget: true,
      xG: chance.xG,
      description: `${shooter.name} şutunu ${goalkeeper?.name ?? 'kaleci'} kurtardı`,
    };
  } else {
    return {
      outcome: 'blocked',
      onTarget: true,
      xG: chance.xG,
      description: `${shooter.name} şutu savunmaya çarptı`,
    };
  }
}

export function handleCrossChance(
  goalkeeper: Player | null,
  crossQuality: number
): boolean {
  if (!goalkeeper) return Math.random() < 0.5;

  const aerialReach = eff(goalkeeper, 'aerialReach');
  const handling = eff(goalkeeper, 'handling');
  const positioning = eff(goalkeeper, 'gkPositioning');

  const gkPower = aerialReach * 0.4 + handling * 0.35 + positioning * 0.25;

  const catchProb = 0.5 + (gkPower - crossQuality) / 200;
  return Math.random() < Math.max(0.20, Math.min(0.85, catchProb));
}