// src/engine/progression/trainingSystem.ts

import type { Player, TrainingState, TrainingFocus } from '../types';
import { calculateValue } from './training';

// ═══════════════════════════════════════════════
// FOCUS BİLGİLERİ
// ═══════════════════════════════════════════════

export const FOCUS_INFO: Record<TrainingFocus, {
  icon: string;
  label: string;
  desc: string;
}> = {
  attack: {
    icon: '⚔️',
    label: 'Hücum',
    desc: 'Bitiricilik, şut, topsuz alan gelişir',
  },
  defense: {
    icon: '🛡️',
    label: 'Savunma',
    desc: 'Markaj, müdahale, pozisyon gelişir',
  },
  physical: {
    icon: '⚡',
    label: 'Fizik',
    desc: 'Hız, ivme, dayanıklılık gelişir',
  },
  tactical: {
    icon: '🧠',
    label: 'Taktik',
    desc: 'Karar, vizyon, pozisyon gelişir',
  },
  balanced: {
    icon: '⚖️',
    label: 'Dengeli',
    desc: 'Tüm özellikler az gelişir',
  },
};

export const INTENSITY_INFO: Record<'light' | 'normal' | 'intense', {
  icon: string;
  label: string;
  desc: string;
}> = {
  light: {
    icon: '🌱',
    label: 'Hafif',
    desc: 'Az gelişir, az yorar',
  },
  normal: {
    icon: '💪',
    label: 'Normal',
    desc: 'Dengeli gelişim',
  },
  intense: {
    icon: '🔥',
    label: 'Yoğun',
    desc: 'Hızlı gelişir, çok yorar',
  },
};

// ═══════════════════════════════════════════════
// ANTRENMAN UYGULAMA
// ═══════════════════════════════════════════════

function getIntensityMultiplier(intensity: 'light' | 'normal' | 'intense'): number {
  switch (intensity) {
    case 'light': return 0.5;
    case 'normal': return 1.0;
    case 'intense': return 1.8;
    default: return 1.0;
  }
}

function getFocusKeys(focus: TrainingFocus): (keyof Player['attributes'])[] {
  switch (focus) {
    case 'attack':
      return ['finishing', 'shooting', 'offTheBall', 'technique', 'composure', 'longShots'];
    case 'defense':
      return ['marking', 'tackling', 'defensivePositioning', 'anticipation', 'positioning', 'heading', 'ballWinning'];
    case 'physical':
      return ['pace', 'acceleration', 'stamina', 'strength', 'agility', 'balance'];
    case 'tactical':
      return ['decisions', 'vision', 'positioning', 'anticipation', 'concentration', 'teamwork'];
    case 'balanced':
      return ['passing', 'firstTouch', 'technique', 'decisions', 'composure'];
    default:
      return [];
  }
}

/**
 * Bir oyuncuya antrenman uygular.
 */
function applyTrainingToPlayer(
  player: Player,
  training: TrainingState
): Player {
  const focusKeys = getFocusKeys(training.focus);
  const intensityMultiplier = getIntensityMultiplier(training.intensity);

  // Genç oyuncular daha hızlı gelişir
  const ageMultiplier =
    player.age <= 21 ? 1.5 :
    player.age <= 24 ? 1.2 :
    player.age <= 27 ? 0.8 :
    player.age <= 30 ? 0.4 :
    player.age <= 33 ? 0.15 : 0.05;

  const newAttrs = { ...player.attributes };
  let anyChange = false;

  for (const key of focusKeys) {
    // Gelişim olasılığı (düşük)
    const developChance = 0.05 * intensityMultiplier * ageMultiplier;

    if (Math.random() < developChance) {
      const current = newAttrs[key];
      if (current < 20) {
        newAttrs[key] = Math.min(20, current + 1);
        anyChange = true;
      }
    }
  }

  if (!anyChange) return player;

  // 🔧 Overall ve value YENİ formülle
  const overall = computeOverallFromAttrs(newAttrs, player.position);
  const newValue = calculateValue(overall, player.age);

  return {
    ...player,
    attributes: newAttrs,
    overall,
    value: newValue,
    wage: Math.round(newValue / 500),
  };
}

/**
 * Attribute'lardan overall hesapla (1-20)
 */
function computeOverallFromAttrs(
  a: Player['attributes'],
  position: string
): number {
  let score: number;

  if (position === 'GK') {
    score = a.goalkeeper * 0.3 + a.reflexes * 0.25 + a.handling * 0.2 + a.oneOnOne * 0.15 + a.gkPositioning * 0.1;
  } else if (position === 'DC') {
    score = a.marking * 0.25 + a.tackling * 0.2 + a.defensivePositioning * 0.2 + a.anticipation * 0.15 + a.strength * 0.1 + a.heading * 0.1;
  } else if (position === 'DL' || position === 'DR') {
    score = a.marking * 0.2 + a.tackling * 0.2 + a.defensivePositioning * 0.15 + a.pace * 0.15 + a.acceleration * 0.1 + a.stamina * 0.1 + a.crossing * 0.1;
  } else if (position === 'DM') {
    score = a.passing * 0.2 + a.tackling * 0.2 + a.ballWinning * 0.15 + a.positioning * 0.15 + a.decisions * 0.15 + a.workRate * 0.15;
  } else if (position === 'MC') {
    score = a.passing * 0.25 + a.vision * 0.2 + a.decisions * 0.2 + a.technique * 0.15 + a.workRate * 0.1 + a.stamina * 0.1;
  } else if (position === 'ML' || position === 'MR') {
    score = a.pace * 0.25 + a.dribbling * 0.25 + a.crossing * 0.2 + a.acceleration * 0.15 + a.technique * 0.15;
  } else if (position === 'AML' || position === 'AMR') {
    score = a.pace * 0.25 + a.dribbling * 0.25 + a.crossing * 0.15 + a.finishing * 0.2 + a.offTheBall * 0.15;
  } else if (position === 'AMC') {
    score = a.passing * 0.2 + a.vision * 0.2 + a.technique * 0.2 + a.decisions * 0.15 + a.finishing * 0.15 + a.dribbling * 0.1;
  } else if (position === 'ST') {
    score = a.finishing * 0.3 + a.shooting * 0.2 + a.offTheBall * 0.2 + a.composure * 0.15 + a.technique * 0.15;
  } else {
    score = 10;
  }

  return Math.max(1, Math.min(20, Math.round(score)));
}

/**
 * Tüm kadroya antrenman uygular.
 */
export function applyTrainingToSquad(
  players: Record<string, Player>,
  userClubId: string,
  training: TrainingState
): Record<string, Player> {
  const newPlayers: Record<string, Player> = {};

  for (const id in players) {
    const p = players[id];
    if (p.clubId === userClubId) {
      newPlayers[id] = applyTrainingToPlayer(p, training);
    } else {
      newPlayers[id] = p;
    }
  }

  return newPlayers;
}