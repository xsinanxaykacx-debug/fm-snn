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

// 20 oyuncu: dengeli dağılım
const POSITIONS: Position[] = [
  'GK', 'GK',
  'DC', 'DC', 'DC',
  'DL', 'DL',
  'DR', 'DR',
  'DM',
  'MC', 'MC', 'MC',
  'ML', 'MR',
  'AMC',
  'AML', 'AMR',
  'ST', 'ST',
];

const FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'];

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pozisyona göre 30 özelliği üret
 * reputation: 10-13 (takım gücü)
 * Dönen değerler 1-100 arası
 */
function generateAttributes(position: Position, reputation: number): Attributes {
  // Baz seviye: 40-75 arası (reputation'a göre)
  const base = 35 + reputation * 2.5; // 60-67 arası
  const p = (mod: number = 0) => Math.max(15, Math.min(95, Math.round(base + mod + (Math.random() - 0.5) * 20)));

  // Kaleci
  if (position === 'GK') {
    return {
      // Teknik (kaleci düşük)
      passing: p(-25), firstTouch: p(-20), dribbling: p(-35), crossing: p(-40),
      shooting: p(-45), finishing: p(-50), technique: p(-20), heading: p(-30), setPieces: p(-35),
      // Zihinsel
      decisions: p(0), vision: p(-15), anticipation: p(5), positioning: p(5),
      offTheBall: p(-35), concentration: p(5), composure: p(0), workRate: p(-10),
      teamwork: p(0), bravery: p(0),
      // Fiziksel
      pace: p(-25), acceleration: p(-20), agility: p(-10), stamina: p(-15),
      strength: p(-5), balance: p(-10),
      // Savunma
      marking: p(-40), tackling: p(-40), ballWinning: p(-35), defensivePositioning: p(-10),
      // Kaleci
      reflexes: p(15), gkPositioning: p(15), handling: p(15), oneOnOne: p(10), aerialReach: p(10),
    };
  }

  // Defans (DC/DL/DR)
  if (['DC', 'DL', 'DR'].includes(position)) {
    const isDC = position === 'DC';
    const isFullback = position === 'DL' || position === 'DR';
    return {
      passing: p(isFullback ? 0 : -5),
      firstTouch: p(-5),
      dribbling: p(isFullback ? 0 : -15),
      crossing: p(isFullback ? 10 : -20),
      shooting: p(-25),
      finishing: p(-30),
      technique: p(-5),
      heading: p(isDC ? 10 : -5),
      setPieces: p(-15),
      decisions: p(0),
      vision: p(-10),
      anticipation: p(5),
      positioning: p(10),
      offTheBall: p(-10),
      concentration: p(5),
      composure: p(0),
      workRate: p(0),
      teamwork: p(0),
      bravery: p(5),
      pace: p(isFullback ? 10 : -5),
      acceleration: p(isFullback ? 10 : -5),
      agility: p(isFullback ? 5 : -10),
      stamina: p(5),
      strength: p(isDC ? 10 : -5),
      balance: p(0),
      marking: p(15),
      tackling: p(15),
      ballWinning: p(10),
      defensivePositioning: p(15),
      reflexes: p(-45), gkPositioning: p(-45), handling: p(-45), oneOnOne: p(-45), aerialReach: p(-45),
    };
  }

  // Defansif orta saha
  if (position === 'DM') {
    return {
      passing: p(5), firstTouch: p(0), dribbling: p(-5), crossing: p(-10),
      shooting: p(-15), finishing: p(-20), technique: p(0), heading: p(0), setPieces: p(-5),
      decisions: p(10), vision: p(5), anticipation: p(10), positioning: p(10),
      offTheBall: p(-5), concentration: p(10), composure: p(5), workRate: p(10),
      teamwork: p(10), bravery: p(5),
      pace: p(-5), acceleration: p(-5), agility: p(0), stamina: p(10),
      strength: p(5), balance: p(0),
      marking: p(10), tackling: p(15), ballWinning: p(15), defensivePositioning: p(10),
      reflexes: p(-45), gkPositioning: p(-45), handling: p(-45), oneOnOne: p(-45), aerialReach: p(-45),
    };
  }

  // Merkez orta saha
  if (position === 'MC') {
    return {
      passing: p(15), firstTouch: p(10), dribbling: p(5), crossing: p(0),
      shooting: p(0), finishing: p(-5), technique: p(10), heading: p(-10), setPieces: p(5),
      decisions: p(10), vision: p(15), anticipation: p(5), positioning: p(0),
      offTheBall: p(5), concentration: p(5), composure: p(5), workRate: p(10),
      teamwork: p(10), bravery: p(0),
      pace: p(0), acceleration: p(0), agility: p(5), stamina: p(10),
      strength: p(-5), balance: p(5),
      marking: p(-5), tackling: p(-5), ballWinning: p(0), defensivePositioning: p(-5),
      reflexes: p(-45), gkPositioning: p(-45), handling: p(-45), oneOnOne: p(-45), aerialReach: p(-45),
    };
  }

  // Kanat (ML/MR/AML/AMR)
  if (['ML', 'MR', 'AML', 'AMR'].includes(position)) {
    return {
      passing: p(5), firstTouch: p(5), dribbling: p(15), crossing: p(15),
      shooting: p(5), finishing: p(0), technique: p(10), heading: p(-15), setPieces: p(5),
      decisions: p(0), vision: p(5), anticipation: p(0), positioning: p(-5),
      offTheBall: p(10), concentration: p(0), composure: p(0), workRate: p(5),
      teamwork: p(0), bravery: p(0),
      pace: p(15), acceleration: p(15), agility: p(10), stamina: p(5),
      strength: p(-10), balance: p(5),
      marking: p(-20), tackling: p(-20), ballWinning: p(-15), defensivePositioning: p(-15),
      reflexes: p(-45), gkPositioning: p(-45), handling: p(-45), oneOnOne: p(-45), aerialReach: p(-45),
    };
  }

  // Ofansif orta saha
  if (position === 'AMC') {
    return {
      passing: p(15), firstTouch: p(15), dribbling: p(10), crossing: p(5),
      shooting: p(10), finishing: p(10), technique: p(15), heading: p(-10), setPieces: p(10),
      decisions: p(5), vision: p(15), anticipation: p(5), positioning: p(5),
      offTheBall: p(15), concentration: p(0), composure: p(5), workRate: p(0),
      teamwork: p(5), bravery: p(0),
      pace: p(5), acceleration: p(5), agility: p(10), stamina: p(0),
      strength: p(-10), balance: p(5),
      marking: p(-25), tackling: p(-25), ballWinning: p(-20), defensivePositioning: p(-20),
      reflexes: p(-45), gkPositioning: p(-45), handling: p(-45), oneOnOne: p(-45), aerialReach: p(-45),
    };
  }

  // Forvet (ST)
  return {
    passing: p(-5), firstTouch: p(5), dribbling: p(5), crossing: p(-5),
    shooting: p(15), finishing: p(20), technique: p(5), heading: p(5), setPieces: p(0),
    decisions: p(0), vision: p(-5), anticipation: p(10), positioning: p(15),
    offTheBall: p(15), concentration: p(0), composure: p(10), workRate: p(0),
    teamwork: p(0), bravery: p(5),
    pace: p(10), acceleration: p(10), agility: p(5), stamina: p(5),
    strength: p(5), balance: p(0),
    marking: p(-35), tackling: p(-35), ballWinning: p(-30), defensivePositioning: p(-30),
    reflexes: p(-45), gkPositioning: p(-45), handling: p(-45), oneOnOne: p(-45), aerialReach: p(-45),
  };
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
        width: 'normal',
        directness: 'mixed',
        defensiveLine: 'normal',
      },
      isUser: false,
    };

    for (let i = 0; i < 20; i++) {
      const playerId = `player_${clubId}_${i + 1}`;
      const position = POSITIONS[i % POSITIONS.length];
      const age = rand(18, 34);
      const attributes = generateAttributes(position, reputation);

      // Overall: tüm özelliklerin ortalaması (kaleci için kaleci özellikleri ağırlıklı)
      const overall = calculateOverall(attributes, position);
      const value = Math.round(overall * overall * 200 * (30 - age > 0 ? (30 - age) / 10 : 0.5));

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
        wage: Math.round(overall * 100),
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

/**
 * Overall hesaplama — pozisyona göre ağırlıklı
 */
export function calculateOverall(attrs: Attributes, position: Position): number {
  if (position === 'GK') {
    return (
      attrs.reflexes * 0.25 +
      attrs.gkPositioning * 0.25 +
      attrs.handling * 0.20 +
      attrs.oneOnOne * 0.15 +
      attrs.aerialReach * 0.15
    );
  }

  // Genel oyuncu: tüm özelliklerin ağırlıklı ortalaması
  const technical =
    attrs.passing * 0.15 + attrs.firstTouch * 0.10 + attrs.dribbling * 0.10 +
    attrs.crossing * 0.05 + attrs.shooting * 0.10 + attrs.finishing * 0.10 +
    attrs.technique * 0.10 + attrs.heading * 0.10 + attrs.setPieces * 0.05;

  const mental =
    attrs.decisions * 0.15 + attrs.vision * 0.10 + attrs.anticipation * 0.10 +
    attrs.positioning * 0.10 + attrs.offTheBall * 0.10 + attrs.concentration * 0.10 +
    attrs.composure * 0.10 + attrs.workRate * 0.10 + attrs.teamwork * 0.10 + attrs.bravery * 0.05;

  const physical =
    attrs.pace * 0.25 + attrs.acceleration * 0.20 + attrs.agility * 0.15 +
    attrs.stamina * 0.15 + attrs.strength * 0.15 + attrs.balance * 0.10;

  const defensive =
    attrs.marking * 0.30 + attrs.tackling * 0.30 +
    attrs.ballWinning * 0.20 + attrs.defensivePositioning * 0.20;

  return technical * 0.35 + mental * 0.30 + physical * 0.25 + defensive * 0.10;
}

/**
 * Basit overall (eski uyumluluk için)
 */
export function scorePlayer(p: Player): number {
  return calculateOverall(p.attributes, p.position);
}

/**
 * İlk 11 seçimi — formasyona göre
 */
export function getStartingXI(
  clubId: string,
  players: Record<string, Player>,
  formation: Formation
): Player[] {
  const clubPlayers = Object.values(players).filter(
    p => p.clubId === clubId && p.injuryWeeks === 0 && p.suspensionWeeks === 0
  );

  const needs: Record<Formation, Partial<Record<Position, number>>> = {
    '4-4-2': { GK: 1, DC: 2, DL: 1, DR: 1, ML: 1, MR: 1, MC: 2, ST: 2 },
    '4-3-3': { GK: 1, DC: 2, DL: 1, DR: 1, MC: 3, AML: 1, AMR: 1, ST: 1 },
    '3-5-2': { GK: 1, DC: 3, DL: 1, DR: 1, MC: 3, ST: 2 },
    '4-2-3-1': { GK: 1, DC: 2, DL: 1, DR: 1, DM: 2, AMC: 1, AML: 1, AMR: 1, ST: 1 },
  };

  const need = needs[formation];
  const result: Player[] = [];
  const used = new Set<string>();

  for (const [pos, count] of Object.entries(need)) {
    const needed = count as number;
    const candidates = clubPlayers
      .filter(p => p.position === pos && !used.has(p.id))
      .sort((a, b) => scorePlayer(b) - scorePlayer(a));

    for (let i = 0; i < needed && i < candidates.length; i++) {
      result.push(candidates[i]);
      used.add(candidates[i].id);
    }
  }

  // Eksik kalanları en iyi kalanlarla doldur
  const remaining = clubPlayers
    .filter(p => !used.has(p.id))
    .sort((a, b) => scorePlayer(b) - scorePlayer(a));

  while (result.length < 11 && remaining.length > 0) {
    result.push(remaining.shift()!);
  }

  return result;
}