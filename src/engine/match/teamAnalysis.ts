import type { Club, Player, Attributes } from '../types';
import { getStartingXI } from '../data/generateData';

// ═══════════════════════════════════════════════
// EFEKTIF ATTRIBUTE (kondisyon, form, moral)
// ═══════════════════════════════════════════════

export function eff(player: Player, key: keyof Attributes): number {
  const base = player.attributes[key];
  const cond = 0.5 + (player.condition / 100) * 0.5;
  const form = 0.85 + (player.form / 100) * 0.15;
  const morale = 0.90 + (player.morale / 100) * 0.10;
  return base * cond * form * morale;
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
// TAKIM ANALİZİ — 6 BİRİM + BÖLGELER
// ═══════════════════════════════════════════════

export interface TeamAnalysis {
  // 6 ana birim
  attack: number;
  midfield: number;
  defense: number;
  wings: number;
  transition: number;
  goalkeeper: number;

  // Ek birimler
  pressing: number;
  setPieces: number;
  aerial: number;
  discipline: number;

  // Bölgesel güçler (8 bölge)
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

  // Hücum tipi yetenekleri
  canCross: number;       // Orta açma yeteneği
  canDribble: number;     // Çalım yeteneği
  canPass: number;        // Pas yeteneği
  canShoot: number;       // Uzaktan şut yeteneği
  canCounter: number;     // Kontra yeteneği
}

/**
 * Bir takımın tam analizini yap
 */
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

  // Pozisyon grupları
  const sts = workingXI.filter(p => p.position === 'ST');
  const amcs = workingXI.filter(p => p.position === 'AMC');
  const amls = workingXI.filter(p => p.position === 'AML' || p.position === 'ML');
  const amrs = workingXI.filter(p => p.position === 'AMR' || p.position === 'MR');
  const mcs = workingXI.filter(p => p.position === 'MC');
  const dms = workingXI.filter(p => p.position === 'DM');
  const dcs = workingXI.filter(p => p.position === 'DC');
  const dls = workingXI.filter(p => p.position === 'DL');
  const drs = workingXI.filter(p => p.position === 'DR');
  const gks = workingXI.filter(p => p.position === 'GK');

  const allMid = [...mcs, ...dms, ...amcs];
  const allDef = [...dcs, ...dls, ...drs, ...dms];
  const allWings = [...amls, ...amrs];
  const allAtt = [...sts, ...amcs, ...amls, ...amrs];

  // ═══ 1. HÜCUM ═══
  const attack = (
    avgEff(sts, 'finishing') * 0.30 +
    avgEff(sts, 'offTheBall') * 0.15 +
    avgEff(allAtt, 'shooting') * 0.15 +
    avgEff(allMid, 'passing') * 0.15 +
    avgEff(allAtt, 'dribbling') * 0.15 +
    avgEff(allAtt, 'pace') * 0.10
  );

  // ═══ 2. ORTA SAHA ═══
  const midfield = (
    avgEff(allMid, 'passing') * 0.25 +
    avgEff(allMid, 'vision') * 0.20 +
    avgEff(allMid, 'decisions') * 0.20 +
    avgEff(allMid, 'firstTouch') * 0.15 +
    avgEff(allMid, 'workRate') * 0.10 +
    avgEff(allMid, 'ballWinning') * 0.10
  );

  // ═══ 3. SAVUNMA ═══
  const defense = (
    avgEff(allDef, 'marking') * 0.25 +
    avgEff(allDef, 'tackling') * 0.25 +
    avgEff(allDef, 'defensivePositioning') * 0.20 +
    avgEff(allDef, 'anticipation') * 0.15 +
    avgEff(allDef, 'strength') * 0.10 +
    avgEff(allDef, 'decisions') * 0.05
  );

  // ═══ 4. KANATLAR ═══
  const wings = (
    avgEff(allWings, 'dribbling') * 0.25 +
    avgEff(allWings, 'crossing') * 0.25 +
    avgEff(allWings, 'pace') * 0.20 +
    avgEff(allWings, 'acceleration') * 0.15 +
    avgEff(allWings, 'offTheBall') * 0.15
  );

  // ═══ 5. GEÇİŞ (KONTRA) ═══
  const transition = (
    avgEff([...sts, ...amls, ...amrs], 'pace') * 0.30 +
    avgEff([...sts, ...amls, ...amrs], 'acceleration') * 0.25 +
    avgEff([...sts, ...amls, ...amrs], 'offTheBall') * 0.20 +
    avgEff([...sts, ...amls, ...amrs], 'decisions') * 0.15 +
    avgEff([...sts, ...amls, ...amrs], 'dribbling') * 0.10
  );

  // ═══ 6. KALECİ ═══
  const goalkeeper = gks.length > 0 ? (
    avgEff(gks, 'reflexes') * 0.30 +
    avgEff(gks, 'gkPositioning') * 0.25 +
    avgEff(gks, 'handling') * 0.20 +
    avgEff(gks, 'oneOnOne') * 0.15 +
    avgEff(gks, 'aerialReach') * 0.10
  ) : 40;

  // ═══ EK BİRİMLER ═══
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

  // ═══ BÖLGESEL GÜÇLER ═══
  const zones = {
    leftDefense: (
      avgEff(dls, 'marking') * 0.35 +
      avgEff(dls, 'tackling') * 0.30 +
      avgEff(dls, 'defensivePositioning') * 0.20 +
      avgEff(dls, 'pace') * 0.15
    ),
    centerDefense: (
      avgEff(dcs, 'marking') * 0.30 +
      avgEff(dcs, 'tackling') * 0.30 +
      avgEff(dcs, 'defensivePositioning') * 0.25 +
      avgEff(dcs, 'strength') * 0.15
    ),
    rightDefense: (
      avgEff(drs, 'marking') * 0.35 +
      avgEff(drs, 'tackling') * 0.30 +
      avgEff(drs, 'defensivePositioning') * 0.20 +
      avgEff(drs, 'pace') * 0.15
    ),
    leftMidfield: (
      avgEff([...amls, ...dls], 'passing') * 0.30 +
      avgEff([...amls, ...dls], 'dribbling') * 0.30 +
      avgEff([...amls, ...dls], 'pace') * 0.20 +
      avgEff([...amls, ...dls], 'workRate') * 0.20
    ),
    centerMidfield: (
      avgEff(allMid, 'passing') * 0.30 +
      avgEff(allMid, 'vision') * 0.25 +
      avgEff(allMid, 'decisions') * 0.20 +
      avgEff(allMid, 'ballWinning') * 0.15 +
      avgEff(allMid, 'workRate') * 0.10
    ),
    rightMidfield: (
      avgEff([...amrs, ...drs], 'passing') * 0.30 +
      avgEff([...amrs, ...drs], 'dribbling') * 0.30 +
      avgEff([...amrs, ...drs], 'pace') * 0.20 +
      avgEff([...amrs, ...drs], 'workRate') * 0.20
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

  // ═══ HÜCUM TİPİ YETENEKLERİ ═══
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