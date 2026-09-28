import type { Player } from '../types';
import type { TeamMatchState } from './matchState';
import { eff } from './teamAnalysis';

// ═══════════════════════════════════════════════
// SAVUNMA TEPKİLERİ
// ═══════════════════════════════════════════════

/**
 * Pres başarısı (top kazanma)
 */
export function calculatePressChance(
  presser: Player,
  opponent: Player,
  defendingTeam: TeamMatchState
): number {
  const tackling = eff(presser, 'tackling');
  const marking = eff(presser, 'marking');
  const ballWinning = eff(presser, 'ballWinning');
  const workRate = eff(presser, 'workRate');

  const opponentControl = eff(opponent, 'firstTouch');
  const opponentComposure = eff(opponent, 'composure');
  const opponentDecisions = eff(opponent, 'decisions');

  const pressPower = tackling * 0.3 + marking * 0.3 + ballWinning * 0.2 + workRate * 0.2;
  const resistance = opponentControl * 0.4 + opponentComposure * 0.3 + opponentDecisions * 0.3;

  // Takım taktiği bonus
  let tacticBonus = 0;
  if (defendingTeam.pressing === 'high') tacticBonus = 8;
  else if (defendingTeam.pressing === 'low') tacticBonus = -5;

  let probability = 0.35 + (pressPower - resistance + tacticBonus) / 200;
  return clamp(probability, 0.10, 0.70);
}

/**
 * Markaj başarısı (çalım savunma)
 */
export function calculateMarkingChance(
  marker: Player,
  dribbler: Player
): number {
  const marking = eff(marker, 'marking');
  const tackling = eff(marker, 'tackling');
  const positioning = eff(marker, 'defensivePositioning');
  const pace = eff(marker, 'pace');

  const dribbling = eff(dribbler, 'dribbling');
  const agility = eff(dribbler, 'agility');
  const pace2 = eff(dribbler, 'pace');

  const markPower = marking * 0.35 + tackling * 0.30 + positioning * 0.20 + pace * 0.15;
  const dribblePower = dribbling * 0.40 + agility * 0.30 + pace2 * 0.30;

  let probability = 0.45 + (markPower - dribblePower) / 200;
  return clamp(probability, 0.15, 0.80);
}

/**
 * Top kesme (interception)
 */
export function calculateInterceptionChance(
  defender: Player,
  passQuality: number
): number {
  const anticipation = eff(defender, 'anticipation');
  const positioning = eff(defender, 'defensivePositioning');
  const marking = eff(defender, 'marking');

  const defensiveIQ = anticipation * 0.4 + positioning * 0.35 + marking * 0.25;

  let probability = 0.20 + (defensiveIQ - passQuality) / 250;
  return clamp(probability, 0.05, 0.50);
}

/**
 * Savunma tepkisi — aksiyon tipine göre
 */
export function resolveDefense(
  actionType: string,
  attacker: Player,
  defender: Player | null,
  attackingTeam: TeamMatchState,
  defendingTeam: TeamMatchState
): { success: boolean; turnover: boolean } {
  if (!defender) return { success: true, turnover: false };

  let defenseSuccess = 0;

  if (actionType === 'dribble') {
    defenseSuccess = calculateMarkingChance(defender, attacker);
  } else if (actionType === 'pass') {
    defenseSuccess = calculateInterceptionChance(defender, eff(attacker, 'passing'));
  } else if (actionType === 'cross') {
    // Orta savunma
    const heading = eff(defender, 'heading');
    const positioning = eff(defender, 'defensivePositioning');
    defenseSuccess = 0.30 + (heading + positioning - 100) / 400;
  } else if (actionType === 'longShot') {
    // Uzaktan şut savunma zor
    defenseSuccess = 0.10;
  }

  defenseSuccess = clamp(defenseSuccess, 0.05, 0.80);

  // Savunma başarılı mı?
  const defenseWon = Math.random() < defenseSuccess;

  if (defenseWon) {
    return { success: false, turnover: true };
  }

  return { success: true, turnover: false };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}