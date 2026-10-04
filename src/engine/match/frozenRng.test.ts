import { describe, expect, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatch } from './matchEngine';

describe('Frozen match RNG determinism', () => {
  it('produces the same match for the same data seed and match seed', () => {
    const dataA = generateGameData(20261004);
    const dataB = generateGameData(20261004);

    const homeA = dataA.clubs.club_1;
    const awayA = dataA.clubs.club_2;
    const homeB = dataB.clubs.club_1;
    const awayB = dataB.clubs.club_2;

    const matchA = simulateMatch(
      homeA,
      awayA,
      dataA.players,
      1,
      undefined,
      undefined,
      82000
    );

    const matchB = simulateMatch(
      homeB,
      awayB,
      dataB.players,
      1,
      undefined,
      undefined,
      82000
    );

    expect(matchB).toEqual(matchA);
  });

  it('allows different match seeds to produce different outcomes', () => {
    const dataA = generateGameData(20261004);
    const dataB = generateGameData(20261004);

    const matchA = simulateMatch(
      dataA.clubs.club_1,
      dataA.clubs.club_2,
      dataA.players,
      1,
      undefined,
      undefined,
      82000
    );

    const matchB = simulateMatch(
      dataB.clubs.club_1,
      dataB.clubs.club_2,
      dataB.players,
      1,
      undefined,
      undefined,
      82001
    );

    expect(JSON.stringify(matchB)).not.toBe(JSON.stringify(matchA));
  });
});
