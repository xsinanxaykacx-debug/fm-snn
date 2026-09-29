// src/engine/match/teamAnalysis.ts

import type { Club, Player, Attributes } from '../types';
import { getStartingXI } from '../data/generateData';

// ═══════════════════════════════════════════════
// 1-20 → 20-95 DÖNÜŞÜMÜ (motor uyumu için)
// ═══════════════════════════════════════════════

const FM_MIN = 1;
const FM_MAX = 20;
const ENGINE_MIN = 20;
const ENGINE_MAX = 95;

/**
 * 1-20 arası FM değerini, motor ölçeğine çevirir (20-95).
 * Örnek: 1 → 20, 10 → 55.53, 20 → 95
 */
function scaleToEngine(value: number): number {
  const clamped = Math.max(FM_MIN, Math.min(FM_MAX, value));
  return ENGINE_MIN + ((clamped - FM_MIN) / (FM_MAX - FM_MIN)) * (ENGINE_MAX - ENGINE_MIN);
}

// ═══════════════════════════════════════════════
// EFEKTIF ATTRIBUTE (kondisyon, form, moral)
// ═══════════════════════════════════════════════

export function eff(player: Player, key: keyof Attributes): number {
  const base = player.attributes[key];
  const cond = 0.5 + (player.condition / 100) * 0.5;
  const form = 0.85 + (player.form / 100) * 0.15;
  const morale = 0.90 + (player.morale / 100) * 0.10;

  const scaled = scaleToEngine(base);

  return scaled * cond * form * morale;
}

export function avgEff(players: Player[], key: keyof Attributes): number {
  if (players.length === 0) return 40;
  return players.reduce((s, p) => s + eff(p, key), 0) / players.length;
}

export function avgEffMulti(players: Player[], keys: { key: keyof Attributes; weight: number }[]): number {
  if (players.length === 0) return 40;
  let total = 0;
  let weightSum = 0;
  for (const p of players) {
    for (const { key, weight } of keys) {
      total += eff(p, key) * weight;
      weightSum += weight;
    }
  }
  return weightSum > 0 ? total / (players.length * (weightSum / keys.length)) : 40;
}

// ═══════════════════════════════════════════════
// TAKIM ANALİZİ
// ═══════════════════════════════════════════════

export interface TeamAnalysis {
  attack: number;
  midfield: number;
  defense: number;
  wings: number;
  transition: number;
  goalkeeper: number;

  pressing: number;
  setPieces: number;
  aerial: number;
  discipline: number;

  zones: {
    leftDefense: number;
    centerDefense: number;
    rightDefense: number;
    leftMidfield: number;
    centerMidfield: number;
    rightMidfield: number;
    leftAttack: number;
    centerAttack: number;
    rightAttack: number;
  };

  canCross: number;
  canDribble: number;
  canPass: number;
  canShoot: number;
  canCounter: number;
}

export function analyzeTeam(
  club: Club,
  players: Record<string, Player>
): TeamAnalysis {
  const xi = getStartingXI(club.id, players, club.tactic.formation);
  const allPlayers = Object.values(players).filter(p => p.clubId === club.id);
  const workingXI = xi.length >= 11 ? xi : allPlayers.slice(0, 11);

  if (workingXI.length === 0) {
    return createEmptyAnalysis();
  }

  const sts = workingXI.filter(p => p.position === 'ST');
  const amcs = workingXI.filter(p => p.position === 'AMC');
  const amls = workingXI.filter(p => p.position === 'AML' || p.position === 'ML');
  const amrs = workingXI.filter(p => p.position === 'AMR' || p.position === 'MR');
  const mcs = workingXI.filter(p => p.position === 'MC');
  const dms = workingXI.filter(p => p.position === 'DMC');
  const dcs = workingXI.filter(p => p.position === 'DC');
  const dls = workingXI.filter(p => p.position === 'DL');
  const drs = workingXI.filter(p => p.position === 'DR');
  const wbls = workingXI.filter(p => p.position === 'WBL');
  const wbrs = workingXI.filter(p => p.position === 'WBR');
  const gks = workingXI.filter(p => p.position === 'GK');

  const allMid = [...mcs, ...dms, ...amcs];
  const allDef = [...dcs, ...dls, ...drs, ...dms, ...wbls, ...wbrs];
  const allWings = [...amls, ...amrs, ...wbls, ...wbrs];
  const allAtt = [...sts, ...amcs, ...amls, ...amrs];

  const attack = (
    avgEff(sts, 'finishing') * 0.30 +
    avgEff(sts, 'offTheBall') * 0.15 +
    avgEff(allAtt, 'shooting') * 0.15 +
    avgEff(allMid, 'passing') * 0.15 +
    avgEff(allAtt, 'dribbling') * 0.15 +
    avgEff(allAtt, 'pace') * 0.10
  );

  const midfield = (
    avgEff(allMid, 'passing') * 0.25 +
    avgEff(allMid, 'vision') * 0.20 +
    avgEff(allMid, 'decisions') * 0.20 +
    avgEff(allMid, 'firstTouch') * 0.15 +
    avgEff(allMid, 'workRate') * 0.10 +
    avgEff(allMid, 'ballWinning') * 0.10
  );

  const defense = (
    avgEff(allDef, 'marking') * 0.25 +
    avgEff(allDef, 'tackling') * 0.25 +
    avgEff(allDef, 'defensivePositioning') * 0.20 +
    avgEff(allDef, 'anticipation') * 0.15 +
    avgEff(allDef, 'strength') * 0.10 +
    avgEff(allDef, 'decisions') * 0.05
  );

  const wings = (
    avgEff(allWings, 'dribbling') * 0.25 +
    avgEff(allWings, 'crossing') * 0.25 +
    avgEff(allWings, 'pace') * 0.20 +
    avgEff(allWings, 'acceleration') * 0.15 +
    avgEff(allWings, 'offTheBall') * 0.15
  );

  const transition = (
    avgEff([...sts, ...amls, ...amrs], 'pace') * 0.30 +
    avgEff([...sts, ...amls, ...amrs], 'acceleration') * 0.25 +
    avgEff([...sts, ...amls, ...amrs], 'offTheBall') * 0.20 +
    avgEff([...sts, ...amls, ...amrs], 'decisions') * 0.15 +
    avgEff([...sts, ...amls, ...amrs], 'dribbling') * 0.10
  );

  const goalkeeper = gks.length > 0 ? (
    avgEff(gks, 'reflexes') * 0.30 +
    avgEff(gks, 'gkPositioning') * 0.25 +
    avgEff(gks, 'handling') * 0.20 +
    avgEff(gks, 'oneOnOne') * 0.15 +
    avgEff(gks, 'aerialReach') * 0.10
  ) : 40;

  const pressing = (
    avgEff(workingXI, 'workRate') * 0.35 +
    avgEff(workingXI, 'stamina') * 0.25 +
    avgEff(workingXI, 'strength') * 0.20 +
    avgEff(workingXI, 'decisions') * 0.20
  );

  const setPieces = (
    avgEff(allMid, 'setPieces') * 0.50 +
    avgEff(allDef, 'heading') * 0.30 +
    avgEff(allAtt, 'heading') * 0.20
  );

  const aerial = (
    avgEff([...dcs, ...sts], 'heading') * 0.50 +
    avgEff([...dcs, ...sts], 'strength') * 0.30 +
    avgEff([...dcs, ...sts], 'bravery') * 0.20
  );

  const discipline = avgEff(workingXI, 'concentration');

  const zones = {
    leftDefense: (
      avgEff([...dls, ...wbls], 'marking') * 0.35 +
      avgEff([...dls, ...wbls], 'tackling') * 0.30 +
      avgEff([...dls, ...wbls], 'defensivePositioning') * 0.20 +
      avgEff([...dls, ...wbls], 'pace') * 0.15
    ),
    centerDefense: (
      avgEff(dcs, 'marking') * 0.30 +
      avgEff(dcs, 'tackling') * 0.30 +
      avgEff(dcs, 'defensivePositioning') * 0.25 +
      avgEff(dcs, 'strength') * 0.15
    ),
    rightDefense: (
      avgEff([...drs, ...wbrs], 'marking') * 0.35 +
      avgEff([...drs, ...wbrs], 'tackling') * 0.30 +
      avgEff([...drs, ...wbrs], 'defensivePositioning') * 0.20 +
      avgEff([...drs, ...wbrs], 'pace') * 0.15
    ),
    leftMidfield: (
      avgEff([...amls, ...dls, ...wbls], 'passing') * 0.30 +
      avgEff([...amls, ...dls, ...wbls], 'dribbling') * 0.30 +
      avgEff([...amls, ...dls, ...wbls], 'pace') * 0.20 +
      avgEff([...amls, ...dls, ...wbls], 'workRate') * 0.20
    ),
    centerMidfield: (
      avgEff(allMid, 'passing') * 0.30 +
      avgEff(allMid, 'vision') * 0.25 +
      avgEff(allMid, 'decisions') * 0.20 +
      avgEff(allMid, 'ballWinning') * 0.15 +
      avgEff(allMid, 'workRate') * 0.10
    ),
    rightMidfield: (
      avgEff([...amrs, ...drs, ...wbrs], 'passing') * 0.30 +
      avgEff([...amrs, ...drs, ...wbrs], 'dribbling') * 0.30 +
      avgEff([...amrs, ...drs, ...wbrs], 'pace') * 0.20 +
      avgEff([...amrs, ...drs, ...wbrs], 'workRate') * 0.20
    ),
    leftAttack: (
      avgEff(amls, 'dribbling') * 0.30 +
      avgEff(amls, 'crossing') * 0.25 +
      avgEff(amls, 'pace') * 0.20 +
      avgEff(amls, 'finishing') * 0.15 +
      avgEff(amls, 'offTheBall') * 0.10
    ),
    centerAttack: (
      avgEff(sts, 'finishing') * 0.35 +
      avgEff(sts, 'offTheBall') * 0.25 +
      avgEff(amcs, 'passing') * 0.20 +
      avgEff(sts, 'shooting') * 0.15 +
      avgEff(sts, 'firstTouch') * 0.05
    ),
    rightAttack: (
      avgEff(amrs, 'dribbling') * 0.30 +
      avgEff(amrs, 'crossing') * 0.25 +
      avgEff(amrs, 'pace') * 0.20 +
      avgEff(amrs, 'finishing') * 0.15 +
      avgEff(amrs, 'offTheBall') * 0.10
    ),
  };

  const canCross = avgEff(allWings, 'crossing') * 0.5 + avgEff(allWings, 'technique') * 0.5;
  const canDribble = avgEff(allAtt, 'dribbling') * 0.5 + avgEff(allAtt, 'agility') * 0.5;
  const canPass = avgEff(allMid, 'passing') * 0.6 + avgEff(allMid, 'vision') * 0.4;
  const canShoot = avgEff(allAtt, 'shooting') * 0.5 + avgEff(allAtt, 'technique') * 0.5;
  const canCounter = avgEff([...sts, ...amls, ...amrs], 'pace') * 0.5 + avgEff([...sts, ...amls, ...amrs], 'offTheBall') * 0.5;

  return {
    attack: r1(attack),
    midfield: r1(midfield),
    defense: r1(defense),
    wings: r1(wings),
    transition: r1(transition),
    goalkeeper: r1(goalkeeper),
    pressing: r1(pressing),
    setPieces: r1(setPieces),
    aerial: r1(aerial),
    discipline: r1(discipline),
    zones: {
      leftDefense: r1(zones.leftDefense),
      centerDefense: r1(zones.centerDefense),
      rightDefense: r1(zones.rightDefense),
      leftMidfield: r1(zones.leftMidfield),
      centerMidfield: r1(zones.centerMidfield),
      rightMidfield: r1(zones.rightMidfield),
      leftAttack: r1(zones.leftAttack),
      centerAttack: r1(zones.centerAttack),
      rightAttack: r1(zones.rightAttack),
    },
    canCross: r1(canCross),
    canDribble: r1(canDribble),
    canPass: r1(canPass),
    canShoot: r1(canShoot),
    canCounter: r1(canCounter),
  };
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

function createEmptyAnalysis(): TeamAnalysis {
  return {
    attack: 40, midfield: 40, defense: 40, wings: 40, transition: 40, goalkeeper: 40,
    pressing: 40, setPieces: 40, aerial: 40, discipline: 40,
    zones: {
      leftDefense: 40, centerDefense: 40, rightDefense: 40,
      leftMidfield: 40, centerMidfield: 40, rightMidfield: 40,
      leftAttack: 40, centerAttack: 40, rightAttack: 40,
    },
    canCross: 40, canDribble: 40, canPass: 40, canShoot: 40, canCounter: 40,
  };
}