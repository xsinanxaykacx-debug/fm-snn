import type { Club, Player, TeamUnits, UnitComparison, Formation } from '../types';
import { getStartingXI } from '../data/generateData';

/**
 * İki sayıyı sigmoid ile üstünlük yüzdesine çevir
 * Fark +10 → %73, +5 → %62, 0 → %50, -5 → %38
 */
export function sigmoidAdvantage(a: number, b: number): number {
  const diff = a - b;
  return 100 / (1 + Math.exp(-diff / 10));
}

/**
 * Bir oyuncunun efektif attribute değeri
 * Temel × Kondisyon × Form × Moral × Pozisyon Uygunluğu
 */
export function effectiveAttribute(
  player: Player,
  attrKey: keyof Player['attributes']
): number {
  const base = player.attributes[attrKey];
  const cond = player.condition / 100;         // 0-1
  const form = 0.85 + (player.form / 100) * 0.15;  // 0.85-1.0
  const morale = 0.90 + (player.morale / 100) * 0.10; // 0.90-1.0
  return base * cond * form * morale;
}

/**
 * Belirli pozisyondaki oyuncuların ortalama efektif attribute'u
 */
function avgEff(
  xi: Player[],
  positions: string[],
  key: keyof Player['attributes']
): number {
  const filtered = xi.filter(p => positions.includes(p.position));
  if (filtered.length === 0) return 40;
  return filtered.reduce((s, p) => s + effectiveAttribute(p, key), 0) / filtered.length;
}

/**
 * Top N oyuncunun ortalaması
 */
function topNAvg(
  xi: Player[],
  key: keyof Player['attributes'],
  n: number = 3
): number {
  if (xi.length === 0) return 40;
  const sorted = [...xi].sort((a, b) => b.attributes[key] - a.attributes[key]);
  const top = sorted.slice(0, n);
  return top.reduce((s, p) => s + effectiveAttribute(p, key), 0) / top.length;
}

/**
 * Tüm takımın ortalama efektif attribute'u
 */
function teamAvg(xi: Player[], key: keyof Player['attributes']): number {
  if (xi.length === 0) return 40;
  return xi.reduce((s, p) => s + effectiveAttribute(p, key), 0) / xi.length;
}

/**
 * Formasyona göre ağırlıklar
 */
function getFormationWeights(formation: Formation) {
  switch (formation) {
    case '4-3-3':
      return { attack: 1.05, midfield: 1.10, defense: 0.95, wings: 1.15, transition: 1.10 };
    case '3-5-2':
      return { attack: 1.00, midfield: 1.15, defense: 0.90, wings: 1.05, transition: 1.00 };
    case '4-2-3-1':
      return { attack: 0.95, midfield: 1.10, defense: 1.05, wings: 1.05, transition: 1.05 };
    case '4-4-2':
    default:
      return { attack: 1.00, midfield: 1.00, defense: 1.00, wings: 1.00, transition: 1.00 };
  }
}

/**
 * 6 birimli takım gücünü hesapla
 */
export function calculateTeamUnits(
  club: Club,
  players: Record<string, Player>
): TeamUnits {
  const xi = getStartingXI(club.id, players, club.tactic.formation);
  const allPlayers = Object.values(players).filter(p => p.clubId === club.id);
  const workingXI = xi.length >= 11 ? xi : allPlayers.slice(0, 11);

  if (workingXI.length === 0) {
    return { attack: 40, midfield: 40, defense: 40, wings: 40, transition: 40, goalkeeper: 40, overall: 40 };
  }

  const weights = getFormationWeights(club.tactic.formation);

  // ═══ 1. HÜCUM ═══
  // Forvetlerin bitiricilik + topsuz alan + hız
  // Kanatların orta + dripling
  // AMC'nin pas + vizyon
  const stFinishing = avgEff(workingXI, ['ST'], 'finishing');
  const stOffBall = avgEff(workingXI, ['ST'], 'offTheBall');
  const stPace = avgEff(workingXI, ['ST'], 'pace');
  const amcVision = avgEff(workingXI, ['AMC'], 'vision');
  const wingerCrossing = avgEff(workingXI, ['ML', 'MR', 'AML', 'AMR'], 'crossing');
  const wingerDribbling = avgEff(workingXI, ['ML', 'MR', 'AML', 'AMR'], 'dribbling');
  const mcPassing = avgEff(workingXI, ['MC', 'DM'], 'passing');

  const attack = (
    stFinishing * 0.25 +
    stOffBall * 0.15 +
    stPace * 0.10 +
    amcVision * 0.10 +
    wingerCrossing * 0.10 +
    wingerDribbling * 0.10 +
    mcPassing * 0.20
  ) * weights.attack;

  // ═══ 2. ORTA SAHA ═══
  // Pas + vizyon + karar + çalışkanlık + top kapma
  const mcPassingV2 = avgEff(workingXI, ['MC', 'DM', 'AMC'], 'passing');
  const mcVision = avgEff(workingXI, ['MC', 'DM', 'AMC'], 'vision');
  const mcDecisions = avgEff(workingXI, ['MC', 'DM', 'AMC'], 'decisions');
  const mcWorkRate = avgEff(workingXI, ['MC', 'DM', 'AMC'], 'workRate');
  const mcBallWinning = avgEff(workingXI, ['MC', 'DM', 'AMC'], 'ballWinning');

  const midfield = (
    mcPassingV2 * 0.25 +
    mcVision * 0.20 +
    mcDecisions * 0.20 +
    mcWorkRate * 0.15 +
    mcBallWinning * 0.20
  ) * weights.midfield;

  // ═══ 3. SAVUNMA ═══
  // Markaj + müdahale + savunma pozisyonu + güç + sezgi
  const defMarking = avgEff(workingXI, ['DC', 'DL', 'DR'], 'marking');
  const defTackling = avgEff(workingXI, ['DC', 'DL', 'DR'], 'tackling');
  const defPositioning = avgEff(workingXI, ['DC', 'DL', 'DR'], 'defensivePositioning');
  const defStrength = avgEff(workingXI, ['DC', 'DL', 'DR'], 'strength');
  const defAnticipation = avgEff(workingXI, ['DC', 'DL', 'DR'], 'anticipation');
  const dmCover = avgEff(workingXI, ['DM'], 'ballWinning');

  const defense = (
    defMarking * 0.25 +
    defTackling * 0.25 +
    defPositioning * 0.20 +
    defStrength * 0.10 +
    defAnticipation * 0.10 +
    dmCover * 0.10
  ) * weights.defense;

  // ═══ 4. KANATLAR ═══
  // Kanat oyuncularının hız + dripling + orta + topsuz alan
  const wingPace = avgEff(workingXI, ['ML', 'MR', 'AML', 'AMR'], 'pace');
  const wingDribblingV2 = avgEff(workingXI, ['ML', 'MR', 'AML', 'AMR'], 'dribbling');
  const wingCrossing = avgEff(workingXI, ['ML', 'MR', 'AML', 'AMR'], 'crossing');
  const wingOffBall = avgEff(workingXI, ['ML', 'MR', 'AML', 'AMR'], 'offTheBall');
  const wingAcceleration = avgEff(workingXI, ['ML', 'MR', 'AML', 'AMR'], 'acceleration');

  const wings = (
    wingPace * 0.25 +
    wingDribblingV2 * 0.25 +
    wingCrossing * 0.20 +
    wingOffBall * 0.15 +
    wingAcceleration * 0.15
  ) * weights.wings;

  // ═══ 5. GEÇİŞ (Kontra) ═══
  // En hızlı oyuncuların ivme + hız + topsuz alan + karar
  const topPace = topNAvg(workingXI, 'pace', 3);
  const topAccel = topNAvg(workingXI, 'acceleration', 3);
  const topOffBall = topNAvg(workingXI, 'offTheBall', 3);
  const topDecisions = topNAvg(workingXI, 'decisions', 3);

  const transition = (
    topPace * 0.30 +
    topAccel * 0.25 +
    topOffBall * 0.20 +
    topDecisions * 0.25
  ) * weights.transition;

  // ═══ 6. KALECİ ═══
  const gkReflexes = avgEff(workingXI, ['GK'], 'reflexes');
  const gkPositioning = avgEff(workingXI, ['GK'], 'gkPositioning');
  const gkHandling = avgEff(workingXI, ['GK'], 'handling');
  const gkOneOnOne = avgEff(workingXI, ['GK'], 'oneOnOne');
  const gkAerial = avgEff(workingXI, ['GK'], 'aerialReach');

  const goalkeeper = (
    gkReflexes * 0.25 +
    gkPositioning * 0.25 +
    gkHandling * 0.20 +
    gkOneOnOne * 0.15 +
    gkAerial * 0.15
  );

  const overall = (attack + midfield + defense + wings + transition + goalkeeper) / 6;

  return {
    attack: r1(attack),
    midfield: r1(midfield),
    defense: r1(defense),
    wings: r1(wings),
    transition: r1(transition),
    goalkeeper: r1(goalkeeper),
    overall: r1(overall),
  };
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * İki takımın birimlerini karşılaştır
 */
export function compareUnits(home: TeamUnits, away: TeamUnits): UnitComparison[] {
  const units: { key: keyof TeamUnits; label: string; icon: string }[] = [
    { key: 'attack', label: 'Hücum', icon: '⚔️' },
    { key: 'midfield', label: 'Orta Saha', icon: '🎯' },
    { key: 'defense', label: 'Savunma', icon: '🛡️' },
    { key: 'wings', label: 'Kanatlar', icon: '🏃' },
    { key: 'transition', label: 'Geçiş', icon: '⚡' },
    { key: 'goalkeeper', label: 'Kaleci', icon: '🧤' },
  ];

  return units.map(({ key, label, icon }) => {
    const h = home[key] as number;
    const a = away[key] as number;
    const advantagePct = sigmoidAdvantage(h, a);
    let favored: 'home' | 'away' | 'neutral';
    if (advantagePct > 55) favored = 'home';
    else if (advantagePct < 45) favored = 'away';
    else favored = 'neutral';

    return {
      unit: label,
      icon,
      homeValue: h,
      awayValue: a,
      advantagePct: Math.round(advantagePct * 10) / 10,
      favored,
    };
  });
}

/**
 * Bir değerin rengi
 */
export function unitRating(value: number): { label: string; color: string } {
  if (value >= 80) return { label: 'Elit', color: 'text-green-400' };
  if (value >= 70) return { label: 'Çok İyi', color: 'text-green-300' };
  if (value >= 60) return { label: 'İyi', color: 'text-yellow-400' };
  if (value >= 50) return { label: 'Orta', color: 'text-orange-400' };
  if (value >= 40) return { label: 'Zayıf', color: 'text-red-400' };
  return { label: 'Kritik', color: 'text-red-500' };
}