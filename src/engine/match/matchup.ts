import type { Player, Club, Attributes } from '../types';
import { getStartingXI } from '../data/generateData';

/**
 * ═══════════════════════════════════════════════
 * BÖLGESEL EŞLEŞME MOTORU (KATMAN 4)
 * ═══════════════════════════════════════════════
 *
 * 8 saha bölgesi:
 *  1. SOL SAVUNMA   (A'nın sol kanadı → B'nin sağ kanadı)
 *  2. MERKEZ SAVUNMA
 *  3. SAĞ SAVUNMA
 *  4. SOL ORTA
 *  5. MERKEZ ORTA
 *  6. SAĞ ORTA
 *  7. SOL HÜCUM
 *  8. SAĞ HÜCUM
 */

export interface ZonePlayer {
  player: Player;
  effectiveAttrs: Partial<Attributes>;
}

/**
 * Efektif attribute — kondisyon, form, moral çarpanı
 */
export function eff(player: Player, key: keyof Attributes): number {
  const base = player.attributes[key];
  const cond = 0.5 + (player.condition / 100) * 0.5;
  const form = 0.85 + (player.form / 100) * 0.15;
  const morale = 0.90 + (player.morale / 100) * 0.10;
  return base * cond * form * morale;
}

/**
 * Ortalama efektif attribute (oyuncu grubu)
 */
export function avgEff(players: Player[], key: keyof Attributes): number {
  if (players.length === 0) return 40;
  return players.reduce((s, p) => s + eff(p, key), 0) / players.length;
}

/**
 * Ağırlıklı attribute hesaplama
 */
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

// ═══════════════════════════════════════════════
// BÖLGESEL GÜÇ HESAPLAMA
// ═══════════════════════════════════════════════

export interface ZoneStrength {
  zone: string;
  attackPower: number;   // Bu bölgeden hücum gücü
  defensePower: number;  // Bu bölgeyi savunma gücü
  players: Player[];     // Bu bölgedeki oyuncular
}

/**
 * Bir takımın 8 bölgesini hesapla
 */
export function calculateZones(
  club: Club,
  players: Record<string, Player>
): Record<string, ZoneStrength> {
  const xi = getStartingXI(club.id, players, club.tactic.formation);

  const gk = xi.filter(p => p.position === 'GK');
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
    // SAVUNMA BÖLGELERİ (kendi kalemize yakın)
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

    // ORTA SAHA BÖLGELERİ
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

    // HÜCUM BÖLGELERİ
    leftAttack: {
      zone: 'Sol Hücum',
      attackPower: avgEff([...amls, ...sts], 'dribbling') * 0.25 +
                   avgEff([...amls, ...sts], 'crossing') * 0.25 +
                   avgEff([...amls, ...sts], 'finishing') * 0.20 +
                   avgEff([...amls, ...sts], 'pace') * 0.15 +
                   avgEff([...amls, ...sts], 'offTheBall') * 0.15,
      defensePower: 30, // hücum bölgesi, savunma zayıf
      players: [...amls, ...sts.slice(0, 1)],
    },
    centerAttack: {
      zone: 'Merkez Hücum',
      attackPower: avgEff([...sts, ...amcs], 'finishing') * 0.30 +
                   avgEff([...sts, ...amcs], 'offTheBall') * 0.20 +
                   avgEff([...sts, ...amcs], 'shooting') * 0.20 +
                   avgEff([...sts, ...amcs], 'firstTouch') * 0.15 +
                   avgEff([...sts, ...amcs], 'decisions') * 0.15,
      defensePower: 30,
      players: [...sts, ...amcs],
    },
    rightAttack: {
      zone: 'Sağ Hücum',
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
// BÖLGESEL EŞLEŞME (KİM KİME KARŞI)
// ═══════════════════════════════════════════════

export interface ZoneMatchup {
  attackZone: string;      // A'nın hücum ettiği bölge
  defenseZone: string;     // B'nin savunduğu bölge
  attackPower: number;
  defensePower: number;
  advantagePct: number;    // Sigmoid üstünlük
  favored: 'attack' | 'defense' | 'neutral';
}

/**
 * Sigmoid üstünlük
 */
export function sigmoid(a: number, b: number): number {
  return 100 / (1 + Math.exp(-(a - b) / 8));
}

/**
 * A takımının B'ye karşı bölgesel eşleşmelerini hesapla
 */
export function calculateZoneMatchups(
  attackZones: Record<string, ZoneStrength>,
  defenseZones: Record<string, ZoneStrength>
): ZoneMatchup[] {
  // A'nın hücum bölgeleri vs B'nin savunma bölgeleri
  const pairs: [string, string, string][] = [
    ['leftAttack', 'rightDefense', 'A Sol Kanat → B Sağ Bek'],
    ['rightAttack', 'leftDefense', 'A Sağ Kanat → B Sol Bek'],
    ['centerAttack', 'centerDefense', 'A Merkez → B Merkez Savunma'],
    ['leftMidfield', 'rightMidfield', 'A Sol Orta → B Sağ Orta'],
    ['centerMidfield', 'centerMidfield', 'A Merkez Orta → B Merkez Orta'],
    ['rightMidfield', 'leftMidfield', 'A Sağ Orta → B Sol Orta'],
  ];

  return pairs.map(([atkKey, defKey, label]) => {
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

/**
 * Hücum tipi seçimi — hangi bölgeden saldırı?
 * En zayıf rakibe göre ağırlıklı seçim
 */
export function selectAttackZone(matchups: ZoneMatchup[]): {
  zone: string;
  type: 'left' | 'center' | 'right';
} {
  // Her matchup için ağırlık = advantagePct
  const attackOptions: { zone: string; type: 'left' | 'center' | 'right'; weight: number }[] = [
    { zone: 'leftAttack', type: 'left', weight: matchups[0].advantagePct },
    { zone: 'rightAttack', type: 'right', weight: matchups[1].advantagePct },
    { zone: 'centerAttack', type: 'center', weight: matchups[2].advantagePct },
  ];

  // Ağırlıklı seçim
  const totalWeight = attackOptions.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * totalWeight;
  for (const opt of attackOptions) {
    r -= opt.weight;
    if (r <= 0) return { zone: opt.zone, type: opt.type };
  }
  return { zone: 'centerAttack', type: 'center' };
}