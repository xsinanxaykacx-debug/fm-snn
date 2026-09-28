import type { Player, Club, Attributes } from '../types';
import { getStartingXI } from '../data/generateData';

// ═══════════════════════════════════════════════
// YARDIMCILAR
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

export function weightedEff(
  player: Player,
  weights: Partial<Record<keyof Attributes, number>>
): number {
  let total = 0;
  let weightSum = 0;
  for (const [key, w] of Object.entries(weights) as [keyof Attributes, number][]) {
    total += eff(player, key) * w;
    weightSum += w;
  }
  return weightSum > 0 ? total / weightSum : 40;
}

export function sigmoid(a: number, b: number): number {
  return 100 / (1 + Math.exp(-(a - b) / 8));
}

// ═══════════════════════════════════════════════
// BOLGESEL GUC
// ═══════════════════════════════════════════════

export interface ZoneStrength {
  zone: string;
  attackPower: number;
  defensePower: number;
  players: Player[];
}

export function calculateZones(
  club: Club,
  players: Record<string, Player>
): Record<string, ZoneStrength> {
  const xi = getStartingXI(club.id, players, club.tactic.formation);

  const cbs = xi.filter(p => p.position === 'DC');
  const lbs = xi.filter(p => p.position === 'DL');
  const rbs = xi.filter(p => p.position === 'DR');
  const dms = xi.filter(p => p.position === 'DM');
  const mcs = xi.filter(p => p.position === 'MC' || p.position === 'DM');
  const mls = xi.filter(p => p.position === 'ML');
  const mrs = xi.filter(p => p.position === 'MR');
  const amcs = xi.filter(p => p.position === 'AMC' || p.position === 'MC');
  const amls = xi.filter(p => p.position === 'AML' || p.position === 'ML');
  const amrs = xi.filter(p => p.position === 'AMR' || p.position === 'MR');
  const sts = xi.filter(p => p.position === 'ST');

  return {
    leftDefense: {
      zone: 'Sol Savunma',
      attackPower: avgEff([...lbs, ...amls.slice(0, 1)], 'crossing') * 0.5 + avgEff(lbs, 'pace') * 0.5,
      defensePower: avgEff([...lbs, ...cbs.slice(0, 1)], 'marking') * 0.4 +
                    avgEff([...lbs, ...cbs.slice(0, 1)], 'tackling') * 0.4 +
                    avgEff([...lbs, ...cbs.slice(0, 1)], 'defensivePositioning') * 0.2,
      players: [...lbs, ...cbs.slice(0, 1)],
    },
    centerDefense: {
      zone: 'Merkez Savunma',
      attackPower: avgEff(cbs, 'heading') * 0.5 + avgEff(cbs, 'passing') * 0.5,
      defensePower: avgEff(cbs, 'marking') * 0.3 +
                    avgEff(cbs, 'tackling') * 0.3 +
                    avgEff(cbs, 'defensivePositioning') * 0.2 +
                    avgEff(cbs, 'strength') * 0.2,
      players: cbs,
    },
    rightDefense: {
      zone: 'Sağ Savunma',
      attackPower: avgEff([...rbs, ...amrs.slice(0, 1)], 'crossing') * 0.5 + avgEff(rbs, 'pace') * 0.5,
      defensePower: avgEff([...rbs, ...cbs.slice(0, 1)], 'marking') * 0.4 +
                    avgEff([...rbs, ...cbs.slice(0, 1)], 'tackling') * 0.4 +
                    avgEff([...rbs, ...cbs.slice(0, 1)], 'defensivePositioning') * 0.2,
      players: [...rbs, ...cbs.slice(0, 1)],
    },
    leftMidfield: {
      zone: 'Sol Orta',
      attackPower: avgEff([...mls, ...lbs], 'passing') * 0.3 +
                   avgEff([...mls, ...lbs], 'dribbling') * 0.3 +
                   avgEff([...mls, ...lbs], 'pace') * 0.2 +
                   avgEff([...mls, ...lbs], 'workRate') * 0.2,
      defensePower: avgEff([...mls, ...lbs], 'marking') * 0.4 +
                    avgEff([...mls, ...lbs], 'ballWinning') * 0.3 +
                    avgEff([...mls, ...lbs], 'workRate') * 0.3,
      players: [...mls, ...lbs],
    },
    centerMidfield: {
      zone: 'Merkez Orta',
      attackPower: avgEff([...mcs, ...amcs], 'passing') * 0.3 +
                   avgEff([...mcs, ...amcs], 'vision') * 0.3 +
                   avgEff([...mcs, ...amcs], 'decisions') * 0.2 +
                   avgEff([...mcs, ...amcs], 'firstTouch') * 0.2,
      defensePower: avgEff([...mcs, ...dms], 'ballWinning') * 0.3 +
                    avgEff([...mcs, ...dms], 'tackling') * 0.3 +
                    avgEff([...mcs, ...dms], 'positioning') * 0.2 +
                    avgEff([...mcs, ...dms], 'workRate') * 0.2,
      players: [...mcs, ...amcs, ...dms],
    },
    rightMidfield: {
      zone: 'Sağ Orta',
      attackPower: avgEff([...mrs, ...rbs], 'passing') * 0.3 +
                   avgEff([...mrs, ...rbs], 'dribbling') * 0.3 +
                   avgEff([...mrs, ...rbs], 'pace') * 0.2 +
                   avgEff([...mrs, ...rbs], 'workRate') * 0.2,
      defensePower: avgEff([...mrs, ...rbs], 'marking') * 0.4 +
                    avgEff([...mrs, ...rbs], 'ballWinning') * 0.3 +
                    avgEff([...mrs, ...rbs], 'workRate') * 0.3,
      players: [...mrs, ...rbs],
    },
    leftAttack: {
      zone: 'Sol Hucum',
      attackPower: avgEff([...amls, ...sts], 'dribbling') * 0.25 +
                   avgEff([...amls, ...sts], 'crossing') * 0.25 +
                   avgEff([...amls, ...sts], 'finishing') * 0.20 +
                   avgEff([...amls, ...sts], 'pace') * 0.15 +
                   avgEff([...amls, ...sts], 'offTheBall') * 0.15,
      defensePower: 30,
      players: [...amls, ...sts.slice(0, 1)],
    },
    centerAttack: {
      zone: 'Merkez Hucum',
      attackPower: avgEff([...sts, ...amcs], 'finishing') * 0.30 +
                   avgEff([...sts, ...amcs], 'offTheBall') * 0.20 +
                   avgEff([...sts, ...amcs], 'shooting') * 0.20 +
                   avgEff([...sts, ...amcs], 'firstTouch') * 0.15 +
                   avgEff([...sts, ...amcs], 'decisions') * 0.15,
      defensePower: 30,
      players: [...sts, ...amcs],
    },
    rightAttack: {
      zone: 'Sag Hucum',
      attackPower: avgEff([...amrs, ...sts], 'dribbling') * 0.25 +
                   avgEff([...amrs, ...sts], 'crossing') * 0.25 +
                   avgEff([...amrs, ...sts], 'finishing') * 0.20 +
                   avgEff([...amrs, ...sts], 'pace') * 0.15 +
                   avgEff([...amrs, ...sts], 'offTheBall') * 0.15,
      defensePower: 30,
      players: [...amrs, ...sts.slice(0, 1)],
    },
  };
}

// ═══════════════════════════════════════════════
// BOLGESEL ESLESME
// ═══════════════════════════════════════════════

export interface ZoneMatchup {
  attackZone: string;
  defenseZone: string;
  attackPower: number;
  defensePower: number;
  advantagePct: number;
  favored: 'attack' | 'defense' | 'neutral';
}

export function calculateZoneMatchups(
  attackZones: Record<string, ZoneStrength>,
  defenseZones: Record<string, ZoneStrength>
): ZoneMatchup[] {
  const pairs: [string, string, string][] = [
    ['leftAttack', 'rightDefense', 'A Sol Kanat -> B Sag Bek'],
    ['rightAttack', 'leftDefense', 'A Sag Kanat -> B Sol Bek'],
    ['centerAttack', 'centerDefense', 'A Merkez -> B Merkez Savunma'],
    ['leftMidfield', 'rightMidfield', 'A Sol Orta -> B Sag Orta'],
    ['centerMidfield', 'centerMidfield', 'A Merkez Orta -> B Merkez Orta'],
    ['rightMidfield', 'leftMidfield', 'A Sag Orta -> B Sol Orta'],
  ];

  return pairs.map(([atkKey, defKey]) => {
    const atk = attackZones[atkKey];
    const def = defenseZones[defKey];
    const advPct = sigmoid(atk.attackPower, def.defensePower);
    let favored: 'attack' | 'defense' | 'neutral';
    if (advPct > 55) favored = 'attack';
    else if (advPct < 45) favored = 'defense';
    else favored = 'neutral';

    return {
      attackZone: atk.zone,
      defenseZone: def.zone,
      attackPower: Math.round(atk.attackPower * 10) / 10,
      defensePower: Math.round(def.defensePower * 10) / 10,
      advantagePct: Math.round(advPct * 10) / 10,
      favored,
    };
  });
}

// ═══════════════════════════════════════════════
// BOLGE SECIMI (exp tabanli)
// ═══════════════════════════════════════════════

export type AttackZone = 'left' | 'center' | 'right';

export interface ZoneChoice {
  zone: AttackZone;
  advantagePct: number;
}

export function selectZoneWeighted(matchups: ZoneMatchup[]): ZoneChoice {
  const leftMatchup = matchups.find(m => m.attackZone.includes('Sol Hucum') || m.attackZone.includes('Sol Orta'));
  const centerMatchup = matchups.find(m => m.attackZone.includes('Merkez Hucum') || m.attackZone.includes('Merkez Orta'));
  const rightMatchup = matchups.find(m => m.attackZone.includes('Sag Hucum') || m.attackZone.includes('Sag Orta'));

  const leftAdv = leftMatchup ? leftMatchup.advantagePct : 50;
  const centerAdv = centerMatchup ? centerMatchup.advantagePct : 50;
  const rightAdv = rightMatchup ? rightMatchup.advantagePct : 50;

  const wLeft = Math.exp(leftAdv / 15);
  const wCenter = Math.exp(centerAdv / 15);
  const wRight = Math.exp(rightAdv / 15);

  const total = wLeft + wCenter + wRight;
  let r = Math.random() * total;

  if (r < wLeft) return { zone: 'left', advantagePct: leftAdv };
  r -= wLeft;
  if (r < wCenter) return { zone: 'center', advantagePct: centerAdv };
  return { zone: 'right', advantagePct: rightAdv };
}

// ═══════════════════════════════════════════════
// ESKI FONKSIYON (uyumluluk)
// ═══════════════════════════════════════════════

export function selectAttackZone(matchups: ZoneMatchup[]): {
  zone: string;
  type: 'left' | 'center' | 'right';
} {
  const choice = selectZoneWeighted(matchups);
  const zoneMap: Record<AttackZone, string> = {
    left: 'leftAttack',
    center: 'centerAttack',
    right: 'rightAttack',
  };
  return { zone: zoneMap[choice.zone], type: choice.zone };
}