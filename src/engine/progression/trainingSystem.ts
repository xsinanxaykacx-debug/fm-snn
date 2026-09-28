import type { Player, TrainingState, TrainingFocus, Attributes } from '../types';

/**
 * Antrenman odağına göre hangi 30 özellik gelişir
 */
const FOCUS_ATTRIBUTES: Record<TrainingFocus, Partial<Record<keyof Attributes, number>>> = {
  attack: {
    finishing: 1.0, shooting: 0.9, offTheBall: 0.8, firstTouch: 0.7,
    technique: 0.6, dribbling: 0.5, composure: 0.5, passing: 0.3,
  },
  defense: {
    marking: 1.0, tackling: 0.9, defensivePositioning: 0.9,
    ballWinning: 0.7, anticipation: 0.6, strength: 0.5, concentration: 0.4,
  },
  physical: {
    pace: 1.0, acceleration: 0.9, stamina: 0.9, strength: 0.8,
    agility: 0.7, balance: 0.5,
  },
  tactical: {
    decisions: 1.0, vision: 0.9, positioning: 0.8, anticipation: 0.8,
    teamwork: 0.7, concentration: 0.6, passing: 0.5,
  },
  balanced: {
    passing: 0.4, firstTouch: 0.4, dribbling: 0.4, shooting: 0.4,
    finishing: 0.4, technique: 0.4, heading: 0.4,
    decisions: 0.4, vision: 0.4, anticipation: 0.4, positioning: 0.4,
    offTheBall: 0.4, concentration: 0.4, composure: 0.4, workRate: 0.4,
    teamwork: 0.4, bravery: 0.4,
    pace: 0.4, acceleration: 0.4, agility: 0.4, stamina: 0.4, strength: 0.4, balance: 0.4,
    marking: 0.3, tackling: 0.3, ballWinning: 0.3, defensivePositioning: 0.3,
  },
};

const INTENSITY_MULT = {
  light: 0.6,
  normal: 1.0,
  intense: 1.3,
};

function ageMultiplier(age: number): number {
  if (age <= 20) return 1.3;
  if (age <= 23) return 1.0;
  if (age <= 26) return 0.6;
  if (age <= 28) return 0.15;
  if (age <= 31) return -0.1;
  return -0.35;
}

export function applyTraining(player: Player, training: TrainingState): Player {
  const focusAttrs = FOCUS_ATTRIBUTES[training.focus];
  const intensityMult = INTENSITY_MULT[training.intensity];
  const ageMult = ageMultiplier(player.age);

  const newAttrs = { ...player.attributes };
  let anyChange = false;

  for (const [key, weight] of Object.entries(focusAttrs) as [keyof Attributes, number][]) {
    const growthChance = 0.10 * weight * intensityMult * Math.max(0, ageMult);
    const declineChance = ageMult < 0 ? 0.12 * weight * Math.abs(ageMult) : 0;

    if (Math.random() < growthChance) {
      newAttrs[key] = Math.min(99, newAttrs[key] + 1);
      anyChange = true;
    } else if (Math.random() < declineChance) {
      newAttrs[key] = Math.max(5, newAttrs[key] - 1);
      anyChange = true;
    }
  }

  if (!anyChange) return player;

  // Yeni value hesapla
  const overall = computeOverall(newAttrs, player.position);
  const newValue = Math.round(overall * overall * 200 * Math.max(0.3, (30 - player.age) / 10));

  return {
    ...player,
    attributes: newAttrs,
    value: newValue,
  };
}

function computeOverall(attrs: Attributes, position: string): number {
  if (position === 'GK') {
    return attrs.reflexes * 0.25 + attrs.gkPositioning * 0.25 +
           attrs.handling * 0.20 + attrs.oneOnOne * 0.15 + attrs.aerialReach * 0.15;
  }
  const technical =
    attrs.passing * 0.15 + attrs.firstTouch * 0.10 + attrs.dribbling * 0.10 +
    attrs.crossing * 0.05 + attrs.shooting * 0.10 + attrs.finishing * 0.10 +
    attrs.technique * 0.10 + attrs.heading * 0.10 + attrs.setPieces * 0.05;
  const mental =
    attrs.decisions * 0.15 + attrs.vision * 0.10 + attrs.anticipation * 0.10 +
    attrs.positioning * 0.10 + attrs.offTheBall * 0.10 + attrs.concentration * 0.10 +
    attrs.composure * 0.10 + attrs.workRate * 0.10 + attrs.teamwork * 0.10 + attrs.bravery * 0.05;
  const physical =
    attrs.pace * 0.25 + attrs.acceleration * 0.20 + attrs.agility * 0.15 +
    attrs.stamina * 0.15 + attrs.strength * 0.15 + attrs.balance * 0.10;
  const defensive =
    attrs.marking * 0.30 + attrs.tackling * 0.30 +
    attrs.ballWinning * 0.20 + attrs.defensivePositioning * 0.20;
  return technical * 0.35 + mental * 0.30 + physical * 0.25 + defensive * 0.10;
}

export function applyTrainingToSquad(
  players: Record<string, Player>,
  clubId: string,
  training: TrainingState
): Record<string, Player> {
  const updated = { ...players };
  for (const id in updated) {
    if (updated[id].clubId === clubId) {
      updated[id] = applyTraining(updated[id], training);
    }
  }
  return updated;
}

export const FOCUS_INFO: Record<TrainingFocus, { label: string; icon: string; desc: string }> = {
  attack:   { label: 'Hücum',    icon: '⚔️', desc: 'Bitiricilik, şut, topsuz alan gelişir' },
  defense:  { label: 'Savunma',  icon: '🛡️', desc: 'Markaj, müdahale, pozisyon gelişir' },
  physical: { label: 'Fizik',    icon: '⚡', desc: 'Hız, ivme, dayanıklılık gelişir' },
  tactical: { label: 'Taktik',   icon: '🧠', desc: 'Karar, vizyon, pozisyon gelişir' },
  balanced: { label: 'Dengeli',  icon: '⚖️', desc: 'Tüm özellikler az gelişir' },
};

export const INTENSITY_INFO = {
  light:   { label: 'Hafif',   icon: '🌿', desc: 'Az gelişir, az yorar' },
  normal:  { label: 'Normal',  icon: '💪', desc: 'Dengeli gelişim' },
  intense: { label: 'Yoğun',   icon: '🔥', desc: 'Hızlı gelişir, çok yorar' },
};