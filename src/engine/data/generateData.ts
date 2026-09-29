// src/engine/data/generateData.ts

import type {
  Attributes,
  CareerStats,
  Club,
  Formation,
  Player,
  Position,
  Tactic,
} from '../types';

// ═══════════════════════════════════════════════
// SABİTLER
// ═══════════════════════════════════════════════

export const MIN_AGE = 15;
export const MAX_AGE = 35;
export const RETIREMENT_AGE = 35;  // 35 yaşında son sezon, 36'da emekli

const FIRST_NAMES = [
  'Luis', 'Marco', 'Carlos', 'Diego', 'Juan', 'Pedro', 'Miguel', 'Sergio', 'Andres', 'Javier',
  'Emre', 'Mehmet', 'Can', 'Hakan', 'Ozan', 'Yusuf', 'Burak', 'Arda', 'Cenk', 'Kerem',
  'John', 'Michael', 'William', 'Robert', 'James', 'Thomas', 'Daniel', 'David', 'Paul', 'Peter',
  'Leo', 'Theo', 'Luca', 'Kaan', 'Mert', 'Ali', 'Efe', 'Poyraz', 'Miraç', 'Alp',
];

const LAST_NAMES = [
  'Kaya', 'Demir', 'Yılmaz', 'Çelik', 'Şahin', 'Yıldız', 'Aydın', 'Öztürk', 'Arslan', 'Doğan',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Silva', 'Santos', 'Ferreira', 'Costa', 'Oliveira', 'Pereira', 'Romano', 'Esposito', 'Rossi', 'Ferrari',
  'Yalçın', 'Koç', 'Kurt', 'Özdemir', 'Erdoğan', 'Aslan', 'Çetin', 'Kılıç', 'Aksoy', 'Polat',
];

const NATIONALITIES = ['TR', 'EN', 'DE', 'FR', 'ES', 'IT', 'BR', 'AR', 'NL', 'PT'];

// ═══════════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fmRandom(avg = 10, spread = 3): number {
  const base = avg + (Math.random() - 0.5) * spread * 2;
  return Math.max(1, Math.min(20, Math.round(base)));
}

function randomName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

function randomNationality(): string {
  return NATIONALITIES[Math.floor(Math.random() * NATIONALITIES.length)];
}

// ═══════════════════════════════════════════════
// YAŞ DAĞILIMI (15-35)
// ═══════════════════════════════════════════════

function generateAge(): number {
  const roll = Math.random();
  if (roll < 0.10) return 15 + Math.floor(Math.random() * 3);   // 15-17
  if (roll < 0.30) return 18 + Math.floor(Math.random() * 4);   // 18-21
  if (roll < 0.55) return 22 + Math.floor(Math.random() * 4);   // 22-25
  if (roll < 0.80) return 26 + Math.floor(Math.random() * 4);   // 26-29
  if (roll < 0.95) return 30 + Math.floor(Math.random() * 3);   // 30-32
  return 33 + Math.floor(Math.random() * 3);                     // 33-35
}

function ageAttributeBias(age: number): number {
  if (age <= 16) return -4;
  if (age <= 18) return -3;
  if (age <= 20) return -2;
  if (age <= 22) return -1;
  if (age <= 26) return 0;
  if (age <= 29) return 0;
  if (age <= 31) return -0.5;
  if (age <= 33) return -1;
  return -1.5;
}

export function createEmptyCareerStats(): CareerStats {
  return {
    appearances: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0,
    avgRating: 0, minutesPlayed: 0, motm: 0,
    seasonAppearances: 0, seasonGoals: 0, seasonAssists: 0,
    seasonYellowCards: 0, seasonRedCards: 0, seasonAvgRating: 0,
    seasonMinutesPlayed: 0, seasonMotm: 0,
  };
}

// ═══════════════════════════════════════════════
// İKİNCİL MEVKİ
// ═══════════════════════════════════════════════

const SECONDARY_POSITION_MAP: Record<Position, Position[]> = {
  'GK': [],
  'DC': ['DM'],
  'DL': ['ML', 'DC'],
  'DR': ['MR', 'DC'],
  'DM': ['MC', 'DC'],
  'MC': ['DM', 'AMC'],
  'ML': ['AML', 'DL'],
  'MR': ['AMR', 'DR'],
  'AMC': ['MC', 'ST'],
  'AML': ['ML', 'ST'],
  'AMR': ['MR', 'ST'],
  'ST': ['AMC', 'AML', 'AMR'],
};

function generateSecondaryPositions(position: Position): Position[] {
  const candidates = SECONDARY_POSITION_MAP[position] ?? [];
  if (candidates.length === 0) return [];
  const count = Math.random() < 0.6 ? 1 : Math.random() < 0.3 ? 2 : 0;
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ═══════════════════════════════════════════════
// ATTRIBUTE ÜRETİMİ
// ═══════════════════════════════════════════════

function randomAttributes(position: Position, age: number): Attributes {
  const bias = ageAttributeBias(age);
  const base = (avg = 10) => fmRandom(Math.max(3, avg + bias), 4);

  const a: Attributes = {
    passing: base(), firstTouch: base(), dribbling: base(), crossing: base(),
    shooting: base(), finishing: base(), technique: base(), heading: base(),
    setPieces: base(), longShots: base(),

    decisions: base(), vision: base(), anticipation: base(), positioning: base(),
    offTheBall: base(), concentration: base(), composure: base(), workRate: base(),
    teamwork: base(), bravery: base(), aggression: base(),

    pace: base(), acceleration: base(), agility: base(), stamina: base(),
    strength: base(), balance: base(),

    marking: base(), tackling: base(), ballWinning: base(), defensivePositioning: base(),

    goalkeeper: fmRandom(3, 2), reflexes: fmRandom(3, 2), gkPositioning: fmRandom(3, 2),
    handling: fmRandom(3, 2), oneOnOne: fmRandom(3, 2), aerialReach: fmRandom(3, 2),
  };

  if (position === 'GK') {
    a.goalkeeper = fmRandom(Math.max(3, 15 + bias), 3);
    a.reflexes = fmRandom(Math.max(3, 15 + bias), 3);
    a.gkPositioning = fmRandom(Math.max(3, 15 + bias), 3);
    a.handling = fmRandom(Math.max(3, 14 + bias), 3);
    a.oneOnOne = fmRandom(Math.max(3, 14 + bias), 3);
    a.aerialReach = fmRandom(Math.max(3, 14 + bias), 3);
    a.concentration = fmRandom(Math.max(3, 13 + bias), 3);
    a.decisions = fmRandom(Math.max(3, 12 + bias), 3);
    a.finishing = fmRandom(3, 1);
    a.shooting = fmRandom(4, 2);
    a.dribbling = fmRandom(4, 2);
    a.crossing = fmRandom(4, 2);
    a.marking = fmRandom(3, 1);
    a.tackling = fmRandom(3, 1);
    a.pace = fmRandom(Math.max(3, 7 + bias), 3);
    a.offTheBall = fmRandom(4, 2);
  } else if (position === 'DC') {
    a.marking = fmRandom(Math.max(3, 15 + bias), 3);
    a.tackling = fmRandom(Math.max(3, 15 + bias), 3);
    a.defensivePositioning = fmRandom(Math.max(3, 14 + bias), 3);
    a.heading = fmRandom(Math.max(3, 14 + bias), 3);
    a.strength = fmRandom(Math.max(3, 14 + bias), 3);
    a.anticipation = fmRandom(Math.max(3, 13 + bias), 3);
    a.concentration = fmRandom(Math.max(3, 13 + bias), 3);
    a.bravery = fmRandom(Math.max(3, 13 + bias), 3);
    a.finishing = fmRandom(4, 2);
    a.shooting = fmRandom(5, 2);
    a.dribbling = fmRandom(6, 3);
    a.crossing = fmRandom(6, 3);
    a.longShots = fmRandom(4, 2);
    a.pace = fmRandom(Math.max(3, 10 + bias), 3);
  } else if (position === 'DL' || position === 'DR') {
    a.marking = fmRandom(Math.max(3, 13 + bias), 3);
    a.tackling = fmRandom(Math.max(3, 13 + bias), 3);
    a.defensivePositioning = fmRandom(Math.max(3, 12 + bias), 3);
    a.pace = fmRandom(Math.max(3, 14 + bias), 3);
    a.acceleration = fmRandom(Math.max(3, 14 + bias), 3);
    a.stamina = fmRandom(Math.max(3, 14 + bias), 3);
    a.crossing = fmRandom(Math.max(3, 12 + bias), 3);
    a.workRate = fmRandom(Math.max(3, 13 + bias), 3);
    a.finishing = fmRandom(5, 2);
    a.shooting = fmRandom(6, 2);
    a.heading = fmRandom(9, 3);
    a.longShots = fmRandom(5, 2);
    a.strength = fmRandom(10, 3);
  } else if (position === 'DM') {
    a.passing = fmRandom(Math.max(3, 14 + bias), 3);
    a.tackling = fmRandom(Math.max(3, 14 + bias), 3);
    a.ballWinning = fmRandom(Math.max(3, 14 + bias), 3);
    a.positioning = fmRandom(Math.max(3, 14 + bias), 3);
    a.decisions = fmRandom(Math.max(3, 13 + bias), 3);
    a.workRate = fmRandom(Math.max(3, 14 + bias), 3);
    a.stamina = fmRandom(Math.max(3, 14 + bias), 3);
    a.teamwork = fmRandom(Math.max(3, 13 + bias), 3);
    a.finishing = fmRandom(6, 2);
    a.shooting = fmRandom(7, 3);
    a.dribbling = fmRandom(9, 3);
    a.crossing = fmRandom(8, 3);
    a.pace = fmRandom(10, 3);
  } else if (position === 'MC') {
    a.passing = fmRandom(Math.max(3, 15 + bias), 3);
    a.vision = fmRandom(Math.max(3, 13 + bias), 3);
    a.decisions = fmRandom(Math.max(3, 14 + bias), 3);
    a.technique = fmRandom(Math.max(3, 13 + bias), 3);
    a.firstTouch = fmRandom(Math.max(3, 13 + bias), 3);
    a.workRate = fmRandom(Math.max(3, 13 + bias), 3);
    a.stamina = fmRandom(Math.max(3, 13 + bias), 3);
    a.teamwork = fmRandom(Math.max(3, 13 + bias), 3);
    a.finishing = fmRandom(8, 3);
    a.heading = fmRandom(9, 3);
    a.marking = fmRandom(10, 3);
    a.tackling = fmRandom(10, 3);
  } else if (position === 'ML' || position === 'MR') {
    a.pace = fmRandom(Math.max(3, 14 + bias), 3);
    a.acceleration = fmRandom(Math.max(3, 14 + bias), 3);
    a.dribbling = fmRandom(Math.max(3, 14 + bias), 3);
    a.crossing = fmRandom(Math.max(3, 14 + bias), 3);
    a.stamina = fmRandom(Math.max(3, 14 + bias), 3);
    a.agility = fmRandom(Math.max(3, 13 + bias), 3);
    a.workRate = fmRandom(Math.max(3, 13 + bias), 3);
    a.marking = fmRandom(8, 3);
    a.tackling = fmRandom(8, 3);
    a.heading = fmRandom(7, 3);
    a.defensivePositioning = fmRandom(8, 3);
    a.strength = fmRandom(9, 3);
  } else if (position === 'AML' || position === 'AMR') {
    a.pace = fmRandom(Math.max(3, 16 + bias), 3);
    a.acceleration = fmRandom(Math.max(3, 16 + bias), 3);
    a.dribbling = fmRandom(Math.max(3, 16 + bias), 3);
    a.technique = fmRandom(Math.max(3, 14 + bias), 3);
    a.finishing = fmRandom(Math.max(3, 13 + bias), 3);
    a.offTheBall = fmRandom(Math.max(3, 14 + bias), 3);
    a.agility = fmRandom(Math.max(3, 14 + bias), 3);
    a.crossing = fmRandom(Math.max(3, 12 + bias), 3);
    a.marking = fmRandom(5, 2);
    a.tackling = fmRandom(5, 2);
    a.heading = fmRandom(7, 3);
    a.defensivePositioning = fmRandom(5, 2);
    a.strength = fmRandom(8, 3);
  } else if (position === 'AMC') {
    a.passing = fmRandom(Math.max(3, 16 + bias), 3);
    a.vision = fmRandom(Math.max(3, 16 + bias), 3);
    a.technique = fmRandom(Math.max(3, 15 + bias), 3);
    a.decisions = fmRandom(Math.max(3, 14 + bias), 3);
    a.firstTouch = fmRandom(Math.max(3, 15 + bias), 3);
    a.dribbling = fmRandom(Math.max(3, 14 + bias), 3);
    a.finishing = fmRandom(Math.max(3, 13 + bias), 3);
    a.composure = fmRandom(Math.max(3, 13 + bias), 3);
    a.marking = fmRandom(5, 2);
    a.tackling = fmRandom(5, 2);
    a.heading = fmRandom(7, 3);
    a.defensivePositioning = fmRandom(5, 2);
    a.strength = fmRandom(8, 3);
    a.ballWinning = fmRandom(5, 2);
  } else if (position === 'ST') {
    a.finishing = fmRandom(Math.max(3, 16 + bias), 3);
    a.shooting = fmRandom(Math.max(3, 15 + bias), 3);
    a.offTheBall = fmRandom(Math.max(3, 15 + bias), 3);
    a.composure = fmRandom(Math.max(3, 14 + bias), 3);
    a.technique = fmRandom(Math.max(3, 13 + bias), 3);
    a.heading = fmRandom(Math.max(3, 13 + bias), 3);
    a.firstTouch = fmRandom(Math.max(3, 13 + bias), 3);
    a.anticipation = fmRandom(Math.max(3, 13 + bias), 3);
    a.marking = fmRandom(4, 2);
    a.tackling = fmRandom(4, 2);
    a.defensivePositioning = fmRandom(4, 2);
    a.ballWinning = fmRandom(4, 2);
    a.crossing = fmRandom(7, 3);
  }

  // Clamp 1-20
  for (const key in a) {
    const k = key as keyof Attributes;
    a[k] = Math.max(1, Math.min(20, a[k]));
  }

  return a;
}

// ═══════════════════════════════════════════════
// GENEL REYTİNG (1-20)
// ═══════════════════════════════════════════════

function calculateOverall(a: Attributes, position: Position): number {
  let score: number;

  if (position === 'GK') {
    score = a.goalkeeper * 0.3 + a.reflexes * 0.25 + a.handling * 0.2 + a.oneOnOne * 0.15 + a.gkPositioning * 0.1;
  } else if (position === 'DC') {
    score = a.marking * 0.25 + a.tackling * 0.2 + a.defensivePositioning * 0.2 + a.anticipation * 0.15 + a.strength * 0.1 + a.heading * 0.1;
  } else if (position === 'DL' || position === 'DR') {
    score = a.marking * 0.2 + a.tackling * 0.2 + a.defensivePositioning * 0.15 + a.pace * 0.15 + a.acceleration * 0.1 + a.stamina * 0.1 + a.crossing * 0.1;
  } else if (position === 'DM') {
    score = a.passing * 0.2 + a.tackling * 0.2 + a.ballWinning * 0.15 + a.positioning * 0.15 + a.decisions * 0.15 + a.workRate * 0.15;
  } else if (position === 'MC') {
    score = a.passing * 0.25 + a.vision * 0.2 + a.decisions * 0.2 + a.technique * 0.15 + a.workRate * 0.1 + a.stamina * 0.1;
  } else if (position === 'ML' || position === 'MR') {
    score = a.pace * 0.25 + a.dribbling * 0.25 + a.crossing * 0.2 + a.acceleration * 0.15 + a.technique * 0.15;
  } else if (position === 'AML' || position === 'AMR') {
    score = a.pace * 0.25 + a.dribbling * 0.25 + a.crossing * 0.15 + a.finishing * 0.2 + a.offTheBall * 0.15;
  } else if (position === 'AMC') {
    score = a.passing * 0.2 + a.vision * 0.2 + a.technique * 0.2 + a.decisions * 0.15 + a.finishing * 0.15 + a.dribbling * 0.1;
  } else if (position === 'ST') {
    score = a.finishing * 0.3 + a.shooting * 0.2 + a.offTheBall * 0.2 + a.composure * 0.15 + a.technique * 0.15;
  } else {
    score = 10;
  }

  return Math.max(1, Math.min(20, Math.round(score)));
}

// ═══════════════════════════════════════════════
// DEĞER HESABI (1-20 reyting) — 15-35 YAŞ ARASI
// ═══════════════════════════════════════════════

export function calculateValue(overall: number, age: number): number {
  const ratingFactor = Math.max(0, (overall - 5) / 15);
  const baseValue = Math.pow(ratingFactor, 3) * 90_000_000;

  let ageModifier: number;

  if (age <= 15) {
    ageModifier = 0.60;
  } else if (age <= 17) {
    ageModifier = 0.60 + (age - 15) * 0.20;
  } else if (age <= 20) {
    ageModifier = 1.00 + (age - 17) * 0.10;
  } else if (age <= 23) {
    ageModifier = 1.30 + (age - 20) * 0.0167;
  } else if (age <= 26) {
    ageModifier = 1.35 - (age - 23) * 0.05;
  } else if (age <= 29) {
    ageModifier = 1.20 - (age - 26) * 0.10;
  } else if (age <= 31) {
    ageModifier = 0.90 - (age - 29) * 0.125;
  } else if (age <= 33) {
    ageModifier = 0.65 - (age - 31) * 0.125;
  } else if (age <= 35) {
    ageModifier = 0.40 - (age - 33) * 0.10;
  } else {
    ageModifier = Math.max(0.05, 0.20 - (age - 35) * 0.075);
  }

  return Math.max(50_000, Math.round(baseValue * ageModifier));
}

// ═══════════════════════════════════════════════
// OYUNCU ÜRETİMİ
// ═══════════════════════════════════════════════

const SQUAD_TEMPLATE: Position[] = [
  'GK', 'GK',
  'DC', 'DC', 'DC', 'DC',
  'DL', 'DL',
  'DR', 'DR',
  'DM', 'DM',
  'MC', 'MC', 'MC',
  'ML', 'MR',
  'AMC',
  'AML', 'AMR',
  'ST', 'ST', 'ST',
];

export function generatePlayer(position: Position, clubId: string, index: number): Player {
  const age = generateAge();
  const attributes = randomAttributes(position, age);
  const overall = calculateOverall(attributes, position);

  const value = calculateValue(overall, age);
  const wage = Math.round(value / 500);

  const ageFactor = Math.max(0, age - 15);
  const initialApps = ageFactor * randomBetween(10, 25);
  const initialAvgRating = ageFactor > 0 ? Math.round((5.8 + Math.random() * 1.2) * 100) / 100 : 0;

  const careerStats: CareerStats = {
    appearances: initialApps, goals: 0, assists: 0, yellowCards: 0, redCards: 0,
    avgRating: initialAvgRating, minutesPlayed: ageFactor * randomBetween(800, 2000), motm: 0,
    seasonAppearances: 0, seasonGoals: 0, seasonAssists: 0,
    seasonYellowCards: 0, seasonRedCards: 0, seasonAvgRating: 0,
    seasonMinutesPlayed: 0, seasonMotm: 0,
  };

  return {
    id: `player_${clubId}_${index}`,
    name: randomName(),
    age,
    nationality: randomNationality(),
    position,
    secondaryPositions: generateSecondaryPositions(position),
    attributes,
    condition: 100,
    morale: randomBetween(50, 90),
    form: randomBetween(40, 80),
    fatigue: 0,
    wage,
    value,
    clubId,
    injuryWeeks: 0,
    injuryType: null,
    yellowCards: 0,
    suspensionWeeks: 0,
    sentOff: false,
    injured: false,
    redCard: false,
    careerStats,
    recentRatings: [],
    overall,
  };
}

// ═══════════════════════════════════════════════
// GENÇ OYUNCU ÜRETİMİ (RE-GEN)
// ═══════════════════════════════════════════════

/**
 * Emekli olan oyuncunun yerine genç yetenek üretir.
 * Yaş: 15-18 arası
 */
export function generateYouthPlayer(
  position?: Position,
  nationality?: string,
  clubId: string | null = null
): Player {
  const positions: Position[] = ['GK', 'DC', 'DL', 'DR', 'DM', 'MC', 'ML', 'MR', 'AMC', 'AML', 'AMR', 'ST'];
  const pos = position ?? positions[Math.floor(Math.random() * positions.length)];
  const nat = nationality ?? randomNationality();
  const age = randomBetween(15, 18);

  const attributes = randomAttributes(pos, age);
  const overall = calculateOverall(attributes, pos);
  const value = calculateValue(overall, age);

  return {
    id: `youth_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: randomName(),
    age,
    nationality: nat,
    position: pos,
    secondaryPositions: generateSecondaryPositions(pos),
    attributes,
    condition: 100,
    morale: randomBetween(70, 95),
    form: randomBetween(50, 70),
    fatigue: 0,
    wage: Math.round(value / 500),
    value,
    clubId,
    injuryWeeks: 0,
    injuryType: null,
    yellowCards: 0,
    suspensionWeeks: 0,
    sentOff: false,
    injured: false,
    redCard: false,
    careerStats: createEmptyCareerStats(),
    recentRatings: [],
    overall,
  };
}

/**
 * Emekli olan oyuncuların yerine genç üretir.
 * developPlayers'dan SONRA çağrılmalı (emekliler zaten silinmiş olur).
 *
 * Kadro hedefi 24. Eksik pozisyonları tespit edip genç üretir.
 */
export function replaceRetiredPlayers(
  players: Record<string, Player>,
  clubs: Record<string, Club>
): Record<string, Player> {
  const newPlayers = { ...players };

  // Her kulüp için kadro sayısını kontrol et
  for (const clubId in clubs) {
    const clubPlayers = Object.values(newPlayers).filter(
      p => p.clubId === clubId
    );
    const squadSize = clubPlayers.length;

    // 24 kişilik kadro hedefi
    const TARGET_SQUAD_SIZE = 24;
    const missing = TARGET_SQUAD_SIZE - squadSize;

    if (missing > 0) {
      // Eksik pozisyonları belirle
      const positionCounts: Record<string, number> = {};
      clubPlayers.forEach(p => {
        positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
      });

      // SQUAD_TEMPLATE'e göre eksik pozisyonları bul
      const needPositions: Position[] = [];
      for (const pos of SQUAD_TEMPLATE) {
        const have = positionCounts[pos] || 0;
        const templateCount = SQUAD_TEMPLATE.filter(p => p === pos).length;
        if (have < templateCount) {
          needPositions.push(pos);
        }
      }

      // Eksik sayı kadar genç üret
      for (let i = 0; i < missing; i++) {
        const pos = needPositions[i] ?? SQUAD_TEMPLATE[i % SQUAD_TEMPLATE.length];
        const youth = generateYouthPlayer(pos, undefined, clubId);
        newPlayers[youth.id] = youth;
      }
    }
  }

  return newPlayers;
}

// ═══════════════════════════════════════════════
// KULÜP ÜRETİMİ
// ═══════════════════════════════════════════════

const CLUB_DATA: { name: string; shortName: string; reputation: number }[] = [
  { name: 'İstanbul FK',      shortName: 'İST', reputation: 10 },
  { name: 'Ankara United',    shortName: 'ANK', reputation: 8 },
  { name: 'İzmir City',       shortName: 'İZM', reputation: 9 },
  { name: 'Bursa Spor',       shortName: 'BUR', reputation: 7 },
  { name: 'Antalya FC',       shortName: 'ANT', reputation: 6 },
  { name: 'Trabzon SK',       shortName: 'TRA', reputation: 8 },
  { name: 'Adana Demir',      shortName: 'ADA', reputation: 6 },
  { name: 'Konya Spor',       shortName: 'KON', reputation: 5 },
  { name: 'London FC',        shortName: 'LON', reputation: 10 },
  { name: 'Manchester City',  shortName: 'MAN', reputation: 10 },
  { name: 'Liverpool United', shortName: 'LIV', reputation: 10 },
  { name: 'Madrid CF',        shortName: 'MAD', reputation: 10 },
  { name: 'Barcelona FC',     shortName: 'BAR', reputation: 10 },
  { name: 'Milano Inter',     shortName: 'MIL', reputation: 10 },
  { name: 'Munich Bayern',    shortName: 'MUN', reputation: 10 },
  { name: 'Paris SG',         shortName: 'PAR', reputation: 10 },
];

const FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'];

function defaultTactic(formation: Formation): Tactic {
  return {
    formation,
    mentality: 'balanced',
    pressing: 'medium',
    tempo: 'normal',
    width: 'normal',
    directness: 'mixed',
    defensiveLine: 'normal',
  };
}

export function generateGameData(): {
  clubs: Record<string, Club>;
  players: Record<string, Player>;
} {
  const clubs: Record<string, Club> = {};
  const players: Record<string, Player> = {};

  let playerIndex = 0;

  CLUB_DATA.forEach((data, i) => {
    const clubId = `club_${i + 1}`;
    const formation = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)];

    const club: Club = {
      id: clubId,
      name: data.name,
      shortName: data.shortName,
      budget: randomBetween(5_000_000, 50_000_000),
      wageBudget: randomBetween(200_000, 800_000),
      stadiumCapacity: randomBetween(15_000, 60_000),
      reputation: data.reputation,
      formation,
      tactic: defaultTactic(formation),
      isUser: false,
    };

    clubs[clubId] = club;

    for (const pos of SQUAD_TEMPLATE) {
      const player = generatePlayer(pos, clubId, playerIndex++);
      players[player.id] = player;
    }
  });

  return { clubs, players };
}

// ═══════════════════════════════════════════════
// OYUNCU REYTİNGİ
// ═══════════════════════════════════════════════

export function scorePlayer(p: Player): number {
  if (typeof p.overall === 'number' && p.overall >= 1 && p.overall <= 20) {
    const condFactor = 0.5 + (p.condition / 100) * 0.5;
    const moraleFactor = 0.9 + (p.morale / 100) * 0.1;
    const formFactor = 0.9 + (p.form / 100) * 0.1;
    const result = p.overall * condFactor * moraleFactor * formFactor;
    return Math.max(1, Math.min(20, Math.round(result)));
  }
  return calculateOverall(p.attributes, p.position);
}

// ═══════════════════════════════════════════════
// İLK 11
// ═══════════════════════════════════════════════

export function getStartingXI(
  clubId: string,
  players: Record<string, Player>,
  formation: Formation,
  userLineup?: string[]
): Player[] {
  const clubPlayers = Object.values(players).filter(
    p => p.clubId === clubId && p.injuryWeeks === 0 && p.suspensionWeeks === 0
  );

  if (userLineup && userLineup.length === 11) {
    const lineupPlayers = userLineup
      .map(id => players[id])
      .filter(p => p && p.clubId === clubId && p.injuryWeeks === 0 && p.suspensionWeeks === 0);
    if (lineupPlayers.length === 11) return lineupPlayers;
  }

  const needs: Record<Formation, Partial<Record<Position, number>>> = {
    '4-4-2':    { GK: 1, DC: 2, DL: 1, DR: 1, ML: 1, MR: 1, MC: 2, ST: 2 },
    '4-3-3':    { GK: 1, DC: 2, DL: 1, DR: 1, MC: 3, AML: 1, AMR: 1, ST: 1 },
    '3-5-2':    { GK: 1, DC: 3, DL: 1, DR: 1, MC: 3, ST: 2 },
    '4-2-3-1':  { GK: 1, DC: 2, DL: 1, DR: 1, DM: 2, AMC: 1, AML: 1, AMR: 1, ST: 1 },
  };

  const need = needs[formation];
  const result: Player[] = [];
  const used = new Set<string>();

  for (const [pos, count] of Object.entries(need)) {
    const needed = count as number;
    const candidates = clubPlayers
      .filter(p => p.position === pos && !used.has(p.id))
      .sort((a, b) => scorePlayer(b) - scorePlayer(a));

    for (let i = 0; i < needed; i++) {
      if (candidates[i]) {
        result.push(candidates[i]);
        used.add(candidates[i].id);
      } else {
        const fallback = clubPlayers.find(p => !used.has(p.id));
        if (fallback) {
          result.push(fallback);
          used.add(fallback.id);
        }
      }
    }
  }

  for (const p of clubPlayers) {
    if (result.length >= 11) break;
    if (!used.has(p.id)) {
      result.push(p);
      used.add(p.id);
    }
  }

  return result.slice(0, 11);
}