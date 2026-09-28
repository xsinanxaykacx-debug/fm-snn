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
// YARDIMCILAR
// ═══════════════════════════════════════════════

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

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
// ATTRIBUTE ÜRETİMİ
// ═══════════════════════════════════════════════

function randomAttributes(position: Position): Attributes {
  const base = () => randomBetween(30, 80);

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

    goalkeeper: randomBetween(10, 30),
    reflexes: randomBetween(10, 30),
    gkPositioning: randomBetween(10, 30),
    handling: randomBetween(10, 30),
    oneOnOne: randomBetween(10, 30),
    aerialReach: randomBetween(10, 30),
  };

  // Mevki bazlı boost
  if (position === 'GK') {
    a.goalkeeper = randomBetween(60, 90);
    a.reflexes = randomBetween(60, 90);
    a.gkPositioning = randomBetween(60, 90);
    a.handling = randomBetween(60, 90);
    a.oneOnOne = randomBetween(60, 90);
    a.aerialReach = randomBetween(60, 90);
  } else if (['DC', 'DL', 'DR'].includes(position)) {
    a.marking = randomBetween(55, 85);
    a.tackling = randomBetween(55, 85);
    a.defensivePositioning = randomBetween(55, 85);
    a.strength = randomBetween(55, 85);
    a.heading = randomBetween(55, 85);
  } else if (['DM', 'MC'].includes(position)) {
    a.passing = randomBetween(60, 88);
    a.vision = randomBetween(55, 85);
    a.decisions = randomBetween(55, 85);
    a.workRate = randomBetween(55, 85);
  } else if (['ML', 'MR', 'AML', 'AMR'].includes(position)) {
    a.pace = randomBetween(65, 92);
    a.acceleration = randomBetween(65, 92);
    a.dribbling = randomBetween(60, 88);
    a.crossing = randomBetween(60, 88);
  } else if (['AMC', 'ST'].includes(position)) {
    a.finishing = randomBetween(60, 90);
    a.shooting = randomBetween(60, 90);
    a.offTheBall = randomBetween(60, 88);
    a.composure = randomBetween(60, 88);
    a.technique = randomBetween(60, 88);
  }

  // Tüm değerleri 20-95 arasına sıkıştır
  for (const key in a) {
    const k = key as keyof Attributes;
    const val = a[k];
    if (typeof val === 'number' && !isNaN(val)) {
      a[k] = Math.max(20, Math.min(95, val));
    } else {
      a[k] = 50;
    }
  }

  return a;
}

function scoreAttributes(a: Attributes, position: Position): number {
  if (position === 'GK') {
    const gk = (typeof a.goalkeeper === 'number' && !isNaN(a.goalkeeper)) ? a.goalkeeper : (a.reflexes ?? 50);
    return (gk * 0.3 + a.reflexes * 0.25 + a.handling * 0.2 + a.oneOnOne * 0.15 + a.gkPositioning * 0.1);
  }
  if (['DC', 'DL', 'DR'].includes(position)) {
    return (a.marking * 0.25 + a.tackling * 0.2 + a.defensivePositioning * 0.2 + a.anticipation * 0.15 + a.strength * 0.1 + a.heading * 0.1);
  }
  if (['DM', 'MC'].includes(position)) {
    return (a.passing * 0.25 + a.vision * 0.2 + a.decisions * 0.2 + a.workRate * 0.15 + a.technique * 0.1 + a.stamina * 0.1);
  }
  if (['ML', 'MR', 'AML', 'AMR'].includes(position)) {
    return (a.pace * 0.25 + a.dribbling * 0.25 + a.crossing * 0.2 + a.acceleration * 0.15 + a.technique * 0.15);
  }
  if (['AMC', 'ST'].includes(position)) {
    return (a.finishing * 0.3 + a.shooting * 0.2 + a.offTheBall * 0.2 + a.composure * 0.15 + a.technique * 0.15);
  }
  return 50;
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
  const score = scoreAttributes(attributes, position);

  const ratingFactor = Math.max(0, (score - 40) / 60);
  const value = Math.round(
    Math.pow(ratingFactor, 3) * 60_000_000 +
    age * 50_000
  );
  const wage = Math.round(value / 500);

  // Kariyer istatistikleri (mevcut yaşa göre makul başlangıç)
  const ageFactor = Math.max(0, age - 18);
  const initialApps = ageFactor * randomBetween(15, 30);
  const initialAvgRating = ageFactor > 0 ? Math.round((5.8 + Math.random() * 1.2) * 100) / 100 : 0;

  const careerStats: CareerStats = {
    // Kariyer
    appearances: initialApps,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    avgRating: initialAvgRating,
    minutesPlayed: ageFactor * randomBetween(1000, 2500),
    motm: 0,

    // Sezon (yeni sezon başlangıcı — sıfır)
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
  };
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
  const a = p.attributes;
  const pos = p.position;

  let score: number;

  if (pos === 'GK') {
    const gk = (typeof a.goalkeeper === 'number' && !isNaN(a.goalkeeper)) ? a.goalkeeper : (a.reflexes ?? 50);
    score = gk * 0.3 + a.reflexes * 0.25 + a.handling * 0.2 + a.oneOnOne * 0.15 + a.gkPositioning * 0.1;
  } else if (['DC', 'DL', 'DR'].includes(pos)) {
    score = a.marking * 0.25 + a.tackling * 0.2 + a.defensivePositioning * 0.2 + a.anticipation * 0.15 + a.strength * 0.1 + a.heading * 0.1;
  } else if (['DM', 'MC'].includes(pos)) {
    score = a.passing * 0.25 + a.vision * 0.2 + a.decisions * 0.2 + a.workRate * 0.15 + a.technique * 0.1 + a.stamina * 0.1;
  } else if (['ML', 'MR'].includes(pos)) {
    score = a.pace * 0.25 + a.dribbling * 0.25 + a.crossing * 0.2 + a.acceleration * 0.15 + a.technique * 0.15;
  } else if (['AML', 'AMR'].includes(pos)) {
    score = a.pace * 0.25 + a.dribbling * 0.25 + a.crossing * 0.15 + a.finishing * 0.2 + a.offTheBall * 0.15;
  } else if (pos === 'AMC') {
    score = a.passing * 0.2 + a.vision * 0.2 + a.technique * 0.2 + a.decisions * 0.15 + a.finishing * 0.15 + a.dribbling * 0.1;
  } else if (pos === 'ST') {
    score = a.finishing * 0.3 + a.shooting * 0.2 + a.offTheBall * 0.2 + a.composure * 0.15 + a.technique * 0.15;
  } else {
    score = 50;
  }

  const condFactor = 0.5 + (p.condition / 100) * 0.5;
  const moraleFactor = 0.9 + (p.morale / 100) * 0.1;
  const formFactor = 0.85 + (p.form / 100) * 0.15;

  const result = score * condFactor * moraleFactor * formFactor;
  return Number.isFinite(result) ? Math.round(result) : 50;
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