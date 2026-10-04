
// src/engine/match/attackSequence.ts

import type { Player, AttackSequence, AttackSequenceAction, ActionDebugInfo } from '../types';
import type { TeamMatchState } from './matchState';
import { eff } from './teamAnalysis';
import { pickDefender } from './attack';
import type { MatchRng } from './rng';

// ═══════════════════════════════════════════════
// TEST EDİLEBİLİR AYAR
// ═══════════════════════════════════════════════

export let ACTION_SUCCESS_DIVISOR = 180;

export function setActionSuccessDivisor(value: number): void {
  ACTION_SUCCESS_DIVISOR = value;
}

export function getActionSuccessDivisor(): number {
  return ACTION_SUCCESS_DIVISOR;
}

// ═══════════════════════════════════════════════
// DEBUG HOOK
// ═══════════════════════════════════════════════

let debugCallback: ((info: ActionDebugInfo) => void) | null = null;

export function setAttackDebugCallback(cb: ((info: ActionDebugInfo) => void) | null): void {
  debugCallback = cb;
}

// ═══════════════════════════════════════════════
// ANA FONKSİYON
// ═══════════════════════════════════════════════

export function createAttackSequence(
  attackingTeam: TeamMatchState,
  defendingTeam: TeamMatchState,
  attackXI: Player[],
  defendXI: Player[],
  startingZone: string,
  rng: MatchRng = Math.random
): AttackSequence {
  const actions: AttackSequenceAction[] = [];
  let currentZone = startingZone;
  let currentPlayer = pickPlayerForZone(attackXI, currentZone, rng);
  let totalSpace = 0;
  let totalPressure = 0;
  let actionCount = 1;
  const maxActions = 8;

  if (!currentPlayer) {
    return emptySequence(attackingTeam, defendingTeam, startingZone);
  }

  actions.push({
    minute: 0,
    action: 'carry',
    playerId: currentPlayer.id,
    playerName: currentPlayer.name,
    playerPosition: currentPlayer.position,
    fromZone: currentZone,
    toZone: currentZone,
    success: true,
    defensePressure: 0,
    spaceCreated: 0,
    description: `${currentPlayer.name} topu aldi`,
  });

  attackingTeam.dribbles++;
  attackingTeam.dribblesSuccess++;

  for (let i = 0; i < maxActions; i++) {
    const defender = pickDefender(defendXI, currentZone, rng);
    const pressure = calculateDefenderPressure(defender, defendingTeam);

    totalPressure += pressure;
    actionCount++;

    const actionType = chooseSequenceAction(
      currentPlayer,
      currentZone,
      attackingTeam,
      rng
    );

    const resolved = resolveSequenceAction(
      actionType,
      currentPlayer,
      defender,
      currentZone,
      attackingTeam,
      defendingTeam,
      rng
    );

    const success = resolved.success;

    if (typeof debugCallback === 'function') {
      debugCallback({
        actionIndex: i,
        action: actionType,
        zone: currentZone,
        attackerId: currentPlayer.id,
        attackerName: currentPlayer.name,
        attackerPosition: currentPlayer.position,
        attackerPower: resolved.attackerPower,
        defenderId: defender?.id ?? null,
        defenderName: defender?.name ?? null,
        defenderPosition: defender?.position ?? null,
        defenderPower: resolved.defenderPower,
        diff: resolved.attackerPower - resolved.defenderPower,
        probability: resolved.probability,
        success,
      });
    }

    // ───────────────────────────────────────────
    // AKSİYON İSTATİSTİKLERİ
    // ───────────────────────────────────────────

    if (
      actionType === 'pass' ||
      actionType === 'throughBall' ||
      actionType === 'recycle'
    ) {
      attackingTeam.passes++;

      if (success) {
        attackingTeam.passesCompleted++;
      }
    }

    if (
      actionType === 'dribble' ||
      actionType === 'carry'
    ) {
      attackingTeam.dribbles++;

      if (success) {
        attackingTeam.dribblesSuccess++;
      }
    }

    if (actionType === 'cross') {
      attackingTeam.crosses++;

      if (success) {
        attackingTeam.crossesSuccess++;
      }
    }

    // ───────────────────────────────────────────
    // ALAN
    // ───────────────────────────────────────────

    const space = success
      ? calculateSpaceCreated(pressure, attackingTeam)
      : 0;

    totalSpace += space;

    actions.push({
      minute: 0,
      action: actionType,
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      playerPosition: currentPlayer.position,
      fromZone: currentZone,
      toZone: success
        ? getNextZone(currentZone, actionType)
        : currentZone,
      success,
      defensePressure: Math.round(pressure),
      spaceCreated: Math.round(space),
      description:
        `${currentPlayer.name} ${getActionLabel(actionType)} ` +
        `(${Math.round(pressure)}% baski, ${Math.round(space)}% alan)`,
    });

    // Başarısız aksiyon hücumu bitirir.
    if (!success) {
      break;
    }

    currentZone = getNextZone(currentZone, actionType);

    let nextPlayer = pickPlayerForZone(
      attackXI,
      currentZone,
      rng
    );

    let tries = 0;

    while (
      nextPlayer &&
      nextPlayer.id === currentPlayer.id &&
      tries < 5
    ) {
      nextPlayer = pickPlayerForZone(
        attackXI,
        currentZone
      );

      tries++;
    }

    if (nextPlayer) {
      currentPlayer = nextPlayer;
    }
  }

  // İlk otomatik carry istatistiğe dahil,
  // fakat pressure/space ortalamasına dahil edilmez.
  const denom = Math.max(1, actionCount - 1);

  const finalPressure = Math.round(
    totalPressure / denom
  );

  const avgSpace = Math.round(
    totalSpace / denom
  );

  const inAttackZone = currentZone.includes('Attack');

  const playerQuality =
    eff(currentPlayer, 'finishing') * 0.3 +
    eff(currentPlayer, 'technique') * 0.3 +
    eff(currentPlayer, 'offTheBall') * 0.2 +
    eff(currentPlayer, 'composure') * 0.2;

  const chanceQuality = inAttackZone
    ? Math.round(
        avgSpace * 0.4 +
        (100 - finalPressure) * 0.3 +
        playerQuality * 0.4
      )
    : 0;

  return {
    attackingClubId: attackingTeam.club.id,
    defendingClubId: defendingTeam.club.id,
    startedZone: startingZone,
    finalZone: currentZone,
    actions,
    totalActions: actionCount,
    finalPressure,
    spaceCreated: avgSpace,
    chanceQuality,
    resultedInShot: chanceQuality > 15,
    resultedInGoal: false,
    xG: 0,
  };
}

// ═══════════════════════════════════════════════
// OYUNCU SEÇİMİ
// ═══════════════════════════════════════════════

export function pickPlayerForZone(
  xi: Player[],
  zone: string,
  rng: MatchRng = Math.random
): Player | null {
  let positions: string[];

  if (zone.includes('Defense')) {
    positions = [
      'DC',
      'DL',
      'DR',
      'DMC',
      'WBL',
      'WBR',
    ];
  } else if (zone.includes('Midfield')) {
    if (zone === 'centerMidfield') {
      positions = [
        'DMC',
        'MC',
        'AMC',
      ];
    } else if (zone === 'leftMidfield') {
      positions = [
        'DL',
        'ML',
        'AML',
        'MC',
        'WBL',
        'KFL',
      ];
    } else {
      positions = [
        'DR',
        'MR',
        'AMR',
        'MC',
        'WBR',
        'KFR',
      ];
    }
  } else if (zone === 'centerAttack') {
    positions = [
      'AMC',
      'ST',
      'GF',
    ];
  } else if (zone === 'leftAttack') {
    positions = [
      'ML',
      'AML',
      'ST',
      'AMC',
      'KFL',
    ];
  } else {
    positions = [
      'MR',
      'AMR',
      'ST',
      'AMC',
      'KFR',
    ];
  }

  const candidates = xi.filter(
    p => positions.includes(p.position)
  );

  if (candidates.length === 0) {
    return xi.length > 0
      ? xi[Math.floor(rng() * xi.length)]
      : null;
  }

  return candidates[
    Math.floor(rng() * candidates.length)
  ];
}

// ═══════════════════════════════════════════════
// AKSİYON SEÇİMİ
// ═══════════════════════════════════════════════

function chooseSequenceAction(
  _player: Player,
  zone: string,
  team: TeamMatchState,
  rng: MatchRng = Math.random
): AttackSequenceAction['action'] {
  const isWing =
    zone === 'leftAttack' ||
    zone === 'rightAttack';

  const isAttack =
    zone.includes('Attack');

  const directness = team.directness;

  const r = rng();

  if (isWing) {
    if (r < 0.20) return 'cross';
    if (r < 0.40) return 'dribble';
    if (r < 0.80) return 'pass';
    return 'run';
  }

  if (isAttack) {
    if (r < 0.15) return 'throughBall';
    if (r < 0.50) return 'pass';
    if (r < 0.70) return 'dribble';
    if (r < 0.90) return 'pass';
    if (r < 0.95) return 'run';
    return 'recycle';
  }

  if (
    directness === 'direct' &&
    r < 0.25
  ) {
    return 'throughBall';
  }

  if (r < 0.55) return 'pass';
  if (r < 0.75) return 'dribble';
  if (r < 0.90) return 'run';

  return 'recycle';
}

// ═══════════════════════════════════════════════
// AKSİYON ÇÖZÜMLEME
// ═══════════════════════════════════════════════

interface ResolvedAction {
  success: boolean;
  attackerPower: number;
  defenderPower: number;
  probability: number;
}

function resolveSequenceAction(
  action: string,
  attacker: Player,
  defender: Player | null,
  zone: string,
  attackTeam: TeamMatchState,
  defendTeam: TeamMatchState,
  rng: MatchRng = Math.random
): ResolvedAction {
  const attackerPower =
    calculateAttackerPower(
      attacker,
      action
    );

  const defenderPower =
    calculateDefenderPower(
      defender,
      defendTeam
    );

  // ───────────────────────────────────────────
  // AKSİYON BAZLI BAŞLANGIÇ OLASILIKLARI
  //
  // Pasların başarı oranını yükseltiyoruz.
  // ACTION_SUCCESS_DIVISOR diğer aksiyonlarda
  // aynen korunuyor.
  // ───────────────────────────────────────────

  let baseProbability = 0.58;

  if (action === 'pass') {
    baseProbability = 0.68;
  } else if (action === 'throughBall') {
    baseProbability = 0.64;
  } else if (action === 'recycle') {
    baseProbability = 0.75;
  }

  let probability =
    baseProbability +
    (attackerPower - defenderPower) /
      ACTION_SUCCESS_DIVISOR;

  // Hücum bölgesinde aksiyonlar biraz daha başarılı.
  if (zone.includes('Attack')) {
    probability += 0.05;
  }

  // Savunma bölgesinde baskı daha yüksek.
  if (zone.includes('Defense')) {
    probability -= 0.10;
  }

  // Tempo etkisi.
  if (attackTeam.tempo === 'fast') {
    probability -= 0.03;
  }

  if (attackTeam.tempo === 'slow') {
    probability += 0.03;
  }

  // Genel güvenlik sınırı.
  const finalProb =
    Math.max(
      0.20,
      Math.min(0.90, probability)
    );

  const success =
    rng() < finalProb;

  return {
    success,
    attackerPower,
    defenderPower,
    probability: finalProb,
  };
}

// ═══════════════════════════════════════════════
// OYUNCU AKSİYON GÜCÜ
// ═══════════════════════════════════════════════

export function calculateAttackerPower(
  attacker: Player,
  action: string
): number {
  if (action === 'pass') {
    return (
      eff(attacker, 'passing') * 0.4 +
      eff(attacker, 'vision') * 0.3 +
      eff(attacker, 'decisions') * 0.3
    );
  }

  if (action === 'dribble') {
    return (
      eff(attacker, 'dribbling') * 0.4 +
      eff(attacker, 'agility') * 0.3 +
      eff(attacker, 'technique') * 0.3
    );
  }

  if (action === 'cross') {
    return (
      eff(attacker, 'crossing') * 0.5 +
      eff(attacker, 'technique') * 0.3 +
      eff(attacker, 'vision') * 0.2
    );
  }

  if (action === 'throughBall') {
    return (
      eff(attacker, 'passing') * 0.4 +
      eff(attacker, 'vision') * 0.4 +
      eff(attacker, 'technique') * 0.2
    );
  }

  if (action === 'run') {
    return (
      eff(attacker, 'offTheBall') * 0.4 +
      eff(attacker, 'pace') * 0.3 +
      eff(attacker, 'anticipation') * 0.3
    );
  }

  if (action === 'recycle') {
    return (
      eff(attacker, 'passing') * 0.5 +
      eff(attacker, 'composure') * 0.5
    );
  }

  return 50;
}

// ═══════════════════════════════════════════════
// SAVUNMACI GÜCÜ
// ═══════════════════════════════════════════════

export function calculateDefenderPower(
  defender: Player | null,
  team: TeamMatchState
): number {
  if (!defender) {
    return 40;
  }

  const marking =
    eff(defender, 'marking');

  const tackling =
    eff(defender, 'tackling');

  const positioning =
    eff(defender, 'defensivePositioning');

  const anticipation =
    eff(defender, 'anticipation');

  let power =
    marking * 0.3 +
    tackling * 0.3 +
    positioning * 0.2 +
    anticipation * 0.2;

  if (team.pressing === 'high') {
    power += 5;
  } else if (team.pressing === 'low') {
    power -= 5;
  }

  return power;
}

// ═══════════════════════════════════════════════
// SAVUNMA BASKISI
// ═══════════════════════════════════════════════

function calculateDefenderPressure(
  defender: Player | null,
  team: TeamMatchState
): number {
  if (!defender) {
    return 30;
  }

  const tackling =
    eff(defender, 'tackling');

  const workRate =
    eff(defender, 'workRate');

  const stamina =
    eff(defender, 'stamina');

  let pressure =
    (tackling + workRate + stamina) / 3;

  if (team.pressing === 'high') {
    pressure += 10;
  }

  if (team.pressing === 'low') {
    pressure -= 10;
  }

  return Math.max(
    10,
    Math.min(95, pressure)
  );
}

// ═══════════════════════════════════════════════
// ALAN OLUŞUMU
// ═══════════════════════════════════════════════

function calculateSpaceCreated(
  pressure: number,
  team: TeamMatchState
): number {
  const baseSpace =
    100 - pressure;

  const mentalityBonus =
    team.mentality === 'attacking'
      ? 10
      : 0;

  return Math.max(
    0,
    Math.min(
      100,
      baseSpace + mentalityBonus
    )
  );
}

// ═══════════════════════════════════════════════
// BİR SONRAKİ BÖLGE
// ═══════════════════════════════════════════════

function getNextZone(
  currentZone: string,
  action: string
): string {
  if (currentZone === 'centerMidfield') {
    if (action === 'throughBall') {
      return 'centerAttack';
    }

    if (action === 'pass') {
      return 'centerAttack';
    }

    return 'centerMidfield';
  }

  if (currentZone === 'leftMidfield') {
    if (
      action === 'pass' ||
      action === 'run'
    ) {
      return 'leftAttack';
    }

    return 'leftMidfield';
  }

  if (currentZone === 'rightMidfield') {
    if (
      action === 'pass' ||
      action === 'run'
    ) {
      return 'rightAttack';
    }

    return 'rightMidfield';
  }

  return currentZone;
}

// ═══════════════════════════════════════════════
// AKSİYON İSİMLERİ
// ═══════════════════════════════════════════════

function getActionLabel(
  action: string
): string {
  const labels: Record<string, string> = {
    pass: 'pas yapti',
    dribble: 'calim atti',
    cross: 'orta yapti',
    throughBall: 'ara pas atti',
    run: 'kosu yapti',
    recycle: 'geri pas yapti',
    carry: 'topu tasidi',
    shot: 'sut cekti',
  };

  return labels[action] || action;
}

// ═══════════════════════════════════════════════
// BOŞ SEQUENCE
// ═══════════════════════════════════════════════

function emptySequence(
  attackingTeam: TeamMatchState,
  defendingTeam: TeamMatchState,
  zone: string
): AttackSequence {
  return {
    attackingClubId:
      attackingTeam.club.id,

    defendingClubId:
      defendingTeam.club.id,

    startedZone: zone,
    finalZone: zone,

    actions: [],

    totalActions: 0,

    finalPressure: 0,
    spaceCreated: 0,
    chanceQuality: 0,

    resultedInShot: false,
    resultedInGoal: false,

    xG: 0,
  };
}

