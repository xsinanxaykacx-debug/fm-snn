// src/engine/academy/academy.ts

import type { Player, Position, AcademyPlayer, Club } from '../types';
import { createEmptyCareerStats } from '../data/generateData';

// ═══════════════════════════════════════════════
// FM TARZI POTANSİYEL (1-200)
// ═══════════════════════════════════════════════

/**
 * FM tarzı potansiyel dağılımı:
 * - Çoğu oyuncu ortalama (60-100)
 * - Az kısmı iyi (100-140)
 * - Çok az kısmı yıldız (140-170)
 * - Neredeyse hiç dünya klası (170-200)
 */
export function generatePotential(): number {
  const roll = Math.random();

  if (roll < 0.40) return 60 + Math.floor(Math.random() * 41);     // 60-100  (%40)
  if (roll < 0.75) return 100 + Math.floor(Math.random() * 41);    // 100-140 (%35)
  if (roll < 0.92) return 140 + Math.floor(Math.random() * 31);    // 140-170 (%17)
  if (roll < 0.99) return 170 + Math.floor(Math.random() * 21);    // 170-190 (%7)
  return 190 + Math.floor(Math.random() * 11);                      // 190-200 (%1) 💎
}

/**
 * Potansiyelden yıldız hesapla (0.5 - 5.0)
 */
export function potentialToStars(potential: number): number {
  if (potential < 70)  return 0.5;
  if (potential < 90)  return 1.0;
  if (potential < 110) return 1.5;
  if (potential < 125) return 2.0;
  if (potential < 140) return 2.5;
  if (potential < 155) return 3.0;
  if (potential < 170) return 3.5;
  if (potential < 185) return 4.0;
  if (potential < 195) return 4.5;
  return 5.0;
}

/**
 * Potansiyelden scout değerlendirmesi
 */
export function potentialToScoutRating(potential: number): string {
  if (potential < 80)  return '❌ Yeteneksiz';
  if (potential < 100) return '⚠️ Gelişebilir';
  if (potential < 120) return '📈 Ortalama';
  if (potential < 140) return '✅ İyi';
  if (potential < 160) return '🌟 Yıldız Adayı';
  if (potential < 180) return '💎 Gelecek Yıldız';
  if (potential < 195) return '🔥 Dünya Klası Adayı';
  return '👑 Efsane Potansiyeli';
}

// ═══════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════

const FIRST_NAMES = [
  'Luis', 'Marco', 'Carlos', 'Diego', 'Juan', 'Pedro', 'Miguel', 'Sergio',
  'Emre', 'Mehmet', 'Can', 'Hakan', 'Ozan', 'Yusuf', 'Burak', 'Arda', 'Kerem', 'Cenk',
  'John', 'Michael', 'William', 'Robert', 'James', 'Thomas', 'Daniel',
  'Leo', 'Theo', 'Luca', 'Kaan', 'Mert', 'Ali', 'Efe', 'Poyraz',
];

const LAST_NAMES = [
  'Kaya', 'Demir', 'Yılmaz', 'Çelik', 'Şahin', 'Yıldız', 'Aydın', 'Öztürk', 'Arslan', 'Doğan',
  'Smith', 'Johnson', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Silva', 'Santos', 'Ferreira', 'Costa', 'Oliveira', 'Pereira',
  'Yalçın', 'Koç', 'Kurt', 'Özdemir', 'Aslan', 'Çetin', 'Kılıç',
];

const NATIONALITIES = ['TR', 'EN', 'DE', 'FR', 'ES', 'IT', 'BR', 'AR', 'NL', 'PT'];

const POSITIONS: Position[] = ['GK', 'DC', 'DL', 'DR', 'DM', 'MC', 'ML', 'MR', 'AMC', 'AML', 'AMR', 'ST'];

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

// ═══════════════════════════════════════════════
// AKADEMİ OYUNCUSU ÜRETİMİ
// ═══════════════════════════════════════════════

/**
 * Akademi için genç oyuncu üretir.
 * Yaş: 15-19
 * Potansiyel: 1-200 FM tarzı
 */
export function generateAcademyPlayer(
  clubId: string,
  forcedPosition?: Position,
  forcedAge?: number
): AcademyPlayer {
  const age = forcedAge ?? randomBetween(15, 19);
  const position = forcedPosition ?? POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
  const potential = generatePotential();

  // Attributes potansiyele göre belirlenir
  const baseAttr = Math.floor(potential / 20) + randomBetween(-2, 2);
  const clampedBase = Math.max(1, Math.min(15, baseAttr));

  const r = (min: number, max: number) => randomBetween(
    Math.max(1, min),
    Math.min(20, max)
  );

  const attributes = {
    passing: r(clampedBase - 2, clampedBase + 2),
    firstTouch: r(clampedBase - 2, clampedBase + 2),
    dribbling: r(clampedBase - 2, clampedBase + 2),
    crossing: r(clampedBase - 2, clampedBase + 2),
    shooting: r(clampedBase - 2, clampedBase + 2),
    finishing: r(clampedBase - 2, clampedBase + 2),
    technique: r(clampedBase - 2, clampedBase + 2),
    heading: r(clampedBase - 2, clampedBase + 2),
    setPieces: r(clampedBase - 3, clampedBase + 1),
    longShots: r(clampedBase - 3, clampedBase + 1),

    decisions: r(clampedBase - 2, clampedBase + 2),
    vision: r(clampedBase - 2, clampedBase + 2),
    anticipation: r(clampedBase - 2, clampedBase + 2),
    positioning: r(clampedBase - 2, clampedBase + 2),
    offTheBall: r(clampedBase - 2, clampedBase + 2),
    concentration: r(clampedBase - 2, clampedBase + 2),
    composure: r(clampedBase - 2, clampedBase + 2),
    workRate: r(clampedBase - 1, clampedBase + 3),
    teamwork: r(clampedBase - 1, clampedBase + 3),
    bravery: r(clampedBase - 2, clampedBase + 2),
    aggression: r(clampedBase - 2, clampedBase + 2),

    pace: r(clampedBase - 1, clampedBase + 3),
    acceleration: r(clampedBase - 1, clampedBase + 3),
    agility: r(clampedBase - 1, clampedBase + 3),
    stamina: r(clampedBase - 2, clampedBase + 2),
    strength: r(clampedBase - 3, clampedBase + 1),
    balance: r(clampedBase - 2, clampedBase + 2),

    marking: r(clampedBase - 2, clampedBase + 2),
    tackling: r(clampedBase - 2, clampedBase + 2),
    ballWinning: r(clampedBase - 2, clampedBase + 2),
    defensivePositioning: r(clampedBase - 2, clampedBase + 2),

    goalkeeper: position === 'GK' ? r(clampedBase, clampedBase + 4) : r(1, 3),
    reflexes: position === 'GK' ? r(clampedBase, clampedBase + 4) : r(1, 3),
    gkPositioning: position === 'GK' ? r(clampedBase, clampedBase + 4) : r(1, 3),
    handling: position === 'GK' ? r(clampedBase, clampedBase + 4) : r(1, 3),
    oneOnOne: position === 'GK' ? r(clampedBase, clampedBase + 4) : r(1, 3),
    aerialReach: position === 'GK' ? r(clampedBase, clampedBase + 4) : r(1, 3),
  };

  // Overall hesapla (basit ortalama)
  const overall = Math.max(1, Math.min(20, Math.round(
    Object.values(attributes).reduce((a, b) => a + b, 0) / 37
  )));

  // Akademi oyuncusu için value düşük
  const value = 50_000 + potential * 5_000;

  return {
    id: `academy_${clubId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: randomName(),
    age,
    nationality: NATIONALITIES[Math.floor(Math.random() * NATIONALITIES.length)],
    position,
    secondaryPositions: [],
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

    potential,
    potentialStars: potentialToStars(potential),
    scoutRating: potentialToScoutRating(potential),
  };
}

/**
 * Bir kulüp için akademi alımı üretir.
 * Her sezon 3-6 genç oyuncu gelir.
 */
export function generateIntakeForClub(clubId: string): Record<string, AcademyPlayer> {
  const count = randomBetween(3, 6);
  const players: Record<string, AcademyPlayer> = {};

  for (let i = 0; i < count; i++) {
    const player = generateAcademyPlayer(clubId);
    players[player.id] = player;
  }

  return players;
}

/**
 * Tüm kulüpler için akademi alımı yapar.
 */
export function generateAllIntakes(
  clubs: Record<string, Club>
): Record<string, AcademyPlayer> {
  const allPlayers: Record<string, AcademyPlayer> = {};

  for (const clubId in clubs) {
    const intake = generateIntakeForClub(clubId);
    Object.assign(allPlayers, intake);
  }

  return allPlayers;
}