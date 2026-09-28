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

  // ═══════════════════════════════════════════════
  // 1. xG = P(gol) — kaleci etkisiyle
  // ═══════════════════════════════════════════════

  const { goalProb } = applyGoalkeeper(goalkeeper, chance.xG);

  // ═══════════════════════════════════════════════
  // 2. İsabetli olma olasılığı (bağımsız)
  // ═══════════════════════════════════════════════

  const onTargetProb = onTargetProbability(shooter, chance.xG);

  // ═══════════════════════════════════════════════
  // 3. Tek zar atışıyla sonuç
  // ═══════════════════════════════════════════════

  const roll = Math.random();

  // a) GOL
  if (roll < goalProb) {
    return {
      outcome: 'goal',
      onTarget: true,
      xG: chance.xG,
      description: `GOL! ${shooter.name}`,
    };
  }

  // b) İsabetli ama gol değil → save veya blocked
  const saveZone = goalProb + (1 - goalProb) * onTargetProb * 0.65;
  const blockZone = goalProb + (1 - goalProb) * onTargetProb;

  if (roll < saveZone) {
    return {
      outcome: 'save',
      onTarget: true,
      xG: chance.xG,
      description: `${shooter.name} şutunu ${goalkeeper?.name ?? 'kaleci'} kurtardı`,
    };
  }

  if (roll < blockZone) {
    return {
      outcome: 'blocked',
      onTarget: true,
      xG: chance.xG,
      description: `${shooter.name} şutu savunmaya çarptı`,
    };
  }

  // c) İsabetsiz → miss
  return {
    outcome: 'miss',
    onTarget: false,
    xG: chance.xG,
    description: `${shooter.name} şutu auta gitti`,
  };
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