// src/engine/match/attackSequence.ts

import type { Player, AttackSequence, AttackSequenceAction } from '../types';
import type { TeamMatchState } from './matchState';
import { eff } from './teamAnalysis';
import { pickDefender } from './attack';

export function createAttackSequence(
  attackingTeam: TeamMatchState,
  defendingTeam: TeamMatchState,
  attackXI: Player[],
  defendXI: Player[],
  startingZone: string
): AttackSequence {
  const actions: AttackSequenceAction[] = [];
  let currentZone = startingZone;
  let currentPlayer = pickPlayerForZone(attackXI, currentZone);
  let totalSpace = 0;
  let totalPressure = 0;
  let actionCount = 0;
  const maxActions = 6;

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

  // Taşıma istatistiği
  attackingTeam.dribbles++;
  attackingTeam.dribblesSuccess++;

  for (let i = 0; i < maxActions; i++) {
    const defender = pickDefender(defendXI, currentZone);
    const pressure = calculateDefenderPressure(defender, defendingTeam);
    totalPressure += pressure;
    actionCount++;

    const actionType = chooseSequenceAction(currentPlayer, currentZone, attackingTeam);

    const success = resolveSequenceAction(
      actionType,
      currentPlayer,
      defender,
      currentZone,
      attackingTeam,
      defendingTeam
    );

    // 🆕 İSTATİSTİK ARTTIR (her aksiyon için)
    if (actionType === 'pass' || actionType === 'throughBall' || actionType === 'recycle') {
      attackingTeam.passes++;
      if (success) attackingTeam.passesCompleted++;
    }
    if (actionType === 'dribble' || actionType === 'carry') {
      attackingTeam.dribbles++;
      if (success) attackingTeam.dribblesSuccess++;
    }
    if (actionType === 'cross') {
      attackingTeam.crosses++;
      if (success) attackingTeam.crossesSuccess++;
    }

    const space = success ? calculateSpaceCreated(pressure, attackingTeam) : 0;
    totalSpace += space;

    actions.push({
      minute: 0,
      action: actionType,
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      playerPosition: currentPlayer.position,
      fromZone: currentZone,
      toZone: success ? getNextZone(currentZone, actionType) : currentZone,
      success,
      defensePressure: Math.round(pressure),
      spaceCreated: Math.round(space),
      description: `${currentPlayer.name} ${getActionLabel(actionType)} (${Math.round(pressure)}% baski, ${Math.round(space)}% alan)`,
    });

    if (!success) {
      return {
        attackingClubId: attackingTeam.club.id,
        defendingClubId: defendingTeam.club.id,
        startedZone: startingZone,
        finalZone: currentZone,
        actions,
        totalActions: actionCount,
        finalPressure: Math.round(totalPressure / actionCount),
        spaceCreated: Math.round(totalSpace / actionCount),
        chanceQuality: 0,
        resultedInShot: false,
        resultedInGoal: false,
        xG: 0,
      };
    }

    currentZone = getNextZone(currentZone, actionType);

    if (currentZone.includes('Attack')) {
      break;
    }

    const nextPlayer = pickPlayerForZone(attackXI, currentZone);
    if (!nextPlayer || nextPlayer.id === currentPlayer.id) {
      break;
    }
    currentPlayer = nextPlayer;
  }

  const finalPressure = Math.round(totalPressure / Math.max(1, actionCount));
  const avgSpace = Math.round(totalSpace / Math.max(1, actionCount));
  const inAttackZone = currentZone.includes('Attack');

  const chanceQuality = inAttackZone
    ? Math.round(avgSpace * 0.5 + (100 - finalPressure) * 0.4)
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
    resultedInShot: chanceQuality > 5,
    resultedInGoal: false,
    xG: 0,
  };
}

// ═══════════════════════════════════════════════
// OYUNCU SEÇİMİ (17 pozisyon)
// ═══════════════════════════════════════════════

function pickPlayerForZone(xi: Player[], zone: string): Player | null {
  let positions: string[];

  if (zone.includes('Defense')) {
    positions = ['DC', 'DL', 'DR', 'DMC', 'WBL', 'WBR'];
  } else if (zone.includes('Midfield')) {
    if (zone === 'centerMidfield') positions = ['DMC', 'MC', 'AMC'];
    else if (zone === 'leftMidfield') positions = ['DL', 'ML', 'AML', 'MC', 'WBL', 'KFL'];
    else positions = ['DR', 'MR', 'AMR', 'MC', 'WBR', 'KFR'];
  } else if (zone === 'centerAttack') {
    positions = ['AMC', 'ST', 'GF'];
  } else if (zone === 'leftAttack') {
    positions = ['ML', 'AML', 'ST', 'AMC', 'KFL'];
  } else {
    positions = ['MR', 'AMR', 'ST', 'AMC', 'KFR'];
  }

  const candidates = xi.filter(p => positions.includes(p.position));
  if (candidates.length === 0) {
    return xi.length > 0 ? xi[Math.floor(Math.random() * xi.length)] : null;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function chooseSequenceAction(
  player: Player,
  zone: string,
  team: TeamMatchState
): AttackSequenceAction['action'] {
  const isWing = zone === 'leftAttack' || zone === 'rightAttack';
  const isAttack = zone.includes('Attack');
  const directness = team.directness;

  const r = Math.random();

  if (isWing) {
    if (r < 0.35) return 'cross';
    if (r < 0.60) return 'dribble';
    if (r < 0.85) return 'pass';
    return 'run';
  }

  if (isAttack) {
    if (r < 0.25) return 'throughBall';
    if (r < 0.50) return 'dribble';
    if (r < 0.75) return 'pass';
    if (r < 0.90) return 'run';
    return 'pass';
  }

  if (directness === 'direct' && r < 0.25) return 'throughBall';
  if (r < 0.55) return 'pass';
  if (r < 0.75) return 'dribble';
  if (r < 0.90) return 'run';
  return 'recycle';
}

function resolveSequenceAction(
  action: string,
  attacker: Player,
  defender: Player | null,
  zone: string,
  attackTeam: TeamMatchState,
  defendTeam: TeamMatchState
): boolean {
  const attackerPower = calculateAttackerPower(attacker, action);
  const defenderPower = calculateDefenderPower(defender, defendTeam);

  let probability = 0.55 + (attackerPower - defenderPower) / 200;

  if (zone.includes('Attack')) probability += 0.05;
  if (zone.includes('Defense')) probability -= 0.10;

  if (attackTeam.tempo === 'fast') probability -= 0.03;
  if (attackTeam.tempo === 'slow') probability += 0.03;

  return Math.random() < Math.max(0.20, Math.min(0.90, probability));
}

function calculateAttackerPower(attacker: Player, action: string): number {
  if (action === 'pass') {
    return eff(attacker, 'passing') * 0.4 + eff(attacker, 'vision') * 0.3 + eff(attacker, 'decisions') * 0.3;
  }
  if (action === 'dribble') {
    return eff(attacker, 'dribbling') * 0.4 + eff(attacker, 'agility') * 0.3 + eff(attacker, 'technique') * 0.3;
  }
  if (action === 'cross') {
    return eff(attacker, 'crossing') * 0.5 + eff(attacker, 'technique') * 0.3 + eff(attacker, 'vision') * 0.2;
  }
  if (action === 'throughBall') {
    return eff(attacker, 'passing') * 0.4 + eff(attacker, 'vision') * 0.4 + eff(attacker, 'technique') * 0.2;
  }
  if (action === 'run') {
    return eff(attacker, 'offTheBall') * 0.4 + eff(attacker, 'pace') * 0.3 + eff(attacker, 'anticipation') * 0.3;
  }
  if (action === 'recycle') {
    return eff(attacker, 'passing') * 0.5 + eff(attacker, 'composure') * 0.5;
  }
  return 50;
}

function calculateDefenderPower(defender: Player | null, team: TeamMatchState): number {
  if (!defender) return 40;

  const marking = eff(defender, 'marking');
  const tackling = eff(defender, 'tackling');
  const positioning = eff(defender, 'defensivePositioning');
  const anticipation = eff(defender, 'anticipation');

  let power = marking * 0.3 + tackling * 0.3 + positioning * 0.2 + anticipation * 0.2;

  if (team.pressing === 'high') power += 5;
  else if (team.pressing === 'low') power -= 5;

  return power;
}

function calculateDefenderPressure(defender: Player | null, team: TeamMatchState): number {
  if (!defender) return 30;

  const tackling = eff(defender, 'tackling');
  const workRate = eff(defender, 'workRate');
  const stamina = eff(defender, 'stamina');

  let pressure = (tackling + workRate + stamina) / 3;
  if (team.pressing === 'high') pressure += 10;
  if (team.pressing === 'low') pressure -= 10;

  return Math.max(10, Math.min(95, pressure));
}

function calculateSpaceCreated(pressure: number, team: TeamMatchState): number {
  const baseSpace = 100 - pressure;
  const mentalityBonus = team.mentality === 'attacking' ? 10 : 0;
  return Math.max(0, Math.min(100, baseSpace + mentalityBonus));
}

function getNextZone(currentZone: string, action: string): string {
  if (currentZone === 'centerMidfield') {
    if (action === 'throughBall') return 'centerAttack';
    if (action === 'pass') return 'centerAttack';
    return 'centerMidfield';
  }
  if (currentZone === 'leftMidfield') {
    if (action === 'pass' || action === 'run') return 'leftAttack';
    return 'leftMidfield';
  }
  if (currentZone === 'rightMidfield') {
    if (action === 'pass' || action === 'run') return 'rightAttack';
    return 'rightMidfield';
  }
  return currentZone;
}

function getActionLabel(action: string): string {
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

function emptySequence(
  attackingTeam: TeamMatchState,
  defendingTeam: TeamMatchState,
  zone: string
): AttackSequence {
  return {
    attackingClubId: attackingTeam.club.id,
    defendingClubId: defendingTeam.club.id,
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