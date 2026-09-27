import type { Club, Match } from '../types';

export function generateFixtures(clubs: Record<string, Club>, season: number): Match[] {
  const ids = Object.keys(clubs);
  const n = ids.length;
  if (n % 2 !== 0) throw new Error('Takım sayısı çift olmalı');

  const rounds: [string, string][][] = [];
  const teams = [...ids];

  // Round-robin (Berger tablosu)
  for (let round = 0; round < n - 1; round++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];
      // Ev sahibi değişimi
      if (round % 2 === 0) pairs.push([home, away]);
      else pairs.push([away, home]);
    }
    rounds.push(pairs);
    // Rotate (ilk sabit)
    const fixed = teams[0];
    const rest = teams.slice(1);
    rest.unshift(rest.pop()!);
    teams.splice(0, teams.length, fixed, ...rest);
  }

  // İkinci yarı (rövanş)
  const secondHalf = rounds.map(round =>
    round.map(([h, a]) => [a, h] as [string, string])
  );

  const allRounds = [...rounds, ...secondHalf];

  const matches: Match[] = [];
  allRounds.forEach((round, weekIdx) => {
    round.forEach(([home, away]) => {
      matches.push({
        id: `s${season}_w${weekIdx + 1}_${home}_${away}`,
        week: weekIdx + 1,
        homeId: home,
        awayId: away,
        homeScore: 0,
        awayScore: 0,
        events: [],
        stats: {
          possession: { home: 50, away: 50 },
          shots: { home: 0, away: 0 },
          onTarget: { home: 0, away: 0 },
          chances: { home: 0, away: 0 },
        },
        played: false,
      });
    });
  });

  return matches;
}