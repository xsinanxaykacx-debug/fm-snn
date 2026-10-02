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

function roleModifier(role: LivePlayer['role'], phase: 'attack' | 'defense' | 'midfield' | 'press'): number {
  switch (role) {
    case 'GK':
      return phase === 'defense' ? 1.04 : 1;
    case 'CB':
      return phase === 'defense' ? 1.08 : phase === 'midfield' ? 1.02 : 0.96;
    case 'FB':
      return phase === 'defense' ? 1.05 : phase === 'attack' ? 1.02 : 1;
    case 'WB':
      return phase === 'attack' ? 1.08 : phase === 'defense' ? 0.98 : 1.02;
    case 'DM':
      return phase === 'defense' ? 1.08 : phase === 'midfield' ? 1.06 : 0.94;
    case 'CM':
      return phase === 'midfield' ? 1.06 : 1.02;
    case 'AM':
      return phase === 'attack' ? 1.08 : phase === 'midfield' ? 1.04 : 0.96;
    case 'W':
      return phase === 'attack' ? 1.07 : phase === 'press' ? 1.05 : 1;
    case 'ST':
      return phase === 'attack' ? 1.10 : phase === 'press' ? 1.04 : 0.96;
    default:
      return 1;
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
  const role = roleModifier(owner.role, 'midfield');
  const pressing = pressingModifier(tactic.pressing);

  const directness =
    tactic.directness === 'direct' ? 1.06 :
    tactic.directness === 'short' ? 0.97 : 1;

  const skillProbability = passingSkill / 15;

  // Pass quality is primarily driven by the passer's effective skill.
  // Contextual factors reduce that base probability additively so several
  // moderate difficulties do not collapse the result through multiplication.
  const lanePenalty = (1 - lane) * 0.35;
  const distanceFactor = distancePenalty;
  const distancePenaltyContribution = (1 - distanceFactor) * 0.25;
  const pressurePenalty = pressure * 0.30;

  const tacticFactor =
    attackingModifier *
    tempo *
    role *
    directness *
    (0.94 + pressing * 0.06);

  // Tactical settings have deliberately small influence at resolution time;
  // they should shape pass risk without overpowering player skill.
  const tacticPenalty = Math.max(0, 1 - tacticFactor) * 0.20;

  const totalPenalty = clamp(
    (
      lanePenalty +
      distancePenaltyContribution +
      pressurePenalty +
      tacticPenalty
    ) * 0.6,
    0,
    0.35
  );

  const raw = skillProbability - totalPenalty;

  return {
    probability: clamp(raw, 0.35, 0.92),
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

export function resolveCrossAction(
  owner: LivePlayer,
  decision: Decision,
  state: LiveMatchState
): ActionResolution {
  if (!decision.target) {
    return {
      probability: 0.20,
      quality: 0.20,
      pressure: 1,
      defenderId: null,
    };
  }

  const a = owner.player.attributes;
  const pressure = pressureAtOwner(owner, state);
  const lane = laneClarity(owner, decision.target, state);
  const targetDistance = distance(owner.position, decision.target);

  const crossingSkill =
    avg(a.crossing, a.technique, a.vision, a.decisions) *
    conditionFactor(owner);

  const tactic = state.home.club.id === owner.clubId
    ? state.home.club.tactic
    : state.away.club.tactic;

  const widthModifier =
    tactic.width === 'wide'
      ? 1.08
      : tactic.width === 'narrow'
        ? 0.92
        : 1;

  const distancePenalty =
    targetDistance <= 18
      ? 1
      : clamp(1 - (targetDistance - 18) / 45, 0.60, 1);

  const raw =
    (crossingSkill / 100) *
    (0.50 + lane * 0.50) *
    (1 - pressure * 0.18) *
    distancePenalty *
    widthModifier;

  return {
    probability: clamp(raw, 0.20, 0.90),
    quality: clamp(
      (crossingSkill / 100) *
      lane *
      (1 - pressure * 0.25),
      0.05,
      1
    ),
    pressure,
    defenderId: nearestOpponent(owner, state)?.player.id ?? null,
  };
}


export function resolveInterceptionAction(
  passer: LivePlayer,
  target: Vec2,
  state: LiveMatchState
): ActionResolution {
  const interceptor = nearestOpponent(passer, state, 18);

  if (!interceptor) {
    return {
      probability: 0.02,
      quality: 0.02,
      pressure: 0,
      defenderId: null,
    };
  }

  const lane = laneClarity(passer, target, state);
  const distanceToLane = distance(interceptor.position, target);
  const pressure = pressureAtOwner(passer, state);

  const a = interceptor.player.attributes;
  const interceptionSkill =
    avg(
      a.anticipation,
      a.positioning,
      a.marking,
      a.tackling
    ) * conditionFactor(interceptor);

  const role = roleModifier(interceptor.role, 'defense');
  const pressing =
    pressingModifier(
      interceptor.isHome
        ? state.home.club.tactic.pressing
        : state.away.club.tactic.pressing
    );

  const proximity = clamp(1 - distanceToLane / 18, 0, 1);

  const raw =
    (interceptionSkill / 100) *
    (0.25 + proximity * 0.75) *
    (0.55 + (1 - lane) * 0.45) *
    role *
    (0.92 + pressing * 0.08) *
    (1 - pressure * 0.08);

  return {
    probability: clamp(raw, 0.02, 0.65),
    quality: clamp(raw, 0.05, 1),
    pressure,
    defenderId: interceptor.player.id,
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


export interface TransitionResolution {
  probability: number;
  quality: number;
  playerId: string | null;
}

export function resolveCounterPress(
  pressingTeam: LivePlayer[],
  ballPosition: Vec2,
  state: LiveMatchState
): TransitionResolution {
  if (pressingTeam.length === 0) {
    return { probability: 0.05, quality: 0.05, playerId: null };
  }

  let total = 0;
  let bestScore = -Infinity;
  let bestPlayer: LivePlayer | null = null;

  for (const player of pressingTeam) {
    if (player.role === 'GK') continue;

    const a = player.player.attributes;
    const d = distance(player.position, ballPosition);
    const proximity = clamp(1 - d / 18, 0, 1);
    const defensiveSkill =
      avg(a.tackling, a.anticipation, a.positioning, a.workRate) *
      conditionFactor(player);

    const tactic = player.isHome
      ? state.home.club.tactic
      : state.away.club.tactic;

    const role = roleModifier(player.role, 'press');
    const press = pressingModifier(tactic.pressing);
    const mentality = mentalityModifier(tactic.mentality, false);

    // Defensive line, top kaybından sonraki fiziksel mesafeyi etkiler:
    // yüksek çizgi counter-press runner'ı oyuna daha yakın tutar;
    // düşük çizgi ilk baskı penceresinde mesafeyi büyütür.
    const lineModifier =
      tactic.defensiveLine === 'high' ? 1.15 :
      tactic.defensiveLine === 'deep' ? 0.85 :
      1;

    const score =
      (defensiveSkill / 100) *
      (0.35 + proximity * 0.65) *
      role *
      press *
      lineModifier *
      (0.92 + a.aggression / 1250) *
      mentality;

    total += score;

    if (score > bestScore) {
      bestScore = score;
      bestPlayer = player;
    }
  }

  const pressureDensity = clamp(total / 3.2, 0, 1);
  const probability = clamp(
    0.05 + pressureDensity * 0.52,
    0.05,
    0.62
  );

  return {
    probability,
    quality: clamp(
      bestScore > 0 ? bestScore : pressureDensity,
      0.05,
      1
    ),
    playerId: bestPlayer?.player.id ?? null,
  };
}

export function resolveBreakAction(
  ballWinner: LivePlayer,
  state: LiveMatchState
): TransitionResolution {
  const tactic = ballWinner.isHome
    ? state.home.club.tactic
    : state.away.club.tactic;

  const a = ballWinner.player.attributes;

  const directness =
    tactic.directness === 'direct' ? 1.12 :
    tactic.directness === 'short' ? 0.94 : 1;

  const tempo = tempoModifier(tactic.tempo);

  const mentality = mentalityModifier(tactic.mentality, true);

  const role = roleModifier(ballWinner.role, 'attack');

  const condition = conditionFactor(ballWinner);

  const pace =
    avg(a.pace, a.acceleration, a.offTheBall, a.decisions) / 100;

  const breakBase =
    pace *
    condition *
    directness *
    tempo *
    mentality *
    role;

  // Probability ve quality aynı ham değeri paylaşır ama aynı ölçeği kullanmaz.
  // Quality'nin sürekli 1.00'a doymasını engelleyerek tempo, directness,
  // rol ve kondisyon farklarının transition sonucunda görünür kalmasını sağlarız.
  const probability = clamp(
    0.10 + breakBase * 0.48,
    0.10,
    0.72
  );

  const quality = clamp(
    0.15 + breakBase * 0.68,
    0.05,
    0.95
  );

  return {
    probability,
    quality,
    playerId: ballWinner.player.id,
  };
}
