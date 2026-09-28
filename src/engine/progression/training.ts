import type { Player, Attributes } from '../types';

/**
 * Sezon sonu gelişim/yaşlanma
 */
export function developPlayers(players: Record<string, Player>): Record<string, Player> {
  const updated: Record<string, Player> = {};

  for (const id in players) {
    const p = { ...players[id] };
    const a = { ...p.attributes };

    const ageFactor =
      p.age < 22 ? 1.2 :
      p.age < 25 ? 0.8 :
      p.age < 28 ? 0.4 :
      p.age < 31 ? 0.1 : -0.5;

    const keys: (keyof Attributes)[] = [
      'passing', 'firstTouch', 'dribbling', 'crossing', 'shooting', 'finishing',
      'technique', 'heading', 'setPieces',
      'decisions', 'vision', 'anticipation', 'positioning', 'offTheBall',
      'concentration', 'composure', 'workRate', 'teamwork', 'bravery',
      'pace', 'acceleration', 'agility', 'stamina', 'strength', 'balance',
      'marking', 'tackling', 'ballWinning', 'defensivePositioning',
      'reflexes', 'gkPositioning', 'handling', 'oneOnOne', 'aerialReach',
    ];

    for (const k of keys) {
      if (Math.random() < 0.25) {
        const change = ageFactor > 0
          ? (Math.random() < ageFactor ? 1 : 0)
          : (Math.random() < -ageFactor ? -1 : 0);
        a[k] = Math.max(5, Math.min(99, a[k] + change));
      }
    }

    p.attributes = a;
    p.age += 1;

    // Overall ve value güncelle
    const overall = computeOverall(a, p.position);
    p.value = Math.round(overall * overall * 200 * Math.max(0.3, (30 - p.age) / 10));
    p.wage = Math.round(overall * 100);

    // Kondisyon ve form resetle
    p.condition = 100;
    p.form = Math.max(30, Math.min(100, p.form + Math.round((Math.random() - 0.4) * 15)));
    p.morale = Math.max(30, Math.min(100, p.morale + Math.round((Math.random() - 0.4) * 10)));

    updated[id] = p;
  }

  return updated;
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