// src/engine/units/teamUnits.ts

import type { Club, Player, TeamUnits, UnitComparison } from '../types';

// ═══════════════════════════════════════════════
// 1-20 → 20-95 DÖNÜŞÜMÜ
// ═══════════════════════════════════════════════

function scaleToEngine(value: number): number {
  const clamped = Math.max(1, Math.min(20, value));
  return 20 + ((clamped - 1) / 19) * 75;
}

export function effectiveAttribute(
  player: Player,
  attrKey: keyof Player['attributes']
): number {
  const base = player.attributes[attrKey];
  const cond = player.condition / 100;
  const form = 0.85 + (player.form / 100) * 0.15;
  const morale = 0.90 + (player.morale / 100) * 0.10;

  // 🔧 1-20 → 20-95
  const scaled = scaleToEngine(base);

  return scaled * cond * form * morale;
}

// ═══════════════════════════════════════════════
// TAKIM BİRİMLERİ HESABI
// ═══════════════════════════════════════════════

const POSITION_GROUPS = {
  GK: ['GK'] as const,
  DEF: ['DC', 'DL', 'DR'] as const,
  MID: ['DMC', 'MC', 'ML', 'MR'] as const,
  ATT: ['AMC', 'AML', 'AMR', 'ST'] as const,
  WING: ['ML', 'MR', 'AML', 'AMR', 'DL', 'DR'] as const,
};

function getPlayersByPositions(
  players: Player[],
  positions: readonly string[]
): Player[] {
  return players.filter(p => positions.includes(p.position));
}

function weightedAvg(
  players: Player[],
  weights: Partial<Record<keyof Player['attributes'], number>>
): number {
  if (players.length === 0) return 40;

  let total = 0;
  let weightSum = 0;

  for (const player of players) {
    for (const [key, weight] of Object.entries(weights)) {
      if (!weight) continue;
      total += effectiveAttribute(player, key as keyof Player['attributes']) * weight;
      weightSum += weight;
    }
  }

  if (weightSum === 0) return 40;
  return total / (players.length * (weightSum / Object.keys(weights).length));
}

function unitRating(value: number): { color: string; label: string } {
  if (value >= 80) return { color: 'text-cyan-400', label: 'Dünya Klası' };
  if (value >= 70) return { color: 'text-green-400', label: 'Mükemmel' };
  if (value >= 60) return { color: 'text-yellow-400', label: 'İyi' };
  if (value >= 50) return { color: 'text-orange-400', label: 'Orta' };
  return { color: 'text-red-400', label: 'Zayıf' };
}

export { unitRating };

export function calculateTeamUnits(
  club: Club,
  players: Record<string, Player>
): TeamUnits {
  const squad = Object.values(players).filter(p => p.clubId === club.id);

  const defenders = getPlayersByPositions(squad, POSITION_GROUPS.DEF);
  const midfielders = getPlayersByPositions(squad, POSITION_GROUPS.MID);
  const attackers = getPlayersByPositions(squad, POSITION_GROUPS.ATT);
  const wingers = getPlayersByPositions(squad, POSITION_GROUPS.WING);
  const gks = getPlayersByPositions(squad, POSITION_GROUPS.GK);

  const attack = weightedAvg(attackers, {
    finishing: 0.30,
    shooting: 0.20,
    offTheBall: 0.20,
    composure: 0.15,
    technique: 0.15,
  });

  const midfield = weightedAvg(midfielders, {
    passing: 0.25,
    vision: 0.20,
    decisions: 0.20,
    technique: 0.15,
    workRate: 0.10,
    ballWinning: 0.10,
  });

  const defense = weightedAvg(defenders, {
    marking: 0.25,
    tackling: 0.25,
    defensivePositioning: 0.20,
    anticipation: 0.15,
    strength: 0.10,
    concentration: 0.05,
  });

  const wings = weightedAvg(wingers, {
    pace: 0.30,
    acceleration: 0.20,
    dribbling: 0.20,
    crossing: 0.20,
    agility: 0.10,
  });

  const transition = weightedAvg(
    [...attackers, ...wingers],
    {
      pace: 0.30,
      acceleration: 0.25,
      offTheBall: 0.20,
      decisions: 0.15,
      dribbling: 0.10,
    }
  );

  const goalkeeper = weightedAvg(gks, {
    reflexes: 0.30,
    gkPositioning: 0.25,
    handling: 0.20,
    oneOnOne: 0.15,
    aerialReach: 0.10,
  });

  const overall = (attack + midfield + defense + wings + transition + goalkeeper) / 6;

  return {
    attack: Math.round(attack * 10) / 10,
    midfield: Math.round(midfield * 10) / 10,
    defense: Math.round(defense * 10) / 10,
    wings: Math.round(wings * 10) / 10,
    transition: Math.round(transition * 10) / 10,
    goalkeeper: Math.round(goalkeeper * 10) / 10,
    overall: Math.round(overall * 10) / 10,
  };
}

export function compareUnits(
  home: TeamUnits,
  away: TeamUnits
): UnitComparison[] {
  const units: { key: keyof TeamUnits; label: string; icon: string }[] = [
    { key: 'attack', label: 'Hücum', icon: '⚔️' },
    { key: 'midfield', label: 'Orta Saha', icon: '🎯' },
    { key: 'defense', label: 'Savunma', icon: '🛡️' },
    { key: 'wings', label: 'Kanatlar', icon: '🏃' },
    { key: 'transition', label: 'Geçiş', icon: '⚡' },
    { key: 'goalkeeper', label: 'Kaleci', icon: '🧤' },
  ];

  return units.map(({ key, label, icon }) => {
    const homeValue = home[key] as number;
    const awayValue = away[key] as number;
    const total = homeValue + awayValue;
    const advantagePct = total > 0 ? (homeValue / total) * 100 : 50;

    let favored: 'home' | 'away' | 'neutral' = 'neutral';
    if (homeValue > awayValue + 2) favored = 'home';
    else if (awayValue > homeValue + 2) favored = 'away';

    return {
      unit: label,
      icon,
      homeValue,
      awayValue,
      favored,
      advantagePct,
    };
  });
}