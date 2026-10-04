import { describe, it } from 'vitest';
import { generateGameData } from '../data/generateData';
import { simulateMatchLive } from './liveMatch';

describe('BUG-020 runtime provenance after pass-target fix', () => {
  it('prints the remaining goal sources', () => {
    const { clubs, players } = generateGameData(20261004);
    const clubList = Object.values(clubs);

    for (let i = 0; i < 2; i += 1) {
      const home = clubList[(i * 2) % clubList.length];
      const away = clubList[(i * 2 + 1) % clubList.length];
      const match = simulateMatchLive(home, away, players, {
        week: 20,
        seed: 100000 + i,
      });

      const goals = match.events
        .map((event, index) => ({ event, index }))
        .filter(({ event }) => event.type === 'goal')
        .map(({ event, index }) => ({
          minute: event.minute,
          description: event.description,
          scorer: event.playerId ?? null,
          clubId: event.clubId ?? null,
          ownGoal: event.description.includes('Kendi kalesine'),
          previousEventType: index > 0 ? match.events[index - 1].type : null,
          previousEventPlayer: index > 0 ? match.events[index - 1].playerId ?? null : null,
        }));

      const counts = match.events.reduce<Record<string, number>>((acc, event) => {
        acc[event.type] = (acc[event.type] ?? 0) + 1;
        return acc;
      }, {});

      console.log('[BUG-020-POST-PASS-FIX]', JSON.stringify({
        match: i + 1,
        seed: 100000 + i,
        score: [match.homeScore, match.awayScore],
        shots: match.stats.shots,
        xG: match.stats.xG,
        counts,
        goals,
      }));
    }
  }, 120000);
});
