import type { Player, TrainingState, TrainingFocus, Attributes } from '../types';

const FOCUS_ATTRIBUTES: Record<TrainingFocus, Partial<Record<keyof Attributes, number>>> = {
  attack:   { shooting: 1.0, passing: 0.5, pace: 0.3 },
  defense:  { defending: 1.0, physical: 0.6, mental: 0.4 },
  physical: { pace: 1.0, physical: 0.8, mental: 0.2 },
  tactical: { mental: 1.0, passing: 0.7, defending: 0.4 },
  balanced: { pace: 0.3, passing: 0.3, shooting: 0.3, defending: 0.3, physical: 0.3, mental: 0.3, goalkeeping: 0.3 },
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
      newAttrs[key] = Math.min(20, newAttrs[key] + 1);
      anyChange = true;
    } else if (Math.random() < declineChance) {
      newAttrs[key] = Math.max(1, newAttrs[key] - 1);
      anyChange = true;
    }
  }

  if (!anyChange) return player;

  const overall =
    (newAttrs.pace + newAttrs.passing + newAttrs.shooting + newAttrs.defending +
     newAttrs.physical + newAttrs.mental + newAttrs.goalkeeping) / 7;
  const newValue = Math.round(
    overall * overall * 50_000 * Math.max(0.3, (30 - player.age) / 10)
  );

  return {
    ...player,
    attributes: newAttrs,
    value: newValue,
  };
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
  attack:   { label: 'Hücum',    icon: '⚔️', desc: 'Şut ve pas gelişir' },
  defense:  { label: 'Savunma',  icon: '🛡️', desc: 'Defans ve fizik gelişir' },
  physical: { label: 'Fizik',    icon: '⚡', desc: 'Hız ve fizik gelişir' },
  tactical: { label: 'Taktik',   icon: '🧠', desc: 'Mental ve pas gelişir' },
  balanced: { label: 'Dengeli',  icon: '⚖️', desc: 'Tüm özellikler az gelişir' },
};

export const INTENSITY_INFO = {
  light:   { label: 'Hafif',   icon: '🌿', desc: 'Az gelişir, az yorar' },
  normal:  { label: 'Normal',  icon: '💪', desc: 'Dengeli gelişim' },
  intense: { label: 'Yoğun',   icon: '🔥', desc: 'Hızlı gelişir, çok yorar' },
};