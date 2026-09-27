import type { Attributes, Club, Player, Position, Formation } from '../types';

const FIRST_NAMES = [
  'Ahmet', 'Mehmet', 'Can', 'Emre', 'Burak', 'Kerem', 'Yusuf', 'Arda', 'Hakan', 'Ozan',
  'John', 'David', 'Michael', 'James', 'Robert', 'William', 'Thomas', 'Daniel', 'Marco', 'Luca',
  'Diego', 'Carlos', 'Pedro', 'Juan', 'Sergio', 'Andres', 'Mateo', 'Luis', 'Rafael', 'Bruno',
];

const LAST_NAMES = [
  'Yılmaz', 'Demir', 'Kaya', 'Şahin', 'Çelik', 'Yıldız', 'Aydın', 'Öztürk', 'Arslan', 'Doğan',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Rossi', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Silva', 'Santos', 'Oliveira', 'Costa', 'Pereira',
];

const NATIONALITIES = ['TR', 'EN', 'ES', 'IT', 'DE', 'FR', 'BR', 'AR', 'NL', 'PT'];

const CLUB_NAMES = [
  ['İstanbul FK', 'İST'],
  ['Ankara United', 'ANK'],
  ['İzmir City', 'İZM'],
  ['Bursa Spor', 'BUR'],
  ['Antalya FC', 'ANT'],
  ['Trabzon SK', 'TRA'],
  ['Adana Demir', 'ADA'],
  ['Konya Spor', 'KON'],
  ['London FC', 'LON'],
  ['Manchester City', 'MAN'],
  ['Liverpool United', 'LIV'],
  ['Madrid CF', 'MAD'],
  ['Barcelona FC', 'BAR'],
  ['Milano Inter', 'MIL'],
  ['Munich Bayern', 'MUN'],
  ['Paris SG', 'PAR'],
];

const POSITIONS: Position[] = ['GK', 'DC', 'DC', 'DL', 'DR', 'MC', 'MC', 'ML', 'MR', 'ST', 'ST', 'DC', 'MC', 'ST', 'GK', 'DL', 'DR', 'MC', 'ST', 'MR'];
const FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateAttributes(position: Position, reputation: number): Attributes {
  const base = reputation + 5;
  const attr = (mod: number = 0) => Math.max(1, Math.min(20, rand(base - 4, base + 2) + mod));

  switch (position) {
    case 'GK':
      return { pace: attr(-5), passing: attr(-3), shooting: attr(-8), defending: attr(-5), physical: attr(0), mental: attr(1), goalkeeping: attr(3) };
    case 'DC':
      return { pace: attr(-2), passing: attr(-1), shooting: attr(-6), defending: attr(3), physical: attr(2), mental: attr(1), goalkeeping: attr(-10) };
    case 'DL':
    case 'DR':
      return { pace: attr(2), passing: attr(0), shooting: attr(-5), defending: attr(1), physical: attr(0), mental: attr(0), goalkeeping: attr(-10) };
    case 'MC':
      return { pace: attr(0), passing: attr(3), shooting: attr(-1), defending: attr(0), physical: attr(0), mental: attr(2), goalkeeping: attr(-10) };
    case 'ML':
    case 'MR':
      return { pace: attr(3), passing: attr(2), shooting: attr(0), defending: attr(-2), physical: attr(-1), mental: attr(0), goalkeeping: attr(-10) };
    case 'ST':
      return { pace: attr(3), passing: attr(-2), shooting: attr(4), defending: attr(-7), physical: attr(1), mental: attr(0), goalkeeping: attr(-10) };
  }
}

export function generateGameData(): { clubs: Record<string, Club>; players: Record<string, Player> } {
  const clubs: Record<string, Club> = {};
  const players: Record<string, Player> = {};

  CLUB_NAMES.forEach(([name, short], idx) => {
    const clubId = `club_${idx + 1}`;
    const reputation = 10 + Math.floor(idx / 4);
    clubs[clubId] = {
      id: clubId,
      name,
      shortName: short,
      budget: rand(5, 30) * 1_000_000,
      wageBudget: rand(200, 800) * 1_000,
      stadiumCapacity: rand(15000, 60000),
      reputation,
      formation: pick(FORMATIONS),
      tactic: {
        formation: pick(FORMATIONS),
        mentality: 'balanced',
        pressing: 'medium',
        tempo: 'normal',
      },
      isUser: false,
    };

    for (let i = 0; i < 20; i++) {
      const playerId = `player_${clubId}_${i + 1}`;
      const position = POSITIONS[i % POSITIONS.length];
      const age = rand(18, 34);
      const attributes = generateAttributes(position, reputation);
      const overall = Object.values(attributes).reduce((a, b) => a + b, 0) / 7;
      const value = Math.round(overall * overall * 50_000 * (30 - age > 0 ? (30 - age) / 10 : 0.5));

      players[playerId] = {
        id: playerId,
        name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        age,
        nationality: pick(NATIONALITIES),
        position,
        attributes,
        condition: 100,
        morale: rand(60, 90),
        form: rand(50, 80),
        wage: Math.round(overall * 1_000),
        value,
        clubId,
        injuryWeeks: 0,
        injuryType: null,
        yellowCards: 0,
        suspensionWeeks: 0,
      };
    }
  });

  return { clubs, players };
}

export function getStartingXI(clubId: string, players: Record<string, Player>, formation: Formation): Player[] {
  const clubPlayers = Object.values(players).filter(p =>
    p.clubId === clubId &&
    p.injuryWeeks === 0 &&
    p.suspensionWeeks === 0
  );

  const needs: Record<Formation, Record<string, number>> = {
    '4-4-2': { GK: 1, DC: 2, DL: 1, DR: 1, ML: 1, MR: 1, MC: 2, ST: 2 },
    '4-3-3': { GK: 1, DC: 2, DL: 1, DR: 1, MC: 3, ML: 1, MR: 1, ST: 1 },
    '3-5-2': { GK: 1, DC: 3, DL: 1, DR: 1, MC: 3, ST: 2 },
    '4-2-3-1': { GK: 1, DC: 2, DL: 1, DR: 1, MC: 2, ML: 1, MR: 1, ST: 1 },
  };

  const need = needs[formation];
  const result: Player[] = [];
  const used = new Set<string>();

  for (const [pos, count] of Object.entries(need)) {
    const candidates = clubPlayers
      .filter(p => p.position === pos && !used.has(p.id))
      .sort((a, b) => scorePlayer(b) - scorePlayer(a));
    for (let i = 0; i < count && i < candidates.length; i++) {
      result.push(candidates[i]);
      used.add(candidates[i].id);
    }
  }

  const remaining = clubPlayers
    .filter(p => !used.has(p.id))
    .sort((a, b) => scorePlayer(b) - scorePlayer(a));
  while (result.length < 11 && remaining.length > 0) {
    result.push(remaining.shift()!);
  }

  return result;
}

export function scorePlayer(p: Player): number {
  const a = p.attributes;
  return (a.pace + a.passing + a.shooting + a.defending + a.physical + a.mental + a.goalkeeping) / 7;
}