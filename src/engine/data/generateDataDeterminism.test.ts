import { describe, it, expect } from 'vitest';
import { generateGameData } from '../data/generateData';

const RUN =
  typeof process !== 'undefined' &&
  process.env.RUN_GENERATE_DATA_DETERMINISM === '1';

describe.skipIf(!RUN)('generateGameData determinism diagnostic', () => {
  it('aynı process içinde iki çağrı aynı dünyayı üretir mi?', () => {
    const a = generateGameData();
    const b = generateGameData();

    const clubsA = Object.values(a.clubs);
    const clubsB = Object.values(b.clubs);
    const playersA = Object.values(a.players);
    const playersB = Object.values(b.players);

    const clubSignatureA = clubsA.map(c => ({
      id: c.id,
      formation: c.formation,
      budget: c.budget,
      wageBudget: c.wageBudget,
      stadiumCapacity: c.stadiumCapacity,
    }));

    const clubSignatureB = clubsB.map(c => ({
      id: c.id,
      formation: c.formation,
      budget: c.budget,
      wageBudget: c.wageBudget,
      stadiumCapacity: c.stadiumCapacity,
    }));

    const playerSignatureA = playersA.slice(0, 5).map(p => ({
      id: p.id,
      overall: p.overall,
      age: p.age,
      nationality: p.nationality,
      condition: p.condition,
      morale: p.morale,
      form: p.form,
      pace: p.attributes.pace,
      passing: p.attributes.passing,
    }));

    const playerSignatureB = playersB.slice(0, 5).map(p => ({
      id: p.id,
      overall: p.overall,
      age: p.age,
      nationality: p.nationality,
      condition: p.condition,
      morale: p.morale,
      form: p.form,
      pace: p.attributes.pace,
      passing: p.attributes.passing,
    }));

    const clubsEqual =
      JSON.stringify(clubSignatureA) === JSON.stringify(clubSignatureB);

    const playersEqual =
      JSON.stringify(playerSignatureA) === JSON.stringify(playerSignatureB);

    console.log('=== GENERATE DATA DETERMINISM ===');
    console.log('clubIds A:', clubsA.map(c => c.id));
    console.log('clubIds B:', clubsB.map(c => c.id));
    console.log('clubSignatureEqual:', clubsEqual);
    console.log('playerSignatureEqual:', playersEqual);
    console.log('playerCount A/B:', playersA.length, playersB.length);
    console.log('player A:', playerSignatureA[0]);
    console.log('player B:', playerSignatureB[0]);

    expect(clubsA.map(c => c.id)).toEqual(clubsB.map(c => c.id));
    expect(clubsEqual).toBe(true);
    expect(playersEqual).toBe(true);
  });
});
