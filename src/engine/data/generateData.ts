import type {
  Attributes,
  CareerStats,
  Club,
  Formation,
  Player,
  Position,
  Tactic,
} from '../types';

const FIRST_NAMES = [
  'Luis', 'Marco', 'Carlos', 'Diego', 'Juan', 'Pedro', 'Miguel', 'Sergio', 'Andres', 'Javier',
  'Emre', 'Mehmet', 'Can', 'Hakan', 'Ozan', 'Yusuf', 'Burak', 'Arda', 'Cenk', 'Kerem',
  'John', 'Michael', 'William', 'Robert', 'James', 'Thomas', 'Daniel', 'David', 'Paul', 'Peter',
];

const LAST_NAMES = [
  'Kaya', 'Demir', 'Yılmaz', 'Çelik', 'Şahin', 'Yıldız', 'Aydın', 'Öztürk', 'Arslan', 'Doğan',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Silva', 'Santos', 'Ferreira', 'Costa', 'Oliveira', 'Pereira', 'Romano', 'Esposito', 'Rossi', 'Ferrari',
];

const NATIONALITIES = ['TR', 'EN', 'DE', 'FR', 'ES', 'IT', 'BR', 'AR', 'NL', 'PT'];

// ═══════════════════════════════════════════════
// 1-20 ARASI YARDIMCILAR
// ═══════════════════════════════════════════════

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 1-20 arası rastgele (ağırlıklı — ortalamaya yakın)
 */
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

export function createEmptyCareerStats(): CareerStats {
  return {
    appearances: 0,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    avgRating: 0,
    minutesPlayed: 0,
    motm: 0,
    seasonAppearances: 0,
    seasonGoals: 0,
    seasonAssists: 0,
    seasonYellowCards: 0,
    seasonRedCards: 0,
    seasonAvgRating: 0,
    seasonMinutesPlayed: 0,
    seasonMotm: 0,
  };
}

// ═══════════════════════════════════════════════
// İKİNCİL MEVKİ ÜRETİMİ
// ═══════════════════════════════════════════════

const SECONDARY_POSITION_MAP: Record<Position, Position[]> = {
  'GK':  [],
  'DC':  ['DM'],
  'DL':  ['ML', 'DC'],
  'DR':  ['MR', 'DC'],
  'DM':  ['MC', 'DC'],
  'MC':  ['DM', 'AMC'],
  'ML':  ['AML', 'DL'],
  'MR':  ['AMR', 'DR'],
  'AMC': ['MC', 'ST'],
  'AML': ['ML', 'ST'],
  'AMR': ['MR', 'ST'],
  'ST':  ['AMC', 'AML', 'AMR'],
};

function generateSecondaryPositions(position: Position): Position[] {
  const candidates = SECONDARY_POSITION_MAP[position] ?? [];
  if (candidates.length === 0) return [];

  const count = Math.random() < 0.6 ? 1 : Math.random() < 0.3 ? 2 : 0;
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ═══════════════════════════════════════════════
// 1-20 ATTRIBUTE ÜRETİMİ
// ═══════════════════════════════════════════════

function randomAttributes(position: Position): Attributes {
  // Taban: 1-20 arası ortalama 9-11
  const base = (avg = 10) => fmRandom(avg, 4);

  const a: Attributes = {
    passing: base(),
    firstTouch: base(),
    dribbling: base(),
    crossing: base(),
    shooting: base(),
    finishing: base(),
    technique: base(),
    heading: base(),
    setPieces: base(),
    longShots: base(),

    decisions: base(),
    vision: base(),
    anticipation: base(),
    positioning: base(),
    offTheBall: base(),
    concentration: base(),
    composure: base(),
    workRate: base(),
    teamwork: base(),
    bravery: base(),
    aggression: base(),

    pace: base(),
    acceleration: base(),
    agility: base(),
    stamina: base(),
    strength: base(),
    balance: base(),

    marking: base(),
    tackling: base(),
    ballWinning: base(),
    defensivePositioning: base(),

    goalkeeper: fmRandom(3, 2),
    reflexes: fmRandom(3, 2),
    gkPositioning: fmRandom(3, 2),
    handling: fmRandom(3, 2),
    oneOnOne: fmRandom(3, 2),
    aerialReach: fmRandom(3, 2),
  };

  // ═══ MEVKİ BAZLI BOOST + ZAYIF YÖNLER ═══

  if (position === 'GK') {
    // Güçlü
    a.goalkeeper = fmRandom(15, 3);
    a.reflexes = fmRandom(15, 3);
    a.gkPositioning = fmRandom(15, 3);
    a.handling = fmRandom(14, 3);
    a.oneOnOne = fmRandom(14, 3);
    a.aerialReach = fmRandom(14, 3);
    a.concentration = fmRandom(13, 3);
    a.decisions = fmRandom(12, 3);

    // Zayıf
    a.finishing = fmRandom(3, 1);
    a.shooting = fmRandom(4, 2);
    a.dribbling = fmRandom(4, 2);
    a.crossing = fmRandom(4, 2);
    a.marking = fmRandom(3, 1);
    a.tackling = fmRandom(3, 1);
    a.pace = fmRandom(7, 3);
    a.offTheBall = fmRandom(4, 2);

  } else if (['DC'].includes(position)) {
    // Güçlü — Stoper
    a.marking = fmRandom(15, 3);
    a.tackling = fmRandom(15, 3);
    a.defensivePositioning = fmRandom(14, 3);
    a.heading = fmRandom(14, 3);
    a.strength = fmRandom(14, 3);
    a.anticipation = fmRandom(13, 3);
    a.concentration = fmRandom(13, 3);
    a.bravery = fmRandom(13, 3);

    // Zayıf
    a.finishing = fmRandom(4, 2);
    a.shooting = fmRandom(5, 2);
    a.dribbling = fmRandom(6, 3);
    a.crossing = fmRandom(6, 3);
    a.longShots = fmRandom(4, 2);
    a.pace = fmRandom(10, 3);

  } else if (['DL', 'DR'].includes(position)) {
    // Güçlü — Bek
    a.marking = fmRandom(13, 3);
    a.tackling = fmRandom(13, 3);
    a.defensivePositioning = fmRandom(12, 3);
    a.pace = fmRandom(14, 3);
    a.acceleration = fmRandom(14, 3);
    a.stamina = fmRandom(14, 3);
    a.crossing = fmRandom(12, 3);
    a.workRate = fmRandom(13, 3);

    // Zayıf
    a.finishing = fmRandom(5, 2);
    a.shooting = fmRandom(6, 2);
    a.heading = fmRandom(9, 3);
    a.longShots = fmRandom(5, 2);
    a.strength = fmRandom(10, 3);

  } else if (position === 'DM') {
    // Güçlü — Defansif Orta Saha
    a.passing = fmRandom(14, 3);
    a.tackling = fmRandom(14, 3);
    a.ballWinning = fmRandom(14, 3);
    a.positioning = fmRandom(14, 3);
    a.decisions = fmRandom(13, 3);
    a.workRate = fmRandom(14, 3);
    a.stamina = fmRandom(14, 3);
    a.teamwork = fmRandom(13, 3);

    // Zayıf
    a.finishing = fmRandom(6, 2);
    a.shooting = fmRandom(7, 3);
    a.dribbling = fmRandom(9, 3);
    a.crossing = fmRandom(8, 3);
    a.pace = fmRandom(10, 3);

  } else if (position === 'MC') {
    // Güçlü — Merkez Orta Saha
    a.passing = fmRandom(15, 3);
    a.vision = fmRandom(13, 3);
    a.decisions = fmRandom(14, 3);
    a.technique = fmRandom(13, 3);
    a.firstTouch = fmRandom(13, 3);
    a.workRate = fmRandom(13, 3);
    a.stamina = fmRandom(13, 3);
    a.teamwork = fmRandom(13, 3);

    // Zayıf
    a.finishing = fmRandom(8, 3);
    a.heading = fmRandom(9, 3);
    a.marking = fmRandom(10, 3);
    a.tackling = fmRandom(10, 3);

  } else if (position === 'ML') {
    // Güçlü — Sol Orta
    a.pace = fmRandom(14, 3);
    a.acceleration = fmRandom(14, 3);
    a.dribbling = fmRandom(14, 3);
    a.crossing = fmRandom(14, 3);
    a.stamina = fmRandom(14, 3);
    a.agility = fmRandom(13, 3);
    a.workRate = fmRandom(13, 3);

    // Zayıf
    a.marking = fmRandom(8, 3);
    a.tackling = fmRandom(8, 3);
    a.heading = fmRandom(7, 3);
    a.defensivePositioning = fmRandom(8, 3);
    a.strength = fmRandom(9, 3);

  } else if (position === 'MR') {
    // Güçlü — Sağ Orta
    a.pace = fmRandom(14, 3);
    a.acceleration = fmRandom(14, 3);
    a.dribbling = fmRandom(14, 3);
    a.crossing = fmRandom(14, 3);
    a.stamina = fmRandom(14, 3);
    a.agility = fmRandom(13, 3);
    a.workRate = fmRandom(13, 3);

    // Zayıf
    a.marking = fmRandom(8, 3);
    a.tackling = fmRandom(8, 3);
    a.heading = fmRandom(7, 3);
    a.defensivePositioning = fmRandom(8, 3);
    a.strength = fmRandom(9, 3);

  } else if (position === 'AML') {
    // Güçlü — Sol Kanat Forvet
    a.pace = fmRandom(16, 3);
    a.acceleration = fmRandom(16, 3);
    a.dribbling = fmRandom(16, 3);
    a.technique = fmRandom(14, 3);
    a.finishing = fmRandom(13, 3);
    a.offTheBall = fmRandom(14, 3);
    a.agility = fmRandom(14, 3);
    a.crossing = fmRandom(12, 3);

    // Zayıf
    a.marking = fmRandom(5, 2);
    a.tackling = fmRandom(5, 2);
    a.heading = fmRandom(7, 3);
    a.defensivePositioning = fmRandom(5, 2);
    a.strength = fmRandom(8, 3);

  } else if (position === 'AMR') {
    // Güçlü — Sağ Kanat Forvet
    a.pace = fmRandom(16, 3);
    a.acceleration = fmRandom(16, 3);
    a.dribbling = fmRandom(16, 3);
    a.technique = fmRandom(14, 3);
    a.finishing = fmRandom(13, 3);
    a.offTheBall = fmRandom(14, 3);
    a.agility = fmRandom(14, 3);
    a.crossing = fmRandom(12, 3);

    // Zayıf
    a.marking = fmRandom(5, 2);
    a.tackling = fmRandom(5, 2);
    a.heading = fmRandom(7, 3);
    a.defensivePositioning = fmRandom(5, 2);
    a.strength = fmRandom(8, 3);

  } else if (position === 'AMC') {
    // Güçlü — Ofansif Orta Saha
    a.passing = fmRandom(16, 3);
    a.vision = fmRandom(16, 3);
    a.technique = fmRandom(15, 3);
    a.decisions = fmRandom(14, 3);
    a.firstTouch = fmRandom(15, 3);
    a.dribbling = fmRandom(14, 3);
    a.finishing = fmRandom(13, 3);
    a.composure = fmRandom(13, 3);

    // Zayıf
    a.marking = fmRandom(5, 2);
    a.tackling = fmRandom(5, 2);
    a.heading = fmRandom(7, 3);
    a.defensivePositioning = fmRandom(5, 2);
    a.strength = fmRandom(8, 3);
    a.ballWinning = fmRandom(5, 2);

  } else if (position === 'ST') {
    // Güçlü — Santrafor
    a.finishing = fmRandom(16, 3);
    a.shooting = fmRandom(15, 3);
    a.offTheBall = fmRandom(15, 3);
    a.composure = fmRandom(14, 3);
    a.technique = fmRandom(13, 3);
    a.heading = fmRandom(13, 3);
    a.firstTouch = fmRandom(13, 3);
    a.anticipation = fmRandom(13, 3);

    // Zayıf
    a.marking = fmRandom(4, 2);
    a.tackling = fmRandom(4, 2);
    a.defensivePositioning = fmRandom(4, 2);
    a.ballWinning = fmRandom(4, 2);
    a.crossing = fmRandom(7, 3);
  }

  // Tüm değerleri 1-20 arasına sıkıştır
  for (const key in a) {
    const k = key as keyof Attributes;
    const val = a[k];
    if (typeof val === 'number' && !isNaN(val)) {
      a[k] = Math.max(1, Math.min(20, Math.round(val)));
    } else {
      a[k] = 10;
    }
  }

  return a;
}

/**
 * Mevkiye göre genel reyting (1-20)
 */
function calculateOverall(a: Attributes, position: Position): number {
  let score: number;

  if (position === 'GK') {
    score = a.goalkeeper * 0.3 + a.reflexes * 0.25 + a.handling * 0.2 + a.oneOnOne * 0.15 + a.gkPositioning * 0.1;
  } else if (['DC'].includes(position)) {
    score = a.marking * 0.25 + a.tackling * 0.2 + a.defensivePositioning * 0.2 + a.anticipation * 0.15 + a.strength * 0.1 + a.heading * 0.1;
  } else if (['DL', 'DR'].includes(position)) {
    score = a.marking * 0.2 + a.tackling * 0.2 + a.defensivePositioning * 0.15 + a.pace * 0.15 + a.acceleration * 0.1 + a.stamina * 0.1 + a.crossing * 0.1;
  } else if (position === 'DM') {
    score = a.passing * 0.2 + a.tackling * 0.2 + a.ballWinning * 0.15 + a.positioning * 0.15 + a.decisions * 0.15 + a.workRate * 0.15;
  } else if (position === 'MC') {
    score = a.passing * 0.25 + a.vision * 0.2 + a.decisions * 0.2 + a.technique * 0.15 + a.workRate * 0.1 + a.stamina * 0.1;
  } else if (['ML', 'MR'].includes(position)) {
    score = a.pace * 0.25 + a.dribbling * 0.25 + a.crossing * 0.2 + a.acceleration * 0.15 + a.technique * 0.15;
  } else if (['AML', 'AMR'].includes(position)) {
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
  const age = randomBetween(18, 34);
  const attributes = randomAttributes(position);
  const overall = calculateOverall(attributes, position);

  // Değer hesabı — 1-20 reytinge göre
  const ratingFactor = Math.max(0, (overall - 5) / 15); // 5-20 → 0-1
  const value = Math.round(
    Math.pow(ratingFactor, 3) * 80_000_000 +
    age * 50_000
  );
  const wage = Math.round(value / 500);

  const ageFactor = Math.max(0, age - 18);
  const initialApps = ageFactor * randomBetween(15, 30);
  const initialAvgRating = ageFactor > 0 ? Math.round((5.8 + Math.random() * 1.2) * 100) / 100 : 0;

  const careerStats: CareerStats = {
    appearances: initialApps,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    avgRating: initialAvgRating,
    minutesPlayed: ageFactor * randomBetween(1000, 2500),
    motm: 0,
    seasonAppearances: 0,
    seasonGoals: 0,
    seasonAssists: 0,
    seasonYellowCards: 0,
    seasonRedCards: 0,
    seasonAvgRating: 0,
    seasonMinutesPlayed: 0,
    seasonMotm: 0,
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

/**
 * Oyuncu genel reytingi (1-20)
 */
export function scorePlayer(p: Player): number {
  // Kaydedilmiş overall varsa onu kullan
  if (typeof p.overall === 'number' && p.overall >= 1 && p.overall <= 20) {
    // Kondisyon, moral, form etkisi
    const condFactor = 0.5 + (p.condition / 100) * 0.5;
    const moraleFactor = 0.9 + (p.morale / 100) * 0.1;
    const formFactor = 0.9 + (p.form / 100) * 0.1;

    const result = p.overall * condFactor * moraleFactor * formFactor;
    return Math.max(1, Math.min(20, Math.round(result)));
  }

  // Fallback — attribute'lardan hesapla
  return calculateOverall(p.attributes, p.position);
}

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

    if (lineupPlayers.length === 11) {
      return lineupPlayers;
    }
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