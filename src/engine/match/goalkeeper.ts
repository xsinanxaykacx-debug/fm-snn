// src/engine/match/goalkeeper.ts

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
  _defendingTeam: any
): ShotResult {
  const shooter = chance.shooter;

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

  const { goalProb: baseGoalProb } = applyGoalkeeper(goalkeeper, chance.xG);
  const gkEffect = baseGoalProb / chance.xG;

  let adjustedGoalProb = (chance.xG * gkEffect) / onTargetProb;
  adjustedGoalProb = Math.max(0.05, Math.min(0.95, adjustedGoalProb));

  const roll = Math.random();

  if (roll < adjustedGoalProb) {
    return {
      outcome: 'goal',
      onTarget: true,
      xG: chance.xG,
      description: `GOL! ${shooter.name}`,
    };
  } else if (roll < adjustedGoalProb + (1 - adjustedGoalProb) * 0.92) {
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