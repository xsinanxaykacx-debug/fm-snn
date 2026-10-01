// src/engine/live/actionResolution.ts
//
// OFM'deki action-resolution yaklaşımının bu motor için yeniden yazılmış,
// 2D fizik ile uyumlu versiyonu.
//
// ÖNEMLİ:
// - Zone sistemi YOK.
// - Top fiziğini değiştirmez.
// - Karar üretmez.
// - Sadece seçilmiş aksiyonun kalitesini/başarı olasılığını hesaplar.
// - Kod OpenFootManager'dan kopyalanmamıştır; aynı problem için bağımsız
//   bir TypeScript çözümüdür.

import type {
  Decision,
  LiveMatchState,
  LivePlayer,
  Tactic,
  Vec2,
} from '../types';

export interface ActionResolution {
  probability: number;
  quality: number;
  pressure: number;
  defenderId: string | null;
}

export interface ShotResolution extends ActionResolution {
  xG: number;
  goalkeeperSkill: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function avg(...values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function conditionFactor(player: LivePlayer): number {
  // OFM yaklaşımındaki temel fikir:
  // yorgun oyuncu yeteneğini tamamen kaybetmez, fakat etkinliği düşer.
  const condition = clamp(player.player.condition, 0, 100);
  const fatigue = clamp(player.player.fatigue, 0, 100);

  const conditionFactor = 0.60 + 0.40 * (condition / 100);
  const fatiguePenalty = 1 - fatigue / 100 * 0.18;

  return conditionFactor * fatiguePenalty;
}

function mentalityModifier(mentality: Tactic['mentality'], attacking: boolean): number {
  if (attacking) {
    if (mentality === 'attacking') return 1.06;
    if (mentality === 'defensive') return 0.94;
    return 1;
  }

  if (mentality === 'defensive') return 1.06;
  if (mentality === 'attacking') return 0.94;
  return 1;
}

function pressingModifier(pressing: Tactic['pressing']): number {
  switch (pressing) {
    case 'high': return 1.12;
    case 'low': return 0.90;
    default: return 1;
  }
}

function tempoModifier(tempo: Tactic['tempo']): number {
  switch (tempo) {
    case 'fast': return 1.05;
    case 'slow': return 0.96;
    default: return 1;
  }
}

function defensiveLineModifier(line: Tactic['defensiveLine']): number {
  switch (line) {
    case 'high': return 1.05;
    case 'deep': return 0.95;
    default: return 1;
  }
}

function nearestOpponent(
  owner: LivePlayer,
  state: LiveMatchState,
  maxDistance = 12
): LivePlayer | null {
  let best: LivePlayer | null = null;
  let bestDistance = maxDistance;

  for (const id of Object.keys(state.players).sort()) {
    const player = state.players[id];
    if (player.isHome === owner.isHome) continue;

    const d = distance(owner.position, player.position);
    if (d < bestDistance) {
      bestDistance = d;
      best = player;
    }
  }

  return best;
}

function pressureAtOwner(owner: LivePlayer, state: LiveMatchState): number {
  let pressure = 0;

  for (const id of Object.keys(state.players).sort()) {
    const opponent = state.players[id];
    if (opponent.isHome === owner.isHome) continue;

    const d = distance(owner.position, opponent.position);

    if (d <= 2) pressure += 1;
    else if (d <= 4) pressure += 0.65;
    else if (d <= 7) pressure += 0.30;
  }

  return clamp(pressure / 2.5, 0, 1);
}

function laneClarity(
  owner: LivePlayer,
  target: Vec2,
  state: LiveMatchState
): number {
  const dx = target.x - owner.position.x;
  const dy = target.y - owner.position.y;
  const length = Math.hypot(dx, dy);

  if (length < 0.001) return 0;

  let interference = 0;

  for (const id of Object.keys(state.players).sort()) {
    const opponent = state.players[id];
    if (opponent.isHome === owner.isHome) continue;

    const px = opponent.position.x - owner.position.x;
    const py = opponent.position.y - owner.position.y;
    const projection = (px * dx + py * dy) / (length * length);

    if (projection <= 0 || projection >= 1) continue;

    const closestX = owner.position.x + dx * projection;
    const closestY = owner.position.y + dy * projection;
    const lateral = Math.hypot(
      opponent.position.x - closestX,
      opponent.position.y - closestY
    );

    if (lateral < 1.5) interference += 0.55;
    else if (lateral < 3) interference += 0.20;
  }

  return clamp(1 - interference, 0.05, 1);
}

export function resolvePassAction(
  owner: LivePlayer,
  decision: Decision,
  state: LiveMatchState
): ActionResolution {
  if (!decision.target) {
    return {
      probability: 0.05,
      quality: 0.05,
      pressure: 1,
      defenderId: null,
    };
  }

  const a = owner.player.attributes;
  const pressure = pressureAtOwner(owner, state);
  const lane = laneClarity(owner, decision.target, state);
  const targetDistance = distance(owner.position, decision.target);

  const passingSkill =
    avg(a.passing, a.vision, a.firstTouch, a.technique, a.decisions) *
    conditionFactor(owner);

  const pressureSkill =
    1 - pressure * (0.18 + (100 - a.composure) / 500);

  const distancePenalty =
    targetDistance <= 12
      ? 1
      : clamp(1 - (targetDistance - 12) / 55, 0.55, 1);

  const tactic = state.home.club.id === owner.clubId
    ? state.home.club.tactic
    : state.away.club.tactic;

  const attackingModifier = mentalityModifier(
    tactic.mentality,
    owner.isHome
      ? decision.target.x > owner.position.x
      : decision.target.x < owner.position.x
  );

  const tempo = tempoModifier(tactic.tempo);

  const raw =
    (passingSkill / 100) *
    (0.55 + lane * 0.45) *
    pressureSkill *
    distancePenalty *
    attackingModifier *
    tempo;

  return {
    probability: clamp(raw, 0.10, 0.96),
    quality: clamp(
      (passingSkill / 100) *
      lane *
      (1 - pressure * 0.35),
      0.05,
      1
    ),
    pressure,
    defenderId: nearestOpponent(owner, state)?.player.id ?? null,
  };
}

export function resolveDribbleAction(
  owner: LivePlayer,
  state: LiveMatchState
): ActionResolution {
  const defender = nearestOpponent(owner, state, 6);
  const a = owner.player.attributes;
  const pressure = pressureAtOwner(owner, state);

  const attack =
    avg(a.dribbling, a.agility, a.balance, a.technique, a.decisions) *
    conditionFactor(owner);

  if (!defender) {
    return {
      probability: clamp(0.72 + attack / 500, 0.72, 0.92),
      quality: clamp(attack / 100, 0.1, 1),
      pressure,
      defenderId: null,
    };
  }

  const d = defender.player.attributes;
  const defense =
    avg(d.tackling, d.marking, d.defensivePositioning, d.anticipation) *
    conditionFactor(defender);

  const strength =
    avg(a.dribbling, a.agility, a.balance) * conditionFactor(owner);

  const resistance =
    avg(d.tackling, d.positioning, d.anticipation) *
    conditionFactor(defender);

  const probability =
    (strength * 1.10) /
    (strength * 1.10 + resistance);

  return {
    probability: clamp(
      probability * (1 - pressure * 0.15),
      0.08,
      0.90
    ),
    quality: clamp(
      (attack * 0.65 + strength * 0.35) / 100,
      0.05,
      1
    ),
    pressure,
    defenderId: defender.player.id,
  };
}

export function resolveShotAction(
  owner: LivePlayer,
  decision: Decision,
  state: LiveMatchState
): ShotResolution {
  const a = owner.player.attributes;
  const pressure = pressureAtOwner(owner, state);

  const defendingSideIsHome = !owner.isHome;

  const goalkeeper = Object.values(state.players).find(
    player =>
      player.role === 'GK' &&
      player.isHome === defendingSideIsHome
  );

  const gkAttributes = goalkeeper?.player.attributes;

  const goalkeeperSkill = goalkeeper && gkAttributes
    ? clamp(
        avg(
          gkAttributes.goalkeeper,
          gkAttributes.reflexes,
          gkAttributes.gkPositioning,
          gkAttributes.handling,
          gkAttributes.oneOnOne
        ) * conditionFactor(goalkeeper) / 100,
        0,
        1
      )
    : 0.50;

  const shooterSkill =
    avg(
      a.shooting,
      a.finishing,
      a.technique,
      a.composure,
      a.decisions
    ) * conditionFactor(owner);

  const distanceToGoal = decision.target
    ? distance(owner.position, decision.target)
    : 20;

  const distanceFactor = clamp(
    1 - Math.max(0, distanceToGoal - 10) * 0.018,
    0.60,
    1.08
  );

  const targetQuality =
    state.decisions[owner.player.id]?.selected?.successProbability ?? 0.20;

  const quality =
    clamp(
      (shooterSkill / 100) *
      distanceFactor *
      (1 - pressure * 0.22) *
      (0.65 + targetQuality * 0.35),
      0.03,
      0.92
    );

  const defensiveSide = owner.isHome ? state.away : state.home;
  const defensiveLine = defensiveLineModifier(
    defensiveSide.club.tactic.defensiveLine
  );

  const conversion =
    quality *
    (0.70 + shooterSkill / 500) *
    (1 - goalkeeperSkill * 0.42) *
    defensiveLine;

  return {
    probability: clamp(conversion, 0.02, 0.70),
    quality,
    pressure,
    defenderId: goalkeeper?.player.id ?? null,
    xG: clamp(
      quality *
      (0.62 + shooterSkill / 300) *
      (1 - goalkeeperSkill * 0.20),
      0.02,
      0.75
    ),
    goalkeeperSkill,
  };
}
