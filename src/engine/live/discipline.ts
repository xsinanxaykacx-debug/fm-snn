// src/engine/live/discipline.ts

import type { LivePlayer, RngState } from '../types';
import { nextBool, nextIntRange } from './rng';

export type FoulCard = 'none' | 'yellow' | 'red';

export interface FoulDisciplineOutcome {
  card: FoulCard;
  secondYellow: boolean;
  injuryWeeks: number;
  injuryType: string | null;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function cardProbability(
  severity: 'light' | 'medium' | 'severe',
  aggression: number
): number {
  const base =
    severity === 'light' ? 0.18 :
    severity === 'medium' ? 0.55 :
    0.85;

  return clamp01(base + (Math.max(0, Math.min(20, aggression)) / 20) * 0.10);
}

function redProbability(
  severity: 'light' | 'medium' | 'severe',
  aggression: number
): number {
  if (severity !== 'severe') return 0;

  return clamp01(
    0.10 + (Math.max(0, Math.min(20, aggression)) / 20) * 0.12
  );
}

function injuryProbability(
  severity: 'light' | 'medium' | 'severe',
  victimStrength: number
): number {
  const base =
    severity === 'light' ? 0.025 :
    severity === 'medium' ? 0.08 :
    0.18;

  const fragility = 1 - Math.max(0, Math.min(20, victimStrength)) / 20;
  return clamp01(base + fragility * 0.04);
}

function injuryWeeksForSeverity(
  severity: 'light' | 'medium' | 'severe',
  rng: RngState
): number {
  if (severity === 'light') return nextIntRange(rng, 1, 3);
  if (severity === 'medium') return nextIntRange(rng, 1, 4);
  return nextIntRange(rng, 2, 7);
}

export function resolveFoulDiscipline(
  tackler: LivePlayer,
  ballCarrier: LivePlayer,
  severity: 'light' | 'medium' | 'severe',
  rng: RngState
): FoulDisciplineOutcome {
  const cardShown = nextBool(
    rng,
    cardProbability(severity, tackler.player.attributes.aggression)
  );

  let card: FoulCard = 'none';
  let secondYellow = false;

  if (cardShown) {
    const severeRed = nextBool(
      rng,
      redProbability(severity, tackler.player.attributes.aggression)
    );

    if (severeRed) {
      card = 'red';
    } else if (tackler.player.yellowCards >= 1) {
      card = 'red';
      secondYellow = true;
    } else {
      card = 'yellow';
    }
  }

  const injured = nextBool(
    rng,
    injuryProbability(
      severity,
      ballCarrier.player.attributes.strength
    )
  );

  if (!injured) {
    return {
      card,
      secondYellow,
      injuryWeeks: 0,
      injuryType: null,
    };
  }

  return {
    card,
    secondYellow,
    injuryWeeks: injuryWeeksForSeverity(severity, rng),
    injuryType:
      severity === 'severe'
        ? 'knock'
        : severity === 'medium'
          ? 'muscle'
          : 'minor',
  };
}
